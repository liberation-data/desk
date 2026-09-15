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
npm run example     # the sample app in examples/basic
npm run build       # dist/
```

## Licence

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
