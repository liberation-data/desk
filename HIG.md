# desk Human Interface Guidelines

How an app built with desk should look, feel and behave. The structure and many of the principles follow
Apple's Human Interface Guidelines, restated for the web and for this toolkit; where the web differs —
links, the back button, no system menu bar, every kind of input on one page — the rule here is our own.

Each rule says what to do, why, and which token or component carries it. A rule the toolkit can enforce,
it enforces; the rest are for the people building on it.

> Draft. Sections marked **Open** need a decision before the components they govern are built.

---

## 1. Principles

**Content leads.** The desk exists so people can do their work in it. Chrome — title bars, the dock, menus —
is quiet, translucent and small, and never competes with a window's content for attention.

**Clarity over cleverness.** Text is legible at every size, icons are recognisable without a tooltip, and a
control looks like what it does. When in doubt, use a word rather than an icon.

**Depth means something.** Layering is information: a floating window is above the tiles because it was
asked to be; a popover is above its window because it belongs to that moment. Never add shadow, blur or
elevation for decoration.

**Consistency.** The same action has the same name, place and shortcut everywhere. A person who learns one
window has learnt the controls of all of them.

**Direct manipulation.** Move a window by dragging it, not by typing coordinates. Show the result of an
action immediately, where it happened.

**Feedback.** Every action gets a visible response within 100 ms. Anything that takes longer says it is
working, and anything that takes more than a few seconds says how far it has got.

**People stay in control.** Nothing opens, closes, moves or plays without being asked. Destructive actions
can be undone, or ask first — never both, and never neither.

**Forgiveness.** Undo is the default safety net. Confirmation dialogs are for what cannot be undone.

---

## 2. Foundations

### Layout and spacing

- Spacing comes from one scale: **4, 8, 12, 16, 24, 32, 48** px (`--desk-space-1` … `--desk-space-7`).
  Nothing else. Two values close together on a screen should be the same value.
- Group with space before lines. Use a rule (`--desk-rule`) only when space alone cannot separate two groups.
- Siblings are laid out with `gap`, not margins.
- Running text is at most **68 characters** wide.
- Keep **16 px** clear at the edges of every window body.

### Typography

- One family for interface text: the system font (`--desk-font`). A second, monospaced family
  (`--desk-font-mono`) for code, identifiers and aligned figures. No display faces inside the desk.
- Type scale, in px: **11 · 12 · 13 · 15 · 17 · 22 · 28**.
  - 13 is body text in windows, the default.
  - 11 is the smallest size anywhere, and is for labels and captions only.
  - 17 titles a section; 22 and 28 title an empty state or a sheet. A window title is 13, semibold.
- Weights: regular (400), medium (500) for emphasis in running text, semibold (600) for titles. Bold (700)
  only for badges and figures that must read at a glance.
- Uppercase is for short labels only, with +0.06–0.09 em letter-spacing. Never for sentences.
- Numbers that line up use tabular figures.

### Colour

Colour has **roles**, not names. Components use roles; a theme assigns colours to them.

| Role | Token | Use |
|---|---|---|
| Ground | `--desk-ground` | behind the windows |
| Surface | `--desk-surface` | a window's body |
| Chrome | `--desk-titlebar` | title bars, bars inside windows |
| Ink | `--desk-ink` | primary text and icons |
| Muted | `--desk-muted` | secondary text, inactive titles |
| Rule | `--desk-rule` | separators, borders |
| Accent | `--desk-accent` | the one colour that means "you can act here" or "this is selected" |
| Status | `--desk-ok`, `--desk-warn`, `--desk-bad` | state: good, needs attention, broken |

- **One accent per app.** It marks the default button, the selection, focus and the key window. Using it for
  decoration spends it.
- **Status colours are not the accent** and never replace it. A red badge means something is wrong or
  waiting, not "look here".
- **Never use colour alone.** Pair a status colour with a word, an icon or a shape.
- Text contrast is at least **4.5:1** against its background; large text and icons at least **3:1**. Both
  themes, every state.
- Light and dark are designed separately, not inverted. Each follows the system setting unless the person
  chose one.

### Materials

- **Translucent glass** (`--desk-dock-glass`, backdrop blur) is for things that float over content: the dock,
  stacks, menus, popovers. It shows that the content is still there underneath.
- **Opaque surfaces** are for things people read and work in: window bodies, sheets, tables.
- Never put body text directly on glass without a surface behind it. A panel that carries labels — a stack,
  a menu — sits on an opaque surface, so a busy window underneath never reads through its words.

### Motion

- Motion explains a change of place or state: a stack fans out *from* the dock, a window zooms *from* where
  it opened. It never loops, bounces or plays for attention.
- Durations: **120 ms** for small feedback (hover, press), **180–240 ms** for things appearing, **300 ms**
  at most for a window. One easing curve: `--desk-ease`.
- When the person has asked for reduced motion, remove movement and keep only fades of 120 ms or less.

### Icons

- One stroke icon set, **1.7 px** stroke at 24 px, rounded caps and joins. Filled variants only for
  selected states.
- An icon in a toolbar or dock has a label available — a tooltip on pointer devices and an accessible name
  for everyone.
- Don't invent an icon for an abstract idea. Use a word.

### Accessibility

- Everything that can be done with a pointer can be done with a keyboard.
- Every interactive element has a visible focus ring (`--desk-accent`, 2 px, offset 2 px).
- Every control has an accessible name. An icon-only button carries `aria-label`.
- Touch targets are at least **44 × 44 px**, even when the visible control is smaller.
- Nothing depends on hover alone.
- Respect the person's settings: colour scheme, reduced motion, text size.

### Writing

- Name things the way people who use the app name them, not the way the code does.
- Buttons say what happens: **Delete ride**, not **OK**. A confirmation repeats the verb.
- Sentence case for everything — titles, buttons, menu items.
- Errors say what went wrong and what to do next. No apologies, no blame, no codes on their own.
- Empty states say what goes here and how to add the first one.
- Use an ellipsis (…) on a command only when it asks for more before acting.

---

## 3. Windows

### What a window is

A window is one task or one thing: a list of rides, a map, a conversation. If two things are always used
together, they are one window; if people want them side by side, they are two.

### The key window

- Exactly one window has focus — the **key window**. It has an accent-tinted border, coloured controls and a
  full-contrast title. Other windows have muted titles and grey controls.
- Keyboard input, menu commands and typed input go to the key window first (see §5).
- Pressing anywhere in a window makes it key. Pressing a control in a background window also performs that
  control's action.

### Arrangement on pointer devices

Nobody has to arrange windows, and nobody is stopped from arranging them.

1. The first window fills the stage.
2. The second splits it: two tiles side by side.
3. Every window after that **floats** above the tiles, cascading down and right from the last, and wraps
   back to the top-left before it can leave the stage. It never opens exactly on top of another window.
4. **An arrangement is placed once, not held.** When a person moves or resizes one arranged window, every
   window becomes independent where it sits and only the one they touched changes. Nothing reflows into the
   space — the way arranged windows behave on a Mac.
5. Dragging a window against the left or right edge gives it that half of the desk, with a preview of where
   it will land. Double-clicking a title bar, or pressing the green control, zooms the window to fill the
   desk and back.
6. Once windows have been placed by hand, a new window opens floating rather than tiling in behind them.
   **Tile all** hands the layout back to the desk.
7. Tiles keep the order they were opened in. Focusing a window never reshuffles anything.

**A window that is floated again goes back where it last was**, not to the next step of the cascade, unless
that place no longer lands on this screen.

### Arrangement on touch devices

On a device whose primary input is touch — a tablet or a phone — **one window is shown at a time** and fills
the stage.

- The dock stays visible and is how people switch.
- Other open windows stay open and keep their state; they are hidden, not closed.
- There is no floating or tiling, and the float control is not shown. Close remains.
- A tablet with a trackpad or mouse attached uses the pointer arrangement.
- Links and history are the same on every device: a link opens the same windows everywhere, shown one at a
  time on touch.

### Title bars

- Controls are on the leading side: **close**, then **float/tile**. Title follows.
- A title is the name of the thing, not the app: **Dandenongs loop**, not **Garage — Map**.
- A title bar may hold at most one or two window-wide actions on its trailing side. Anything more belongs
  in a toolbar inside the window.

### Opening and closing

- Opening a window that is already open brings it forward. There is never a second copy of the same window.
- Closing a window discards its unsaved state only after asking, or keeps a draft. Prefer the draft.
- Back closes the last window opened, because opening a window is navigation.

---

## 4. Dock

- The dock holds **what people return to**: the few windows used most, stacks for the rest, then pins.
  Order: core windows, a separator, stacks, a separator, pins.
- A **dot** under an item means its window is open. The accent dot means it is the key window.
- A **badge** counts things waiting for the person — due, unread, failed. It is a number or a single mark,
  never a word. If nothing is waiting, there is no badge; a badge showing 0 is a bug.
- A **stack** groups related windows. Its name is a plain noun (**Plan**, **Garage**). Its icon previews its
  contents. A stack holds 3–8 items; fewer is a pin, more needs rethinking.
- The dock is one tab stop. Arrow keys move along it; Enter opens; Escape folds a stack away.
- Magnification on hover is for pointer devices only.

---

## 5. Menus and commands

### Commands go to whoever is responsible

Some commands name no target: Copy, Undo, Find, Close, Select All, and text typed into the desk's input bar.
They are delivered along the **responder chain**:

1. the focused element,
2. its ancestors, up to its window,
3. the key window,
4. the desk,
5. the app.

The first responder that handles a command consumes it. A command nobody handles does nothing — and its menu
item was already disabled, because menus ask the same chain whether a command can be handled before they
open.

### Menus

- Menu items are commands. Sentence case, a verb first where it fits.
- An unavailable command is **disabled**, not hidden, so people learn where it lives.
- Group related items; separate groups with a rule. At most seven or so items per group.
- Show the keyboard shortcut on the trailing side.
- A checkmark shows a state that the item toggles.
- Context menus hold commands for the thing under the pointer and duplicate commands found elsewhere.
  Never put a command only in a context menu.

### Standard shortcuts

Use the platform's modifier (⌘ on Apple devices, Ctrl elsewhere). Don't reassign these:

| Command | Shortcut |
|---|---|
| Search the desk | ⌘K |
| Settings | ⌘, |
| Close window | ⌘W — but the browser owns it; offer it inside the app only when installed as an app |
| Undo / Redo | ⌘Z / ⇧⌘Z |
| Copy / Cut / Paste / Select all | ⌘C / ⌘X / ⌘V / ⌘A |
| Find in window | ⌘F |
| Next window | ⌘\` |

**Shortcuts the browser owns** — ⌘W, ⌘T, ⌘N, ⌘` and the number keys — are the browser's while the app runs
in a tab, and taking them there breaks what people expect of every other tab. An app **installed** to the
dock or home screen has the window to itself, and may take ⌘W for "close window" and ⌘\` for "next window".
`isInstalledApp()` reports which case this is; bind those two only when it is true, and never take ⌘T or ⌘N
at all.

---

## 6. Controls

### Buttons

- One **default** button per view, in the accent. It is the action people most likely want, and Return
  performs it.
- **Cancel** sits before the default button; Escape performs it.
- **Destructive** buttons use the bad colour and are never the default.
- A button's label is a verb or verb phrase.

### Text input

- Every field has a visible label. A placeholder is an example, never the label.
- Validate when a person leaves a field or submits, not on every keystroke — except to lift an error they
  are fixing.
- Put the error beside the field, in words that say how to fix it.

### Selection

- Two to five mutually exclusive options that are all worth seeing: a **segmented control**.
- More, or options that need explaining: a **pop-up menu** or a list of radio choices.
- An on/off setting that takes effect immediately: a **toggle**. One that waits for Save: a **checkbox**.

### Lists and tables

- A list row has one primary line and at most one secondary line.
- The row's main action happens on press. Secondary actions appear on hover *and* in a context menu *and* via
  keyboard — never on hover alone.
- Empty lists show an empty state, not a blank.

---

## 7. Feedback and interruption

From least to most interrupting — use the least that works:

| Pattern | When |
|---|---|
| **Inline** | the result belongs next to what caused it: a saved tick, a field error |
| **Badge** | something is waiting, and the person will come to it |
| **Toast** | a background action finished; it disappears on its own and offers Undo |
| **Popover** | a small task tied to one control; dismissed by pressing outside |
| **Sheet** | a task that belongs to one window and blocks only that window |
| **Alert** | the whole app cannot continue until the person decides; rare |

- Progress: a spinner for under ~3 seconds, a determinate bar for longer, and a way to cancel for anything
  that can run long.
- Never interrupt with an alert for something that could be a badge.

---

## 8. Inputs

### Keyboard

- Tab moves between groups; arrow keys move within a group (the dock, a toolbar, a segmented control, a list).
- Escape dismisses the topmost transient thing: a menu, a stack, a popover, a sheet — in that order.
- Return performs the default button.

### Pointer

- Use Pointer Events so mouse, pen and touch share one code path.
- Anything draggable shows a grab cursor on hover and a grabbing cursor while dragged.
- Tooltips appear after a short delay and never contain the only copy of information.

### Touch

- Targets are at least 44 × 44 px; extend the hit area invisibly if the drawn control is smaller.
- There is no hover. Everything hover reveals must also be reachable by tap or long-press.
- Long-press opens a context menu.
- Dragging surfaces set `touch-action` so the page does not scroll underneath them.
- See §3 for the one-window-at-a-time arrangement.

---

## 9. Checklist for a new component

- [ ] Uses only tokens for colour, space, type, radius and motion.
- [ ] Works in light and dark, with 4.5:1 text contrast in both.
- [ ] Fully usable by keyboard, with a visible focus ring.
- [ ] Has an accessible name and the right role.
- [ ] 44 × 44 px touch target; nothing hover-only.
- [ ] Respects reduced motion.
- [ ] Copy follows §2 Writing.
- [ ] Has tests for its behaviour and a place in a sample app.
