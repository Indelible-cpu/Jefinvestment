const https = require('https');

const candidates = [
  'https://jef-erp-backend.indelible-cpu.workers.dev/api/v1/health',
  'https://jef-erp-backend.indelibletech.workers.dev/api/v1/health',
  'https://jef-erp-backend.indelible-tech.workers.dev/api/v1/health',
  'https://jef-erp-backend.workers.dev/api/v1/health'
];

async function checkUrl(url) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`[${res.status}] ${url} => ${text}`);
  } catch (err) {
    console.log(`[ERR] ${url} => ${err.message}`);
  }
}

async function run() {
  for (const url of candidates) {
    await checkUrl(url);
  }
}

run();
