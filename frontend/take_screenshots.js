import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

async function main() {
  const imagesDir = 'c:/Jef Investment/docs/images';
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // 1. Screenshot Login Page
  console.log('Navigating to Login page...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(imagesDir, 'login_screen.png') });
  console.log('Saved login_screen.png');

  // Fill credentials and log in to get access to other pages
  try {
    await page.type('#email', 'admin@jefinvestment.com');
    await page.type('#password', 'admin123');
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 3000));
  } catch (e) {
    console.warn('Login form fill info:', e.message);
  }

  // 2. POS Page
  console.log('Navigating to POS page...');
  await page.goto('http://localhost:5173/pos', { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(imagesDir, 'pos_screen.png') });
  console.log('Saved pos_screen.png');

  // 3. Dashboard Page
  console.log('Navigating to Dashboard page...');
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(imagesDir, 'dashboard_screen.png') });
  console.log('Saved dashboard_screen.png');

  // 4. Settings Page
  console.log('Navigating to Settings page...');
  await page.goto('http://localhost:5173/settings', { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(imagesDir, 'settings_screen.png') });
  console.log('Saved settings_screen.png');

  await browser.close();
  console.log('All live screenshots captured successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
