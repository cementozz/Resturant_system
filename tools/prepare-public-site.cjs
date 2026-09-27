// Publish only the customer interface and its shared helpers, never the staff UI.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=path.join(root,'trackbite-system','public'),target=path.join(root,'.runtime','sites-public');
if(!target.startsWith(path.join(root,'.runtime')+path.sep))throw new Error('Invalid build directory');
fs.rmSync(target,{recursive:true,force:true});fs.mkdirSync(target,{recursive:true});
for(const relative of ['customer','shared','app/shared.js']){const destination=path.join(target,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.cpSync(path.join(source,relative),destination,{recursive:true,filter:file=>!file.endsWith('.md')})}
fs.copyFileSync(path.join(source,'customer','index.html'),path.join(target,'index.html'));
console.log('Customer assets prepared. Staff pages and local data are excluded.');
