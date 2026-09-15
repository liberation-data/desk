# desk

A desktop for the web, in React: windows that tile first and float when asked.

```bash
npm install @liberation-data/desk
```

## The rule

The first window takes the stage. The second splits it. Everything after that floats, cascading down and
right from the last. A user can float any tile or tile any floating window; `tileAll()` tidies the lot.

Nobody has to arrange anything, and nobody is stopped from arranging.

## Use it

```tsx
import { createDesk } from '@liberation-data/desk'
import { Desktop, DeskProvider } from '@liberation-data/desk/react'
import '@liberation-data/desk/desk.css'

const desk = createDesk()

export function App() {
  return (
    <DeskProvider desk={desk}>
      <button onClick={() => desk.open('notes')}>Notes</button>
      <Desktop
        title={id => TITLES[id]}
        renderWindow={id => SURFACES[id]}
        empty={<p>Nothing open</p>}
      />
    </DeskProvider>
  )
}
```

`renderWindow` is called with a window's id. The desk never owns your content, and a window keeps its DOM
when focus moves, so scroll positions, carets and iframes survive.

## Dock

```tsx
import { Dock, dockItem, dockSeparator, dockStack } from '@liberation-data/desk/react'

<Dock
  entries={[
    dockItem({ id: 'rides', label: 'Rides', icon: <RideIcon /> }),
    dockItem({ id: 'service', label: 'Service', icon: <WrenchIcon />, badge: 2 }),
    dockSeparator('stacks'),
    dockStack({ id: 'plan', label: 'Plan', items: [routes, weather, calendar] }),
  ]}
/>
```

An item opens the window with its id (or `window`), and shows a dot while that window is open. A stack fans
its items out above the dock and previews the first four icons. `onSelect` replaces opening a window.

The dock is one tab stop: arrow keys move along it, Enter opens, Escape folds a stack away and returns focus
to it. With `placement="overlay"` (the default) it floats over the bottom of its positioned parent; set
`--desk-inset-bottom` so tiles stop above it.

## Controls

```tsx
import { Button, SegmentedControl, TextField, Toggle } from '@liberation-data/desk/react'

<Button intent="default" onClick={save}>Save ride</Button>
<SegmentedControl label="Filter by bike" options={BIKES} value={bike} onChange={setBike} />
<Toggle checked={metric} onChange={setMetric} label="Kilometres and metres" description="Off shows miles" />
<TextField label="Wheel size" value={wheel} onChange={e => setWheel(e.target.value)} error={wheelError} />
```

Each control carries its own behaviour and accessibility; the look comes only from tokens, and there are few
style props on purpose. `intent="default"` marks the one action a view leads with. A segmented control is one
tab stop whose arrow keys move the selection past disabled options. A toggle is a `switch` for settings that
apply at once — a checkbox is for one that waits for Save. A text field always has a label (`labelHidden`
keeps it for screen readers), and an `error` marks it invalid and replaces the help text.

## Menu bar

```tsx
import { MenuBar, menuAction, menuCommand, menuSeparator, windowMenuItems } from '@liberation-data/desk/react'

<MenuBar
  leading={<AppMark />}
  menus={[
    { id: 'app', label: 'Garage', items: [menuAction('About Garage', showAbout), menuSeparator(),
                                           menuCommand('Settings…', 'app.settings', { shortcut: 'mod+comma' })] },
    { id: 'window', label: 'Window', items: () => [                // a function: re-read each time it opens
        menuCommand('Tile all', DeskCommands.tileAll),
        menuSeparator(),
        ...windowMenuItems(desk.getState(), desk.focus, titleOf),
    ] },
  ]}
  status={[{ id: 'service', label: 'Service, 2 due', title: <WrenchWithBadge />, items: dueItems }]}
  trailing={<Clock />}
/>
```

A `menuCommand` is enabled when something in the responder chain can perform it right now, and chooses the
same responder a shortcut would: opening a menu never takes focus from the window you were working in. Menus
own their shortcuts, as in AppKit — a command item's `shortcut` is shown and bound. Keyboard: Tab reaches
the bar, arrow keys move between menus and items (skipping separators and disabled items), a letter jumps
to an item, Enter chooses, Escape closes.

## Commands and the responder chain

Some commands name no target — Copy, Close, Find. They go to whoever is responsible, the way AppKit's
responder chain works: the focused element, then its window, then the stage, then the app.

```tsx
function RideList() {
  const [selection, setSelection] = useState<Ride[]>([])
  // Inside a window this answers when that window is key.
  useCommand('edit.copy', () => copyRides(selection), { enabled: selection.length > 0 })
  …
}

const perform = usePerform()        // perform('edit.copy') → true if something handled it
const canPerform = useCanPerform()  // what a menu asks before drawing the item enabled
useShortcuts(KEYMAP)                // { 'mod+c': 'edit.copy', 'mod+shift+z': 'edit.redo' }
```

The chain is the DOM: commands travel as events that bubble from the focused element, so there is no second
tree to keep in step. The first responder that implements a command decides — if it is disabled, the
command stops there. `mod` means ⌘ on Apple devices and Ctrl elsewhere; a shortcut nothing handles leaves
the browser's default alone. The desk answers `DeskCommands` (close, float or tile, tile all, next and
previous window) at the stage, and any window can override them.

## The core has no React in it

`createDesk()` returns a plain object. Anything can drive it — a router, a tour, a keyboard shortcut, a
test:

```ts
const { open, focus, close, float, tile, toggleMode, tileAll, closeAll, subscribe, getState } = createDesk()
```

State is immutable. `windows` is the order windows were opened, which is the order tiles are laid out,
so focusing never reshuffles them. `stack` is back to front; `focusedId(state)` is its last entry.

## Links and Back

```ts
import { syncWithLocation } from '@liberation-data/desk'

const stop = syncWithLocation(desk, () => stageSize(), { isKnown: id => id in SURFACES })
```

The hash carries which windows are open, which float, and which has focus — `#w=notes,clock~&f=clock` —
but never positions: a shared link opens the same things, not someone else's layout on a different
screen. Opening or closing a window pushes a history entry, so Back closes it; focus and mode changes
replace the entry. Other hash parameters are left alone.

## Theming

Every value in `desk.css` reads a `--desk-*` custom property. Redefine the tokens; don't override the
selectors. Light and dark follow `prefers-color-scheme`, and `data-theme="light|dark"` on the root wins.

## Develop

```bash
npm install
npm test            # vitest
npm run typecheck
npm run example     # the Garage sample in examples/garage
npm run build       # dist/
```

## Licence

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
