import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="form-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />
}

export function DateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" type="date" {...props} />
}

export function SelectInput({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input" {...props}>{children}</select>
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input textarea" {...props} />
}

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <div className="search-input"><span>⌕</span><input aria-label="Search" {...props} /></div>
}

