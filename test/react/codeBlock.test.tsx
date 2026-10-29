// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodeBlock } from '../../src/react/index.js'
import type { CodeLanguage } from '../../src/react/index.js'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, 'execCommand')
})

/** What the block drew as each kind of token, in order. */
function tokens(code: string, language: CodeLanguage) {
  const { container } = render(<CodeBlock code={code} language={language} copy={false} />)
  const of = (kind: string) => [...container.querySelectorAll(`.desk-code-${kind}`)].map(span => span.textContent)
  const result = { comment: of('comment'), string: of('string'), keyword: of('keyword'), number: of('number'), key: of('key') }
  cleanup()
  return result
}

describe('CodeBlock highlighting', () => {
  it('Python: a # inside a string is not a comment, and one after it is', () => {
    const t = tokens('x = "a # not a comment"  # a comment', 'python')
    expect(t.string).toEqual(['"a # not a comment"'])
    expect(t.comment).toEqual(['# a comment'])
  })

  it('Python: an escaped quote does not end the string', () => {
    const t = tokens(String.raw`s = "say \"hi\" # still" + 'it\'s'`, 'python')
    expect(t.string).toEqual([String.raw`"say \"hi\" # still"`, String.raw`'it\'s'`])
    expect(t.comment).toEqual([])
  })

  it('Python: a triple-quoted string runs over lines, a # in it included', () => {
    const t = tokens("doc = '''one\ntwo # in it\n'''\nprint(doc)", 'python')
    expect(t.string).toEqual(["'''one\ntwo # in it\n'''"])
    expect(t.comment).toEqual([])
  })

  it('Python: keywords and numbers, but not inside a name or a version', () => {
    const t = tokens('def total(v1):\n    return v1 + 42 - 1.5e3 if v1 else None  # 1.2.3', 'python')
    expect(t.keyword).toEqual(['def', 'return', 'if', 'else', 'None'])
    expect(t.number).toEqual(['42', '1.5e3'])
    expect(tokens('version = 1.2.3', 'python').number).toEqual([])
    expect(tokens('x = -1', 'python').number).toEqual(['1'])
  })

  it('TypeScript: line and block comments, template strings over lines, and keywords', () => {
    const t = tokens('/* a\nblock */ const n: number = obj.default // why\nlet s = `one\n${n}`', 'typescript')
    expect(t.comment).toEqual(['/* a\nblock */', '// why'])
    expect(t.string).toEqual(['`one\n${n}`'])
    expect(t.keyword).toEqual(['const', 'let'])
  })

  it('JavaScript: a /* left open, as in a regular expression, colours its own line and no more', () => {
    const t = tokens("s.replace(/\\/*/g, '')\nconst x = 1", 'javascript')
    expect(t.comment).toEqual(["/*/g, '')"])
    expect(t.keyword).toEqual(['const'])
    expect(t.number).toEqual(['1'])
  })

  it('JavaScript: a // inside a string is text', () => {
    const t = tokens("fetch('https://example.com') // go", 'javascript')
    expect(t.string).toEqual(["'https://example.com'"])
    expect(t.comment).toEqual(['// go'])
  })

  it('Kotlin: keywords, typed numbers and raw strings', () => {
    const t = tokens('fun main() {\n  val big = 10L\n  val raw = """a\\"b"""\n}', 'kotlin')
    expect(t.keyword).toEqual(['fun', 'val', 'val'])
    expect(t.number).toEqual(['10L'])
    expect(t.string).toEqual(['"""a\\"b"""'])
  })

  it('YAML: keys, values, and a # that starts a comment only after a space', () => {
    const t = tokens(
      "name: desk\nserver:\n  port: 8080 # the port\n  url: http://example.com/#top\n- title: Don't stop\n  quoted: 'it''s'\n\"spaced key\": true",
      'yaml',
    )
    expect(t.key).toEqual(['name', 'server', 'port', 'url', 'title', 'quoted', '"spaced key"'])
    expect(t.number).toEqual(['8080'])
    expect(t.comment).toEqual(['# the port'])
    expect(t.string).toEqual(["'it''s'"])
    expect(t.keyword).toEqual(['true'])
  })

  it('Shell: an apostrophe inside a word does not open a string', () => {
    const t = tokens("cat <<EOF\nDon't panic\nEOF\necho 'quoted' # done", 'shell')
    expect(t.string).toEqual(["'quoted'"])
    expect(t.comment).toEqual(['# done'])
  })

  it('Kotlin: a raw string may end in its own quote', () => {
    const t = tokens('val s = """say "hi""""\nval n = 2', 'kotlin')
    expect(t.string).toEqual(['"""say "hi""""'])
    expect(t.number).toEqual(['2'])
  })

  it('YAML: a long line takes no longer than its length', () => {
    const started = performance.now()
    tokens(`a${' '.repeat(30000)}\n${"'x' ".repeat(8000)}`, 'yaml')
    expect(performance.now() - started).toBeLessThan(250)
  })

  it('YAML: a list item without a key, and a date, are text', () => {
    const t = tokens('- http://example.com\n- 2026-10-29', 'yaml')
    expect(t.key).toEqual([])
    expect(t.number).toEqual([])
  })

  it('JSON: keys are told from string values', () => {
    const t = tokens('{\n  "name": "desk",\n  "size": 1.5,\n  "ok": true,\n  "tags": ["a:b"]\n}', 'json')
    expect(t.key).toEqual(['"name"', '"size"', '"ok"', '"tags"'])
    expect(t.string).toEqual(['"desk"', '"a:b"'])
    expect(t.number).toEqual(['1.5'])
    expect(t.keyword).toEqual(['true'])
  })

  it('Shell: $# is not a comment, and a keyword inside a flag is not a keyword', () => {
    const t = tokens('if [ $# -gt 0 ]; then echo "args: $#"; fi # done\ndropdb --if-exists app', 'shell')
    expect(t.comment).toEqual(['# done'])
    expect(t.keyword).toEqual(['if', 'then', 'fi'])
    expect(t.string).toEqual(['"args: $#"'])
  })

  it('text, the default, is drawn as it is', () => {
    const { container } = render(<CodeBlock code={'if "x" # 1'} />)
    expect(container.querySelectorAll('code span')).toHaveLength(0)
    expect(container.querySelector('code')?.textContent).toBe('if "x" # 1')
  })
})

describe('CodeBlock', () => {
  it('keeps markup in the code as text', () => {
    const code = '<script>window.hacked = true</script><img src=x onerror="alert(1)">'
    for (const language of ['typescript', 'text', 'json'] as const) {
      const { container } = render(<CodeBlock code={code} language={language} />)
      expect(container.querySelector('script, img')).toBeNull()
      expect(container.querySelector('code')?.textContent).toBe(code)
      cleanup()
    }
  })

  it('draws no empty last line for a trailing newline', () => {
    const { container } = render(<CodeBlock code={'npm install\n'} language="shell" />)
    expect(container.querySelector('code')?.textContent).toBe('npm install')
  })

  it('uses the host highlighter instead of its own', () => {
    const highlight = vi.fn((code: string) => <mark>{code.toUpperCase()}</mark>)
    const { container } = render(<CodeBlock code={'x = 1 # n\n'} language="python" highlight={highlight} />)
    expect(highlight).toHaveBeenCalledWith('x = 1 # n', 'python')
    expect(container.querySelector('code mark')?.textContent).toBe('X = 1 # N')
    expect(container.querySelector('.desk-code-comment, .desk-code-number')).toBeNull()
  })

  it('is a named region the keyboard reaches, so it scrolls without a pointer', async () => {
    const user = userEvent.setup()
    render(<><CodeBlock code="pip install desk" language="shell" label="Install" copy={false} /><CodeBlock code="{}" language="json" /></>)
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Install' }))
    expect(screen.getByText('Install')).toBeTruthy()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'JSON code' }))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Copy' }))
  })

  it('is named Code when nothing says what it is', () => {
    render(<CodeBlock code="hello" />)
    expect(screen.getByRole('region', { name: 'Code' })).toBeTruthy()
  })

  it('copies the code exactly, says Copied for a moment, and says it politely', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    render(<CodeBlock code={'pip install desk\n'} language="shell" />)

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy' })))
    expect(writeText).toHaveBeenCalledWith('pip install desk\n')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Copied')

    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('says Copy again as soon as the code changes', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: () => Promise.resolve() } })
    const { rerender } = render(<CodeBlock code="one" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy' })))
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()
    rerender(<CodeBlock code="two" />)
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy()
  })

  it('a copy that finishes after the block has gone leaves nothing behind', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let finish = () => {}
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: () => new Promise<void>(resolve => (finish = resolve)) } })
    const { unmount } = render(<StrictMode><CodeBlock code="later" /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    unmount()
    await act(async () => finish())
    expect(vi.getTimerCount()).toBe(0)
  })

  it('without a clipboard, selects the code and copies it the older way', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
    render(<CodeBlock code="make all" language="shell" />)

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy' })))
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(window.getSelection()?.toString()).toBe('make all')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy()
  })

  it('when nothing can copy, leaves the code selected and says which keys will', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('Not allowed')))
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true })
    render(<CodeBlock code="make all" language="shell" />)

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy' })))
    expect(window.getSelection()?.toString()).toBe('make all')
    expect(screen.getByRole('button', { name: 'Press Ctrl+C' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Selected. Press Ctrl+C to copy.')
  })

  it('has no Copy when asked not to', () => {
    render(<CodeBlock code="x" copy={false} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('keeps the class an app gives it, and says its language', () => {
    const { container } = render(<CodeBlock code="x" language="yaml" className="mine" />)
    const block = container.querySelector('.desk-code')
    expect(block?.classList.contains('mine')).toBe(true)
    expect(block?.getAttribute('data-language')).toBe('yaml')
  })
})

/*
 * The code colours are read on the page's ground, the accent mixed in or not, in light and dark —
 * and every look, since a look never changes a colour token (HIG.md §2, Looks).
 */
describe('the code tokens', () => {
  const css = readFileSync('src/css/tokens.css', 'utf8')
  const block = (start: string) => css.slice(css.indexOf(start), css.indexOf('}', css.indexOf(start)))
  const value = (text: string, token: string) => new RegExp(`${token}:\\s*(#[0-9a-f]{6})`).exec(text)?.[1]
  const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  const luminance = (c: number[]) => {
    const [r = 0, g = 0, b = 0] = c.map(v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const contrast = (a: number[], b: number[]) => {
    const [high = 0, low = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (high + 0.05) / (low + 0.05)
  }
  const mix = (a: number[], b: number[], share: number) => a.map((v, i) => v * share + (b[i] ?? 0) * (1 - share))

  const light = block(':root {')
  const accent = rgb(value(light, '--desk-accent') ?? '')
  const schemes = {
    light: { text: light, tint: 0.04 },
    'dark (system)': { text: block(':root:not([data-theme="light"])'), tint: 0.05 },
    'dark (chosen)': { text: block(':root[data-theme="dark"]'), tint: 0.05 },
  }
  const KINDS = ['comment', 'string', 'keyword', 'number', 'key']

  for (const [scheme, { text, tint }] of Object.entries(schemes)) {
    it(`are readable at 4.5:1 on the ${scheme} ground`, () => {
      const page = rgb(value(text, '--desk-page') ?? '')
      for (const kind of KINDS) {
        const colour = value(text, `--desk-code-${kind}`)
        expect(colour, `--desk-code-${kind} in ${scheme}`).toBeDefined()
        for (const ground of [page, mix(accent, page, tint)]) {
          expect(contrast(rgb(colour ?? ''), ground), `--desk-code-${kind} in ${scheme}`).toBeGreaterThanOrEqual(4.5)
        }
      }
    })
  }

  it('are the same in dark whether the system or the person chose it', () => {
    for (const kind of KINDS) {
      expect(value(schemes['dark (system)'].text, `--desk-code-${kind}`)).toBe(value(schemes['dark (chosen)'].text, `--desk-code-${kind}`))
    }
  })
})
