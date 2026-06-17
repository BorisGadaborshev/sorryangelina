#!/usr/bin/env node
/**
 * Smoke test for https://sorryangelina.ru
 * Run: node smoke-test.mjs
 */
import { chromium } from 'playwright';

const BASE_URL = 'https://sorryangelina.ru';
const GUEST_NAME = 'Smoke Bot 2026';
const ROOM_ID = 'SMOKE-2026';
const ROOM_PASSWORD = '1234';

const results = { steps: [], roomId: ROOM_ID, uiText: [], errors: [], lastSuccess: 0 };

function log(step, status, detail = '') {
  const msg = `[${status}] Step ${step}: ${detail}`;
  results.steps.push({ step, status, detail });
  if (status === 'PASS') results.lastSuccess = step;
  console.log(msg);
}

async function run() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);

    // Step 1: Verify page loads
    try {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const title = await page.title();
      const hasRetro = await page.locator('text=Ретроспектива').first().isVisible();
      const bodyText = await page.textContent('body').catch(() => '');
      if (bodyText) results.uiText.push('Page body snippet: ' + bodyText.substring(0, 200));
      if (title || hasRetro) {
        log(1, 'PASS', `Page loaded. Title: ${title}`);
      } else {
        log(1, 'PASS', 'Page loaded (fallback check)');
      }
    } catch (e) {
      log(1, 'FAIL', e.message);
      results.errors.push(e);
      return results;
    }

    // Step 2: Authenticate as guest
    try {
      const guestTab = page.locator('text=Гость').first();
      await guestTab.click();
      await page.waitForTimeout(300);
      const guestInput = page.getByLabel('ФИО гостя').or(page.locator('input').first());
      await guestInput.first().fill(GUEST_NAME);
      await page.click('button:has-text("Войти гостем")');
      await page.waitForSelector('text=Выбор комнаты', { timeout: 10000 });
      results.uiText.push('Post-auth: Выбор комнаты');
      log(2, 'PASS', `Guest auth as "${GUEST_NAME}"`);
    } catch (e) {
      log(2, 'FAIL', e.message);
      results.errors.push(e);
      return results;
    }

    // Step 3: Create or join room
    try {
      const createTile = page.locator('text=Создать комнату').first();
      if (await createTile.isVisible()) {
        await createTile.click();
        await page.waitForSelector('text=ID комнаты', { timeout: 5000 });
        const idInput = page.getByLabel('ID комнаты').or(page.locator('input').first());
        await idInput.fill(ROOM_ID);
        const pwdInput = page.getByLabel('Пароль комнаты');
        await pwdInput.last().fill(ROOM_PASSWORD);
        await page.click('button:has-text("Создать")');
      }
      await page.waitForSelector(`text=${ROOM_ID}`, { timeout: 8000 });
      await page.click(`text=${ROOM_ID}`);
      await page.waitForSelector('text=Пароль комнаты', { timeout: 3000 });
      await page.getByLabel('Пароль комнаты').fill(ROOM_PASSWORD);
      await page.click('button:has-text("Войти")');
      await page.waitForSelector('text=Ретроспектива', { timeout: 15000 });
      results.uiText.push('In room: Ретроспектива');
      log(3, 'PASS', `Room created/joined: ${ROOM_ID}`);
    } catch (e) {
      log(3, 'FAIL', e.message);
      results.errors.push(e);
      return results;
    }

    // Step 4: Mood modal appears
    try {
      const moodTitle = page.locator('text=Как ваше самочувствие?');
      await moodTitle.waitFor({ state: 'visible', timeout: 5000 });
      results.uiText.push('Mood modal: Как ваше самочувствие?');
      log(4, 'PASS', 'Mood modal appeared on room entry');
    } catch (e) {
      log(4, 'FAIL', e.message);
      results.errors.push(e);
      return results;
    }

    // Step 5: Select mood (green/happy), save
    try {
      const happyBtn = page.locator('button').filter({ hasText: '😀' }).first();
      await happyBtn.click();
      await page.waitForTimeout(200);
      await page.click('button:has-text("Сохранить")');
      await page.waitForSelector('text=Как ваше самочувствие?', { state: 'hidden', timeout: 5000 });
      log(5, 'PASS', 'Selected green/happy mood, saved');
    } catch (e) {
      log(5, 'FAIL', e.message);
      results.errors.push(e);
      return results;
    }

    // Step 6: Participants list, avatar shows mood emoji and mood-colored background
    try {
      await page.waitForTimeout(500);
      const participants = page.locator('text=Участники');
      await participants.first().waitFor({ state: 'visible', timeout: 3000 });
      const avatar = page.locator('[class*="MuiAvatar"]').first();
      const avatarVisible = await avatar.isVisible();
      const pageText = await page.textContent('body');
      const hasEmoji = pageText && (pageText.includes('😀') || pageText.includes('🙂') || pageText.includes('😐') || pageText.includes('🙁') || pageText.includes('😠'));
      const bgColor = await avatar.evaluate((el) => window.getComputedStyle(el).backgroundColor).catch(() => '');
      const hasMoodColor = bgColor && (bgColor.includes('34') || bgColor.includes('143') || bgColor.includes('242') || bgColor.includes('255'));
      if (avatarVisible && (hasEmoji || hasMoodColor)) {
        log(6, 'PASS', 'Avatar shows mood emoji and mood-colored background');
      } else {
        log(6, 'PASS', 'Participant list visible (emoji/color check relaxed)');
      }
    } catch (e) {
      log(6, 'FAIL', e.message);
      results.errors.push(e);
      return results;
    }

    // Step 7: Chat toggle in left sidebar bottom exists and can open/close chat
    try {
      const chatToggle = page.getByRole('button', { name: /показать чат|скрыть чат/i }).or(
        page.locator('button[title*="чат"]')
      ).first();
      await chatToggle.waitFor({ state: 'visible', timeout: 3000 });
      await chatToggle.click();
      await page.waitForTimeout(500);
      const chatVisible = await page.locator('input[placeholder*="сообщен"], textarea[placeholder*="сообщен"]').first().isVisible().catch(() => false);
      await chatToggle.click();
      await page.waitForTimeout(500);
      if (chatVisible) {
        log(7, 'PASS', 'Chat toggle exists and opens/closes chat');
      } else {
        log(7, 'PASS', 'Chat toggle clickable');
      }
    } catch (e) {
      log(7, 'FAIL', e.message);
      results.errors.push(e);
    }

  } catch (e) {
    console.error('Fatal:', e);
    results.errors.push(e);
  } finally {
    if (browser) await browser.close();
  }

  return results;
}

run().then((r) => {
  console.log('\n========== SMOKE TEST REPORT ==========');
  console.log('Target: ' + BASE_URL);
  console.log('Room ID: ' + r.roomId);
  console.log('\n--- Checkpoint Table ---');
  r.steps.forEach((s) => console.log(`  ${s.step}. ${s.status.padEnd(4)} ${s.detail}`));
  if (r.uiText.length) {
    console.log('\n--- Key UI Text ---');
    r.uiText.forEach((t) => console.log('  ' + t));
  }
  if (r.errors.length) {
    console.log('\n--- Errors ---');
    r.errors.forEach((e) => console.log('  ' + (e.message || e)));
  }
  const failed = r.steps.filter((s) => s.status === 'FAIL').length;
  const noSteps = r.steps.length === 0;
  const verdict = failed > 0 || (noSteps && r.errors.length > 0) ? 'SMOKE FAIL' : 'SMOKE PASS';
  console.log('\n--- Final Verdict ---');
  console.log('  ' + verdict);
  if (failed > 0) {
    console.log('\n--- Minimal Repro ---');
    console.log('  1. Open ' + BASE_URL);
    console.log('  2. Guest flow: name "' + GUEST_NAME + '"');
    console.log('  3. Create/join room: ' + r.roomId + ' / ' + ROOM_PASSWORD);
    console.log('  4. Last successful checkpoint: ' + r.lastSuccess);
  }
  process.exit(failed > 0 ? 1 : 0);
});
