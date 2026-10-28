# Representative Language Acceptance

Fourteen predeclared synthetic questions cover English, Chinese, Japanese, Spanish, and Arabic, with two prompt paths for each question. The checks require the selected answer language, a correct quota or missing-evidence refusal, exact native quotations and identifiers, unchanged JSON keys and enum values, and zero errors across all 28 calls. Native fixture text uses Unicode escapes so source remains English. This is representative coverage, not a promise for every language.

The source includes a fresh frozen evaluation identity and no transferred model result. Deterministic script and lexeme checks are not independent human linguistic review. The evaluator author may also run the evaluation; do not call that independent blind review.

```sh
node --test lab/language-acceptance/contract.test.mjs
node lab/language-acceptance/freeze.mjs
node lab/language-acceptance/prepare.mjs --prepare-only --hub-source <public-hub-source>
```

The checked-in freeze binds cases, expectations, thresholds, and program bytes and cannot be overwritten. Review any change before creating a new identity and making model calls. Core and Hub identities are also checked before and after execution.

Preparation reads public source and builds actual Hub prompts and Core shared projections in a fresh marked synthetic fixture. Four privacy/invalid-language probes must block before producing outbound prompts. It does not read real instances or live Hub configuration.

After explicit model authorization, supply the exact Core and Hub hashes printed by preparation:

```sh
node lab/language-acceptance/run.mjs --allow-model --hub-source <public-hub-source> --expected-core <prepared-sha256> --expected-hub <prepared-sha256> --claude-entry <installed-executor> --settings-file <authorized-settings>
```

The isolated executor disables tools, MCP, skills, private instructions, and session persistence. Credentials are never recorded. All answers use one transport; the IDE path is a harness envelope around the real shared projection, not execution of a separate IDE host. Full prompts, source identities, call journals, completions, model identifiers, and scores are retained. Unknown outcomes stop execution without automatic retry. Passing this check alone does not establish release readiness or replace the separate 300-call answer evaluation.
