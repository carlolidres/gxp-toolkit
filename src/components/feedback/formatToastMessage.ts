export type ToastMessageModel =
  | { variant: 'plain'; text: string }
  | { variant: 'fieldList'; summary: string; fields: string[] }

/** Split comma-separated "Field A, Field B required." into a compact summary. */
export function parseToastMessage(text: string): ToastMessageModel {
  const trimmed = text.trim()
  const fieldListMatch = /^(.+) required\.$/.exec(trimmed)
  if (fieldListMatch?.[1]?.includes(',')) {
    const fields = fieldListMatch[1]
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean)
    if (fields.length > 1) {
      return {
        variant: 'fieldList',
        summary: `${fields.length} required fields missing`,
        fields,
      }
    }
  }
  return { variant: 'plain', text: trimmed }
}
