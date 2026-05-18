# Planning Doc Catalog — Methodology For Sibling Repos

This document catalogs the architecture planning docs that exist in `pitant-historian` (`docs/architecture/00-*` through `10-*`) and explains how to replicate the same depth in any sibling PITANT repo (`pitant-fieldlink`, `pitant-streams`, `pitant-web`, `pitant-batch`, `pitant-spc`, `pitant-oee`, `pitant-compliance`, `pitant-deploy`, etc.).

The order is load-bearing. Each doc consumes the prior ones. Skipping ahead (e.g. writing a roadmap before the vision is fixed, or writing a feature inventory before the core process families are named) produces docs that look complete but cannot be acted on.

The replication prompts below are designed for an AI assistant (e.g. Claude Code, Cursor, Claude API) operating in the target sibling repo. They are deliberately verbose — terse prompts produce thin docs. The prompt for doc 06 in particular is what yields a ~2000-line maximal inventory rather than a 200-line list.

---

## At a glance

| # | Doc | Lines (historian) | Role | Depends on |
|---|---|---:|---|---|
| 00 | [VISION](00-VISION.md) | 102 | Product thesis, principles, what "premium" means | — |
| 01 | [COMPETITIVE-ANALYSIS](01-COMPETITIVE-ANALYSIS.md) | 247 | Every incumbent + parity matrix + leapfrog points | 00 |
| 02 | [CORE-FEATURES](02-CORE-FEATURES.md) | 326 | Process families, contracts, parity bars | 00, 01 |
| 03 | [SAFETY-AND-SECURITY](03-SAFETY-AND-SECURITY.md) | 150 | Assurance ladder (SL-0 → SL-4), 62443 mapping, mode vectors | 00, 02 |
| 04 | [PHYSICAL-ARCHITECTURE](04-PHYSICAL-ARCHITECTURE.md) | 206 | Deployment tiers (workshop → gigafactory), topology | 00, 02, 03 |
| 05 | [ROADMAP](05-ROADMAP.md) | 987 | Phased build plan, every phase, every gate | 00–04 |
| 06 | [FEATURE-SPEC-INVENTORY](06-FEATURE-SPEC-INVENTORY.md) | 1994 | Maximal feature inventory, mode vectors, future surface | 00–05 |
| 07 | [FRONTEND-DEV-HANDOFF](07-FRONTEND-DEV-HANDOFF.md) | 78 | Workflow map, contract pack format, UI invariants | 02, 05, 06, 08 |
| 08 | [PHASE-20-RESTRUCTURING-PLAN](08-PHASE-20-RESTRUCTURING-PLAN.md) | 553 | Modular monolith restructuring, route metadata, file movement | 02, 05, 06 |
| 09 | [PHASE-21-ENTERPRISE-READINESS-PLAN](09-PHASE-21-ENTERPRISE-READINESS-PLAN.md) | 2138 | Production hardening phases, 10/10 scorecard | 03, 05, 06, 08 |
| 10 | [USE-CASES](10-USE-CASES.md) | 231 | Product slices, profile gates, sibling repo handoffs | 00, 02, 06, 09 |

Total: ~7000 lines of planning before a single feature ships. That is the point. The cost is paid once; every implementation PR, every test, every release-gate decision references back.

---

## How to use this catalog in a sibling repo

1. **Pick the right slot.** Identify what role the sibling repo plays in the [Whole-PITANT Composition Model](06-FEATURE-SPEC-INVENTORY.md#whole-pitant-composition-model) — temporal evidence, frontend, edge collector, governance, domain analytics, etc.
2. **Write docs in order, 00 → 10.** Do not start 05 (roadmap) before 02 (core features) is stable. Do not write 06 (feature inventory) before 00–05 are written, because the inventory derives its taxonomy from them.
3. **Use the replication prompts below.** Each prompt is the actual prompt to give an AI assistant in the target repo. Each one references the prior docs as inputs.
4. **Pin the cross-repo invariants.** The non-negotiables at the end of the historian's [architecture README](README.md) — no control writes, no vendor leakage, storage-agnostic contract, lossless by default, replay as a verb, bounded memory, fail-safe defaults — apply across every sibling repo.

---

## Doc 00 — VISION

### Purpose
States the product thesis in plain language. Forces a deliberate answer to: *what does this repo exist to do that nothing on the market does together?* All later docs reference 00 when there is disagreement on scope.

### Contents
- Thesis paragraph (what the product is *not*; what it *is*).
- Five product principles (P1–P5), each one-paragraph, each load-bearing in later phase decisions.
- Concrete table: commodity vs premium definition, dimension by dimension.
- Scale spectrum statement: same product across smallest and largest deployments.
- Non-negotiables list (3–7 items).

### Why it exists
Every repo eventually faces scope-creep arguments framed as "but the customer wants X." The vision document is the artifact that says "yes, but X violates P2 — bring back the data." Without it, every decision is re-litigated.

### Replication prompt

```
You are writing 00-VISION.md for the {SIBLING_REPO_NAME} repository in the PITANT
Plant-Physics OS polyrepo. This is doc zero — the product thesis — and every later
planning doc will reference it when scope is disputed.

Context inputs you must read first:
- The historian's 00-VISION.md for tone, structure, and the bar
- The historian's 06-FEATURE-SPEC-INVENTORY.md "Whole-PITANT Composition Model"
  to understand which slot this sibling occupies and what historian, contracts,
  identity, and other sibling repos already own
- Any existing README.md or scoping notes in the target repo

Write a document of ~80–120 lines with these sections:

1. **Thesis (3–6 sentences).** State what the prevailing market definition of
   {SIBLING_DOMAIN} is, name why it is wrong or insufficient, and state the
   one-sentence product definition this repo will own. The thesis must be
   falsifiable — a reader must be able to say "if X happens, the thesis is
   wrong." Avoid marketing adjectives.

2. **Five product principles (P1–P5).** Each principle is one paragraph (3–5
   sentences). Each must:
   - Name a specific behavior the product will exhibit (or refuse).
   - Contrast against at least one named incumbent or industry pattern.
   - Be invokable later as "this violates P3" in a design review.
   Principles must cover: (a) contract discipline; (b) the data integrity or
   lineage invariant this repo owns; (c) a first-class verb (e.g. replay,
   reconcile, attest, broadcast, detect) that distinguishes the repo; (d) a
   composition or boundary rule with sibling repos; (e) a bounded-resource
   invariant that makes the product safe to deploy in regulated contexts.

3. **What "premium" means concretely.** A table with 5–8 rows. Columns:
   Dimension | Commodity {SIBLING_DOMAIN} | Premium ({SIBLING_REPO_NAME}).
   Each row must be specific enough that a procurement reviewer can verify
   the claim against running code or tests.

4. **Scale spectrum statement (1 paragraph).** State that the same binary
   serves the smallest and largest deployments. Name the smallest target
   (workshop, single device, single tenant) and the largest (fleet,
   gigafactory, treaty-governed federation). Reject any "lite" rewrite.

5. **What this repo is deliberately not (5–10 bullets).** Each bullet names a
   capability that belongs to a sibling repo and points at it by name. This
   prevents scope leak in later docs.

6. **Non-negotiables (3–7 bullets).** Hard rules that override every later
   trade-off. Inherit from the PITANT-wide non-negotiables in the historian's
   architecture README, then add 1–3 that are specific to {SIBLING_DOMAIN}.

Tone rules:
- No marketing adjectives. No "world-class," "best-in-class," "leading."
- Every claim must be testable, deniable, or measurable.
- Reference at least three real incumbent products by name and what they
  actually do, including their genuine strengths.
- Reference 06-FEATURE-SPEC-INVENTORY.md as the source of truth for scope
  even though that doc does not exist yet in this repo — it will be written
  next.
- Use Markdown. Headings start at ## (the title is the only H1).

Acceptance: the doc must be short enough to read in five minutes and dense
enough that nothing in it could be removed without losing a constraint.
```

---

## Doc 01 — COMPETITIVE-ANALYSIS

### Purpose
Forces an honest read of every incumbent — including their genuine strengths and what their actual customers complain about. Avoids the trap of building toward a strawman competitor.

### Contents
- Cohort table grouping competitors (incumbents, modern alternatives, open-source, adjacent layers).
- Per-product entry: what it is, genuine strengths, what customers actually say (sourced), explicit parity points the new product must reach.
- Final synthesis: where parity is required, where leapfrog is required.

### Why it exists
"We do X better than PI System" is a useless claim if "X" isn't what PI System loses customers on. This doc names where displacement actually happens — pricing, integration friction, missing analytics, vendor lock-in — versus where the incumbent is genuinely strong (operational maturity, connector breadth).

### Replication prompt

```
You are writing 01-COMPETITIVE-ANALYSIS.md for {SIBLING_REPO_NAME}. Read
00-VISION.md first; it states the product thesis you are now stress-testing
against the market.

Goal: produce a working competitive map that is useful in design reviews and
sales conversations. This is not a marketing document. Be honest about where
competitors are strong; be specific about where they actually lose customers.

Produce 200–300 lines with this structure:

1. **Intro paragraph.** State that this is a working map, not marketing.
   Reference 00 as the thesis and 06 (not yet written) as the eventual
   source-of-truth inventory.

2. **Cohort table.** Group competitors into 3–5 cohorts. Typical cohorts
   for an industrial software repo: legacy incumbents, modern alternatives,
   open-source/general, adjacent context/analytics layer. Each cohort row
   has: Players (named products, real vendors), Their pitch (one quoted
   sentence — what their sales pitch actually is).

3. **Per-product entry, one section per competitor (5–12 competitors).**
   Each section follows this template exactly:

   ## N. {Product Name} ({one-line position})

   **What it is.** 2–4 sentences of factual description. Include the product
   family if there is one (e.g. PI Data Archive + PI AF + PI Vision). Cite
   approximate market position if known.

   **Genuine strengths.** 3–6 bullets. Be honest. If they have decades of
   operational maturity, say so. If their connector library is the largest
   in the industry, say so. A reader who works at the competitor company
   should agree with this section.

   **What customers actually say.** 3–6 bullets. Quote-style, sourced where
   possible (Gartner Peer Insights, control-engineering forums, Reddit
   r/PLC, LinkedIn complaints, customer references in case studies that
   say more than they meant to). Avoid invented criticisms. Real customer
   pain points: licensing, lock-in, integration friction, performance at
   scale, specific missing features, training requirements.

   **Where we must reach parity.** 1–3 bullets naming specific capabilities
   the sibling repo must match before any displacement claim is credible.

   **Where we leapfrog.** 1–3 bullets naming specific capabilities the
   sibling repo owns that this competitor structurally cannot match (e.g.
   because their data model forbids it, their pricing forbids it, or their
   architecture forbids it). If you cannot identify a structural advantage,
   say so explicitly rather than inventing one.

4. **The displacement test (final section).** 1–3 paragraphs naming what a
   customer must be able to do with {SIBLING_REPO_NAME} as their daily
   tool before the incumbent becomes optional rather than mandatory. This
   is the bar for sales — not "we have feature parity," but "they can stop
   paying the incumbent."

Cohorts and competitor sets by domain (use as a starting point, then expand):
- Historian → PI, AVEVA, Honeywell PHD, IP.21, Proficy, FactoryTalk, Canary,
  Ignition, InfluxDB, TimescaleDB, ClickHouse, Cognite, Seeq, TrendMiner
- Edge/Fieldlink → Kepware, Matrikon, OPC Router, Ignition Edge, AWS IoT
  Greengrass, Azure IoT Edge, HighByte, Litmus Edge
- Frontend/Web → PI Vision, AVEVA Insight, Cognite Data Fusion UI,
  Seeq Workbench, Grafana, Tableau, Power BI, Ignition Perspective
- Batch (S88) → PI Event Frames, Werum PAS-X, Rockwell PharmaSuite,
  Siemens SIMATIC IT, AVEVA Batch Management
- SPC/Quality → Minitab, NWA Quality Analyst, ProFicient, InfinityQS,
  SAS JMP, Honeywell SQCpack
- Compliance/Audit → Veeva Vault, MasterControl, ETQ Reliance,
  ComplianceWire, Splunk audit packs
- Identity → Okta, Auth0, Azure AD, Keycloak, Microsoft Entra
- Deploy → Helm + Argo, Crossplane, OpenShift, Rancher, AWS Outposts

Tone rules:
- Real numbers where you have them, "approximately" where you do not, never
  invented statistics. If a market share or revenue figure is uncertain, say
  "industry estimate" and link it.
- Strengths and weaknesses must both be specific. "Slow" is not specific;
  "single-server PI Data Archive throughput is bounded near ~150k events/sec
  in published case studies" is specific.
- Do not call any competitor "outdated" or "legacy" without naming the
  specific dimension they are outdated on.

Acceptance: a reader who is a customer of one of these competitors should
recognize their product clearly, agree with the strengths section, and find
the weaknesses honest rather than spun.
```

---

## Doc 02 — CORE-FEATURES

### Purpose
Names the process families inside the repo. The roadmap (05) maps phases to these families; the feature inventory (06) hangs requirements off them; the restructuring plan (08) maps file/module structure to them. Without 02, all later docs drift.

### Contents
- An ASCII diagram of the runtime pipeline (ingest → validate → … → query → replay).
- A table of additional product process families (register, calculate, episode, operate, migrate, experience).
- One section per family with: purpose, inputs, outputs, contract surface, parity bar, leapfrog points.

### Why it exists
A repo that lists 70 routes without grouping them into ~10 process families is unsupportable. Engineers don't know which file to open; reviewers don't know which subsystem owns a change; frontend teams cannot decide which workflow group a screen belongs to. The process families *are* the modular monolith's domain boundaries.

### Replication prompt

```
You are writing 02-CORE-FEATURES.md for {SIBLING_REPO_NAME}. Read 00 and 01
first. This doc names the process families that organize the rest of the
repo's planning and code.

Goal: name 8–15 internal process families such that every later feature,
every later route, every later file in src/ belongs unambiguously to one
family. This is the spine of the codebase.

Produce 250–400 lines with this structure:

1. **Intro (1–2 paragraphs).** State that this doc names process families
   and that all later docs (05 roadmap, 06 inventory, 08 restructuring,
   10 use cases) hang off these family names. Reference 06 as the eventual
   source of truth for full feature scope.

2. **Runtime pipeline diagram.** An ASCII block diagram showing the data or
   control flow through the repo at runtime. Use 6–10 boxes. Show external
   inputs (which sibling repos call in) and external outputs (which sibling
   repos this repo calls). Example for historian:

       pitant-fieldlink ─▶ ingest ─▶ validate ─▶ map ─▶ compress ─▶ tier ─▶ persist
                                                                              │
                                                            replay ◀── query ◀┘
                                                              ▲
                                                              │
                                                            govern

3. **Process family table.** A table with 8–15 rows. Columns:
   Family | What it owns | Why it matters.
   Every later doc must reference these family names verbatim.

4. **Per-family section.** One ## section per family. Each section MUST
   contain:

   **Purpose (1 paragraph).** What the family is for.

   **Inputs.** List the external triggers: REST endpoints, gRPC services,
   queue subjects, file inputs, scheduled jobs. Be specific. Name the
   sibling repo that produces each input where applicable.

   **Outputs.** List what the family produces: routes consumed by sibling
   repos, queue subjects published, audit records emitted, files written.

   **Contract surface.** Name the public contract elements this family
   owns: route groups, message types, event subjects, error envelopes.
   Reference pitant-contracts wherever a contract is shared cross-repo.

   **Parity bar.** What the family must do to match incumbents at the
   minimum acceptable level. Reference 01 for specific competitor
   capabilities.

   **Where we exceed.** What this family does that no incumbent does, or
   does together. Be specific.

5. **Cross-family invariants (closing section).** 3–8 invariants that
   apply across every family. Examples: tenant/site scope is preserved
   on every call; quality and gap state are never silently dropped;
   no family creates a direct PLC/DCS/SIS write path; no family bypasses
   the contract surface even for internal use.

Family-naming rules:
- Names must be verbs (ingest, validate, compress, query, replay, govern,
  federate, register, calculate, episode, operate, migrate, experience)
  or short action nouns. Never abstract nouns like "infrastructure" or
  "platform" — those are not families.
- Each family must own at least 3 features and at most ~30. Families with
  fewer than 3 collapse into a sibling; families with more than 30 split.
- Families must be parallel in shape (each has a purpose, inputs, outputs,
  contract surface, parity bar, leapfrog points). If one family does not
  fit the shape, it is probably either two families or not a family at all.

Acceptance: an engineer joining the repo cold should be able to read 02
and predict the top-level structure of src/ before opening any source file.
The process families = the directory structure under src/.
```

---

## Doc 03 — SAFETY-AND-SECURITY

### Purpose
Defines graded assurance. Critical for industrial software where one customer is a dental lab and another is a refinery — the same binary must serve both. Establishes the SL-0 through SL-4 ladder and the mode vectors (proof / workflow / sovereignty / autonomy / privacy / liability) that tag every feature in doc 06.

### Contents
- Honest disclaimer about what SIL ratings actually mean (and don't) for this kind of system.
- SL-tier ladder table with 4–5 tiers.
- Mode vector definitions (these get attached to every feature in 06).
- Standards mapping (IEC 62443, IEC 61508/61511, ALCOA+, 21 CFR Part 11, GDPR/HIPAA where applicable).
- Cyber baseline per tier.
- Explicit "what we are not rated for" boundary.

### Why it exists
Without a graded ladder, every customer conversation devolves into "is it safe enough?" with no shared vocabulary. The SL-tier vocabulary lets sales, engineering, and customers agree on what tier a deployment runs at, and what evidence is required at each tier.

### Replication prompt

```
You are writing 03-SAFETY-AND-SECURITY.md for {SIBLING_REPO_NAME}. Read 00,
01, 02 first.

Goal: define a graded assurance ladder for the repo and the mode vectors
that will be attached to every feature in 06. The ladder must serve the
smallest deployment and the most regulated deployment from the same code.

Produce 150–250 lines.

1. **Honest disclaimer (1–2 paragraphs).** State what safety integrity
   ratings actually mean under IEC 61508 / IEC 61511 (they apply to
   safety functions that close a loop and take a process to a safe
   state). State what this repo can and cannot legitimately claim. If the
   repo is observation/evidence (like historian), state that the SIL band
   maps to *data assurance* on the auditable record path, not to a SIF.
   If the repo is closer to control (e.g. a hypothetical control bridge),
   state the actual safety function envelope.

2. **SL-tier ladder.** A table with rows SL-0 through SL-4 (or SL-1 to
   SL-3 if the upper bands genuinely do not apply). Columns:
   Tier | Rough mapping | Use cases | Hardware fault tolerance | Cyber
   baseline. Be specific in every cell. Reference real customer profiles
   (workshop, mid-size plant, pharma GMP, refinery, defense-adjacent,
   gigafactory).

3. **Mode vectors.** Define each of: Proof, Workflow, Sovereignty,
   Autonomy, Privacy, Liability. Each vector has 4–8 named values (e.g.
   Proof: unsigned, signed, threshold-signed, externally notarized,
   regulator-sealed, independently witnessed). State what each value
   means operationally — what receipts, signatures, witnesses, anchoring,
   reviewer roles, retention locks, and verification artifacts it
   implies. These mode vectors will tag every feature in doc 06; if a
   feature is regulator-sealed it must produce different evidence than
   one that is signed.

4. **Standards mapping.** A table or section per applicable standard:
   IEC 62443 (parts 3-3 and 4-2 for component requirements), IEC 61508 /
   61511 if relevant, ALCOA+ for data integrity, 21 CFR Part 11 for
   e-records/e-signatures, GAMP 5 for validation lifecycle, NIST 800-82
   for ICS, GDPR/HIPAA where personal data may touch the system,
   ISO 27001 / SOC 2 if cloud-hosted, NERC CIP for power-industry
   variants. State which standard applies at which tier.

5. **Cyber baseline per tier.** Concrete controls per tier: TLS 1.3
   floor, JWT/OIDC, mTLS, RBAC, ABAC, conduit deny-by-default, data
   diodes at zone boundaries, HSM-backed signing, supply-chain
   attestation (SLSA L3+), unidirectional gateways. Tier-by-tier
   declaration of which are required vs optional.

6. **Boundary statement.** Explicit list of what this repo is NOT rated
   for, no matter what tier. Examples for any non-control repo:
   - Does not constitute a safety instrumented function
   - Does not write to PLC/DCS/SIS control surfaces
   - Does not certify the safety of any plant equipment
   - Does not act as the system of record for any regulator-required
     filing without sibling repo handoff evidence

7. **Per-zone tier declaration rule.** State that a site can declare
   different tiers for different zones (control room, office, edge) and
   that tier is configuration, not a different build.

Tone rules:
- Be specific about what is and is not claimed. False safety claims kill
  a regulated sale faster than missing features.
- Cite standards by their exact identifier and part (e.g. IEC 62443-4-2,
  not "62443").
- The mode vector value names must be reusable verbatim in doc 06.

Acceptance: an industrial cybersecurity reviewer should be able to use
this doc to size their assessment effort. A safety engineer should be
able to use it to know which SIL bands are addressable and which are
out of scope.
```

---

## Doc 04 — PHYSICAL-ARCHITECTURE

### Purpose
Defines the deployment shapes. Same binary, different colocation patterns. Names the logical components and shows how they collapse together at small scale and split apart at large scale.

### Contents
- Logical component table (one component per process family or pair of families).
- Per-tier deployment diagram and sizing (T0 workshop, T1 small plant, T2 mid plant, T3 enterprise, T4 fleet/federation).
- Network/zone topology (which components live in OT zones, which in IT zones, which in the cloud).
- Backup, DR, and replication topology per tier.

### Why it exists
Without this, every deployment becomes bespoke. Sales can't quote a workshop install vs a refinery install. SRE can't predict capacity. Customers can't tell what they're buying. Operations docs become a wiki of one-offs.

### Replication prompt

```
You are writing 04-PHYSICAL-ARCHITECTURE.md for {SIBLING_REPO_NAME}. Read
00–03 first.

Goal: define the deployment shapes. Same binary, different colocation. Show
that the same product runs from the smallest plausible deployment to the
largest, with topology and sizing for each tier.

Produce 200–300 lines.

1. **Same-binary principle (1 paragraph).** State that no tier requires a
   fork, a lite rewrite, or a separate product line. Tier is configuration
   plus colocation, not a different build.

2. **Logical components table.** One row per deployable component (each
   component is one process or one container). Columns:
   Component | Role | Stateful? | Scales by.
   The components must correspond 1:1 (or n:1) to the process families
   in 02. If a component does not map to a family, either the component
   is wrong or 02 is missing a family.

3. **Tiers — one section per tier (4–5 tiers typical).** Each tier
   section follows this template exactly:

   ## Tier T{N} — {Name} ({one-line position})

   **Profile.** Workload size in concrete units (tag count × sample rate
   for historian; events/sec for streams; concurrent users for web;
   asset count for fieldlink). 2–4 sentences. Name a real customer
   archetype (dental lab, mid-size pharma site, refinery, gigafactory
   fleet).

   **Topology.** An ASCII box diagram showing colocation: which
   components share a host, which run on dedicated hosts, which run in
   the cloud, where the OT/IT zone boundary cuts.

   **Sizing.** Concrete numbers: CPU cores, RAM, disk type (NVMe / SSD /
   spinning / object), disk capacity, network bandwidth, expected
   throughput. State assumptions (e.g. "8 hours retention hot, 90 days
   warm, 7 years cold").

   **High availability.** Per-tier HA pattern: none / hot-standby /
   quorum / multi-region. Be explicit about RPO and RTO targets.

   **Backup target.** Per-tier backup strategy: USB drive, NAS, object
   store, WORM target, customer-vault, air-gapped media.

   **Network and zones.** Which components live in the OT zone, which in
   the corporate IT zone, which in the cloud, and which conduits cross
   the boundary. Reference 03 SL-tier conduit requirements.

   **Constraints / what breaks.** State the failure modes that the tier
   is NOT designed to handle. Workshop tier doesn't survive disk loss;
   fleet tier doesn't survive contract drift across sites; etc.

4. **Tier transitions.** A short section on how a customer upgrades from
   one tier to the next without data loss or service outage. State which
   transitions are online and which require a maintenance window.

5. **Components NOT in this repo.** A pointer table: which deployment
   pieces come from sibling repos. Reference 06's Whole-PITANT Composition
   Model.

Sizing guidance — be specific:
- For a data plane repo: events/sec, bytes/sec, queries/sec, retention
  in days/years, archive volume in TB.
- For a UX repo: concurrent users, simultaneous queries, dashboard
  render budget in ms.
- For an edge repo: number of subnets, number of devices, local buffer
  capacity, store-and-forward maximum duration.
- For a governance repo: audit records/sec, signature operations/sec,
  evidence pack size and frequency.

Acceptance: a sales engineer should be able to use this doc to scope a
deployment without calling engineering. An SRE should be able to predict
capacity needs. A customer architect should be able to draw the OT/IT
boundary on their own network diagram using this doc as reference.
```

---

## Doc 05 — ROADMAP

### Purpose
The phased build plan. Maps process families (02) and feature scope (06) onto an ordered sequence of phases, each with a definition-of-done, a release gate, and named owners.

### Contents
- Planning rules.
- Target architecture stack.
- Complete domain model.
- API and contract surface map.
- 06 coverage map (every section of 06 must close in some phase).
- Cross-repo integration gate (the 52-repo system integration).
- Per-phase section (Phase 0 through Phase N, ~20+ phases typical for a deep repo) with: scope, implementation tasks, tests and acceptance, definition of done.
- Build order summary.
- Phase gate checklist.
- Deliberately-not-building list.
- Product manageability rules.
- Final acceptance statement.

### Why it exists
Without a phased roadmap, every PR debates "is this scope appropriate now?" The roadmap answers that question deterministically. It also creates the trail of evidence that turns "we built it" into "we built it according to a plan that was approved before we started."

### Replication prompt

```
You are writing 05-ROADMAP.md for {SIBLING_REPO_NAME}. Read 00–04 first.
06 has not been written yet; you will write 05 first as a planning skeleton
and then 06 will hang the maximal feature surface off it.

Goal: produce a deterministic, phased build plan from Phase 0 through final
acceptance. Every phase must have explicit definition-of-done, tests, and
acceptance evidence. The phase count should be high enough to let each
phase ship in 2–6 weeks (typically 15–30 phases for a deep repo).

Produce 700–1000+ lines with this exact structure:

1. **Planning Rules (intro).** State that this is the authoritative phasing.
   Reference 00–04 as inputs and 06 as the maximal feature inventory that
   each phase must close part of.

2. **Target Architecture Stack.** Table: Layer | Reference choice | Public
   contract impact. Cover: runtime config, metadata store, hot store, cold
   store, audit store, secrets/signing, observability, deployment, test
   environment. Choices may be deferred ("decision in Phase N") but each
   row must exist.

3. **Complete Domain Model.** Bullet list of every domain noun this repo
   owns (tag, asset, source, batch, formula, event frame, evidence pack,
   etc.). Each noun must appear in at least one phase below.

4. **API and Contract Surface Map.** Table: Surface (REST / gRPC / SDK /
   CLI / WAL / event subject) | Stability tier (stable / MVP / fixture /
   contract-only) | Owner phase. Every public surface element must appear.

5. **06 Coverage Map.** Table: 06 section heading | Phases that close it |
   Acceptance evidence. Even before 06 is written, list the section names
   you intend to use (the process families from 02 plus standard
   inventory sections: vision, competitive, premium moat, future surface,
   acquisition, tag/asset, ingest, time, quality, storage, query,
   calculation, event frames, visualization, administration, migration,
   security, safety, audit, multi-tenancy, federation, AI/data science,
   premium, future, product lines).

6. **Cross-repo integration gate.** Table: Sibling repo | What this repo
   needs from it | Stub or production. Phase 0 must close on this table.

7. **Per-phase sections — one ## per phase.** Each phase MUST contain:

   ## Phase {N} — {Name}

   **Status.** {Not started | In progress | Closed} with date.

   **Scope.** 1 paragraph stating what this phase delivers and what it
   explicitly does not.

   **Implementation tasks.** Numbered or bulleted list of specific
   implementation tasks. Each task must be small enough to ship in one
   PR. No task is "build the entire X."

   **Tests and Acceptance.** Specific tests, fixtures, benchmarks, or
   drills that must exist before the phase closes. Reference test file
   names where they exist.

   **Definition of Done.** Bulleted checklist. Every box must be
   independently verifiable. Examples: "cargo test passes," "fixture
   X exists and validates," "route Y is documented in 06," "frontend
   contract pack updated," "evidence pack format ratified."

   **Release gate.** Statement of what this phase blocks or unblocks
   downstream. If closing the phase is required before a particular
   profile or sibling integration is claimable, say so.

8. **Standard phase order for a PITANT-style repo:**
   - Phase 0: Planning, contracts, traceability foundation
   - Phase 1: Single-node MVP of the core process family
   - Phases 2–6: Each major process family from 02 in dependency order
   - Phases 7–10: Cross-family features (calculations, episodes, replay,
     visualization handoff)
   - Phase 11: Migration / coexistence with incumbents
   - Phase 12: Security and audit
   - Phase 13: Safety-supporting features (if applicable)
   - Phase 14: Multi-tenancy / federation
   - Phase 15: Data science / AI surfaces
   - Phase 16: Premium / moat features
   - Phase 17: Future / reserved features (contract-only)
   - Phase 18: Productization (containers, helm, profiles)
   - Phase 19: Gap closure / scope balance / release hardening
   - Phase 20: Code hygiene / modular monolith restructuring
   - Phase 21+: Enterprise readiness (see doc 09)

9. **Build Order Summary.** Compact table mapping every phase to its
   primary process family and its closure phase.

10. **Phase Gate Checklist.** Universal gate that applies to every
    phase: tests pass, fmt/clippy/lint pass, contract truth check,
    SBOM updated, third-party notices regenerated, frontend fixtures
    valid, audit/deny clean.

11. **Deliberately Not Building.** Bulleted list of things this repo
    will NOT build, with the sibling repo that owns each. This is the
    most-referenced section of the roadmap during scope disputes.

12. **Product Manageability Rules.** 5–10 rules that prevent the repo
    from drifting into a kitchen-sink monolith.

13. **Final Acceptance.** One paragraph stating when the repo is
    feature-complete for its premium target.

Tone rules:
- Every phase is deterministic. No "we'll figure it out in Phase N."
- Every phase has measurable Definition of Done.
- Reference 06 by section heading even when 06 is not yet written.
- Phases must be small enough that 1–3 engineers can close one in
  2–6 weeks. If a phase looks like 3 months of work, split it.

Acceptance: an engineer who joins on Phase 7 should be able to read
Phase 7's section and start work without asking what to do. A reviewer
should be able to close Phase 7 only when every Definition-of-Done item
is independently verified.
```

---

## Doc 06 — FEATURE-SPEC-INVENTORY

### Purpose
The maximal feature surface. Every capability the product will ever expose, tagged with mode vectors from 03, grouped by the process families from 02, sized against the competitive landscape from 01, and ordered by the roadmap from 05. This is the **source of truth** for scope. When other docs disagree, 06 wins.

### Contents
- Product intent.
- Feature taxonomy.
- Current implementation overlay.
- Whole-PITANT composition model (which sibling repos compose with this one).
- Cross-repo capability flywheels.
- Beyond-competition future surface (premium moat).
- Premium moat feature families.
- Futuristic first-owner features.
- Then: section per process family, with every named feature, tagged with `[Backend/Compute]`, `[Frontend]`, or `[Both]`, and a mode vector `{Proof=…; Workflow=…; Sovereignty=…; Autonomy=…; Privacy=…; Liability=…}`.

### Why it exists
This is the doc that prevents scope drift. Sales asks "do we do X?" — read 06. A reviewer asks "is this feature in scope or premium-gated?" — read 06. A frontend team asks "what fixtures must I support?" — read 06. Without 06, the product surface lives in PowerPoint and the codebase, and they disagree.

### Replication prompt — this is the long one

```
You are writing 06-FEATURE-SPEC-INVENTORY.md for {SIBLING_REPO_NAME}. This is
the most important and most extensive planning doc in the repo. Read 00–05
first. The doc you produce will be 1500–3000 lines.

THIS IS NOT A SUMMARY. It is the MAXIMAL feature surface. Every plausible
capability the product will ever expose, including premium-tier and future-tier
features that will not ship for years. If you find yourself writing "etc.",
stop and enumerate the items.

Goal: enumerate every named feature. Group them. Tag every one with a
surface marker and a mode vector. Make the doc dense enough that no one ever
asks "do we do X?" without checking 06 first.

Produce a document with this exact structure:

1. **Product Intent (1–2 paragraphs).** What this inventory is for and why
   it is the source of truth. Reference 00 for the thesis. State that
   features here may be claimed at any of these maturity levels:
   contract_only, simulated, pilot, production. Sales and docs must use
   the same word.

2. **Feature Taxonomy.** State the structure of the rest of the document:
   (a) maximal feature surface grouped by process family from 02, (b)
   premium moat families, (c) future / reserved surface, (d) competitive
   coverage map. Define the tagging convention:
   - Surface tag: [Backend/Compute] | [Frontend] | [Both]
   - Mode vector: {Proof=…; Workflow=…; Sovereignty=…; Autonomy=…;
     Privacy=…; Liability=…} using the values defined in 03.

3. **Current Implementation Overlay.** A table mapping the maturity tier
   of every major section: % implemented, % contract_only, % future. This
   gets updated every phase closure. The first version is mostly
   contract_only — that is correct.

4. **Whole-PITANT Composition Model.** State that this repo is one of
   ~52 independent PITANT repos. Then provide:

   a. **Composition Rules** — 6–12 bullet rules about how this repo
      composes with siblings (who owns what; what bypasses are forbidden;
      what evidence flows must be preserved). Each rule gets a surface
      tag and a mode vector. Examples:
      - pitant-contracts defines every shared shape before any
        implementation depends on it. [Backend/Compute] {Proof=signed;
        Workflow=approve; …}
      - UX repos do not bypass contracts; they read through published
        HTTP, SDK, or generated client. [Both] {…}
      - Every cross-repo workflow carries identity, tenant, site, zone,
        asset context, trace context, and audit linkage. [Both] {…}

   b. **Known Module Support Matrix** — a long table (30+ rows). Columns:
      Module | How it supports {SIBLING_REPO_NAME} | How {SIBLING_REPO_NAME}
      supports it. Cover every PITANT repo that exists or is named in the
      composition plan (pitant-contracts, pitant-deploy, pitant-identity,
      pitant-tenancy, pitant-fieldlink, pitant-gateway, pitant-streams,
      pitant-core, pitant-historian, pitant-sentinel, pitant-design-system,
      pitant-charts, pitant-web, pitant-client, pitant-hmi-sdk,
      pitant-mobile, pitant-directus, pitant-copilot, pitant-alarm-mgmt,
      pitant-notifications, pitant-cmms, pitant-eam, pitant-reliability,
      pitant-oee, pitant-spc, pitant-batch, pitant-energy,
      pitant-environmental, pitant-compliance, pitant-audit,
      pitant-catalog, pitant-lake, pitant-training, pitant-model-registry,
      pitant-fleet, pitant-integrations, pitant-sis-observer,
      pitant-control-bridge, pitant-simulation, pitant-autonomy,
      pitant-marketplace).

   c. **Remaining 52-Repo Integration Slots** — for any repo not yet
      named, list candidate slots: name a role, a feature tag, mode
      defaults, the reason the slot exists, and likely collaborators.

   d. **Cross-Repo Capability Flywheels** — 5–10 narrative paragraphs
      naming end-to-end value loops (e.g. reliability flywheel,
      compliance flywheel, AI flywheel, cyber-forensic flywheel,
      migration flywheel). Each flywheel names 3–6 repos in sequence.

5. **Beyond-Competition Future Surface.** This section is what makes the
   doc maximal. Enumerate 8–15 future-surface families, each with 10–25
   named features. Each feature has a surface tag and mode vector.
   Standard families for an industrial repo:
   - Semantic plant memory graph (time-bound knowledge graph)
   - Temporal digital twin backbone (replayable plant state)
   - Process mining and operational discovery (path mining)
   - Cyber-physical forensic features (incident timeline, black-box)
   - AI-native investigation and copilot surface (cited answers)
   - Autonomous advisory readiness (recommendations with audit)
   - Data product and marketplace readiness (governed datasets)
   - Human experience beyond trends (infinite canvas, narrative builder)
   - Ultra-scale and giga-factory features (sharding, federation)
   - Micro-workshop and brownfield features (single-node, offline)
   - Safety and physical assurance beyond parity (SL-4 evidence)
   - Future standards and interoperability (AAS, ISA-95, OPC UA NextGen)

6. **Premium Moat Feature Families.** 6–10 families that are premium-tier
   only. Each with 10–25 features. Mode vectors should skew toward
   threshold-signed, externally-notarized, escrowed-export, evidence-
   grade. Examples for the historian: cryptographic truth fabric,
   context graph and digital thread, operational episode intelligence,
   human investigation and CAPA, query/replay/explainability surface,
   sovereign federation and confidential operations, vertical packs and
   regulated templates, commercial and contractual productization.

7. **Futuristic First-Owner Features.** 5–10 "first-of-kind" features.
   Each with 5–15 features. These will not ship for years; they are
   declared so that competitors cannot land a flag on them. Examples:
   multimodal plant memory, counterfactual plant twin, control-safe
   optimization market, autonomous site memory mesh, industrial AI
   governance plane, forensic black-box mode, human capability twin,
   self-proving interoperability.

8. **PER-PROCESS-FAMILY INVENTORY — this is the bulk of the doc.** For
   each process family from 02 (typically 8–15 families), produce a
   ## section, and within it 2–8 ### subsections. Each subsection is a
   bulleted list of named features. Every feature gets:
   - A clear English name (sentence case, ends in period).
   - A surface tag: [Backend/Compute] | [Frontend] | [Both].
   - A mode vector: {Proof=…; Workflow=…; Sovereignty=…; Autonomy=…;
     Privacy=…; Liability=…}.

   Target feature counts per family (historian baselines):
   - Acquisition / sources: 60–80 features
   - Tag / asset model: 40–80 features
   - Ingest pipeline: 40–60 features
   - Time semantics: 25–40 features
   - Quality, gaps, diagnostics: 30–50 features
   - Storage, archive, retention: 50–80 features
   - Query engine: 80–120 features
   - Calculations / derived signals: 25–40 features
   - Event frames / episodes: 30–50 features
   - Visualization (handoff to frontend repo): 50–80 features
   - Administration and operations: 30–50 features
   - Migration / coexistence / replacement: 30–50 features
   - Security and IEC 62443 features: 40–60 features
   - Physical assurance / safety-supporting: 20–40 features
   - Audit, evidence, compliance: 30–50 features
   - Multi-tenancy and federation: 25–40 features
   - Data science / AI: 30–60 features
   - Premium moat: 60–100 features
   - Future / reserved: 30–60 features

   That is 800–1500+ named features. Yes, really.

9. **First-Class Acceptance Statement.** A short closing section. State
   that the repo is feature-complete at its premium target when a
   customer can use it as their daily {SIBLING_DOMAIN} tool while
   incumbents become optional adapters rather than mandatory systems of
   record. Be specific about the workflows that must work end-to-end
   before that claim is credible.

Tagging discipline:
- Every feature line must end with `[surface] {mode-vector}`. No
  exceptions. The mode vector tags are what later docs (especially 09
  and the frontend handoff fixtures) hang off.
- Mode vector consistency: if a feature is regulator-sealed in Proof,
  it should be regulator-review in Workflow and jurisdiction-bound
  replication in Sovereignty. If it is signed and observe, it is
  routine — that's also fine. Mismatches are a red flag.
- If you find yourself tagging everything {Proof=signed; Workflow=
  observe; Sovereignty=local-only}, you have not actually thought about
  the mode vectors. Stress-test by asking: when this fails, who reviews
  it? Who can see the evidence? Who is liable?

Enumeration discipline:
- Never write "etc." Enumerate.
- Never write "various" or "multiple." Name them.
- If you write "all quality codes," then enumerate all quality codes
  (good, uncertain, bad, stale, substituted, manual, calculated, clipped,
  saturated, out-of-service, communication-failed, …).
- If you write "all retention scopes," enumerate them (per-tag, per-asset,
  per-site, per-tenant, per-data-class, legal-hold, regulatory, …).
- If you write "all event-frame types," enumerate them (run, batch, job,
  order, downtime, alarm, anomaly, maintenance, quality-hold, cleaning,
  changeover, startup, shutdown, energy peak, demand response,
  environmental excursion, permit excursion, safety observer, source
  outage, cyber incident, backfill session, correction session, model
  inference, …).
- If you write "all aggregations," enumerate them (count, sum, mean,
  median, min, max, first, last, delta, rate-of-change, integral,
  time-weighted-average, stddev, variance, percentile, histogram,
  duration-in-state, state-transitions, time-above-threshold,
  time-below-threshold, time-in-band, area-under-curve, energy/flow/
  production totalization, good/reject ratio, OEE inputs, SPC inputs,
  quality-weighted, gap-blocking, confidence-weighted, …).

That is how doc 06 reaches 1500–2000+ lines. The maximal enumeration is
the point.

Coverage check: when you finish a section, count the features. If a
section has fewer than 10 features, ask whether you actually exhausted
the surface. If a section has more than 80, ask whether it should be
split into two subsections.

Acceptance: a reviewer should be able to point at any incumbent feature
and find it (or its explicit absence) in this doc. Sales should be able
to answer "do we do X?" without asking engineering. Frontend teams
should be able to enumerate their required fixtures by filtering on
[Frontend] and [Both] tags.
```

---

## Doc 07 — FRONTEND-DEV-HANDOFF

### Purpose
Translates backend roadmap and feature inventory into screens, workflows, route groups, UI states, and contract-pack expectations that frontend repos (`pitant-web`, `pitant-charts`, `pitant-client`, `pitant-hmi-sdk`, `pitant-mobile`) can build against without reverse-engineering the backend.

### Contents
- Frontend invariants (e.g. quality/gap/provenance must never be silently hidden; tenant scope must be preserved on every call).
- Primary workflow groups (one row per top-level screen).
- Contract pack format (the JSON/Markdown convention used to specify each workflow).
- Fixture requirements (success, degraded, denied, validation-error — minimum four).
- Profile gating expectations (which workflows disappear under which profile).
- AI / advisory UX guardrails.
- Status mapping (contract_only / simulated / pilot / production must surface in UI badges).

### Why it exists
A backend repo can ship great APIs and still produce no shippable product because the frontend team can't tell what state a screen should be in, what fixtures to seed, or which workflows are profile-gated. 07 fixes that with a strict template.

### Replication prompt

```
You are writing 07-FRONTEND-DEV-HANDOFF.md for {SIBLING_REPO_NAME}. Read
00, 02, 05, 06, and 08 first. This doc is consumed by frontend repos
(pitant-web, pitant-charts, pitant-client, pitant-hmi-sdk, pitant-mobile,
or whichever own the visible surface for this domain).

Goal: hand off enough that a frontend team can scaffold all primary
workflows without re-reading the backend.

Produce 80–200 lines (this doc is intentionally short and dense).

1. **Frontend Rules (5–10 bullets).** UI invariants that override every
   design decision. Examples:
   - Always show quality, gap, provenance, and evidence state when a
     value depends on them.
   - Never silently hide bad, uncertain, stale, substituted, manual,
     calculated, corrected, or interpolated data.
   - Never imply direct PLC/DCS/SIS write authority. Historian-derived
     actions are advisory unless an approved control bridge owns the
     boundary.
   - Always preserve tenant/site scope in route calls, saved views,
     exports, evidence packs, and AI prompts.
   - AI and advisory views must show citations, approval state, and
     model version before showing operational conclusions.
   - Regulated, safety, forensic, and dispute workflows must expose
     custody, signatures, reviewers, holds, and verification status.

2. **Primary Workflow Groups.** A table with 8–15 rows. Columns:
   Workflow | Primary users | Route groups | Required UI states.
   Each "Required UI states" cell must list every state the frontend
   must implement: loading, empty, partial-gap, quality-degraded,
   stale, corrected, paginated, signed-result, no-evidence, dry-run,
   explain, high-cost, timed-out, conflict, duplicate, quarantined,
   proof-ready, etc. Be specific. The state list is the test matrix.

3. **Contract Pack Format.** Specify the shape of a per-workflow
   contract pack that lives in /docs/frontend-contracts/{workflow}.md.
   Required contents:
   - Workflow name and primary actors
   - Route list with method, path, and link to 06 section
   - Request shape (JSON example)
   - Success response shape (JSON example)
   - At minimum 4 fixtures: success, degraded, denied, validation-error
   - State machine for the workflow (which states transition to which)
   - Profile gating: which profiles enable / hide this workflow
   - Mode vector summary: what proof, workflow, sovereignty, autonomy,
     privacy, liability levels apply

4. **Fixture Requirements.** State that every workflow ships with at
   least 4 fixtures. List them explicitly:
   - Success: realistic happy path with real-looking data
   - Degraded: at least one quality, gap, or provenance state visible
   - Denied: 403 with profile-gate or tenant-scope reason
   - Validation: 4xx with structured error envelope

5. **Profile Gating Map.** A table or short section showing which
   profiles (workshop, plant, regulated, safety_supporting, migration,
   enterprise, ai_ready, premium, future) enable which workflows.

6. **Status Mapping in UI.** Specify how the four maturity tiers
   (contract_only, simulated, pilot, production) must surface to the
   user — typically as a badge, gated feature flag, or splash dialog.
   No premium-tier feature ships without a visible "preview" label
   until it is production.

7. **AI/Advisory Guardrails.** If the repo exposes any AI/advisory
   surface, this section is required. Must enforce:
   - Citations before conclusions
   - Approval gates for any generated content
   - Model/version visibility on every answer
   - Unsupported answers are rejected, not invented
   - Prompt and answer audit trail accessible to admins

8. **Pointer to Contract Packs.** A table linking each workflow to its
   /docs/frontend-contracts/{workflow}.md file. These files are the
   actual hand-off artifacts; this doc is the index plus invariants.

Tone rules:
- Frontend invariants must be enforceable in code review — not
  aspirational. "Never silently hide bad data" is enforceable; "show
  helpful UI" is not.
- Workflow names must match 02 process families.
- Route groups must match 06 section names.

Acceptance: a frontend engineer joining cold must be able to read 07
plus one contract pack and start building a screen without opening any
Rust file.
```

---

## Doc 08 — PHASE-N-RESTRUCTURING-PLAN

### Purpose
Phase 20 in the historian was a "modular monolith restructuring" — turning a wide flat backend into explicit domain modules with stable file ownership, route metadata, and frontend-ready contract surfaces. Every deep repo eventually needs this phase. The doc is the plan that proves the restructuring did not change behavior.

### Contents
- Why this phase exists (specific symptoms in the current codebase).
- Non-negotiable invariants the restructuring must preserve.
- Target file/module structure (a tree).
- Route metadata schema (every public route gets metadata: family, stability, profile gate, owner module).
- Per-module migration order with per-step PR scope.
- Test gates that prove behavior unchanged.
- Phase exit criteria.

### Why it exists
Restructuring without a plan produces churn, regressions, and reviewer fatigue. A documented plan with explicit invariants converts a scary "rewrite" into a tractable sequence of behavior-neutral PRs.

### Replication prompt

```
You are writing 08-PHASE-N-RESTRUCTURING-PLAN.md for {SIBLING_REPO_NAME}.
Read 00, 02, 05, 06 first. This doc is only needed when the repo has
grown to the point where flat src/ has become a liability — typically
after the equivalent of Phases 1–18 in the roadmap.

Goal: turn a wide flat backend into an explicit modular monolith with
stable file ownership, without changing public behavior.

Produce 400–700 lines.

1. **Why This Phase Exists.** 1–2 paragraphs describing specific
   symptoms in the current codebase. Examples:
   - api.rs has become routing + auth + validation + handlers + workflow
     all in one
   - model.rs is the single place where unrelated domains compete for
     type ownership
   - store.rs is repository + service + projection + archive + evidence
     + fixture machine
   - Premium, future, and daily surfaces look identical in code despite
     different maturity
   - Frontend teams cannot tell which endpoint is stable, profile-gated,
     fixture-only, or contract placeholder

2. **Non-Negotiable Invariants.** Bulleted list. Each invariant must be
   testable by a single CI check. Examples:
   - Public HTTP route paths, methods, JSON field names, enum names, and
     error envelopes stay stable unless a contract migration is approved
   - pitant_historian::app(...), Store, and gRPC service entrypoints
     remain usable by tests and downstream repos during migration
   - WAL durability, append-only raw history, and audit lineage cannot
     be weakened by file movement
   - Tenant/site scope checks remain visible and testable on every route
   - Feature profile gates deny predictably; never silently hide missing
     implementation

3. **Target Architecture.** A tree showing the post-restructuring file
   layout. Group by process family from 02. Standard shape:

   src/
     api/                  (one file per process family + router + auth)
       mod.rs
       router.rs
       auth.rs
       errors.rs
       {family}.rs         × N
     model/                (one file per process family)
       common.rs
       errors.rs
       {family}.rs         × N
     store/                (one directory per process family)
       backend.rs
       {family}/           × N
     domain/               (cross-family domain types: profiles, route
                            metadata, route status, semantics)

4. **Route Metadata Schema.** Define the metadata structure that lives
   alongside every public route. Required fields:
   - family: which process family from 02 owns this route
   - stability: stable | mvp | fixture-only | contract-only
   - profile gate: which profiles enable / hide it
   - method, path, request type, response type
   - mode vector tag (from 03)
   - owning module path in src/

5. **Per-Module Migration Plan.** Each module gets a ## section. Each
   section is a small, behavior-neutral PR's worth of scope:

   ## {family} module split
   **What moves.** Specific types, routes, store methods.
   **From.** Old file locations.
   **To.** New file locations.
   **Re-exports required for backward compatibility.** List them.
   **Serialization compatibility tests.** Named tests that must pass
   before merge.
   **Reload coverage.** If the family has persistent state, the reload
   path must be tested before and after.

6. **Migration Order.** A numbered list of which modules move in which
   order. Ordering rules:
   - Foundation splits first (common types, error envelopes, route
     metadata schema)
   - Daily-core families before premium/future families (so the highest-
     traffic surfaces are stabilized first)
   - Persistence layers split last (riskiest)

7. **Test Gates.** Per-PR CI gates that prove behavior is unchanged:
   - cargo test --all-targets --all-features passes before and after
   - Serialization compatibility tests cover every moved type
   - Frontend fixtures validate against new route metadata
   - Contract truth check passes
   - git diff --check passes
   - clippy/-D warnings passes

8. **Phase Exit Criteria.** Definition of done for the whole phase:
   - Every process family from 02 has a corresponding directory under
     src/{api,model,store}
   - Every public route has route metadata
   - Frontend fixtures reference route metadata, not raw paths
   - No file in src/ exceeds 800 lines (split rule)
   - Phase 21 entry gate (CI baseline, supply-chain policy) can begin

Tone rules:
- This is a behavior-neutral restructuring. Every PR must be reviewable
  as a no-op at runtime.
- If a PR cannot be reviewed as behavior-neutral, split it.
- Reference 02's process families verbatim — the file structure is the
  family list.

Acceptance: after Phase N, an engineer can predict which file owns any
given route by reading 02. The next phase (typically Phase 21+) can
begin without first re-mapping the codebase.
```

---

## Doc 09 — PHASE-N+1-ENTERPRISE-READINESS-PLAN

### Purpose
Production hardening — turns a working modular monolith into something that can be installed in a regulated plant under operator review. This doc is the deepest of the planning docs because the bar for "production" in industrial software is exceptionally high.

### Contents
- Planning assumptions.
- 10/10 scoring rules.
- Universal phase gate (applies to every sub-phase).
- Target production stack.
- Cross-repo ownership guardrails.
- Repo readiness and product manageability gate.
- Per-phase sections (typically 15+ sub-phases): runtime config, storage contracts, ingest log, hot query, cold archive, backup/DR, time semantics, security/tenancy, compliance/audit, observability, adapters, federation, AI, packaging, clustered acceptance.
- Sub-folder artifacts: enterprise scorecard, baseline report, supply-chain policy, release checklist, contract integrity, repo boundary readiness.

### Why it exists
"Production-ready" is a slippery claim. This doc replaces the slippage with a scorecard: 10 categories, each scored 1–10, each scored against named evidence. No category reaches 10 without clustered deployment evidence. No claim above 8 without a CI run URL on file.

### Replication prompt

```
You are writing 09-PHASE-N+1-ENTERPRISE-READINESS-PLAN.md for
{SIBLING_REPO_NAME}. Read 03, 05, 06, and 08 first.

Goal: produce an evidence-backed plan to take the repo from
"modular monolith with strong contracts" to "installable in a regulated
plant under SRE review." This is the deepest planning doc.

Produce 1500–2500 lines.

1. **Planning Assumptions.** Table: Area | Assumption. Cover starting
   point (which prior phases must close), target deployment (single-node,
   HA, clustered, federated), product profiles, contract policy, production
   storage choices, security posture, safety boundary, evidence standard.

2. **10/10 Scoring Rules.** Define the score bands:
   - 1–3: Concept, fixture, placeholder, incomplete
   - 4–5: MVP contract with useful behavior but no production controls
   - 6–7: Strong behavior, missing clustered operations or hardening
   - 8: Pilot-ready with bounded risks and runbooks
   - 9: Production-ready for named profiles with tested failure modes
   - 10: Enterprise-ready with repeatable install, upgrade, restore,
        audit, scale, security, and acceptance evidence

   No category reaches 10 without clustered acceptance evidence from a
   real deployment. State this explicitly.

3. **Universal Phase Gate.** Three subsections:
   - Baseline: cargo test, fmt --check, clippy -D warnings, git diff
     --check, contract truth check, protobuf check, fixture validation,
     cargo audit, cargo deny
   - Contract and Compatibility: public route paths/JSON/enum/error
     envelopes unchanged or migrated; route metadata updated; model and
     store conformance tested; profile-disabled behavior tested;
     frontend fixtures updated for success/degraded/denied/validation
   - Enterprise Evidence: threat model delta; runbook delta; named
     acceptance evidence; claims-vs-evidence ledger updated; cross-repo
     readiness stated; product/profile status explicit

4. **Target Production Stack.** Table: Layer | Reference choice |
   Public contract impact. Cover runtime config, metadata store,
   replicated event log, hot query store, cold archive, audit store,
   secrets/signing (KMS/HSM), observability (OTel + Prometheus + logs),
   deployment (container + helm + chart), test environment (local
   clustered compose/k3d).

5. **Cross-Repo Ownership Guardrails.** Table: Capability | Source of
   truth | This repo's responsibility. Prevents the repo from rebuilding
   platform work that belongs to a sibling.

6. **Repo Readiness and Product Manageability Gate.** Define the rules
   that prevent feature creep:
   - No public route claim above pilot without acceptance evidence
   - No "production" badge on a profile without named drills
   - No premium claim without contract + tests + fixtures + runbooks
   - No future-surface claim with runtime behavior

7. **Per-phase sections — one ## per phase, typically 15+ phases:**

   - Phase {N+1}: Enterprise baseline, CI, supply-chain discipline
   - Phase {N+2}: Production runtime config, fail-closed startup
   - Phase {N+3}: Storage backend contracts and conformance harness
   - Phase {N+4}: Internal replicated event log + idempotent admission
   - Phase {N+5}: Hot query store, indexes, planner, query budgets
   - Phase {N+6}: Cold archive, manifests, retention, legal hold
   - Phase {N+7}: Backup, restore, rebuild, DR
   - Phase {N+8}: Formal semantics (time, quality, gap, correction, replay)
   - Phase {N+9}: Security enforcement, tenant isolation, policy runtime
   - Phase {N+10}: Compliance evidence, audit chain, external verifier
   - Phase {N+11}: Observability, SLOs, admin operations, runbooks
   - Phase {N+12}: Adapter productization (OPC UA, incumbent imports)
   - Phase {N+13}: Federation, sovereignty, multi-site runtime
   - Phase {N+14}: AI governance, dataset reproducibility, leakage checks
   - Phase {N+15}: Productization (container, helm, preflight, upgrade,
                   rollback, compatibility matrix, support bundle)
   - Phase {N+16}: Clustered acceptance, scale benchmarks, final 10/10

   Each phase section MUST contain:
   - **Scope** (1 paragraph)
   - **Implementation Tasks** (20–50 bullets, each PR-sized)
   - **Tests and Acceptance** (specific tests, drills, benchmarks, named
     fixtures)
   - **Release Gates** (what this phase blocks until closed)
   - **Definition of Done** (independently verifiable checklist)

8. **Required sub-folder artifacts.** Each of these lives in
   /docs/architecture/phase-{N+1}/:
   - enterprise-scorecard.md — category-level 10/10 criteria, required
     evidence, closing phases
   - baseline-report.md — CI status, local gate, dirty worktree
     declaration, known baseline gaps
   - supply-chain-policy.md — cargo audit exceptions, cargo deny policy,
     vendored dependency rules, SBOM generation
   - release-checklist.md — repeatable steps from clean checkout to
     tagged release
   - contract-integrity.md — claim-vs-evidence ledger: what is
     implemented, what is MVP contract, what is target architecture
   - repo-boundary-readiness.md — readiness band definitions
     (contract_only, simulated, pilot, production) and policy

Tone rules:
- No category reaches 10 without clustered acceptance evidence. State
  this explicitly so no one claims 10 from local testing alone.
- Reference 03 for security/safety bands. Reference 06 for feature
  scope. Reference 08 for module structure.
- Evidence > claims. If a claim has no test/fixture/drill, demote it.

Acceptance: a compliance auditor or SRE team lead should be able to
read 09 plus the scorecard and answer: "what evidence exists for the
claim that {feature X} is production-ready?" If the answer is "none,"
the claim is demoted to pilot or contract-only in 06.
```

---

## Doc 10 — USE-CASES

### Purpose
Translates the feature inventory (06) and roadmap (05) into product-shaped slices that align with profiles, sibling repo handoffs, and acceptance evidence. Distinguishes the *daily core* product from optional *packs* and *pilot compositions*.

### Contents
- Reading rules (use cases are product slices, not repo ownership transfers).
- Product bands (core / add-on / pilot / future-reserved).
- Use case template (actor, product band, profiles, what this repo owns, other repo owners, readiness dependency, acceptance evidence, explicitly not owned).
- One section per core use case + one section per add-on pack.

### Why it exists
Without use cases, sales and engineering disagree on what the product *is*. With use cases, every customer conversation maps to a specific use case with a specific readiness label and named handoff evidence. A use case at `pilot` readiness cannot be sold as `production`; a `future` use case cannot be demoed as `simulated`.

### Replication prompt

```
You are writing 10-USE-CASES.md for {SIBLING_REPO_NAME}. Read 00, 02, 06,
09 first.

Goal: turn the feature inventory into product-shaped use cases that align
with profiles and sibling-repo handoff. Distinguish the default daily
product from add-on packs.

Produce 200–400 lines.

1. **Reading Rules (intro).** State that:
   - Use cases are product slices, not repo ownership transfers
   - Every use case has a readiness label: contract_only | simulated |
     pilot | production
   - UI, docs, fixtures, sales must use the same readiness word
   - If a sibling repo is not built, this repo may validate contracts
     or simulator evidence but must not claim sibling runtime exists
   - The default product is the core daily {SIBLING_DOMAIN}. Add-ons,
     pilot compositions, and future-reserved are explicit additions.

2. **Product Bands.** Table:
   - Core daily {SIBLING_DOMAIN}: stable, contract-stable dependencies
   - Add-on pack: optional, named profile, named upstream owner
   - Pilot composition: customer-specific bounded trial, simulator labels
   - Future / reserved: roadmap signal, disabled by default

3. **Use Case Template.** State the fields every use case must declare:
   - Actor (primary user or service)
   - Product band (core / add-on / pilot / future)
   - Profiles enabled (workshop, plant, regulated, etc.)
   - What this repo owns (behavior implemented here)
   - Other repo owners (adjacent repos and their roles)
   - Readiness dependency (minimum sibling readiness needed)
   - Acceptance evidence (tests, fixtures, reports, drills, runbooks)
   - Explicitly not owned (work that belongs elsewhere)

4. **Core Daily Use Cases.** One ## section per core use case. Typical
   count: 5–15 for an industrial repo. Each one filled out using the
   template above. For each use case, name the smallest acceptance
   evidence that promotes it from pilot to production.

5. **Add-on Packs.** One ## section per pack. Packs are explicit
   compositions of features that exist in 06 but are not in the daily
   default. Common packs:
   - Regulated evidence pack (21 CFR Part 11, GxP, ALCOA+)
   - Safety-supporting pack (SL-3+ assurance lanes)
   - Migration pack (incumbent imports, parallel run, cutover)
   - Federation pack (multi-site, sovereignty)
   - AI/data-science pack (governed datasets, citations, approval gates)
   - Premium moat pack (truth fabric, digital thread, twins)
   - Future-reserved pack (multimodal memory, counterfactual twin)

6. **Composition Examples.** 2–4 named example deployments showing how
   profiles combine for real customers:
   - "Mid-size pharma site": core + regulated + AI(ai_ready)
   - "Refinery": core + safety-supporting + federation
   - "Greenfield gigafactory": core + premium + federation + AI

Tone rules:
- Use cases are product, not engineering. Lead with the actor and the
  outcome.
- Every readiness label must be defensible. If no acceptance evidence
  exists, the label is contract_only.
- Sibling repo handoff is part of the contract. If sibling doesn't
  exist, the use case lives at simulator readiness, not production.

Acceptance: a buyer or sales engineer should be able to scope a customer
proposal from this doc by picking a profile combo. Engineering should be
able to answer "what acceptance evidence do we need to promote this
use case from pilot to production?" by reading the use case definition.
```

---

## Phase-folder artifacts

In addition to docs 00–10, the historian repo carries per-phase folders that hold the *evidence* for each phase's progress. These are not planning docs; they are the trail that proves planning was executed. Every phase that needs evidence beyond what fits in the main roadmap gets a folder.

### Standard files per phase folder

| File | Purpose | Replication notes |
|---|---|---|
| `README.md` | Index of phase artifacts | Mirror the structure of `phase-21/README.md` |
| `baseline-report.md` | Captured state at phase start: CI status, test count, lint status, known gaps | Update once per phase entry |
| `gap-ledger.md` | What is in / not in / disputed for the phase | Reviewed at every phase gate |
| `release-checklist.md` | Repeatable steps to ship at this phase's completion | Drives the actual release |
| `enterprise-scorecard.md` (Phase 21+) | Category-level 1–10 grades | Updated at each phase close |
| `contract-integrity.md` (Phase 21+) | Claim-vs-evidence ledger | Updated at each public-surface change |
| `supply-chain-policy.md` (Phase 21+) | cargo audit exceptions, deny policy, SBOM | Reviewed quarterly |
| `repo-boundary-readiness.md` (Phase 21+) | Readiness band definitions | Defined once, referenced often |

### Per-module split docs (Phase 20-style)

When doing a modular-monolith restructuring (the historian's Phase 20 pattern), every module split gets its own evidence doc: `phase-20/{family}-route-metadata.md`, `phase-20/{family}-model-split.md`, `phase-20/store-{family}-split.md`. These prove each PR was behavior-neutral. Sibling repos doing the same restructuring should adopt the same naming.

### Frontend contract packs

Live in `/docs/frontend-contracts/{workflow}.md`. Each pack is one frontend workflow. See the existing packs (`historian-trend.md`, `tag-asset-explorer.md`, `query-workbench.md`, etc.) for the format. Doc 07 is the index; the packs themselves are the artifacts.

---

## How to bootstrap a sibling repo using this methodology

1. **Pick the role.** Identify the slot in the [Whole-PITANT Composition Model](06-FEATURE-SPEC-INVENTORY.md#whole-pitant-composition-model). Confirm with whoever owns `pitant-contracts` that the slot is real and named.

2. **Create the folder structure.** In the new repo:
   ```
   docs/
     architecture/
       README.md                            # Index of 00–10 plus phase folders
       00-VISION.md
       01-COMPETITIVE-ANALYSIS.md
       02-CORE-FEATURES.md
       03-SAFETY-AND-SECURITY.md
       04-PHYSICAL-ARCHITECTURE.md
       05-ROADMAP.md
       06-FEATURE-SPEC-INVENTORY.md
       07-FRONTEND-DEV-HANDOFF.md           # only if repo has UX surfaces
       08-PHASE-N-RESTRUCTURING-PLAN.md     # written later, post-Phase 18
       09-PHASE-N+1-ENTERPRISE-READINESS-PLAN.md  # written later
       10-USE-CASES.md
       phase-0/
       phase-1/
       ...
     frontend-contracts/                    # only if repo has UX surfaces
       README.md
   ```

3. **Write docs in this exact order:**
   - Day 1–2: 00 (vision) → 01 (competitive)
   - Day 3–5: 02 (core features) → 03 (safety/security) → 04 (physical)
   - Week 2: 05 (roadmap skeleton)
   - Week 2–4: 06 (feature inventory — the big one, use the long prompt)
   - Week 4: 07 (frontend handoff, if applicable) and 10 (use cases)
   - 08 and 09 are written *later*, after the equivalent of Phase 18 closes

4. **Use the replication prompts.** Each prompt above is self-contained. Feed it to your AI assistant in the target repo, alongside the previously-written docs as context inputs. Do not summarize the previously-written docs — give them in full. The prompts assume full prior context.

5. **Maintain the cross-references.** Every later doc must reference 06 as the source of truth for scope. Every roadmap phase must cite the 06 sections it closes. Every restructuring split must cite the 02 family it belongs to.

6. **Mirror the non-negotiables.** Copy the historian's non-negotiables (no SIS/PLC writes, no vendor leakage, storage-agnostic contract, lossless by default, replay as a verb, bounded memory, fail-safe defaults) into the new repo's architecture README. Adjust where they don't apply; never silently drop them.

7. **Set up the CI baseline early.** The historian's `scripts/ci/` pattern (check-rust, check-contract-truth, check-protobuf, check-supply-chain, validate-fixtures, validate-contract-examples, collect-ci-evidence, generate-sbom, generate-third-party-notices, local-gate, backup-restore-drill) is portable. Copy it into the new repo on Day 1 of Phase 21 work — don't wait until you have features.

---

## A note on the size of doc 06

Doc 06 in the historian repo is ~2000 lines because the historian deliberately enumerated:
- 60–80 acquisition features
- 50+ tag/asset features
- 50+ ingest features
- 25+ time semantic features
- 30+ quality and gap features
- 80+ storage and archive features
- 120+ query and aggregation features
- 30+ calculation features
- 30+ event frame features
- 50+ visualization features (handed off to frontend repos)
- 30+ admin/ops features
- 30+ migration features
- 60+ security features
- 30+ safety features
- 50+ audit features
- 40+ federation features
- 60+ AI/data-science features
- 100+ premium moat features
- 60+ future-reserved features

That is 800+ named features, plus mode-vector tags. The doc reaches 2000 lines because the enumeration is exhaustive — every quality code is listed, every event frame type is named, every aggregation is enumerated, every retention scope is declared. The maximal enumeration is what makes the doc useful as a source of truth.

The replication prompt for 06 above is the prompt that produces this kind of doc. Terse prompts produce 300-line summaries. The long prompt above is the actual cost of getting 2000 lines of enumerated, tagged, source-of-truth scope.

---

## Source of truth recap

- **Vision (00)** owns thesis and principles.
- **Competitive (01)** owns the displacement map.
- **Core Features (02)** owns the process families = the module structure.
- **Safety/Security (03)** owns the assurance ladder and mode vectors.
- **Physical Architecture (04)** owns the deployment shapes.
- **Roadmap (05)** owns the phase order and gates.
- **Feature Spec Inventory (06)** owns scope — when docs disagree, 06 wins.
- **Frontend Handoff (07)** owns the screens-to-routes map and UI invariants.
- **Restructuring Plan (08)** owns the modular monolith plan.
- **Enterprise Readiness Plan (09)** owns production hardening and the 10/10 scorecard.
- **Use Cases (10)** owns product-shape and sibling-handoff readiness.

If you add an eleventh doc, ask whether it really is a new top-level concern or whether it belongs as a subsection in one of these. Top-level docs are expensive; sections are cheap.
