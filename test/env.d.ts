/*
 * The one piece of Node a test uses, for reading a stylesheet's text: Vitest hands a test an empty
 * string for any CSS it imports, `?raw` included. Declared here rather than installing Node's types,
 * which would let a test reach the rest of Node without anyone deciding it should.
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string
}
