# Quality Gate and GitHub CI

Run from Origin with Node.js 24 and Git 2.31 or newer:

```bash
node studio/scripts/aipa-check.mjs --mode quick
node studio/scripts/aipa-check.mjs --mode all
```

Quick mode checks syntax, relative dependencies, public content, assembled-artifact integrity and path mappings, and fast regressions. All mode adds unit, integration, evaluation-contract, and release-evidence regressions and verifies that business Git references remain unchanged. Logs and machine-readable results are stored in ignored lab/.upgrade-runs/ directories. Failures exit nonzero.

Tests use isolated synthetic instances and temporary local remotes. The quality gate does not push, deploy services, call paid models, or upload diagnostics. Unknown contribution code must run in an isolated executor without personal files, signing keys, or release credentials.

The checked-in [.github/workflows/ci.yml](../../.github/workflows/ci.yml) runs the complete gate on Windows and Ubuntu with Node 24 for pull requests and pushes to dev/master, plus manual dispatch. It pins official checkout/setup-node actions to immutable commits, disables persistent checkout credentials and package-manager caching, and requests read-only repository permissions. It contains no model provider credentials or online-model commands.

Verify GitHub settings separately from local validation:

- Run the complete gate for pull requests and pushes to dev/master. Validate fork pull-request behavior and successful/failing check statuses before making checks mandatory.
- Use read-only workflow permissions for contribution checks. Separate artifact publication/signing into a restricted release workflow.
- Protect dev/master, restrict release permission, and require the appropriate reviews. GitHub reads .github/CODEOWNERS; requiring owner approval is a separate branch-protection setting.
- Source master produces stable/artifact master; source dev produces beta/artifact beta. Feature branches are not release channels.
- Verify release tags, generated artifact identity, package checksums, signatures, and supported deployment combinations before publication.

Local passing checks do not prove that GitHub branch protection or deployment settings are configured.
