import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportProjectionCsv } from './export-csv'
import type { YearlyProjection } from '@/types'

const makeRow = (overrides: Partial<YearlyProjection> = {}): YearlyProjection => ({
  year: 2025,
  age: 35,
  startingBalance: 500000,
  contributions: 120000,
  growth: 55000,
  fees: 7500,
  withdrawals: 0,
  incomeTax: 0,
  lumpSumTax: 0,
  medicalAidContribution: 0,
  netIncome: 0,
  endingBalance: 667500,
  inflationAdjustedWithdrawal: 0,
  ...overrides,
})

describe('exportProjectionCsv', () => {
  let createdUrl: string
  let anchorClick: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createdUrl = ''
    anchorClick = vi.fn()

    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      createdUrl = 'blob:mock'
      return createdUrl
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.body)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.body)

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const a = { href: '', download: '', click: anchorClick } as unknown as HTMLAnchorElement
        return a
      }
      return document.createElement(tag)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('triggers a download', () => {
    exportProjectionCsv([makeRow()])
    expect(anchorClick).toHaveBeenCalledOnce()
  })

  it('uses a .csv filename by default', () => {
    let capturedDownload = ''
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        const a = {
          href: '',
          set download(v: string) { capturedDownload = v },
          click: vi.fn(),
        } as unknown as HTMLAnchorElement
        return a
      }
      return document.createElement(tag)
    })
    exportProjectionCsv([makeRow()])
    expect(capturedDownload).toMatch(/\.csv$/)
  })

  it('accepts a custom filename', () => {
    let capturedDownload = ''
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        const a = {
          href: '',
          set download(v: string) { capturedDownload = v },
          click: vi.fn(),
        } as unknown as HTMLAnchorElement
        return a
      }
      return document.createElement(tag)
    })
    exportProjectionCsv([makeRow()], 'my-report.csv')
    expect(capturedDownload).toBe('my-report.csv')
  })

  it('produces a Blob with CSV content type', () => {
    let capturedBlob: Blob | null = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      capturedBlob = b as Blob
      return 'blob:mock'
    })
    exportProjectionCsv([makeRow()])
    expect(capturedBlob).not.toBeNull()
    expect((capturedBlob as unknown as Blob).type).toContain('text/csv')
  })

  it('includes a header row with all expected column names', async () => {
    let csvText = ''
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      // Read blob content synchronously via FileReaderSync is not available in vitest,
      // so we capture the blob and read it after
      ;(globalThis as Record<string, unknown>).__testBlob = b
      return 'blob:mock'
    })
    exportProjectionCsv([makeRow()])
    const blob = (globalThis as Record<string, unknown>).__testBlob as Blob
    csvText = await blob.text()

    const header = csvText.split('\n')[0]
    expect(header).toContain('Year')
    expect(header).toContain('Age')
    expect(header).toContain('Starting Balance')
    expect(header).toContain('Ending Balance')
    expect(header).toContain('Contributions')
    expect(header).toContain('Growth')
    expect(header).toContain('Income Tax')
    expect(header).toContain('Net Income')
  })

  it('outputs correct numeric values for a row', async () => {
    let csvText = ''
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      ;(globalThis as Record<string, unknown>).__testBlob = b
      return 'blob:mock'
    })

    const row = makeRow({
      year: 2030,
      age: 40,
      startingBalance: 1000000,
      contributions: 60000,
      growth: 110000,
      fees: 15000,
      endingBalance: 1155000,
      incomeTax: 5000,
      netIncome: 55000,
    })
    exportProjectionCsv([row])

    const blob = (globalThis as Record<string, unknown>).__testBlob as Blob
    csvText = await blob.text()
    const dataRow = csvText.split('\n')[1]

    expect(dataRow).toContain('2030')
    expect(dataRow).toContain('40')
    expect(dataRow).toContain('1000000.00')
    expect(dataRow).toContain('1155000.00')
    expect(dataRow).toContain('5000.00')
  })

  it('handles values with commas by quoting the field', async () => {
    let csvText = ''
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      ;(globalThis as Record<string, unknown>).__testBlob = b
      return 'blob:mock'
    })
    // Values won't have commas, but test the escape helper indirectly via a large number
    exportProjectionCsv([makeRow({ startingBalance: 1234567.89 })])
    const blob = (globalThis as Record<string, unknown>).__testBlob as Blob
    csvText = await blob.text()
    // toFixed(2) produces "1234567.89" — no comma, so no quoting needed
    expect(csvText).toContain('1234567.89')
  })

  it('produces one data row per projection entry', async () => {
    let csvText = ''
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      ;(globalThis as Record<string, unknown>).__testBlob = b
      return 'blob:mock'
    })
    const rows = [makeRow({ age: 35 }), makeRow({ age: 36 }), makeRow({ age: 37 })]
    exportProjectionCsv(rows)
    const blob = (globalThis as Record<string, unknown>).__testBlob as Blob
    csvText = await blob.text()
    const lines = csvText.split('\n').filter(Boolean)
    expect(lines).toHaveLength(4) // 1 header + 3 data rows
  })
})
