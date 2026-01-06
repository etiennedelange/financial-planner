import type { Page, Locator } from '@playwright/test'
import path from 'path'
import fs from 'fs'

/**
 * ScreenshotHelper - Utility for consistent screenshot capture and organization
 *
 * Features:
 * - Automatic numbering (01-name.png, 02-name.png, ...)
 * - Organized by journey
 * - Full-page or element-specific captures
 * - Chart rendering detection
 */
export class ScreenshotHelper {
  private screenshotCounter = 0
  private journeyName: string
  private screenshots: Array<{ filename: string; description: string }> = []

  constructor(private page: Page, journeyName: string) {
    this.journeyName = journeyName
    this.ensureDirectoryExists()
  }

  /**
   * Capture screenshot with automatic numbering and naming
   *
   * @param name - Descriptive name for the screenshot (will be slugified)
   * @param options - Screenshot options
   * @returns Screenshot metadata
   */
  async capture(
    name: string,
    options?: {
      fullPage?: boolean
      description?: string
    }
  ) {
    this.screenshotCounter++
    const paddedNumber = String(this.screenshotCounter).padStart(2, '0')
    const filename = `${paddedNumber}-${this.slugify(name)}.png`
    const filepath = this.getScreenshotPath(filename)

    await this.page.screenshot({
      path: filepath,
      fullPage: options?.fullPage ?? false,
    })

    // Track for potential report generation
    this.screenshots.push({
      filename,
      description: options?.description || name,
    })

    return { filename, filepath, number: this.screenshotCounter }
  }

  /**
   * Capture specific element by selector
   *
   * @param selector - CSS selector or Playwright locator
   * @param name - Descriptive name
   */
  async captureElement(selector: string | Locator, name: string) {
    this.screenshotCounter++
    const paddedNumber = String(this.screenshotCounter).padStart(2, '0')
    const filename = `${paddedNumber}-${this.slugify(name)}.png`
    const filepath = this.getScreenshotPath(filename)

    const element = typeof selector === 'string' ? this.page.locator(selector) : selector
    await element.screenshot({ path: filepath })

    this.screenshots.push({ filename, description: name })

    return { filename, filepath, number: this.screenshotCounter }
  }

  /**
   * Wait for Recharts to render before capturing
   * Recharts uses SVG rendering with animations
   */
  async waitForCharts(timeoutMs = 5000) {
    // Wait for at least one chart to be present
    await this.page.waitForSelector('svg.recharts-surface', {
      timeout: timeoutMs,
      state: 'visible',
    })

    // Wait for animation to settle
    await this.page.waitForTimeout(500)
  }

  /**
   * Wait for Monte Carlo simulation to complete
   * The simulation is debounced by 300ms
   */
  async waitForMonteCarloSimulation(timeoutMs = 5000) {
    // Wait for success rate indicator
    await this.page.waitForSelector('text=Success Rate', {
      timeout: timeoutMs,
      state: 'visible',
    })

    // Wait for simulation to complete
    await this.page.waitForTimeout(500)
  }

  /**
   * Wait for tab navigation animation
   */
  async waitForTabTransition() {
    await this.page.waitForTimeout(300)
  }

  /**
   * Wait for dialog/modal animation
   */
  async waitForDialogAnimation() {
    await this.page.waitForTimeout(300)
  }

  /**
   * Get all screenshots captured in this journey
   */
  getScreenshots() {
    return this.screenshots
  }

  /**
   * Reset counter (for new test)
   */
  reset() {
    this.screenshotCounter = 0
    this.screenshots = []
  }

  /**
   * Get screenshot path
   */
  private getScreenshotPath(filename: string): string {
    return path.join(
      process.cwd(),
      'e2e/output/screenshots',
      this.journeyName,
      filename
    )
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectoryExists() {
    const dir = path.join(process.cwd(), 'e2e/output/screenshots', this.journeyName)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  /**
   * Slugify name for filesystem
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
}
