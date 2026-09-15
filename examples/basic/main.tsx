import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createDesk, focusedId, syncWithLocation } from '../../src/core/index.js'
import type { Desk } from '../../src/core/index.js'
import { Desktop, DeskProvider, useDesk, useDeskState } from '../../src/react/index.js'
import '../../src/desk.css'
import './example.css'

const WINDOWS = {
  notes: { title: 'Notes', body: () => <Notes /> },
  clock: { title: 'Clock', body: () => <Clock /> },
  inspector: { title: 'Inspector', body: () => <Inspector /> },
  about: { title: 'About', body: () => <About /> },
} as const

type Id = keyof typeof WINDOWS
const isKnown = (id: string): id is Id => id in WINDOWS

function Notes() {
  const [text, setText] = useState('Type here, then focus another window. Nothing re-mounts, so this text stays.')
  return <textarea className="notes" aria-label="Notes" value={text} onChange={e => setText(e.target.value)} />
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return <p className="clock">{now.toLocaleTimeString()}</p>
}

function Inspector() {
  const state = useDeskState()
  return (
    <div className="pad">
      <p className="muted">
        Focused: <code>{focusedId(state) ?? 'nothing'}</code>
      </p>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  )
}

function About() {
  return (
    <div className="pad prose">
      <p>The first window takes the stage. The second splits it. Everything after that floats.</p>
      <p>Drag a floating window by its title bar; resize it from the corner. The green light floats or tiles.</p>
      <p>The URL follows along: open and close windows, then use Back.</p>
    </div>
  )
}

function Toolbar() {
  const desk = useDesk()
  const state = useDeskState()
  return (
    <nav className="toolbar" aria-label="Windows">
      <strong>desk</strong>
      {(Object.keys(WINDOWS) as Id[]).map(id => (
        <button
          key={id}
          type="button"
          aria-pressed={state.windows.some(w => w.id === id)}
          onClick={() => desk.open(id)}
        >
          {WINDOWS[id].title}
        </button>
      ))}
      <span className="spacer" />
      <button type="button" onClick={desk.tileAll}>
        Tile all
      </button>
      <button type="button" onClick={desk.closeAll}>
        Close all
      </button>
    </nav>
  )
}

function App({ desk }: { desk: Desk }) {
  useEffect(() => {
    const stage = () => {
      const el = document.querySelector('.desk-stage')
      return { width: el?.clientWidth ?? innerWidth, height: el?.clientHeight ?? innerHeight }
    }
    return syncWithLocation(desk, stage, { isKnown })
  }, [desk])

  return (
    <DeskProvider desk={desk}>
      <div className="app">
        <Toolbar />
        <Desktop
          title={id => (isKnown(id) ? WINDOWS[id].title : id)}
          renderWindow={id => (isKnown(id) ? WINDOWS[id].body() : null)}
          empty={<p className="empty">Nothing open. Pick a window above.</p>}
        />
      </div>
    </DeskProvider>
  )
}

const desk = createDesk()
if (!location.hash) {
  desk.open('about')
  desk.open('notes')
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App desk={desk} />
    </StrictMode>,
  )
}
