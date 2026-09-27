// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Tabs } from '../../src/react/index.js'

afterEach(cleanup)

type View = 'rides' | 'bikes' | 'parts' | 'service'

const TABS = [
  { value: 'rides', label: 'Rides', badge: 12 },
  { value: 'bikes', label: 'Bikes' },
  { value: 'parts', label: 'Parts', disabled: true },
  { value: 'service', label: 'Service' },
] as const

function Garage({ initial = 'rides' }: { initial?: View }) {
  const [view, setView] = useState<View>(initial)
  return (
    <Tabs<View> label="Garage" tabs={TABS} value={view} onChange={setView}>
      <p>Showing {view}</p>
    </Tabs>
  )
}

describe('Tabs', () => {
  it('names the strip and marks the selected tab', () => {
    render(<Garage />)
    expect(screen.getByRole('tablist', { name: 'Garage' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Rides/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Bikes' }).getAttribute('aria-selected')).toBe('false')
  })

  it('shows the selected view in a panel the selected tab names', () => {
    render(<Garage initial="bikes" />)
    const panel = screen.getByRole('tabpanel', { name: 'Bikes' })
    expect(panel.textContent).toBe('Showing bikes')
    expect(screen.getByRole('tab', { name: 'Bikes' }).getAttribute('aria-controls')).toBe(panel.id)
  })

  it('switches view on click', async () => {
    render(<Garage />)
    await userEvent.click(screen.getByRole('tab', { name: 'Service' }))
    expect(screen.getByRole('tabpanel').textContent).toBe('Showing service')
  })

  it('is one tab stop', () => {
    render(<Garage />)
    const stops = screen.getAllByRole('tab').filter(t => t.tabIndex === 0)
    expect(stops.map(t => t.dataset.value)).toEqual(['rides'])
  })

  it('moves with the arrow keys, past a disabled tab, and wraps', async () => {
    render(<Garage initial="bikes" />)
    screen.getByRole('tab', { name: 'Bikes' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement?.getAttribute('data-value')).toBe('service')
    expect(screen.getByRole('tabpanel').textContent).toBe('Showing service')
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement?.getAttribute('data-value')).toBe('rides')
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement?.getAttribute('data-value')).toBe('service')
  })

  it('jumps to the ends with Home and End', async () => {
    render(<Garage initial="bikes" />)
    screen.getByRole('tab', { name: 'Bikes' }).focus()
    await userEvent.keyboard('{End}')
    expect(document.activeElement?.getAttribute('data-value')).toBe('service')
    await userEvent.keyboard('{Home}')
    expect(document.activeElement?.getAttribute('data-value')).toBe('rides')
  })

  it('does not select a disabled tab on click', async () => {
    render(<Garage />)
    await userEvent.click(screen.getByRole('tab', { name: 'Parts' }))
    expect(screen.getByRole('tabpanel').textContent).toBe('Showing rides')
  })

  it('puts actions at the end of the strip, outside the tablist', async () => {
    const onRefresh = vi.fn()
    render(
      <Tabs label="Garage" tabs={TABS} value="rides" onChange={() => {}}
            actions={<button type="button" onClick={onRefresh}>Refresh</button>}>
        <p>Showing rides</p>
      </Tabs>,
    )
    const refresh = screen.getByRole('button', { name: 'Refresh' })
    expect(screen.getByRole('tablist').contains(refresh)).toBe(false)
    expect(screen.getByRole('tabpanel').contains(refresh)).toBe(false)
    await userEvent.click(refresh)
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('shows a badge beside the label', () => {
    render(<Garage />)
    expect(screen.getByRole('tab', { name: /Rides/ }).querySelector('.desk-tab-badge')?.textContent).toBe('12')
  })
})
