# type-sitter

Generates Tree-Sitter Grammars From TypeScript Definitions.
Inspired By [Rust-Sitter](https://github.com/hydro-project/rust-sitter).

## usage

1. Write a base grammar that supports TypeScript primitives:
   `any`, `array`, `null`, `number`, `object`, `pair`, `root`, `string`, `bool`.


   ```ts
   // use API of GrammarBuilder to define a base grammar with placeholders.
   // placeholders in the returned base grammar is resolved by type-sitter.
   export const baseGrammar: ($$: GrammarBuilder) => string;
   ```
1. Express your DSL that goes on top of your base grammar with TypeScript types.
   ```ts
   export interface Grammar {
     // ... grammar definition using TypeScript typings
   }
   ```
1. Use [`type-sitter`](#type-sitter) to generate a Tree-Sitter grammar.
   ```sh
   # outputs grammar.js and grammar.json
   type-sitter -i grammar.ts
   ```
1. Use `tree-sitter` to generate a parser for the DSL (see [caveats](#caveats)).
   ```sh
   # outputs the actual parser
   tree-sitter generate
   ```

See `type-sitter --help` for more information.  
See [examples](./examples) directory for sample DSLs.

## caveats

- Not all TypeScript features are supported. See [quicktype][1] for details.
- Duplicated pairs with the same keys but different values do not error out.
- Generated parsers do not replace a data validation layer. Those are mutex.
- This project currently focuses on declarative DSLs vs imperative grammars.

[1]: https://github.com/quicktype/quicktype/#generating-code-from-typescript-experimental
