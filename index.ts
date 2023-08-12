/// <reference types="./types" />

import { program } from "commander";
import { basename, extname } from "path";
import { existsSync, promises as fs } from "fs";
import { main as quicktypeBinary } from "quicktype";
import {
  quicktype as quicktypeLibrary,
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
import { create } from "ts-node";
import assert from "assert";

const GRAMMAR_NAME_NEEDLE = "%GRAMMAR_NAME%";
const ROOT_GRAMMAR_NEEDLE = "%ROOT_GRAMMAR%";
const REFS_GRAMMAR_NEEDLE = "%REFS_GRAMMAR%";

const $$: GrammarBuilder = {
  name: GRAMMAR_NAME_NEEDLE,
  root: ROOT_GRAMMAR_NEEDLE,
  refs: REFS_GRAMMAR_NEEDLE,
  choice: (...g: string[]) => `choice(${g.join(", ")})`,
  commaSep: (g: string) => `optional(seq(${g}, repeat(seq(",", ${g}))))`,
  commaSep1: (g: string) => `seq(${g}, repeat(seq(",", ${g})))`,
  optional: (...g: string[]) => `optional(${g.join(", ")})`,
  pair: (g1: string, g2: string) => `seq(${g1}, ":", ${g2})`,
  seq: (...g: string[]) => `seq(${g.join(", ")})`,
  str: (s: string) => `\`${s}\``,
  ref: (n: string) => `_ref${jsonNameStyle(n)}`,
};

class TreeSitterGrammarTargetLanguage extends TargetLanguage {
  constructor(private readonly _baseGrammar: string) {
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
    return new TreeSitterGrammarRenderer(this, renderContext, this._baseGrammar);
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

const namingFunction = funPrefixNamer("namer", jsonNameStyle);
type Schema = { [name: string]: any; grammar: string };

class TreeSitterGrammarRenderer extends ConvenienceRenderer {
  constructor(targetLanguage: TargetLanguage, renderContext: RenderContext, private readonly _baseGrammar: string) {
    super(targetLanguage, renderContext);
  }
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

  private makeUnionOf(types: ReadonlySet<Type>): Schema {
    const first = [...types][0];
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
      grammar: anyOf.length === 1 ? anyOf[0].grammar : $$.choice(...anyOf.map((s) => s.grammar)),
    };
  }

  private makeRef(t: Type): Schema {
    return { $ref: `#/definitions/${this.nameForType(t)}`, grammar: `$.${$$.ref(this.nameForType(t))}` };
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
      (_integerType) => ({ type: "integer", grammar: "$.number" }),
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
      grammar: $$.seq($$.str("["), $$.commaSep(schema.grammar), $$.str("]")),
    };
  }

  private definitionForObject(o: ObjectType, title: string | undefined): Schema {
    let properties: Schema | undefined;
    let required: string[] | undefined;
    let pairs = new Array<string>();
    if (o.getProperties().size === 0) {
      properties = undefined;
      required = undefined;
    } else {
      const props: Schema = { grammar: "" };
      const req: string[] = [];
      for (const [name, p] of o.getProperties()) {
        const prop = this.schemaForType(p.type);
        const _pair = $$.pair($$.str(`"${name}"`), prop.grammar);
        if (p.isOptional) {
          pairs.push($$.optional(_pair));
        } else {
          pairs.push(_pair);
          req.push(name);
        }
        if (prop.description === undefined) {
          addDescriptionToSchema(prop, this.descriptionForClassProperty(o, name));
        }
        props[name] = prop;
      }
      properties = props;
      required = req.sort();
    }
    const additional = o.getAdditionalProperties();
    const additionalProperties = additional !== undefined ? this.schemaForType(additional) : false;
    if (additionalProperties !== false) {
      pairs.push($$.pair("$.string", additionalProperties.grammar));
    }
    const grammar =
      pairs.length === 1
        ? $$.seq($$.str("{"), $$.commaSep1($$.seq(pairs[0])), $$.str("}"))
        : pairs.length > 0
        ? $$.seq($$.str("{"), $$.commaSep($$.choice(...pairs)), $$.str("}"))
        : "$.object";
    const schema = {
      type: "object",
      grammar: required?.length ? grammar : $$.choice($$.seq($$.str("{"), $$.str("}")), grammar),
      additionalProperties,
      properties,
      required,
      title,
    };
    this.addAttributesToSchema(o, schema);
    return schema;
  }

  private definitionForUnion(u: UnionType, title?: string): Schema {
    const union = this.makeUnionOf(u.sortedMembers);
    if (title !== undefined) {
      union.title = title;
    }
    this.addAttributesToSchema(u, union);
    return union;
  }

  private definitionForEnum(e: EnumType, title: string): Schema {
    const cases = Array.from(e.cases);
    const schema = {
      type: "string",
      enum: cases,
      title,
      grammar: cases.length === 1 ? $$.str(`"${cases[0]}"`) : $$.choice(...cases.map((c) => $$.str(`"${c}"`))),
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
    const { grammar } = definitions[ROOT_NAME] || { grammar: "$.any" };
    const refs = Object.entries(definitions)
      .filter(([name]) => name !== ROOT_NAME)
      .map(([name, schema]) => {
        return `${$$.ref(name)}: ($) => ${schema.grammar}`;
      })
      .join(",\n    ");
    const g = this._baseGrammar.replace(ROOT_GRAMMAR_NEEDLE, `($) => ${grammar}`).replace(REFS_GRAMMAR_NEEDLE, refs);
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
  .option("-i, --input <file>", "TypeSitter grammar input", INPUT_FILE)
  .option("-o, --output <file>", "CST grammar output", OUTPUT_GRAMMAR)
  .option("-s, --schema <file>", "CST schema output", OUTPUT_SCHEMA)
  .option("-r, --root <name>", "Root type name", ROOT_NAME)
  .action(async (options) => {
    const inputFile = (options.input as string) || INPUT_FILE;
    assert(existsSync(inputFile), `Input file '${inputFile}' does not exist`);
    const inputContent = await fs.readFile(inputFile, "utf8");
    const transpiler = create({ transpileOnly: true, compilerOptions: { skipLibCheck: true } });
    const baseGrammar = eval(transpiler.compile(inputContent, inputFile))($$);
    const inputFiles = [inputFile];
    const outputSchema = (options.schema as string) || OUTPUT_SCHEMA;
    await quicktypeBinary({ out: outputSchema, src: inputFiles, srcLang: "typescript", lang: "schema" });
    const jsonSchema = JSON.parse(await fs.readFile(outputSchema, "utf8"));
    const rootName = (options.root as string) || ROOT_NAME;
    Object.assign(jsonSchema, { $ref: `#/definitions/${rootName}` });
    const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());
    await schemaInput.addSource({ name: rootName, schema: JSON.stringify(jsonSchema) });
    const inputData = new InputData();
    inputData.addInput(schemaInput);
    const result = await quicktypeLibrary({
      lang: new TreeSitterGrammarTargetLanguage(baseGrammar),
      indentation: "  ",
      inputData,
    });
    const name =
      options.name ||
      basename(inputFiles[0], extname(inputFiles[0])) ||
      basename(OUTPUT_GRAMMAR, extname(OUTPUT_GRAMMAR));
    const output = result.lines.join("\n").replace(GRAMMAR_NAME_NEEDLE, `"${name}"`);
    const outputFile = (options.output as string) || OUTPUT_GRAMMAR;
    await fs.writeFile(outputFile, output, "utf8");
    await fs.writeFile(outputSchema, JSON.stringify(jsonSchema, null, 2), "utf8");
  })
  .parse();
