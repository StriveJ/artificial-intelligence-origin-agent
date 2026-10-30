# AIPA Origin

[English](README.md) · [简体中文](README_CN.md)

**Version 1.0.3 · Apache-2.0**

AIPA (Artificial Intelligence Personal Agent) is a local-first personal agent framework. Your profile, preferences, memories, reusable skills, projects, and activity records live in files inside your own private instance. Connected model hosts use this context across sessions; optional Hub services provide a persistent Web interface and device synchronization.

This is the **framework source repository**. For installation and daily use, start with [AIPA Personal](https://github.com/StriveJ/artificial-intelligence-personal-agent). Deploy [AIPA Hub](https://github.com/StriveJ/artificial-intelligence-personal-agent-hub) when you need background services or browser access.

## Repository roles

| Repository | Responsibility |
|---|---|
| [Origin](https://github.com/StriveJ/artificial-intelligence-origin-agent) | Core source, blank templates, tests, build and release tools |
| [Personal](https://github.com/StriveJ/artificial-intelligence-personal-agent) | Public installation and update artifact generated from Origin's product/ |
| [Hub](https://github.com/StriveJ/artificial-intelligence-personal-agent-hub) | Main/sub services, Web access, scheduling, model executors, and instance Git synchronization |

```text
Origin/product/ -> Personal public base -> initialize/update -> private instance
                                                                   ^
                                                      IDE host / optional Hub
```

A private instance is a separate directory and repository. Public templates contain no user's memories, conversations, credentials, or service configuration.

## What AIPA provides

- A personal profile, values and preferences that guide a connected model host.
- File-backed memory with search, project scope, confirmations, validity dates, and replacement/revocation rules.
- Reusable skills, mentors, project context, session records, checkpoints, and reports.
- Controlled Core updates with trusted-source verification, drift detection, preview, recovery, and rollback.
- Optional Hub browser conversations, notes, scheduling, and Git synchronization across devices.
- English code and mechanical interfaces; model input and output follow the user's language preference while preserving original personal content.

AIPA does not bundle a hosted model account. Model providers, external search, notifications, and remote synchronization require their own configuration and authorization. Core uses Node built-in/local modules without third-party runtime packages; Hub declares its dependencies separately.

## Develop and test

Use Node.js 24 and Git 2.31 or newer. On Windows, prefer a short checkout path because integration tests create nested repositories.

```bash
git clone https://github.com/StriveJ/artificial-intelligence-origin-agent.git
cd artificial-intelligence-origin-agent
node studio/scripts/aipa-check.mjs --mode quick
node studio/scripts/aipa-check.mjs --mode all
```

Origin requires no npm install. Tests create isolated synthetic instances and local remotes. Real model evaluations are separate, opt-in commands that require explicit authorization; the default quality gate does not make paid model calls.

| Directory | Contents |
|---|---|
| product/ | Authoritative Core, installers, blank templates, and Personal user guides |
| studio/ | Build scripts, contribution tools, and unit regressions |
| lab/ | Isolated integration, evaluation, capacity, and release verification |
| docs/ | Public contribution and operation guidance |

## Build Personal

Edit product/ and commit the intended source before canonical assembly. Use a dedicated output directory:

```bash
node studio/scripts/aipa-assemble-origin.mjs --src . --dest /absolute/path/to/personal-output
node studio/scripts/aipa-validate-origin.mjs --origin /absolute/path/to/personal-output --strict
node studio/scripts/aipa-origin-abstract-check.mjs --dir /absolute/path/to/personal-output
```

**Assembly replaces everything in the destination except .git. Never target a personal instance or another workspace.** The artifact records source provenance and file checksums. Personal is generated from product/; contribute reusable fixes to Origin rather than editing the generated public artifact.

Source master produces stable/artifact master; source dev produces beta/artifact beta. Publishing, version tags, package signing, and production deployment are separate operations. Published packages, checksums, and tags are immutable. See [Contributing](CONTRIBUTING.md) and [release guidance](product/RELEASE.md).

## Documentation and collaboration

- [Personal installation and updates](product/README.md)
- [Contribution workflow](CONTRIBUTING.md) and [instance-to-Origin contribution guide](docs/instance-to-origin-contribution.md)
- [Framework](product/framework.md), [boundaries](product/core-space/CONSTRAINTS.md), and [shared contracts](product/core-space/shared-contracts.md)
- [Build working agreement](studio/CLAUDE.md), [quality gate and CI](studio/ci/README.md), and [evaluation tools](lab/README.md)
- [Maintainers](MAINTAINERS.md) and [code ownership](.github/CODEOWNERS)

Pull requests target dev. Use synthetic data in issues, reproductions, and tests. Never submit actual profiles, conversations, secrets, runtime directories, or private configuration. A maintainer roster entry does not grant platform access; repository permissions and branch protection are configured separately.

## Contact

If you have any suggestions or ideas, feel free to contact me by email:

- [1905212905@qq.com](mailto:1905212905@qq.com)
- [strivejun@gmail.com](mailto:strivejun@gmail.com)

## License

Code and documentation are licensed under [Apache License 2.0](LICENSE), including the explicit contributor patent grant and its conditions in Section 3. Third-party components retain their own licenses. Your personal instance data remains yours and is not automatically licensed by using AIPA.
