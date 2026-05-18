# 03 - Safety and Security

## Honest Disclaimer

IEC 61508 and IEC 61511 safety integrity ratings apply to safety functions that
detect a hazardous condition and take a process to a safe state. `pitant-charts`
does not close a loop, issue control writes, trip equipment, or certify plant
equipment. It cannot claim to be a safety instrumented function.

The relevant assurance claim is display and evidence integrity: when a chart is
used in regulated, safety-supporting, forensic, or dispute workflows, the visual
surface must preserve source quality, gap state, provenance, identity context,
view replayability, and export warnings. This repository supports safety
decisions by refusing misleading displays; it does not make the decision.

## Display Assurance Ladder

| Tier | Rough mapping | Use cases | Hardware fault tolerance | Cyber baseline |
|---|---|---|---|---|
| SL-0 | Development and demo | Local examples, simulated data, storybook | None | Local-only, no regulated claims |
| SL-1 | Routine operational display | Workshop and plant trends, non-regulated dashboards | Browser fallback path, reloadable view state | HTTPS, package integrity, no control writes |
| SL-2 | Engineering investigation | Plant troubleshooting, anomaly review, maintenance analysis | Renderer fallback, bounded worker messages, degraded display states | OIDC context preserved, tenant/site tags, CSP guidance |
| SL-3 | Regulated or safety-supporting review | Pharma GMP trend review, refinery incident review, quality release support | Reproducible export spec, deterministic view replay, signed data source support | mTLS-capable upstream, audit linkage, profile gates, fail-visible errors |
| SL-4 | Evidence-grade display path | Dispute evidence, regulator package, forensic black-box review | Independently reproducible rendering inputs, sealed export manifest | HSM-backed source signatures upstream, externally notarized evidence handoff |

## Mode Vectors

These values are reused in `06-FEATURE-SPEC-INVENTORY.md`.

### Proof

- `unsigned`: local/demo data without proof.
- `checksum`: content hash or deterministic render checksum exists.
- `signed`: upstream data or export manifest is signed.
- `threshold-signed`: multiple approvers or services sign the artifact.
- `externally-notarized`: evidence is anchored outside the local deployment.
- `regulator-sealed`: artifact is locked for regulator or legal review.

### Workflow

- `observe`: visible state only.
- `inspect`: user investigates and changes local view state.
- `approve`: human approval required before result is accepted.
- `controlled-change`: change proceeds through controlled workflow.
- `regulator-review`: artifact supports external review.

### Sovereignty

- `local-only`: no cross-site movement.
- `site-local`: site scope preserved.
- `tenant-bound`: tenant scope preserved.
- `jurisdiction-bound`: residency or export-control rule applies.
- `federated-summary`: only aggregated/summarized result moves.

### Autonomy

- `manual`: user drives all actions.
- `assisted`: chart suggests navigation or highlights.
- `recommended`: system recommends investigation steps.
- `supervised`: automated workflow requires human approval.
- `autonomous-disabled`: autonomous action is explicitly forbidden.

### Privacy

- `telemetry-only`: no operator or personal data.
- `pseudonymized`: personal identifiers masked.
- `operator-linked`: operator identity may appear.
- `confidential`: commercially sensitive plant data.
- `regulated-sensitive`: regulated or legal review data.

### Liability

- `informational`: no operational decision should depend solely on it.
- `operational`: supports routine operations.
- `engineering-review`: supports engineering judgment.
- `quality-impacting`: may support quality release or rejection.
- `safety-supporting`: may support safety review but is not a SIF.
- `regulated-record`: supports regulated evidence workflows.

## Standards Mapping

| Standard | Applies to this repo | Tier |
|---|---|---|
| IEC 62443-4-2 | Component hardening expectations: no control writes, least privilege, secure defaults, integrity checks | SL-2+ |
| IEC 62443-3-3 | Zone/conduit assumptions for chart data crossing OT/IT boundaries | SL-2+ |
| IEC 61508 / IEC 61511 | Boundary statement only; charts are not SIFs | All |
| ALCOA+ | Attributable, legible, contemporaneous, original, accurate evidence display and export labels | SL-3+ |
| 21 CFR Part 11 | E-record/e-signature display support when upstream evidence is signed | SL-3+ |
| EU GMP Annex 11 / GAMP 5 | Validation lifecycle, change control, and fixture evidence for regulated deployments | SL-3+ |
| NIST SP 800-82 | ICS cybersecurity guidance for deployment and data-zone display surfaces | SL-2+ |
| ISO 27001 / SOC 2 | Cloud-hosted docs, package release, and supply-chain controls | SL-2+ |

## Cyber Baseline Per Tier

| Control | SL-0 | SL-1 | SL-2 | SL-3 | SL-4 |
|---|---|---|---|---|---|
| TLS | Optional local | Required in deployed apps | Required | TLS 1.3 floor | TLS 1.3 floor |
| Identity context | Demo | Optional | Required when supplied | Required | Required |
| Tenant/site scope | Fixture | Preserved | Required | Required | Required |
| Package integrity | Lockfile | Lockfile | SBOM + audit | SBOM + provenance | SBOM + provenance + notarized release |
| CSP guidance | Optional | Documented | Required guidance | Required tested profile | Required tested profile |
| Data proof | None | Checksum optional | Checksums | Signed upstream/export | External notarization |
| Fail behavior | Throw | Visible error | Visible degraded state | Fail-visible with audit link | Fail-visible with sealed evidence link |

## Boundary Statement

- This repo does not constitute a safety instrumented function.
- This repo does not write to PLC, DCS, SIS, MES, or actuator surfaces.
- This repo does not certify safety of plant equipment.
- This repo does not become the system of record for regulator-required data.
- This repo does not hide upstream data uncertainty to make workflows simpler.
- This repo does not make autonomous operational recommendations without a
  sibling advisory repo and explicit user review.

## Per-Zone Tier Declaration Rule

A deployment can declare different assurance tiers per zone or workflow:
workshop demo charts at SL-1, engineering analysis at SL-2, GMP review charts at
SL-3, and forensic export replay at SL-4. Tier is configuration plus evidence
requirements, not a different build.
