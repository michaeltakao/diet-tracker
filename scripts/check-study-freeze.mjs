#!/usr/bin/env node
/**
 * Weekly study freeze check (vault ADR-008 P0-11).
 *
 * Compares the commit the production deployment was built from
 * (GET <url>/api/build-info → { sha, studyBuild }) with the commit the git
 * tag points at. Run from the repo root:
 *
 *   node scripts/check-study-freeze.mjs https://<production-host> [tag]
 *
 * tag defaults to `study-v1`. Exit codes:
 *   0 — deployed sha equals the tag's commit and studyBuild is true
 *   1 — mismatch (different sha, or not a study build)
 *   2 — could not check (bad arguments, unknown tag, network/HTTP error)
 *
 * Record each run in docs/trial/freeze-check.md.
 */
import { execFileSync } from 'node:child_process';

const [url, tag = 'study-v1'] = process.argv.slice(2);

function fail(code, message) {
  console.error(message);
  process.exit(code);
}

if (!url || !/^https?:\/\//.test(url)) {
  fail(2, 'usage: node scripts/check-study-freeze.mjs https://<production-host> [tag]');
}

let tagSha;
try {
  // rev-list resolves annotated and lightweight tags to the commit.
  tagSha = execFileSync('git', ['rev-list', '-n', '1', tag], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
} catch {
  fail(2, `unknown git tag: ${tag} (git fetch --tags?)`);
}

const endpoint = new URL('/api/build-info', url).href;
let info;
try {
  const res = await fetch(endpoint, { cache: 'no-store' });
  if (!res.ok) fail(2, `GET ${endpoint} → HTTP ${res.status}`);
  info = await res.json();
} catch (err) {
  fail(2, `GET ${endpoint} failed: ${err instanceof Error ? err.message : String(err)}`);
}

const checkedAt = new Date().toISOString();
console.log(`checked_at  ${checkedAt}`);
console.log(`tag         ${tag} → ${tagSha}`);
console.log(`deployed    ${info.sha}`);
console.log(`study_build ${info.studyBuild}`);

if (info.sha !== tagSha) fail(1, 'FAIL: deployed build is not the frozen study tag');
if (info.studyBuild !== true) fail(1, 'FAIL: deployed build was not built with NEXT_PUBLIC_STUDY_BUILD=1');
console.log('OK: production runs the frozen study build');
