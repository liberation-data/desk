import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

/*
 * A pop-up button: what a segmented control becomes once there are too many
 * options to show at once, or the options need explaining. It is a form control,
 * not a menu — so, unlike a menu, it takes focus while it is open.
 */

export interface PopUpOption<T extends string> {
  readonly value: T
  readonly label: string
  readonly description?: string
  readonly icon?: ReactNode
  readonly disabled?: boolean
}

export interface PopUpButtonProps<T extends string> {
  readonly value: T | null
  readonly onChange: (value: T) => void
  readonly options: readonly PopUpOption<T>[]
  readonly label: string
  /** Hides the label on screen but keeps it for assistive technology. */
  readonly labelHidden?: boolean
  readonly placeholder?: string
  readonly disabled?: boolean
  readonly size?: 'regular' | 'small'
}

export function PopUpButton<T extends string>({
  value,
  onChange,
  options,
  label,
  labelHidden,
  placeholder = 'Choose…',
  disabled,
  size = 'regular',
}: PopUpButtonProps<T>) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', at: 0 })

  const selectable = options.filter(o => !o.disabled)
  const selected = options.find(o => o.value === value) ?? null

  const show = (from: 'first' | 'selected' = 'selected') => {
    const start = from === 'selected' && selected ? options.indexOf(selected) : options.findIndex(o => !o.disabled)
    setActive(Math.max(0, start))
    setOpen(true)
  }

  const close = (returnFocus = true) => {
    setOpen(false)
    if (returnFocus) button.current?.focus()
  }

  const choose = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    close()
  }

  useEffect(() => {
    if (!open) return
    list.current?.focus()
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!list.current?.contains(target) && !button.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open])

  const step = (from: number, delta: 1 | -1) => {
    for (let i = 1; i <= options.length; i++) {
      const index = (from + delta * i + options.length * 2) % options.length
      if (!options[index]?.disabled) return index
    }
    return from
  }

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    switch (event.key) {
      case 'ArrowDown': setActive(step(active, 1)); break
      case 'ArrowUp': setActive(step(active, -1)); break
      case 'Home': setActive(step(-1, 1)); break
      case 'End': setActive(step(options.length, -1)); break
      case 'Enter':
      case ' ': choose(active); break
      case 'Escape':
      case 'Tab': close(); break
      default: {
        if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return
        // Typeahead: letters typed close together look for a word, a single letter cycles.
        const now = Date.now()
        typed.current = { text: now - typed.current.at < 800 ? typed.current.text + event.key : event.key, at: now }
        const search = typed.current.text.toLowerCase()
        const found = selectable.find(o => o.label.toLowerCase().startsWith(search))
        if (found) setActive(options.indexOf(found))
        break
      }
    }
    event.preventDefault()
  }

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      show(event.key === 'ArrowDown' ? 'selected' : 'selected')
    }
  }

  return (
    <div className="desk-field" data-popup>
      <span id={`${id}-label`} className="desk-label" data-hidden={labelHidden || undefined}>
        {label}
      </span>
      <div className="desk-popup-anchor">
        <button
          ref={button}
          type="button"
          className="desk-popup-button"
          data-size={size}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${id}-label ${id}-value`}
          disabled={disabled}
          onKeyDown={onButtonKeyDown}
          onClick={() => (open ? close(false) : show())}
        >
          {selected?.icon && <span className="desk-popup-icon" aria-hidden="true">{selected.icon}</span>}
          <span id={`${id}-value`} className="desk-popup-value" data-placeholder={!selected || undefined}>
            {selected?.label ?? placeholder}
          </span>
          <span className="desk-popup-chevron" aria-hidden="true">⌄</span>
        </button>
        {open && (
          <ul
            ref={list}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={`${id}-label`}
            aria-activedescendant={options[active] ? `${id}-option-${active}` : undefined}
            className="desk-popup-list"
            onKeyDown={onListKeyDown}
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                className="desk-popup-option"
                data-active={index === active || undefined}
                onPointerMove={() => !option.disabled && setActive(index)}
                onClick={() => choose(index)}
              >
                <span className="desk-popup-check" aria-hidden="true">{option.value === value ? '✓' : ''}</span>
                <span className="desk-popup-text">
                  <span>{option.label}</span>
                  {option.description && <span className="desk-help">{option.description}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
