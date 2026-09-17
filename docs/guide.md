# Building with desk

A guide for people. For the full API in one file, see [llms.txt](../llms.txt); for how it should look and
behave, see [HIG.md](../HIG.md).

---

## 1. What this is

`desk` gives a web app the shape of a desktop: several windows open at once, a dock, a menu bar, and
commands that find whoever should handle them. It renders your content and never owns it.

It is worth reaching for when people need **two things side by side** — a list and a map, a query and its
results, a document and a conversation about it — and when they return to the same few places all day.
A page with one task at a time is better as a page.

## 2. The smallest app

```tsx
import { createDesk } from '@liberation-data/desk'
import { Desktop, DeskShell } from '@liberation-data/desk/react'
import '@liberation-data/desk/desk.css'

const SURFACES = {
  rides: { title: 'Rides', body: <Rides /> },
  map: { title: 'Map', body: <MapView /> },
}

const desk = createDesk()
const renderWindow = (id: string) => SURFACES[id].body   // stable: window content is memoised on it

export function App() {
  return (
    <DeskShell desk={desk}>
      <button onClick={() => desk.open('rides')}>Rides</button>
      <Desktop
        title={id => SURFACES[id].title}
        renderWindow={renderWindow}
        empty={<p>Nothing open</p>}
      />
    </DeskShell>
  )
}
```

Three things follow from this:

- **A window is an id.** The desk tracks ids; you decide what an id renders as.
- **The stage is where windows live.** Give `.desk-stage` a height — usually a flex child that fills the
  screen — or nothing will show.
- **`DeskShell` is the surround:** the desk, its event bus and toasts in one component. `DeskProvider` on
  its own is there when an app wants to assemble them itself.
- **The desk can be driven from anywhere.** `desk.open('rides')` works in an event handler, a router, a
  test, or a tour. `createDesk()` has no React in it.

## 3. How windows arrange themselves

Every window opens filling the stage, layered over the ones before it. Arrange (⌥⌘A in the sample's Window
menu) lays them out once — two side by side, three one tall and two stacked, four a grid — and after that each
is an ordinary window: move or resize one and only that one changes. Drag a window to free it, drop it against
an edge to give it that half, double-click a title bar to fill the desk and back. Nobody has to arrange
anything, and nobody is stopped from arranging.

On a touch screen the desk shows **one window at a time**; the others stay mounted, so their state survives.
`<Desktop layout="auto">` decides from the device; pass `"desktop"` or `"fullscreen"` to decide yourself.

Two rules worth knowing:

- **Arrange uses the order windows were opened in**, with the focused window first. Focusing never moves
  anything.
- **A window keeps its DOM while it is open.** Scroll positions, carets, iframes and video all survive
  focusing, filling, arranging and dragging. Closing a window unmounts it; if state has to outlive that, keep
  it above the desk.

## 4. Links, history and reloads

```ts
useEffect(() => syncWithLocation(desk, stageSize, { isKnown: id => id in SURFACES }), [desk])
```

The hash carries which windows are open, which float, and which has focus — `#w=rides,map~&f=map`. Opening
or closing a window pushes a history entry, so Back closes it; focus and mode changes replace it. Window
positions are deliberately left out: a link should open the same things, not reproduce someone's layout on a
different screen.

`isKnown` is not optional in spirit: it drops ids your app cannot render, so a stale or hand-edited link
opens what it can rather than breaking.

## 5. Commands: the part most apps get wrong

A menu item, a shortcut and a button often mean the same action. Wiring each to a specific component means
every new window teaches every menu about itself. `desk` does what AppKit does: the command is sent to
**whoever is responsible**, found by walking up from the focused element to its window, the stage and the app.

```tsx
function Rides() {
  const [selection, setSelection] = useState<Ride[]>([])
  useCommand('rides.export', () => exportRides(selection), { enabled: selection.length > 0 })
}
```

- The menu item for `rides.export` is **enabled only when something can perform it**, because menus ask the
  chain as they open.
- The same command reaches the same place from a shortcut, the menu, or `usePerform()`.
- A window can override a desk command — `DeskCommands.closeWindow`, say, to ask before discarding a draft.
- The first responder that implements a command decides. A **disabled** handler stops it rather than letting
  it fall through: that is AppKit's rule, and it is what makes a greyed-out menu item honest.

Keyboard shortcuts are written platform-neutrally (`mod+k` is ⌘K on Apple, Ctrl+K elsewhere) and only take
effect when something handles them, so ⌘C still copies when no window has claimed it.

## 6. Windows talking to each other

Windows publish what happened; whoever cares answers. Nobody holds a reference to anybody.

```tsx
// In the list
const publish = usePublish()
publish('ride.selected', ride)

// In the map
useDeskEvent<Ride>('ride.selected', event => draw(event.payload), { replay: true })
```

The bus comes with the desk: `<DeskProvider>` supplies one, and `<BusProvider>` is only for sharing a bus
across desks or supplying your own.

`replay` matters more than it looks: the window that cares about an event is often *opened by* that event,
a frame later, and would otherwise miss it.

The desk's input bar uses the same idea for text: `useWindowInput` in a window takes whatever is typed while
that window is key, and `<InputBar>` falls back to the app when no window wants it.

## 7. Choosing a component

| The situation | Use |
|---|---|
| The one action a view leads with | `<Button intent="default">` |
| Two to five options, all worth seeing | `<SegmentedControl>` |
| More options, or ones that need explaining | `<PopUpButton>` |
| A setting that applies at once | `<Toggle>` |
| A setting that waits for Save | `<Checkbox>` |
| Rows people sort and choose from | `<Table>` |
| The places inside a window | `<Sidebar>` |
| What a window is, for whoever asks | `<Desktop info>` (an (i) in the title bar) |
| What a view would explain if asked | `<InfoTip>` |
| Controls that stay while content scrolls | `<Pane>` and `<Toolbar>` |
| A small task tied to one control | `<Popover>` |
| A task belonging to one window | `<Sheet>` |
| The app cannot continue until this is decided | `<Alert>` |
| It is done, and nobody needs stopping | `toast.show(…)` |
| Teaching the app itself | `<TourBar>` |
| First run | `<Wizard>` |
| Choices a setup step needs explained | `<ChoiceGroup>` |
| Work a setup does while someone waits | `useTasks` and `<Checklist>` |

The [HIG](../HIG.md) has the reasoning; §7 is the ladder from least interrupting to most.

### First run, end to end

The pieces fit together like this, and HIG §8 says why each one is there:

```tsx
function App() {
  const progress = useSetupProgress({ key: 'garage', initial: { start: 'rides' } })
  const [arrived, setArrived] = useState(false)
  const install = useTasks([{ id: 'rides', name: 'Import your rides', run: importRides }])
  if (!progress.loaded) return null

  if (!progress.finished) {
    const steps: WizardStep[] = [
      { id: 'account', name: 'Account', title: 'Create your account', onContinue: createAccount, busyLabel: 'Creating…', body: <AccountFields /> },
      { id: 'install', name: 'Install', title: 'Getting ready', working: !install.failed, complete: install.done,
        onEnter: install.restart, body: <Checklist items={install.items} onRetry={install.start} /> },
      { id: 'start', name: 'Start', title: 'Where to start', continueLabel: 'Open',
        body: <ChoiceGroup label="Where to start" value={progress.answers.start} onChange={start => progress.answer({ start })} options={STARTS} /> },
    ]
    const finish = () => {
      desk.open(progress.answers.start)
      setArrived(true)
      progress.finish()
    }
    return <Wizard steps={steps} index={progress.index} onIndexChange={progress.setIndex} onFinish={finish} />
  }

  return (
    <DeskShell desk={desk}>
      <MenuBar … />
      <Desktop … />
      {arrived && <TourBar tour={FIRST_LOOK} offer onStop={() => setArrived(false)} onFinish={() => setArrived(false)} />}
    </DeskShell>
  )
}
```

- `onContinue` creates the account; a refusal stays on the step with the reason.
- `useTasks` installs what the app needs; a failure says why, and Try again resumes.
- The chosen window opens last, so it is the one in front.
- The tour is offered once, on arrival; a step with `until` waits for the person to do it.
- `useSetupProgress` resumes a half-finished setup and skips a finished one. Pass a `store` to keep it on
  your server instead of in the browser.

## 8. Making it yours

Every value in `desk.css` reads a `--desk-*` custom property. Redefine the tokens; never override the
selectors:

```css
:root {
  --desk-accent: #ff7a45;
  --desk-radius: 10px;
  --desk-font: "Inter", system-ui, sans-serif;
}
```

Light and dark follow the system, and `data-theme="light|dark"` on the root wins. One accent per app: it
marks the default button, the selection, focus and the key window. Status colours (`--desk-ok`,
`--desk-warn`, `--desk-bad`) are separate and never stand in for it.

## 9. Testing an app built on it

The core is a plain object, so most behaviour can be tested without rendering:

```ts
const desk = createDesk()
desk.open('rides')
desk.open('map')
expect(focusedId(desk.getState())).toBe('map')
```

For components, `DeskProvider` accepts a desk you made yourself, so a test can open windows and assert what
rendered. In jsdom nothing has a size, so pass `createDesk({ stage: () => ({ width: 1000, height: 700 }) })`
when a test cares where a floating window lands.

## 10. Things that catch people out

- **The stage needs a height.** It fills its parent; give that parent one.
- **An overlay dock covers the bottom of the stage.** Set `--desk-inset-bottom` so windows stop above it.
- **`renderWindow` is called for every open window,** including the ones offstage on a touch layout. That is
  what keeps their state; keep the work in them cheap, or memoise.
- **Menus do not take focus.** That is deliberate — a command chosen from a menu has to reach the window you
  were working in — so a menu item that inspects `document.activeElement` sees your window, not the menu.
- **`useCommand` inside a window answers only while that window is key.** For an app-wide command, pass
  `{ at: 'app' }`.
- **Keep `renderWindow` stable** — module scope, or `useCallback`. Window content is memoised on it, so an
  inline arrow function gives that up.
- **Load big windows lazily.** `lazyWindow(() => import('./RoutePlanner'))` keeps a window's code out of the
  first load, and each window already has its own loading and error state, so one slow or broken window
  never takes the desk down with it.
- **A search that returns a promise is fine;** a slower answer to an older query never overtakes a newer one.
