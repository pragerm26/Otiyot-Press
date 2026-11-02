#!/usr/bin/env node
/**
 * eval-shoresh.js — baseline metrics for the shoresh matcher.
 * Usage:  node tools/eval-shoresh.js
 * Loads app.js pure logic with the form→root INDEX DISABLED so we measure
 * the heuristic alone. Then optionally re-runs with the index for comparison.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const cut = appSrc.indexOf('/* ───────── UI state');
if (cut < 0) { console.error('Could not find UI-state marker in app.js'); process.exit(1); }

const vm = require('vm');
const ctx = { console, Map, Set, Array, Object, String, Number, Boolean, Math, JSON, parseInt, parseFloat, isNaN, Infinity };
vm.createContext(ctx);
vm.runInContext(appSrc.slice(0, cut) + `
  this.rootHits = rootHits;
  this.rootHitsHeuristic = rootHitsHeuristic;
  this.weakRootHits = weakRootHits;
  this.weakClasses = weakClasses;
  this.formToCons = formToCons;
  this.normRoot = normRoot;
  this.FINAL = FINAL;
  this.formRootIndex = formRootIndex;
  this.rootFormIndex = rootFormIndex;
  this.indexForm = indexForm;
  this._rootCache = _rootCache;
`, ctx);


const { rootHits, rootHitsHeuristic, weakClasses, formToCons, normRoot, formRootIndex, _rootCache } = ctx;

function parseCSVLines(text) {
  return text.replace(/^\uFEFF/, '').split('\n').slice(1).filter(l => l.trim()).map(line => {
    const row = []; let q = false, cur = '';
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { row.push(cur); cur = ''; }
      else cur += ch;
    }
    row.push(cur);
    return row;
  });
}

function loadExamplesIndex(text) {
  ctx.formRootIndex.clear();
  ctx.rootFormIndex.clear();
  let n = 0;
  for (const row of parseCSVLines(text)) {
    const root = ctx.normRoot((row[0] || '').trim());
    const wordText = (row[7] || '').trim();
    if (!root || !wordText) continue;
    const cons = ctx.formToCons(wordText);
    if (cons.length >= 2) { ctx.indexForm(cons, root); n++; }
  }
  ctx._rootCache.clear();
  return ctx.formRootIndex.size;
}


const masterPath = path.join(ROOT, 'rootcvs/Tanakh Root Master CSV.csv');
const examplesPath = path.join(ROOT, 'rootcvs/Root-Binyan Examples CSV.csv');
const masterRows = parseCSVLines(fs.readFileSync(masterPath, 'utf8'));
const exampleRows = parseCSVLines(fs.readFileSync(examplesPath, 'utf8'));

// root → total_occurrences
const rootOcc = new Map();
for (const row of masterRows) {
  const root = normRoot((row[0] || '').trim());
  const occ = parseInt(row[2], 10) || 0;
  if (root) rootOcc.set(root, occ);
}
const totalOcc = [...rootOcc.values()].reduce((a, b) => a + b, 0);

// Classify roots strong vs weak
function isWeak(root) { return weakClasses(root).size > 0; }

// ── Fixtures ──────────────────────────────────────────────────────────────
const MUST_NOT = [
  ['אמר', 'ארץ'], ['אמר', 'אור'], ['אמר', 'אחר'], ['אמר', 'אדר'],
  ['בנה', 'אבן'], ['בנה', 'בינה'],
  ['כתב', 'כתר'],
  ['נפל', 'פלא'], ['נפל', 'פלט'], ['נפל', 'תפלה'],
  ['שמר', 'מר'], ['שמר', 'שמאל'],
  ['קום', 'קמח'],
  ['ישב', 'שבע'],
];
const MUST_MATCH = [
  ['בנה', 'ויבן'], ['בנה', 'בנו'],
  ['נפל', 'יפל'], ['נפל', 'ויפל'],
  ['ישב', 'לשבת'], ['ישב', 'שבת'],
  ['קום', 'קם'], ['קום', 'יקום'], ['קום', 'מקום'],
  ['סבב', 'סב'], ['סבב', 'יסב'],
  ['היה', 'ויהי'], ['היה', 'להיות'],
  ['ראה', 'וירא'], ['ראה', 'ראו'],
  ['אמר', 'ויאמר'], ['אמר', 'לאמר'],
];
// Extra from Examples CSV (sample of real forms)
const EXTRA_MUST = [];
for (const row of exampleRows.slice(0, 40)) {
  const root = normRoot((row[0] || '').trim());
  const word = (row[7] || '').trim();
  if (root && word) EXTRA_MUST.push([root, formToCons(word)]);
}

function consOf(w) {
  return [...String(w)].filter(c => c >= '\u05D0' && c <= '\u05EA').map(c => ctx.FINAL[c] || c).join('');
}

function runFixtures(label, hitFn) {
  console.log(`\n══ Fixtures (${label}) ══`);
  let bad = 0, good = 0;
  for (const [root, word] of MUST_NOT) {
    const hit = hitFn(consOf(word), ctx.normRoot(root));
    if (hit) { console.log(`  FAIL must-not: ${root} × ${word}`); bad++; }
    else good++;
  }
  for (const [root, word] of MUST_MATCH) {
    const hit = hitFn(consOf(word), ctx.normRoot(root));
    if (!hit) { console.log(`  FAIL must-match: ${root} × ${word}`); bad++; }
    else good++;
  }
  let extraOk = 0, extraFail = 0;
  for (const [root, cons] of EXTRA_MUST) {
    if (!cons || cons.length < 2) continue;
    if (hitFn(cons, root)) extraOk++; else extraFail++;
  }
  console.log(`  must-not/must-match: ${good} pass, ${bad} fail`);
  console.log(`  examples sample: ${extraOk} hit, ${extraFail} miss (of ${extraOk + extraFail})`);
  return { bad, good, extraOk, extraFail };
}

// ── Recall on Examples CSV ────────────────────────────────────────────────
function recallOnExamples(hitFn) {
  let strongHit = 0, strongTot = 0, weakHit = 0, weakTot = 0;
  for (const row of exampleRows) {
    const root = normRoot((row[0] || '').trim());
    const word = (row[7] || '').trim();
    if (!root || !word) continue;
    const cons = formToCons(word);
    if (cons.length < 2) continue;
    const weak = isWeak(root);
    if (weak) weakTot++; else strongTot++;
    if (hitFn(cons, root)) {
      if (weak) weakHit++; else strongHit++;
    }
  }
  return {
    strong: { hit: strongHit, tot: strongTot, pct: strongTot ? (100 * strongHit / strongTot).toFixed(1) : 'n/a' },
    weak: { hit: weakHit, tot: weakTot, pct: weakTot ? (100 * weakHit / weakTot).toFixed(1) : 'n/a' },
  };
}

// ── Precision proxy ───────────────────────────────────────────────────────
// Tokenize all verse_text from Examples; for each sampled root count how many
// distinct tokens the matcher hits; compare to expected share from Master.
function precisionProxy(hitFn, bandRoots) {
  const tokens = new Set();
  for (const row of exampleRows) {
    const verse = (row[9] || '').trim();
    for (const tok of verse.split(/[\s\/]+/)) {
      const c = formToCons(tok);
      if (c.length >= 2) tokens.add(c);
    }
  }
  const tokenList = [...tokens];
  const results = [];
  for (const root of bandRoots) {
    const occ = rootOcc.get(root) || 0;
    const expectedShare = totalOcc ? occ / totalOcc : 0;
    let observed = 0;
    for (const tok of tokenList) {
      if (hitFn(tok, root)) observed++;
    }
    const observedShare = tokenList.length ? observed / tokenList.length : 0;
    const estPrec = observedShare > 0 ? Math.min(1, expectedShare / observedShare) : (expectedShare === 0 ? 1 : 0);
    results.push({ root, occ, observed, expectedShare, observedShare, estPrec });
  }
  const avg = results.length ? results.reduce((s, r) => s + r.estPrec, 0) / results.length : 0;
  return { avg, results };
}

function sampleBand(sortedRoots, lo, hi, n) {
  const band = sortedRoots.slice(lo, hi);
  // even sample
  const step = Math.max(1, Math.floor(band.length / n));
  const out = [];
  for (let i = 0; i < band.length && out.length < n; i += step) out.push(band[i]);
  return out;
}

function clearCache() { _rootCache.clear(); }

// ── Main ──────────────────────────────────────────────────────────────────
const sortedByOcc = [...rootOcc.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
const bands = {
  'top-100': sampleBand(sortedByOcc, 0, 100, 40),
  '101-400': sampleBand(sortedByOcc, 100, 400, 40),
  '401-1000': sampleBand(sortedByOcc, 400, 1000, 40),
  'rest': sampleBand(sortedByOcc, 1000, sortedByOcc.length, 40),
};

console.log('Roots in Master:', rootOcc.size, '· total occ:', totalOcc);
console.log('Examples rows:', exampleRows.length);

// Disable index for baseline heuristic measurement
formRootIndex.clear();
clearCache();

console.log('\n════════ BASELINE (heuristic only, index OFF) ════════');
runFixtures('heuristic', (cons, t) => rootHitsHeuristic(cons, t, true));
const recBase = recallOnExamples((cons, t) => rootHitsHeuristic(cons, t, true));
console.log(`\nRecall on Examples CSV:`);
console.log(`  strong: ${recBase.strong.hit}/${recBase.strong.tot} (${recBase.strong.pct}%)`);
console.log(`  weak:   ${recBase.weak.hit}/${recBase.weak.tot} (${recBase.weak.pct}%)`);

console.log('\nPrecision proxy (est. = min(1, expected/observed) — LABEL: proxy only):');
for (const [name, roots] of Object.entries(bands)) {
  clearCache();
  const { avg } = precisionProxy((cons, t) => rootHitsHeuristic(cons, t, true), roots);
  console.log(`  ${name}: avg est. precision ${(100 * avg).toFixed(1)}%  (n=${roots.length})`);
}

// With weak patterns OFF
console.log('\n════════ HEURISTIC, weak patterns OFF ════════');
clearCache();
runFixtures('no-weak', (cons, t) => rootHitsHeuristic(cons, t, false));
const recNoWeak = recallOnExamples((cons, t) => rootHitsHeuristic(cons, t, false));
console.log(`Recall: strong ${recNoWeak.strong.pct}% · weak ${recNoWeak.weak.pct}%`);
for (const [name, roots] of Object.entries(bands)) {
  clearCache();
  const { avg } = precisionProxy((cons, t) => rootHitsHeuristic(cons, t, false), roots);
  console.log(`  ${name}: avg est. precision ${(100 * avg).toFixed(1)}%`);
}

// With index ON (reload examples)
console.log('\n════════ FULL rootHits (index + gated weak) ════════');
const exText = fs.readFileSync(examplesPath, 'utf8');
const nForms = loadExamplesIndex(exText);
console.log('Indexed unique forms:', nForms);
clearCache();
runFixtures('full', (cons, t) => rootHits(cons, t));
const recFull = recallOnExamples((cons, t) => rootHits(cons, t));
console.log(`Recall: strong ${recFull.strong.pct}% · weak ${recFull.weak.pct}%`);
for (const [name, roots] of Object.entries(bands)) {
  clearCache();
  const { avg } = precisionProxy((cons, t) => rootHits(cons, t), roots);
  console.log(`  ${name}: avg est. precision ${(100 * avg).toFixed(1)}%`);
}

console.log('\nDone.');
