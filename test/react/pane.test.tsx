// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Button, InfoTip, Page, Pane, PaneHeader, Section, Toolbar } from '../../src/react/index.js'

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

describe('PaneHeader', () => {
  it('puts the title and its actions on one row', () => {
    render(<Pane header={<PaneHeader title="Keys and connections" actions={<Button>Refresh</Button>} />}><p>body</p></Pane>)
    const row = document.querySelector('.desk-pane-header > .desk-pane-title')
    expect(row?.querySelector('h2')?.textContent).toBe('Keys and connections')
    expect(row?.querySelector('.desk-pane-title-actions')?.textContent).toBe('Refresh')
  })

  it('has no actions container when it was given none', () => {
    render(<PaneHeader title="Session" />)
    expect(document.querySelector('.desk-pane-title-actions')).toBeNull()
  })
})

describe('a padded pane', () => {
  it('marks only the body as padded, and only when asked', () => {
    render(<Pane label="Settings" padded><p>body</p></Pane>)
    expect(screen.getByRole('region', { name: 'Settings' }).hasAttribute('data-padded')).toBe(true)
    cleanup()
    render(<Pane label="Log"><p>a line</p></Pane>)
    expect(screen.getByRole('region', { name: 'Log' }).hasAttribute('data-padded')).toBe(false)
  })
})

describe('Section', () => {
  it('is a region named by its title, with actions on the title row', () => {
    render(<Section title="Handlers" actions={<Button>Add</Button>}><p>none yet</p></Section>)
    const section = screen.getByRole('region', { name: 'Handlers' })
    expect(section.querySelector('.desk-section-head .desk-section-actions')?.textContent).toBe('Add')
    expect(section.textContent).toContain('none yet')
  })
})

describe('Page', () => {
  it('is an article named by its label, holding the text it was given', () => {
    render(<Page label="Field guide"><p>Follow the birds at dusk.</p></Page>)
    const page = screen.getByRole('article', { name: 'Field guide' })
    expect(page.classList.contains('desk-page')).toBe(true)
    expect(page.textContent).toBe('Follow the birds at dusk.')
  })

  it('fills the room it is given only when asked', () => {
    render(<Page fill><p>a line</p></Page>)
    expect(screen.getByRole('article').hasAttribute('data-fill')).toBe(true)
    cleanup()
    render(<Page><p>a line</p></Page>)
    expect(screen.getByRole('article').hasAttribute('data-fill')).toBe(false)
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

describe('a pane that is being watched', () => {
  it('hands over the scrolling element, so a log can chase its own tail', () => {
    let body: HTMLDivElement | null = null
    const scrolled: number[] = []
    render(
      <Pane label="Log" bodyRef={el => { body = el }} onScroll={event => scrolled.push(event.currentTarget.scrollTop)}>
        <p>a line</p>
      </Pane>,
    )
    expect(body).toBe(screen.getByRole('region', { name: 'Log' }))
    fireEvent.scroll(screen.getByRole('region', { name: 'Log' }))
    expect(scrolled).toHaveLength(1)
  })
})
