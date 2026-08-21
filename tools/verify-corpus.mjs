#!/usr/bin/env node
// Corpus and rule-registry integrity checks for this repository.
//
// Verifies the claims Appendix G (G.1) makes about the conformance vectors —
// file bytes, digests, case counts, JSON validity, LF line endings — and that
// the rule IDs cited by vectors and mirrored between the section rule tables
// and Appendix F are consistent. Structural checks only: the semantic rule
// validation lives in scrutiny-fabric-tools (tools/extract-rules.mjs) and is
// deliberately not duplicated here (see docs/DECISIONS.md S6).
//
// Usage: node tools/verify-corpus.mjs   (exit 0 = all checks pass)

import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

const spec = readFileSync(join(root, "docs/protocol-spec.md"), "utf8");

// --- G.1: digest and case-count pins ---------------------------------------

const g1 = [...spec.matchAll(/\| `vectors\/(\w+\.json)` \| \w+ \| [A-Z] \| (\d+) \| `([0-9a-f]{64})` \|/g)];
check(g1.length >= 2, `expected at least 2 rows in the G.1 table, found ${g1.length}`);

const corpus = {};
for (const [, file, count, digest] of g1) {
  const bytes = readFileSync(join(root, "vectors", file));
  const sha = createHash("sha256").update(bytes).digest("hex");
  check(sha === digest, `${file}: digest mismatch (file ${sha}, G.1 ${digest})`);
  check(!bytes.includes(0xef) || !bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), `${file}: has a byte-order mark`);
  check(!bytes.includes(0x0d), `${file}: contains CR bytes (digest pins LF line endings)`);
  check(bytes.at(-1) === 0x0a && bytes.at(-2) !== 0x0a, `${file}: must end with exactly one LF`);

  let parsed = null;
  try { parsed = JSON.parse(bytes.toString("utf8")); } catch (e) {
    failures.push(`${file}: does not parse as JSON (${e.message})`);
  }
  if (parsed) {
    corpus[file] = parsed;
    check(Array.isArray(parsed.cases), `${file}: top-level "cases" is not an array`);
    check(parsed.cases.length === Number(count), `${file}: case count mismatch (${parsed.cases.length} cases, G.1 says ${count})`);
  }
}

// --- Case sanity: unique permanent names; rules cited exist ----------------

const appendixF = spec.split("## Appendix F")[1]?.split("## Appendix G")[0] ?? "";
const fIds = new Set([...appendixF.matchAll(/^\| ([A-Z][A-Z0-9-]*) \| /gm)].map((m) => m[1]));
fIds.delete("ID");

for (const [file, parsed] of Object.entries(corpus)) {
  const seen = new Set();
  for (const c of parsed.cases) {
    check(typeof c.name === "string" && !seen.has(c.name), `${file}: duplicate or missing case name ${JSON.stringify(c.name)}`);
    seen.add(c.name);
    check(fIds.has(c.rule), `${file}: case ${c.name} cites rule ${c.rule}, which is not in Appendix F`);
  }
}

// --- Version markers: the canonical literals stay in sync -------------------

const titleV = spec.match(/^# SCRUTINY Fabric — Protocol Specification v(\d+\.\d+\.\d+)$/m)?.[1];
const fieldV = spec.match(/^\*\*Version:\*\* (\d+\.\d+\.\d+)$/m)?.[1];
const tagExampleV = spec.match(/e\.g\. `\["t", "scrutiny-v(\d+\.\d+\.\d+)"\]`/)?.[1];
const equivMatch = spec.match(/\(`scrutiny-v(\d+\.\d+\.\d+)` ≡ v(\d+\.\d+\.\d+)\)/);
const preambleV = spec.match(/\(`scrutiny-fabric`, `scrutiny-v(\d+\.\d+\.\d+)`, and exactly one event-type tag\)/)?.[1];
check(titleV != null, "title line does not carry a concrete vMAJOR.MINOR.PATCH version");
check(fieldV != null, "**Version:** field does not carry a concrete version");
for (const [where, v] of [["**Version:** field", fieldV], ["§3 tag example", tagExampleV], ["§3 form equivalence (tag side)", equivMatch?.[1]], ["§3 form equivalence (version side)", equivMatch?.[2]], ["§4 preamble", preambleV]])
  check(v === titleV, `${where} carries ${v ?? "no"} version, title says ${titleV}`);

// --- Rule registry: section rule tables and Appendix F stay in sync --------

const body = spec.split("## Appendix F")[0];
const sectionIds = new Set([...body.matchAll(/^\| ([A-Z][A-Z0-9-]*) \| [VAD—] \| /gm)].map((m) => m[1]));
for (const id of sectionIds) check(fIds.has(id), `rule ${id} appears in a section rule table but not in Appendix F`);
for (const id of fIds) check(sectionIds.has(id), `rule ${id} appears in Appendix F but in no section rule table`);

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL ${f}`);
  process.exit(1);
}
const totalCases = Object.values(corpus).reduce((n, p) => n + p.cases.length, 0);
console.log(`OK ${g1.length} vector files, ${totalCases} cases, digests and counts match G.1`);
console.log(`OK ${sectionIds.size} rules consistent between section tables and Appendix F`);
console.log(`OK version markers consistent (title, Version field, §3, §4 preamble: ${titleV})`);
