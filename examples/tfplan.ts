/// <reference lib="esnext" />
/// <reference types="../types" />

export interface Grammar {
  readonly format_version?: string;
  readonly terraform_version?: string;
  readonly variables?: { [name: string]: PlanVariable };
  readonly planned_values: StateValues;
  readonly resource_drift?: ResourceChange[];
  readonly resource_changes?: ResourceChange[];
  readonly output_changes?: { [name: string]: Change };
  readonly prior_state?: State;
  readonly configuration?: Config;
  readonly relevant_attributes?: ResourceAttribute[];
  readonly checks?: CheckResultStatic[];
  readonly timestamp?: string;
}

interface ResourceAttribute {
  readonly resource: string;
  readonly attribute: any;
}

interface Expression {
  readonly references?: string[];
  readonly constant_value?: any;
  [key: string]: Expression[] | unknown; // not too sure about this
}
interface Config {
  readonly provider_config?: { [key: string]: ProviderConfig };
  readonly root_module?: ConfigModule;
}
interface ProviderConfig {
  readonly name?: string;
  readonly full_name?: string;
  readonly alias?: string;
  readonly module_address?: string;
  readonly expressions?: { [key: string]: Expression };
  readonly version_constraint?: string;
}
interface ConfigModule {
  readonly outputs?: { [key: string]: ConfigOutput };
  readonly resources?: ConfigResource[];
  readonly module_calls?: { [key: string]: ModuleCall };
  readonly variables?: { [key: string]: ConfigVariable };
}
interface ConfigOutput {
  readonly sensitive?: boolean;
  readonly expression?: Expression;
  readonly description?: string;
  readonly depends_on?: string[];
}
interface ConfigResource {
  readonly address?: string;
  readonly mode?: ResourceMode;
  readonly type?: string;
  readonly name?: string;
  readonly provider_config_key?: string;
  readonly provisioners?: ConfigProvisioner[];
  readonly expressions?: { [key: string]: Expression };
  readonly schema_version: number;
  readonly count_expression?: Expression;
  readonly for_each_expression?: Expression;
  readonly depends_on?: string[];
}
interface ConfigVariable {
  readonly default?: any;
  readonly description?: string;
  readonly sensitive?: boolean;
}
interface ConfigProvisioner {
  readonly type?: string;
  readonly expressions?: { [key: string]: Expression };
}
interface ModuleCall {
  readonly source?: string;
  readonly expressions?: { [key: string]: Expression };
  readonly count_expression?: Expression;
  readonly for_each_expression?: Expression;
  readonly module?: ConfigModule;
  readonly version_constraint?: string;
  readonly depends_on?: string[];
}

interface State {
  readonly format_version?: string;
  readonly terraform_version?: string;
  readonly values?: StateValues;
  readonly checks?: CheckResultStatic[];
}

interface CheckResultStatic {
  readonly address: CheckStaticAddress;
  readonly status: CheckStatus;
  readonly instances?: CheckResultDynamic[];
}

interface CheckResultDynamic {
  readonly address: CheckResultDynamicAddress;
  readonly status: CheckStatus;
  readonly problems?: CheckResultProblem[];
}

interface CheckResultDynamicAddress {
  readonly to_display: string;
  readonly module?: string;
  readonly instance_key?: any;
}

interface CheckResultProblem {
  readonly message: string;
}

enum CheckStatus {
  "pass" = "pass",
  "fail" = "fail",
  "error" = "error",
  "unknown" = "unknown",
}

interface CheckStaticAddress {
  readonly to_display: string;
  readonly kind: CheckKind;
  readonly module?: string;
  readonly mode?: ResourceMode;
  readonly type?: string;
  readonly name?: string;
}

enum CheckKind {
  "resource" = "resource",
  "output-value" = "output-value",
  "check" = "check",
}

interface ResourceChange {
  readonly address?: string;
  readonly module_address?: string;
  readonly mode?: ResourceMode;
  readonly type?: string;
  readonly name?: string;
  readonly index?: number | string;
  readonly provider_name?: string;
  readonly deposed?: string;
  readonly change?: Change;
}

type ResourceMode = string;

interface Change {
  readonly actions?: Action[];
  readonly before?: any;
  readonly after?: any;
  readonly after_unknown?: any;
  readonly before_sensitive?: any;
  readonly after_sensitive?: any;
  readonly importing?: Importing;
  readonly generated_config?: string;
}

enum Action {
  "no-op" = "no-op",
  "create" = "create",
  "read" = "read",
  "update" = "update",
  "delete" = "delete",
}

interface Importing {
  readonly id?: string;
}

interface StateResource {
  readonly address?: string;
  readonly mode?: ResourceMode;
  readonly type?: string;
  readonly name?: string;
  readonly index?: number | string;
  readonly provider_name?: string;
  readonly schema_version?: number;
  readonly values?: { [name: string]: any };
  readonly sensitive_values?: any;
  readonly depends_on?: string[];
  readonly tainted?: boolean;
  readonly deposed_key?: string;
}

interface StateModule {
  readonly resources?: { [name: string]: StateResource };
  readonly child_modules?: { [name: string]: StateModule };
  readonly address?: string;
}

interface Output {
  readonly sensitive: boolean;
  readonly value?: any;
  readonly type?: string;
}

interface StateValues {
  readonly root_module: StateModule;
  readonly outputs?: { [name: string]: Output };
}

interface PlanVariable {
  readonly value: any;
}

export const baseGrammar = ($$: GrammarBuilder) => String.raw`
/// <reference types="tree-sitter-cli/dsl.d.ts" />
module.exports = grammar({
  name: ${$$.name},
  extras: ($) => [/\s/, $.comment],
  supertypes: ($) => [$.any],
  rules: {
    document: ${$$.root},
    ...{${$$.refs}},
    comment: ($) => token(choice(seq("//", /.*/), seq("#", /.*/), seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/"))),
    null: ($) => "null",
    true: ($) => "true",
    false: ($) => "false",
    bool: ($) => choice($.true, $.false),
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
    object: ($) => seq("{", ${$$.commaSep("$._pair")}, "}"),
    any: ($) => prec.right($._any),
    array: ($) => seq("[", ${$$.commaSep("$.any")}, "]"),
    string: ($) => choice(seq('"', '"'), seq('"', $._string_content, '"')),
    _any: ($) => choice($.object, $.array, $.number, $.string, $.bool, $.null),
    _pair: ($) => seq(choice($.string, $.number), ":", $.any),
    _string_content: ($) => repeat1(choice(token.immediate(prec(1, /[^\\"\n]+/)), $._escape_sequence)),
    _escape_sequence: ($) => token.immediate(seq("\\", /(\"|\\|\/|b|f|n|r|t|u)/)),
  },
});
`;
