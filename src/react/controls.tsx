import { forwardRef, useEffect, useId, useRef } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, KeyboardEvent, ReactNode } from 'react'

/*
 * Controls carry their own behaviour and accessibility; their look comes only
 * from tokens. They take few style props on purpose — consistency comes from
 * not being able to deviate. See HIG.md §6.
 */

export type ButtonIntent = 'normal' | 'default' | 'quiet' | 'destructive'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `default` is the one action a view leads with, and the one Return performs. One per view. */
  readonly intent?: ButtonIntent
  readonly size?: 'regular' | 'small'
  /** Before the label. Decorative: an icon-only button still needs `aria-label`. */
  readonly icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { intent = 'normal', size = 'regular', icon, children, type = 'button', className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={['desk-button', className].filter(Boolean).join(' ')}
      data-intent={intent}
      data-size={size}
      data-icon-only={!children || undefined}
      {...rest}
    >
      {icon && <span className="desk-button-icon" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  )
})

export interface SegmentedOption<T extends string> {
  readonly value: T
  readonly label: string
  readonly icon?: ReactNode
  readonly disabled?: boolean
}

export interface SegmentedControlProps<T extends string> {
  /** Two to five options, all worth seeing at once. More than that wants a pop-up menu. */
  readonly options: readonly SegmentedOption<T>[]
  readonly value: T
  readonly onChange: (value: T) => void
  /** The accessible name for the group, e.g. "Filter rides by bike". */
  readonly label: string
  readonly size?: 'regular' | 'small'
  readonly disabled?: boolean
}

export function SegmentedControl<T extends string>({ options, value, onChange, label, size = 'regular', disabled }: SegmentedControlProps<T>) {
  const group = useRef<HTMLDivElement>(null)

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as const
    const delta = keys[event.key as keyof typeof keys]
    const usable = options.filter(o => !o.disabled)
    if (!delta || !usable.length) return
    event.preventDefault()
    const at = usable.findIndex(o => o.value === value)
    const next = usable[(at + delta + usable.length) % usable.length]
    if (!next) return
    onChange(next.value)
    // Selection follows focus here, as it does in a segmented control on any platform.
    group.current?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus()
  }

  return (
    <div ref={group} role="radiogroup" aria-label={label} className="desk-segmented" data-size={size} onKeyDown={move}>
      {options.map(option => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-value={option.value}
            className="desk-segment"
            tabIndex={selected ? 0 : -1}
            disabled={disabled || option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.icon && <span className="desk-segment-icon" aria-hidden="true">{option.icon}</span>}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export interface ToggleProps {
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
  /** Shown beside the switch. Use `label` alone, or `aria-label` when the context already names it. */
  readonly label?: ReactNode
  readonly description?: ReactNode
  readonly disabled?: boolean
  readonly 'aria-label'?: string
}

/** For a setting that takes effect immediately. One that waits for Save is a checkbox. */
export function Toggle({ checked, onChange, label, description, disabled, 'aria-label': ariaLabel }: ToggleProps) {
  const id = useId()
  const descriptionId = description ? `${id}-description` : undefined
  const control = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-describedby={descriptionId}
      className="desk-toggle"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="desk-toggle-knob" aria-hidden="true" />
    </button>
  )
  if (!label && !description) return control
  return (
    <div className="desk-toggle-row">
      <span className="desk-toggle-text">
        {label && <label htmlFor={id} className="desk-label">{label}</label>}
        {description && <span id={descriptionId} className="desk-help">{description}</span>}
      </span>
      {control}
    </div>
  )
}

export interface CheckboxProps {
  readonly checked: boolean
  /** Some of the things this stands for are checked, and some are not. */
  readonly indeterminate?: boolean
  readonly onChange: (checked: boolean) => void
  readonly label?: ReactNode
  readonly description?: ReactNode
  readonly disabled?: boolean
  readonly 'aria-label'?: string
}

/** For a setting that waits for Save. One that applies at once is a Toggle. */
export function Checkbox({ checked, indeterminate, onChange, label, description, disabled, 'aria-label': ariaLabel }: CheckboxProps) {
  const id = useId()
  const descriptionId = description ? `${id}-description` : undefined
  const box = useRef<HTMLInputElement>(null)
  // Indeterminate is a property, not an attribute: it cannot be set in markup.
  useEffect(() => {
    if (box.current) box.current.indeterminate = indeterminate ?? false
  }, [indeterminate])

  const input = (
    <input
      ref={box}
      id={id}
      type="checkbox"
      className="desk-checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={descriptionId}
      onChange={event => onChange(event.target.checked)}
    />
  )
  if (!label && !description) return input
  return (
    <div className="desk-check-row">
      {input}
      <span className="desk-check-text">
        {label && <label htmlFor={id} className="desk-check-label">{label}</label>}
        {description && <span id={descriptionId} className="desk-help">{description}</span>}
      </span>
    </div>
  )
}

export interface SliderProps {
  readonly value: number
  readonly onChange: (value: number) => void
  readonly label: string
  readonly min?: number
  readonly max?: number
  readonly step?: number
  readonly disabled?: boolean
  /** How the value reads to a person: `v => \`${v} psi\``. Shown beside the label and announced. */
  readonly format?: (value: number) => string
}

export function Slider({ value, onChange, label, min = 0, max = 100, step = 1, disabled, format }: SliderProps) {
  const id = useId()
  const shown = format ? format(value) : String(value)
  return (
    <div className="desk-slider">
      <div className="desk-slider-head">
        <label htmlFor={id} className="desk-label">{label}</label>
        <output htmlFor={id} className="desk-slider-value">{shown}</output>
      </div>
      <input
        id={id}
        type="range"
        className="desk-slider-track"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={format ? shown : undefined}
        onChange={event => onChange(Number(event.target.value))}
      />
    </div>
  )
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> {
  /** Every field has a label. A placeholder is an example, never the label. */
  readonly label: string
  /** Keep the label for assistive technology, hide it on screen — for a search field in a toolbar. */
  readonly labelHidden?: boolean
  readonly help?: ReactNode
  /** What went wrong and how to fix it. Its presence marks the field invalid. */
  readonly error?: ReactNode
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, labelHidden, help, error, type = 'text', ...rest },
  ref,
) {
  const id = useId()
  const helpId = help ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className="desk-field" data-invalid={error ? true : undefined}>
      <label htmlFor={id} className="desk-label" data-hidden={labelHidden || undefined}>
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        type={type}
        className="desk-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={[errorId, helpId].filter(Boolean).join(' ') || undefined}
        {...rest}
      />
      {error && <span id={errorId} className="desk-error">{error}</span>}
      {help && !error && <span id={helpId} className="desk-help">{help}</span>}
    </div>
  )
})
