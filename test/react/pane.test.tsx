// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Button, InfoTip, Pane, Toolbar } from '../../src/react/index.js'

afterEach(cleanup)

describe('Pane', () => {
  it('keeps the header and footer out of the part that scrolls', () => {
    render(
      <Pane label="Log" header={<Toolbar label="Log controls"><Button>Pause</Button></Toolbar>} footer={<p>200 lines</p>}>
        <p>a line</p>
      </Pane>,
    )
    const scroller = screen.getByRole('region', { name: 'Log' })
    expect(scroller.textContent).toBe('a line')
    expect(scroller.querySelector('button')).toBeNull()
    expect(document.querySelector('.desk-pane-footer')?.textContent).toBe('200 lines')
  })

  it('is reachable by the keyboard when it is named, so it can be scrolled without a pointer', () => {
    render(<Pane label="Log"><p>a line</p></Pane>)
    expect(screen.getByRole('region', { name: 'Log' }).tabIndex).toBe(0)
  })

  it('has no header, footer or named region when it was given none', () => {
    render(<Pane><p>a line</p></Pane>)
    expect(document.querySelector('.desk-pane-header')).toBeNull()
    expect(document.querySelector('.desk-pane-footer')).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })
})

describe('Toolbar', () => {
  it('names the row and puts trailing items at the end', () => {
    render(
      <Toolbar label="Log controls" trailing={<Button>Refresh</Button>}>
        <input aria-label="Filter" className="desk-grow" />
      </Toolbar>,
    )
    const row = screen.getByRole('group', { name: 'Log controls' })
    expect(row.querySelector('.desk-toolbar-trailing')?.textContent).toBe('Refresh')
    expect(row.querySelector('.desk-grow')).toBeTruthy()
  })

  it('is not a group when it has no name to give one', () => {
    render(<Toolbar><Button>Pause</Button></Toolbar>)
    expect(screen.queryByRole('group')).toBeNull()
  })
})

describe('InfoTip', () => {
  it('explains when asked, and says nothing until then', () => {
    render(<InfoTip label="About these logs"><p>This process only.</p></InfoTip>)
    expect(screen.queryByText('This process only.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'About these logs' }))
    expect(screen.getByRole('dialog', { name: 'About these logs' }).textContent).toBe('This process only.')
  })

  it('closes on Escape', () => {
    render(<InfoTip label="About these logs"><p>This process only.</p></InfoTip>)
    fireEvent.click(screen.getByRole('button', { name: 'About these logs' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
