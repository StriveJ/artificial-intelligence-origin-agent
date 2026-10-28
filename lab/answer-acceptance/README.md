# Synthetic Answer Acceptance

This frozen evaluation has 100 synthetic questions (60 development and 40 frozen) and three groups: no memory, current retrieval, and candidate BM25. Predeclared thresholds require at least 75% grounded correctness on positive questions, at most 5% unsafe negative answers, zero citation and format errors, and all 300 calls. Corrected, revoked, expired, other-project, and missing-detail cases are scored explicitly.

This repository contains the evaluation program and a fresh baseline identity, not a completed model run or a transferred score. It is a closed synthetic evaluation, not independent blind review or evidence for open-domain knowledge and long-term personal experience.

```sh
node lab/answer-acceptance/freeze.mjs
node lab/answer-acceptance/run.mjs --prepare-only --hub-source <public-hub-source>
```

The checked-in freeze cannot be overwritten. A changed evaluator, dataset, or threshold requires separate review and a new identity before model calls. Preparation checks 100 shared IDE/Hub projections and records all 300 prompts without credentials or model calls.

Real execution requires explicit authorization and --allow-model --claude-entry <installed-executor> --settings-file <authorized-settings> --hub-source <public-hub-source>. The isolated executor disables tools, MCP, private instructions, skills, and session persistence. It records source identities, full synthetic prompts, completions, per-assertion scores, unknown outcomes, and model-reported cost; credentials are excluded. Unknown outcomes stop the run without an automatic retry. Self-reported cost is not a provider invoice.

Answer release verification rescans all raw completions against the frozen thresholds and current prompts. It does not adopt a retrieval candidate or declare publication automatically. Shared projection parity does not mean two independent model hosts were tested.
