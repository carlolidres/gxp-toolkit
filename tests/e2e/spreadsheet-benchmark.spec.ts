import { mkdirSync, writeFileSync } from 'node:fs'

import { expect, test, type Page } from '@playwright/test'

type Stat = { n: number; median: number; p95: number }
type Benchmark = {
  size: 'small' | 'medium' | 'large'
  samples: number
  loadMs: Stat
  domCells: number
  domNodes: number
  jsHeap: { used: number; total: number } | null
  selectionMs: Stat
  selectionCommits: Stat
  editMs: Stat
  pasteMs: Stat
  formulaMs: Stat
  undoMs: Stat
  redoMs: Stat
  sheetSwitchMs: Stat
  saveMs: Stat
  reloadMs: Stat
  verticalFrameMs: Stat
  horizontalFrameMs: Stat
  verticalLongTasks: { count: number; max: number }
  horizontalLongTasks: { count: number; max: number }
  scrollCommits: number
  layoutShiftCount: number | null
}

const results: Benchmark[] = []

function stat(samples: number[]): Stat {
  const sorted = [...samples].sort((a, b) => a - b)
  const pick = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))]
  return {
    n: sorted.length,
    median: Math.round(pick(0.5) * 100) / 100,
    p95: Math.round(pick(0.95) * 100) / 100,
  }
}

async function signIn(page: Page) {
  await page.goto('/#/login')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByLabel('Email').fill('admin@example.com')
  await page.locator('input[name="password"]').fill('password')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
}

async function openSized(page: Page, size: Benchmark['size']) {
  await page.evaluate(() => localStorage.removeItem('gxp.cpv.product-profile.v1'))
  const started = Date.now()
  await page.goto(`/?sheetSize=${size}#/cpv/products/ZZ-SHEET-FIXTURE/profile/raw-material`)
  await expect(page.locator('.eq-gtoolbar')).toBeVisible()
  await expect(page.locator('.eq-cell.is-active .eq-cell-value')).toHaveText('2')
  return Date.now() - started
}

test.afterAll(() => {
  mkdirSync('test-results', { recursive: true })
  writeFileSync('test-results/spreadsheet-benchmark.json', JSON.stringify(results, null, 2))
})

for (const size of ['small', 'medium', 'large'] as const) {
  test(`browser baseline ${size}`, async ({ page }) => {
    test.setTimeout(size === 'large' ? 180_000 : 120_000)
    const repeats = size === 'small' ? 5 : 3
    await signIn(page)
    const loads = [await openSized(page, size)]
    for (let index = 1; index < repeats; index += 1) loads.push(await openSized(page, size))

    const snapshot = await page.evaluate(() => {
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
      return {
        domCells: document.querySelectorAll('.eq-cell').length,
        domNodes: document.getElementsByTagName('*').length,
        jsHeap: memory ? { used: memory.usedJSHeapSize, total: memory.totalJSHeapSize } : null,
      }
    })

    const selectionMs: number[] = []
    const selectionCommits: number[] = []
    for (let index = 0; index < repeats; index += 1) {
      const sample = await page.evaluate(async () => {
        const cells = [...document.querySelectorAll<HTMLElement>('.eq-cell')]
        const target = cells.find((cell) => !cell.classList.contains('is-active'))
        if (!target) return { ms: -1, commits: 0 }
        const probe = window as Window & { __sheetCommits?: number }
        const before = probe.__sheetCommits ?? 0
        const start = performance.now()
        target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, buttons: 1 }))
        const deadline = start + 2000
        while (!target.classList.contains('is-active') && performance.now() < deadline) {
          await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        }
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        return { ms: target.classList.contains('is-active') ? performance.now() - start : -1, commits: (probe.__sheetCommits ?? 0) - before }
      })
      expect(sample.ms).toBeGreaterThanOrEqual(0)
      selectionMs.push(sample.ms)
      selectionCommits.push(sample.commits)
    }

    const editMs: number[] = []
    for (let index = 0; index < repeats; index += 1) {
      const ms = await page.evaluate(async (value) => {
        const input = document.querySelector<HTMLInputElement>('.eq-formula-input')
        if (!input) return -1
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        const start = performance.now()
        setter?.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        const deadline = start + 2000
        while (performance.now() < deadline) {
          const active = document.querySelector('.eq-cell.is-active .eq-cell-value')
          if (active?.textContent === value) return performance.now() - start
          await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        }
        return -1
      }, `E${index}`)
      expect(ms).toBeGreaterThanOrEqual(0)
      editMs.push(ms)
    }

    const pasteMs: number[] = []
    for (let index = 0; index < repeats; index += 1) {
      const ms = await page.evaluate(async (marker) => {
        const grid = document.querySelector('.eq-grid')
        if (!grid) return -1
        const data = new DataTransfer()
        data.setData('text/plain', `${marker}\t${marker}b`)
        const start = performance.now()
        grid.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }))
        const deadline = start + 2000
        while (performance.now() < deadline) {
          if ([...document.querySelectorAll('.eq-cell-value')].some((node) => node.textContent === marker)) return performance.now() - start
          await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        }
        return -1
      }, `P${index}`)
      expect(ms).toBeGreaterThanOrEqual(0)
      pasteMs.push(ms)
    }

    const formulaMs: number[] = []
    for (let index = 0; index < repeats; index += 1) {
      const ms = await page.evaluate(async (next) => {
        const name = document.querySelector<HTMLInputElement>('.eq-namebox')
        if (!name) return -1
        name.focus()
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        setter?.call(name, 'A1')
        name.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        const input = document.querySelector<HTMLInputElement>('.eq-formula-input')
        if (!input) return -1
        setter?.call(input, next)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        const start = performance.now()
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        const expected = String(Number(next) + 3)
        const deadline = start + 2000
        while (performance.now() < deadline) {
          const sum = document.querySelector('[data-address="2:0"] .eq-cell-value')
          if (sum?.textContent === expected) return performance.now() - start
          await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        }
        return -1
      }, String(10 + index))
      expect(ms).toBeGreaterThanOrEqual(0)
      formulaMs.push(ms)
    }

    const undoMs: number[] = []
    const redoMs: number[] = []
    for (let index = 0; index < repeats; index += 1) {
      const pair = await page.evaluate(async () => {
        const grid = document.querySelector<HTMLElement>('.eq-grid')
        if (!grid) return { undo: -1, redo: -1 }
        grid.focus()
        const before = document.querySelector('.eq-cell.is-active .eq-cell-value')?.textContent ?? ''
        const startUndo = performance.now()
        grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
        const deadline = startUndo + 2000
        let undo = -1
        while (performance.now() < deadline) {
          const current = document.querySelector('.eq-cell.is-active .eq-cell-value')?.textContent ?? ''
          if (current !== before) {
            undo = performance.now() - startUndo
            break
          }
          await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        }
        const startRedo = performance.now()
        grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }))
        const redoDeadline = startRedo + 2000
        let redo = -1
        while (performance.now() < redoDeadline) {
          const current = document.querySelector('.eq-cell.is-active .eq-cell-value')?.textContent ?? ''
          if (current === before) {
            redo = performance.now() - startRedo
            break
          }
          await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        }
        return { undo, redo }
      })
      expect(pair.undo).toBeGreaterThanOrEqual(0)
      expect(pair.redo).toBeGreaterThanOrEqual(0)
      undoMs.push(pair.undo)
      redoMs.push(pair.redo)
    }

    const sheetSwitchMs: number[] = []
    for (let index = 0; index < repeats; index += 1) {
      const ms = await page.evaluate(async (target) => {
        const tab = [...document.querySelectorAll<HTMLElement>('.eq-tab')].find((node) => node.textContent?.trim() === target)
        if (!tab) return -1
        const start = performance.now()
        tab.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        const deadline = start + 2000
        while (performance.now() < deadline) {
          if (tab.classList.contains('is-active')) return performance.now() - start
          await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        }
        return -1
      }, index % 2 === 0 ? 'Notes' : 'Data')
      expect(ms).toBeGreaterThanOrEqual(0)
      sheetSwitchMs.push(ms)
    }

    const saveMs: number[] = []
    for (let index = 0; index < repeats; index += 1) {
      const ms = await page.evaluate(async (value) => {
        const input = document.querySelector<HTMLInputElement>('.eq-formula-input')
        const label = document.querySelector('.eq-save-state')
        if (!input || !label) return -1
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        const start = performance.now()
        setter?.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        const deadline = start + 3000
        let sawSaving = false
        while (performance.now() < deadline) {
          if (label.textContent === 'Saving…') sawSaving = true
          if (sawSaving && label.textContent === 'Saved') return performance.now() - start
          await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        }
        return -1
      }, `S${index}`)
      expect(ms).toBeGreaterThanOrEqual(0)
      saveMs.push(ms)
    }

    const reloadStarted = Date.now()
    await page.reload()
    await expect(page.locator('.eq-gtoolbar')).toBeVisible()
    const reloadMs = [Date.now() - reloadStarted]
    for (let index = 1; index < Math.min(repeats, 3); index += 1) {
      const started = Date.now()
      await page.reload()
      await expect(page.locator('.eq-gtoolbar')).toBeVisible()
      reloadMs.push(Date.now() - started)
    }

    const scroll = await page.evaluate(async () => {
      async function burst(deltaX: number, deltaY: number) {
        const frames: number[] = []
        const longTasks: number[] = []
        let shifts: number | null = 0
        let shiftObserver: PerformanceObserver | null = null
        let taskObserver: PerformanceObserver | null = null
        try {
          taskObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) longTasks.push(entry.duration)
          })
          taskObserver.observe({ entryTypes: ['longtask'] })
        } catch {
          taskObserver = null
        }
        try {
          shiftObserver = new PerformanceObserver((list) => {
            shifts = (shifts ?? 0) + list.getEntries().length
          })
          shiftObserver.observe({ type: 'layout-shift', buffered: false })
        } catch {
          shifts = null
        }
        const probe = window as Window & { __sheetCommits?: number }
        const before = probe.__sheetCommits ?? 0
        let running = true
        let last = performance.now()
        const tick = (now: number) => {
          frames.push(now - last)
          last = now
          if (running) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        const grid = document.querySelector('.eq-grid')
        if (!grid) return { frames, longTasks, commits: 0, shifts }
        for (let step = 0; step < 20; step += 1) {
          grid.dispatchEvent(new WheelEvent('wheel', { deltaX, deltaY, bubbles: true, cancelable: true }))
          await new Promise((resolve) => setTimeout(resolve, 16))
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
        running = false
        taskObserver?.disconnect()
        shiftObserver?.disconnect()
        return { frames, longTasks, commits: (probe.__sheetCommits ?? 0) - before, shifts }
      }
      const vertical = await burst(0, 240)
      const horizontal = await burst(240, 0)
      return { vertical, horizontal }
    })

    const longStat = (durations: number[]) => ({
      count: durations.length,
      max: durations.length ? Math.round(Math.max(...durations) * 100) / 100 : 0,
    })

    results.push({
      size,
      samples: repeats,
      loadMs: stat(loads),
      domCells: snapshot.domCells,
      domNodes: snapshot.domNodes,
      jsHeap: snapshot.jsHeap,
      selectionMs: stat(selectionMs),
      selectionCommits: stat(selectionCommits),
      editMs: stat(editMs),
      pasteMs: stat(pasteMs),
      formulaMs: stat(formulaMs),
      undoMs: stat(undoMs),
      redoMs: stat(redoMs),
      sheetSwitchMs: stat(sheetSwitchMs),
      saveMs: stat(saveMs),
      reloadMs: stat(reloadMs),
      verticalFrameMs: stat(scroll.vertical.frames),
      horizontalFrameMs: stat(scroll.horizontal.frames),
      verticalLongTasks: longStat(scroll.vertical.longTasks),
      horizontalLongTasks: longStat(scroll.horizontal.longTasks),
      scrollCommits: scroll.vertical.commits + scroll.horizontal.commits,
      layoutShiftCount: scroll.vertical.shifts == null && scroll.horizontal.shifts == null
        ? null
        : (scroll.vertical.shifts ?? 0) + (scroll.horizontal.shifts ?? 0),
    })
  })
}
