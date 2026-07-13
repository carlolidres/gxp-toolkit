import { describe, expect, it } from 'vitest'

import { parseToastMessage } from './formatToastMessage'

describe('parseToastMessage', () => {
  it('parses comma-separated required field lists', () => {
    const result = parseToastMessage(
      'Doc Tracer #, Equipment/Product, Category required.',
    )
    expect(result).toEqual({
      variant: 'fieldList',
      summary: '3 required fields missing',
      fields: ['Doc Tracer #', 'Equipment/Product', 'Category'],
    })
  })

  it('keeps single-field required messages plain', () => {
    expect(parseToastMessage('Document Tracer Number is required.')).toEqual({
      variant: 'plain',
      text: 'Document Tracer Number is required.',
    })
  })

  it('keeps generic messages plain', () => {
    expect(parseToastMessage('Document routing record saved successfully.')).toEqual({
      variant: 'plain',
      text: 'Document routing record saved successfully.',
    })
  })
})
