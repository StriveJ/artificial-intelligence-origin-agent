// Synthetic native-language fixtures use escapes so public source remains English.
export const datasetVersion='representative-language-1';
export const reference='SYNTH-MULTI-ID-2048';
export const quotation='Original: \u539f\u6587 / \u305d\u306e\u307e\u307e / acci\u00f3n / \u0627\u0644\u0646\u0635';
export const material=`The allowed export quota is 7 tasks. Reference: ${reference}. Exact quotation: ${quotation}`;
const questions={
 en:'What is the allowed export quota? Include its exact reference and quotation.',
 zh:'\u5141\u8bb8\u7684\u5bfc\u51fa\u914d\u989d\u662f\u591a\u5c11\uff1f\u9644\u4e0a\u539f\u6837\u7684\u5f15\u7528\u6807\u8bc6\u548c\u5f15\u6587\u3002',
 ja:'\u8a31\u53ef\u3055\u308c\u308b\u30a8\u30af\u30b9\u30dd\u30fc\u30c8\u306e\u4e0a\u9650\u306f\u3044\u304f\u3064\u3067\u3059\u304b\u3002\u53c2\u7167ID\u3068\u5f15\u7528\u6587\u3092\u305d\u306e\u307e\u307e\u542b\u3081\u3066\u304f\u3060\u3055\u3044\u3002',
 es:'\u00bfCu\u00e1l es la cuota de exportaci\u00f3n permitida? Incluye la referencia y la cita exactas.',
 ar:'\u0645\u0627 \u062d\u062f \u0627\u0644\u062a\u0635\u062f\u064a\u0631 \u0627\u0644\u0645\u0633\u0645\u0648\u062d\u061f \u0623\u062f\u0631\u062c \u0627\u0644\u0645\u0631\u062c\u0639 \u0648\u0627\u0644\u0627\u0642\u062a\u0628\u0627\u0633 \u0643\u0645\u0627 \u0647\u0645\u0627.',
};
const row=(id,configured,language,input,available=true)=>({id,configured,language,input,available});
export const cases=[
 ...['en','zh','ja','es','ar'].map(language=>row('auto-'+language,'auto',language,questions[language])),
 row('configured-en-on-zh','en','en',questions.zh),
 row('configured-es-on-en','es','es',questions.en),
 row('configured-ja-on-en','ja','ja',questions.en),
 row('configured-ar-on-en','ar','ar',questions.en),
 row('explicit-es-over-en','en','es',questions.en+' Respond in Spanish.'),
 row('explicit-en-over-ja','ja','en',questions.zh+' Respond in English.'),
 row('missing-en','auto','en','What is the private access code? State that the evidence is unavailable if it was not provided.',false),
 row('missing-zh','auto','zh','\u79c1\u6709\u8bbf\u95ee\u7801\u662f\u4ec0\u4e48\uff1f\u5982\u679c\u8d44\u6599\u6ca1\u6709\u63d0\u4f9b\uff0c\u8bf7\u8bf4\u660e\u8bc1\u636e\u4e0d\u8db3\u3002',false),
 row('missing-ar','auto','ar','\u0645\u0627 \u0647\u0648 \u0631\u0645\u0632 \u0627\u0644\u0648\u0635\u0648\u0644 \u0627\u0644\u062e\u0627\u0635\u061f \u0625\u0630\u0627 \u0644\u0645 \u064a\u0643\u0646 \u0641\u064a \u0627\u0644\u0645\u0648\u0627\u062f \u0641\u0627\u0630\u0643\u0631 \u0639\u062f\u0645 \u062a\u0648\u0641\u0631 \u0627\u0644\u0623\u062f\u0644\u0629.',false),
];
export const acceptance={minimumCases:14,minimumCalls:28,requiredHosts:['ide-projection','hub-adapter'],maxUnknown:0,maxFormatErrors:0,maxLanguageErrors:0,maxSemanticErrors:0,maxPreservationErrors:0,privacyProbeCalls:0};
export const outputContract='Return only JSON with exactly these fields: {"answer":string,"abstain":boolean,"decision":"answer_supported"|"evidence_unavailable","reference":string|null,"quotation":string|null}. Use only the supplied material. If the requested fact is absent, abstain=true, decision="evidence_unavailable", reference=null, quotation=null. Otherwise abstain=false, decision="answer_supported", and reproduce the supplied reference and quotation verbatim in their fields. The answer field contains a short natural-language answer; do not copy the quotation into that field. Keep JSON field names and decision enum values unchanged.';
