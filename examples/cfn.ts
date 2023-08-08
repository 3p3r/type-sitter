/// <reference lib="esnext" />
/// <reference types="../types" />

export interface Grammar {
  readonly AWSTemplateFormatVersion?: "2010-09-09";
  readonly Description?: string;
  readonly Metadata?: object;
  readonly Parameters?: { [key: string]: Parameter };
  readonly Resources: { [key: string]: Resource };
  readonly Mappings?: { [key: string]: Mapping };
}

interface Mapping {
  [k: string]: boolean | number | string;
}

interface Resource {
  readonly Type: string;
  readonly Properties?: object;
  readonly DeletionPolicy?: "Delete" | "Retain" | "Snapshot";
  readonly UpdateReplacePolicy?: "Delete" | "Retain" | "Snapshot";
  readonly DependsOn?: string[];
  readonly CreationPolicy?: object;
  readonly Metadata?: object;
}

interface CommonParams {
  readonly Description?: string;
  readonly NoEcho?: boolean;
  readonly ConstraintDescription?: string;
}

interface StringParamCommon extends CommonParams {
  readonly Default?: string;
  readonly AllowedValues?: string[];
}

interface StringParam extends StringParamCommon {
  readonly Type: "String";
  readonly MaxLength?: number;
  readonly MinLength?: number;
  readonly AllowedPattern?: string;
}

interface StringLikeParam extends StringParamCommon {
  readonly Type:
    | "AWS::EC2::AvailabilityZone::Name"
    | "AWS::EC2::Image::Id"
    | "AWS::EC2::Instance::Id"
    | "AWS::EC2::SecurityGroup::GroupName"
    | "AWS::EC2::SecurityGroup::Id"
    | "AWS::EC2::Subnet::Id"
    | "AWS::EC2::Volume::Id"
    | "AWS::EC2::VPC::Id"
    | "AWS::Route53::HostedZone::Id"
    | "AWS::EC2::KeyPair::KeyName"
    | "AWS::SSM::Parameter::Value<AWS::EC2::AvailabilityZone::Name>"
    | "AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>"
    | "AWS::SSM::Parameter::Value<AWS::EC2::Instance::Id>"
    | "AWS::SSM::Parameter::Value<AWS::EC2::SecurityGroup::GroupName>"
    | "AWS::SSM::Parameter::Value<AWS::EC2::SecurityGroup::Id>"
    | "AWS::SSM::Parameter::Value<AWS::EC2::Subnet::Id>"
    | "AWS::SSM::Parameter::Value<AWS::EC2::Volume::Id>"
    | "AWS::SSM::Parameter::Value<AWS::EC2::VPC::Id>"
    | "AWS::SSM::Parameter::Value<AWS::Route53::HostedZone::Id>"
    | "AWS::SSM::Parameter::Value<AWS::EC2::KeyPair::KeyName>";
}

interface NumberParam extends CommonParams {
  readonly Type: "Number";
  readonly Default?: number;
  readonly AllowedValues?: number[];
}

interface CommaDelimitedList extends CommonParams {
  readonly Type: "CommaDelimitedList" | "AWS::SSM::Parameter::Value<CommaDelimitedList>";
  readonly Default?: string;
}

interface StringLikeList extends CommonParams {
  readonly Type:
    | "List<AWS::EC2::AvailabilityZone::Name>"
    | "List<AWS::EC2::Image::Id>"
    | "List<AWS::EC2::Instance::Id>"
    | "List<AWS::EC2::SecurityGroup::GroupName>"
    | "List<AWS::EC2::SecurityGroup::Id>"
    | "List<AWS::EC2::Subnet::Id>"
    | "List<AWS::EC2::Volume::Id>"
    | "List<AWS::EC2::VPC::Id>"
    | "List<AWS::Route53::HostedZone::Id>"
    | "AWS::SSM::Parameter::Value<List<String>>"
    | "AWS::SSM::Parameter::Value<List<AWS::EC2::AvailabilityZone::Name>>"
    | "AWS::SSM::Parameter::Value<List<AWS::EC2::Image::Id>>"
    | "AWS::SSM::Parameter::Value<List<AWS::EC2::Instance::Id>>"
    | "AWS::SSM::Parameter::Value<List<AWS::EC2::SecurityGroup::GroupName>>"
    | "AWS::SSM::Parameter::Value<List<AWS::EC2::SecurityGroup::Id>>"
    | "AWS::SSM::Parameter::Value<List<AWS::EC2::Subnet::Id>>"
    | "AWS::SSM::Parameter::Value<List<AWS::EC2::Volume::Id>>"
    | "AWS::SSM::Parameter::Value<List<AWS::EC2::VPC::Id>>"
    | "AWS::SSM::Parameter::Value<List<AWS::Route53::HostedZone::Id>>";
}

interface NumberList extends CommonParams {
  readonly Type: "List<Number>" | "AWS::SSM::Parameter::Value<List<Integer>>";
  readonly Default?: number[];
}

type Parameter = StringParam | StringLikeParam | NumberParam | CommaDelimitedList | StringLikeList | NumberList;

export const baseGrammar = ($$: GrammarBuilder) => String.raw`
/// <reference types="tree-sitter-cli/dsl.d.ts" />
module.exports = grammar({
  name: ${$$.name},
  extras: ($) => [/\s/, $.comment],
  rules: {
    root: ${$$.root},
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
    object: ($) => seq("{", ${$$.commaSep("$.pair")}, "}"),
    any: ($) => prec.right(choice($.object, $.array, $.number, $.string, $.bool, $.null)),
    pair: ($) =>
      seq(
        field("key", choice($.string, $.number)),
        ":",
        field("value", $.any),
      ),
    array: ($) => seq("[", ${$$.commaSep("$.any")}, "]"),
    string: ($) => choice(seq('"', '"'), seq('"', $.string_content, '"')),
    string_content: ($) => repeat1(choice(token.immediate(prec(1, /[^\\"\n]+/)), $.escape_sequence)),
    escape_sequence: ($) => token.immediate(seq("\\", /(\"|\\|\/|b|f|n|r|t|u)/)),
    ${$$.refs}
  },
});
`;
