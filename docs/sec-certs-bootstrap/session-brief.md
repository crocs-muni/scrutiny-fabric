# Session brief — sec-certs → SCRUTINY Fabric paper bootstrap (CC only)

> Paste the "Kickoff prompt" section below as your first message in the new
> session. The "Repository orientation" section above it tells that session what
> in this repo is real and what to ignore — read it first.

---

## Repository orientation (READ FIRST — what's current vs stale)

You are working in `C:\Users\alsorehi\scrutiny-fabric`.

**The protocol spec is the ONLY authoritative, up-to-date artifact:**

- `docs/protocol-spec.md` (v0.5.9) — the single source of truth. Trust this.

**Everything else in this repo is stale / reference-only.** Read it for
historical context if useful, but do NOT treat it as current and do NOT build on
it:

- All other files in `docs/` (e.g. `test-vectors.md`, `test-vectors-v051.md`,
  the `SCRUTINY_threat_model_*.md` files, `review-pass1-*.md`,
  `*-architecture*.md`, `threat-model-*.md`) — historical.
- The root-level `*-report.md` / research markdown files — historical.
- `packages/` and `apps/` in this repo — stale code, not a build target.

**Ignore these sibling repos entirely (dead / demo / abandoned):**

- `scrutiny_nostr_publisher`
- `scrutiny_nostr_publisher_broken`
- `DEMO-scrutiny-fabric`
- `scrutiny_mo_demo`
- `scrutiny-lens-demo`

**Do NOT write production code this session.** Where the eventual protocol
library and daily bot will live is undecided — out of scope here. This session
is paper modeling only: markdown + hand-written JSON examples.

**Do NOT edit `protocol-spec.md`.** It is read-only. When you find a rough edge,
record it as a proposal in `gap-list.md` keyed to the relevant Appendix F rule
ID. Spec changes are approved separately.

**Write all output into this folder** (`docs/sec-certs-bootstrap/`):

```
docs/sec-certs-bootstrap/
  session-brief.md      # this file
  dataset/              # drop the downloaded CC JSON dump here (see its README)
  decision-log.md       # YOU create: mapping choices + reasoning
  gap-list.md           # YOU create: spec rough edges, keyed to rule IDs
  examples/             # YOU create: worked JSON event examples
```

---

## Kickoff prompt

```
# Session goal: sec-certs → SCRUTINY Fabric paper bootstrap (CC only)

We're paper-modeling how Common Criteria certificates from the sec-certs dataset
map onto SCRUTINY Fabric protocol events. No production code this session — the
output is a modeling design + a spec gap list. This doubles as the design basis
for a daily sec-certs publisher bot.

## Context you need
- SCRUTINY Fabric is a Nostr-based discovery layer for security/audit metadata.
- The protocol spec is at: C:\Users\alsorehi\scrutiny-fabric\docs\protocol-spec.md
  (v0.5.9). READ IT FIRST. Key parts: §4 (the 4 event types: Product, Metadata,
  Binding, Patch), §5 (patches/payload), §7 (canonical chain + overlays),
  §10 (deletion), and Appendix F (flat rule registry — every normative rule has
  a stable ID like BD-3, PT-6, DEL-2, tagged with a V/A/D layer).
- The spec is the ONLY current artifact in this repo. Everything else (other
  docs, packages/, apps/) is stale/reference-only. See session-brief.md's
  "Repository orientation" section.
- TREAT THE SPEC AS READ-ONLY. Do NOT edit protocol-spec.md. When you find a
  rough edge, record it as a proposal in gap-list.md keyed to the rule ID; spec
  changes are approved separately.

## The dataset
- Download the current sec-certs Common Criteria JSON dump into
  docs/sec-certs-bootstrap/dataset/ (see that folder's README). Scope: CC only,
  ignore FIPS. Inspect its actual structure before proposing anything. I will
  also propose structures based on what's there — this is a collaboration, not a
  spec-to-output translation. Don't rush to a model.

## Initial mapping intuition (mine — challenge it freely)
- A CC certificate → one ProductEvent.
- Metadata events hanging off it: the CSV/structured record, a link to the
  certification report PDF, a link to the security target PDF, extracted
  symmetric-crypto info, etc. (one MetadataEvent per distinct artifact/aspect).
- Bindings link the product to its metadata.
- Open question for us to settle in-session: where exactly Bindings vs Metadata
  draw the line, what a Binding actually represents for a cert, and how
  multi-PDF / multi-artifact certs are structured.

## The daily-update flow this must support (model BOTH static + diff this session)
A bot will, every day: download the latest sec-certs JSON → diff against
yesterday's → publish deltas to Nostr:
  - new certificate            → new Product (+ Metadata + Binding) events
  - new/added PDF or artifact   → new Metadata event
  - changed content field       → Patch event
  - withdrawn / superseded cert  → kind 5 deletion (and/or relationship event)
Work through how each diff case maps to events. This is where most spec rough
edges live (patch targeting, what's patchable vs append-only per PT-9, the fact
that Bindings have no patch update mechanism per BD-9, deletion cascade per
§10), so push hard here.

## Sample strategy
- Quick first pass on 10–15 certs chosen to span the hard cases (a cert with
  maintenance/updates, one superseded or with related certs, a plain one, one
  with multiple PDFs). Validate the model against these.
- Only scale to the full dataset once we're confident the model is 100% right.

## Deliverables (write into docs/sec-certs-bootstrap/)
1. decision-log.md — each mapping choice (Product/Metadata/Binding split,
   diff→event/patch rules) with reasoning. Note the dataset filename + download
   date at the top for reproducibility.
2. examples/ — hand-written example events for the sample certs, including at
   least one patch case and one deletion case. These seed conformance vectors.
3. gap-list.md — every spec ambiguity or missing rule found, keyed to Appendix F
   rule IDs where applicable, written as proposals (not applied to the spec).

Start by reading the spec and downloading + inspecting the dataset, then let's
brainstorm the model together before writing any examples.
```
