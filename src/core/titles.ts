/*
 * App and window names are names, so they are written in title case: Ride Card,
 * Parts & Wear, What Next. It is not applied for you, because a window showing one
 * document takes that document's own name, as written. Use `titleCase` where a name
 * is defined, and `isTitleCase` in a test over the names an app defines.
 */

/** Short words that stay lower case inside a title: articles, conjunctions, short prepositions. */
const MINOR = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'per', 'so', 'the', 'to', 'up', 'via', 'vs', 'yet'])

// A word someone has already cased on purpose — iPhone, API, macOS — is left alone.
const deliberate = (word: string) => /[A-Z]/.test(word.slice(1))

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

export function titleCase(text: string): string {
  const words = text.trim().split(/\s+/)
  return words
    .map((word, i) => {
      if (deliberate(word)) return word
      const edge = i === 0 || i === words.length - 1
      if (!edge && MINOR.has(word.toLowerCase())) return word.toLowerCase()
      return word.split('-').map(capital).join('-')
    })
    .join(' ')
}

export const isTitleCase = (text: string): boolean => titleCase(text) === text.trim()
