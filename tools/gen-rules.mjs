#!/usr/bin/env node
// Generates rules.json, the machine-readable rule registry, from the rule tables of
// docs/protocol-spec.md. The tables are the only source; rules.json is never edited by hand.
//
// Usage: node tools/gen-rules.mjs           write rules.json
//        node tools/gen-rules.mjs --check   exit 1 if rules.json differs from the spec

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const ROW = /^\| (?:<a id="rule-[A-Za-z0-9-]+"><\/a>)?([A-Z][A-Za-z]*-?\d+) \| ([VAD—]) \| (.*?) \| (.*) \|$/;

export function extractRules(spec) {
  const specVersion = spec.match(/^\*\*Version:\*\* (\d+\.\d+\.\d+)$/m)?.[1];
  const rules = [];
  let section = "", inCode = false;
  for (const line of spec.split("\n")) {
    if (/^```/.test(line)) { inCode = !inCode; continue; }
    if (inCode) continue;
    const h = line.match(/^#{2,4} (\d+(?:\.\d+)?)\.? /);
    if (h) { section = h[1]; continue; }
    const m = line.match(ROW);
    if (!m) continue;
    const [, id, layer, inherits, text] = m;
    rules.push({
      id,
      layer: layer === "—" ? null : layer,
      inherits: inherits === "—" ? [] : inherits.split(", "),
      section,
      text,
    });
  }
  return { specVersion, rules };
}

export const render = (reg) => JSON.stringify(reg, null, 2) + "\n";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const spec = readFileSync(join(root, "docs/protocol-spec.md"), "utf8");
  const out = render(extractRules(spec));
  const path = join(root, "rules.json");
  if (process.argv.includes("--check")) {
    let cur = "";
    try { cur = readFileSync(path, "utf8"); } catch {}
    if (cur !== out) { console.error("rules.json is out of date: run node tools/gen-rules.mjs"); process.exit(1); }
    console.log("OK rules.json matches the spec tables");
  } else {
    writeFileSync(path, out);
    console.log(`wrote rules.json (${JSON.parse(out).rules.length} rules)`);
  }
}
