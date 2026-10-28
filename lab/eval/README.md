# Mechanical Retrieval and Capacity Evaluation

All fixtures are synthetic and created in a marked ignored directory. These tools do not read real personal data or call a model unless an explicitly authorized model evaluator is selected elsewhere.

- node lab/eval/run.mjs compares current CLI retrieval, equivalent substring ranking, and offline BM25 over 100 questions with a 60/40 development/frozen split. Reports include recall@3, MRR, scope/validity violations, timing, frozen source identities, and predeclared candidate thresholds. Missing-evidence hits measure retrieval risk, not answer hallucinations. The tool never changes the product default.
- node lab/eval/host-parity.mjs --hub-source <public-hub-source> compares the actual shared Core and Hub projections for all questions, including project, date, revocation, replacement, and usage-receipt versions. Budget failures and explicit larger-budget replays are recorded separately. Projection parity is not model quality.
- node lab/eval/capacity.mjs measures 100/1,000/10,000 memories and events, cache recovery, sync/async global verification, search, and content equivalence.
- node lab/eval/hub-capacity.mjs --hub-source <public-hub-source> measures the same event/conversation scales, verified archives, incremental/full report equivalence, late-event revision, and local bare-remote synchronization with pushing disabled.

Frozen question, fixture, metadata, expected-evidence, and threshold hashes are checked before execution. Modified inputs require separately reviewed identities, never silent acceptance tuning. Source and evaluator changes during measurement invalidate the report. Core/Hub capacity reports record platform, Node/ICU, total time, event-loop delay, memory, first execution, and subsequent quantiles. A first execution does not mean the operating-system cache was cleared, and synthetic local results do not prove arbitrary-scale or cross-device performance.

Use lab/answer-acceptance/ for authorized real-model answer evaluation and lab/language-acceptance/ for representative output-language checks. No completed model scores are shipped here. The Claude client contract tests verify isolated settings, credential allowlists, disabled tools/MCP/private instructions, and unknown-outcome recording without contacting a provider.
