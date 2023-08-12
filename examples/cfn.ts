/// <reference lib="esnext" />
/// <reference types="../types" />

export interface Grammar {
  readonly AWSTemplateFormatVersion?: "2010-09-09";
  readonly Description?: string;
  readonly Metadata?: object;
  readonly Parameters?: { [key: string]: Parameter };
  readonly Resources: { [key: string]: Resource };
  readonly Mappings?: { [key: string]: Mapping };
  readonly Conditions?: { [key: string]: object };
  readonly Transform?: Transform;
  readonly Outputs?: { [key: string]: Output };
  readonly Hooks?: { [key: string]: object };
  readonly Rules?: { [key: string]: object };
}

interface Output {
  readonly Description?: string;
  readonly Value: Expression;
  readonly Export?: {
    Name: Expression;
  };
}

interface Mapping {
  readonly [key: string]: {
    readonly [key: string]: any;
  };
}

type Transform =
  | {
      Name?: "AWS::Include";
      Parameters?: {
        Location?: string;
      };
    }
  | ("AWS::CodeDeployBlueGreen" | "AWS::CodeStar" | "AWS::SecretsManager-2020-07-23" | "AWS::Serverless-2016-10-31");

type Expression = Condition | Intrinsic;
type Condition = FnEquals | FnAnd | FnOr | FnNot | FnIf;
type Intrinsic =
  | FnRef
  | FnBase64
  | FnCidr
  | FnFindInMap
  | FnGetAtt
  | FnGetAZs
  | FnImportValue
  | FnJoin
  | FnSelect
  | FnSplit
  | FnSubShort
  | FnSubLong
  | FnTransform
  | FnLength
  | FnToJsonString;
type FnRef = FnRefShort | FnRefLong;
type FnRefInput = string | FnBase64 | FnFindInMap | FnIf | FnJoin | FnSub | FnToJsonString | FnRef;
interface FnRefShort {
  Ref: FnRefInput;
}
interface FnRefLong {
  "Fn::Ref": FnRefInput;
}
type FnBase64Input = string | Expression;
interface FnBase64 {
  "Fn::Base64": FnBase64Input;
}
type FnCidrInput = string | FnSelect | FnRef;
interface FnCidr {
  "Fn::Cidr": [FnCidrInput, number | FnCidrInput, number | FnCidrInput];
}
type FnFindInMapInput = string | FnSelect | FnRef;
interface FnFindInMap {
  "Fn::FindInMap": [FnFindInMapInput, FnFindInMapInput, FnFindInMapInput];
}
type FnGetAttInput = string | FnBase64 | FnFindInMap | FnIf | FnJoin | FnSub | FnToJsonString | FnRef;
interface FnGetAtt {
  "Fn::GetAtt": [FnGetAttInput, FnGetAttInput];
}
type FnGetAZsInput = string | FnRef;
interface FnGetAZs {
  "Fn::GetAZs": FnGetAZsInput;
}
type FnImportValueInput = string | FnBase64 | FnFindInMap | FnIf | FnJoin | FnSelect | FnSplit | FnSub | FnRef;
interface FnImportValue {
  "Fn::ImportValue": FnImportValueInput;
}
type FnJoinInput =
  | string
  | FnBase64
  | FnFindInMap
  | FnGetAtt
  | FnGetAZs
  | FnIf
  | FnImportValue
  | FnJoin
  | FnSplit
  | FnSelect
  | FnSub
  | FnTransform
  | FnRef;
interface FnJoin {
  "Fn::Join": [string, FnJoinInput[]];
}
type FnLengthInput =
  | any[]
  | Condition
  | FnBase64
  | FnFindInMap
  | FnJoin
  | FnLength
  | FnSelect
  | FnSplit
  | FnSub
  | FnToJsonString
  | FnRef;
interface FnLength {
  "Fn::Length": FnLengthInput;
}
type FnSelectInput = FnFindInMap | FnGetAtt | FnGetAZs | FnIf | FnSplit | FnRef;
interface FnSelect {
  "Fn::Select": [number | string | FnRef | FnFindInMap, FnSelectInput[]];
}
type FnSplitInput =
  | string
  | FnBase64
  | FnFindInMap
  | FnGetAtt
  | FnGetAZs
  | FnIf
  | FnImportValue
  | FnJoin
  | FnSelect
  | FnSub
  | FnRef;
interface FnSplit {
  "Fn::Split": [string, FnSplitInput];
}
type FnSub = FnSubShort | FnSubLong;
interface FnSubShort {
  "Fn::Sub": string;
}
type FnSubLongInput = FnBase64 | FnFindInMap | FnGetAtt | FnGetAZs | FnIf | FnImportValue | FnJoin | FnSelect | FnRef;
interface FnSubLong {
  "Fn::Sub": [string, { [key: string]: FnSubLongInput }];
}
type FnToJsonStringInput =
  | any
  | FnBase64
  | FnFindInMap
  | FnGetAtt
  | FnGetAZs
  | FnIf
  | FnImportValue
  | FnJoin
  | FnLength
  | FnSelect
  | FnSplit
  | FnSub
  | FnToJsonString
  | FnRef;
interface FnToJsonString {
  "Fn::ToJsonString": FnToJsonStringInput;
}
interface FnTransform {
  "Fn::Transform": {
    Name: string;
    Parameters: { [key: string]: any };
  };
}
interface FnCondition {
  Condition: string;
}
type FnAndInput = FnCondition | Condition;
interface FnAnd {
  "Fn::And": FnAndInput[];
}
interface FnEquals {
  "Fn::Equals": [any, any];
}
type FnOrInput = FnCondition | Condition;
interface FnOr {
  "Fn::Or": FnOrInput[];
}
type FnNotInput = FnCondition | Condition;
interface FnNot {
  "Fn::Not": FnNotInput;
}
interface FnIf {
  "Fn::If": [string, any, any];
}

interface Resource {
  readonly Type: string;
  readonly Properties?: object;
  readonly DeletionPolicy?: "Delete" | "Retain" | "Snapshot";
  readonly UpdateReplacePolicy?: "Delete" | "Retain" | "Snapshot";
  readonly DependsOn?: string | string[];
  readonly CreationPolicy?: object;
  readonly Metadata?: object;
  readonly Condition?: string;
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
