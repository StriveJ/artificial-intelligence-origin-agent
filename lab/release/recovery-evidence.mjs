const required=[
 "Owner decisions verify observed revisions and preserve originals and idempotent receipts across refresh and rebuild",
 "Interrupted writes can be verified from the page without overwriting later changes",
 "Maintenance or native task ownership defers decisions; path escapes and damaged evidence preserve originals",
 "Concurrent cross-device decisions remain pending; keeping the current version resolves without erasing old receipts",
 "Decision UI shows both versions and reuses an operation ID for confirmation, recovery, and repeated clicks",
 "Real main Hub HTTP covers authentication, Origin, task exclusion, static assets, and decision lookup",
];
export function recoveryGatePassed(record,log){
 if(record?.status!=='passed'||record.exitCode!==0||record.sourceChanged!==false||record.suite!=='hub'||record.test!==null||!record.command?.some(value=>String(value).replaceAll('\\','/').endsWith('/tests/conflict-review.test.mjs')))return false;
 const passed=new Set(String(log).split(/\r?\n/).map(line=>line.match(/^ok \d+ - ([^#]+)$/)?.[1]?.trim()).filter(Boolean));return required.every(name=>passed.has(name));
}
