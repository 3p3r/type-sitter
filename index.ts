import { glob } from "glob";
import { basename, extname } from "path";
import { program } from "commander";
import { existsSync, promises as fs } from "fs";
import { main as quicktypeBinary } from "quicktype";
import { iterableFirst } from "collection-utils";
import {
  quicktype,
  InputData,
  JSONSchemaInput,
  FetchingJSONSchemaStore,
  TargetLanguage,
  Option,
  StringTypeMapping,
  RenderContext,
  ConvenienceRenderer,
  funPrefixNamer,
  splitIntoWords,
  combineWords,
  firstUpperWordStyle,
  allUpperWordStyle,
  Namer,
  Type,
  defined,
  panic,
  Name,
} from "quicktype-core";
import { getNoStringTypeMapping } from "quicktype-core/dist/TypeBuilder";
import { legalizeName } from "quicktype-core/dist/language/JavaScript";
import { matchTypeExhaustive } from "quicktype-core/dist/TypeUtils";
import { addDescriptionToSchema } from "quicktype-core/dist/attributes/Description";
import {
  ArrayType,
  EnumType,
  ObjectType,
  UnionType,
  transformedStringTypeTargetTypeKindsMap,
} from "quicktype-core/dist/Type";

const GRAMMAR_NAME_NEEDLE = "%GRAMMAR_NAME%";
const ROOT_GRAMMAR_NEEDLE = "%ROOT_GRAMMAR%";
const REFS_GRAMMAR_NEEDLE = "%REFS_GRAMMAR%";

const BASE_GRAMMAR = String.raw`
/// <reference types="tree-sitter-cli/dsl.d.ts" />
module.exports = grammar({
  name: ${GRAMMAR_NAME_NEEDLE},
  extras: ($) => [/\s/, $.comment],
  conflicts: ($) => [[$.root, $.any]],
  rules: {
    root: ${ROOT_GRAMMAR_NEEDLE},
    comment: ($) => token(choice(seq("//", /.*/), seq("#", /.*/), seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/"))),
    null: ($) => "null",
    bool: ($) => choice("true", "false"),
    number: ($) => {
      const decimal_digits = /\d+/;
      const hex_literal = seq(choice("0x", "0X"), /[\da-fA-F]+/);
      const signed_integer = seq(optional(choice("-", "+")), decimal_digits);
      const exponent_part = seq(choice("e", "E"), signed_integer);
      const binary_literal = seq(choice("0b", "0B"), /[0-1]+/);
      const octal_literal = seq(choice("0o", "0O"), /[0-7]+/);
      const decimal_integer_literal = seq(
        optional(choice("-", "+")),
        choice("0", seq(/[1-9]/, optional(decimal_digits)))
      );
      const decimal_literal = choice(
        seq(decimal_integer_literal, ".", optional(decimal_digits), optional(exponent_part)),
        seq(".", decimal_digits, optional(exponent_part)),
        seq(decimal_integer_literal, optional(exponent_part))
      );
      return token(choice(hex_literal, decimal_literal, binary_literal, octal_literal));
    },
    integer: ($) => {
      const decimal_digits = /\d+/;
      const hex_literal = seq(choice("0x", "0X"), /[\da-fA-F]+/);
      const binary_literal = seq(choice("0b", "0B"), /[0-1]+/);
      const octal_literal = seq(choice("0o", "0O"), /[0-7]+/);
      const decimal_integer_literal = seq(
        optional(choice("-", "+")),
        choice("0", seq(/[1-9]/, optional(decimal_digits)))
      );
      return token(choice(hex_literal, decimal_integer_literal, binary_literal, octal_literal));
    },
    object: ($) => seq("{", commaSep($.pair), "}"),
    any: ($) => choice($.object, $.array, $.number, $.string, $.bool, $.null),
    pair: ($) =>
      seq(
        field("key", choice($.string, $.number)),
        ":",
        field("value", choice($.object, $.array, $.number, $.string, $.bool, $.null))
      ),
    array: ($) => seq("[", commaSep(choice($.object, $.array, $.number, $.string, $.bool, $.null)), "]"),
    string: ($) => choice(seq('"', '"'), seq('"', $.string_content, '"')),
    string_content: ($) => repeat1(choice(token.immediate(prec(1, /[^\\"\n]+/)), $.escape_sequence)),
    escape_sequence: ($) => token.immediate(seq("\\", /(\"|\\|\/|b|f|n|r|t|u)/)),
    ${REFS_GRAMMAR_NEEDLE}
  },
});
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}
function commaSep(rule) {
  return optional(commaSep1(rule));
}`;

class TreeSitterGrammarTargetLanguage extends TargetLanguage {
  constructor() {
    super("Tree-Sitter Grammar", ["tree-sitter"], "js");
  }

  protected getOptions(): Option<any>[] {
    return [];
  }

  get stringTypeMapping(): StringTypeMapping {
    return getNoStringTypeMapping();
  }

  get supportsOptionalClassProperties(): boolean {
    return true;
  }

  get supportsFullObjectType(): boolean {
    return true;
  }

  protected makeRenderer(
    renderContext: RenderContext,
    _untypedOptionValues: { [name: string]: any }
  ): TreeSitterGrammarRenderer {
    return new TreeSitterGrammarRenderer(this, renderContext);
  }
}

function jsonNameStyle(original: string): string {
  const words = splitIntoWords(original);
  return combineWords(
    words,
    legalizeName,
    firstUpperWordStyle,
    firstUpperWordStyle,
    allUpperWordStyle,
    allUpperWordStyle,
    "",
    (_) => true
  );
}

const EMPTY_GRAMMAR = '$ => ""';
const namingFunction = funPrefixNamer("namer", jsonNameStyle);
type Schema = { [name: string]: any; grammar: string };

class TreeSitterGrammarRenderer extends ConvenienceRenderer {
  protected makeNamedTypeNamer(): Namer {
    return namingFunction;
  }

  protected namerForObjectProperty(): null {
    return null;
  }

  protected makeUnionMemberNamer(): null {
    return null;
  }

  protected makeEnumCaseNamer(): null {
    return null;
  }

  private nameForType(t: Type): string {
    return defined(this.names.get(this.nameForNamedType(t)));
  }

  private makeOneOf(types: ReadonlySet<Type>): Schema {
    const first = iterableFirst(types);
    if (first === undefined) {
      return panic("Must have at least one type for oneOf");
    }
    if (types.size === 1) {
      return this.schemaForType(first);
    }
    // todo: oneOf vs anyOf handling
    const anyOf = Array.from(types).map((t: Type) => this.schemaForType(t));
    return {
      anyOf,
      grammar: anyOf.length === 1 ? `"${anyOf[0]}"` : `choice(${anyOf.map((s) => s.grammar).join(", ")})`,
    };
  }

  private makeRef(t: Type): Schema {
    return { $ref: `#/definitions/${this.nameForType(t)}`, grammar: `$.ref_${this.nameForType(t)}` };
  }

  private addAttributesToSchema(t: Type, schema: Schema): void {
    const attributes = this.typeGraph.attributeStore.attributesForType(t);
    for (const [kind, attr] of attributes) {
      kind.addToSchema(schema, t, attr);
    }
  }

  private schemaForType(t: Type): Schema {
    const schema = matchTypeExhaustive<Schema>(
      t,
      (_noneType) => {
        return panic("none type should have been replaced");
      },
      (_anyType) => ({ grammar: "$.any" }),
      (_nullType) => ({ type: "null", grammar: "$.null" }),
      (_boolType) => ({ type: "boolean", grammar: "$.bool" }),
      (_integerType) => ({ type: "integer", grammar: "$.integer" }),
      (_doubleType) => ({ type: "number", grammar: "$.number" }),
      (_stringType) => ({ type: "string", grammar: "$.string" }),
      (arrayType) => this.definitionForArray(arrayType),
      (classType) => this.makeRef(classType),
      (mapType) => this.definitionForObject(mapType, undefined),
      (objectType) => this.makeRef(objectType),
      (enumType) => this.makeRef(enumType),
      (unionType) => {
        if (this.unionNeedsName(unionType)) {
          return this.makeRef(unionType);
        } else {
          return this.definitionForUnion(unionType);
        }
      },
      (transformedStringType) => {
        const target = transformedStringTypeTargetTypeKindsMap.get(transformedStringType.kind);
        if (target === undefined) {
          return panic(`Unknown transformed string type ${transformedStringType.kind}`);
        }
        // todo: known formats should be added to the base grammar
        return { type: "string", format: target.jsonSchema, grammar: "$.string" };
      }
    );
    if (schema.$ref === undefined) {
      this.addAttributesToSchema(t, schema);
    }
    return schema;
  }

  private definitionForArray(a: ArrayType): Schema {
    const schema = this.schemaForType(a.items);
    return {
      type: "array",
      items: schema,
      grammar: `seq("[", commaSep(${schema.grammar}), "]")`,
    };
  }

  private definitionForObject(o: ObjectType, title: string | undefined): Schema {
    let properties: Schema | undefined;
    let required: string[] | undefined;
    let grammar = EMPTY_GRAMMAR;
    let pairs = new Array<string>();
    if (o.getProperties().size === 0) {
      properties = undefined;
      required = undefined;
    } else {
      const props: Schema = { grammar };
      const req: string[] = [];
      for (const [name, p] of o.getProperties()) {
        const prop = this.schemaForType(p.type);
        if (p.isOptional) {
          pairs.push(`optional(seq('"${name}"', ":", ${prop.grammar}))`);
        } else {
          pairs.push(`'"${name}"', ":", ${prop.grammar}`);
        }
        if (prop.description === undefined) {
          addDescriptionToSchema(prop, this.descriptionForClassProperty(o, name));
        }
        props[name] = prop;
        if (!p.isOptional) {
          req.push(name);
        }
      }
      properties = props;
      required = req.sort();
    }
    const additional = o.getAdditionalProperties();
    const additionalProperties = additional !== undefined ? this.schemaForType(additional) : false;
    if (additionalProperties !== false) {
      pairs.push(`$.string, ":", ${additionalProperties.grammar}`);
    }
    grammar = pairs.length > 0 ? `seq("{", commaSep(choice(${pairs.join(", ")})), "}")` : "$.object";
    const schema = {
      type: "object",
      grammar: required?.length ? grammar : `choice(seq("{", "}"), ${grammar})`,
      additionalProperties,
      properties,
      required,
      title,
    };
    this.addAttributesToSchema(o, schema);
    return schema;
  }

  private definitionForUnion(u: UnionType, title?: string): Schema {
    const oneOf = this.makeOneOf(u.sortedMembers);
    if (title !== undefined) {
      oneOf.title = title;
    }
    this.addAttributesToSchema(u, oneOf);
    return oneOf;
  }

  private definitionForEnum(e: EnumType, title: string): Schema {
    const cases = Array.from(e.cases);
    const schema = {
      type: "string",
      enum: cases,
      title,
      grammar: cases.length === 1 ? `'"${cases[0]}"'` : `choice(${cases.map((c) => `'"${c}"'`).join(", ")})`,
    };
    this.addAttributesToSchema(e, schema);
    return schema;
  }

  protected emitSourceStructure(): void {
    const definitions: { [name: string]: Schema } = {};
    this.forEachObject("none", (o: ObjectType, name: Name) => {
      const title = defined(this.names.get(name));
      definitions[title] = this.definitionForObject(o, title);
    });
    this.forEachUnion("none", (u, name) => {
      if (!this.unionNeedsName(u)) return;
      const title = defined(this.names.get(name));
      definitions[title] = this.definitionForUnion(u, title);
    });
    this.forEachEnum("none", (e, name) => {
      const title = defined(this.names.get(name));
      definitions[title] = this.definitionForEnum(e, title);
    });
    const { grammar } = definitions[ROOT_NAME];
    const refs = Object.entries(definitions)
      .filter(([name]) => name !== ROOT_NAME)
      .map(([name, schema]) => {
        return `ref_${name}: ($) => ${schema.grammar}`;
      })
      .join(",\n    ");
    const g = BASE_GRAMMAR.replace(ROOT_GRAMMAR_NEEDLE, `($) => ${grammar}`).replace(REFS_GRAMMAR_NEEDLE, refs);
    this.emitLine(g);
  }
}

const ROOT_NAME = "Grammar";
const INPUT_FILE = "grammar.ts";
const OUTPUT_SCHEMA = "grammar.json";
const OUTPUT_GRAMMAR = "grammar.js";

// comes from webpack
declare const VERSION: string | undefined;
const getVersion = (): string => {
  if (typeof VERSION === "string") {
    return VERSION;
  } else {
    return "0.0.0";
  }
};

program
  .name("type-sitter")
  .version(getVersion())
  .description("Generate tree-sitter grammars from TypeScript types")
  .option("-i, --input <files>", "Input file(s) or glob pattern", INPUT_FILE)
  .option("-n, --name <name>", "Grammar name")
  .option("-o, --output <file>", "Output file", OUTPUT_GRAMMAR)
  .option("-s, --schema <file>", "Output schema file", OUTPUT_SCHEMA)
  .option("-r, --root <name>", "Root type name", ROOT_NAME)
  .action(async (options) => {
    const inputFilter = options.input || INPUT_FILE;
    const inputExists = existsSync(inputFilter);
    const inputFiles = inputExists ? [inputFilter] : await glob(inputFilter, { absolute: true });
    await quicktypeBinary({ out: OUTPUT_SCHEMA, src: inputFiles, srcLang: "typescript", lang: "schema" });
    const jsonSchema = JSON.parse(await fs.readFile(OUTPUT_SCHEMA, "utf8"));
    Object.assign(jsonSchema, { $ref: `#/definitions/${ROOT_NAME}` });
    const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());
    await schemaInput.addSource({ name: ROOT_NAME, schema: JSON.stringify(jsonSchema) });
    const inputData = new InputData();
    inputData.addInput(schemaInput);
    const result = await quicktype({ inputData, lang: new TreeSitterGrammarTargetLanguage(), indentation: "  " });
    const name =
      options.name ||
      (inputExists
        ? basename(inputFiles[0], extname(inputFiles[0]))
        : basename(options.output, extname(options.output))) ||
      basename(OUTPUT_GRAMMAR, extname(OUTPUT_GRAMMAR));
    const output = result.lines.join("\n").replace(GRAMMAR_NAME_NEEDLE, `"${name}"`);
    await fs.writeFile(OUTPUT_GRAMMAR, output);
  })
  .parse();
