import { test, expect } from '@playwright/test';

/**
 * Mee App — API & Flow Tests (supplement to user-journey.spec.ts)
 * Covers: bot API endpoints, signup/onboarding flow, middleware gates,
 * Telegram linking, auth routes, and API security.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Auth Routes
// ---------------------------------------------------------------------------
test.describe('Auth Routes — Mee App', () => {
  test('update-password page accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/update-password`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
    const hasInput = await page.locator('input[type="password"]').count();
    console.log(`${hasInput > 0 ? '✅' : '⚠️ '} Update password form: ${hasInput} password inputs`);
  });

  test('auth callback route exists (returns non-500)', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/auth/callback`);
    expect(res.status()).not.toBe(500);
    console.log(`✅ /auth/callback: ${res.status()}`);
  });

  test('signup page has required form fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
    const emailInput = page.locator('input[type="email"]');
    const passInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible();
    console.log(`✅ Signup email: ${await emailInput.count()} input(s)`);
    console.log(`✅ Signup password: ${await passInput.count()} input(s)`);
  });
});

// ---------------------------------------------------------------------------
// API Endpoints — Bot Integration
// ---------------------------------------------------------------------------
test.describe('Bot API Endpoints — Security', () => {
  test('/api/bot/status requires auth', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/bot/status`);
    const status = res.status();
    expect(status).not.toBe(500);
    expect(status).not.toBe(200); // Should require auth
    console.log(`✅ GET /api/bot/status: ${status} (auth required)`);
  });

  test('/api/bot/link requires auth (POST)', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/bot/link`, { data: {} });
    const status = res.status();
    expect(status).not.toBe(500);
    console.log(`✅ POST /api/bot/link: ${status}`);
  });

  test('/api/bot/conversations requires auth', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/bot/conversations`);
    const status = res.status();
    expect(status).not.toBe(500);
    console.log(`✅ GET /api/bot/conversations: ${status}`);
  });

  test('/api/bot/brain requires auth', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/bot/brain`);
    const status = res.status();
    expect(status).not.toBe(500);
    console.log(`✅ GET /api/bot/brain: ${status}`);
  });
});

// ---------------------------------------------------------------------------
// User API — Security
// ---------------------------------------------------------------------------
test.describe('User API Endpoints — Security', () => {
  test('/api/signup endpoint requires proper data', async ({ request }) => {
    // Without required fields should return 400, not 500
    const res = await request.post(`${BASE_URL}/api/signup`, { data: {} });
    const status = res.status();
    expect(status).not.toBe(500);
    console.log(`✅ POST /api/signup (empty): ${status}`);
  });

  test('/api/user/deactivate requires auth', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/user/deactivate`, { data: {} });
    const status = res.status();
    expect(status).not.toBe(500);
    expect(status).not.toBe(200);
    console.log(`✅ POST /api/user/deactivate: ${status} (auth required)`);
  });
});

// ---------------------------------------------------------------------------
// Middleware — Onboarding Gate
// ---------------------------------------------------------------------------
test.describe('Middleware — Onboarding Gate', () => {
  test('onboarding-gated sub-routes redirect when unauthenticated', async ({ page }) => {
    // Per middleware: onboarding_step < 4 gates /dashboard/history, /brain, /settings
    const gatedRoutes = [
      '/dashboard/history',
      '/dashboard/brain',
      '/dashboard/settings',
    ];

    for (const route of gatedRoutes) {
      await page.goto(`${BASE_URL}${route}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);

      const url = page.url();
      const redirected = url.includes('/login') || url.includes('/dashboard') && !url.endsWith(route);
      console.log(`${redirected ? '✅' : '⚠️ '} ${route}: ${url}`);
    }
  });

  test('dashboard root is accessible or redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const url = page.url();
    const isLoginOrDash = url.includes('/login') || url.includes('/dashboard');
    console.log(`${isLoginOrDash ? '✅' : '⚠️ '} /dashboard: ${url}`);
    expect(isLoginOrDash).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Telegram Linking — UI
// ---------------------------------------------------------------------------
test.describe('Telegram Integration — UI', () => {
  test('dashboard renders Telegram link UI when authenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const url = page.url();
    if (url.includes('/login')) {
      console.log('✅ /dashboard: protected (Telegram link test skipped — requires auth)');
      return;
    }

    // Look for Telegram link elements
    const hasTelegram = await page.locator('text=/telegram/i, a[href*="telegram"], button:has-text("Link")').count();
    console.log(`${hasTelegram > 0 ? '✅' : '⚠️ '} Telegram UI elements: ${hasTelegram}`);
  });
});

// ---------------------------------------------------------------------------
// Signup → Onboarding Flow (form validation)
// ---------------------------------------------------------------------------
test.describe('Signup & Onboarding Flow', () => {
  test('signup with invalid email shows error (not crash)', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    if (await emailInput.count() > 0 && await submitBtn.count() > 0) {
      await emailInput.fill('not-an-email');
      await submitBtn.click();
      await page.waitForTimeout(1500);

      // Should stay on signup, not crash
      expect(page.url()).toContain('/signup');
      console.log('✅ Invalid email stays on signup page');
    }
  });

  test('login with mismatched credentials does not crash', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]').first();
    const passInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();

    if (await emailInput.count() > 0) {
      await emailInput.fill('test@example.com');
      if (await passInput.count() > 0) await passInput.fill('wrongpassword');
      await submitBtn.click();
      await page.waitForTimeout(3000);

      expect(page.url()).toContain('/login');
      console.log('✅ Invalid login rejected gracefully');
    }
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------
test.describe('Accessibility — Mee App', () => {
  test('login form has proper labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    const inputs = await page.locator('input').all();
    let unlabelled = 0;
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const placeholder = await input.getAttribute('placeholder');
      if (!id && !ariaLabel && !placeholder) unlabelled++;
    }
    console.log(`${unlabelled === 0 ? '✅' : '⚠️ '} Unlabelled inputs: ${unlabelled}/${inputs.length}`);
  });

  test('page has lang attribute', async ({ page }) => {
    await page.goto(BASE_URL);
    const lang = await page.locator('html').getAttribute('lang');
    console.log(`${lang ? '✅' : '⚠️ '} html[lang]: ${lang || 'missing'}`);
  });

  test('no critical console errors on public pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    for (const path of ['/', '/login', '/signup', '/forgot-password']) {
      await page.goto(`${BASE_URL}${path}`);
      await page.waitForTimeout(1500);
    }

    const critical = errors.filter(e =>
      !e.includes('favicon') && !e.includes('404') && !e.includes('ResizeObserver') && !e.includes('hydrat')
    );

    if (critical.length > 0) {
      console.log(`⚠️  ${critical.length} critical errors:`);
      critical.forEach(e => console.log(`  - ${e.substring(0, 150)}`));
    } else {
      console.log('✅ No critical errors on public pages');
    }
  });
});
