#!/usr/bin/env node
// Corpus and rule-registry integrity checks for this repository.
//
// Verifies the claims section 10.1 of the specification makes about the conformance vectors
// (file bytes, digests, case counts, JSON validity, LF line endings), that the rule IDs cited by
// vectors exist, that rules.json is exactly what the spec's rule tables generate, and that the
// version markers agree. Structural checks only: the semantic rule validation lives in
// scrutiny-fabric-tools and is deliberately not duplicated here (see docs/adr/0006).
//
// Usage: node tools/verify-corpus.mjs   (exit 0 = all checks pass)

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { extractRules, render } from "./gen-rules.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

const spec = readFileSync(join(root, "docs/protocol-spec.md"), "utf8");

// --- 10.1: digest and case-count pins ----------------------------------------

const pins = [...spec.matchAll(/\| `vectors\/(\w+\.json)` \| \w+ \| [A-Z] \| (\d+) \| `([0-9a-f]{64})` \|/g)];
check(pins.length >= 2, `expected at least 2 rows in the section 10.1 table, found ${pins.length}`);

const corpus = {};
for (const [, file, count, digest] of pins) {
  const bytes = readFileSync(join(root, "vectors", file));
  const sha = createHash("sha256").update(bytes).digest("hex");
  check(sha === digest, `${file}: digest mismatch (file ${sha}, spec ${digest})`);
  check(!bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), `${file}: has a byte-order mark`);
  check(!bytes.includes(0x0d), `${file}: contains CR bytes (digest pins LF line endings)`);
  check(bytes.at(-1) === 0x0a && bytes.at(-2) !== 0x0a, `${file}: must end with exactly one LF`);

  let parsed = null;
  try { parsed = JSON.parse(bytes.toString("utf8")); } catch (e) {
    failures.push(`${file}: does not parse as JSON (${e.message})`);
  }
  if (parsed) {
    corpus[file] = parsed;
    check(Array.isArray(parsed.cases), `${file}: top-level "cases" is not an array`);
    check(parsed.cases.length === Number(count), `${file}: case count mismatch (${parsed.cases.length} cases, spec says ${count})`);
  }
}

// --- Rule registry: rules.json is generated from the spec tables --------------

const registry = extractRules(spec);
const ids = new Set(registry.rules.map((r) => r.id));
check(ids.size === registry.rules.length, "a rule ID appears in two rule tables");
let committed = "";
try { committed = readFileSync(join(root, "rules.json"), "utf8"); } catch { /* reported below */ }
check(committed === render(registry), "rules.json differs from the spec rule tables (run node tools/gen-rules.mjs)");

// --- Case sanity: unique permanent names; rules cited exist ------------------

for (const [file, parsed] of Object.entries(corpus)) {
  const seen = new Set();
  for (const c of parsed.cases) {
    check(typeof c.name === "string" && !seen.has(c.name), `${file}: duplicate or missing case name ${JSON.stringify(c.name)}`);
    seen.add(c.name);
    check(ids.has(c.rule), `${file}: case ${c.name} cites rule ${c.rule}, which is not in the spec`);
  }
}

// --- Version markers: the canonical literals stay in sync --------------------

const titleV = spec.match(/^# SCRUTINY Fabric — Protocol Specification v(\d+\.\d+\.\d+)$/m)?.[1];
const fieldV = spec.match(/^\*\*Version:\*\* (\d+\.\d+\.\d+)$/m)?.[1];
const tagExampleV = spec.match(/(?:for example|such as) `\["t", "scrutiny-v(\d+\.\d+\.\d+)"\]`/)?.[1];
check(titleV != null, "title line does not carry a concrete vMAJOR.MINOR.PATCH version");
check(fieldV != null, "**Version:** field does not carry a concrete version");
for (const [where, v] of [["**Version:** field", fieldV], ["section 3.1 tag example", tagExampleV], ["rules.json specVersion", registry.specVersion]])
  check(v === titleV, `${where} carries ${v ?? "no"} version, title says ${titleV}`);

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL ${f}`);
  process.exit(1);
}
const totalCases = Object.values(corpus).reduce((n, p) => n + p.cases.length, 0);
console.log(`OK ${pins.length} vector files, ${totalCases} cases, digests and counts match section 10.1`);
console.log(`OK ${ids.size} rules; rules.json matches the spec tables`);
console.log(`OK version markers consistent (title, Version field, section 3.1, rules.json: ${titleV})`);
