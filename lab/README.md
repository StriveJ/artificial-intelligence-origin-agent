# Integration and Acceptance Tools

Tests create marked synthetic fixtures under ignored lab/.upgrade-runs/. They isolate HOME, Git configuration, runtime directories, and temporary local remotes. Never supply a real personal instance or production Hub configuration as a fixture.

```sh
node lab/run-repair-checks.mjs --suite repairs
node lab/run-repair-checks.mjs --suite origin
node lab/run-repair-checks.mjs --suite hub --hub-source <public-hub-source>
node lab/rehearse-managed.mjs --hub-source <public-hub-source> --role main
node lab/rehearse-managed.mjs --hub-source <public-hub-source> --role sub
```

Each run retains raw logs, result JSON, and source SHA-256 inventories. Changes during a run invalidate its evidence. Hub staging copies only public allowlisted source and locked dependencies, rejects links, and never reads live configurations or runtime pointers. Required permissions must be supplied; a permission failure does not count as passing coverage.

On Windows, an explicit --cross-drive-temp-parent can exercise the sub-installation cross-drive scenario. The runner creates a marked random child and never scans or deletes the parent. Controlled Hub executor tests additionally require --harness-root pointing to a verified synthetic installation of the pinned package; passing a path alone is not execution evidence.

Managed rehearsals run real launcher/Hub processes with synthetic release identities and local instances. They test upgrade, broken-candidate recovery, and rollback. They do not prove a historical release or cross-device deployment.

## Focused tools

| Path | Purpose |
|---|---|
| eval/ | Frozen mechanical retrieval comparison, executor isolation, and capacity measurements |
| answer-acceptance/ | Frozen 100-question, 300-call synthetic answer comparison |
| language-acceptance/ | Frozen 14-question, 28-call representative language evaluation |
| release/ | Source-bound evidence verification, canonical package preparation and reproduction |
| prepare-simulation.mjs / run-simulation.mjs / verify-simulation.mjs | Assembly, initialization, update, project creation, and public-tree contracts |

The default quality gate runs contract tests without making model calls. Online evaluations need explicit authorization and explicit executor/settings paths. No real-model quality score is bundled in this source repository. A prepared input or frozen dataset is not a completed evaluation.

To simulate an installation round trip, initialize a dedicated local synthetic repository and use:

```sh
node lab/prepare-simulation.mjs --repo <dedicated-synthetic-base>
node lab/run-simulation.mjs --repo <dedicated-synthetic-base> --work <dedicated-temporary-directory>
node lab/verify-simulation.mjs --repo <dedicated-synthetic-base>
```

Both a zero exit status and valid artifact structure are required. Set AIPA_ACCEPTANCE_BASE only to an explicitly prepared synthetic source; tests clone it and verify its references remain unchanged. Never prepare directly into a repository that must be preserved.
