import { describe, expect, it } from 'vitest'

import {
  AUTH_CAROUSEL_INTERVAL_MS,
  AUTH_CAROUSEL_SLIDES,
} from './authCarouselSlides'

describe('authCarouselSlides', () => {
  it('provides five GxP-themed slides within the 5–7s interval band', () => {
    expect(AUTH_CAROUSEL_SLIDES).toHaveLength(5)
    expect(AUTH_CAROUSEL_INTERVAL_MS).toBeGreaterThanOrEqual(5000)
    expect(AUTH_CAROUSEL_INTERVAL_MS).toBeLessThanOrEqual(7000)
  })

  it('exposes local WebP and JPEG assets for each slide', () => {
    for (const slide of AUTH_CAROUSEL_SLIDES) {
      expect(slide.title.trim().length).toBeGreaterThan(8)
      expect(slide.srcWebp).toMatch(/auth-carousel\/.+\.webp$/)
      expect(slide.srcJpeg).toMatch(/auth-carousel\/.+\.jpg$/)
    }
  })
})
