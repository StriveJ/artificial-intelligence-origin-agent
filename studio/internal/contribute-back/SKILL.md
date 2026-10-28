---
name: contribute-back
description: Maintainer review of instance patches or abstracted assets in Origin dev, with shared acceptance before a release decision
scope: maintain
version: 1.0.0
---

## Trigger phrases
- review contribution / review upstream contribution (supply the local Origin path; contributor preparation is in CONTRIBUTING.md)

## Action sequence
1. Confirm an Origin dev maintainer-review context. Users may export patches and propose PRs from their own fork without gaining upstream merge/release permission.
2. Locate assets/patches and Origin using existing context where available.
3. Remove personal names/profiles/project identities/business details; generalize without losing source-permission information.
4. Supply required skill name/description/scope/version and Trigger phrases/Action sequence/Dependencies/Verification sections.
5. Framework code uses instance export-edits --prepare, actual validation evidence, and --out for mapped product patches; review/apply with git am in an Origin fork/dev. Skills/templates/mentors use studio/scripts/aipa-contribute.mjs to prepare a review bundle, then aipa-review-contribution.mjs.
6. Fix reported reasons and rerun. special_approval=true (framework/hard boundaries) requires maintainer review under the system constraints before accepting the contribution.
7. Run the full shared gate and complete local roundtrip/private-sentinel checks before assembly/publication. Record missing reviewers/unverified remote protections honestly. Local roster text is not approval; an unpublished change has not reached instances.

## Dependencies
- core-space/scripts/aipa-export-edits.mjs
- studio/scripts/aipa-contribute.mjs and aipa-review-contribution.mjs
- studio/scripts/aipa-check.mjs, aipa-origin-abstract-check.mjs, aipa-assemble-origin.mjs, aipa-publish-origin.mjs

## Verification
- Approved general skills land in product/core-space/common/skills/<id>; patches retain complete product paths.
- Personal identifiers are rejected for correction.
- Framework/hard-boundary artifacts report special_approval=true without automatic publishing.
