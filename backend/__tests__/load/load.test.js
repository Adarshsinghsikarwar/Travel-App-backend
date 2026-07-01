// Load test — run this separately from Jest, NOT as part of npm test
// Usage: node __tests__/load/load.test.js
//
// This file is intentionally NOT a Jest test — Jest has a 30s timeout
// and is meant for correctness tests, not sustained load. Run this directly
// with Node after starting your server with: npm run dev
//
// What it measures:
//   - Requests/second your server handles under concurrent load
//   - Latency percentiles (p50, p99) — p99 tells you worst-case response time
//   - Error rate — any non-2xx/4xx responses under load
//
// Install autocannon first: npm install -g autocannon
// Then: node __tests__/load/load.test.js

const BASE_URL = 'http://localhost:5000';

async function getToken() {
  // Register + login to get a real JWT for authenticated load tests
  const email = `loadtest_${Date.now()}@example.com`;
  await fetch(`${BASE_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Load Tester', email, password: 'Test@1234' }),
  });
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test@1234' }),
  });
  const data = await res.json();
  return data.data?.accessToken;
}

async function runAutocannon(options) {
  // Dynamically import autocannon (it's a CommonJS module)
  const { default: autocannon } = await import('autocannon');

  return new Promise((resolve, reject) => {
    const instance = autocannon(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    autocannon.track(instance); // prints live progress to terminal
  });
}

function printResult(label, result) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`SCENARIO: ${label}`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`Requests/sec:  avg ${result.requests.average}  max ${result.requests.max}`);
  console.log(`Latency (ms):  p50 ${result.latency.p50}  p99 ${result.latency.p99}  max ${result.latency.max}`);
  console.log(`Errors:        ${result.errors}  (timeouts: ${result.timeouts})`);
  console.log(`Total requests: ${result.requests.total} in ${result.duration}s`);
  console.log(`Status 2xx: ${result['2xx']}  non-2xx: ${result.non2xx}`);

  // A pass/fail assertion you can eyeball:
  if (result.errors > result.requests.total * 0.01) {
    console.log('⚠️  ERROR RATE > 1% — server is struggling under this load');
  } else if (result.latency.p99 > 2000) {
    console.log('⚠️  P99 LATENCY > 2s — slow responses under load');
  } else {
    console.log('✅  Within acceptable bounds');
  }
}

async function main() {
  console.log('TripConnect Load Tests');
  console.log('Make sure your server is running at', BASE_URL);
  console.log('and connected to a real MongoDB Atlas cluster (not test DB)\n');

  const token = await getToken();
  if (!token) {
    console.error('Could not get auth token — is the server running?');
    process.exit(1);
  }

  // ── Scenario 1: Health check baseline ──────────────────────────────────
  // This establishes the absolute ceiling — how fast Node can respond
  // with zero DB or business logic. Compare all other results against this.
  const s1 = await runAutocannon({
    url: `${BASE_URL}/health`,
    connections: 100,  // 100 concurrent "users"
    duration: 15,      // seconds
    title: 'Health check (baseline)',
  });
  printResult('Health check — baseline (no DB, no logic)', s1);

  // ── Scenario 2: Provider search (read-heavy, with DB + index) ──────────
  // This is your most common public endpoint — unauthenticated search.
  // A slow p99 here means your geospatial index needs attention.
  const s2 = await runAutocannon({
    url: `${BASE_URL}/api/v1/providers/search?city=Goa&serviceType=guide`,
    connections: 50,
    duration: 15,
    title: 'Provider search (read + DB geospatial index)',
  });
  printResult('Provider search (read + geo index)', s2);

  // ── Scenario 3: Authenticated trip list ────────────────────────────────
  // Authenticated read — adds JWT verification overhead on top of the DB query.
  const s3 = await runAutocannon({
    url: `${BASE_URL}/api/v1/trips`,
    connections: 50,
    duration: 15,
    headers: { Authorization: `Bearer ${token}` },
    title: 'GET /trips (authenticated read)',
  });
  printResult('Trip list (authenticated read)', s3);

  // ── Scenario 4: Auth endpoint stress ───────────────────────────────────
  // Login is expensive (bcrypt hash + DB write of refresh token hash).
  // Lower concurrency here is intentional — the rate limiter will kick in
  // at 20 req/15min per IP, so this tests what happens at the threshold.
  const s4 = await runAutocannon({
    url: `${BASE_URL}/api/v1/auth/login`,
    method: 'POST',
    connections: 10,
    duration: 10,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nobody@test.com', password: 'Test@1234' }),
    title: 'Login endpoint under repeated attempts',
  });
  printResult('Login (rate-limited, bcrypt-heavy)', s4);

  console.log('\nDone. Summary:');
  console.log('- Health baseline tells you your Node.js ceiling');
  console.log('- Provider search should be within 2-3x of baseline with a proper index');
  console.log('- Login being slow is EXPECTED — bcrypt is intentionally expensive');
  console.log('- P99 > 2s on any non-login endpoint = investigate DB queries or missing indexes');
}

main().catch(console.error);
