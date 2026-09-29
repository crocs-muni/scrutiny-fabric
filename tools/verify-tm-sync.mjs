#!/usr/bin/env node
// verify-tm-sync.mjs — mechanical gate keeping docs/threat-model.md in sync with the spec.
// Sibling to verify-corpus.mjs: local pre-commit discipline (DECISIONS S6 defers CI).
//
// Checks (FAIL = exit 1):
//   I0  TM header "Protocol version" == spec version
//   I1  catalog entries (^#### T-XX-NN) == summary-table rows, bidirectional
//   I2  §6 overview Count column == actual per-prefix heading counts, total == summary rows
//   I3  every bracketed rule ID cited in the TM exists in Appendix F
//       (dashed and undashed families; NIP-x refs and App A band/motivation grades
//       [B1]-[B5]/[M1]-[M5] in brackets are excluded by convention)
//   I5  disposition ledger: every Appendix F rule ID has exactly one row;
//       no ledger row names a nonexistent ID; 'covered' rows have ≥1 TM citation
//   I6  dead-mechanism fingerprints, two tiers (dead => FAIL in strict mode,
//       WARN while drifted; mentions => always WARN)
//   I7  entry shape: every ^#### T- block has the five header rows (Type,
//       Adversary, Assets, Goals, Spec), a valid Type value, and a Spec row with
//       >=1 rule ID or the structural-weakness 'no single rule' form
//       (WARN while drifted, FAIL in strict mode)
// Strict mode: TM pinned version == spec version. While the doc is drifted,
// I6-dead and I7 findings are WARN so the gate stays useful on the old document.
//   --seed        generate tools/tm-rule-dispositions.json from Appendix F (all 'untriaged')
//   --rebaseline  after a spec fix bumps the registry: preserve existing dispositions,
//                 add new rule IDs as 'untriaged', drop rows naming removed IDs
//
// Usage: node tools/verify-tm-sync.mjs [--seed | --rebaseline]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SPEC = 'docs/protocol-spec.md';
const TM = 'docs/threat-model.md';
const LEDGER = 'tools/tm-rule-dispositions.json';

const spec = readFileSync(SPEC, 'utf8');
const tm = existsSync(TM) ? readFileSync(TM, 'utf8') : '';

let failures = 0;
let warnings = 0;
const fail = (m) => { failures++; console.log(`FAIL ${m}`); };
const warn = (m) => { warnings++; console.log(`WARN ${m}`); };
const ok = (m) => console.log(`OK   ${m}`);

// ---- Appendix F extraction -------------------------------------------------
const appF = spec.split(/^## Appendix F/m)[1]?.split(/^## Appendix G/m)[0];
if (!appF) { fail('Appendix F not found in spec'); process.exit(1); }
// Dashed families (SF-4, DEL-11) and undashed families (E1, N3, C8, P4, T2, H1).
const ruleIds = [...new Set([...appF.matchAll(/^\| (?:<a id="rule-[A-Z0-9-]+"><\/a>)?([A-Z][A-Z0-9]*-\d+|[A-Z]{1,2}\d{1,2}) \|/gm)].map((m) => m[1]))].sort();
ok(`Appendix F: ${ruleIds.length} rule IDs`);
const ruleSet = new Set(ruleIds);

// ---- --seed ----------------------------------------------------------------
if (process.argv.includes('--seed')) {
  const seed = Object.fromEntries(ruleIds.map((id) => [id, 'untriaged']));
  writeFileSync(LEDGER, JSON.stringify({ specRuleCount: ruleIds.length, dispositions: seed }, null, 2) + '\n');
  console.log(`Seeded ${LEDGER} with ${ruleIds.length} untriaged rule IDs`);
  process.exit(0);
}
if (process.argv.includes('--rebaseline')) {
  const existing = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')).dispositions || {} : {};
  const dispositions = {};
  let added = 0, removed = 0, kept = 0;
  for (const id of ruleIds) {
    if (id in existing) { dispositions[id] = existing[id]; kept++; }
    else { dispositions[id] = 'untriaged'; added++; }
  }
  for (const id of Object.keys(existing)) if (!ruleSet.has(id)) removed++;
  writeFileSync(LEDGER, JSON.stringify({ specRuleCount: ruleIds.length, dispositions }, null, 2) + '\n');
  console.log(`Rebaselined ${LEDGER}: ${kept} preserved, ${added} added untriaged, ${removed} stale rows dropped`);
  process.exit(0);
}
if (!tm) { fail(`${TM} not found`); process.exit(1); }

// ---- I0 version currency ----------------------------------------------------
const tmVer = tm.match(/^\*\*Protocol version:\*\*\s*(\d+\.\d+\.\d+)\s*$/m)?.[1];
const specVer = (spec.match(/^\*\*Version:\*\*\s*(\d+\.\d+\.\d+)\s*$/m) || spec.match(/v(\d+\.\d+\.\d+)/m))?.[1];
if (!tmVer) fail('TM header has no parseable "Protocol version" literal');
else if (tmVer !== specVer) fail(`I0 version: TM pins ${tmVer}, spec is ${specVer}`);
else ok(`I0 version: TM == spec == ${specVer}`);
// Strict mode: the doc claims currency, so tiered checks enforce, not warn.
const strict = tmVer === specVer;
const report = (isDeadTier) => (isDeadTier && strict ? fail : warn);

// Shared bracketed-citation pattern: dashed or undashed rule IDs. Excluded by
// convention: NIP references [NIP-01] and App A band/motivation [B1]-[B5]/[M1]-[M5].
// I3, I5, and I7 MUST use this one pattern (N2 closure: a drifted copy once let
// undashed citations fail I5's covered check).
const CITE_RE = /\[(?!NIP-\d|B[1-5]\b|M[1-5]\b)([A-Z][A-Z0-9]*-\d{1,2}|[A-Z]{1,2}\d{1,2})\]/g;

// ---- I1/I2 catalog vs summary parity ---------------------------------------
const entries = [...tm.matchAll(/^#### (T-[A-Z]{2}-\d{2})\b/gm)].map((m) => m[1]);
const summaryRows = [...tm.matchAll(/^\| (T-[A-Z]{2}-\d{2}) \|/gm)].map((m) => m[1]);
const entrySet = new Set(entries);
const rowSet = new Set(summaryRows);
for (const id of entries) if (!rowSet.has(id)) fail(`I1 ${id} in catalog but not in summary table`);
for (const id of summaryRows) if (!entrySet.has(id)) fail(`I1 ${id} in summary table but not in catalog`);
if (failures === 0 || entrySet.size === entries.length) {
  if (entries.length === summaryRows.length && new Set([...entries, ...summaryRows]).size === entries.length)
    ok(`I1 catalog parity: ${entries.length} entries == ${summaryRows.length} summary rows`);
}
const counts = {};
for (const e of entries) { const p = e.slice(2, 4); counts[p] = (counts[p] || 0) + 1; }
for (const [p, n] of Object.entries(counts).sort()) ok(`I2 category ${p}: ${n}`);
ok(`I2 catalog total: ${entries.length} entries (discovered by scan, not asserted)`);
// I2 comparison: the §6 overview table's Count column must equal the scanned
// per-prefix counts (N4 closure: previously I2 only printed, never compared).
for (const m of tm.matchAll(/^\| ([A-Z]{2}) \| [^|]+ \| (\d+) \|/gm)) {
  const [, prefix, declared] = m;
  if (!(prefix in counts)) continue;
  if (Number(declared) !== counts[prefix])
    fail(`I2 overview table says ${prefix}: ${declared}, catalog scan finds ${counts[prefix]}`);
}

// ---- I3 citation admissibility ----------------------------------------------
const cited = [...new Set([...tm.matchAll(CITE_RE)].map((m) => m[1]))];
const badCites = cited.filter((c) => !ruleSet.has(c));
if (cited.length === 0) warn('I3 zero bracketed rule-ID citations in TM (convention not yet landed)');
for (const c of badCites) {
  if (/^[GA]\d{1,2}$/.test(c)) fail(`I3 [${c}]: goals and assets are written unbracketed (convention); brackets are reserved for rule IDs`);
  else fail(`I3 citation [${c}] is not an Appendix F rule ID`);
}
if (badCites.length === 0 && cited.length) ok(`I3 ${cited.length} distinct cited rule IDs all in Appendix F`);

// ---- I5 ledger bidirectional ------------------------------------------------
let ledgerIds = [];
if (!existsSync(LEDGER)) {
  warn(`I5 ${LEDGER} missing — run: node tools/verify-tm-sync.mjs --seed`);
} else {
  const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
  ledgerIds = Object.keys(ledger.dispositions || {});
  const untriaged = new Set(ledgerIds);
  for (const id of ruleIds)
    if (!untriaged.has(id)) fail(`I5 rule ID ${id} in Appendix F but not in ${LEDGER}`);
  for (const id of ledgerIds)
    if (!ruleSet.has(id)) fail(`I5 ledger row ${id} names no Appendix F rule ID`);
  const dupes = ledgerIds.length - new Set(ledgerIds).size;
  if (dupes) fail(`I5 ${dupes} duplicate ledger rows`);
  const citeCounts = {};
  for (const c of [...tm.matchAll(CITE_RE)].map((m) => m[1])) citeCounts[c] = (citeCounts[c] || 0) + 1;
  for (const [id, disp] of Object.entries(ledger.dispositions || {}))
    if (disp === 'covered' && !citeCounts[id]) fail(`I5 ${id} ledger-marked 'covered' but never cited in TM`);
  // Cited but untriaged: a writer cited the rule without deciding the family
  // disposition. WARN while triage is in flight, FAIL in strict mode.
  for (const c of Object.keys(citeCounts))
    if (ruleSet.has(c) && (ledger.dispositions || {})[c] === 'untriaged')
      report(true)(`I5 ${c} cited ${citeCounts[c]}x in TM but ledger disposition is 'untriaged'`);
  const nTriaged = Object.values(ledger.dispositions || {}).filter((d) => d !== 'untriaged').length;
  ok(`I5 ledger: ${nTriaged}/${ruleIds.length} rule IDs triaged`);
}

// ---- I6 dead-mechanism fingerprints (two tiers) ------------------------------
// Dead tier: terms and mechanisms retired by App B; forbidden in rewritten
// prose. FAIL in strict mode, WARN while drifted. Patterns are usage-shaped
// where a bare mention can be legitimate prose.
const dead = [
  [/created_at[^\n]{0,60}(primary sort|sort key|tie-?break|default head|tip selection)/i, 'created_at fork/tip selection (SF-4 forbids)'],
  [/default head/i, '"default head" (current term: tip, RC-5)'],
  [/cycle detection|break cycles/i, 'cycle detection (no such rule; line 493 of the old TM)'],
  [/imeta[^\n]{0,30}diff|diff[^\n]{0,30}imeta/i, 'imeta-attached diffs (patches are inline-fenced only, PT-3)'],
  [/scrutiny-v0\d\d/i, 'fixed-width version tag (retired v0.7.0, TAG-2)'],
  [/prefer the Bitcoin timestamp/i, 'OTS in tip selection (OTS-1 MUST NOT)'],
  [/§4\.4\.1/, '§4.4.1 (does not exist; IX rules live in §4.5)'],
  [/filter(ed|ing)[^\n]{0,20}before any processing/i, 'pre-processing trust filter (TR-7: presentation-time)'],
  [/dispute overlays?/i, '"dispute overlay" (current term: foreign overlay, §7.3)'],
  [/(?:\b[ik]-?|imeta-)surfaces?|three-surface/i, '"i-surfaces"/"imeta-surfaces"/"three-surface" (retired coinage; canonical bytes, RC-2)'],
  [/\bcanonical views?\b/i, '"canonical view" (current term: canonical bytes, RC-2)'],
  [/\bcanonical identifiers?\b/i, '"canonical identifiers" (current term: indexers / canonical indexer registry, §9)'],
  [/identifier mirroring/i, '"identifier mirroring" (no such mechanism; IX-1)'],
  [/\btrust lists?\b/i, '"trust list" (current term: trusted-pubkey set, §6.1)'],
];
// Mentions tier: terms that can appear in legitimate prose (the sanctioned
// one-line residual, spec-vocabulary terms). Always WARN.
const mentions = [
  [/snapshot pin|root:rev|link:rev/i, 'snapshot pins (§11 future work; allow-listed for the §8 residual line)'],
  [/topology cascade/i, 'topology cascade (spec uses both terms; prefer "kind 5 cascade", CHN-2)'],
  [/fork resolution/i, '"fork resolution" as mechanism (created_at ordering removed, SF-4)'],
];
// I6 scans everything EXCEPT a terminology-map section: once App B lands inside
// the rewritten TM, its left column holds retired terms by design. Detected by
// heading title so "App B"/"Appendix B" numbering can shift freely.
const i6Text = (() => {
  const start = tm.search(/^## .*[Tt]erminology [Mm]ap.*$/m);
  if (start < 0) return tm;
  const rest = tm.slice(start);
  const endRel = rest.slice(1).search(/^## /m);
  const end = endRel < 0 ? tm.length : start + 1 + endRel;
  return tm.slice(0, start) + tm.slice(end);
})();
for (const [re, why] of dead)
  for (const m of i6Text.matchAll(new RegExp(re.source, re.flags.replace(/g/, '') + 'g')))
    report(true)(`I6 dead mechanism: ${why} — near "${i6Text.slice(Math.max(0, m.index - 30), m.index + 50).replace(/\n/g, ' ').slice(0, 90)}…"`);
for (const [re, why] of mentions)
  for (const m of i6Text.matchAll(new RegExp(re.source, re.flags.replace(/g/, '') + 'g')))
    warn(`I6 mention: ${why} — near "${i6Text.slice(Math.max(0, m.index - 30), m.index + 50).replace(/\n/g, ' ').slice(0, 90)}…"`);

// ---- I7 entry shape (WARN while drifted, FAIL in strict) ----------------------
// Slices the TM at ^#### T- headings and checks each block for the Part 3
// template contract: five header rows, valid Type, rule-anchored Spec row.
const HEADER_ROWS = ['Type', 'Adversary', 'Assets', 'Goals', 'Spec'];
const typeRe = /^\| Type \|\s*(adversarial|structural-weakness)\s*\|/m;
const specRe = /^\| Spec \|(.+)\|/m;
const ruleCiteRe = CITE_RE;
const structuralRe = /no single rule[^\n]*§/i;
{
  const heads = [...tm.matchAll(/^#### (T-[A-Z]{2}-\d{2})\b.*$/gm)];
  for (let i = 0; i < heads.length; i++) {
    const id = heads[i][1];
    const block = tm.slice(heads[i].index, heads[i + 1]?.index ?? tm.length);
    for (const row of HEADER_ROWS)
      if (!new RegExp(`^\\| ${row} \\|`, 'm').test(block))
        report(true)(`I7 ${id}: missing header row | ${row} |`);
    if (!typeRe.test(block)) report(true)(`I7 ${id}: Type row missing or value not in {adversarial, structural-weakness}`);
    const specRow = block.match(specRe)?.[1] ?? '';
    const citesOk = [...specRow.matchAll(new RegExp(ruleCiteRe.source, 'g'))].some((m) => ruleSet.has(m[1]));
    if (!citesOk && !structuralRe.test(specRow))
      report(true)(`I7 ${id}: Spec row has no valid rule-ID citation and no structural-weakness form ("no single rule: family XX; see §…")`);
  }
}

console.log(`\n${failures} FAIL, ${warnings} WARN`);
process.exit(failures ? 1 : 0);
