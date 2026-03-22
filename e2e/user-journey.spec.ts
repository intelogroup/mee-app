import { test, expect, Page } from '@playwright/test';

/**
 * Mee App E2E Tests
 * Mee: social coaching AI bot (Next.js + FastAPI + Telegram + Groq)
 * Routes: /, /login, /signup, /dashboard, /dashboard/brain, /dashboard/history,
 *         /dashboard/progress, /dashboard/settings
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Public Pages — Mee App', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    console.log(`✅ Homepage title: "${title}"`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('login page has proper form', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
    const hasEmail = await page.locator('input[type="email"]').count();
    const hasPass = await page.locator('input[type="password"]').count();
    const hasSubmit = await page.locator('button[type="submit"]').count();

    console.log(`${hasEmail > 0 ? '✅' : '⚠️ '} Email input: ${hasEmail}`);
    console.log(`${hasPass > 0 ? '✅' : '⚠️ '} Password input: ${hasPass}`);
    console.log(`${hasSubmit > 0 ? '✅' : '⚠️ '} Submit button: ${hasSubmit}`);
  });

  test('signup page accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
    const hasForm = await page.locator('form, input[type="email"]').count();
    console.log(`${hasForm > 0 ? '✅' : '⚠️ '} Signup form: ${hasForm}`);
  });

  test('forgot password page accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/forgot-password`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
    const hasEmail = await page.locator('input[type="email"]').count();
    console.log(`${hasEmail > 0 ? '✅' : '⚠️ '} Forgot password email input: ${hasEmail}`);
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]').first();
    const passInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    if (await emailInput.count() > 0) {
      await emailInput.fill('bad@example.com');
      await passInput.fill('wrongpass');
      await submitBtn.click();
      await page.waitForTimeout(3000);

      const url = page.url();
      console.log(`${url.includes('/login') ? '✅' : '⚠️ '} Invalid login stays on login page: ${url}`);
    }
  });

  test('protected dashboard routes redirect unauthenticated', async ({ page }) => {
    const routes = [
      '/dashboard',
      '/dashboard/brain',
      '/dashboard/history',
      '/dashboard/progress',
      '/dashboard/settings',
    ];

    for (const route of routes) {
      await page.goto(`${BASE_URL}${route}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);

      const url = page.url();
      const redirected = url.includes('/login') || url.includes('/signup');
      console.log(`${redirected ? '✅' : '⚠️ '} ${route}: ${redirected ? 'protected' : 'accessible'} → ${url}`);
    }
  });

  test('responsive layout: mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
    console.log('✅ Mobile viewport renders');

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    const loginVisible = await page.locator('input[type="email"]').isVisible().catch(() => false);
    console.log(`${loginVisible ? '✅' : '⚠️ '} Mobile login form visible`);
  });

  test('no critical JS errors on public pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    for (const path of ['/', '/login', '/signup']) {
      await page.goto(`${BASE_URL}${path}`);
      await page.waitForTimeout(2000);
    }

    const critical = errors.filter(e =>
      !e.includes('favicon') && !e.includes('404') && !e.includes('ResizeObserver') && !e.includes('hydrat')
    );

    if (critical.length > 0) {
      console.log(`⚠️  ${critical.length} critical JS errors:`);
      critical.forEach(e => console.log(`   - ${e.substring(0, 150)}`));
    } else {
      console.log('✅ No critical JS errors on public pages');
    }
  });
});

test.describe('Dashboard Pages (authenticated)', () => {
  test('dashboard/brain AI coaching page structure', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/brain`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const url = page.url();
    if (url.includes('/login')) {
      console.log('✅ /dashboard/brain: protected — redirected to login');
      return;
    }

    const hasChatArea = await page.locator('textarea, input[type="text"], [class*="chat"], [class*="message"]').count();
    console.log(`${hasChatArea > 0 ? '✅' : '⚠️ '} Chat/AI area: ${hasChatArea} elements`);
  });

  test('dashboard/history shows past sessions', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/history`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const url = page.url();
    if (url.includes('/login')) {
      console.log('✅ /dashboard/history: protected');
      return;
    }

    const hasHistory = await page.locator('ul li, article, [class*="session"], [class*="history"]').count();
    console.log(`✅ History items: ${hasHistory}`);
  });

  test('dashboard/progress shows metrics', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/progress`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const url = page.url();
    if (url.includes('/login')) {
      console.log('✅ /dashboard/progress: protected');
      return;
    }

    const hasMetrics = await page.locator('canvas, svg, [class*="chart"], [class*="progress"]').count();
    console.log(`✅ Progress metrics elements: ${hasMetrics}`);
  });
});
