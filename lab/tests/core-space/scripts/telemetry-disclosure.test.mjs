// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.

//







//





import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from './lib/test-tmp.mjs';

import { TELEMETRY_DISCLOSURE, UPLOAD_SCOPE } from '../../../../product/core-space/scripts/lib/telemetry-disclosure.mjs';
import { renderDashboard } from '../../../../product/core-space/scripts/lib/dashboard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PRODUCT = join(HERE, '..', '..', '..', '..', 'product');
const INIT = join(PRODUCT, 'scripts', 'aipa-init.mjs');
const DASH = join(PRODUCT, 'core-space', 'scripts', 'aipa-dashboard.mjs');
const CH = join(PRODUCT, 'core-space', 'scripts', 'aipa-channel.mjs');
const manifestOf = (root) => join(root, 'AIPA-MANIFEST.yaml');
const run = (script, args) => execFileSync('node', [script, ...args], { encoding: 'utf8' });



function footer(root) {
  run(DASH, ['--root', root]);
  const html = readFileSync(join(root, 'user-space', 'logs', 'dashboard.html'), 'utf8');
  const m = html.match(/<footer>[\s\S]*?<\/footer>/);
  assert.ok(m, "Dashboard HTML has no footer section");
  return m[0];
}
function withTestRoot(fn) {
  const root = makeTestDir('aipa-td-');
  try { fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}


const newInstance = (root) => run(INIT, ['--root', root, '--owner', 't']);

test("The stable footer still states no network/no upload", () => {
  withTestRoot((root) => {
    newInstance(root);
    assert.match(footer(root), /No network access or upload/);
  });
});

test("Beta with consent no longer makes an unconditional footer claim", () => {
  withTestRoot((root) => {
    newInstance(root);


    run(CH, ['--root', root, '--telemetry', 'on']);
    run(CH, ['--root', root, '--set', 'beta']);
    const f = footer(root);
    assert.doesNotMatch(f, /No network access or upload/);
    assert.match(f, /Beta|diagnostic/);
  });
});




test("Stable with consent still states no network/no upload because reporting is not enabled", () => {
  withTestRoot((root) => {
    newInstance(root);
    run(CH, ['--root', root, '--telemetry', 'on']);

    const m = readFileSync(manifestOf(root), 'utf8');
    assert.match(m, /^[ \t]+channel:[ \t]*stable/m, "Precondition: channel is stable");
    assert.match(m, /^[ \t]+telemetry:[ \t]*on/m, "Precondition: telemetry consent is enabled");
    const f = footer(root);
    assert.match(f, /No network access or upload/);
    assert.doesNotMatch(f, /Beta/);
  });
});

test("An unreadable manifest falls back to stable footer wording rather than omitting disclosure", () => {
  withTestRoot((root) => {
    assert.match(footer(root), /No network access or upload/);
  });
});

test("An unknown channel (canary) falls back to stable without beta wording", () => {
  withTestRoot((root) => {
    newInstance(root);

    run(CH, ['--root', root, '--telemetry', 'on']);
    run(CH, ['--root', root, '--set', 'beta']);


    writeFileSync(manifestOf(root), readFileSync(manifestOf(root), 'utf8').replace(/^([ \t]*)channel:[ \t]*\S*/m, '$1channel: canary'), 'utf8');
    const f = footer(root);
    assert.match(f, /No network access or upload/);
    assert.doesNotMatch(f, /Beta/);
  });
});



test("Footer discloses the explicitly selected instance's actual state", () => {
  withTestRoot((root) => {
    writeFileSync(manifestOf(root), 'aipa:\n  version: 0.19.0\n  channel: beta\n  telemetry: on\n', 'utf8');
    assert.match(renderDashboard({ generatedAt: '2026-09-16 10:00:00', sections: [], root }), /Beta/);
  });
});








test("Without an explicit root, use stable wording and do not substitute argv --root", () => {
  const grey = makeTestDir('aipa-td-');
  const savedArgv = process.argv;
  try {
    writeFileSync(join(grey, 'AIPA-MANIFEST.yaml'), 'aipa:\n  version: 0.19.0\n  channel: beta\n  telemetry: on\n', 'utf8');
    process.argv = [...savedArgv, '--root', grey];
    for (const opts of [{}, { root: '' }]) {
      const html = renderDashboard({ generatedAt: '2026-09-16 10:00:00', sections: [], ...opts });
      assert.match(html, /No network access or upload/);
      assert.doesNotMatch(html, /Beta/);
    }
  } finally {
    process.argv = savedArgv;
    rmSync(grey, { recursive: true, force: true });
  }
});












const UPLOAD_SCOPE_TOKENS = ["version", "channel", "anonymous device ID", "time", "script names", "kinds", "counts", "message", "memory"];

test("Footer, disclosure, and privacy.yaml share exact diagnostic scope without missing fields", () => {
  const copies = {
    footer: (() => {
      const root = makeTestDir('aipa-td-');
      try {
        writeFileSync(join(root, 'AIPA-MANIFEST.yaml'), 'aipa:\n  version: 0.19.0\n  channel: beta\n  telemetry: on\n', 'utf8');
        return footer(root);
      } finally { rmSync(root, { recursive: true, force: true }); }
    })(),
    disclosure: TELEMETRY_DISCLOSURE.join('\n'),
    'privacy.yaml': readFileSync(join(PRODUCT, 'user-space', 'privacy.yaml'), 'utf8'),
  };
  for (const [where, text] of Object.entries(copies)) {
    assert.ok(text.includes(UPLOAD_SCOPE),
      `${where} does not include UPLOAD_SCOPE verbatim (the single reporting-scope source in lib/telemetry-disclosure.mjs); the disclosures have diverged. `
      + `Copy the scope from its source instead of rewriting it: ${UPLOAD_SCOPE}`);
    for (const token of UPLOAD_SCOPE_TOKENS) {
      assert.ok(text.includes(token), `${where} reporting scope omits \"${token}\"; a missing field combined with an exclusive-scope claim is misleading`);
    }
  }
});

test("Constraints distinguish component dependencies/external authorization; stable diagnostics remain nonproactive", () => {
  const doc = readFileSync(join(PRODUCT, 'core-space', 'CONSTRAINTS.md'), 'utf8');
  const row = (doc.match(/^\| Local first; external capabilities require explicit authorization \|.*$/m) || [])[0] || '';
  assert.ok(row, "CONSTRAINTS.md has no local-first row");
  assert.match(row, /user's existing authorization/, "External models/capabilities remain within user authorization");
  assert.match(row, /A configured network service does not authorize transmitting all information/, "Configuration presence does not authorize transmitting all information");
  const dependency=doc.match(/^\| Files are authoritative; Core has no third-party package dependencies \|.*$/m)?.[0]||'';
  assert.match(dependency,/Node\.js/);assert.match(dependency,/Git/);assert.match(dependency,/Hub, host executors, and optional services declare their own dependencies/);
  assert.match(TELEMETRY_DISCLOSURE.join('\n'),/stable never reports proactively/, "Correcting whole-system network wording must not relax diagnostic restrictions");
});
