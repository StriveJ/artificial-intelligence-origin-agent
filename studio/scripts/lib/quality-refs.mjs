
export function qualityReferences(git) {
  const refs=git(['for-each-ref','--format=%(objectname) %(refname)']).trim().split(/\r?\n/).filter(Boolean).filter(line=>!line.split(' ')[1].startsWith('refs/codex/turn-diffs/')).sort();
  let head;try{head=git(['symbolic-ref','--quiet','HEAD']).trim();}catch{head='detached:'+git(['rev-parse','HEAD']).trim();}
  return JSON.stringify({head,refs});
}
