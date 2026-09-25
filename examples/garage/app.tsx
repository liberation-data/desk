import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  createDesk,
  DeskCommands,
  focusedId,
  formatShortcut,
  InputCommands,
  syncWithLocation,
  windowType,
} from '../../src/core/index.js'
import type { Desk, LookChoice } from '../../src/core/index.js'
import {
  Alert,
  AppFrame,
  Button,
  Checkbox,
  Checklist,
  ChoiceGroup,
  Composer,
  Desktop,
  DeskShell,
  Dock,
  dockItem,
  dockSeparator,
  dockStack,
  InputBar,
  MenuBar,
  menuAction,
  menuCommand,
  menuSeparator,
  Popover,
  PopUpButton,
  RadioGroup,
  SearchCommand,
  SearchPalette,
  SegmentedControl,
  Sheet,
  Sidebar,
  Slider,
  Table,
  TextField,
  Thread,
  Toggle,
  TourBar,
  useCommand,
  useDocumentTitle,
  useSetupProgress,
  useTasks,
  useDesk,
  useDragSource,
  useLook,
  useDropTarget,
  useDeskEvent,
  useDeskState,
  usePublish,
  useToast,
  useWindowInput,
  lazyWindow,
  windowMenuItems,
  withAppBridge,
  windowResults,
  Wizard,
} from '../../src/react/index.js'
import type { Column, DockEntry, DockItem, DockSide, Menu, Message as MessageT, SearchResult, SegmentedOption, SetupProgress, Sort, Tour, WizardStep } from '../../src/react/index.js'
import '../../src/css/tokens.css'
import '../../src/css/windows.css'
import '../../src/css/dock.css'
import '../../src/css/menus.css'
import '../../src/css/controls.css'
import '../../src/css/overlays.css'
import '../../src/css/conversation.css'
import '../../src/css/search.css'
import '../../src/css/setup.css'
import '../../src/css/apps.css'
import '../../src/css/looks.css'
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
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.7L3 21l1.9-4.9A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>',
} as const

const Icon = ({ name }: { readonly name: keyof typeof PATHS }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: PATHS[name] }} />
)

/* ── Example data ── */

// Its code is fetched the first time the window opens, not with the rest of the app.
const Weather = lazyWindow(() => import('./Weather.js'))

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

const RIDE_COLUMNS: Column<(typeof RIDES)[number]>[] = [
  { key: 'date', header: 'Date', sortable: true },
  { key: 'name', header: 'Ride', sortable: true },
  { key: 'bike', header: 'Bike', render: r => <span className="chip">{r.bike}</span> },
  { key: 'km', header: 'km', numeric: true, sortable: true, render: r => r.km.toFixed(1) },
  { key: 'climb', header: 'Climb', numeric: true, sortable: true, render: r => `${r.climb.toLocaleString()} m` },
  { key: 'time', header: 'Time', numeric: true },
]

function Rides() {
  const desk = useDesk()
  const toast = useToast()
  const publish = usePublish()
  const [selected, setSelected] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort | null>(null)
  const [query, setQuery] = useState('')
  const [bike, setBike] = useState<(typeof BIKES)[number]['value']>('all')
  const [minKm, setMinKm] = useState('')
  const [filters, setFilters] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [fileName, setFileName] = useState('rides.csv')

  // Typing into the desk's bar filters this window, because Rides is the one in front.
  useWindowInput(setQuery, { placeholder: 'Filter rides by name…', target: 'Rides' })
  // A row can be carried to another window: the map draws it, the mechanic talks about it.
  const rideSource = useDragSource<(typeof RIDES)[number]>({ type: 'ride' })

  const floor = Number(minKm) || 0
  const filtered = RIDES.filter(
    r => (bike === 'all' || r.bike === bike) && r.km >= floor && r.name.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const rides = sort
    ? [...filtered].sort((a, b) => {
        const key = sort.key as keyof (typeof RIDES)[number]
        const [x, y] = [a[key], b[key]]
        const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
        return sort.direction === 'ascending' ? order : -order
      })
    : filtered
  const total = rides.reduce((sum, r) => sum + r.km, 0)

  // Export belongs to this window, so the menu item is live only while Rides is key.
  useCommand(Commands.exportRides, () => setExporting(true))

  const doExport = () => {
    setExporting(false)
    toast.show({ message: `Exported ${rides.length} rides to ${fileName}`, tone: 'ok' })
  }

  return (
    <div className="pad">
      <div className="toolbar" data-tour="rides-filter">
        <SegmentedControl label="Filter rides by bike" options={BIKES} value={bike} onChange={setBike} size="small" />
        <Popover
          open={filters}
          onOpenChange={setFilters}
          label="More filters"
          trigger={props => <Button size="small" {...props}>Filters{floor > 0 ? ` · ${floor} km` : ''}</Button>}
        >
          <TextField
            label="Longer than"
            value={minKm}
            onChange={e => setMinKm(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            help="Kilometres"
          />
          <div className="actions">
            <Button size="small" onClick={() => setMinKm('')}>Clear</Button>
            <Button size="small" intent="default" onClick={() => setFilters(false)}>Done</Button>
          </div>
        </Popover>
        <Button size="small" icon={<Icon name="log" />} onClick={() => setExporting(true)}>Export</Button>
      </div>
      <div className="stats">
        <Stat label="This fortnight" value={`${total.toFixed(0)} km`} />
        <Stat label="Climbing" value={`${rides.reduce((s, r) => s + r.climb, 0).toLocaleString()} m`} />
        <Stat label="Rides" value={String(rides.length)} />
      </div>
      <Table
        label="Rides"
        rows={rides}
        columns={RIDE_COLUMNS}
        rowId={r => r.date}
        selected={selected}
        onSelect={(id, row) => {
          setSelected(id)
          // Say what happened: the map draws it if it is open.
          publish('ride.selected', row)
        }}
        onActivate={(_id, row) => {
          publish('ride.selected', row)
          desk.open('map')
        }}
        sort={sort}
        onSortChange={setSort}
        empty={<p>No rides match those filters.</p>}
        rowProps={row => rideSource.dragProps(row, row.name)}
      />
      {query && <p className="small">Filtered by “{query}” · <button type="button" className="linkish" onClick={() => setQuery('')}>clear</button></p>}


      <Sheet
        open={exporting}
        onDismiss={() => setExporting(false)}
        title="Export rides"
        description={`${rides.length} rides, as they are filtered now. This is a sample, so nothing is written.`}
        actions={
          <>
            <Button onClick={() => setExporting(false)}>Cancel</Button>
            <Button intent="default" onClick={doExport}>Export</Button>
          </>
        }
      >
        <TextField label="File name" value={fileName} onChange={e => setFileName(e.target.value)} />
      </Sheet>
    </div>
  )
}

const Stat = ({ label, value }: { readonly label: string; readonly value: string }) => (
  <div className="stat"><span>{label}</span><b>{value}</b></div>
)

const BIKE_SECTIONS = [
  {
    id: 'bikes',
    label: 'Bikes',
    items: [
      { id: 'all', label: 'All bikes' },
      { id: 'Road', label: 'Road' },
      { id: 'Gravel', label: 'Gravel' },
      { id: 'MTB', label: 'MTB' },
    ],
  },
]

function Parts() {
  const [bike, setBike] = useState('all')
  const parts = PARTS.filter(p => bike === 'all' || p.bike === bike)
  return (
    <div className="split">
      <Sidebar label="Bikes" sections={BIKE_SECTIONS} value={bike} onChange={setBike} className="split-side" />
      <div className="pad split-main">
        <p className="lede">Wear is counted from the rides each bike has done since the part was fitted.</p>
        {parts.map(p => {
          const ratio = p.used / p.life
          const tone = ratio >= 0.9 ? 'bad' : ratio >= 0.75 ? 'warn' : 'ok'
          return (
            <div className="wear" key={p.part} data-tour={p.part === 'Chain' ? 'part-chain' : undefined}>
              <div className="wear-head"><b>{p.part}</b><span className="muted">{p.bike}</span>
                <span className="r muted">{p.used.toLocaleString()} / {p.life.toLocaleString()} {p.unit ?? 'km'}</span></div>
              <div className="meter" data-tone={tone}><i style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
            </div>
          )
        })}
        {parts.length === 0 && <p className="muted">Nothing fitted to that bike yet.</p>}
      </div>
    </div>
  )
}

function Service({ steps, setSteps }: { readonly steps: Step[]; readonly setSteps: (s: Step[]) => void }) {
  const toast = useToast()
  const set = (id: string, state: Step['state']) => setSteps(steps.map(s => (s.id === id ? { ...s, state } : s)))
  const markDone = (step: Step) => {
    set(step.id, 'done')
    toast.show({
      message: `${step.title} — done`,
      tone: 'ok',
      action: { label: 'Undo', onSelect: () => setSteps(steps.map(s => (s.id === step.id ? { ...s, state: 'todo' } : s))) },
    })
  }
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
          <div className="step" data-state={s.state} key={s.id} data-tour={s.id === 'chain' ? 'service-chain' : undefined}>
            <span className="tick" aria-hidden="true">{s.state === 'done' ? '✓' : ''}</span>
            <div className="grow"><b>{s.title}</b><p className="muted">{s.detail}</p>
              <div className="actions">
                {s.state === 'todo' && (
                  <>
                    <Button intent="default" size="small" onClick={() => markDone(s)}>Mark done</Button>
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
  const [ride, setRide] = useState<(typeof RIDES)[number] | null>(null)
  // Replayed, because the map is usually opened by the very click that chose the ride.
  useDeskEvent<(typeof RIDES)[number]>('ride.selected', event => setRide(event.payload), { replay: true })
  const { dropProps, over, ready } = useDropTarget<(typeof RIDES)[number]>({ accepts: 'ride', onDrop: drag => setRide(drag.payload) })
  const shown = ride ?? RIDES[0]
  return (
    <div className="map" {...dropProps}>
      {ready && <p className="dropnote">{over ? 'Drop to draw this ride' : 'Drop a ride here'}</p>}
      <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-label="Route map of the Dandenongs loop">
        <path className="contour" d="M0 200 C80 170 120 210 200 180 S330 120 400 150" />
        <path className="contour" d="M0 150 C90 120 140 160 210 130 S320 70 400 100" />
        <path className="contour" d="M40 90 C110 60 170 100 240 70 S340 20 400 40" />
        <path className="route" d="M40 220 C70 200 90 150 130 140 S190 90 230 80 S300 60 330 90 S340 170 290 190 S150 230 40 220" />
        <circle className="start" cx="40" cy="220" r="6" />
      </svg>
      <div className="mapcard">
        <b>{shown?.name}</b>
        <span>{shown ? `${shown.km.toFixed(1)} km · ${shown.climb.toLocaleString()} m · ${shown.time}` : ''}</span>
        {!ride && <span className="small">Pick a ride in the Rides window.</span>}
      </div>
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

const FIRST_NOTES = 'Seat post creaks on climbs. Grease it before Sunday.\n\nTry 5 psi lower on the gravel tyres.'

function Notes() {
  const [text, setText] = useState(FIRST_NOTES)
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="notesbox">
      <textarea className="notes" aria-label="Notes" value={text} onChange={e => setText(e.target.value)} />
      <div className="notesbar">
        <span className="small">{text.length} characters</span>
        <Button size="small" intent="destructive" disabled={!text} onClick={() => setConfirming(true)}>Clear notes</Button>
      </div>
      <Alert
        open={confirming}
        title="Clear these notes?"
        message="There is no copy of them anywhere else."
        confirmLabel="Clear notes"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setText('')
          setConfirming(false)
        }}
      />
    </div>
  )
}

const UNIT_OPTIONS = [
  { value: 'metric', label: 'Kilometres and metres' },
  { value: 'imperial', label: 'Miles and feet' },
] as const

/*
 * How the desk looks, chosen in Settings and kept in this browser. The desk takes the choice as props;
 * keeping it is the app's job, which is why it lives here and not in the toolkit.
 */
interface Appearance {
  readonly look: LookChoice
  readonly side: DockSide
}

const APPEARANCE_KEY = 'garage.appearance'
const DEFAULT_APPEARANCE: Appearance = { look: 'auto', side: 'left' }

function loadAppearance(): Appearance {
  try {
    return { ...DEFAULT_APPEARANCE, ...JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? '{}') }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

const AppearanceContext = createContext<{ readonly appearance: Appearance; readonly change: (next: Partial<Appearance>) => void }>({
  appearance: DEFAULT_APPEARANCE,
  change: () => {},
})

const LOOK_OPTIONS: readonly SegmentedOption<LookChoice>[] = [
  { value: 'auto', label: 'Automatic' },
  { value: 'mac', label: 'Mac' },
  { value: 'gnome', label: 'GNOME' },
  { value: 'windows', label: 'Windows' },
]

const SIDE_OPTIONS: readonly SegmentedOption<DockSide>[] = [
  { value: 'left', label: 'Left' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'right', label: 'Right' },
]

function Settings() {
  const { appearance, change } = useContext(AppearanceContext)
  const [units, setUnits] = useState<(typeof UNIT_OPTIONS)[number]['value']>('metric')
  const [remind, setRemind] = useState(true)
  const [threshold, setThreshold] = useState(90)
  const [commutes, setCommutes] = useState(true)
  const [name, setName] = useState('Jasper')
  const [wheel, setWheel] = useState('622')
  const wheelError = /^\d+$/.test(wheel) ? undefined : 'Enter a size in millimetres, like 622'
  return (
    <div className="pad settings">
      <section className="section">
        <h3>Appearance</h3>
        <span className="desk-label" aria-hidden="true">Look</span>
        <SegmentedControl label="Look" options={LOOK_OPTIONS} value={appearance.look} onChange={look => change({ look })} />
        <span className="desk-label" aria-hidden="true">Dock position</span>
        <SegmentedControl label="Dock position" options={SIDE_OPTIONS} value={appearance.side} onChange={side => change({ side })} />
      </section>
      <section className="section">
        <h3>Units</h3>
        <PopUpButton label="Distance" options={UNIT_OPTIONS} value={units} onChange={setUnits} />
      </section>
      <section className="section">
        <h3>Service reminders</h3>
        <Toggle checked={remind} onChange={setRemind} label="Warn me before a part wears out" description="A badge on the dock" />
        <Slider
          label="Warn at"
          value={threshold}
          onChange={setThreshold}
          min={50}
          max={100}
          step={5}
          disabled={!remind}
          format={v => `${v}% worn`}
        />
        <Checkbox checked={commutes} onChange={setCommutes} label="Count commutes towards wear" description="Short rides under 30 km" />
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
  { keys: 'mod+k', does: 'Search the garage' },
  { keys: 'mod+comma', does: 'Settings' },
  { keys: 'mod+j', does: 'Type to the window in front' },
  { keys: 'mod+e', does: 'Export rides, from the Rides window' },
  { keys: 'mod+m', does: 'Minimize the window in front — it stays open and loaded' },
  { keys: 'mod+alt+a', does: 'Arrange the windows' },
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
      <p>Open things from the dock. Each window fills the desk, over the one before; Window → Arrange (⌥⌘A) lays them out side by side. Stacks fan out; Back closes what you opened.</p>
      <p className="muted">Focused: <code>{focusedId(state) ?? 'nothing'}</code> · open: {state.windows.length}</p>
    </div>
  )
}

/*
 * A mechanic you can ask about the data in the other windows. The answers here
 * are canned: the toolkit's conversation control holds no transport of its own.
 */
const ANSWERS: readonly { readonly match: RegExp; readonly reply: string }[] = [
  { match: /chain|wear|part/i, reply: 'The road chain is at 2,860 of 3,000 km — closest to the end of its life. Rear pads on the gravel bike are at 1,720 of 2,000.' },
  { match: /sunday|weekend|ride|weather/i, reply: 'Sunday looks best: 23°, calm. The Dandenongs loop is 92 km with 1,640 m of climbing, and you have done it in 3:41.' },
  { match: /km|distance|far/i, reply: 'You have ridden 231 km over five rides this fortnight, with 2,878 m of climbing.' },
]

function Chat({ pending, onPending }: { readonly pending: string | null; readonly onPending: (text: string | null) => void }) {
  const [messages, setMessages] = useState<MessageT[]>([
    { id: 'hello', from: 'mechanic', authorName: 'Mechanic', body: 'Ask about the bikes, the rides, or what needs doing.', at: '08:30' },
  ])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)

  const send = (text: string) => {
    const stamp = new Date()
    setMessages(list => [...list, { id: `you-${stamp.getTime()}`, from: 'me', body: text, at: stamp }])
    setDraft('')
    setThinking(true)
    setTimeout(() => {
      const answer = ANSWERS.find(a => a.match.test(text))?.reply ?? 'This sample only knows about bikes, parts, rides and the weather.'
      setMessages(list => [...list, { id: `mechanic-${Date.now()}`, from: 'mechanic', authorName: 'Mechanic', body: answer, at: new Date() }])
      setThinking(false)
    }, 900)
  }

  useWindowInput(send, { placeholder: 'Ask about the bikes…', target: 'Chat' })
  const { dropProps, ready, over } = useDropTarget<(typeof RIDES)[number]>({
    accepts: 'ride',
    onDrop: drag => send(`What did ${drag.payload.name} wear out?`),
  })

  // A question typed into the bar while another window was in front arrives here.
  useEffect(() => {
    if (!pending) return
    send(pending)
    onPending(null)
  }, [pending, onPending])

  return (
    <div className="chat" {...dropProps}>
      {ready && <p className="dropnote">{over ? 'Drop to ask about this ride' : 'Drop a ride here to ask about it'}</p>}
      <Thread messages={messages} typing={thinking} label="Chat with the mechanic" />
      <Composer
        value={draft}
        onChange={setDraft}
        onSubmit={send}
        placeholder="Ask about the bikes…"
        busy={thinking}
        onStop={() => setThinking(false)}
      />
    </div>
  )
}

const TOUR: Tour = {
  id: 'first-look',
  name: 'What needs doing',
  description: 'A minute on where the jobs are, what wore out, and how to look into it.',
  steps: [
    { window: 'service', point: 'service-chain', caption: 'Service lists what the bikes need. The road chain is first.' },
    { window: 'parts', point: 'part-chain', caption: 'Wear is counted from the rides each bike has done since the part was fitted.' },
    { window: 'rides', point: 'rides-filter', caption: 'Rides can be filtered by bike, so you can see what wore that chain out.' },
    { window: 'rides', caption: 'Choose a ride in the table.', yourTurn: true, until: 'ride.selected' },
    { window: 'chat', caption: 'Ask the mechanic which job to do first.', yourTurn: true },
  ],
}

/*
 * First run, in the manner of a setup assistant: one pane, one question at a
 * time, the whole screen given over to it. Ported from the published design and
 * built entirely out of the toolkit's own Wizard and controls.
 */

interface Profile {
  readonly rider: string
  readonly home: string
  readonly bikes: readonly string[]
  readonly music: string
}

const BIKE_CHOICES = [
  { id: 'Road', label: 'Road', note: 'Long days and bunch rides' },
  { id: 'Gravel', label: 'Gravel', note: 'Commutes and dirt roads' },
  { id: 'MTB', label: 'Mountain', note: 'Trails and technical descents' },
]

const MUSIC_OPTIONS = [
  { value: 'tempo', label: 'Tempo', description: 'Steady 160–170 bpm for efforts' },
  { value: 'long', label: 'Long and steady', description: 'Three hours without a spike' },
  { value: 'quiet', label: 'No music', description: 'Just the road' },
] as const

/** What setup remembers across a reload. Not the weather key: that is never written down here. */
interface SetupAnswers {
  readonly rider: string
  readonly home: string
  readonly bikes: readonly string[]
  readonly music: (typeof MUSIC_OPTIONS)[number]['value']
  readonly keyState: 'idle' | 'ok' | 'skipped'
  readonly maps: 'online' | 'offline' | 'none'
  readonly start: 'rides' | 'parts' | 'weather' | 'chat'
}

// A sample: the fields come filled in so the flow can be walked through quickly.
const FIRST_ANSWERS: SetupAnswers = {
  rider: 'Jasper Blues',
  home: 'Melbourne',
  bikes: ['Road', 'Gravel'],
  music: 'tempo',
  keyState: 'idle',
  maps: 'online',
  start: 'rides',
}

function Setup({ progress, onDone }: { readonly progress: SetupProgress<SetupAnswers>; readonly onDone: (profile: Profile, start: string) => void }) {
  const { index, setIndex, answers, answer } = progress
  const { rider, home, bikes, music, keyState, maps, start } = answers
  const setRider = (value: string) => answer({ rider: value })
  const setHome = (value: string) => answer({ home: value })
  const setBikes = (value: readonly string[]) => answer({ bikes: value })
  const setMusic = (value: SetupAnswers['music']) => answer({ music: value })
  const setKeyState = (value: SetupAnswers['keyState']) => answer({ keyState: value })
  const setMaps = (value: SetupAnswers['maps']) => answer({ maps: value })
  const setStart = (value: SetupAnswers['start']) => answer({ start: value })
  const [key, setKey] = useState('wx-sample-key')

  const firstName = rider.trim().split(/\s+/)[0] || 'Jasper'
  const named = rider.trim().split(/\s+/).length >= 2

  // Continue checks the key with the service before moving on; a key it refuses keeps the person here, told why.
  const checkKey = async () => {
    await new Promise(resolve => setTimeout(resolve, 900))
    if (!key.trim().startsWith('wx-')) throw new Error('The service did not accept that key. Its keys start with wx-.')
    setKeyState('ok')
  }

  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  // What the garage finds on this machine, so nobody types in what it can read.
  const workshop = useTasks([
    { id: 'log', name: 'Ride log', detail: 'Reading ~/Documents/rides…', run: async (report: (detail: string) => void) => { await pause(700); report('24 rides, back to March') } },
    { id: 'sensors', name: 'Sensors', detail: 'Looking…', run: async (report: (detail: string) => void) => { await pause(800); report('Power meter and two speed sensors') } },
  ])

  const finishing = useTasks([
    { id: 'profile', name: `Save the profile for ${rider.trim() || 'you'}`, detail: 'Kept on this machine', run: () => pause(600) },
    keyState === 'ok'
      ? { id: 'key', name: 'Store the weather key', detail: 'Never leaves the garage', run: () => pause(600) }
      : { id: 'key', name: 'Skip the weather service', detail: 'Add one from Settings later', run: () => pause(300) },
    { id: 'bikes', name: `Set up ${bikes.length} ${bikes.length === 1 ? 'bike' : 'bikes'}`, detail: bikes.join(', '), run: () => pause(600) },
    maps === 'none'
      ? { id: 'rides', name: 'Skip the maps', run: () => pause(300) }
      : {
          id: 'rides',
          name: 'Import your rides',
          detail: 'So the wear counts are right',
          run: async (report: (detail: string) => void) => {
            for (let i = 1; i <= 24; i++) {
              await pause(40)
              report(`${i} of 24, so the wear counts are right`)
            }
          },
        },
  ])

  const steps: WizardStep[] = [
    {
      id: 'welcome',
      name: 'Welcome',
      title: 'Welcome to the garage',
      description: 'A log of your rides, your bikes and what they need next — all of it on this machine. Setting up takes about a minute.',
      continueLabel: 'Get started',
      body: (
        <div className="welcome">
          <p className="mark" aria-hidden="true">
            <span className="chev">‹‹</span>
            <span className="mark-word">garage</span>
            <span className="chev right">››</span>
          </p>
          <div className="facts">
            <span className="fact">Your rides stay here</span>
            <span className="fact">Works without a weather key</span>
            <span className="fact">Change anything later</span>
          </div>
        </div>
      ),
    },
    {
      id: 'workshop',
      name: 'Workshop',
      glyph: <Icon name="wrench" />,
      title: 'Looking at your workshop',
      description: 'The garage reads what is already on this machine, so you do not type in what it can find.',
      working: !workshop.failed,
      complete: workshop.done,
      onEnter: workshop.restart,
      body: <Checklist items={workshop.items} onRetry={workshop.start} progress={false} label="What was found" />,
    },
    {
      id: 'rider',
      name: 'Rider',
      glyph: <Icon name="ride" />,
      title: 'Who is riding?',
      description: 'Your rides are logged against this name, and a bunch ride can name several people.',
      complete: named && home.trim().length > 1,
      body: (
        <div className="setup-form">
          <TextField label="Your name" value={rider} onChange={e => setRider(e.target.value)} placeholder="Jasper Blues" autoComplete="name" />
          {/* Shows the matching problem rather than describing it. */}
          <div className="match">
            <span className="match-q">When a ride log says “{firstName}”, is that you?</span>
            <div className="match-row">
              <span className="lamp warn" />
              <span className="match-who">{firstName}</span>
              <span className="match-res">could be anyone in the bunch</span>
            </div>
            <div className="match-row">
              <span className={`lamp ${named ? 'good' : 'warn'}`} />
              <span className="match-who">{named ? rider.trim() : 'First Last'}</span>
              <span className="match-res">{named ? 'is one rider: you' : 'add your surname so the log can tell'}</span>
            </div>
          </div>
          <TextField
            label="Where you ride from"
            value={home}
            onChange={e => setHome(e.target.value)}
            placeholder="Melbourne"
            help="Used for the weather, and to suggest routes from your door."
          />
        </div>
      ),
    },
    {
      id: 'bikes',
      name: 'Bikes',
      glyph: <Icon name="bike" />,
      title: 'What do you ride?',
      description: 'Wear is counted per bike, so the garage needs to know what is in it. You can add more later.',
      complete: bikes.length > 0,
      body: (
        <div className="setup-form">
          {BIKE_CHOICES.map(bike => (
            <Checkbox
              key={bike.id}
              checked={bikes.includes(bike.id)}
              onChange={on => setBikes(on ? [...bikes, bike.id] : bikes.filter(b => b !== bike.id))}
              label={bike.label}
              description={bike.note}
            />
          ))}
          <div className="setup-space">
            <RadioGroup label="Playlist for long efforts" options={MUSIC_OPTIONS} value={music} onChange={setMusic} />
          </div>
        </div>
      ),
    },
    {
      id: 'weather',
      name: 'Weather',
      glyph: <Icon name="weather" />,
      title: 'Connect a weather service',
      description: 'So the garage can say which day suits the long ride. Everything else works without it.',
      complete: key.trim().length > 0,
      continueLabel: 'Connect',
      busyLabel: 'Checking the key…',
      onContinue: checkKey,
      skip: { label: 'Set up later', onSkip: () => { setKeyState('skipped'); setIndex(5) } },
      body: (
        <div className="setup-form">
          <TextField
            label="Service key"
            type="password"
            value={key}
            onChange={e => {
              setKey(e.target.value)
              setKeyState('idle')
            }}
            placeholder="wx-…"
            autoComplete="off"
            help="Any key starting with wx- will do: this is a sample. The key stays here."
          />
          <div className="columns">
            <div className="column">
              <h3>Works without it</h3>
              <p>Rides, bikes, parts and wear, routes, notes and the mechanic.</p>
            </div>
            <div className="column">
              <h3>Needs it</h3>
              <p>The three-day forecast, and picking a day for the long ride.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'maps',
      name: 'Maps',
      glyph: <Icon name="map" />,
      title: 'Where the maps come from',
      description: 'Routes are drawn on a map. It can come down as you ride, or live on this machine for the days you have no signal.',
      body: (
        <ChoiceGroup
          label="Map source"
          labelHidden
          value={maps}
          onChange={setMaps}
          options={[
            { value: 'online', icon: <Icon name="route" />, label: 'As you go', description: 'Nothing to download. Needs a connection when you open a route.' },
            { value: 'offline', icon: <Icon name="map" />, label: 'On this machine', tag: '~1.1 GB', description: 'Your state, downloaded once. Works with no signal at all.' },
            { value: 'none', icon: <Icon name="gear" />, label: 'Not now', description: 'Routes stay as numbers until you turn maps on in Settings.' },
          ]}
        />
      ),
    },
    {
      id: 'finishing',
      name: 'Finishing',
      glyph: <Icon name="gear" />,
      title: finishing.done ? 'All set' : 'Setting up your garage',
      description: 'Nothing you have entered is sent anywhere.',
      working: !finishing.failed,
      complete: finishing.done,
      onEnter: finishing.restart,
      body: <Checklist items={finishing.items} onRetry={finishing.start} label="Setting up your garage" />,
    },
    {
      id: 'ready',
      name: 'Ready',
      glyph: <Icon name="bike" />,
      title: `Ready to ride${named ? `, ${firstName}` : ''}`,
      description: 'Pick where to start. Everything else is in the dock, and ⌘K searches the lot.',
      continueLabel: 'Open the garage',
      body: (
        <ChoiceGroup
          label="Where to start"
          labelHidden
          value={start}
          onChange={setStart}
          options={[
            { value: 'rides', icon: <Icon name="ride" />, label: 'Look at your rides', ...(maps === 'none' ? {} : { tag: '24 imported' }), description: 'Sort them, filter by bike, and send one to the map.' },
            { value: 'parts', icon: <Icon name="chain" />, label: 'Check what is worn', description: 'Wear counted from the rides each bike has done.' },
            {
              value: 'weather',
              icon: <Icon name="weather" />,
              label: 'Pick a day to ride',
              ...(keyState === 'ok' ? {} : { tag: 'needs a key' }),
              description: keyState === 'ok' ? 'The next three days, from your door.' : 'Add a weather key from Settings first.',
              disabled: keyState !== 'ok',
            },
            { value: 'chat', icon: <Icon name="chat" />, label: 'Ask the mechanic', description: 'What needs doing first, and which bike wore it out.' },
          ]}
        />
      ),
    },
  ]

  return (
    <div className="setup">
      <Wizard
        steps={steps}
        index={index}
        onIndexChange={setIndex}
        onFinish={() => onDone({ rider: rider.trim(), home: home.trim(), bikes: [...bikes], music }, start)}
        label="Garage setup"
      />
      <p className="setup-note">A sample flow. Nothing is saved, and no key is sent anywhere.</p>
    </div>
  )
}

/*
 * A generated app, as the assistant might write one: a self-contained page. It knows
 * nothing about React or the desk's internals — only the small `desk` object the
 * bridge gives it. It hears which ride was chosen, takes a ride dropped on it, and
 * can send one to the map.
 */
const RIDE_CARD_APP = withAppBridge(`<!doctype html>
<html><head><meta charset="utf-8"><style>
  :root { color-scheme: dark; font-family: system-ui, sans-serif; }
  body { margin: 0; padding: 20px; background: #15171b; color: #ececec; }
  .empty { height: calc(100vh - 40px); display: grid; place-items: center; text-align: center; color: #9a9ea6;
           border: 1.5px dashed #25282e; border-radius: 14px; }
  .card { border: 1px solid #25282e; border-radius: 14px; padding: 18px; }
  .eyebrow { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #9a9ea6; }
  h1 { margin: 6px 0 14px; font-size: 22px; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
  .stat { background: #101114; border-radius: 10px; padding: 10px; }
  .stat b { display: block; font-size: 20px; font-variant-numeric: tabular-nums; }
  .stat span { font-size: 11px; color: #9a9ea6; }
  button { font: inherit; padding: 6px 14px; border-radius: 8px; border: 1px solid #ff7a45; background: #ff7a45; color: #1a0f08; font-weight: 600; cursor: pointer; }
  .note { margin-top: 14px; font-size: 11px; color: #9a9ea6; }
</style></head><body>
  <div id="root" class="empty"><div><b>Ride Card</b><br>Drop a ride here, or choose one in Rides.</div></div>
  <script>
    let ride = null, source = '';
    const render = () => {
      if (!ride) return;
      const root = document.getElementById('root');
      root.className = 'card';
      root.innerHTML = '<div class="eyebrow">' + ride.bike + ' · ' + ride.date + '</div>'
        + '<h1>' + ride.name + '</h1>'
        + '<div class="stats"><div class="stat"><b>' + ride.km.toFixed(1) + '</b><span>km</span></div>'
        + '<div class="stat"><b>' + ride.climb.toLocaleString() + '</b><span>m climbed</span></div>'
        + '<div class="stat"><b>' + ride.time + '</b><span>moving</span></div></div>'
        + '<button id="map">Show on the map</button>'
        + '<div class="note">' + source + '</div>';
      document.getElementById('map').onclick = () => { desk.publish('ride.selected', ride); desk.open('map'); };
    };
    desk.on('ride.selected', message => { ride = message.payload; source = 'Heard from ' + message.from; render(); });
    desk.onDrop(message => { ride = message.payload; source = 'Dropped from ' + message.from; render(); });
  </script>
</body></html>`)

/* ── Shell ── */

interface Surface { readonly title: string; readonly icon: keyof typeof PATHS; readonly description: string }
export const SURFACES = {
  rides: { title: 'Rides', icon: 'ride', description: 'Every ride, newest first' },
  service: { title: 'Service', icon: 'wrench', description: 'What the bikes need' },
  map: { title: 'Map', icon: 'map', description: 'The last ride, drawn' },
  chat: { title: 'Chat', icon: 'chat', description: 'Ask about the bikes' },
  card: { title: 'Ride Card', icon: 'log', description: 'A generated app, in a window' },
  bikes: { title: 'Bikes', icon: 'bike', description: 'The whole stable' },
  parts: { title: 'Parts & Wear', icon: 'chain', description: 'How worn each part is' },
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
// `rides#2` is a second Rides window: the kind is what decides how it renders.
const isKnown = (id: string): id is Id => windowType(id) in SURFACES
const kindOf = (id: string) => windowType(id) as Id
const windowTitle = (id: string) => (isKnown(id) ? SURFACES[kindOf(id)].title : id)

/** The tab says what is in front. "Garage" comes from the page's own <title>, so it is named once. */
function BrowserTitle() {
  useDocumentTitle(windowTitle)
  return null
}

const item = (id: Id, extra: Partial<DockItem> = {}): DockItem => ({
  id,
  label: SURFACES[id].title,
  icon: <Icon name={SURFACES[id].icon} />,
  description: SURFACES[id].description,
  ...extra,
})

function Garage({ desk, firstRun, onSetupAgain }: { readonly desk: Desk; readonly firstRun: boolean; readonly onSetupAgain: () => void }) {
  const [steps, setSteps] = useState(INITIAL_SERVICE)
  const [pending, setPending] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  // Straight after setup the tour is offered, so nobody lands on the desktop without a word.
  const [touring, setTouring] = useState(firstRun)
  const [offering, setOffering] = useState(firstRun)
  const [appearance, setAppearance] = useState(loadAppearance)
  const due = steps.filter(s => s.state === 'todo').length
  const changeAppearance = (next: Partial<Appearance>) =>
    setAppearance(current => {
      const merged = { ...current, ...next }
      try {
        localStorage.setItem(APPEARANCE_KEY, JSON.stringify(merged))
      } catch {
        // Private windows and blocked storage: the choice lasts until the page is closed.
      }
      return merged
    })

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
    dockItem(item('chat')),
    dockSeparator('sep-stacks'),
    dockStack({ id: 'garage', label: 'Garage', items: [item('bikes'), item('parts'), item('service', due ? { badge: due } : {})] }),
    dockStack({ id: 'plan', label: 'Plan', items: [item('routes'), item('weather'), item('calendar')] }),
    dockStack({ id: 'system', label: 'System', items: [item('settings'), item('shortcuts'), item('about')] }),
    dockSeparator('sep-pins'),
    dockItem(item('card')),
    dockItem(item('playlist')),
    dockItem(item('notes')),
  ]

  // Everything this world holds, in one list: windows, rides, parts and what needs doing.
  const search = (query: string): SearchResult[] => {
    const text = query.trim().toLowerCase()
    const hit = (...fields: string[]) => !text || fields.some(f => f.toLowerCase().includes(text))
    return [
      ...(Object.keys(SURFACES) as Id[])
        .filter(id => hit(SURFACES[id].title, SURFACES[id].description))
        .map(id => ({
          id: `open:${id}`,
          title: SURFACES[id].title,
          subtitle: SURFACES[id].description,
          group: 'Open',
          kind: 'window',
          icon: <Icon name={SURFACES[id].icon} />,
          onSelect: () => desk.open(id),
        })),
      ...RIDES.filter(r => hit(r.name, r.bike)).map(r => ({
        id: `ride:${r.date}`,
        title: r.name,
        subtitle: `${r.date} · ${r.km.toFixed(1)} km · ${r.bike}`,
        group: 'Rides',
        kind: 'ride',
        icon: <Icon name="ride" />,
        onSelect: () => desk.open('map'),
      })),
      ...PARTS.filter(p => hit(p.part, p.bike)).map(p => ({
        id: `part:${p.part}`,
        title: p.part,
        subtitle: `${p.bike} · ${Math.round((p.used / p.life) * 100)}% worn`,
        group: 'Parts',
        kind: 'part',
        icon: <Icon name="chain" />,
        onSelect: () => desk.open('parts'),
      })),
      ...steps.filter(step => hit(step.title, step.detail)).map(step => ({
        id: `service:${step.id}`,
        title: step.title,
        subtitle: step.state === 'todo' ? 'still to do' : step.state,
        group: 'Service',
        kind: 'job',
        icon: <Icon name="wrench" />,
        onSelect: () => desk.open('service'),
      })),
    ]
  }

  // A second window of a kind says so: "Rides 2".
  const titleFor = (id: string) => {
    const [kind, instance] = id.split('#')
    const title = SURFACES[kind as Id].title
    return instance ? `${title} ${instance}` : title
  }

  const body = (id: Id): ReactNode => {
    switch (id) {
      case 'rides': return <Rides />
      case 'service': return <Service steps={steps} setSteps={setSteps} />
      case 'map': return <MapView />
      case 'chat': return <Chat pending={pending} onPending={setPending} />
      // Granted per app: it may hear and say ride.selected, take a dropped ride, and open the map. Nothing else.
      case 'card':
        return <AppFrame title="Ride Card" srcDoc={RIDE_CARD_APP} listens={['ride.selected']} says={['ride.selected']} accepts="ride" opens={['map']} />
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
    <DeskShell desk={desk} look={appearance.look}>
      <AppearanceContext.Provider value={{ appearance, change: changeAppearance }}>
      <div className="garage">
        <BrowserTitle />
        <GarageMenuBar desk={desk} steps={steps} touring={touring} onTour={() => { setOffering(false); setTouring(true) }} onSetupAgain={onSetupAgain} />
        <main className="screen">
          <Desktop
            title={windowTitle}
            renderWindow={id => (isKnown(id) ? body(id) : null)}
            empty={<div className="empty"><h2>Nothing open</h2><p>Pick something from the dock.</p></div>}
          />
          {touring && (
            <div className="bottomstack">
              <TourBar tour={TOUR} offer={offering} onFinish={() => setTouring(false)} onStop={() => setTouring(false)} />
            </div>
          )}
          <InputBar
            onSubmit={text => {
              // Nobody in front took it, so it becomes a question for the mechanic.
              setPending(text)
              desk.open('chat')
            }}
            fallbackPlaceholder="Ask the mechanic…"
            fallbackTarget="Chat"
            shortcut={null}
          />
          <Dock entries={entries} label="Garage dock" side={appearance.side} />
          <SearchPalette
            open={searching}
            onOpenChange={setSearching}
            search={search}
            shortcut={null}
            placeholder="Search rides, parts and jobs"
            hint={<>Search the whole garage — windows, rides, parts and what needs doing.</>}
          />
        </main>
      </div>
      </AppearanceContext.Provider>
    </DeskShell>
  )
}

function GarageMenuBar({
  desk,
  steps,
  touring,
  onTour,
  onSetupAgain,
}: {
  readonly desk: Desk
  readonly steps: readonly Step[]
  readonly touring: boolean
  readonly onTour: () => void
  readonly onSetupAgain: () => void
}) {
  useDeskState() // re-render as windows change, so the status menu and badge stay current
  const look = useLook()
  const titleOf = (id: string) => {
    const [kind, instance] = id.split('#')
    const title = isKnown(id) ? SURFACES[kind as Id].title : id
    return instance ? `${title} ${instance}` : title
  }
  const todo = steps.filter(s => s.state === 'todo')

  const menus: Menu[] = [
    {
      id: 'garage',
      label: 'Garage',
      emphasis: true,
      title: (
        <span className="brand">
          <i />
          Garage
        </span>
      ),
      items: [
        menuAction('About Garage', () => desk.open('about')),
        menuSeparator(),
        menuCommand('Search…', SearchCommand, { shortcut: 'mod+k' }),
        menuCommand('Type to the window in front…', InputCommands.open, { shortcut: 'mod+j' }),
        menuSeparator(),
        menuAction('Run setup again…', onSetupAgain),
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
        menuCommand('Minimize', DeskCommands.minimizeWindow, { shortcut: 'mod+m' }),
        // Zoom on a Mac, Maximize elsewhere: the same act, named the way the title bar names it.
        menuCommand(look === 'mac' ? 'Zoom' : 'Maximize', DeskCommands.zoomWindow),
        menuCommand('Arrange', DeskCommands.arrange, { shortcut: 'mod+alt+a' }),
        menuSeparator(),
        menuAction('New window of this kind', () => {
          const key = focusedId(desk.getState())
          if (key) desk.openInstance(windowType(key))
        }, { disabled: !focusedId(desk.getState()) }),
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
      items: [
        menuAction('Take the tour', onTour, { disabled: touring }),
        menuAction('Keyboard shortcuts', () => desk.open('shortcuts')),
        menuAction('About this sample', () => desk.open('about')),
      ],
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
      trailing={<span>Sun 14 Sep</span>}
    />
  )
}

export const desk = createDesk()

export function App() {
  // The sample starts at first run unless a link already names windows to open.
  // Setup is remembered: a reload resumes it where it was, and a finished one is not shown again.
  const progress = useSetupProgress({ key: 'garage', initial: FIRST_ANSWERS })
  // A link that names windows goes straight to them.
  const [linked, setLinked] = useState(() => Boolean(location.hash))
  const [firstRun, setFirstRun] = useState(false)
  if (!progress.loaded) return null
  if (!progress.finished && !linked) {
    return (
      <Setup
        progress={progress}
        onDone={(_profile, start) => {
          desk.closeAll()
          // Windows open layered, so the one the person chose opens last and is the one in front.
          desk.open('service')
          desk.open(start)
          setFirstRun(true)
          progress.finish()
        }}
      />
    )
  }
  return (
    <Garage
      desk={desk}
      firstRun={firstRun}
      onSetupAgain={() => {
        setLinked(false)
        progress.reset()
      }}
    />
  )
}

