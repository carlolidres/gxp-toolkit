import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { GxpLogo } from '../brand/GxpLogo'
import {
  AUTH_CAROUSEL_INTERVAL_MS,
  AUTH_CAROUSEL_SLIDES,
  type AuthCarouselSlide,
} from '../../features/auth/authCarouselSlides'
import './auth-story-carousel.css'

type AuthStoryCarouselProps = {
  slides?: AuthCarouselSlide[]
  intervalMs?: number
  className?: string
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return reduced
}

function preloadSlide(slide: AuthCarouselSlide) {
  const img = new Image()
  img.decoding = 'async'
  img.src = slide.srcWebp
  const fallback = new Image()
  fallback.decoding = 'async'
  fallback.src = slide.srcJpeg
}

export function AuthStoryCarousel({
  slides = AUTH_CAROUSEL_SLIDES,
  intervalMs = AUTH_CAROUSEL_INTERVAL_MS,
  className,
}: AuthStoryCarouselProps) {
  const labelId = useId()
  const reducedMotion = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [failedIds, setFailedIds] = useState<Record<string, true>>({})
  const indexRef = useRef(0)

  const count = slides.length
  const active = slides[index] ?? slides[0]

  useEffect(() => {
    indexRef.current = index
  }, [index])

  // Preload the next slide to avoid blank frames during transitions.
  useEffect(() => {
    if (count < 2) return
    const next = slides[(index + 1) % count]
    if (next) preloadSlide(next)
  }, [count, index, slides])

  // Preload the first slide eagerly.
  useEffect(() => {
    if (slides[0]) preloadSlide(slides[0])
  }, [slides])

  const goTo = useCallback(
    (nextIndex: number) => {
      if (count === 0) return
      setIndex(((nextIndex % count) + count) % count)
    },
    [count],
  )

  useEffect(() => {
    if (reducedMotion || paused || count < 2) return
    const timer = window.setInterval(() => {
      goTo(indexRef.current + 1)
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [count, goTo, intervalMs, paused, reducedMotion])

  if (!active) return null

  return (
    <section
      className={`auth-story-carousel${className ? ` ${className}` : ''}`}
      aria-roledescription="carousel"
      aria-labelledby={labelId}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false)
        }
      }}
    >
      <div className="auth-story-carousel__fallback" aria-hidden />

      <div className="auth-story-carousel__slides">
        {slides.map((slide, slideIndex) => {
          const isActive = slideIndex === index
          const failed = Boolean(failedIds[slide.id])
          return (
            <figure
              key={slide.id}
              className={`auth-story-carousel__slide${isActive ? ' is-active' : ''}${failed ? ' is-fallback' : ''}`}
              aria-hidden={!isActive}
            >
              {!failed ? (
                <picture>
                  <source srcSet={slide.srcWebp} type="image/webp" />
                  <img
                    src={slide.srcJpeg}
                    alt=""
                    className="auth-story-carousel__image"
                    width={1400}
                    height={1050}
                    decoding="async"
                    loading={slideIndex === 0 ? 'eager' : 'lazy'}
                    fetchPriority={slideIndex === 0 ? 'high' : 'auto'}
                    onError={() =>
                      setFailedIds((current) =>
                        current[slide.id] ? current : { ...current, [slide.id]: true },
                      )
                    }
                  />
                </picture>
              ) : null}
              <div className="auth-story-carousel__overlay" aria-hidden />
            </figure>
          )
        })}
      </div>

      <div className="auth-story-carousel__chrome">
        <GxpLogo variant="lockup" showTagline tone="light" className="login-story-brand" />

        <div className="auth-story-carousel__copy">
          <h1 id={labelId} className="auth-story-carousel__title">{active.title}</h1>
          <p className="auth-story-carousel__subtitle">{active.subtitle}</p>
          <span className="sr-only">{active.alt}</span>
        </div>

        <div className="auth-story-carousel__controls">
          <div
            className="auth-story-carousel__dots"
            role="tablist"
            aria-label="Carousel slides"
          >
            {slides.map((slide, slideIndex) => {
              const selected = slideIndex === index
              return (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={`Show slide ${slideIndex + 1}: ${slide.title}`}
                  className={`auth-story-carousel__dot${selected ? ' is-active' : ''}`}
                  onClick={() => goTo(slideIndex)}
                />
              )
            })}
          </div>
          <p className="auth-story-carousel__status" aria-live="polite">
            {index + 1} / {count}
          </p>
        </div>
      </div>
    </section>
  )
}
