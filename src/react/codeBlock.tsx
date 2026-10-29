import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { formatShortcut } from '../core/shortcuts.js'
import { Button } from './controls.js'

/*
 * CODE PEOPLE COPY: a snippet to paste into a program, a command to run, a file to save.
 *
 * It is read exactly, so it keeps its own lines — a long one scrolls sideways rather than wrapping,
 * because a wrapped command reads as two — and the block is a named region that takes focus, so it
 * scrolls from the keyboard. Copy sits in the corner beside the code, never over it, and is always
 * shown: a button that appears on hover is one a keyboard and a touch screen never find.
 *
 * HIGHLIGHTING IS SMALL ON PURPOSE. Comments, strings, keywords, numbers and the keys of YAML and
 * JSON, from a scanner a few rules long per language: enough to read a snippet by, and no
 * dependency. It is a reading aid, not a parser — a regular expression literal or a heredoc is read
 * as code, and a block comment left open colours its own line rather than the rest of the file — and
 * a host with a real highlighter passes `highlight` instead.
 *
 * NOTHING IS PARSED AS HTML. The scanner cuts the code into strings and React renders them, so a
 * `<script>` in a snippet is text in the block, whatever the language or the highlighter.
 */

export type CodeLanguage = 'python' | 'typescript' | 'javascript' | 'kotlin' | 'yaml' | 'shell' | 'json' | 'text'

export interface CodeBlockProps {
  /** The code, exactly as it is copied. One trailing newline is not drawn as an empty line. */
  readonly code: string
  /** How it is highlighted, and the region's name when there is no `label`. Default `text`: none. */
  readonly language?: CodeLanguage
  /** What it is, shown above the code and naming the region: "Install", "config.yaml". */
  readonly label?: string
  /** A Copy button in the corner. Default true. */
  readonly copy?: boolean
  /** A highlighter of the host's own, e.g. CodeMirror's `runMode`, used instead of the built-in one. */
  readonly highlight?: (code: string, language: CodeLanguage) => ReactNode
  readonly className?: string
}

type Kind = 'comment' | 'string' | 'keyword' | 'number' | 'key'
interface Token { readonly kind?: Kind | undefined; readonly text: string }

/* A quote: how it opens, whether it may run over lines, and how it says its own quote inside. */
interface Quote { readonly open: string; readonly lines?: boolean; readonly escape?: 'backslash' | 'double' }

interface Grammar {
  readonly line?: string
  /** `#` starts a comment only at the start of a word, so `$#` and `a#b` are not one (shell, YAML). */
  readonly wordComment?: boolean
  /** A quote opens only where a value can start, so an apostrophe inside a word or a sentence is text. */
  readonly quoteAt?: (code: string, at: number) => boolean
  readonly block?: readonly [string, string]
  readonly quotes: readonly Quote[]
  readonly keywords: ReadonlySet<string>
  readonly keys?: 'yaml' | 'json'
}

const words = (list: string) => new Set(list.split(' '))
const C_COMMENTS = { line: '//', block: ['/*', '*/'] } as const
const B: Quote['escape'] = 'backslash'
const JS = 'async await break case catch class const continue debugger default delete do else export extends false ' +
  'finally for function if import in instanceof let new null of return static super switch this throw true try ' +
  'typeof undefined var void while with yield'

const GRAMMARS: Partial<Record<CodeLanguage, Grammar>> = {
  python: {
    line: '#',
    quotes: [{ open: '"""', lines: true, escape: B }, { open: "'''", lines: true, escape: B }, { open: '"', escape: B }, { open: "'", escape: B }],
    keywords: words('False None True and as assert async await break class continue def del elif else except ' +
      'finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'),
  },
  javascript: {
    ...C_COMMENTS,
    quotes: [{ open: '`', lines: true, escape: B }, { open: '"', escape: B }, { open: "'", escape: B }],
    keywords: words(JS),
  },
  typescript: {
    ...C_COMMENTS,
    quotes: [{ open: '`', lines: true, escape: B }, { open: '"', escape: B }, { open: "'", escape: B }],
    keywords: words(`${JS} abstract as declare enum implements interface keyof namespace private protected public readonly satisfies`),
  },
  kotlin: {
    ...C_COMMENTS,
    quotes: [{ open: '"""', lines: true }, { open: '"', escape: B }, { open: "'", escape: B }],
    keywords: words('abstract as break by class companion const constructor continue data do else enum false for fun ' +
      'if import in init interface internal is lateinit null object open override package private protected public ' +
      'return sealed super suspend this throw true try typealias val var when while'),
  },
  shell: {
    line: '#',
    wordComment: true,
    quotes: [{ open: '"', lines: true, escape: B }, { open: "'", lines: true }],
    // `Don't panic` in a heredoc or an unquoted echo is not the start of a string.
    quoteAt: (code, at) => !/[\w]/.test(code[at - 1] ?? ''),
    keywords: words('case do done elif else esac export fi for function if in local readonly return select then until while'),
  },
  yaml: {
    line: '#',
    wordComment: true,
    quotes: [{ open: '"', lines: true, escape: B }, { open: "'", lines: true, escape: 'double' }],
    keywords: words('true false null'),
    quoteAt: (code, at) => yamlValueStarts(code, at),
    keys: 'yaml',
  },
  json: {
    quotes: [{ open: '"', escape: B }],
    keywords: words('true false null'),
    keys: 'json',
  },
}

const NUMBER = /0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?[fFLn]?/y
const WORD = /[A-Za-z_$][\w$]*/y
const JSON_COLON = /[ \t]*:/y
/* Indentation and list dashes, a key — plain or quoted — and its colon, which ends at a space or the line. */
const YAML_KEY = /([ \t]*(?:-[ \t]+)*)([^\s#'"{}[\],:-](?:[^:\n#]*[^\s:#])?|"(?:[^"\\\n]|\\.)*"|'(?:[^'\n]|'')*')([ \t]*:)(?=[ \t]|$)/my
/* What a number or keyword cannot touch, so `v1`, `1.2.3`, `obj.if` and `--if-exists` stay text. */
const JOINED = /[\w$.-]/

function sticky(pattern: RegExp, code: string, at: number): RegExpExecArray | null {
  pattern.lastIndex = at
  return pattern.exec(code)
}

/** Where a quote that opens at `at` closes: past its closing quote, or at the line or text's end. */
function closeOf(code: string, at: number, quote: Quote): number {
  let i = at + quote.open.length
  while (i < code.length) {
    if (quote.escape === 'backslash' && code[i] === '\\') i += 2
    else if (code.startsWith(quote.open, i)) {
      if (quote.escape === 'double' && code[i + 1] === quote.open) i += 2
      else {
        // A raw string may end in its own quote: `"""a""""` closes at the last of the run.
        let end = i + quote.open.length
        while (quote.open.length === 3 && code[end] === quote.open[0]) end++
        return end
      }
    } else if (code[i] === '\n' && !quote.lines) return i
    else i++
  }
  return code.length
}

/* YAML opens a quote only where a value starts: `title: Don't stop` is a plain sentence. */
function yamlValueStarts(code: string, at: number): boolean {
  let i = at - 1
  while (code[i] === ' ' || code[i] === '\t') i--
  return i < 0 || ':-[{,\n'.includes(code[i] ?? '')
}

function tokenize(code: string, grammar: Grammar): Token[] {
  const out: Token[] = []
  const push = (text = '', kind?: Kind) => {
    if (!text) return
    const last = out[out.length - 1]
    if (!kind && last && !last.kind) out[out.length - 1] = { text: last.text + text }
    else out.push({ kind, text })
  }
  let i = 0
  while (i < code.length) {
    const before = code[i - 1]
    const lineStart = i === 0 || before === '\n'
    if (lineStart && grammar.keys === 'yaml') {
      const key = sticky(YAML_KEY, code, i)
      if (key) {
        push(key[1])
        push(key[2], 'key')
        push(key[3])
        i += key[0].length
        continue
      }
    }
    if (grammar.block && code.startsWith(grammar.block[0], i)) {
      const end = code.indexOf(grammar.block[1], i + 2)
      // Never closed: most likely a `/*` inside a regular expression, so it colours one line, not the file.
      const open = code.indexOf('\n', i)
      const stop = end >= 0 ? end + grammar.block[1].length : open < 0 ? code.length : open
      push(code.slice(i, stop), 'comment')
      i = stop
      continue
    }
    if (grammar.line && code.startsWith(grammar.line, i) && (!grammar.wordComment || lineStart || /\s/.test(before ?? ''))) {
      const end = code.indexOf('\n', i)
      const stop = end < 0 ? code.length : end
      push(code.slice(i, stop), 'comment')
      i = stop
      continue
    }
    const quote = grammar.quotes.find(q => code.startsWith(q.open, i))
    if (quote && (!grammar.quoteAt || grammar.quoteAt(code, i))) {
      const stop = closeOf(code, i, quote)
      const isKey = grammar.keys === 'json' && sticky(JSON_COLON, code, stop) !== null
      push(code.slice(i, stop), isKey ? 'key' : 'string')
      i = stop
      continue
    }
    const loose = before === undefined || !JOINED.test(before)
    // A minus is a sign where nothing it could join sits before it: `-1`, but not the 10 of `2026-10`.
    const signed = before === '-' && !JOINED.test(code[i - 2] ?? ' ')
    const number = loose || signed ? sticky(NUMBER, code, i) : null
    if (number && !JOINED.test(code[i + number[0].length] ?? '')) {
      push(number[0], 'number')
      i += number[0].length
      continue
    }
    const word = sticky(WORD, code, i)
    if (word) {
      const keyword = loose && grammar.keywords.has(word[0]) && code[i + word[0].length] !== '-'
      push(word[0], keyword ? 'keyword' : undefined)
      i += word[0].length
      continue
    }
    push(code[i])
    i++
  }
  return out
}

function highlighted(code: string, language: CodeLanguage): ReactNode {
  const grammar = GRAMMARS[language]
  if (!grammar) return code
  return tokenize(code, grammar).map((token, n) =>
    token.kind ? <span key={n} className={`desk-code-${token.kind}`}>{token.text}</span> : token.text,
  )
}

const NAMES: Record<CodeLanguage, string> = {
  python: 'Python', typescript: 'TypeScript', javascript: 'JavaScript', kotlin: 'Kotlin', yaml: 'YAML',
  shell: 'Shell', json: 'JSON', text: '',
}

/** How long "Copied" stays before the button says Copy again. */
const COPIED_MS = 2000

type Copying = 'idle' | 'copied' | 'select'

/** A framed block of code to copy, highlighted for its language, with a Copy button in its corner. */
export function CodeBlock({ code, language = 'text', label, copy = true, highlight, className }: CodeBlockProps) {
  const body = useRef<HTMLElement>(null)
  const [copying, setCopying] = useState<Copying>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const alive = useRef(true)
  const copied = useRef(code)
  const shown = code.endsWith('\n') ? code.slice(0, -1) : code
  const content = useMemo(() => (highlight ?? highlighted)(shown, language), [shown, language, highlight])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      clearTimeout(timer.current)
    }
  }, [])
  // Copied or selected says something about this code; new code has been neither. Put back while
  // rendering, so not one frame says Copied over code nobody copied.
  if (copied.current !== code) {
    copied.current = code
    clearTimeout(timer.current)
    if (copying !== 'idle') setCopying('idle')
  }

  const settle = (next: Copying) => {
    // A copy that finishes after the block has gone has nothing left to say it in.
    if (!alive.current) return
    clearTimeout(timer.current)
    setCopying(next)
    if (next === 'copied') timer.current = setTimeout(() => setCopying('idle'), COPIED_MS)
  }

  /*
   * THE CLIPBOARD IS NOT ALWAYS THERE: a page over plain http has none, and a browser may refuse
   * it. Then the code is selected and the older copy command tried; where that fails too, the
   * selection stays and the button says which keys copy it, so the person is one keystroke away.
   * The selection is the code as drawn: without the trailing newline, and with whatever a host's
   * `highlight` adds to it.
   */
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      settle('copied')
    } catch {
      const selection = window.getSelection()
      if (body.current && selection) selection.selectAllChildren(body.current)
      let copied = false
      try {
        copied = document.execCommand('copy')
      } catch {
        // Unsupported: the selection is the way.
      }
      settle(copied ? 'copied' : 'select')
    }
  }

  const keys = formatShortcut('mod+c')
  const name = label ?? (NAMES[language] ? `${NAMES[language]} code` : 'Code')
  return (
    <div className={['desk-code', className].filter(Boolean).join(' ')} data-language={language}>
      <div className="desk-code-main">
        {label && <div className="desk-code-label" aria-hidden="true">{label}</div>}
        <pre className="desk-code-body" role="region" aria-label={name} tabIndex={0}>
          <code ref={body}>{content}</code>
        </pre>
      </div>
      {copy && (
        <div className="desk-code-actions">
          <Button intent="quiet" size="small" onClick={onCopy}>
            {copying === 'copied' ? 'Copied' : copying === 'select' ? `Press ${keys}` : 'Copy'}
          </Button>
          <span className="desk-code-status" role="status">
            {copying === 'copied' ? 'Copied' : copying === 'select' ? `Selected. Press ${keys} to copy.` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
