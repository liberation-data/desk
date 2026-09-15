import { StrictMode, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { createDesk, DeskCommands, focusedId, formatShortcut, syncWithLocation } from '../../src/core/index.js'
import type { Desk } from '../../src/core/index.js'
import {
  Button,
  Desktop,
  DeskProvider,
  Dock,
  dockItem,
  dockSeparator,
  dockStack,
  MenuBar,
  menuAction,
  menuCommand,
  menuSeparator,
  SegmentedControl,
  TextField,
  Toggle,
  useCommand,
  useDeskState,
  windowMenuItems,
} from '../../src/react/index.js'
import type { DockEntry, DockItem, Menu, SegmentedOption } from '../../src/react/index.js'
import '../../src/desk.css'
import './garage.css'

/*
 * Garage: a cyclist's desk. It exists to exercise the toolkit the way a real app
 * would — a dock with stacks, badges and pins; windows with real-looking content.
 * Every figure below is example data.
 */

const PATHS = {
  ride: '<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17 9 9h6l3.5 8M9 9l3 8h-6.5M14 5h3l1.5 4"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  map: '<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  bike: '<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="m6 16 4-7h5l3 7M10 9 8 5H6"/>',
  chain: '<rect x="3" y="9" width="8" height="6" rx="3"/><rect x="13" y="9" width="8" height="6" rx="3"/><path d="M9 12h6"/>',
  log: '<path d="M6 3h11a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2V5"/><path d="M9 8h6M9 12h6"/>',
  route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
  weather: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4.3 4.3 0 0 1-.5 8.5z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  notes: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  keys: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
} as const

const Icon = ({ name }: { readonly name: keyof typeof PATHS }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: PATHS[name] }} />
)

/* ── Example data ── */

const RIDES = [
  { date: 'Sun 14 Sep', name: 'Dandenongs loop', bike: 'Road', km: 92.4, climb: 1640, time: '3:41' },
  { date: 'Thu 11 Sep', name: 'Yarra Trail commute', bike: 'Gravel', km: 24.1, climb: 120, time: '0:58' },
  { date: 'Tue 9 Sep', name: 'Beach Road bunch', bike: 'Road', km: 61.8, climb: 310, time: '2:02' },
  { date: 'Sat 6 Sep', name: 'Lysterfield singletrack', bike: 'MTB', km: 28.5, climb: 690, time: '2:15' },
  { date: 'Wed 3 Sep', name: 'Yarra Trail commute', bike: 'Gravel', km: 24.3, climb: 118, time: '1:01' },
]

const PARTS = [
  { part: 'Chain', bike: 'Road', used: 2860, life: 3000 },
  { part: 'Brake pads (rear)', bike: 'Gravel', used: 1720, life: 2000 },
  { part: 'Tyres', bike: 'Road', used: 3900, life: 5000 },
  { part: 'Cassette', bike: 'Road', used: 5800, life: 12000 },
  { part: 'Fork service', bike: 'MTB', used: 38, life: 50, unit: 'h' },
]

type Step = { id: string; title: string; detail: string; state: 'todo' | 'done' | 'skipped' }
const INITIAL_SERVICE: Step[] = [
  { id: 'chain', title: 'Replace the road chain', detail: '2,860 of 3,000 km. Check stretch before the weekend.', state: 'todo' },
  { id: 'pads', title: 'Rear pads on the gravel bike', detail: 'Squealing since Thursday’s wet commute.', state: 'todo' },
  { id: 'tubeless', title: 'Top up tubeless sealant', detail: 'Last done in June.', state: 'done' },
  { id: 'bartape', title: 'New bar tape', detail: 'Cosmetic. Can wait.', state: 'skipped' },
]

/* ── Windows ── */

/** Commands this app defines. Menus name them; the windows that can do them answer. */
const Commands = {
  settings: 'garage.settings',
  exportRides: 'garage.rides.export',
  completeService: 'garage.service.complete',
} as const

const BIKES: readonly SegmentedOption<'all' | 'Road' | 'Gravel' | 'MTB'>[] = [
  { value: 'all', label: 'All' },
  { value: 'Road', label: 'Road' },
  { value: 'Gravel', label: 'Gravel' },
  { value: 'MTB', label: 'MTB' },
]

function Rides() {
  const [bike, setBike] = useState<(typeof BIKES)[number]['value']>('all')
  const rides = bike === 'all' ? RIDES : RIDES.filter(r => r.bike === bike)
  const total = rides.reduce((sum, r) => sum + r.km, 0)
  const [exported, setExported] = useState<string | null>(null)
  // Only the Rides window can export rides, so the menu item is enabled only while it is the key window.
  useCommand(Commands.exportRides, () => setExported(`Exported ${rides.length} rides to rides.csv (example — nothing was saved)`))
  return (
    <div className="pad">
      {exported && <p className="notice" role="status">{exported}</p>}
      <div className="toolbar">
        <SegmentedControl label="Filter rides by bike" options={BIKES} value={bike} onChange={setBike} size="small" />
        <Button size="small" icon={<Icon name="log" />} onClick={() => setExported(`Exported ${rides.length} rides to rides.csv (example — nothing was saved)`)}>
          Export
        </Button>
      </div>
      <div className="stats">
        <Stat label="This fortnight" value={`${total.toFixed(0)} km`} />
        <Stat label="Climbing" value={`${rides.reduce((s, r) => s + r.climb, 0).toLocaleString()} m`} />
        <Stat label="Rides" value={String(rides.length)} />
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr><th>Date</th><th>Ride</th><th>Bike</th><th className="r">km</th><th className="r">Climb</th><th className="r">Time</th></tr>
          </thead>
          <tbody>
            {rides.map(r => (
              <tr key={r.date}>
                <td className="muted">{r.date}</td><td>{r.name}</td><td><span className="chip">{r.bike}</span></td>
                <td className="r">{r.km.toFixed(1)}</td><td className="r">{r.climb.toLocaleString()} m</td><td className="r">{r.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rides.length === 0 && <p className="muted">No rides on that bike in this fortnight.</p>}
    </div>
  )
}

const Stat = ({ label, value }: { readonly label: string; readonly value: string }) => (
  <div className="stat"><span>{label}</span><b>{value}</b></div>
)

function Parts() {
  return (
    <div className="pad">
      <p className="lede">Wear is counted from the rides each bike has done since the part was fitted.</p>
      {PARTS.map(p => {
        const ratio = p.used / p.life
        const tone = ratio >= 0.9 ? 'bad' : ratio >= 0.75 ? 'warn' : 'ok'
        return (
          <div className="wear" key={p.part}>
            <div className="wear-head"><b>{p.part}</b><span className="muted">{p.bike}</span>
              <span className="r muted">{p.used.toLocaleString()} / {p.life.toLocaleString()} {p.unit ?? 'km'}</span></div>
            <div className="meter" data-tone={tone}><i style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
          </div>
        )
      })}
    </div>
  )
}

function Service({ steps, setSteps }: { readonly steps: Step[]; readonly setSteps: (s: Step[]) => void }) {
  const set = (id: string, state: Step['state']) => setSteps(steps.map(s => (s.id === id ? { ...s, state } : s)))
  useCommand(Commands.completeService, () => setSteps(steps.map(s => (s.state === 'todo' ? { ...s, state: 'done' } : s))), {
    enabled: steps.some(s => s.state === 'todo'),
  })
  const section = (label: string, state: Step['state']) => {
    const rows = steps.filter(s => s.state === state)
    if (!rows.length) return null
    return (
      <section className="section">
        <h3>{label} <span className="muted">{rows.length}</span></h3>
        {rows.map(s => (
          <div className="step" data-state={s.state} key={s.id}>
            <span className="tick" aria-hidden="true">{s.state === 'done' ? '✓' : ''}</span>
            <div className="grow"><b>{s.title}</b><p className="muted">{s.detail}</p>
              <div className="actions">
                {s.state === 'todo' && (
                  <>
                    <Button intent="default" size="small" onClick={() => set(s.id, 'done')}>Mark done</Button>
                    <Button size="small" onClick={() => set(s.id, 'skipped')}>Not going to</Button>
                  </>
                )}
                {s.state === 'skipped' && <Button size="small" onClick={() => set(s.id, 'todo')}>Put it back</Button>}
              </div>
            </div>
          </div>
        ))}
      </section>
    )
  }
  const done = steps.filter(s => s.state === 'done').length
  return (
    <div className="pad">
      <p className="muted">{done}/{steps.length} done</p>
      <div className="meter" data-tone="ok"><i style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      {section('To do', 'todo')}{section('Done', 'done')}{section('Skipped', 'skipped')}
    </div>
  )
}

function MapView() {
  return (
    <div className="map">
      <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-label="Route map of the Dandenongs loop">
        <path className="contour" d="M0 200 C80 170 120 210 200 180 S330 120 400 150" />
        <path className="contour" d="M0 150 C90 120 140 160 210 130 S320 70 400 100" />
        <path className="contour" d="M40 90 C110 60 170 100 240 70 S340 20 400 40" />
        <path className="route" d="M40 220 C70 200 90 150 130 140 S190 90 230 80 S300 60 330 90 S340 170 290 190 S150 230 40 220" />
        <circle className="start" cx="40" cy="220" r="6" />
      </svg>
      <div className="mapcard"><b>Dandenongs loop</b><span>92.4 km · 1,640 m · 3:41</span></div>
    </div>
  )
}

function Bikes() {
  return (
    <div className="pad grid3">
      {[['Road', 'Carbon endurance frame', '6,120 km this year'], ['Gravel', 'Steel, flat-mount discs', '2,340 km this year'], ['MTB', 'Trail, 130 mm travel', '38 h since fork service']].map(([n, d, s]) => (
        <div className="card" key={n}><span className="cardicon"><Icon name="bike" /></span><b>{n}</b><span className="muted">{d}</span><span className="small">{s}</span></div>
      ))}
    </div>
  )
}

function Weather() {
  return (
    <div className="pad">
      <div className="stats">
        {[['Sat', '19°', 'Wind NW 22 km/h'], ['Sun', '23°', 'Calm'], ['Mon', '14°', 'Showers']].map(([d, t, w]) => (
          <div className="stat" key={d}><span>{d}</span><b>{t}</b><span className="small">{w}</span></div>
        ))}
      </div>
      <p className="lede">Sunday is the pick: warm, still, and dry roads by 8am.</p>
    </div>
  )
}

function Routes() {
  return (
    <div className="pad">
      {[['Dandenongs loop', '92 km · 1,640 m', 'Sunday'], ['Kinglake via Clintons', '118 km · 2,050 m', ''], ['Bay Trail to Frankston', '84 km · 240 m', '']].map(([n, d, when]) => (
        <div className="row" key={n}><span className="rowicon"><Icon name="route" /></span><div className="grow"><b>{n}</b><span className="muted">{d}</span></div>{when && <span className="chip ok">{when}</span>}</div>
      ))}
    </div>
  )
}

function Calendar() {
  return (
    <div className="pad">
      {[['Sat 20 Sep', 'Bunch ride · Beach Road, 7:00'], ['Sun 21 Sep', 'Dandenongs loop · 8:00'], ['Wed 24 Sep', 'Workshop · chain and pads']].map(([d, e]) => (
        <div className="row" key={d}><span className="muted date">{d}</span><div className="grow">{e}</div></div>
      ))}
    </div>
  )
}

function Playlist() {
  return (
    <div className="pad">
      {[['Tempo', '42 min · 165 bpm'], ['Long and steady', '3 h 10 min'], ['Climb', '28 min · builds']].map(([n, d]) => (
        <div className="row" key={n}><span className="rowicon"><Icon name="music" /></span><div className="grow"><b>{n}</b><span className="muted">{d}</span></div><Button size="small">Play</Button></div>
      ))}
    </div>
  )
}

function Notes() {
  const [text, setText] = useState('Seat post creaks on climbs. Grease it before Sunday.\n\nTry 5 psi lower on the gravel tyres.')
  return <textarea className="notes" aria-label="Notes" value={text} onChange={e => setText(e.target.value)} />
}

function Settings() {
  const [metric, setMetric] = useState(true)
  const [remind, setRemind] = useState(true)
  const [name, setName] = useState('Jasper')
  const [wheel, setWheel] = useState('622')
  const wheelError = /^\d+$/.test(wheel) ? undefined : 'Enter a size in millimetres, like 622'
  return (
    <div className="pad settings">
      <section className="section">
        <h3>Units</h3>
        <Toggle checked={metric} onChange={setMetric} label="Kilometres and metres" description="Off shows miles and feet" />
      </section>
      <section className="section">
        <h3>Service reminders</h3>
        <Toggle checked={remind} onChange={setRemind} label="Warn me before a part wears out" description="At 90% of its expected life" />
      </section>
      <section className="section">
        <h3>Rider</h3>
        <TextField label="Name" value={name} onChange={e => setName(e.target.value)} help="Shown on exported rides" />
        <TextField label="Wheel size" value={wheel} onChange={e => setWheel(e.target.value)} inputMode="numeric" error={wheelError} />
      </section>
    </div>
  )
}

const SHORTCUTS: readonly { readonly keys: string; readonly does: string }[] = [
  { keys: 'mod+comma', does: 'Settings' },
  { keys: 'mod+e', does: 'Export rides, from the Rides window' },
  { keys: 'alt+]', does: 'Next window' },
  { keys: 'alt+[', does: 'Previous window' },
  { keys: 'alt+w', does: 'Close window' },
]

function Shortcuts() {
  return (
    <div className="pad">
      <section className="section"><h3>Commands</h3>
        {SHORTCUTS.map(s => (
          <div className="row" key={s.keys}><kbd>{formatShortcut(s.keys)}</kbd><div className="grow">{s.does}</div></div>
        ))}
      </section>
      <section className="section"><h3>Menu bar and dock</h3>
        {[['Tab', 'Reach the menu bar, then the dock'], ['← →', 'Move between menus, or along the dock'], ['↓ Enter', 'Open a menu, or fan out a stack'], ['Esc', 'Close a menu or fold a stack away']].map(([k, d]) => (
          <div className="row" key={k}><kbd>{k}</kbd><div className="grow">{d}</div></div>
        ))}
      </section>
    </div>
  )
}

function About() {
  const state = useDeskState()
  return (
    <div className="pad prose">
      <p><b>Garage</b> is a sample app for <code>@liberation-data/desk</code>. All of its data is made up.</p>
      <p>Open things from the dock. The first window takes the stage, the second splits it, and later ones float. Stacks fan out; Back closes what you opened.</p>
      <p className="muted">Focused: <code>{focusedId(state) ?? 'nothing'}</code> · open: {state.windows.length}</p>
    </div>
  )
}

/* ── Shell ── */

interface Surface { readonly title: string; readonly icon: keyof typeof PATHS; readonly description: string }
const SURFACES = {
  rides: { title: 'Rides', icon: 'ride', description: 'Every ride, newest first' },
  service: { title: 'Service', icon: 'wrench', description: 'What the bikes need' },
  map: { title: 'Map', icon: 'map', description: 'The last ride, drawn' },
  bikes: { title: 'Bikes', icon: 'bike', description: 'The whole stable' },
  parts: { title: 'Parts & wear', icon: 'chain', description: 'How worn each part is' },
  routes: { title: 'Routes', icon: 'route', description: 'Saved loops' },
  weather: { title: 'Weather', icon: 'weather', description: 'The next three days' },
  calendar: { title: 'Calendar', icon: 'calendar', description: 'Rides and workshop' },
  playlist: { title: 'Playlist', icon: 'music', description: 'Music by effort' },
  notes: { title: 'Notes', icon: 'notes', description: 'Things to remember' },
  settings: { title: 'Settings', icon: 'gear', description: 'Units and reminders' },
  shortcuts: { title: 'Shortcuts', icon: 'keys', description: 'Keyboard' },
  about: { title: 'About', icon: 'info', description: 'This sample' },
} as const satisfies Record<string, Surface>

type Id = keyof typeof SURFACES
const isKnown = (id: string): id is Id => id in SURFACES

const item = (id: Id, extra: Partial<DockItem> = {}): DockItem => ({
  id,
  label: SURFACES[id].title,
  icon: <Icon name={SURFACES[id].icon} />,
  description: SURFACES[id].description,
  ...extra,
})

function Garage({ desk }: { readonly desk: Desk }) {
  const [steps, setSteps] = useState(INITIAL_SERVICE)
  const due = steps.filter(s => s.state === 'todo').length

  useEffect(() => syncWithLocation(desk, () => {
    const el = document.querySelector('.desk-stage')
    return { width: el?.clientWidth ?? innerWidth, height: el?.clientHeight ?? innerHeight }
  }, { isKnown }), [desk])

  // Settings is the app's, not a window's, so it answers at the top of the chain.
  useCommand(Commands.settings, () => desk.open('settings'), { at: 'app' })

  const entries: DockEntry[] = [
    dockItem(item('rides')),
    dockItem(item('service', due ? { badge: due } : {})),
    dockItem(item('map')),
    dockSeparator('sep-stacks'),
    dockStack({ id: 'garage', label: 'Garage', items: [item('bikes'), item('parts'), item('service', due ? { badge: due } : {})] }),
    dockStack({ id: 'plan', label: 'Plan', items: [item('routes'), item('weather'), item('calendar')] }),
    dockStack({ id: 'system', label: 'System', items: [item('settings'), item('shortcuts'), item('about')] }),
    dockSeparator('sep-pins'),
    dockItem(item('playlist')),
    dockItem(item('notes')),
  ]

  const body = (id: Id): ReactNode => {
    switch (id) {
      case 'rides': return <Rides />
      case 'service': return <Service steps={steps} setSteps={setSteps} />
      case 'map': return <MapView />
      case 'bikes': return <Bikes />
      case 'parts': return <Parts />
      case 'routes': return <Routes />
      case 'weather': return <Weather />
      case 'calendar': return <Calendar />
      case 'playlist': return <Playlist />
      case 'notes': return <Notes />
      case 'settings': return <Settings />
      case 'shortcuts': return <Shortcuts />
      case 'about': return <About />
    }
  }

  return (
    <DeskProvider desk={desk}>
      <div className="garage">
        <GarageMenuBar desk={desk} steps={steps} />
        <main className="screen">
          <Desktop
            title={id => (isKnown(id) ? SURFACES[id].title : id)}
            renderWindow={id => (isKnown(id) ? body(id) : null)}
            empty={<div className="empty"><h2>Nothing open</h2><p>Pick something from the dock.</p></div>}
          />
          <Dock entries={entries} label="Garage dock" />
        </main>
      </div>
    </DeskProvider>
  )
}

function GarageMenuBar({ desk, steps }: { readonly desk: Desk; readonly steps: readonly Step[] }) {
  useDeskState() // re-render as windows change, so the status menu and badge stay current
  const titleOf = (id: string) => (isKnown(id) ? SURFACES[id].title : id)
  const todo = steps.filter(s => s.state === 'todo')

  const menus: Menu[] = [
    {
      id: 'garage',
      label: 'Garage',
      items: [
        menuAction('About Garage', () => desk.open('about')),
        menuSeparator(),
        menuCommand('Settings…', Commands.settings, { shortcut: 'mod+comma' }),
      ],
    },
    {
      id: 'ride',
      label: 'Ride',
      items: [
        menuAction('Show rides', () => desk.open('rides')),
        menuCommand('Export rides…', Commands.exportRides, { shortcut: 'mod+e' }),
        menuSeparator(),
        menuCommand('Mark all service done', Commands.completeService),
      ],
    },
    {
      id: 'window',
      label: 'Window',
      items: () => [
        menuCommand('Float or tile', DeskCommands.toggleWindowMode),
        menuCommand('Tile all', DeskCommands.tileAll),
        menuSeparator(),
        menuCommand('Next window', DeskCommands.nextWindow, { shortcut: 'alt+]' }),
        menuCommand('Previous window', DeskCommands.previousWindow, { shortcut: 'alt+[' }),
        menuCommand('Close window', DeskCommands.closeWindow, { shortcut: 'alt+w' }),
        ...(desk.getState().windows.length ? [menuSeparator(), ...windowMenuItems(desk.getState(), desk.focus, titleOf)] : []),
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [menuAction('Keyboard shortcuts', () => desk.open('shortcuts')), menuAction('About this sample', () => desk.open('about'))],
    },
  ]

  const status: Menu[] = [
    {
      id: 'service',
      label: todo.length ? `Service, ${todo.length} due` : 'Service, nothing due',
      title: (
        <>
          <Icon name="wrench" />
          {todo.length > 0 && <span className="pill">{todo.length}</span>}
        </>
      ),
      items: [
        ...(todo.length ? todo.map(s => menuAction(s.title, () => desk.open('service'), { detail: 'due' })) : [menuAction('Nothing due', () => {}, { disabled: true })]),
        menuSeparator(),
        menuAction('Open service', () => desk.open('service')),
      ],
    },
  ]

  return (
    <MenuBar
      menus={menus}
      status={status}
      leading={<span className="brand"><i />Garage</span>}
      trailing={<span>Sun 14 Sep</span>}
    />
  )
}

const desk = createDesk()
if (!location.hash) {
  desk.open('rides')
  desk.open('service')
}

// Hot reload re-runs this module; reuse the root rather than creating a second one on the same container.
const container = document.getElementById('root') as (HTMLElement & { reactRoot?: Root }) | null
if (container) {
  container.reactRoot ??= createRoot(container)
  container.reactRoot.render(<StrictMode><Garage desk={desk} /></StrictMode>)
}
