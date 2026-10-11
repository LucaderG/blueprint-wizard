import { useId } from 'react'

interface ChoiceChipsProps<T extends string> {
  label: string
  value: T | null
  options: readonly T[]
  optionLabel: (option: T) => string
  disabled: boolean
  /** Erneutes Antippen hebt die Wahl auf, wenn `allowClear` gesetzt ist. */
  allowClear?: boolean
  onChange: (value: T | null) => void
}

/** Einfachauswahl als antippbare Chips (Radio-Gruppe). */
export function ChoiceChips<T extends string>({
  label,
  value,
  options,
  optionLabel,
  disabled,
  allowClear = false,
  onChange,
}: ChoiceChipsProps<T>) {
  const name = useId()
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = value === option
          return (
            <label
              key={option}
              className="cursor-pointer rounded-full border border-border px-3 py-1 text-sm hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary has-[:disabled]:cursor-default has-[:disabled]:opacity-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={checked}
                onChange={() => onChange(option)}
                onClick={() => allowClear && checked && onChange(null)}
                className="sr-only"
              />
              {optionLabel(option)}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
