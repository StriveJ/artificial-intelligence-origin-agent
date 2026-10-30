import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, unlinkSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDir } from '../core-space/scripts/lib/test-tmp.mjs';

const product = fileURLToPath(new URL('../../../product/', import.meta.url));
const init = join(product, 'scripts/aipa-init.mjs');
const script = (name) => join(product, 'core-space/scripts', name + '.mjs');
const run = (file, args, cwd) => execFileSync(process.execPath, [file, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });
const load = (root, project) => JSON.parse(run(script('aipa-load'), ['--root', root, '--context', '--host', 'ide', '--project', project], root));

test('Default and relative init destinations scaffold the project resolved for first activation', () => {
  for (const mode of ['default', 'dot', 'relative']) {
    const root = makeTestDir('aipa-init-project-');
    try {
      const rootArgs = mode === 'default' ? [] : ['--root', mode === 'dot' ? '.' : '../' + basename(root)];
      run(init, [...rootArgs, '--owner', 'Synthetic Owner'], root);
      const project = JSON.parse(run(script('aipa-project'), ['resolve', '--root', root, '--cwd', root], root));
      assert.equal(project.id, basename(root));
      assert.ok(existsSync(join(root, 'user-space/projects', project.id, 'project.yaml')));
      const context = load(root, project.id);
      assert.equal(context.status, 'ready', JSON.stringify(context));
      assert.ok(context.sections.some((s) => s.id === `file:user-space/projects/${project.id}/project.yaml`));
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('Explicit project IDs resolve through ignored local mappings and missing rules give an actionable block', () => {
  const work = makeTestDir('aipa-init-project-'), root = join(work, 'instance with spaces');
  const id = 'synthetic-own-project', owner = 'Synthetic "Owner"', industry = 'software: tools';
  try {
    run(init, ['--root', root, '--owner', owner, '--industry', industry, '--project', id], work);
    const dir = join(root, 'user-space/projects', id), rule = readFileSync(join(dir, 'project.yaml'), 'utf8');
    assert.ok(rule.includes('project_name: ' + JSON.stringify(owner + ' AIPA instance')));
    assert.ok(rule.includes('industry: ' + JSON.stringify(industry)));
    assert.equal(readFileSync(join(dir, 'local_path'), 'utf8').trim(), resolve(root));
    assert.equal(execFileSync('git', ['-C', root, 'ls-files', '--', `user-space/projects/${id}/local_path`], { encoding: 'utf8' }), '');
    for (const cwd of [root, join(root, 'core-space')]) {
      const project = JSON.parse(run(script('aipa-project'), ['resolve', '--root', root, '--cwd', cwd], root));
      assert.equal(project.id, id);
      assert.equal(project.source, 'repo');
      assert.equal(load(root, project.id).status, 'ready');
    }
    unlinkSync(join(dir, 'project.yaml'));
    const blocked = spawnSync(process.execPath, [script('aipa-load'), '--root', root, '--context', '--host', 'ide', '--project', id], { encoding: 'utf8' });
    assert.equal(blocked.status, 2, blocked.stderr);
    const result = JSON.parse(blocked.stdout);
    assert.equal(result.code, 'required_context_unavailable');
    assert.deepEqual(result.sections, []);
    assert.deepEqual(result.issues, [{ id: `file:user-space/projects/${id}/project.yaml`, reason: 'missing', action: `create user-space/projects/${id}/project.yaml` }]);
  } finally { rmSync(work, { recursive: true, force: true }); }
});

test('Invalid project IDs fail before writing any instance or traversing outside its project directory', () => {
  const work = makeTestDir('aipa-init-project-');
  try {
    const cases = ['../escape', '..\\escape', '.', '..', 'nested/project', 'invalid:project', 'id with spaces', ''];
    for (const [index, id] of cases.entries()) {
      const root = join(work, 'instance-' + index);
      const result = spawnSync(process.execPath, [init, '--root', root, '--project', id], { encoding: 'utf8', cwd: work });
      assert.equal(result.status, 1, `Unexpected success for ${JSON.stringify(id)}`);
      assert.match(result.stderr, /Project ID/);
      assert.equal(existsSync(root), false, 'Invalid IDs must not leave partially initialized instances');
    }
    const root = join(work, 'unsuitable directory');
    const result = spawnSync(process.execPath, [init, '--root', root], { encoding: 'utf8', cwd: work });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--project/);
    assert.deepEqual(readdirSync(work), []);
  } finally { rmSync(work, { recursive: true, force: true }); }
});
