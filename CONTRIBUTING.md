# Contributing

This guide describes PRs and the Origin -> Personal -> Instance release pipeline.

## Repositories and Ownership

| Repository | Role | Where to edit |
|---|---|---|
| artificial-intelligence-origin-agent (this repository) | Framework source/build repository | Edit product/ and open a PR here |
| artificial-intelligence-personal-agent | Public foundation assembled from Origin | Pipeline-generated; never edit the artifact instead of its source |
| A personal instance such as my-aipa | Private deployment with its own Git repository | Personal information stays here; return reusable framework work upstream |
| artificial-intelligence-personal-agent-hub | Independently maintained runtime/Web host | Edit and validate Hub separately |

`product/` is the framework's single source of truth. A framework PR edits product, not the generated Personal repository or a private deployment.

## PR Workflow

1. Fork Origin, not Personal.
2. Create a feature branch and edit product: runtime scripts in core-space/scripts; common skills/mentors in their registered framework paths; protocols/policy in core-space; blank templates in user-space/templates.
3. Register every new public runtime script in both product/core-space/tools.yaml (write/destructive permissions) and product/core-space/seam.yaml (interface/provider/consumers).
4. Commit/push the feature branch and open a PR against **dev**. Master accepts promotion merges from dev, not direct feature PRs.
5. Run the shared gate in the Origin fork; a maintainer verifies/merges and releases through the pipeline below.

## Maintainer Release Pipeline

```bash
node studio/scripts/aipa-bump-version.mjs --root .
node studio/scripts/aipa-assemble-origin.mjs --src . --dest <personal-artifact>
node studio/scripts/aipa-validate-origin.mjs --origin <personal-artifact> --strict
node studio/scripts/aipa-origin-abstract-check.mjs --dir <personal-artifact>
node studio/scripts/aipa-publish-origin.mjs --root <personal-artifact>
```

Commit the authoritative source before canonical assembly. Use a dedicated artifact directory: assembly replaces its contents except .git and must never target a personal instance.

The **build repository's** current branch determines the release line: master -> stable/artifact master; dev -> beta/artifact beta with a beta version. Other source branches are rejected even for maintainers. Channel/branch flags validate this derivation rather than overriding it. publish-origin reads the build repository from --src (default: the script's repository). Be precise about roots: bump --root is the build repository, while publish --root is the assembled artifact.

The publisher selects the target branch before staging/committing and writes the derived channel. Without --push it commits locally only. It never creates version tags. An artifact tag must reference the publish commit, so the sequence is:

```bash
node studio/scripts/aipa-publish-origin.mjs --root <personal-artifact>
git -C <personal-artifact> tag v<version>
node studio/scripts/aipa-publish-origin.mjs --root <personal-artifact> --push
```

--push pushes the target branch and an already existing local version tag. Missing tags are warned about/skipped, not created; unreadable manifest versions can skip tag handling entirely. Verify the resulting tags/refs explicitly. Source tags are separate. Preserve published packages/checksums/tags as immutable.

The build repository's installed pre-push hook rejects product changes on master without a version bump; it is separate from publishing an artifact and does not replace complete gates or platform permissions.

## Contributing from a Personal Instance

A deployment is not the source. First decide whether work is reusable for all users.

- One artifact (skill, mentor, template, framework document, boundary, industry map): use Origin's studio/scripts/aipa-contribute.mjs. It abstracts personal identifiers into studio/contributions/<id> for review, not directly into product.
- A batch of framework changes: inspect both sections of aipa-contribute-status. Use `aipa-export-edits --root <instance> --prepare` to prepare CONTRIBUTION.md without exporting/committing. Fill its required sections, review public content, then export with --out <directory>. A first export without the completed document generates its skeleton and refuses export.
- Fork Origin, check out a feature branch based on dev, and `git am <directory>/*.patch`. Paths already map to product destinations: instance AGENTS.md becomes product/templates/personal/AGENTS.md; instance core-space becomes product/core-space. Do **not** add --directory.
- The exporter rejects diverged paths, anything under user-space/scripts, and missing required contribution sections (including missing test code blocks). Act on errors without bypassing the gates.
- Other personal-area differences are normal: they neither enter framework patches nor block export. Personal SKILL.md/executable files may warn; a warning is not a publication mechanism.
- Framework work in user-space can run locally forever without reaching anyone else. Move reusable framework code into core-space and expose user-specific values as registered configuration.
- Abstract personal identifiers before source entry. Abstract-check/content-policy reject identifiers, secrets/private keys, and prohibited code patterns.

Personal scripts may live elsewhere under user-space but **never user-space/scripts/**, a reserved directory whose presence is a hard export blocker. Personal code/content is not included in Origin PRs. See the [complete contribution specification](docs/instance-to-origin-contribution.md).

## Required PR Evidence

Include CONTRIBUTION.md with these headings:

- **Feature Overview**: the concrete change, motivation, affected surface, and breaking behavior.
- **Testing and Validation**: commands actually executed and their observed output in code blocks. "Tested" is not evidence.

The exported machine-filled sections list changes/destinations, synchronization anchor, boundary checks, export date/version, and omitted material. Personal-area paths are summarized as counts to avoid disclosure.

Distributed instances contain no framework .test.mjs suite. Provide actual CLI end-to-end evidence from a synthetic instance. Contributors can run the shared gate in an Origin fork; maintainers must verify it again before merging:

```bash
node studio/scripts/aipa-check.mjs --mode all
```

Preserve the reported result file. Tools check that evidence is supplied, not that its meaning or truth has been independently established; human review remains required. High-risk approval requirements in Constraints still apply.

## Release Channels and Promotion

- Origin dev integrates feature branches; master is the stable source.
- Personal beta is the beta artifact branch; master is stable.
- Promote dev to master explicitly, bump a stable version on master, and publish.
- After promotion/publication, synchronize master back into dev (for example, `git checkout dev && git merge --ff-only master` when fast-forward is possible). Otherwise dev can issue a prerelease older than the just-published stable baseline.
- Joining beta requires the existing explicit diagnostic-consent gate. Controlled source/channel selection, subscription, pinning, and downgrade are separate choices; a channel switch does not bypass integrity or compatibility.

## Installation, Updates, and Restoration

New instances are initialized from the published Personal artifact through scripts/aipa-init.mjs. Updates use the controlled aipa-upgrade/aipa-pull-origin flow with an explicit trusted source, preview, compatibility checks, and authorized apply. Personal user-space, instance .gitignore, and personal CHANGELOG are outside framework overwrite. For exact read scope, framework-only restrictions, recovery, and supported-source rules, use [shared contracts](product/core-space/shared-contracts.md) and the [release baseline policy](product/core-space/release-support.md).

The .gitignore template is copied during initialization, not refreshed by framework updates. Existing instances may need an explicitly reviewed local ignore migration, including state/device-id (a per-device anonymous identifier), instead of blindly replacing personal rules. Do not untrack files, modify personal data, or repair real deployments without the relevant authorization.

Restoration on a different device is distinct from initialization and framework updating: use scripts/aipa-restore.mjs against a committed personal repository, preview into a new empty directory, review, then apply. Only Git-held data is restored; inspect the restore report and reconfigure local paths/endpoints as needed.

## Public Language and Privacy

Repository code, comments, protocols, templates, tests, UI, CLI output, and non-README documents use English. Localized README files are permitted. Models honor an explicit output-language request and display.language (auto follows the user's input). User content and personal memory retain their original language and bytes.

Use synthetic instances, isolated remotes, and fake models unless the user separately authorizes real model calls or deployment. Never include actual profiles, conversations, projects, secrets, runtime configuration, or private material in public source/evidence.

## License

Contributions are distributed under Apache-2.0, including its patent grant and conditions. Preserve applicable copyright notices and third-party licenses; do not assume authorship of contributed or vendored work.
