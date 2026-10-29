// Summarize the first failing TAP entries without replacing the complete log.
const DEFAULTS = { maxFailures: 3, maxLinesPerFailure: 50, maxChars: 12000 };

function failureIndent(line) {
  const match = line.match(/^(\s*)not ok\b/);
  return match && !/\s+#\s*(?:TODO|SKIP)\b/i.test(line) ? match[1].length : null;
}

function contextEnd(lines, start, indent) {
  let end = start + 1;
  for (; end < lines.length; end++) {
    const line = lines[end];
    if (line.search(/\S/) > indent || !line.trim()) continue;
    if (/^\s*(?:(?:not )?ok\b|# Subtest:|\d+\.\.\d+\s*$|# (?:tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)\b)/.test(line)) break;
  }
  while (end > start + 1 && !lines[end - 1].trim()) end--;
  return end;
}

function excerpt(block, limit, indent) {
  let selected = Array.from({ length: Math.min(block.length, limit) }, (_, index) => index);
  // Large expected/actual values must not hide the actionable stack that follows.
  const stack = block.findIndex(line => {
    const match = line.match(/^(\s*)stack:/);
    return match && match[1].length === indent + 2;
  });
  if (block.length > limit && stack >= 0 && limit > 1) {
    let stackEnd = stack + 1;
    while (stackEnd < block.length && (!block[stackEnd].trim() || block[stackEnd].search(/\S/) > indent + 2)) stackEnd++;
    const stackCount = Math.min(stackEnd - stack, Math.max(1, Math.floor(limit / 3)));
    const headCount = limit - stackCount;
    selected = [...new Set([
      ...Array.from({ length: headCount }, (_, index) => index),
      ...Array.from({ length: stackCount }, (_, index) => stack + index),
    ])].sort((a, b) => a - b);
  }
  const out = [];
  let previous = -1;
  for (const index of selected) {
    if (index > previous + 1) out.push('[truncated: ' + (index - previous - 1) + ' TAP context lines omitted]');
    out.push(block[index]);
    previous = index;
  }
  if (previous + 1 < block.length) out.push('[truncated: ' + (block.length - previous - 1) + ' TAP context lines omitted]');
  return out.join('\n');
}

export function formatTapFailures(log, options = {}) {
  const limits = { ...DEFAULTS, ...options };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(name + ' must be a positive safe integer');
  }
  const lines = String(log ?? '').split(/\r?\n/);
  const failures = [];
  let yamlIndent = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (yamlIndent !== null) {
      if (line === ' '.repeat(yamlIndent) + '...') yamlIndent = null;
      continue;
    }
    const yaml = line.match(/^( +)---\s*$/);
    if (yaml) { yamlIndent = yaml[1].length; continue; }
    const indent = failureIndent(line);
    if (indent !== null) failures.push({ start: index, indent });
  }
  // Non-TAP command failures keep the caller's existing tail-only diagnostics.
  if (!failures.length) return '';
  const shown = failures.slice(0, limits.maxFailures);
  const out = [
    'TAP failure details: showing ' + shown.length + ' of ' + failures.length
      + ' failing entries (limits: ' + limits.maxFailures + ' failures, '
      + limits.maxLinesPerFailure + ' source lines each, ' + limits.maxChars + ' characters).',
  ];
  for (const [index, failure] of shown.entries()) {
    const end = contextEnd(lines, failure.start, failure.indent);
    out.push('--- TAP failure ' + (index + 1) + ' (full log line ' + (failure.start + 1) + ') ---');
    out.push(excerpt(lines.slice(failure.start, end), limits.maxLinesPerFailure, failure.indent));
  }
  if (failures.length > shown.length) out.push('[truncated: ' + (failures.length - shown.length) + ' additional failing TAP entries omitted]');
  out.push('See the complete log for all failure details. The original log tail follows.');
  const result = out.join('\n');
  if (result.length <= limits.maxChars) return result;
  const notice = '\n[truncated at ' + limits.maxChars + ' characters; see the complete log]';
  return result.slice(0, Math.max(0, limits.maxChars - notice.length)) + notice.slice(0, limits.maxChars);
}

// Match actions/toolkit escapeData; attributes are fixed and never user-derived.
export function formatGitHubErrorAnnotation(context, githubActions = '') {
  if (githubActions !== 'true') return '';
  const raw = String(context ?? '');
  const message = raw.trim() ? raw : 'AIPA quality gate failed; inspect the complete log and original log tail.';
  const data = message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  return '::error title=AIPA quality gate::' + data;
}
