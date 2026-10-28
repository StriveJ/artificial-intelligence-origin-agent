# Release Evidence Verification

Run complete current gates before collecting release evidence:

    node lab/run-repair-checks.mjs --suite origin
    node lab/run-repair-checks.mjs --suite hub --hub-source <public-hub-source> --harness-root <verified-synthetic-executor>
    node lab/release/readiness.mjs --origin-result <result.json> --hub-result <result.json> --hub-source <public-hub-source>

The verifier accepts only marked lab/.upgrade-runs/ reports, complete source inventories, unchanged current public bytes, and successful named tests. Targeted tests, missing/skipped required cases, changed source, or forged digests cannot substitute for a complete gate. Hub executor evidence includes the pinned package/lock, entry point, complete installation identity, and actual non-skipped execution; merely naming a directory is insufficient.

Optional evidence is supplied in complete pairs:

- --answer-result and --answer-inputs: 300 completed raw synthetic answers, a valid frozen program, complete isolation, 100 shared projections, current prompt equivalence, and strict rescoring. --allow-input-equivalent-sources additionally requires verified original execution copies and exactly matching current prompts; it does not claim new model execution. No model score is bundled with this repository.
- --language-result and --language-inputs: all 28 frozen representative-language completions, exact prompts, private probes blocked with zero calls, unchanged machine fields/quotations/identifiers, strict rescoring, and complete transport journals.
- --capacity-core-result and --capacity-hub-result: same-source measurements at 100/1,000/10,000 entries, named batching/archive/source-change regressions, recovery and sync/async/incremental/full content equivalence. Reports cover only their specified platform and local synthetic workload.

Retrieval adoption is a separate decision. Supply --retrieval-result for frozen mechanical comparison, or explicitly --retain-current-retrieval alongside valid answer evidence. Neither option adopts BM25 automatically. Conflict-recovery, generated support-contract/diagnostic, and global-timezone checks require all named complete-gate scenarios; browser/device evidence is recorded separately.

The exit code is 1 for invalid evidence or a failed gate, and 2 when mechanical verification completes but final publication requires human review. The tool always reports releaseReady=false. A final checklist must separately verify version tags, final Core identity and ZIP checksum, signed Hub package and trusted public-key fingerprint, supported platform/device combinations, upgrade/failure-recovery/rollback, and maintainer decisions. Technical readiness, remote publication, and production deployment are distinct states. No real instance is read or modified.

## Canonical delivery preparation

prepare-baseline.mjs builds from actual committed dev/master sources. It prepares Core packages and a frozen Hub signing request, then uses a clearly synthetic key to exercise that exact payload. A test key is never a production trust root. An explicit positive --hub-sequence is required for a fresh request. If only Core metadata changes, --hub-baseline may reuse an unchanged verified synthetic Hub request rather than regenerating its identity.

reproduce.mjs --baseline <baseline.json> --hub-source <public-hub-source> rebuilds the same commits under two autocrlf policies and requires identical Core content/ZIP and Hub payload. Production offline signing follows Hub's docs/release-process.md; only the signed package and public trust information return to build environments.

stage-platform.mjs --hub-source <public-hub-source> exports only allowlisted public inputs, modes, and ownership records. It excludes repository Git history, credentials, installed dependencies, and runtime state. Linux verification operates only in explicitly marked synthetic roots; initialize separate test repositories and an empty HOME before running gates. Temporary test commits do not replace upstream provenance.

Input inventories are defined in lab/support/check-inputs.mjs. The quality gate monitors business refs and HEAD while excluding only the application's refs/codex/turn-diffs/ checkpoint namespace. Other branches, tags, remotes, replace refs, and namespaces remain monitored. A test must never restore/reset business refs to conceal accidental mutation.
