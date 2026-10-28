// Unicode-escaped synthetic fixtures exercise native input and legacy persisted formats.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';

// =============================================================================

//


//





//        —— `import './../user-space/scripts/helper.mjs'`、
//           `spawnSync(node,[join(root,'user-space','scripts','helper.mjs')])`。
//



//


// =============================================================================

// -----------------------------------------------------------------------------


// -----------------------------------------------------------------------------
const KEYWORDS_BEFORE_REGEX = new Set([
  'return', 'typeof', 'case', 'in', 'of', 'do', 'else', 'void', 'new',
  'delete', 'instanceof', 'yield', 'await', 'throw',
]);


function regexPossible(prev) {
  if (!prev) return true;
  if (prev.type !== 'ident' && prev.type !== 'punct') return false;
  if (prev.type === 'ident') return KEYWORDS_BEFORE_REGEX.has(prev.value);
  return prev.value !== ')' && prev.value !== ']';
}


function readStringEnd(src, start) {
  const quote = src[start];
  const isTpl = quote === '`';
  const n = src.length;
  let i = start + 1;
  while (i < n) {
    const ch = src[i];
    if (ch === '\\') { i += 2; continue; }
    if (isTpl && ch === '$' && src[i + 1] === '{') {
      i += 2;
      let depth = 1;
      while (i < n && depth > 0) {
        const cj = src[i];
        if (cj === "'" || cj === '"' || cj === '`') { i = readStringEnd(src, i); continue; }
        if (cj === '{') depth += 1;
        else if (cj === '}') depth -= 1;
        i += 1;
      }
      continue;
    }
    if (ch === quote) return i + 1;
    i += 1;
  }
  return n;
}


function readRegexEnd(src, start) {
  const n = src.length;
  let i = start + 1;
  let inClass = false;
  while (i < n && src[i] !== '\n') {
    const ch = src[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) return i + 1;
    i += 1;
  }
  return -1;
}

const nlCount = (s) => (s.match(/\n/g) || []).length;

function tokenize(src) {
  const tokens = [];
  const n = src.length;
  let i = 0;
  let line = 1;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line += 1; i += 1; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i += 1; continue; }

    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i += 1; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const s = i;
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      line += nlCount(src.slice(s, i));
      continue;
    }

    if (c === '/' && regexPossible(tokens[tokens.length - 1])) {
      const end = readRegexEnd(src, i);
      if (end > 0) { tokens.push({ type: 'regex', value: src.slice(i, end), line }); i = end; continue; }
      tokens.push({ type: 'punct', value: '/', line });
      i += 1;
      continue;
    }

    if (c === "'" || c === '"' || c === '`') {
      const end = readStringEnd(src, i);
      const raw = src.slice(i, end);
      tokens.push({
        type: c === '`' ? 'template' : 'string',
        value: raw.slice(1, raw.endsWith(c) && raw.length > 1 ? -1 : undefined),
        hasExpr: c === '`' && raw.includes('${'),
        line,
      });
      line += nlCount(raw);
      i = end;
      continue;
    }

    if (/[A-Za-z_$]/.test(c)) {
      const s = i;
      while (i < n && /[A-Za-z0-9_$]/.test(src[i])) i += 1;
      tokens.push({ type: 'ident', value: src.slice(s, i), line });
      continue;
    }

    if (/[0-9]/.test(c)) {
      const s = i;
      while (i < n && /[0-9a-fA-FxX._n]/.test(src[i])) i += 1;
      tokens.push({ type: 'number', value: src.slice(s, i), line });
      continue;
    }

    tokens.push({ type: 'punct', value: c, line });
    i += 1;
  }
  return tokens;
}

// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------

function matchingBracket(tokens, openIndex) {
  const open = tokens[openIndex].value;
  const close = open === '{' ? '}' : open === '(' ? ')' : ']';
  let depth = 0;
  for (let k = openIndex; k < tokens.length; k += 1) {
    const t = tokens[k];
    if (t.type !== 'punct') continue;
    if (t.value === open) depth += 1;
    else if (t.value === close) { depth -= 1; if (depth === 0) return k; }
  }
  return -1;
}


function statementEnd(tokens, from) {
  let depth = 0;
  for (let k = from; k < tokens.length; k += 1) {
    const t = tokens[k];
    if (t.type !== 'punct') continue;
    if (t.value === '(' || t.value === '[' || t.value === '{') depth += 1;
    else if (t.value === ')' || t.value === ']' || t.value === '}') { if (depth === 0) return k; depth -= 1; }
    else if (t.value === ';' && depth === 0) return k;
  }
  return tokens.length;
}

// -----------------------------------------------------------------------------


// -----------------------------------------------------------------------------
const CODE_SINK_IDENTS = new Set([
  'spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork',
  'require', 'createRequire',
]);




const CODE_FILE_RE = /\.(?:mjs|cjs|js|jsx|ts|tsx|sh|bash|zsh|ps1|py|rb|pl)$/i;



function collectChildProcessNames(tokens) {
  const names = new Set();
  for (let k = 0; k < tokens.length; k += 1) {
    const t = tokens[k];
    if (t.type !== 'ident' || t.value !== 'import') continue;
    let from = -1;
    for (let j = k + 1; j < tokens.length && j < k + 80; j += 1) {
      if (tokens[j].type === 'punct' && tokens[j].value === ';') break;
      if (tokens[j].type === 'ident' && tokens[j].value === 'from') { from = j; break; }
    }
    if (from < 0) continue;
    const spec = tokens[from + 1];
    if (!spec || (spec.type !== 'string' && spec.type !== 'template')) continue;
    if (spec.value !== 'node:child_process' && spec.value !== 'child_process') continue;
    for (let j = k + 1; j < from; j += 1) {
      const tj = tokens[j];
      if (tj.type !== 'ident' || tj.value === 'from' || tj.value === 'as') continue;
      if (tokens[j - 1] && tokens[j - 1].type === 'ident' && tokens[j - 1].value === 'as') continue;
      names.add(tj.value);
    }
  }
  return names;
}


function ambiguousSinkBound(tokens, k, cpNames) {
  const t = tokens[k];
  if (t.value !== 'exec') return true;
  if (cpNames.has('exec')) return true;
  const dot = tokens[k - 1];
  const obj = tokens[k - 2];
  return Boolean(dot && dot.value === '.' && obj && obj.type === 'ident' && cpNames.has(obj.value));
}

function findSinks(tokens) {
  const sinks = [];
  const cpNames = collectChildProcessNames(tokens);
  for (let k = 0; k < tokens.length; k += 1) {
    const t = tokens[k];
    if (t.type !== 'ident') continue;
    if (t.value === 'import' || t.value === 'export') {
      const nx = tokens[k + 1];
      if (t.value === 'import' && nx && (nx.type === 'string' || nx.type === 'template')) {
        sinks.push({ kind: 'import', from: k + 1, to: k + 1 });
        continue;
      }
      if (t.value === 'import' && nx && nx.type === 'punct' && nx.value === '(') {
        const close = matchingBracket(tokens, k + 1);
        if (close > 0) sinks.push({ kind: 'import()', from: k + 1, to: close });
        continue;
      }
      for (let j = k + 1; j < tokens.length && j < k + 400; j += 1) {
        if (tokens[j].type === 'punct' && tokens[j].value === ';') break;
        if (tokens[j].type === 'ident' && tokens[j].value === 'from') {
          const sp = tokens[j + 1];
          if (sp && (sp.type === 'string' || sp.type === 'template')) sinks.push({ kind: 'import', from: j + 1, to: j + 1 });
          break;
        }
      }
      continue;
    }
    if (CODE_SINK_IDENTS.has(t.value) && !ambiguousSinkBound(tokens, k, cpNames)) continue;
    if (CODE_SINK_IDENTS.has(t.value) && tokens[k + 1] && tokens[k + 1].type === 'punct' && tokens[k + 1].value === '(') {
      const close = matchingBracket(tokens, k + 1);
      if (close > 0) sinks.push({ kind: t.value, from: k + 1, to: close });
    }
  }
  return sinks;
}

// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
const segmentsOf = (text) => text.split(/[\\/]+/).filter((s) => s !== '' && s !== '.');




//   'node user-space/scripts/x.mjs --flag'
//   `node ${join(root,'user-space','scripts','helper.mjs')} --flag`
const pseudoSegmentsOf = (text) => segmentsOf(text.replace(/[\s"'\`,()[\]{}$]+/g, '/'));


function classifySegment(part) {
  if (part.includes('${')) return { kind: 'var', names: [], reason: "\u6a21\u677f\u63d2\u503c" };
  return { kind: 'lit', names: [], text: part };
}


//





function ignoredCwdIndices(range) {
  const ignored = new Set();
  for (let k = 0; k < range.length; k += 1) {
    const t = range[k];
    if (t.type !== 'ident' || t.value !== 'cwd') continue;
    const colon = range[k + 1];
    if (!colon || colon.type !== 'punct' || colon.value !== ':') continue;
    let depth = 0;
    for (let j = k + 2; j < range.length; j += 1) {
      const tj = range[j];
      if (tj.type !== 'punct') { ignored.add(j); continue; }
      if (tj.value === '(' || tj.value === '[' || tj.value === '{') { depth += 1; ignored.add(j); continue; }
      if (tj.value === ')' || tj.value === ']' || tj.value === '}') {
        if (depth === 0) break;
        depth -= 1;
        ignored.add(j);
        continue;
      }
      if (tj.value === ',' && depth === 0) break;
      ignored.add(j);
    }
  }
  return ignored;
}


function callTailSegments(range, anchorIndex) {
  let depth = 0;
  let end = range.length;
  for (let k = anchorIndex + 1; k < range.length; k += 1) {
    const t = range[k];
    if (t.type !== 'punct') continue;
    if (t.value === '(' || t.value === '[' || t.value === '{') depth += 1;
    else if (t.value === ')' || t.value === ']' || t.value === '}') {
      if (depth === 0) { end = k; break; }
      depth -= 1;
    }
  }

  const parts = [];
  let cur = [];
  let d = 0;
  for (let k = anchorIndex + 1; k < end; k += 1) {
    const t = range[k];
    if (t.type === 'punct' && (t.value === '(' || t.value === '[' || t.value === '{')) d += 1;
    else if (t.type === 'punct' && (t.value === ')' || t.value === ']' || t.value === '}')) d -= 1;
    if (d === 0 && t.type === 'punct' && t.value === ',') { parts.push(cur); cur = []; continue; }
    cur.push(t);
  }
  parts.push(cur);

  const segs = [];
  for (const part of parts) {
    const idents = part.filter((t) => t.type === 'ident').map((t) => t.value);
    if (idents.length > 0) { segs.push({ kind: 'var', names: idents }); continue; }
    for (const t of part) {
      if (t.type === 'string' || t.type === 'template') {
        for (const p of segmentsOf(t.value)) segs.push(classifySegment(p));
      }
    }
  }
  return segs;
}



function classifyTail(segs, ctx) {
  if (segs.length === 0) return { verdict: 'dynamic', reason: "user-space \u4e4b\u540e\u6ca1\u6709\u66f4\u591a\u8def\u5f84\u6bb5，\u6765\u6e90\u4e0d\u660e" };
  const codeLit = segs.find((s) => s.kind === 'lit' && CODE_FILE_RE.test(s.text));
  if (codeLit) {
    return { verdict: 'coupling', detail: codeLit.text, reason: "user-space \u4e4b\u540e\u6709\u5199\u6b7b\u7684**\u4ee3\u7801\u6587\u4ef6\u540d**" };
  }
  const last = segs[segs.length - 1];
  if (last.kind === 'var' && last.names.some((nm) => ctx.varLiterals.has(nm))) {
    return { verdict: 'coupling', reason: "\u53d8\u91cf\u672c\u8eab\u6301\u6709\u5199\u6b7b\u7684 user-space \u4ee3\u7801\u8def\u5f84" };
  }
  const hasVar = segs.some((s) => s.kind === 'var');
  const allListing = segs.every((s) => s.kind === 'lit' || s.names.every((nm) => ctx.listing.has(nm)));
  if (hasVar && allListing) return { verdict: 'plugin-point', reason: "\u8def\u5f84\u7531 readdirSync \u7684\u6e05\u5355\u7ed3\u679c\u62fc\u51fa（\u5408\u6cd5\u63d2\u4ef6\u70b9）" };
  return { verdict: 'dynamic', reason: "\u8def\u5f84\u6765\u81ea\u8fd0\u884c\u65f6\u53d8\u91cf，\u6765\u6e90\u672a\u8bc6\u522b" };
}




function analyzeAnchors(range, ctx, ignored = ignoredCwdIndices(range)) {
  const out = [];
  for (let k = 0; k < range.length; k += 1) {
    if (ignored.has(k)) continue;
    const t = range[k];
    if (t.type !== 'string' && t.type !== 'template') continue;
    const segs = pseudoSegmentsOf(t.value);
    const ai = segs.indexOf('user-space');
    if (ai < 0) continue;
    const ownTail = segs.slice(ai + 1);
    if (ownTail.length > 0) {



      const codeSeg = ownTail.find((p) => CODE_FILE_RE.test(p));
      if (codeSeg) {
        out.push({ verdict: 'coupling', detail: codeSeg, line: t.line, reason: "\u5b57\u9762\u91cf\u91cc\u76f4\u63a5\u5199\u6b7b\u4e86 user-space/ \u4e0b\u7684\u4ee3\u7801\u8def\u5f84" });
      } else {
        out.push({ verdict: 'dynamic', line: t.line, reason: `\u5b57\u9762\u91cf\u6307\u5411 user-space/ \u4e0b\u7684**\u975e\u4ee3\u7801**\u8def\u5f84（${ownTail.join('/')}）` });
      }
      continue;
    }

    out.push({ ...classifyTail(callTailSegments(range, k), ctx), line: t.line });
  }
  return out;
}




const templateIdentsOf = (value) =>
  (value.match(/\$\{[^}]*\}/g) || []).flatMap((m) => m.slice(2, -1).match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || []);


function analyzeSink(range, ctx) {
  const ignored = ignoredCwdIndices(range);
  const out = analyzeAnchors(range, ctx, ignored);


  for (let k = 0; k < range.length; k += 1) {
    if (ignored.has(k)) continue;
    const t = range[k];
    const names = t.type === 'ident' ? [t.value] : t.type === 'template' ? templateIdentsOf(t.value) : [];
    for (const nm of names) {
      if (!ctx.varLiterals.has(nm)) continue;
      out.push({
        verdict: 'coupling',
        line: t.line,
        reason: `\u53d8\u91cf ${nm} \u6301\u6709\u5199\u6b7b\u7684 user-space \u4ee3\u7801\u8def\u5f84（${ctx.varLiterals.get(nm)}）`,
      });
    }
  }
  return out;
}

// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
function buildContext(tokens) {
  const listing = new Set();
  const varLiterals = new Map();
  const containsListing = (slice) => slice.some((t) => t.type === 'ident' && (t.value === 'readdirSync' || listing.has(t.value)));


  for (let pass = 0; pass < 4; pass += 1) {
    for (let k = 0; k < tokens.length; k += 1) {
      const t = tokens[k];
      if (t.type !== 'ident') continue;
      // function NAME(...) { ...readdirSync... }
      if (t.value === 'function') {
        const name = tokens[k + 1];
        if (!name || name.type !== 'ident') continue;
        let brace = -1;
        for (let j = k + 1; j < tokens.length && j < k + 60; j += 1) {
          if (tokens[j].type === 'punct' && tokens[j].value === '{') { brace = j; break; }
          if (tokens[j].type === 'punct' && tokens[j].value === ';') break;
        }
        if (brace < 0) continue;
        const endBrace = matchingBracket(tokens, brace);
        if (endBrace > 0 && containsListing(tokens.slice(brace + 1, endBrace))) listing.add(name.value);
      }

      if (t.value === 'const' || t.value === 'let' || t.value === 'var') {
        const name = tokens[k + 1];
        if (name && name.type === 'ident') {
          const end = statementEnd(tokens, k);
          if (containsListing(tokens.slice(k + 2, end))) listing.add(name.value);
        }
      }
      if (t.value === 'of') {
        const name = tokens[k - 1];
        if (name && name.type === 'ident' && tokens[k - 2] && tokens[k - 2].value === 'const') {
          let end = tokens.length;
          for (let j = k + 1; j < tokens.length; j += 1) {
            if (tokens[j].type === 'punct' && tokens[j].value === ')') { end = j; break; }
          }
          if (containsListing(tokens.slice(k + 1, end))) listing.add(name.value);
        }
      }
    }
  }


  //   ① `const p = 'user-space/scripts/x.mjs'; spawn(node,[p])`



  //


  //   `const args = [join(root,'user-space','logs'), 'node', 'x.mjs']; spawnSync('sh', args);`

  for (let k = 0; k < tokens.length; k += 1) {
    const t = tokens[k];
    if (t.type !== 'ident' || !['const', 'let', 'var'].includes(t.value)) continue;
    const name = tokens[k + 1];
    if (!name || name.type !== 'ident') continue;
    if (!tokens[k + 2] || tokens[k + 2].value !== '=') continue;
    const end = statementEnd(tokens, k);
    const hits = analyzeAnchors(tokens.slice(k + 3, end), { listing, varLiterals });
    const hit = hits.find((f) => f.verdict === 'coupling');
    if (hit) varLiterals.set(name.value, hit.detail ? `\u542b ${hit.detail}` : hit.reason);
  }

  return { listing, varLiterals };
}

// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
export function scanCrossZoneCoupling(source, { file = "<\u5185\u5b58\u6837\u672c>" } = {}) {
  const tokens = tokenize(source);
  const ctx = buildContext(tokens);
  const couplings = [];
  const pluginPoints = [];
  const dynamic = [];
  const lines = source.split('\n');
  for (const sink of findSinks(tokens)) {
    const range = tokens.slice(sink.from, sink.to + 1);
    for (const f of analyzeSink(range, ctx)) {
      const entry = {
        file,
        line: f.line,
        sink: sink.kind,
        reason: f.reason,
        snippet: (lines[f.line - 1] || '').trim(),
      };
      if (f.verdict === 'coupling') couplings.push(entry);
      else if (f.verdict === 'plugin-point') pluginPoints.push(entry);
      else dynamic.push(entry);
    }
  }
  return { couplings, pluginPoints, dynamic };
}

function walkMjs(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkMjs(p, out);
    else if (name.endsWith('.mjs')) out.push(p);
  }
  return out;
}

export function scanCoreSpace(root = join('product', 'core-space')) {
  const files = walkMjs(root);
  const couplings = [];
  const pluginPoints = [];
  const dynamic = [];
  for (const f of files) {
    const r = scanCrossZoneCoupling(readFileSync(f, 'utf8'), { file: relative(process.cwd(), f).split('\\').join('/') });
    couplings.push(...r.couplings);
    pluginPoints.push(...r.pluginPoints);
    dynamic.push(...r.dynamic);
  }
  return { files, couplings, pluginPoints, dynamic };
}

const \u8865\u6551 = "\u8865\u6551：\u8981\u4e48\u628a\u5b83\u4e00\u8d77\u642c\u8fdb core-space/（\u6846\u67b6\u4ee3\u7801\u653e\u6846\u67b6\u533a），\u8981\u4e48\u8ba9\u4ee3\u7801\u5728\u8be5\u4f9d\u8d56\u7f3a\u5931\u65f6\u4f18\u96c5\u964d\u7ea7（\u5148 existsSync \u5224\u5b58\u5728，\u7f3a\u4e86\u5c31\u8df3\u8fc7/\u56de\u843d\u9ed8\u8ba4\u503c）。";
const \u683c\u5f0f = (hits) => hits.map((h) => `  ${h.file}:${h.line} [${h.sink}] ${h.reason}\n    ${h.snippet}`).join('\n');

// =============================================================================

// =============================================================================
const CORE_SPACE = join('product', 'core-space');

test("Framework code must not depend on hardcoded personal-code paths", () => {
  const r = scanCoreSpace(CORE_SPACE);



  assert.ok(r.files.length >= 50, `Only ${r.files.length} files were scanned; traversal may be broken`);
  assert.ok(
    r.files.some((f) => /[\\/]scripts[\\/]lib[\\/][^\\/]+\.mjs$/.test(f)),
    "Traversal found no scripts/lib files; the traversal may be broken",
  );
  assert.equal(r.couplings.length, 0, `Framework contains ${r.couplings.length} cross-area code dependencies:\n${\u683c\u5f0f(r.couplings)}\n${\u8865\u6551}`);
});


test("Control: tick-core plugin slots are observed and not classified as coupling", () => {
  const file = join(CORE_SPACE, 'scripts', 'lib', 'tick-core.mjs');
  const r = scanCrossZoneCoupling(readFileSync(file, 'utf8'), { file: 'tick-core.mjs' });
  assert.equal(r.couplings.length, 0, `The valid tick-core plugin point was misclassified:\n${\u683c\u5f0f(r.couplings)}`);



  assert.ok(
    r.pluginPoints.length >= 1,
    "The scanner must identify tick-core's plugin point rather than returning an empty or invalid classification",
  );
});


test("Control: directory-enumerated plugin samples are plugin points", () => {
  const SAMPLE_PLUGIN = [
    "import { readdirSync, existsSync } from 'node:fs';",
    "import { join } from 'node:path';",
    "import { spawnSync } from 'node:child_process';",
    'export function listPluginFiles(root) {',
    "  const dir = join(root, 'user-space', 'tasks');",
    '  if (!existsSync(dir)) return [];',
    "  return readdirSync(dir).filter(f => f.endsWith('.mjs')).sort();",
    '}',
    'export function runPlugins(root) {',
    '  const files = listPluginFiles(root);',
    '  for (const f of files) {',
    "    spawnSync(process.execPath, [join(root, 'user-space', 'tasks', f)]);",
    '  }',
    '}',
  ].join('\n');
  const r = scanCrossZoneCoupling(SAMPLE_PLUGIN, { file: 'sample-plugin.mjs' });
  assert.equal(r.couplings.length, 0, `Plugin sample was misclassified as coupling:\n${\u683c\u5f0f(r.couplings)}`);
  assert.equal(r.pluginPoints.length, 1, `The sample must contain exactly one plugin point; actual: ${r.pluginPoints.length}`);
  assert.equal(r.pluginPoints[0].line, 12, "Plugin-point locations must identify the spawnSync line");
});


test("Control: hardcoded user-space imports are coupling", () => {
  const SAMPLE = [
    "import { help } from './../user-space/scripts/helper.mjs';",
  ].join('\n');
  const r = scanCrossZoneCoupling(SAMPLE, { file: 'sample-bad-import.mjs' });
  assert.equal(r.couplings.length, 1, `Hardcoded import coupling was not detected:\n${\u683c\u5f0f(r.couplings)}`);
  assert.equal(r.couplings[0].line, 1);
});


test("Control: spawning a hardcoded user-space code path is coupling", () => {
  const SAMPLE = [
    "import { spawnSync } from 'node:child_process';",
    "import { join } from 'node:path';",
    "const r = spawnSync(process.execPath, [join(root, 'user-space', 'scripts', 'helper.mjs')]);",
  ].join('\n');
  const r = scanCrossZoneCoupling(SAMPLE, { file: 'sample-bad-spawn.mjs' });
  assert.equal(r.couplings.length, 1, `Hardcoded spawn coupling was not detected:\n${\u683c\u5f0f(r.couplings)}`);
  assert.equal(r.couplings[0].line, 3);
});


test("Control: assigning a hardcoded personal-code path before spawning is coupling", () => {
  const SAMPLE = [
    "const helper = 'user-space/scripts/helper.mjs';",
    'spawnSync(node, [join(root, helper)]);',
  ].join('\n');
  const r = scanCrossZoneCoupling(SAMPLE, { file: 'sample-bad-taint.mjs' });
  assert.equal(r.couplings.length, 1, `Indirect variable coupling was not detected:\n${\u683c\u5f0f(r.couplings)}`);
  assert.equal(r.couplings[0].line, 2);
});






test("Control: const-built personal-code paths passed to spawn are coupling", () => {
  const SAMPLE = [
    "const P = join(root, 'user-space', 'scripts', 'helper.mjs');",
    'spawnSync(process.execPath, [P]);',
  ].join('\n');
  const r = scanCrossZoneCoupling(SAMPLE, { file: 'sample-bad-constpath.mjs' });
  assert.equal(r.couplings.length, 1, `Const-built path coupling was not detected (F1):\n${\u683c\u5f0f(r.couplings)}`);
  assert.equal(r.couplings[0].line, 2);


  const SAMPLE2 = [
    "const P = join(root, 'user-space', 'tools', 'run.py');",
    'execFileSync(python, [P]);',
  ].join('\n');
  const r2 = scanCrossZoneCoupling(SAMPLE2, { file: 'sample-bad-constpath2.mjs' });
  assert.equal(r2.couplings.length, 1, `Const-built Python path coupling was not detected:\n${\u683c\u5f0f(r2.couplings)}`);
});



test("Control: genuine exec command strings containing personal-code paths are coupling", () => {
  const SAMPLE = [
    "import { exec } from 'node:child_process';",
    "exec('node user-space/scripts/helper.mjs');",
  ].join('\n');
  const r = scanCrossZoneCoupling(SAMPLE, { file: 'sample-bad-cmdline.mjs' });
  assert.equal(r.couplings.length, 1, `Command-string coupling was not detected:\n${\u683c\u5f0f(r.couplings)}`);
  assert.equal(r.couplings[0].line, 2);
});





test("Control: personal data paths inside sinks are not code coupling", () => {
  const cases = {
    "\u4f4d\u7f6e\u5b9e\u53c2\u4f20\u6570\u636e\u76ee\u5f55": "spawnSync('tar', ['-czf', out, join(root,'user-space','logs')]);",
    "cwd \u6307\u6570\u636e\u76ee\u5f55": "spawnSync('git', ['-C', root, 'status'], { cwd: join(root,'user-space','logs') });",
    "cwd \u6307\u8bb0\u5fc6\u76ee\u5f55": "spawnSync('git', ['status'], { cwd: join(root,'user-space','memory') });",
    "env \u503c\u6307\u6570\u636e\u76ee\u5f55": "spawnSync('node', [x], { env: { AIPA_DIR: join(root,'user-space','logs') } });",
    "RegExp.exec \u8bfb\u6570\u636e\u6587\u4ef6": "const m = /x/.exec(readFileSync(join(root,'user-space','logs','a.txt'),'utf8'));",
    "\u6570\u636e\u76ee\u5f55\u5e26\u5199\u6b7b\u6587\u4ef6\u540d": "spawnSync('tar', ['-czf', out, join(root,'user-space','logs','daily.md')]);",
  };
  for (const [label, src] of Object.entries(cases)) {
    const r = scanCrossZoneCoupling(src, { file: `sample-data-${label}.mjs` });
    assert.equal(r.couplings.length, 0, `${label} was misclassified as coupling:\n${\u683c\u5f0f(r.couplings)}`);
  }
});






test("Control: unrelated .exec methods are not child-process code sinks", () => {
  const SAMPLE = [
    'const NAME = /^aipa-(\\w+)\\.mjs$/.exec(join(root, \'user-space\', \'scripts\', \'aipa-audit.mjs\'));',
  ].join('\n');
  const r = scanCrossZoneCoupling(SAMPLE, { file: 'sample-regex-exec.mjs' });
  assert.equal(r.couplings.length, 0, `RegExp.exec was misclassified as a code sink:\n${\u683c\u5f0f(r.couplings)}`);


});




test("Control: interpolated shell commands with hardcoded personal-code paths are coupling", () => {
  const \u88f8\u6a21\u677f = [
    "execSync(`node ${join(root,'user-space','scripts','helper.mjs')} --flag`);",
  ].join('\n');
  const r1 = scanCrossZoneCoupling(\u88f8\u6a21\u677f, { file: 'sample-interp-1.mjs' });
  assert.equal(r1.couplings.length, 1, `Interpolated command coupling was not detected (F5):\n${\u683c\u5f0f(r1.couplings)}`);

  const shC = [
    "spawnSync('sh', ['-c', `node ${join(root,'user-space','scripts','helper.mjs')}`]);",
  ].join('\n');
  const r2 = scanCrossZoneCoupling(shC, { file: 'sample-interp-2.mjs' });
  assert.equal(r2.couplings.length, 1, `Shell-wrapped interpolated coupling was not detected:\n${\u683c\u5f0f(r2.couplings)}`);


  const \u6570\u636e = [
    "execSync(`tar -czf o.tar ${join(root,'user-space','logs')}`);",
  ].join('\n');
  const r3 = scanCrossZoneCoupling(\u6570\u636e, { file: 'sample-interp-3.mjs' });
  assert.equal(r3.couplings.length, 0, `Interpolated data directory was misclassified:\n${\u683c\u5f0f(r3.couplings)}`);
});






test("Control: code paths in environment values are coupling, while cwd remains a data location", () => {
  const envCode = [
    "spawnSync(node, [X], { env: { P: join(root, 'user-space', 'scripts', 'h.mjs') } });",
  ].join('\n');
  const r1 = scanCrossZoneCoupling(envCode, { file: 'sample-env-code.mjs' });
  assert.equal(r1.couplings.length, 1, `Code paths in environment values were not detected (F6):\n${\u683c\u5f0f(r1.couplings)}`);

  const envData = [
    "spawnSync(node, [X], { env: { P: join(root, 'user-space', 'logs') } });",
  ].join('\n');
  const r2 = scanCrossZoneCoupling(envData, { file: 'sample-env-data.mjs' });
  assert.equal(r2.couplings.length, 0, `Data directories in environment values were misclassified:\n${\u683c\u5f0f(r2.couplings)}`);



  const cwdCode = [
    "spawnSync('git', ['status'], { cwd: join(root, 'user-space', 'scripts', 'vcs.mjs') });",
  ].join('\n');
  const r3 = scanCrossZoneCoupling(cwdCode, { file: 'sample-cwd-code.mjs' });
  assert.equal(r3.couplings.length, 0, `cwd was misclassified as code coupling:\n${\u683c\u5f0f(r3.couplings)}`);
});





test("Control: unrelated data paths and .mjs strings must not be combined into fabricated paths", () => {
  const \u6df7\u88c5 = [
    "const args = [join(root, 'user-space', 'logs'), 'node', 'x.mjs'];",
    "spawnSync('sh', args);",
  ].join('\n');
  const r1 = scanCrossZoneCoupling(\u6df7\u88c5, { file: 'sample-mixed-args.mjs' });
  assert.equal(r1.couplings.length, 0, `Unrelated .mjs and data paths were incorrectly combined (F7):\n${\u683c\u5f0f(r1.couplings)}`);


  const \u771f\u8026\u5408 = [
    "const args = [join(root, 'user-space', 'scripts', 'h.mjs')];",
    "spawnSync('sh', args);",
  ].join('\n');
  const r2 = scanCrossZoneCoupling(\u771f\u8026\u5408, { file: 'sample-array-real.mjs' });
  assert.equal(r2.couplings.length, 1, `Actual coupling in the argument array was not detected:\n${\u683c\u5f0f(r2.couplings)}`);


  const f1 = [
    "const P = join(root, 'user-space', 'scripts', 'helper.mjs');",
    'spawnSync(node, [P]);',
  ].join('\n');
  const r3 = scanCrossZoneCoupling(f1, { file: 'sample-f1-again.mjs' });
  assert.equal(r3.couplings.length, 1, `The F7 narrowing incorrectly excluded the F1 form:\n${\u683c\u5f0f(r3.couplings)}`);
});




test("Control: interpolated variables carrying personal-code paths are coupling", () => {
  const \u5355\u53d8\u91cf = [
    "const P = 'user-space/scripts/x.mjs';",
    'execSync(`${P}`);',
  ].join('\n');
  const r1 = scanCrossZoneCoupling(\u5355\u53d8\u91cf, { file: 'sample-interp-var-1.mjs' });
  assert.equal(r1.couplings.length, 1, `Coupling in an interpolated variable was not detected:\n${\u683c\u5f0f(r1.couplings)}`);

  const \u5e26\u53c2\u6570 = [
    "const P = join(root, 'user-space', 'scripts', 'x.mjs');",
    'execSync(`node ${P} --flag`);',
  ].join('\n');
  const r2 = scanCrossZoneCoupling(\u5e26\u53c2\u6570, { file: 'sample-interp-var-2.mjs' });
  assert.equal(r2.couplings.length, 1, `Coupling in an interpolated variable with arguments was not detected:\n${\u683c\u5f0f(r2.couplings)}`);


  const \u5e72\u51c0 = [
    "const out = 'report.md';",
    'execSync(`cat ${out}`);',
  ].join('\n');
  const r3 = scanCrossZoneCoupling(\u5e72\u51c0, { file: 'sample-interp-var-3.mjs' });
  assert.equal(r3.couplings.length, 0, `An unrelated interpolated variable was misclassified:\n${\u683c\u5f0f(r3.couplings)}`);
});


test("Control: the traversal wrapper detects coupling in temporary directories", () => {
  const dir = mkdtempSync(join(tmpdir(), 'aipa-zone-'));
  try {
    mkdirSync(join(dir, 'lib'), { recursive: true });
    writeFileSync(join(dir, 'lib', 'good-plugin.mjs'), [
      "import { readdirSync } from 'node:fs';",
      "import { join } from 'node:path';",
      'export function listPluginFiles(root) {',
      "  return readdirSync(join(root, 'user-space', 'tasks'));",
      '}',
      'export function run({ root }) {',
      '  for (const f of listPluginFiles(root)) {',
      "    spawnSync(node, [join(root, 'user-space', 'tasks', f)]);",
      '  }',
      '}',
    ].join('\n'), 'utf8');
    const clean = scanCoreSpace(dir);
    assert.equal(clean.files.length, 1, "Temporary-directory traversal found no files");
    assert.equal(clean.couplings.length, 0, `A clean sample was misclassified:\n${\u683c\u5f0f(clean.couplings)}`);

    writeFileSync(join(dir, 'lib', 'bad.mjs'),
      "import { x } from '../../user-space/scripts/helper.mjs';\n", 'utf8');
    const dirty = scanCoreSpace(dir);
    assert.equal(dirty.couplings.length, 1, `Coupling in the temporary directory was not detected:\n${\u683c\u5f0f(dirty.couplings)}`);
    assert.match(dirty.couplings[0].file, /bad\.mjs$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("Boundary: reading personal data is not code coupling", () => {
  const SAMPLE = [
    "import { readFileSync, readdirSync } from 'node:fs';",
    "import { join } from 'node:path';",
    "const idx = JSON.parse(readFileSync(join(root, 'user-space', 'memory', 'memory-index.json'), 'utf8'));",
    "const dir = join(root, 'user-space', 'logs', 'daily');",
    'for (const f of readdirSync(dir)) readFileSync(join(dir, f), "utf8");',
    'const rel = `user-space/skills/${scope}/${name}/SKILL.md`;',
    "const out = join(root, arg('out') || join('user-space', 'logs', 'dashboard.html'));",
  ].join('\n');
  const r = scanCrossZoneCoupling(SAMPLE, { file: 'sample-data.mjs' });
  assert.equal(r.couplings.length, 0, `A data path was misclassified as coupling:\n${\u683c\u5f0f(r.couplings)}`);
});





test("Boundary: dynamically selected files with many personal-data references still have zero code coupling", () => {
  const r = scanCoreSpace(CORE_SPACE);
  const heavy = r.files
    .map((f) => ({ f, n: (readFileSync(f, 'utf8').match(/user-space/g) || []).length }))
    .filter((x) => x.n >= 3)
    .sort((a, b) => b.n - a.n);
  assert.ok(heavy.length >= 10, `Only ${heavy.length} data-heavy files were found; insufficient boundary samples`);
  const bad = [];
  for (const { f } of heavy) {
    const one = scanCrossZoneCoupling(readFileSync(f, 'utf8'), { file: f });
    bad.push(...one.couplings);
  }
  assert.equal(bad.length, 0, `${heavy.length} data-heavy files were misclassified:\n${\u683c\u5f0f(bad)}`);
});
