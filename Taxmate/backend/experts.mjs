// Expert profiles, public directory and 1:1 messaging between a user and an expert.
// Authorization is enforced here on every request; hiding buttons in the UI is not a control.
import {randomUUID} from 'node:crypto';
import {httpError, pagination} from './db.mjs';
import {roleGuard} from './auth.mjs';

export const SPECIALTIES = ['เงินเดือน ม.40(1)', 'ประกันชีวิต/สุขภาพ', 'ดอกเบี้ยที่อยู่อาศัย', 'บริจาค', 'ตรวจบิลและเอกสาร', 'วางแผนภาษี', 'อื่น ๆ'];
export const MESSAGE_MAX = 2000;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const DEMO_EMAIL = 'demo@taxmate.local';

function text(v, max, label, {required = false} = {}) {
  const s = String(v ?? '').replace(/\r\n/g, '\n').trim();
  if (CONTROL.test(s)) throw httpError(400, `${label} มีอักขระที่ไม่อนุญาต`);
  if (s.length > max) throw httpError(400, `${label} ยาวเกิน ${max} ตัวอักษร`);
  if (required && !s) throw httpError(400, `กรุณากรอก${label}`);
  return s;
}

export function validateExpertProfile(b = {}) {
  const headline = text(b.headline, 120, 'หัวข้อแนะนำตัว'), bio = text(b.bio, 2000, 'ประวัติและแนวทางให้คำปรึกษา');
  const credentials = text(b.credentials, 300, 'คุณวุฒิ/ประสบการณ์'), availability = text(b.availability, 200, 'ช่วงเวลาที่ตอบ');
  if (!Array.isArray(b.specialties ?? [])) throw httpError(400, 'ความเชี่ยวชาญต้องเป็นรายการ');
  const specialties = [...new Set(b.specialties ?? [])];
  if (specialties.length > 6 || specialties.some(s => !SPECIALTIES.includes(s))) throw httpError(400, 'เลือกความเชี่ยวชาญได้ไม่เกิน 6 รายการจากตัวเลือกที่กำหนด');
  if (!Array.isArray(b.languages ?? [])) throw httpError(400, 'ภาษาต้องเป็นรายการ');
  const languages = [...new Set((b.languages ?? []).map(l => text(l, 30, 'ภาษา')).filter(Boolean))];
  if (languages.length > 5) throw httpError(400, 'ระบุภาษาได้ไม่เกิน 5 ภาษา');
  const years = Number(b.experienceYears ?? 0);
  if (!Number.isInteger(years) || years < 0 || years > 60) throw httpError(400, 'ประสบการณ์ต้องเป็นจำนวนเต็ม 0–60 ปี');
  const published = b.published === true, accepting = b.accepting !== false;
  if (published && (!headline || bio.length < 20 || !specialties.length)) throw httpError(400, 'ก่อนเผยแพร่ ต้องมีหัวข้อแนะนำตัว ประวัติอย่างน้อย 20 ตัวอักษร และเลือกความเชี่ยวชาญอย่างน้อย 1 รายการ');
  return {headline, bio, credentials, availability, specialties, languages, experienceYears: years, published, accepting};
}

export function validateMessage(v) {
  const body = text(v, MESSAGE_MAX, 'ข้อความ', {required: true});
  return body;
}

const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const shape = r => ({
  id: r.user_id, name: r.name, username: r.username, headline: r.headline, bio: r.bio, specialties: parse(r.specialties, []),
  experienceYears: r.experience_years, credentials: r.credentials, credentialsVerified: false, languages: parse(r.languages, []),
  availability: r.availability, accepting: !!r.accepting, published: !!r.published, hidden: !!r.hidden_by_admin, updatedAt: r.updated_at
});
const PUBLIC = "FROM expert_profiles p JOIN users u ON u.id=p.user_id WHERE u.role='expert' AND u.status='active' AND p.published=1 AND p.hidden_by_admin=0";
const COLS = 'p.*,u.name,u.username';

export function registerExpertRoutes(api, {db, audit}) {
  const hits = new Map();
  const throttle = userId => {
    const now = Date.now(), list = (hits.get(userId) || []).filter(t => t > now - 60000);
    if (list.length >= 30) throw httpError(429, 'ส่งข้อความถี่เกินไป กรุณารอสักครู่');
    list.push(now); hits.set(userId, list);
  };
  setInterval(() => { for (const [k, v] of hits) if (!v.some(t => t > Date.now() - 60000)) hits.delete(k); }, 60000).unref();
  const noDemo = u => { if (u.email === DEMO_EMAIL) throw httpError(403, 'บัญชีสาธิตใช้ร่วมกันหลายคน กรุณาสมัครบัญชีส่วนตัวก่อนแชทกับผู้เชี่ยวชาญ'); };

  // ---- expert's own profile
  api.get('/expert-profile', roleGuard('expert'), (req, res) => {
    const r = db.prepare(`SELECT ${COLS} FROM expert_profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=?`).get(req.user.id);
    res.json({specialtyOptions: SPECIALTIES, ...(r ? shape(r) : {id: req.user.id, name: req.user.name, username: req.user.username, headline: '', bio: '', specialties: [], experienceYears: 0, credentials: '', credentialsVerified: false, languages: [], availability: '', accepting: true, published: false, hidden: false, updatedAt: 0})});
  });
  api.put('/expert-profile', roleGuard('expert'), (req, res) => {
    const v = validateExpertProfile(req.body);
    db.prepare(`INSERT INTO expert_profiles(user_id,headline,bio,specialties,experience_years,credentials,languages,availability,accepting,published,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET headline=excluded.headline,bio=excluded.bio,specialties=excluded.specialties,experience_years=excluded.experience_years,credentials=excluded.credentials,languages=excluded.languages,availability=excluded.availability,accepting=excluded.accepting,published=excluded.published,updated_at=excluded.updated_at`)
      .run(req.user.id, v.headline, v.bio, JSON.stringify(v.specialties), v.experienceYears, v.credentials, JSON.stringify(v.languages), v.availability, +v.accepting, +v.published, Date.now());
    audit(req.user.id, 'expert-profile-update', req.user.id);
    res.json(shape(db.prepare(`SELECT ${COLS} FROM expert_profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=?`).get(req.user.id)));
  });

  // ---- public directory (published, not hidden, active experts only)
  api.get('/expert-directory', (req, res) => {
    const p = pagination(req.query), where = [], args = [];
    if (req.query.specialty) { if (!SPECIALTIES.includes(req.query.specialty)) throw httpError(400, 'ความเชี่ยวชาญไม่ถูกต้อง'); where.push('EXISTS(SELECT 1 FROM json_each(p.specialties) WHERE value=?)'); args.push(req.query.specialty); }
    if (req.query.q) { const q = String(req.query.q).slice(0, 80); where.push('(instr(lower(u.name),lower(?))>0 OR instr(lower(p.headline),lower(?))>0)'); args.push(q, q); }
    if (req.query.accepting === '1') where.push('p.accepting=1');
    const w = where.length ? ' AND ' + where.join(' AND ') : '';
    const total = db.prepare(`SELECT count(*) n ${PUBLIC}${w}`).get(...args).n;
    const items = db.prepare(`SELECT ${COLS} ${PUBLIC}${w} ORDER BY p.updated_at DESC,u.id LIMIT ? OFFSET ?`).all(...args, p.pageSize, p.offset).map(r => { const s = shape(r); s.bio = s.bio.slice(0, 160); return s; });
    res.json({items, total, page: p.page, pageSize: p.pageSize, pages: Math.ceil(total / p.pageSize), specialties: SPECIALTIES});
  });
  api.get('/experts/:id', (req, res) => {
    const r = db.prepare(`SELECT ${COLS} ${PUBLIC} AND u.id=?`).get(req.params.id);
    if (!r) throw httpError(404, 'ไม่พบโปรไฟล์ผู้เชี่ยวชาญ');
    res.json(shape(r));
  });

  // ---- admin moderation of public profiles (admin never gets chat content)
  api.get('/admin/expert-profiles', roleGuard('admin'), (req, res) => {
    const p = pagination(req.query), total = db.prepare("SELECT count(*) n FROM users WHERE role='expert'").get().n;
    const items = db.prepare("SELECT u.id,u.name,u.username,u.status,coalesce(p.headline,'') headline,coalesce(p.published,0) published,coalesce(p.hidden_by_admin,0) hidden,coalesce(p.credentials,'') credentials FROM users u LEFT JOIN expert_profiles p ON p.user_id=u.id WHERE u.role='expert' ORDER BY u.created_at DESC,u.id LIMIT ? OFFSET ?").all(p.pageSize, p.offset).map(r => ({...r, published: !!r.published, hidden: !!r.hidden}));
    res.json({items, total, page: p.page, pageSize: p.pageSize});
  });
  api.put('/admin/expert-profiles/:id', roleGuard('admin'), (req, res) => {
    if (typeof req.body.hidden !== 'boolean') throw httpError(400, 'hidden ต้องเป็น true/false');
    if (!db.prepare("SELECT id FROM users WHERE id=? AND role='expert'").get(req.params.id)) throw httpError(404, 'ไม่พบผู้เชี่ยวชาญ');
    db.prepare(`INSERT INTO expert_profiles(user_id,hidden_by_admin,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET hidden_by_admin=excluded.hidden_by_admin`).run(req.params.id, +req.body.hidden, Date.now());
    audit(req.user.id, req.body.hidden ? 'expert-profile-hide' : 'expert-profile-unhide', req.params.id);
    res.json({ok: true, hidden: req.body.hidden});
  });

  // ---- conversations
  const mine = (id, user) => {
    const c = db.prepare('SELECT * FROM conversations WHERE id=? AND (user_id=? OR expert_id=?)').get(id, user.id, user.id);
    if (!c) throw httpError(404, 'ไม่พบบทสนทนา');
    return c;
  };
  const canSend = c => !!db.prepare("SELECT 1 FROM users e JOIN users u ON u.id=? WHERE e.id=? AND e.role='expert' AND e.status='active' AND u.status='active'").get(c.user_id, c.expert_id);
  const unreadSql = "SELECT count(*) n FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.sender_id<>? AND ((c.user_id=? AND m.id>c.user_read_id) OR (c.expert_id=? AND m.id>c.expert_read_id))";
  const markRead = (c, me) => {
    const last = db.prepare('SELECT max(id) m FROM messages WHERE conversation_id=?').get(c.id).m || 0;
    db.prepare(c.user_id === me ? 'UPDATE conversations SET user_read_id=max(user_read_id,?) WHERE id=?' : 'UPDATE conversations SET expert_read_id=max(expert_read_id,?) WHERE id=?').run(last, c.id);
  };
  const addMessage = (c, sender, body) => {
    const now = Date.now(), id = Number(db.prepare('INSERT INTO messages(conversation_id,sender_id,body,created_at) VALUES(?,?,?,?)').run(c.id, sender, body, now).lastInsertRowid);
    db.prepare(`UPDATE conversations SET last_message_at=?,${c.user_id === sender ? 'user_read_id' : 'expert_read_id'}=? WHERE id=?`).run(now, id, c.id);
    return {id, senderId: sender, mine: true, body, createdAt: now};
  };

  api.get('/conversations/unread', (req, res) => res.json({count: db.prepare(unreadSql).get(req.user.id, req.user.id, req.user.id).n}));
  api.get('/conversations', (req, res) => {
    const p = pagination(req.query), me = req.user.id;
    const total = db.prepare('SELECT count(*) n FROM conversations WHERE user_id=? OR expert_id=?').get(me, me).n;
    const items = db.prepare(`SELECT c.id,c.last_message_at lastMessageAt,CASE WHEN c.user_id=? THEN 'user' ELSE 'expert' END asRole,
      CASE WHEN c.user_id=? THEN eu.name ELSE uu.name END otherName,
      (SELECT substr(body,1,80) FROM messages WHERE conversation_id=c.id ORDER BY id DESC LIMIT 1) lastBody,
      (SELECT count(*) FROM messages WHERE conversation_id=c.id AND sender_id<>? AND id>CASE WHEN c.user_id=? THEN c.user_read_id ELSE c.expert_read_id END) unread
      FROM conversations c JOIN users uu ON uu.id=c.user_id JOIN users eu ON eu.id=c.expert_id
      WHERE c.user_id=? OR c.expert_id=? ORDER BY c.last_message_at DESC,c.id LIMIT ? OFFSET ?`).all(me, me, me, me, me, me, p.pageSize, p.offset);
    res.json({items, total, page: p.page, pageSize: p.pageSize});
  });

  api.post('/conversations', (req, res) => {
    noDemo(req.user); throttle(req.user.id);
    const expertId = String(req.body.expertId || ''), body = validateMessage(req.body.message), me = req.user.id;
    if (expertId === me) throw httpError(400, 'ไม่สามารถแชทกับตัวเองได้');
    const expert = db.prepare(`SELECT u.id,p.accepting ${PUBLIC} AND u.id=?`).get(expertId);
    if (!expert) throw httpError(404, 'ไม่พบผู้เชี่ยวชาญที่เปิดรับคำปรึกษา');
    db.exec('BEGIN IMMEDIATE');
    try {
      let c = db.prepare('SELECT * FROM conversations WHERE (user_id=? AND expert_id=?) OR (user_id=? AND expert_id=?)').get(me, expertId, expertId, me);
      if (!c) {
        if (!expert.accepting) throw httpError(409, 'ผู้เชี่ยวชาญท่านนี้ยังไม่เปิดรับผู้ปรึกษารายใหม่');
        const id = randomUUID(), now = Date.now();
        db.prepare('INSERT INTO conversations(id,user_id,expert_id,created_at,last_message_at) VALUES(?,?,?,?,?)').run(id, me, expertId, now, now);
        c = db.prepare('SELECT * FROM conversations WHERE id=?').get(id);
        audit(me, 'conversation-start', id);
      }
      const message = addMessage(c, me, body);
      db.exec('COMMIT');
      res.status(201).json({conversationId: c.id, message});
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  });

  api.get('/conversations/:id/messages', (req, res) => {
    const c = mine(req.params.id, req.user), me = req.user.id, int = (v, name) => { if (v === undefined) return 0; const n = Number(v); if (!Number.isSafeInteger(n) || n < 0) throw httpError(400, name + ' ไม่ถูกต้อง'); return n; };
    const after = int(req.query.after, 'after'), before = int(req.query.before, 'before'), limit = Math.min(100, Math.max(1, int(req.query.limit, 'limit') || 50));
    let rows;
    if (after) rows = db.prepare('SELECT * FROM messages WHERE conversation_id=? AND id>? ORDER BY id ASC LIMIT ?').all(c.id, after, limit);
    else rows = db.prepare(`SELECT * FROM messages WHERE conversation_id=? ${before ? 'AND id<?' : ''} ORDER BY id DESC LIMIT ?`).all(...[c.id, ...(before ? [before] : []), limit]).reverse();
    markRead(c, me);
    const otherId = c.user_id === me ? c.expert_id : c.user_id, other = db.prepare('SELECT id,name,role FROM users WHERE id=?').get(otherId);
    const prof = c.user_id === me ? db.prepare('SELECT headline FROM expert_profiles WHERE user_id=?').get(c.expert_id) : null;
    res.json({
      conversation: {id: c.id, asRole: c.user_id === me ? 'user' : 'expert', other: {id: other.id, name: other.name, headline: prof?.headline || ''}, canSend: canSend(c)},
      items: rows.map(m => ({id: m.id, senderId: m.sender_id, mine: m.sender_id === me, body: m.body, createdAt: m.created_at})),
      hasMore: !after && rows.length === limit
    });
  });
  api.post('/conversations/:id/messages', (req, res) => {
    noDemo(req.user);
    const c = mine(req.params.id, req.user); throttle(req.user.id);
    const body = validateMessage(req.body.body);
    if (!canSend(c)) throw httpError(409, 'บทสนทนานี้ถูกปิด (ผู้เชี่ยวชาญไม่ได้เปิดใช้งานแล้ว) อ่านย้อนหลังได้เท่านั้น');
    res.status(201).json(addMessage(c, req.user.id, body));
  });
}
