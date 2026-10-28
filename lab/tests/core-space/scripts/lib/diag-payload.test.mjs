// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayload, redact, fingerprint } from '../../../../../product/core-space/scripts/lib/diag-payload.mjs';





const SENSITIVE_MESSAGE = 'Error: boom token=abc123 at /home/example-user/secret-project/x.mjs';

const LINES = [
  JSON.stringify({ ts: '2026-09-15T01:00:00Z', scope: 'hook', message: 'Error: boom', extra: 'token=abc123' }),
  JSON.stringify({ ts: '2026-09-15T01:02:00Z', scope: 'hook', message: SENSITIVE_MESSAGE }),
  JSON.stringify({ ts: '2026-09-15T01:05:00Z', scope: 'cli', message: 'Error: boom' }),



  JSON.stringify({ ts: '2026-09-15T01:06:00Z', scope: 'hook', message: 'Error: boom at /var/lib/secret-project/x.log' }),
  JSON.stringify({ ts: '2026-09-15T01:07:00Z', scope: 'hook', message: 'Error: boom at C:\\Users\\me\\secret-project\\x.mjs' }),
  "\u4e0d\u662f JSON \u7684\u884c /home/example-user/secret-project \u91cc\u7684\u4e1c\u897f",
].join('\n');

test("Final diagnostics exclude Bearer values, quoted JSON credentials, and whitespace-containing credentials", () => {
  const values = ['Bearer FAKE_CREDENTIAL_12345', '"api_key": "FAKE_CREDENTIAL_12345"', "password='FAKE CREDENTIAL VALUE'"];
  for (const value of values) {
    const payload = buildPayload({ version: '0.23.0-beta.2', channel: 'beta', deviceId: 'dev-1', errorLines: JSON.stringify({ ts: value, scope: value, message: 'Error: ' + value }) });
    const text = JSON.stringify(payload);
    assert.equal(text.includes('FAKE_CREDENTIAL'), false);
    assert.equal(text.includes('FAKE CREDENTIAL'), false);
    assert.ok(payload.errors[0].message.includes('Error'));
  }
});

test("Produce structured fields only, without original content", () => {
  const p = buildPayload({ version: '0.20.0-beta.1', channel: 'beta', deviceId: 'dev-1', errorLines: LINES });
  const s = JSON.stringify(p);
  assert.equal(s.includes('token=abc123'), false, "Do not include tokens");
  assert.equal(s.includes('secret-project'), false, "Do not include raw file paths");
  assert.equal(s.includes('boom'), true, "Retain the redacted error message for diagnosis");
  assert.equal(typeof p.version, 'string');
  assert.equal(p.channel, 'beta');
  assert.equal(typeof p.deviceId, 'string');
  assert.equal(Array.isArray(p.errors), true);
});

test("redact removes sensitive key/value values", () => {
  assert.equal(redact('token=abc123').includes('abc123'), false);
  assert.equal(redact('password: hunter2').includes('hunter2'), false);
  assert.equal(redact("\u666e\u901a\u6587\u672c\u4fdd\u7559").includes("\u666e\u901a\u6587\u672c"), true);
});

test("fingerprints are stable for identical error sets and differ for different sets", () => {



  const mk = (errorLines, version = '1') => buildPayload({ version, channel: 'beta', deviceId: 'd', errorLines });
  const a = mk('{"scope":"hook","message":"Error: boom"}\n{"scope":"hook","message":"Error: boom"}');
  const b = mk('{"scope":"hook","message":"Error: boom"}');
  const c = mk('{"scope":"hook","message":"Error: other"}');
  assert.equal(fingerprint(a), fingerprint(b), "Same error kinds with different counts have the same fingerprint");
  assert.notEqual(fingerprint(a), fingerprint(c));

  assert.equal(a.errors.length, 1, "Merge equivalent error rows");
  assert.equal(a.errors[0].count, 2, "Two occurrences of one error yield count 2");

  assert.equal(fingerprint(b), fingerprint(mk('{"scope":"hook","message":"Error: boom"}', '9.9.9')), "Fingerprint depends on the error set, not version");


  const d = mk('{"scope":"hook","message":"Error: boom"}\n{"scope":"cli","message":"Error: other"}');
  const e = mk('{"scope":"cli","message":"Error: other"}\n{"scope":"hook","message":"Error: boom"}');
  assert.equal(fingerprint(d), fingerprint(e), "The same error set in a different order has the same fingerprint");
});

test("Non-JSON lines retain no distinguishing content (intentional structural exclusion)", () => {


  const mk = (errorLines) => buildPayload({ version: '1', channel: 'beta', deviceId: 'd', errorLines });
  const p1 = mk('Error: boom');
  const p2 = mk('Error: other');
  assert.equal(p1.errors.length, 1);
  assert.equal(p1.errors[0].message, "[unstructured line]");
  assert.equal(p1.errors[0].kind, 'error');
  assert.equal(fingerprint(p1), fingerprint(p2), "Non-JSON lines retain no distinguishing content and share a fingerprint");
});

test("Second defense: exclude non-home POSIX and Windows paths (F 3)", () => {


  const mk = (message) => buildPayload({ version: '1', channel: 'beta', deviceId: 'd', errorLines: JSON.stringify({ scope: 'hook', message }) });
  const posix = mk('see /var/lib/secret-project/x.log');
  assert.equal(posix.errors[0].message, "see [path]", "The second layer must redact non-home POSIX paths as [path]");
  assert.equal(JSON.stringify(posix).includes('secret-project'), false, "Do not disclose project names");
  const win = mk('see C:\\Users\\me\\secret-project\\x.mjs');
  assert.equal(win.errors[0].message, "see [redacted]", "redact must remove Windows paths");
  assert.equal(JSON.stringify(win).includes('secret-project'), false, "Do not disclose project names");
});

test("Redact and limit ts/scope instead of copying them verbatim (F 1)", () => {

  const mk = (row) => buildPayload({ version: '1', channel: 'beta', deviceId: 'd', errorLines: JSON.stringify(row) });
  const byScope = mk({ scope: '/home/example-user/secret-project', message: 'Error: boom' });
  assert.equal(JSON.stringify(byScope).includes('secret-project'), false, "Sensitive scope strings must not enter the payload");
  const byTs = mk({ ts: 'token=abc123', scope: 'hook', message: 'Error: boom' });

  const scopePath = mk({ scope: '/var/lib/secret-project', message: 'Error: boom' });
  assert.equal(JSON.stringify(scopePath).includes('secret-project'), false, "Do not disclose non-home paths in scope");
  const tsPath = mk({ ts: '/var/lib/secret-project', scope: 'hook', message: 'Error: boom' });
  assert.equal(JSON.stringify(tsPath).includes('secret-project'), false, "Do not disclose non-home paths in ts");
  assert.equal(JSON.stringify(byTs).includes('token=abc123'), false, "Sensitive timestamp strings must not enter the payload");
  const long = mk({ scope: 'x'.repeat(300), message: 'Error: boom' });
  assert.equal(long.errors[0].scope.length, 64, "Truncate oversized scope to 64");
});

test("Fingerprint key encoding is unambiguous: distinct error sets must differ (F 2)", () => {


  const mk = (errorLines) => buildPayload({ version: '1', channel: 'beta', deviceId: 'd', errorLines });
  const s1 = mk('{"scope":"a","message":"x"}\n{"scope":"a","message":"y"}');
  const s2 = mk(JSON.stringify({ scope: 'a', message: 'x\na|other|y' }));
  assert.equal(s1.errors.length, 2, "Set 1 has two errors");
  assert.equal(s2.errors.length, 1, "Set 2 has one error");
  assert.notEqual(fingerprint(s1), fingerprint(s2), "Distinct error sets must not share a hash");
});

test("Merge keys are also unambiguous: distinct errors must not collapse (F 2 family)", () => {


  const mk = (rows) => buildPayload({ version: '1', channel: 'beta', deviceId: 'd', errorLines: rows.map((r) => JSON.stringify(r)).join('\n') });
  const p = mk([
    { scope: 'a', message: 'b|other|c' },
    { scope: 'a|other|b', message: 'c' },
  ]);
  assert.equal(p.errors.length, 2, "Two distinct errors must remain separate");
  assert.deepEqual(p.errors.map((e) => e.count), [1, 1], "Each occurs once, so both counts are 1");
});
