export {};
declare global {
  export interface GrammarBuilder {
    readonly name: string;
    readonly root: string;
    readonly refs: string;
    readonly choice: (...g: string[]) => string;
    readonly commaSep: (g: string) => string;
    readonly commaSep1: (g: string) => string;
    readonly optional: (...g: string[]) => string;
    readonly pair: (g1: string, g2: string) => string;
    readonly seq: (...g: string[]) => string;
    readonly str: (s: string) => string;
    readonly ref: (n: string) => string;
  }
}
