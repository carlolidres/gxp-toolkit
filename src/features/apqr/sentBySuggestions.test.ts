import { afterEach, describe, expect, it } from 'vitest'

import { mergeSentBySuggestions, readSentBySuggestions, rememberSentBy } from './sentBySuggestions'

const STORAGE_KEY = 'apqr-sent-by-suggestions'

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY)
})

describe('sentBySuggestions', () => {
  it('remembers and merges unique sender names with recent-first ordering', () => {
    rememberSentBy('Carl')
    rememberSentBy('Carlo Lidres')

    expect(readSentBySuggestions()).toEqual(['Carlo Lidres', 'Carl'])
    expect(mergeSentBySuggestions(['Carl', 'Alex'])).toEqual(['Carlo Lidres', 'Carl', 'Alex'])
  })
})
