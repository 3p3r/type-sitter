/// <reference lib="esnext" />
/// <reference types="../types" />

export type Grammar = any;

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
