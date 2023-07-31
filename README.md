# type-sitter

Generates Tree-Sitter Grammars From TypeScript Definitions.
Inspired By [rust-sitter](https://github.com/hydro-project/rust-sitter).

## usage

1. Write your DSL in TypeScript.
1. Use `type-sitter` to generate a Tree Sitter grammar.
1. Use `tree-sitter` to generate a parser for the DSL (see [caveats](#caveats)).

```sh
$ npm i -g type-sitter
$ cat grammar.ts
# export interface Grammar {
#   readonly Type: "grammar";
#   readonly Data: A | B;
# }
# enum EA {
#   test = "test",
#   test2 = "test2",
# }
# interface A {
#   readonly Type1: EA;
# }
# enum EB {
#   test3 = "test3",
#   test4 = "test4",
# }
# interface B {
#   readonly Type2: EB;
# }
$ type-sitter grammar.ts
# JSON Schema representation of the TypeScript definitions
$ cat grammar.json
# ...
# JavaScript source of the grammar (usable with "tree-sitter generate" cli command)
$ cat grammar.js
# /// <reference types="tree-sitter-cli/dsl.d.ts" />
# module.exports = grammar({
#   ...
#   rules: {
#     root: ($) => seq("{", commaSep(choice('"Data"', ":", $.ref_Data, '"Type"', ":", $.ref_Type)), "}"),
#     ...
#     ref_Data: ($) =>
#       choice(
#         seq("{", "}"),
#         seq(
#           "{",
#           commaSep(choice(optional(seq('"Type1"', ":", $.ref_Ea)), optional(seq('"Type2"', ":", $.ref_Eb)))),
#           "}"
#         )
#       ),
#     ref_Ea: ($) => choice('"test"', '"test2"'),
#     ref_Eb: ($) => choice('"test3"', '"test4"'),
#     ref_Type: ($) => '"grammar"',
#   },
# });
# ...
```

## caveats

- Not all TypeScript features are supported. See [quicktype][1] for details.
- Project currently focuses on DSLs that can be represented as JSON Schemas.
- Duplicated pairs with the same keys but different values do not error out.
- Generated parsers do not replace a json validation layer. Those are mutex.

[1]: https://github.com/quicktype/quicktype/#generating-code-from-typescript-experimental
