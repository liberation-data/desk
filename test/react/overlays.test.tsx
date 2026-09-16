// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDesk } from '../../src/core/index.js'
import { Alert, Button, Desktop, DeskProvider, Popover, Sheet, TextField, ToastProvider, useToast } from '../../src/react/index.js'

afterEach(cleanup)

describe('Popover', () => {
  function Harness() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button type="button">Before</button>
        <Popover
          open={open}
          onOpenChange={setOpen}
          label="Ride filters"
          trigger={props => <Button {...props}>Filters</Button>}
        >
          <TextField label="Longer than" defaultValue="50" />
        </Popover>
      </>
    )
  }

  it('opens from its trigger and says so', () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Filters' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Ride filters' })).toBeTruthy()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('moves focus in, and gives it back when it closes', () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Filters' })
    act(() => trigger.focus())
    fireEvent.click(trigger)
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Longer than' }))
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes when the pointer goes down outside', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Before' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps Tab inside while it is open', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    const field = screen.getByRole('textbox', { name: 'Longer than' })
    await user.tab()
    expect(document.activeElement).toBe(field)
  })
})

describe('Sheet', () => {
  function Harness({ onDismiss = () => {} }: { readonly onDismiss?: () => void }) {
    const desk = createDesk()
    desk.open('rides')
    return (
      <DeskProvider desk={desk}>
        <Desktop
          title={id => id}
          renderWindow={() => (
            <>
              <button type="button">In the window</button>
              <Sheet
                open
                onDismiss={onDismiss}
                title="Export rides"
                description="Choose what the file holds."
                actions={<Button intent="default">Export</Button>}
              >
                <TextField label="File name" defaultValue="rides.csv" />
              </Sheet>
            </>
          )}
        />
      </DeskProvider>
    )
  }

  it('is a modal dialog inside its own window, not over the whole app', () => {
    render(<Harness />)
    const sheet = screen.getByRole('dialog', { name: 'Export rides' })
    expect(sheet.getAttribute('aria-modal')).toBe('true')
    expect(sheet.closest('[data-desk-window="rides"]')).toBeTruthy()
  })

  it('takes focus and dismisses on Escape', () => {
    const onDismiss = vi.fn()
    render(<Harness onDismiss={onDismiss} />)
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'File name' }))
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('shows its actions', () => {
    render(<Harness />)
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Export' })).toBeTruthy()
  })
})

describe('Alert', () => {
  const setup = (destructive = true) => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <Alert
        open
        title="Delete this ride?"
        message="Deleting a ride cannot be undone."
        confirmLabel="Delete ride"
        onConfirm={onConfirm}
        onCancel={onCancel}
        destructive={destructive}
      />,
    )
    return { onConfirm, onCancel }
  }

  it('is an alert dialog naming the action in its button', () => {
    setup()
    const alert = screen.getByRole('alertdialog', { name: 'Delete this ride?' })
    expect(alert.getAttribute('aria-modal')).toBe('true')
    expect(within(alert).getByRole('button', { name: 'Delete ride' })).toBeTruthy()
  })

  it('puts Cancel before the action, and a destructive action is not the default', () => {
    setup()
    const buttons = within(screen.getByRole('alertdialog')).getAllByRole('button')
    expect(buttons.map(b => b.textContent)).toEqual(['Cancel', 'Delete ride'])
    expect(buttons[1]?.dataset.intent).toBe('destructive')
  })

  it('cancels on Escape', () => {
    const { onCancel, onConfirm } = setup()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('makes a non-destructive action the default button', () => {
    setup(false)
    const buttons = within(screen.getByRole('alertdialog')).getAllByRole('button')
    expect(buttons[1]?.dataset.intent).toBe('default')
  })
})

describe('Toast', () => {
  function Harness() {
    const toast = useToast()
    const [undone, setUndone] = useState(false)
    return (
      <>
        <Button onClick={() => toast.show({ message: 'Ride deleted', action: { label: 'Undo', onSelect: () => setUndone(true) } })}>
          Delete
        </Button>
        {undone && <p>undone</p>}
      </>
    )
  }
  const mount = () => render(<ToastProvider><Harness /></ToastProvider>)

  it('announces without interrupting, and offers Undo', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const toast = screen.getByRole('status')
    expect(within(toast).getByText('Ride deleted')).toBeTruthy()
    fireEvent.click(within(toast).getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('undone')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('goes away on its own', () => {
    vi.useFakeTimers()
    try {
      mount()
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
      expect(screen.getByRole('status')).toBeTruthy()
      act(() => vi.advanceTimersByTime(6000))
      expect(screen.queryByRole('status')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('waits while the pointer is on it', () => {
    vi.useFakeTimers()
    try {
      mount()
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
      fireEvent.pointerEnter(screen.getByRole('status'))
      act(() => vi.advanceTimersByTime(20000))
      expect(screen.getByRole('status')).toBeTruthy()
      fireEvent.pointerLeave(screen.getByRole('status'))
      act(() => vi.advanceTimersByTime(6000))
      expect(screen.queryByRole('status')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('can be dismissed by hand', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
