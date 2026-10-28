// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';
import { buildPayload, fingerprint } from '../../../../product/core-space/scripts/lib/diag-payload.mjs';

// aipa-report end-to-end tests.
//



const HERE = dirname(fileURLToPath(import.meta.url));
const PRODUCT = join(HERE, '..', '..', '..', '..', 'product');
const INIT = join(PRODUCT, 'scripts', 'aipa-init.mjs');
const CH = join(PRODUCT, 'core-space', 'scripts', 'aipa-channel.mjs');
const REPORT = join(PRODUCT, 'core-space', 'scripts', 'aipa-report.mjs');





const SENSITIVE = 'Error: boom token=SEKRET123 at /home/example-user/secret-project/x.mjs';
const errLine = (msg) => JSON.stringify({ ts: '2026-09-15T00:00:00Z', scope: 'hook', message: msg }) + '\n';
const ERRORS = errLine(SENSITIVE);



const fpOf = (errorLines) => fingerprint(buildPayload({ version: '', channel: '', deviceId: '', errorLines }));

const manifestOf = (root) => readFileSync(join(root, 'AIPA-MANIFEST.yaml'), 'utf8');
const sentPathOf = (root) => join(root, 'state', 'telemetry-sent.json');
const deviceIdPathOf = (root) => join(root, 'state', 'device-id');

function initStable(root) {
  execFileSync('node', [INIT, '--root', root, '--owner', 't'], { encoding: 'utf8' });
}



function toBeta(root) {
  initStable(root);
  execFileSync('node', [CH, '--root', root, '--telemetry', 'on'], { encoding: 'utf8' });
  execFileSync('node', [CH, '--root', root, '--set', 'beta'], { encoding: 'utf8' });
}

function writeErrors(root, text) {
  mkdirSync(join(root, 'state'), { recursive: true });
  writeFileSync(join(root, 'state', 'errors.log'), text, 'utf8');
}

function runReport(root, args = [], opts = {}) {
  return execFileSync('node', [REPORT, '--root', root, ...args], { encoding: 'utf8', ...opts });
}





function runReportAsync(root, args = [], opts = {}) {
  return new Promise((resolve) => {
    execFile('node', [REPORT, '--root', root, ...args], { encoding: 'utf8', ...opts }, (error, stdout, stderr) => {
      resolve({
        status: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        stdout: String(stdout ?? ''),
        stderr: String(stderr ?? ''),
      });
    });
  });
}






function refused(root, args, reasonRe) {
  let err = '';
  assert.throws(
    () => {
      try {
        execFileSync('node', [REPORT, '--root', root, ...args], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
      } catch (e) { err = String(e.stderr || ''); throw e; }
    },
    (e) => e.status > 0 && reasonRe.test(String(e.stderr || '')),
    "Reject with a nonzero exit and the specific stderr reason",
  );
  return err;
}


function snapshot(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(base, p).replace(/\\/g, '/');
    if (statSync(p).isDirectory()) { out.push(rel + '/'); snapshot(p, base, out); }
    else out.push(rel + ':' + createHash('sha256').update(readFileSync(p)).digest('hex'));
  }
  return out.sort();
}


function filesContaining(dir, needle) {
  const buf = Buffer.from(needle, 'utf8');
  const hits = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (readFileSync(p).includes(buf)) hits.push(relative(dir, p).replace(/\\/g, '/'));
    }
  };
  walk(dir);
  return hits.sort();
}




//   POST .../issues            → 201
//   POST .../issues/<n>/comments → 201
function startFakeGitHub({ issues = [], pages, status = 200, writeStatus = 201, linkForPage, delayForPage = 0, redirect } = {}) {
  const requests = [];
  const server = createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const url = new URL(req.url, 'http://127.0.0.1');
      const path = url.pathname;
      const page = Number(url.searchParams.get('page') || '1');
      requests.push({ method: req.method, path, query: Object.fromEntries(url.searchParams), raw, auth: String(req.headers.authorization || ''), headers: { ...req.headers } });
      const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
      if (req.method === 'GET' && /\/issues$/.test(path)) {
        if (redirect) { res.writeHead(302, { Location: redirect }); res.end(); return; }
        const next = linkForPage ? linkForPage(page, req.headers.host, path) : pages && page < pages.length ? `<http://${req.headers.host}${path}?page=${page + 1}>; rel="next"` : '';
        if (next) res.setHeader('Link', next);
        if (delayForPage) return setTimeout(() => json(status, pages ? pages[page - 1] : issues), delayForPage);
        return json(status, pages ? pages[page - 1] : issues);
      }
      if (req.method === 'POST' && /\/issues$/.test(path)) return json(writeStatus, { number: 101 });
      if (req.method === 'POST' && /\/issues\/\d+\/comments$/.test(path)) return json(writeStatus, { id: 1 });
      return json(404, { messages: ['not found'] });
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        requests,
        base: `http://127.0.0.1:${port}`,



        close: () => new Promise((r) => { server.close(() => r()); server.closeAllConnections(); }),
      });
    });
  });
}



function startHangingGitHub() {
  const server = createServer(() => {  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        base: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => { server.close(() => r()); server.closeAllConnections(); }),
      });
    });
  });
}



function closedBase() {
  return new Promise((resolve) => {
    const s = createServer(() => {});
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(`http://127.0.0.1:${port}`));
    });
  });
}



test("Stable/off reporting rejects because the channel is not beta and preserves all instance bytes", () => {
  const root = makeTestDir('aipa-rep-');
  try {
    initStable(root);
    const before = snapshot(root);
    const err = refused(root, ['--dry-run'], /not beta/);
    assert.doesNotMatch(err, /consent.*missing/, "Stable/off rejection must identify the channel gate rather than missing consent");
    assert.deepEqual(snapshot(root), before, "Rejected execution must write nothing");
    assert.equal(existsSync(sentPathOf(root)), false, "Rejected execution must not write telemetry-sent.json");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Stable/on reporting is still rejected by the stable-channel guarantee", () => {
  const root = makeTestDir('aipa-rep-');
  try {
    initStable(root);
    execFileSync('node', [CH, '--root', root, '--telemetry', 'on'], { encoding: 'utf8' });
    assert.match(manifestOf(root), /^\s+channel:\s*stable/m, "Precondition: the instance remains stable");
    assert.match(manifestOf(root), /^\s+telemetry:\s*on/m, "Precondition: telemetry is enabled");
    const before = snapshot(root);
    const err = refused(root, ['--dry-run'], /not beta/);
    assert.doesNotMatch(err, /consent.*missing/, "The reason must be not-beta rather than missing consent");
    assert.deepEqual(snapshot(root), before, "Rejected execution must write nothing");
    assert.equal(existsSync(sentPathOf(root)), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Beta/off reporting rejects specifically because consent is missing", () => {
  const root = makeTestDir('aipa-rep-');
  try {
    initStable(root);



    execFileSync('node', [CH, '--root', root, '--telemetry', 'on'], { encoding: 'utf8' });
    execFileSync('node', [CH, '--root', root, '--set', 'beta'], { encoding: 'utf8' });
    execFileSync('node', [CH, '--root', root, '--telemetry', 'off'], { encoding: 'utf8' });
    assert.match(manifestOf(root), /^\s+channel:\s*beta/m, "Precondition: the instance is on beta");
    assert.match(manifestOf(root), /^\s+telemetry:\s*off/m, "Precondition: telemetry remains off");
    const before = snapshot(root);
    const err = refused(root, ['--dry-run'], /consent.*missing/);
    assert.doesNotMatch(err, /not beta/, "An existing beta instance must not be described as not-beta");
    assert.deepEqual(snapshot(root), before, "Rejected execution must write nothing");
    assert.equal(existsSync(sentPathOf(root)), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Dry-run prints a sanitized beta payload without secrets, paths, or writes", () => {
  const root = makeTestDir('aipa-rep-');
  try {
    toBeta(root);
    writeErrors(root, ERRORS);
    const before = snapshot(root);
    const out = runReport(root, ['--dry-run'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const payload = JSON.parse(out);
    assert.equal(payload.channel, 'beta');
    assert.equal(Array.isArray(payload.errors), true);
    assert.equal(payload.errors.length, 1);
    assert.equal(typeof payload.deviceId, 'string');
    assert.ok(payload.deviceId.length > 0, "The payload includes a device identifier, including a temporary one");
    assert.equal(out.includes('SEKRET123'), false, "Payloads must not contain secrets");
    assert.equal(out.includes('secret-project'), false, "Payloads must not contain project paths");
    assert.equal(payload.errors[0].kind, 'error');

    assert.deepEqual(snapshot(root), before, "Dry-run is read-only");
    assert.equal(existsSync(deviceIdPathOf(root)), false, "Dry-run must not persist device-id");
    assert.equal(existsSync(sentPathOf(root)), false, "Dry-run must not record reporting usage");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Dry-run stderr explicitly explains that nothing is persisted", () => {
  const root = makeTestDir('aipa-rep-');
  try {
    toBeta(root);
    writeErrors(root, ERRORS);


    const r = spawnSync('node', [REPORT, '--root', root, '--dry-run'], { encoding: 'utf8' });
    assert.equal(r.status, 0, "Dry-run must exit successfully");
    assert.doesNotThrow(() => JSON.parse(r.stdout), "stdout must remain parseable payload JSON");
    const stderr = String(r.stderr || '');
    assert.match(stderr, /--dry-run/, "Stderr must identify dry-run mode");
    assert.match(stderr, /state\/device-id/, "Stderr must explain that real reporting creates and saves state/device-id");
    assert.equal(existsSync(deviceIdPathOf(root)), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Device-ID reset is a local deletion independent of beta reporting gates", () => {
  const root = makeTestDir('aipa-rep-');
  try {
    initStable(root);
    mkdirSync(join(root, 'state'), { recursive: true });
    writeFileSync(deviceIdPathOf(root), '11111111-1111-1111-1111-111111111111\n', 'utf8');
    const out = runReport(root, ['--reset-device-id'], { stdio: ['ignore', 'pipe', 'pipe'] });
    assert.equal(existsSync(deviceIdPathOf(root)), false, "Channel or consent must not block local device-ID deletion");
    assert.match(out, /device ID reset/);

    writeFileSync(deviceIdPathOf(root), '22222222-2222-2222-2222-222222222222\n', 'utf8');
    const both = runReport(root, ['--reset-device-id', '--dry-run'], { stdio: ['ignore', 'pipe', 'pipe'] });
    assert.match(both, /--dry-run/, "When both flags are present, explain that reset overrides dry-run");
    assert.match(both, /device ID reset/);
    assert.doesNotMatch(both, /"deviceId"/, "Do not print a payload for this action");
    assert.equal(existsSync(deviceIdPathOf(root)), false);
    assert.equal(existsSync(sentPathOf(root)), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Device-ID reset deletes the local ID and explains subsequent regeneration", async () => {
  const root = makeTestDir('aipa-rep-');
  const github = await startFakeGitHub();
  try {
    toBeta(root);
    writeErrors(root, ERRORS);
    const result = await runReportAsync(root, ['--api-base', github.base, '--token', 'tok-abc']);
    assert.equal(result.stderr, '', result.stderr);
    assert.equal(existsSync(deviceIdPathOf(root)), true, "Precondition: real reporting persisted the device ID");
    const id = readFileSync(deviceIdPathOf(root), 'utf8').trim();
    assert.ok(id.length > 0);



    const dry = JSON.parse(runReport(root, ['--dry-run'], { stdio: ['ignore', 'pipe', 'pipe'] }));
    assert.equal(dry.deviceId, id, "Subsequent runs reuse the persisted ID rather than generating a new one");

    const out = runReport(root, ['--reset-device-id'], { stdio: ['ignore', 'pipe', 'pipe'] });
    assert.equal(existsSync(deviceIdPathOf(root)), false, "Reset must delete state/device-id");
    assert.match(out, /reset|generate/, "Explain the subsequent behavior to the user");

    const after = JSON.parse(runReport(root, ['--dry-run'], { stdio: ['ignore', 'pipe', 'pipe'] }));
    assert.notEqual(after.deviceId, id, "Reporting after reset must not reuse the old ID");


    const again = runReport(root, ['--reset-device-id'], { stdio: ['ignore', 'pipe', 'pipe'] });
    assert.match(again, /does not exist|no reset needed|generate/);
  } finally {
    await github.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("Matching fingerprints append a comment without creating an issue", async () => {
  const root = makeTestDir('aipa-rep-');
  const fp = fpOf(ERRORS);
  const github = await startFakeGitHub({ issues: [{ number: 7, title: `[Diagnostics] beta 1.0.0 (${fp})`, state: 'open' }] });
  try {
    toBeta(root);
    writeErrors(root, ERRORS);
    await runReportAsync(root, ['--api-base', github.base, '--token', 'tok-abc']);
    assert.deepEqual(
      github.requests.map((r) => `${r.method} ${r.path}`),
      ['GET /repos/StriveJ/artificial-intelligence-origin-agent/issues',
       'POST /repos/StriveJ/artificial-intelligence-origin-agent/issues/7/comments'],
      "Search first, then append only a comment for a matching fingerprint",
    );
    assert.equal(github.requests.some((r) => r.method === 'POST' && /\/issues$/.test(r.path)), false, "Do not create an issue");
    assert.equal(existsSync(sentPathOf(root)), true, "Record successful reporting");
    assert.equal(JSON.parse(readFileSync(sentPathOf(root), 'utf8'))[fp] !== undefined, true, "Ledger entries are keyed by fingerprint");
  } finally {
    await github.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("An unmatched fingerprint creates one issue without a comment", async () => {
  const root = makeTestDir('aipa-rep-');
  const github = await startFakeGitHub({ issues: [{ number: 7, title: "[Diagnostics] beta 1.0.0 (deadbeefdeadbeef)", state: 'open' }] });
  try {
    toBeta(root);
    writeErrors(root, ERRORS);
    const fp = fpOf(ERRORS);
    await runReportAsync(root, ['--api-base', github.base, '--token', 'tok-abc']);
    assert.deepEqual(
      github.requests.map((r) => `${r.method} ${r.path}`),
      ['GET /repos/StriveJ/artificial-intelligence-origin-agent/issues',
       'POST /repos/StriveJ/artificial-intelligence-origin-agent/issues'],
      "Search first and create only if no match exists",
    );
    assert.equal(github.requests.some((r) => /\/comments$/.test(r.path)), false, "Do not append a comment");
    const created = JSON.parse(github.requests[1].raw);
    assert.equal(typeof created.title, 'string');
    assert.ok(created.title.includes(`(${fp})`), "Issue titles must include the deduplication fingerprint");
  } finally {
    await github.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("A matching malformed list item without an ID fails safely without malformed URLs", async () => {
  const root = makeTestDir('aipa-rep-');
  const fp = fpOf(ERRORS);

  const github = await startFakeGitHub({ issues: [{ title: `[Diagnostics] beta 1.0.0 (${fp})` }] });
  try {
    toBeta(root);
    writeErrors(root, ERRORS);
    const r = await runReportAsync(root, ['--api-base', github.base, '--token', 'tok-abc'], { timeout: 10000 });
    assert.equal(r.status, 0, "Malformed responses must degrade safely instead of crashing");
    assert.match(r.stderr, /number/, "Attribute the error to a missing list-item ID rather than an unrelated 404");
    assert.deepEqual(
      github.requests.map((x) => `${x.method} ${x.path}`),
      ['GET /repos/StriveJ/artificial-intelligence-origin-agent/issues'],
      "Only search may occur; never request /issues/undefined/comments",
    );
    assert.equal(r.stdout.includes("Reported"), false, "Do not falsely report success");
  } finally {
    await github.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("A repeated fingerprint within 24 hours sends no requests and writes no ledger entries", async () => {
  const root = makeTestDir('aipa-rep-');
  const github = await startFakeGitHub();
  try {
    toBeta(root);
    writeErrors(root, ERRORS);
    const fp = fpOf(ERRORS);
    mkdirSync(join(root, 'state'), { recursive: true });
    writeFileSync(sentPathOf(root), JSON.stringify({ [fp]: new Date().toISOString() }), 'utf8');
    const r = await runReportAsync(root, ['--api-base', github.base, '--token', 'tok-abc']);
    assert.equal(r.status, 0, "A local rate-limit hit is not an error");
    assert.equal(github.requests.length, 0, "Do not send requests when the local rate limit applies");
    assert.match(r.stdout, /skipped/, "Explain that reporting was skipped");
  } finally {
    await github.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("Reporting resumes after the 24-hour rate-limit window expires", async () => {
  const root = makeTestDir('aipa-rep-');
  const github = await startFakeGitHub();
  try {
    toBeta(root);
    writeErrors(root, ERRORS);
    const fp = fpOf(ERRORS);
    mkdirSync(join(root, 'state'), { recursive: true });
    writeFileSync(sentPathOf(root), JSON.stringify({ [fp]: new Date(Date.now() - 25 * 3600 * 1000).toISOString() }), 'utf8');
    await runReportAsync(root, ['--api-base', github.base, '--token', 'tok-abc']);
    assert.equal(github.requests.length, 2, "After expiry, search and send normally");
    assert.equal(JSON.parse(readFileSync(sentPathOf(root), 'utf8'))[fp] !== undefined, true);
  } finally {
    await github.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("Both issue creation and comment requests exclude sensitive strings", async () => {
  const root = makeTestDir('aipa-rep-');
  const fp = fpOf(ERRORS);
  const miss = await startFakeGitHub();
  const hit = await startFakeGitHub({ issues: [{ number: 3, title: `[Diagnostics] beta 1.0.0 (${fp})` }] });
  try {
    toBeta(root);
    writeErrors(root, ERRORS);
    await runReportAsync(root, ['--api-base', miss.base, '--token', 'tok-abc']);
    rmSync(sentPathOf(root), { force: true });
    await runReportAsync(root, ['--api-base', hit.base, '--token', 'tok-abc']);
    const all = [...miss.requests, ...hit.requests];
    assert.equal(all.length, 4, "Precondition: each path sends a search and a write request");
    for (const r of all) {
      assert.equal(r.raw.includes('SEKRET123'), false, `${r.method} ${r.path} request body must not contain sensitive content`);
      assert.equal(r.raw.includes('secret-project'), false, `${r.method} ${r.path} request body must not contain project paths`);
    }
    const comment = hit.requests.find((r) => /\/comments$/.test(r.path));
    assert.ok(comment, "Precondition: the matching path actually submitted a comment");
    assert.equal(JSON.parse(comment.raw).body.includes('SEKRET123'), false, "Comment bodies must also exclude secrets");
  } finally {
    await miss.close();
    await hit.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("Tokens supplied by argument or environment remain memory-only and absent from all instance files", async () => {
  const root = makeTestDir('aipa-rep-');
  const github = await startFakeGitHub();
  const TOKEN = 'github-token-9f3c1a7b2e4d5f60';
  try {
    toBeta(root);
    writeErrors(root, ERRORS);
    const first = await runReportAsync(root, ['--api-base', github.base, '--token', TOKEN]);
    assert.equal(existsSync(sentPathOf(root)), true, "Precondition: this run actually sent and recorded reporting");

    rmSync(sentPathOf(root), { force: true });
    const second = await runReportAsync(root, ['--api-base', github.base], { env: { ...process.env, AIPA_GITHUB_TOKEN: TOKEN } });
    const auths = github.requests.map((r) => r.auth).filter(Boolean);
    assert.equal(auths.length, 4, "Precondition: both token inputs sent a search and a write");
    assert.deepEqual([...new Set(auths)], ['Bearer ' + TOKEN], "Both inputs place the token in the Authorization header");
    for (const request of github.requests) {
      assert.equal(request.headers.accept, 'application/vnd.github+json');
      assert.equal(request.headers['x-github-api-version'], '2026-03-10');
      assert.equal(request.headers['user-agent'], 'AIPA-Diagnostics');
    }
    assert.equal(github.requests.some((r) => r.raw.includes(TOKEN)), false, "Tokens must not enter request bodies");
    assert.deepEqual(filesContaining(root, TOKEN), [], "Tokens must not appear in any instance file, including Git metadata");

    assert.equal(auths.every((a) => a.includes(TOKEN)), true, "Precondition: the Authorization header actually carried the token");
    for (const r of [first, second]) {
      assert.equal((r.stdout + r.stderr).includes(TOKEN), false, "All output, including success output, must not echo tokens");
    }

    const ledger = readFileSync(sentPathOf(root), 'utf8');
    assert.equal(ledger.includes(TOKEN), false);
    assert.equal(/[0-9a-f]{16}/.test(ledger), true, "The ledger records by fingerprint");
  } finally {
    await github.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("Missing tokens fail without requests or writes, including device-id", async () => {
  const root = makeTestDir('aipa-rep-');
  const github = await startFakeGitHub();
  try {
    toBeta(root);
    writeErrors(root, ERRORS);
    const before = snapshot(root);
    const r = await runReportAsync(root, ['--api-base', github.base]);
    assert.notEqual(r.status, 0, "Reject missing tokens");
    assert.match(r.stderr, /token/, "Explain that the token is missing and identify both supported inputs");
    assert.equal(github.requests.length, 0, "Do not send requests without credentials");
    assert.equal(existsSync(sentPathOf(root)), false, "Do not record reporting that was not sent");



    assert.equal(existsSync(deviceIdPathOf(root)), false, "Missing-token rejection must not leave state/device-id");
    assert.deepEqual(snapshot(root), before, "Rejected execution must write nothing");
  } finally {
    await github.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("Early rate-limit/no-error exits also write nothing, including device-id", async () => {
  const root = makeTestDir('aipa-rep-');
  const github = await startFakeGitHub();
  try {
    toBeta(root);
    writeErrors(root, ERRORS);
    const fp = fpOf(ERRORS);
    mkdirSync(join(root, 'state'), { recursive: true });
    writeFileSync(sentPathOf(root), JSON.stringify({ [fp]: new Date().toISOString() }), 'utf8');
    const beforeRate = snapshot(root);
    await runReportAsync(root, ['--api-base', github.base, '--token', 'tok-abc']);
    assert.equal(github.requests.length, 0);
    assert.equal(existsSync(deviceIdPathOf(root)), false, "Rate-limit early exit must not persist a device ID");
    assert.deepEqual(snapshot(root), beforeRate, "Rate-limit early exit must write nothing");

    rmSync(sentPathOf(root), { force: true });
    writeFileSync(join(root, 'state', 'errors.log'), '', 'utf8');
    const beforeEmpty = snapshot(root);
    const r = await runReportAsync(root, ['--api-base', github.base, '--token', 'tok-abc']);
    assert.equal(r.status, 0);
    assert.equal(existsSync(deviceIdPathOf(root)), false, "No-error early exit must not persist a device ID");
    assert.deepEqual(snapshot(root), beforeEmpty, "No-error early exit must write nothing");
  } finally {
    await github.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("New instances Git-ignore state/device-id (turn manual verification into an assertion)", () => {
  const root = makeTestDir('aipa-rep-');
  try {
    toBeta(root);

    const out = execFileSync('git', ['-C', root, 'check-ignore', '-v', 'state/device-id'], { encoding: 'utf8' });
    assert.match(out, /state\/device-id\s*$/, "state/device-id must be ignored by .gitignore");


    assert.throws(
      () => execFileSync('git', ['-C', root, 'check-ignore', 'state/origin-baseline.txt'], { stdio: ['ignore', 'pipe', 'pipe'] }),
      (e) => e.status === 1,
      "check-ignore must return 1 for an unignored path (the negative control)",
    );
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Bounded fetching: an unresponsive peer times out gracefully without hanging the caller", async () => {
  const root = makeTestDir('aipa-rep-');
  const hang = await startHangingGitHub();
  try {
    toBeta(root);
    writeErrors(root, ERRORS);
    const t0 = Date.now();



    const r = await runReportAsync(root, ['--api-base', hang.base, '--token', 'tok-abc', '--timeout-ms', '400'], { timeout: 10000 });
    const elapsed = Date.now() - t0;
    assert.equal(r.status, 0, "Timeout must degrade with exit 0, not propagate a nonzero status to hooks");
    assert.match(r.stderr, /degraded/, "Include an explanatory line");
    assert.ok(elapsed < 8000, `Must return near the configured time bound; measured: ${elapsed}ms`);
    assert.equal(existsSync(sentPathOf(root)), false, "Do not record reporting that was not sent");
  } finally {
    await hang.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("Tracked instance files must not contain token-shaped strings", () => {
  const root = makeTestDir('aipa-rep-');
  try {
    toBeta(root);
    const tracked = execFileSync('git', ['-C', root, 'ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
    assert.ok(tracked.length > 0, "Precondition: the instance is a Git worktree");

    const credLike = /(token|password|secret|apikey|api_key)\s*[:=]\s*["']?[A-Za-z0-9_-]{16,}/i;
    const bad = tracked.filter((f) => credLike.test(readFileSync(join(root, f), 'utf8')));
    assert.deepEqual(bad, [], "Tracked files must contain no token-shaped strings");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Unreachable API base degrades with exit 0 and a notice, without stack traces or bookkeeping", async () => {
  const root = makeTestDir('aipa-rep-');
  const base = await closedBase();
  try {
    toBeta(root);
    writeErrors(root, ERRORS);
    const r = await runReportAsync(root, ['--api-base', base, '--token', 'tok-abc']);
    assert.equal(r.status, 0, "Network failure must degrade gracefully with exit 0 without failing the main workflow");
    assert.match(r.stderr, /Reporting failed|degraded/, "Include an explanatory line");
    assert.doesNotMatch(r.stderr, /at .*aipa-report\.mjs:\d+/, "Do not expose a stack trace to the user");
    assert.equal(r.stdout.includes("Reported"), false, "Do not falsely report success");
    assert.equal((r.stdout + r.stderr).includes('tok-abc'), false, "The fallback message must not echo the token");
    assert.equal(existsSync(sentPathOf(root)), false, "Failed sending must not record delivery (otherwise the next attempt is silently rate-limited)");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("AIPA_GITHUB_API and --api-base use the same injection point", async () => {
  const root = makeTestDir('aipa-rep-');
  const github = await startFakeGitHub();
  try {
    toBeta(root);
    writeErrors(root, ERRORS);
    await runReportAsync(root, ['--token', 'tok-abc'], { env: { ...process.env, AIPA_GITHUB_API: github.base } });
    assert.equal(github.requests.length, 2, "The environment override must take effect rather than contacting the real default endpoint");
  } finally {
    await github.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('Pagination searches all states, ignores pull requests, and appends to a matching closed issue on page 2', async () => {
  const root = makeTestDir('aipa-rep-');
  const fp = fpOf(ERRORS);
  const github = await startFakeGitHub({ pages: [
    [{ number: 3, title: `[Diagnostics] beta 1.0.0 (${fp})`, pull_request: { url: 'synthetic' } }],
    [{ number: 29, title: `[Diagnostics] beta 1.0.0 (${fp})`, state: 'closed' }],
  ] });
  try {
    toBeta(root); writeErrors(root, ERRORS);
    const result = await runReportAsync(root, ['--api-base', github.base, '--token', 'tok-abc']);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(github.requests.map((row) => row.method), ['GET', 'GET', 'POST']);
    assert.deepEqual(github.requests.slice(0, 2).map((row) => row.query), [1, 2].map((page) => ({ state: 'all', sort: 'updated', direction: 'desc', per_page: '100', page: String(page) })));
    assert.match(github.requests[2].path, /\/issues\/29\/comments$/);
    assert.deepEqual(Object.keys(JSON.parse(github.requests[2].raw)), ['body']);
    assert.equal(JSON.parse(readFileSync(sentPathOf(root), 'utf8'))[fp] !== undefined, true);
  } finally { await github.close(); rmSync(root, { recursive: true, force: true }); }
});

test('A final unmatched page creates one issue with GitHub title/body fields', async () => {
  const root = makeTestDir('aipa-rep-');
  const github = await startFakeGitHub({ pages: [ [{ number: 1, title: 'Unrelated issue' }], [] ] });
  try {
    toBeta(root); writeErrors(root, ERRORS);
    const result = await runReportAsync(root, ['--api-base', github.base, '--token', 'tok-abc']);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(github.requests.map((row) => row.method), ['GET', 'GET', 'POST']);
    const created = JSON.parse(github.requests[2].raw);
    assert.deepEqual(Object.keys(created).sort(), ['body', 'title']);
    assert.match(created.title, /^\[Diagnostics\] beta /);
    const payload = JSON.parse(created.body.slice('```json\n'.length, -'\n```'.length));
    assert.equal(payload.errors[0].message.includes('SEKRET123'), false);
  } finally { await github.close(); rmSync(root, { recursive: true, force: true }); }
});

test('Pagination accepts GitHub numeric repository links but never copies header query changes', async () => {
  const root = makeTestDir('aipa-rep-');
  const github = await startFakeGitHub({ pages: [[], []], linkForPage: (page, host) => page === 1 ? `<http://${host}/repositories/123/issues?page=2&state=open>; rel="next"` : '' });
  try {
    toBeta(root); writeErrors(root, ERRORS);
    const result = await runReportAsync(root, ['--api-base', github.base, '--token', 'tok-abc']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(github.requests[1].path, '/repos/StriveJ/artificial-intelligence-origin-agent/issues');
    assert.equal(github.requests[1].query.state, 'all');
    assert.equal(github.requests.filter((row) => row.method === 'POST').length, 1);
  } finally { await github.close(); rmSync(root, { recursive: true, force: true }); }
});

test('Unsafe and cyclic pagination links stop before mutation or credential forwarding', async () => {
  for (const next of [
    'https://untrusted.invalid/issues?page=2',
    '/repos/StriveJ/unrelated/issues?page=2',
    '/repos/StriveJ/artificial-intelligence-origin-agent/issues?page=1',
    '/repos/StriveJ/artificial-intelligence-origin-agent/issues?page=500',
  ]) {
    const root = makeTestDir('aipa-rep-');
    const github = await startFakeGitHub({ linkForPage: () => `<${next}>; rel="next"` });
    try {
      toBeta(root); writeErrors(root, ERRORS);
      const result = await runReportAsync(root, ['--api-base', github.base, '--token', 'tok-abc']);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stderr, /pagination/);
      assert.equal(github.requests.length, 1);
      assert.equal(existsSync(sentPathOf(root)), false);
      assert.doesNotMatch(result.stderr, /tok-abc/);
    } finally { await github.close(); rmSync(root, { recursive: true, force: true }); }
  }
});

test('Incomplete bounded search never creates a potentially duplicate issue', async () => {
  const root = makeTestDir('aipa-rep-');
  const github = await startFakeGitHub({ linkForPage: (page, host, path) => `<http://${host}${path}?page=${page + 1}>; rel="next"` });
  try {
    toBeta(root); writeErrors(root, ERRORS);
    const result = await runReportAsync(root, ['--api-base', github.base, '--token', 'tok-abc']);
    assert.equal(result.status, 0);
    assert.match(result.stderr, /deduplication is incomplete/);
    assert.equal(github.requests.length, 100);
    assert.equal(github.requests.every((row) => row.method === 'GET'), true);
    assert.equal(existsSync(sentPathOf(root)), false);
  } finally { await github.close(); rmSync(root, { recursive: true, force: true }); }
});

test('GitHub authorization, validation, rate limits, and server failures degrade without delivery records or retries', async () => {
  for (const [status, writeStatus] of [[401, 201], [403, 201], [429, 201], [500, 201], [200, 403], [200, 422], [200, 503]]) {
    const root = makeTestDir('aipa-rep-');
    const github = await startFakeGitHub({ status, writeStatus });
    try {
      toBeta(root); writeErrors(root, ERRORS);
      const result = await runReportAsync(root, ['--api-base', github.base, '--token', 'tok-abc']);
      assert.equal(result.status, 0, `GET ${status}, POST ${writeStatus}: ${result.stderr}`);
      assert.match(result.stderr, /degraded/);
      assert.equal(github.requests.length, status === 200 ? 2 : 1);
      assert.equal(existsSync(sentPathOf(root)), false);
      assert.doesNotMatch(result.stdout, /Reported/);
      assert.doesNotMatch(result.stdout + result.stderr, /tok-abc/);
    } finally { await github.close(); rmSync(root, { recursive: true, force: true }); }
  }
});

test('Redirect responses do not forward credentials or write delivery records', async () => {
  const root = makeTestDir('aipa-rep-');
  const target = await startFakeGitHub();
  const github = await startFakeGitHub({ redirect: target.base + '/repos/StriveJ/artificial-intelligence-origin-agent/issues' });
  try {
    toBeta(root); writeErrors(root, ERRORS);
    const result = await runReportAsync(root, ['--api-base', github.base, '--token', 'tok-abc']);
    assert.equal(result.status, 0);
    assert.match(result.stderr, /degraded/);
    assert.equal(target.requests.length, 0);
    assert.equal(existsSync(sentPathOf(root)), false);
  } finally { await github.close(); await target.close(); rmSync(root, { recursive: true, force: true }); }
});

test('One deadline bounds the full paginated scan rather than restarting on each page', async () => {
  const root = makeTestDir('aipa-rep-');
  const github = await startFakeGitHub({ pages: [[], [], []], delayForPage: 250 });
  try {
    toBeta(root); writeErrors(root, ERRORS);
    const result = await runReportAsync(root, ['--api-base', github.base, '--token', 'tok-abc', '--timeout-ms', '400']);
    assert.equal(result.status, 0);
    assert.match(result.stderr, /degraded/);
    assert.equal(github.requests.some((row) => row.method === 'POST'), false);
    assert.equal(existsSync(sentPathOf(root)), false);
  } finally { await github.close(); rmSync(root, { recursive: true, force: true }); }
});

test('Invalid endpoint or timeout settings fail before requests or device identity writes', async () => {
  for (const extra of [
    ['--api-base', 'http://example.invalid'],
    ['--api-base', 'https://synthetic:credential@example.invalid'],
    ['--api-base', 'https://example.invalid?token=synthetic'],
    ['--timeout-ms', 'NaN'],
    ['--timeout-ms', '-1'],
  ]) {
    const root = makeTestDir('aipa-rep-');
    try {
      toBeta(root); writeErrors(root, ERRORS);
      const before = snapshot(root);
      const result = await runReportAsync(root, [...extra, '--token', 'tok-abc']);
      assert.equal(result.status, 0);
      assert.match(result.stderr, /degraded/);
      assert.deepEqual(snapshot(root), before);
      assert.doesNotMatch(result.stdout + result.stderr, /tok-abc|synthetic:credential/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});
