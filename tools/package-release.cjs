const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),version=require('../trackbite-system/package.json').version;
require('../trackbite-system/src/updates').version(version);
const gitArgs=['-c','safe.directory='+root.replaceAll('\\','/')];if(execFileSync('git',[...gitArgs,'status','--porcelain'],{cwd:root,encoding:'utf8'}).trim())throw Error('Commit and validate the source before packaging a release');const databaseCompatibleFrom=process.argv.slice(2);databaseCompatibleFrom.forEach(require('../trackbite-system/src/updates').version);
const target=path.join(root,'.runtime','release-'+version);fs.mkdirSync(target,{recursive:true});
// git archive guarantees local data, ignored secrets, dependencies and runtime files are excluded.
const asset='trackbite-'+version+'.zip';execFileSync('git',['-c','safe.directory='+root.replaceAll('\\','/'),'archive','--format=zip','--output='+path.join(target,asset),'HEAD'],{cwd:root});
const sha256=crypto.createHash('sha256').update(fs.readFileSync(path.join(target,asset))).digest('hex');
fs.writeFileSync(path.join(target,'trackbite-approved.json'),JSON.stringify({version,asset,sha256,approved:true,databaseCompatibleFrom},null,2));console.log(target);
