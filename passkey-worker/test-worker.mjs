import worker from './src/index.ts';
import assert from 'node:assert/strict';

// In-memory mock D1Database for local testing
class MockD1 {
  constructor() {
    this.challenges = new Map();
    this.passkeys = new Map();
  }

  prepare(query) {
    const self = this;
    let boundParams = [];
    return {
      bind(...params) {
        boundParams = params;
        return this;
      },
      async run() {
        if (query.includes('DELETE FROM challenges WHERE created_at < ?')) {
          const threshold = boundParams[0];
          for (const [id, c] of self.challenges.entries()) {
            if (c.created_at < threshold) self.challenges.delete(id);
          }
          return { meta: { changes: 1 } };
        }
        if (query.includes('INSERT INTO challenges')) {
          const [challenge_id, challenge, user_id, webauthn_user_id, purpose, created_at] = boundParams;
          self.challenges.set(challenge_id, { challenge_id, challenge, user_id, webauthn_user_id, purpose, created_at });
          return { meta: { changes: 1 } };
        }
        if (query.includes('INSERT INTO passkeys')) {
          const [credential_id, user_id, user_email, webauthn_user_id, public_key, counter, transports, device_type, backed_up, device_name, created_at] = boundParams;
          self.passkeys.set(credential_id, { credential_id, user_id, user_email, webauthn_user_id, public_key, counter, transports, device_type, backed_up, device_name, created_at });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        if (query.includes('DELETE FROM challenges')) {
          const [challenge_id, purpose, user_id, threshold] = boundParams;
          const c = self.challenges.get(challenge_id);
          if (c && c.purpose === purpose && c.created_at >= threshold) {
            self.challenges.delete(challenge_id);
            return { challenge: c.challenge, user_id: c.user_id, webauthn_user_id: c.webauthn_user_id };
          }
          return null;
        }
        if (query.includes('SELECT * FROM passkeys WHERE credential_id = ?')) {
          const [id] = boundParams;
          return self.passkeys.get(id) || null;
        }
        return null;
      },
      async all() {
        if (query.includes('SELECT credential_id, transports FROM passkeys WHERE user_email = ?')) {
          const [email] = boundParams;
          const results = [];
          for (const p of self.passkeys.values()) {
            if (p.user_email === email) results.push({ credential_id: p.credential_id, transports: p.transports });
          }
          return { results };
        }
        if (query.includes('SELECT credential_id, public_key, counter')) {
          const [uid] = boundParams;
          const results = [];
          for (const p of self.passkeys.values()) {
            if (p.user_id === uid) results.push(p);
          }
          return { results };
        }
        return { results: [] };
      }
    };
  }
}

const mockEnv = {
  PASSKEYS_DB: new MockD1(),
  RP_ID: 'jefinvestment-e1fc1.web.app',
  RP_NAME: 'MsikaFlo',
  EXPECTED_ORIGIN: 'https://jefinvestment-e1fc1.web.app',
  FIREBASE_PROJECT_ID: 'jefinvestment-e1fc1',
  FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
    client_email: 'test@example.com',
    private_key: 'dummy',
    project_id: 'jefinvestment-e1fc1'
  }),
};

async function runTests() {
  console.log('--- Starting Worker Unit & Security Tests ---');

  // Test 1: Health Check
  {
    const req = new Request('http://worker.internal/health', { method: 'GET' });
    const res = await worker.fetch(req, mockEnv);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { ok: true, service: 'msikaflo-passkeys' });
    console.log('✓ Test 1 Passed: GET /health returns service status');
  }

  // Test 2: Disallowed Origin Protection
  {
    const req = new Request('http://worker.internal/v1/auth/options', {
      method: 'POST',
      headers: { Origin: 'https://malicious-site.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.com' })
    });
    const res = await worker.fetch(req, mockEnv);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, 'Origin not allowed.');
    console.log('✓ Test 2 Passed: Reject untrusted Origin with HTTP 403');
  }

  // Test 3: OPTIONS Preflight for Production & Local Dev Origins
  {
    const reqProd = new Request('http://worker.internal/v1/auth/options', {
      method: 'OPTIONS',
      headers: { Origin: 'https://jefinvestment-e1fc1.web.app' }
    });
    const resProd = await worker.fetch(reqProd, mockEnv);
    assert.equal(resProd.status, 204);
    assert.equal(resProd.headers.get('Access-Control-Allow-Origin'), 'https://jefinvestment-e1fc1.web.app');

    const reqLocal = new Request('http://worker.internal/v1/auth/options', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173' }
    });
    const resLocal = await worker.fetch(reqLocal, mockEnv);
    assert.equal(resLocal.status, 204);
    assert.equal(resLocal.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');
    console.log('✓ Test 3 Passed: OPTIONS preflight allows production and localhost');
  }

  // Test 4: Auth Options with Empty Email
  {
    const req = new Request('http://worker.internal/v1/auth/options', {
      method: 'POST',
      headers: { Origin: 'https://jefinvestment-e1fc1.web.app', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '' })
    });
    const res = await worker.fetch(req, mockEnv);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'Enter your email address first.');
    console.log('✓ Test 4 Passed: Empty email rejected with 400');
  }

  // Test 5: Auth Options for Unregistered Email
  {
    const req = new Request('http://worker.internal/v1/auth/options', {
      method: 'POST',
      headers: { Origin: 'https://jefinvestment-e1fc1.web.app', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@msikaflo.com' })
    });
    const res = await worker.fetch(req, mockEnv);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, 'No passkey is registered for this email address.');
    console.log('✓ Test 5 Passed: Unregistered email returns 404');
  }

  // Test 6: Rate Limiting Enforcement
  {
    const email = 'ratelimit-test@msikaflo.com';
    let blocked = false;
    for (let i = 0; i < 7; i++) {
      const req = new Request('http://worker.internal/v1/auth/options', {
        method: 'POST',
        headers: {
          Origin: 'https://jefinvestment-e1fc1.web.app',
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '198.51.100.1'
        },
        body: JSON.stringify({ email })
      });
      const res = await worker.fetch(req, mockEnv);
      if (res.status === 429) {
        blocked = true;
        const body = await res.json();
        assert.ok(body.error.includes('Too many'));
        break;
      }
    }
    assert.ok(blocked, 'Expected rate limiting to trigger 429');
    console.log('✓ Test 6 Passed: Rate limiter properly throttles repeated requests with HTTP 429');
  }

  // Test 7: Challenge Automatic Cleanup
  {
    // Insert an expired challenge (> 10 mins ago)
    const oldTimestamp = Math.floor(Date.now() / 1000) - 700;
    mockEnv.PASSKEYS_DB.challenges.set('old-ch-1', {
      challenge_id: 'old-ch-1',
      challenge: 'expired',
      purpose: 'authentication',
      created_at: oldTimestamp
    });
    assert.equal(mockEnv.PASSKEYS_DB.challenges.has('old-ch-1'), true);

    // Add a credential to passkeys so generateAuthenticationOptions proceeds
    mockEnv.PASSKEYS_DB.passkeys.set('cred-1', {
      credential_id: 'cred-1',
      user_id: 'user-1',
      user_email: 'registered@msikaflo.com',
      transports: '[]',
      public_key: new Uint8Array([1, 2, 3]),
      counter: 0,
      created_at: Math.floor(Date.now() / 1000)
    });

    const req = new Request('http://worker.internal/v1/auth/options', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.168.1.50'
      },
      body: JSON.stringify({ email: 'registered@msikaflo.com' })
    });
    const res = await worker.fetch(req, mockEnv);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.challengeId);
    assert.equal(body.options.rpId, 'localhost'); // Verified localhost RP detection!
    assert.equal(mockEnv.PASSKEYS_DB.challenges.has('old-ch-1'), false); // Purged!
    console.log('✓ Test 7 Passed: Automatic stale challenge cleanup and localhost RP detection');
  }

  console.log('\n--- ALL WORKER SECURITY & INTEGRATION TESTS PASSED (7/7) ---');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
