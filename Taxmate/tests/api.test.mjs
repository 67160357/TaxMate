import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';
import {openDatabase} from '../backend/db.mjs';import {addUser} from '../backend/auth.mjs';
test('Local API security and data workflows',async t=>{
 const temp=mkdtempSync(path.join(os.tmpdir(),'taxmate-v2-')),file=path.join(temp,'test.sqlite'),db=openDatabase(file);
 const admin=await addUser(db,{name:'Admin',username:'administrator',email:'admin@example.test'},'test-admin-pass','admin');
 const expert=await addUser(db,{name:'Expert',username:'expert_one',email:'expert@example.test'},'test-expert-pass','expert');db.close();
 const port=3398,base=`http://127.0.0.1:${port}`,child=spawn(process.execPath,['backend/server.mjs'],{env:{...process.env,PORT:String(port),TAXMATE_DB:file},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',s=>stderr+=s);
 try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout '+stderr)),10000);child.stdout.on('data',s=>{if(String(s).includes('Taxmate ready')){clearTimeout(timer);resolve()}});child.once('error',reject);child.once('exit',()=>reject(Error('Server exited '+stderr)))});
 const call=async(url,method='GET',body,cookie='',origin)=>{const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',Cookie:cookie,...(origin?{Origin:origin}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}};
 let a,b,ca,cb,ce,cd,id,reviewId;
 const receipt={merchant:'มูลนิธิทดสอบ',amount:2000,date:'2025-09-01',category:'donation',verified:true,image:'data:image/png;base64,AAAA',ocrText:'private OCR'};
 await t.test('root endpoints register/login, unique username and privilege escalation',async()=>{
 assert.equal((await call('/me')).status,401);assert.equal((await call('/register','POST',{name:'Attack',username:'attacker',email:'attack@example.test',password:'test-password',role:'admin'})).status,403);
 a=await call('/register','POST',{name:'Alice',username:'alice_one',email:'alice@example.test',password:'test-alice-pass'});assert.equal(a.status,201);ca=a.cookie;assert.equal(a.data.role,'user');assert.ok(ca);assert.equal(a.data.password,undefined);
 assert.equal((await call('/check-username/ALICE_ONE')).data.available,false);assert.equal((await call('/check-username/free_name')).data.available,true);
 assert.equal((await call('/register','POST',{name:'Duplicate',username:'ALICE_ONE',email:'second@example.test',password:'test-password'})).status,409);
 assert.equal((await call('/register','POST',{name:'Short',username:'ab',email:'short@example.test',password:'test-password'})).status,400);
 b=await call('/api/register','POST',{name:'Bob',username:'bob_one',email:'bob@example.test',password:'test-bob-pass'});cb=b.cookie;
 assert.equal((await call('/login','POST',{username:'alice_one',password:'wrong'})).status,401);
 ce=(await call('/login','POST',{identifier:'EXPERT_ONE',password:'test-expert-pass'})).cookie;cd=(await call('/login','POST',{email:'admin@example.test',password:'test-admin-pass'})).cookie;
 assert.equal((await call('/me','GET',undefined,ca)).data.id,a.data.id);
 });
 await t.test('role/ownership enforcement, pagination, safe edits and last admin',async()=>{
 assert.equal((await call('/users','GET',undefined,ca)).status,403);assert.equal((await call('/users','GET',undefined,ce)).status,403);
 assert.equal((await call('/users/'+a.data.id,'GET',undefined,cb)).status,403);assert.equal((await call('/users/'+a.data.id,'GET',undefined,ca)).status,200);
 assert.equal((await call('/users/'+a.data.id,'PUT',{role:'admin'},ca)).status,403);
 assert.equal((await call('/users/'+a.data.id,'PUT',{name:'Alice Updated'},ca)).data.name,'Alice Updated');
 const page=await call('/users?page=1&pageSize=2','GET',undefined,cd);assert.equal(page.data.items.length,2);assert.equal(page.data.total,5);assert.equal(page.data.items[0].salt,undefined);
 assert.equal((await call('/users?pageSize=999','GET',undefined,cd)).status,400);assert.equal((await call('/users?q=alice','GET',undefined,cd)).data.items.length,1);
 assert.equal((await call('/users/'+admin.id,'PUT',{role:'user'},cd)).status,409);assert.equal((await call('/users/'+admin.id,'DELETE',undefined,cd)).status,409);
 });
 await t.test('receipt isolation, validation and cross-origin writes',async()=>{
 id=(await call('/api/receipts','POST',receipt,ca)).data.id;assert.ok(id);
 for(const cookie of [cb,ce,cd])assert.equal((await call('/api/receipts/'+id,'GET',undefined,cookie)).status,404);
 assert.equal((await call('/api/receipts/'+id,'DELETE',undefined,cb)).status,404);
 assert.equal((await call('/api/receipts','POST',{...receipt,amount:-1},ca)).status,400);
 assert.equal((await call('/api/profile','PUT',{salary:600000,bonus:0,withheld:22000},ca,'https://evil.example')).status,403);
 assert.equal((await call('/api/import','POST',{profile:{salary:0,bonus:0,withheld:0},receipts:[{...receipt,amount:-1}]},ca)).status,400);
 assert.equal((await call('/api/data','GET',undefined,ca)).data.stats.total,1);
 });
 await t.test('expert can read only explicit shared bills; revoke and edit reset review',async()=>{
 assert.equal((await call('/api/reviews?scope=assigned','GET',undefined,ca)).status,403);
 assert.equal((await call('/api/receipts/'+id+'/review-request','POST',{expertId:expert.id},cb)).status,404);
 assert.equal((await call('/api/receipts/'+id+'/review-request','POST',{expertId:expert.id},ca)).status,200);
 reviewId=(await call('/api/reviews?scope=assigned','GET',undefined,ce)).data.items[0].id;
 assert.equal((await call('/api/reviews/'+reviewId,'GET',undefined,cb)).status,404);assert.equal((await call('/api/reviews/'+reviewId,'GET',undefined,cd)).status,404);
 assert.equal((await call('/api/reviews/'+reviewId,'GET',undefined,ce)).data.receipt.ocrText,'private OCR');
 assert.equal((await call('/api/reviews/'+reviewId,'PUT',{status:'eligible',comment:'ตรวจหลักฐานแล้ว'},ca)).status,403);
 assert.equal((await call('/api/reviews/'+reviewId,'PUT',{status:'eligible',comment:'ตรวจหลักฐานแล้ว'},ce)).status,200);
 await call('/api/receipts/'+id,'PUT',{...receipt,amount:3000},ca);
 assert.equal((await call('/api/reviews/'+reviewId,'GET',undefined,ce)).data.status,'pending');
 await call('/api/receipts/'+id+'/review-request','DELETE',undefined,ca);assert.equal((await call('/api/reviews/'+reviewId,'GET',undefined,ce)).status,404);
 });
 await t.test('bounded lists exclude images; aggregates and exports include all receipts',async()=>{
 const rows=Array.from({length:125},(_,i)=>({...receipt,merchant:'Receipt '+i,amount:100}));
 assert.equal((await call('/api/import','POST',{profile:{salary:600000,bonus:0,withheld:0,scopeConfirmed:true},receipts:rows},ca)).status,200);
 const data=(await call('/api/data','GET',undefined,ca)).data;assert.equal(data.receipts.length,100);assert.equal(data.stats.total,125);assert.equal(data.summary.donation,12500);assert.equal(data.summary.eligible,125);assert.equal(data.receipts[0].image,undefined);assert.equal(data.summary.coverageStatus,'within-supported-scope');
 const page=(await call('/api/receipts?page=7&pageSize=20','GET',undefined,ca)).data;assert.equal(page.items.length,5);assert.equal(page.total,125);
 const full=(await call('/api/receipts/'+page.items[0].id,'GET',undefined,ca)).data;assert.equal(full.image,receipt.image);
 const backup=(await call('/api/backup','GET',undefined,ca)).data;assert.equal(backup.receipts.length,125);assert.equal(backup.receipts[0].image,receipt.image);
 const csv=await fetch(base+'/api/export',{headers:{Cookie:ca}});assert.equal((await csv.text()).trim().split('\r\n').length,126);
 const indexes=(await call('/api/admin/indexes','GET',undefined,cd)).data;assert.ok(indexes.plan.some(p=>p.detail.includes('idx_receipts_user_date')));assert.equal((await call('/api/admin/indexes','GET',undefined,ca)).status,403);
 });
 await t.test('role changes revoke existing sessions; disabled users cannot log in',async()=>{
 assert.equal((await call('/users/'+b.data.id,'PUT',{role:'expert'},cd)).status,200);assert.equal((await call('/me','GET',undefined,cb)).status,401);
 cb=(await call('/login','POST',{username:'bob_one',password:'test-bob-pass'})).cookie;assert.equal((await call('/me','GET',undefined,cb)).data.role,'expert');
 assert.equal((await call('/users/'+b.data.id,'PUT',{status:'disabled'},cd)).status,200);assert.equal((await call('/me','GET',undefined,cb)).status,401);assert.equal((await call('/login','POST',{username:'bob_one',password:'test-bob-pass'})).status,401);
 assert.equal((await call('/users/'+b.data.id,'DELETE',undefined,ca)).status,403);assert.equal((await call('/users/'+b.data.id,'DELETE',undefined,cd)).status,200);assert.equal((await call('/users/'+b.data.id,'GET',undefined,cd)).status,404);
 });
 await t.test('change-password invalidates all sessions; logout revokes server token',async()=>{
 const ca2=(await call('/login','POST',{identifier:'alice_one',password:'test-alice-pass'})).cookie;
 assert.equal((await call('/change-password','POST',{currentPassword:'wrong',newPassword:'new-alice-pass'},ca)).status,403);
 assert.equal((await call('/change-password','POST',{currentPassword:'test-alice-pass',newPassword:'new-alice-pass'},ca)).status,200);
 for(const c of [ca,ca2])assert.equal((await call('/me','GET',undefined,c)).status,401);
 assert.equal((await call('/login','POST',{username:'alice_one',password:'test-alice-pass'})).status,401);
 const login=await call('/login','POST',{username:'alice_one',password:'new-alice-pass'});assert.equal(login.status,200);assert.equal((await call('/logout','POST',{},login.cookie)).status,200);assert.equal((await call('/me','GET',undefined,login.cookie)).status,401);
 const audit=(await call('/api/admin/audit','GET',undefined,cd)).data;assert.ok(audit.items.some(r=>r.action==='change-password'));
 });
 }finally{child.kill('SIGTERM');await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));rmSync(temp,{recursive:true,force:true})}
});
