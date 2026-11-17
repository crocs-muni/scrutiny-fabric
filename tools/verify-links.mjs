#!/usr/bin/env node
// Link and cross-reference checks for the Markdown documents in this repository.
//
// - every relative link points at an existing file;
// - every #fragment names a heading or an explicit anchor in its target;
// - every "§N.M" in the specification (outside CommonMark references) names a numbered heading;
// - every rule ID mentioned as "[ID](#rule-id)" has a rule-table row.
//
// Usage: node tools/verify-links.mjs   (exit 0 = all checks pass)

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, resolve, relative } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const failures = [];
const fail = (m) => failures.push(m);

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
});
const files = [...walk(join(root, "docs")), join(root, "README.md"), join(root, "CHANGELOG.md")];

const slug = (h) => h.replace(/`/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").toLowerCase()
  .replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/ /g, "-");

function parse(path) {
  const text = readFileSync(path, "utf8");
  const anchors = new Set();
  const counts = new Map();
  let inCode = false;
  const lines = text.split("\n");
  for (const l of lines) {
    if (/^```/.test(l)) { inCode = !inCode; continue; }
    if (inCode) continue;
    const h = l.match(/^#{1,6} (.*)$/);
    if (h) {
      let s = slug(h[1]); const n = counts.get(s) ?? 0; counts.set(s, n + 1);
      anchors.add(n ? `${s}-${n}` : s);
    }
    for (const m of l.matchAll(/<a id="([^"]+)">/g)) anchors.add(m[1]);
  }
  return { text, anchors, lines };
}
const docs = new Map(files.map((f) => [f, parse(f)]));

for (const [file, { lines }] of docs) {
  let inCode = false;
  lines.forEach((l, i) => {
    if (/^```/.test(l)) { inCode = !inCode; return; }
    if (inCode) return;
    const where = `${relative(root, file)}:${i + 1}`;
    for (const m of l.replace(/`[^`]*`/g, "").matchAll(/\]\(([^)\s]+)\)/g)) {
      const href = m[1];
      if (/^(https?:|mailto:)/.test(href)) continue;
      const [p, frag] = href.split("#");
      const target = p ? resolve(dirname(file), p) : file;
      if (!existsSync(target)) { fail(`${where}: link target ${href} does not exist`); continue; }
      if (frag && target.endsWith(".md")) {
        const d = docs.get(target) ?? parse(target);
        if (!d.anchors.has(frag)) fail(`${where}: no anchor #${frag} in ${relative(root, target)}`);
      }
    }
  });
}

// section references in the specification
const specPath = join(root, "docs/protocol-spec.md");
const spec = docs.get(specPath);
const numbered = new Set();
let code = false;
for (const l of spec.lines) {
  if (/^```/.test(l)) { code = !code; continue; }
  const m = !code && l.match(/^#{2,4} (\d+(?:\.\d+)?)\.? /);
  if (m) numbered.add(m[1]);
}
let inCode2 = false;
spec.lines.forEach((l, i) => {
  if (/^```/.test(l)) { inCode2 = !inCode2; return; }
  if (inCode2) return;
  for (const m of l.matchAll(/(CommonMark )?§(\d+(?:\.\d+)?)/g))
    if (!m[1] && !numbered.has(m[2])) fail(`docs/protocol-spec.md:${i + 1}: §${m[2]} is not a section`);
});

const ruleIds = new Set([...spec.text.matchAll(/<a id="rule-([A-Za-z0-9-]+)"><\/a>/g)].map((m) => m[1]));
for (const [file, { text }] of docs)
  for (const m of text.matchAll(/\(#rule-([A-Za-z0-9-]+)\)/g))
    if (file === specPath && !ruleIds.has(m[1])) fail(`${relative(root, file)}: link to unknown rule ${m[1]}`);

if (failures.length) { for (const f of failures) console.error(`FAIL ${f}`); process.exit(1); }
console.log(`OK ${files.length} documents; links, anchors and section references resolve (${numbered.size} numbered sections, ${ruleIds.size} rule anchors)`);
