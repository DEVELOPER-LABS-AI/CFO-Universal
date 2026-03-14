import { test, expect } from '@playwright/test'

const PRODUCTION_URL = 'https://devlabs-cfo-v2.vercel.app'

test.describe('Vercel Deployment - Working', () => {
  test('should redirect root page to login', async ({ page }) => {
    const response = await page.goto(PRODUCTION_URL, { waitUntil: 'domcontentloaded' })

    console.log('Status Code:', response?.status())
    console.log('Final URL:', page.url())

    // Root should redirect to /login
    expect(page.url()).toContain('/login')
  })

  test('should load health endpoint successfully', async ({ page }) => {
    const response = await page.goto(`${PRODUCTION_URL}/api/health`, { waitUntil: 'domcontentloaded' })

    console.log('Health Check Status:', response?.status())

    const content = await page.content()
    console.log('Health Response:', content)

    expect(response?.status()).toBe(200)
    expect(content).toContain('API is working')
  })

  test('should load login page', async ({ page }) => {
    const response = await page.goto(`${PRODUCTION_URL}/login`, { waitUntil: 'domcontentloaded' })

    console.log('Login Page Status:', response?.status())
    console.log('Login Page URL:', response?.url())

    expect(response?.status()).toBe(200)
    expect(page.url()).toContain('/login')
  })

  test('should have working Next.js', async ({ page }) => {
    await page.goto(`${PRODUCTION_URL}/login`)

    // Check for Next.js hydration
    const title = await page.title()
    console.log('Page title:', title)

    expect(title).toBe('DevLabs CFO')
  })
})
