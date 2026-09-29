#!/usr/bin/env node
// ste-census.mjs — ASD-STE100 prose census for docs/threat-model.md.
// Mirrors the doc's own §12 source-6 declared apparatus classes:
//   - citation apparatus: semicolons separating rule IDs from section anchors
//   - rating-line factor chains (segments 4-6: Impact/Likelihood/Residual)
//   - verbatim quoted spec text (keyword declaration makes quotes load-bearing)
//   - table cells, headings, fenced/inline code, list-item enumerations of names
// Reports only genuine prose violations. Exit 1 if any found.
import { readFileSync } from 'node:fs';

const TM = 'docs/threat-model.md';
const lines = readFileSync(TM, 'utf8').split('\n');

const RATING_LINE = /\*{0,2}(4\. Impact|5\. Likelihood|6\. Residual risk|Likelihood:|Impact:|Residual risk:)/;
const QUOTE = /["\u201c][^"\u201d]*(MUST|SHOULD|MAY)[^"\u201d]*["\u201d]/;
// name-enumeration list items (NIP lists, term lists): >50% of tokens are
// identifiers/glosses; treated as list apparatus per §12.
const NAME_ENUM = /(NIP-\d+|T-[A-Z]{2}-\d{2}|\([a-z, ]+\))/g;

const violations = [];
let inCode = false;
lines.forEach((l, i) => {
  if (l.trim().startsWith('```')) { inCode = !inCode; return; }
  if (inCode) return;
  if (!l || /^\s*\|/.test(l) || /^#{1,6} /.test(l)) return; // tables, headings
  const stripped = l
    .replace(/`](protocol-spec\.md#rule-[A-Z0-9-]+)`/g, '')
    .replace(/](protocol-spec\.md#rule-[A-Z0-9-]+)/g, '')
    .replace(/`[^`]*`/g, 'X');
  for (const sent of stripped.split(/(?<=[.!?])\s+/)) {
    const t = sent.trim();
    if (!t) continue;
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length <= 25) continue;
    if (RATING_LINE.test(t)) continue;          // declared apparatus
    if (QUOTE.test(t)) continue;                // verbatim quote
    const nameTokens = (t.match(NAME_ENUM) || []).join(' ').split(/\s+/).length;
    if (nameTokens / words.length > 0.4) continue; // name-enumeration apparatus
    violations.push(`L${i + 1} ${words.length}w: ${t.slice(0, 90)}`);
  }
});

if (violations.length) {
  violations.forEach(v => console.log(`VIOLATION ${v}`));
  console.log(`\n${violations.length} genuine prose violations`);
  process.exit(1);
}
console.log('OK 0 genuine prose violations (apparatus classes excluded per §12 source 6)');
