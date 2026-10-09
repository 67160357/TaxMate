import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
export function openDatabase(file){mkdirSync(path.dirname(file),{recursive:true});const db=new DatabaseSync(file);db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');migrate(db);return db;}
export function migrate(db){
 db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,salt TEXT NOT NULL,password TEXT NOT NULL,profile TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);`);
 const cols=t=>new Set(db.prepare(`PRAGMA table_xinfo(${t})`).all().map(r=>r.name));
 const add=(t,n,definition)=>{if(!cols(t).has(n))db.exec(`ALTER TABLE ${t} ADD COLUMN ${n} ${definition}`);};
 db.exec('BEGIN IMMEDIATE');try{
 add('users','username','TEXT COLLATE NOCASE');add('users','role',"TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user','expert'))");add('users','status',"TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled'))");add('users','created_at','INTEGER NOT NULL DEFAULT 0');
 db.prepare("UPDATE users SET username='legacy_'||substr(replace(id,'-',''),1,24) WHERE username IS NULL").run();db.prepare('UPDATE users SET created_at=? WHERE created_at=0').run(Date.now());
 add('receipts','receipt_date',"TEXT GENERATED ALWAYS AS (json_extract(data,'$.date')) VIRTUAL");add('receipts','category',"TEXT GENERATED ALWAYS AS (json_extract(data,'$.category')) VIRTUAL");add('receipts','amount',"REAL GENERATED ALWAYS AS (json_extract(data,'$.amount')) VIRTUAL");add('receipts','verified',"INTEGER GENERATED ALWAYS AS (json_extract(data,'$.verified')) VIRTUAL");
 db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username ON users(username COLLATE NOCASE);
 CREATE INDEX IF NOT EXISTS idx_users_role_created ON users(role,created_at DESC,id);
 CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at DESC,id);
 CREATE INDEX IF NOT EXISTS idx_receipts_user_date ON receipts(user_id,receipt_date DESC,id);
 CREATE INDEX IF NOT EXISTS idx_receipts_user_category_date ON receipts(user_id,category,receipt_date DESC,id);
 CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
 CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
 CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,receipt_id TEXT NOT NULL UNIQUE REFERENCES receipts(id) ON DELETE CASCADE,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expert_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,status TEXT NOT NULL DEFAULT 'pending',comment TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_reviews_expert_status ON reviews(expert_id,status,created_at DESC);
 CREATE INDEX IF NOT EXISTS idx_reviews_owner ON reviews(owner_id,created_at DESC);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor_id TEXT,action TEXT NOT NULL,target_id TEXT,created_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_audit_created ON audit(created_at DESC);
 PRAGMA user_version=2;`);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
export const publicUser=u=>({id:u.id,name:u.name,email:u.email,username:u.username,role:u.role,status:u.status,createdAt:u.created_at,demo:u.email==='demo@taxmate.local'});
export const ROLES=['admin','user','expert'];
export function httpError(status,message){const e=Error(message);e.status=status;return e;}
export function usernameValue(v){const s=String(v||'').trim().toLowerCase();if(!/^[a-z][a-z0-9_]{2,31}$/.test(s))throw httpError(400,'username ต้องเริ่มด้วย a-z และมี a-z, 0-9, _ รวม 3–32 ตัว');return s;}
export function accountValues(v){const name=String(v.name||'').trim(),email=String(v.email||'').trim().toLowerCase(),username=usernameValue(v.username);if(!name||name.length>80||!/^\S+@\S+\.\S+$/.test(email)||email.length>200)throw httpError(400,'ชื่อหรืออีเมลไม่ถูกต้อง');return {name,email,username};}
export function passwordValue(p){if(typeof p!=='string'||p.length<8||p.length>128)throw httpError(400,'รหัสผ่านต้องมี 8–128 ตัวอักษร');return p;}
export function pagination(q){const page=Number(q.page??1),pageSize=Number(q.pageSize??20);if(!Number.isInteger(page)||page<1||page>100000||!Number.isInteger(pageSize)||pageSize<1||pageSize>100)throw httpError(400,'page >= 1, pageSize 1–100');return {page,pageSize,offset:(page-1)*pageSize};}
