# Specification: Instance Development to Origin and Personal Releases

For users developing reusable framework capabilities in their own instances. This specification describes implemented tools/gates and names their limitations. See [Contributing](../CONTRIBUTING.md), [build conventions](../studio/CLAUDE.md), and [release guidance](../product/RELEASE.md). Private material is never a public build dependency.

## 0. Quick Workflow

1. Is this for all users? If yes, use the framework area; otherwise keep it personal.
2. Put work in the correct area from the start.
3. Before export, inspect **both** aipa-contribute-status sections.
4. Export, complete CONTRIBUTION.md, apply patches in an Origin fork based on dev, and open a dev PR.
5. Never use user-space/scripts, open direct feature PRs against master, or add --directory to mapped patches.

Every abbreviated runtime command below means `node <instance>/core-space/scripts/<name>.mjs --root <instance> ...`.

## 1. Areas and the Ownership Rule

| Term | Meaning |
|---|---|
| Framework area (P set) | core-space/**, AGENTS.md, .claude/**, .ide_activation/**, .codebuddy/**; the contribution path set |
| Personal area | user-space/**; never overwritten by pull-origin or included in framework PRs |
| Origin | Source repository containing studio build tools and authoritative product source |
| Personal channels | Published artifacts: stable/master and beta/beta |
| Instance | An initialized private deployment with its own Git repository |

If all users should receive it, it belongs in the framework area. Otherwise it stays personal and outside the PR.

## 2. Development Destinations

| Content | Destination in an instance |
|---|---|
| Framework CLI/library | core-space/scripts/ and lib/ |
| Common skill | core-space/common/skills/ |
| Mentor | core-space/mentors/ |
| Protocol/gate/constraint | core-space/*.md |
| Entry document | AGENTS.md; source is product/templates/personal/AGENTS.md |
| Personal skills/memory/profile/logs/knowledge | user-space/ |
| Personal scripts | Elsewhere under user-space, never user-space/scripts/ |

Framework code misplaced in the personal area works locally but cannot reach other users through framework export. Personal content misplaced in the framework area can be overwritten during synchronization. Both are serious boundary errors. The reserved user-space/scripts path is a hard blocker for the entire export; move framework code to core-space or truly personal scripts elsewhere before proceeding.

## 3. Three Cases

### 3.1 Framework-Only Changes

Inspect aipa-contribute-status for expected pending paths and diverged conflicts. Prepare/fill CONTRIBUTION.md, then aipa-export-edits --out <directory>.

### 3.2 Personal-Only Changes

Personal memory/profile/logs/knowledge/skills require no framework PR. Status shows some outside-framework entries but intentionally ignores logs/profile noise. A reusable standalone artifact can enter Origin's contribution review tool; a reusable framework feature should first move into the framework area. user-space/scripts must be resolved before any export.

### 3.3 Changes in Both Areas

Classify first, move reusable pieces to the framework area, then export. Personal changes never enter the patch. When personal values and framework behavior share a file, separate them before delivery.

### 3.4 Single-Artifact Review

```bash
node <origin>/studio/scripts/aipa-contribute.mjs --source <artifact> --origin <origin>
```

The tool abstracts identifiers, validates skill fields/sections (name, version, Trigger phrases, Action sequence, Verification), and writes studio/contributions/<anonymous-id>-<timestamp> for review. It does not directly install product content. It is an Origin maintainer tool, not distributed to instances. Without --origin it reports the maintenance requirement instead of operating on an instance.

## 4. Slots and Overrides Instead of Submodules

Expose reusable behavior in the framework and user-specific values as registered slots:

```text
core-space/anchors.yaml       registered keys, sources, types
core-space/activation.md      default protocol behavior
user-space/overrides.yaml     personal values for registered keys
```

Display identity/name/prefix/tone overrides preserve that boundary. display.language provides the model output-language preference, default auto. This is not a general executable extension loader; use the actual language resolver/protocol rather than assuming every anchor is mechanically resolved.

Do not use Git submodules to model foundation/instance inheritance. Distribution copies managed file trees, while submodules require their own checkout/update/credentials and have different mount-point semantics. A filesystem baseline can enumerate a checked-out submodule's files; the issue is delivery/ownership compatibility, not a universal inability to enumerate them.

## 5. Contributing One of Several Interleaved Features

A PR needs a clean net change against upstream dev, not the instance's whole history. Inspect git log -p for overlapping hunks:

- Separate regions: reconstruct only the selected feature in an Origin fork based on dev. Use exported combined patches as reference without rewriting the live instance.
- Interleaved logic: first extract a real independent function/module/configurable branch. There is no reliable automatic semantic split.
- Avoid rebasing a running instance's history: synchronization anchors, shared refs, and active behavior can be affected.

The exporter selects framework paths in a synchronization-anchor-to-HEAD range and has no feature/commit selector; exported-* tags do not become anchors.

### 5.1 Recommended Sequence

Contribute A, wait for merge/release, pull it into the instance, then contribute B. After pull A is unchanged, not adopted. Adopted is visible **before** pull when upstream/current local bytes agree against an older baseline.

### 5.2 Immediate Partial Export

Only the selected feature may remain in the export workspace: export auto-commits all uncommitted pending framework paths.

- Separate files: stash only B's paths, export A, then restore B.
- Separate hunks: carefully stage A and stash with --keep-index.
- Same hunk: manual patch editing or prior extraction is required.

Preserve staged/unstaged state and back up work before these operations. During stashing B is unavailable and restoration may conflict. Exporting B before A reaches the synchronization baseline repeats A's patches; wait or remove overlapping already-submitted patches explicitly. These examples do not authorize rewriting a real personal repository.

## 6. Avoiding Incomplete Contributions

| Omission | Detection |
|---|---|
| Missing path | Status/export signals, if reviewed |
| Missing hunk | Real behavior evidence and human review; path completeness cannot detect it |
| Missing tools/seam/anchor registration | Origin quality gate; the suite is available in an Origin fork |
| Inadequate contribution explanation | Required-section/code-block checks detect absence, not truth |

### 6.1 Existing Signals to Inspect

1. Review every pending framework path and every outside-framework entry. Root CHANGELOG/.gitignore are not framework contribution paths.
2. The generated contribution document lists omitted nonpersonal paths but gives only counts for user-space, whose path names can themselves be private.
3. New paths outside the synchronization map need an explicit purpose in CONTRIBUTION.md.
4. Compare exported path/patch counts against your expected set.
5. Ignored pending paths cannot be committed/exported. Keep truly local files private; only remove an ignore rule if the path is actually public framework source.
6. Changes preceding the latest synchronization anchor may be exported through a separate whole-history path fallback. Verify those older changes are intended.

An export invariant requires every selected path to appear in the patch sequence; otherwise it rejects by name.

### 6.2 Discovering an Omission Later

Before merge, append a focused correction to the same fork branch. Avoid re-export overlap by waiting for the prior release/pull or removing duplicate patches. After merge, submit a follow-up PR with actual CLI evidence rather than asking a maintainer to invent contributor-side verification.

Pending paths remain visible until adopted/synchronized, but this is not a preservation guarantee. The contribution P set differs from the managed synchronization map: arbitrary new IDE files may export yet never be overwritten by updates, while managed paths have their own update/drift rules. Controlled updating checks managed drift; use its preview and shared contracts rather than relying on clean Git status as proof that committed work reached upstream. Export or otherwise preserve reusable changes before updating.

### 6.3 Human Review Remains Necessary

Missing hunks and framework hardcoding that should have been configuration are semantic review questions.

## 7. Pre-PR Checklist

1. Review both status sections; resolve diverged paths explicitly.
2. Ensure user-space/scripts is absent.
3. Prepare CONTRIBUTION.md with **Feature Overview** and **Testing and Validation**, including actual commands/output in code blocks.
4. Export mapped product patches; apply with git am and no --directory.
5. Push a feature branch in an Origin fork and open a dev PR.
6. Run the full shared gate in that fork and retain result files.

Do not bypass diverged, misplaced-code, or contribution-document gates.

## 8. Commits and the Framework Ledger

Because format-patch reads committed content, export records pending framework edits in a commit with a trailer:

```text
edit(framework): <slug>

AIPA-Framework-Edit: <slug>
```

It stages only export paths and the current CONTRIBUTION.md, not all personal memory/logs. Inspect the ledger using the trailer and synchronization anchor/version tag. Export records on the current instance branch rather than creating branches after every synchronization. exported-<date> tags are records, not future export anchors. The clean PR is defined by selected framework changes, not hand-picked historical commits.

## 9. Merge, Release, and Return

### Origin Review

PRs target dev. Require CONTRIBUTION.md and a successful full gate. Contributors can run the suite in an Origin clone; generated instances do not ship it. Maintainers still verify evidence and gates before merge. Abstract/content-policy gates remain necessary: review-contribution is not a replacement, and assemble-origin invokes content-policy. Promotion from dev to master is explicit. After publication, synchronize master back into dev to avoid stale version bumps.

### Personal Publication

```bash
node studio/scripts/aipa-bump-version.mjs --root .
node studio/scripts/aipa-assemble-origin.mjs --src . --dest <personal-artifact>
node studio/scripts/aipa-validate-origin.mjs --origin <personal-artifact> --strict
node studio/scripts/aipa-origin-abstract-check.mjs --dir <personal-artifact>
node studio/scripts/aipa-publish-origin.mjs --root <personal-artifact>
```

Bump's root is Origin; publish's root is the generated artifact. publish --src selects the source repository, defaulting to the script's repository. Source dev yields artifact beta; source master yields artifact master; other branches are rejected. Channel/branch/pre flags validate rather than override the derivation.

Publish switches target branch before staging/committing. Without --push it is local only. It does not create tags: publish locally, tag that artifact commit, then publish --push. Existing tags are pushed; absent tags warn/skip, and an unreadable version can skip tag handling without a warning. Verify actual refs. The source pre-push version hook is separate.

### Return to the Instance

Before pulling, status can show adopted because local/upstream changes match against an old baseline. After a successful update rewrites the baseline, the state is unchanged. The promised aggregate adoption notice is not implemented; current status lists [state] path. Controlled updating separately enforces trusted sources, pin/subscription intent, downgrade approval, and compatibility. A channel switch does not waive compatibility checks.

## 10. Four Defense Layers

| Layer | When | Protection |
|---|---|---|
| Guidance | Before editing | Framework-versus-personal ownership; expose variable values as slots |
| Status/export warnings and gates | Before contribution | user-space/scripts blocker; personal executable/skill warnings; outside-framework report |
| Origin assertions | During validation | Registration consistency and limited static framework-to-personal-code coupling checks |
| Review | PR review | Missing hunks, hardcoded configuration, and semantic evidence |

Validate the actual generated artifact; a file-count assumption is not a delivery contract.

## 11. Prohibited Shortcuts

Do not put framework code in the personal area, personal content in the framework area, or anything in user-space/scripts. Do not depend on hardcoded personal executable paths, target master with feature PRs, add --directory to mapped patches, bypass export gates, or use submodules as the foundation/instance mechanism.

## 12. Permission Boundaries

Instance-distributed status/export/channel/pull/report commands need the instance and their normal authorization. Single-artifact contribution needs an Origin clone. Bump/publish need an Origin clone and maintainer permission. A roster match is not remote platform authorization.

## Known Limits

- Registered display overrides are a constrained configuration/protocol mechanism, not arbitrary code extension.
- user-space/tasks is an opt-in discovered plugin directory, not a prepopulated template. Personal executable warnings exempt this declared plugin slot.
- Export has no semantic feature/commit selector.
- Static cross-zone checks inspect core-space/**/*.mjs, literal sink arguments (spawn/exec/import/require), and const/let initializers whose names reach sinks. They do not exhaustively follow wrappers, aliases/rebindings, later assignments, cross-file flows, or multiple indirection layers. cwd values are intentionally skipped. Variable/no-extension/returned paths may produce dynamic findings without failing. Literal code filenames and some prose strings can conservatively trigger review, including order-sensitive prose. Passing this check is not a whole-program proof.
- Adoption summary wording is not implemented; inspect status before pull and unchanged state after pull.
- Actual artifact contents and current validation establish delivery coverage.

## Packages and Installation Choices

Controlled ZIP and fixed Git commits must represent the same delivery. Never package a personal instance as a public release. Release catalogs derive from tags; compatibility comes from the artifact. One-time choices, subscriptions, pins, and downgrades are separate.

studio/scripts/aipa-package-origin.mjs produces only local packages/digests after final release metadata/Git content is fixed, recording the artifact commit and package digest. It does not upload/sign attachments or rewrite tags. Production availability and personal-instance operations remain subject to explicit authorization and the actual release-baseline policy.
