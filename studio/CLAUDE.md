# Origin Build Working Agreement

For agents/contributors working in Origin. See the root README for repository roles and CONTRIBUTING for boundaries and PRs.

## Repository Boundaries

Origin owns public Core source, templates, tests, and build tools. Personal is the public foundation assembled from product. Users create private instances separately; Hub independently hosts instances and Web access. Never include real profiles, conversations, projects, runtime state, or credentials in public artifacts.

- product/: authoritative Personal source, Core/installers/blank templates/public guides.
- studio/: build scripts/tests/maintainers/CI; not assembled into Personal.
- lab/: isolated tests/evaluation/release verification, not a personal-data repository.
- docs/: public contribution/operation guides. Private design/deployment archives remain outside the repository and are never runtime/build/test inputs.

Core has 73 registered runtime entry points; tools.yaml/seam.yaml are authoritative. New public CLIs need both permission/capability registration. Installers are under product/scripts. Do not retain unused entries merely to satisfy a declared count.

## Single Sources

| Content | Path relative to product/ |
|---|---|
| Positioning | framework.md |
| System boundaries | core-space/CONSTRAINTS.md |
| Hard boundaries | core-space/policy.md |
| Version | VERSION, ORIGIN-MANIFEST.yaml |
| Capabilities/permissions | core-space/seam.yaml, core-space/tools.yaml |
| Lifecycle/recovery | core-space/common/reliability.md |
| Cross-host contracts | core-space/shared-contracts.md |
| Usage/release | README.md, README_CN.md, README_EN.md, RELEASE.md |

Maintain public contracts/tests. Documents must reflect implemented behavior rather than plans.

## Development and Tests

Core uses Node built-in/local modules without third-party runtime packages. Install Node/Git and run from Origin:

```bash
node studio/scripts/aipa-check.mjs --mode quick
node studio/scripts/aipa-check.mjs --mode all
```

Target a regression with node --test studio/tests/<name>.test.mjs. Use synthetic instances and isolated remotes, not private instances or production Hub. Preserve existing working changes/business refs; never discard unrelated user work.

aipa-spec-consistency.test.mjs checks public CLI registration, required files, contribution boundaries, and versions. doc-pointer.test.mjs checks public guide links. Neither depends on external private design specifications. New behavior needs real regression evidence; never remove assertions to conceal failures.

## Assembly and Publishing

Edit source README/license/runtime in product first. Commit source before canonical assembly into a dedicated output:

```bash
node studio/scripts/aipa-assemble-origin.mjs --src . --dest <dedicated-artifact>
node studio/scripts/aipa-validate-origin.mjs --origin <dedicated-artifact> --strict
node studio/scripts/aipa-origin-abstract-check.mjs --dir <dedicated-artifact>
```

Assembly replaces everything except .git and records build provenance/checksums. Never target a private instance or edit generated Personal instead of source.

Source master -> stable/artifact master; source dev -> beta/artifact beta. Other branches cannot impersonate formal sources. Verify version/channel/branch/tags independently. publish-origin commits only by default; --push pushes and only sends already existing version tags. It never creates them. Run the full gate before pushing and preserve existing Git hooks.

Published packages/digests/tags are immutable. Documentation branches do not automatically publish/deploy. Core updates, Hub updates, and personal Git synchronization are independent actions.

## Contribution, Language, and Privacy

All users can propose reusable changes through CONTRIBUTING. Merge/release permissions still apply. Personal skills/experience belong in user-space; reusable framework behavior belongs in framework paths. user-space/scripts is not an escape hatch and blocks export.

Public source/comments/protocols/templates/tests/UI/CLI/non-README guides use English. Localized README files are allowed. Model output follows the user's preference/input; personal material is not automatically translated.

Preserve open-source/third-party licenses and keep private archives out of public directories. Report only tested versions/platforms. Model login, online devices, and synthetic tests do not prove every real feature or deployment.
