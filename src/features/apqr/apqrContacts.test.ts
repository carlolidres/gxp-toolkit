import { describe, expect, it } from 'vitest'

import { formatContactsPlainText, parseContacts, serializeContacts } from './apqrContacts'

describe('apqrContacts', () => {
  it('serializes and parses structured contact entries', () => {
    const raw = serializeContacts([
      { name: 'Jane Doe', title: 'QA Manager', email: 'jane@example.com' },
      { name: 'John Smith', title: 'QA Specialist', email: 'john@example.com' },
    ])

    expect(parseContacts(raw)).toEqual([
      { name: 'Jane Doe', title: 'QA Manager', email: 'jane@example.com' },
      { name: 'John Smith', title: 'QA Specialist', email: 'john@example.com' },
    ])
  })

  it('parses legacy free-text contacts into editable entries', () => {
    const legacy =
      'HAZEL LYNNE MAY PAYLAGO Quality Assurance Manager hazellynnemay.paylago@menariniapac.com'

    expect(parseContacts(legacy)).toEqual([
      {
        name: 'HAZEL LYNNE MAY PAYLAGO Quality Assurance Manager',
        title: '',
        email: 'hazellynnemay.paylago@menariniapac.com',
      },
    ])
  })

  it('parses legacy multi-contact technical blobs into separate entries', () => {
    const legacy =
      'Abhilash Thomas External Supply Operations Quality Abhilash.Thomas@pfizer.com Poonam Goda QS & OS Associate - ESQ Poonam.Goda@pfizer.com'

    expect(parseContacts(legacy)).toEqual([
      {
        name: 'Abhilash Thomas External Supply Operations Quality',
        title: '',
        email: 'Abhilash.Thomas@pfizer.com',
      },
      {
        name: 'Poonam Goda QS & OS Associate - ESQ',
        title: '',
        email: 'Poonam.Goda@pfizer.com',
      },
    ])
  })

  it('formats structured contacts for export', () => {
    const raw = serializeContacts([{ name: 'A', title: 'B', email: 'a@b.com' }])
    expect(formatContactsPlainText(raw)).toBe('A | B | a@b.com')
  })
})
