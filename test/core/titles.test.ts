import { describe, expect, it } from 'vitest'
import { isTitleCase, titleCase } from '../../src/core/index.js'

describe('titleCase', () => {
  it('capitalises each word of a name', () => {
    expect(titleCase('service history')).toBe('Service History')
    expect(titleCase('route planner')).toBe('Route Planner')
  })

  it('keeps short joining words lower case, except at either end', () => {
    expect(titleCase('parts & wear')).toBe('Parts & Wear')
    expect(titleCase('the state of the world')).toBe('The State of the World')
    expect(titleCase('what to')).toBe('What To')
  })

  it('capitalises each part of a hyphenated word', () => {
    expect(titleCase('cash-flow board')).toBe('Cash-Flow Board')
  })

  it('leaves words someone cased on purpose', () => {
    expect(titleCase('macOS setup for iPhone')).toBe('macOS Setup for iPhone')
    expect(titleCase('API keys')).toBe('API Keys')
  })

  it('says whether a name is already in title case', () => {
    expect(isTitleCase('Ride Card')).toBe(true)
    expect(isTitleCase('Ride card')).toBe(false)
  })
})
