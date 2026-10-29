
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { assertWithin, safeRelativePath } from '../../product/core-space/scripts/lib/safe-path.mjs';

export const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const LAB_ROOT = join(SOURCE_ROOT, 'lab', '.upgrade-runs');
const MARKER = '.aipa-synthetic.json';

export function createSyntheticFixture({ parent, prefix = 'repair-' } = {}) {
  if (!parent) throw new Error("A synthetic test root must be supplied explicitly");
  if (!/^[a-z0-9-]+$/.test(prefix)) throw new Error("Invalid synthetic directory prefix");
  const allowed = assertWithin(LAB_ROOT, resolve(parent), { allowRoot: true, rejectLinks: true });
  mkdirSync(allowed, { recursive: true });
  const root = mkdtempSync(join(allowed, prefix)), token = randomUUID();
  writeFileSync(join(root, MARKER), JSON.stringify({ schema: 1, kind: 'synthetic-only', token }));
  const checked = target => {
    if (!target) throw new Error("A synthetic target must be supplied explicitly");
    const path = assertWithin(root, resolve(target), { allowRoot: true, rejectLinks: true });
    const marker = JSON.parse(readFileSync(join(root, MARKER), 'utf8'));
    if (marker.kind !== 'synthetic-only' || marker.token !== token) throw new Error("Synthetic root identity differs");
    return path;
  };
  function path(rel) { return checked(join(root, safeRelativePath(rel))); }
  function put(rel, bytes) { const file = path(rel); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bytes); return file; }
  const home = path('home'); mkdirSync(home);
  const env = () => ({
    ...Object.fromEntries(['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC'].filter(k => process.env[k]).map(k => [k, process.env[k]])),
    HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home,
    XDG_CONFIG_HOME: home, XDG_DATA_HOME: home, XDG_STATE_HOME: home,
    TEMP: root, TMP: root, TMPDIR: root, AIPA_TEST_TMP: root,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(home, 'empty.gitconfig'),
    // Keep long-path handling explicit while excluding developer Git configuration.
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.longpaths', GIT_CONFIG_VALUE_0: 'true',
    GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GIT_CEILING_DIRECTORIES: root,
  });
  function instance(name = 'instance') {
    const instanceRoot = path(name); mkdirSync(instanceRoot);
    put(name + '/AIPA-MANIFEST.yaml', 'aipa:\n  version: 0.23.0-beta.4\n  owner: Synthetic\n  mode: consume\n');
    put(name + '/user-space/privacy.yaml', 'upload_policy:\n  mode: ask\n');
    return instanceRoot;
  }
  function config(value) {
    if (!value?.root || !value?.runtimeDir) throw new Error("Synthetic configuration requires explicit root/runtimeDir");
    checked(value.root); checked(value.runtimeDir);
    if (value.testMode !== true || Object.keys(value).some(key=>!['root','runtimeDir','testMode'].includes(key))) throw new Error("Real installations, remotes, or credential configuration are rejected");
    return value;
  }
  function run(script, target, args = []) {
    checked(target);
    if (args.some(a => /^--(?:root|config|remote|url|endpoint)(?:=|$)/.test(a))) throw new Error("Fixture commands must not overwrite instances or connect to real remotes");
    const command = assertWithin(join(SOURCE_ROOT, 'product'), resolve(script), { rejectLinks: true });
    if (!existsSync(command)) throw new Error("Public script does not exist");
    return spawnSync(process.execPath, [command, '--root', target, ...args], { cwd: root, env: env(), encoding: 'utf8', timeout: 30_000, windowsHide: true });
  }
  return { root, path, put, checked, instance, config, env, run };
}
