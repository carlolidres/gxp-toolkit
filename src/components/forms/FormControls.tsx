import {
  Children,
  isValidElement,
  useMemo,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Input, Select } from 'antd'
import { Eye, EyeOff, Search } from 'lucide-react'

import { AppDateInput } from './AppDateInput'
import { iconSize, iconStroke } from '../../theme/iconSizes'

export function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="form-field ant-form-item-label">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      className={className}
      {...(props as Record<string, unknown>)}
    />
  )
}

export function PasswordInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)

  return (
    <Input.Password
      className={className}
      visibilityToggle={{
        visible,
        onVisibleChange: setVisible,
      }}
      iconRender={(show) =>
        show ? (
          <EyeOff size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
        ) : (
          <Eye size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
        )
      }
      {...(props as Record<string, unknown>)}
    />
  )
}

export function DateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <AppDateInput {...props} />
}

function optionsFromChildren(children: ReactNode): Array<{ label: string; value: string }> {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string; children?: ReactNode }>(child)) return []
    const label = String(child.props.children ?? '')
    const value = child.props.value != null ? String(child.props.value) : label
    return [{ label, value }]
  })
}

export function SelectInput({
  children,
  className,
  value,
  defaultValue,
  onChange,
  name,
  disabled,
  required,
  id,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = useMemo(() => optionsFromChildren(children), [children])
  const resolvedDefault = defaultValue != null ? String(defaultValue) : options[0]?.value
  const isControlled = value != null
  const [internalValue, setInternalValue] = useState(resolvedDefault ?? '')
  const currentValue = isControlled ? String(value) : internalValue

  return (
    <>
      {name ? (
        <input type="hidden" name={name} value={currentValue} required={required} readOnly />
      ) : null}
      <Select
        id={id}
        className={className ? `gxp-select ${className}` : 'gxp-select'}
        style={{ width: '100%' }}
        disabled={disabled}
        value={currentValue || undefined}
        options={options}
        onChange={(next) => {
          if (!isControlled) setInternalValue(next)
          if (!onChange) return
          const synthetic = {
            target: { value: next, name: name ?? '' },
            currentTarget: { value: next, name: name ?? '' },
          } as ChangeEvent<HTMLSelectElement>
          onChange(synthetic)
        }}
        aria-label={props['aria-label']}
      />
    </>
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Input.TextArea
      className={className ? `textarea ${className}` : 'textarea'}
      {...(props as Record<string, unknown>)}
    />
  )
}

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      className={className ? `search-input ${className}` : 'search-input'}
      allowClear
      prefix={<Search size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}
      aria-label={props['aria-label'] ?? 'Search'}
      {...(props as Record<string, unknown>)}
    />
  )
}
