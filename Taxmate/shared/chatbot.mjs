// Rule-based Taxmate assistant. Pure functions, no network: runs in the browser
// demo and on the server. All numbers come from shared/tax.mjs (never invented).
import {calculate, categories, ruleset, sources} from './tax.mjs';

export const WHAT_IF_CATEGORIES = ['donation', 'health', 'life', 'mortgage'];
const baht = n => new Intl.NumberFormat('th-TH', {maximumFractionDigits: 2}).format(n || 0);
const rule = id => ruleset.rules.find(r => r.id === id);
const DISCLAIMER = 'เป็นประมาณการเพื่อเตรียมข้อมูล ไม่ใช่คำแนะนำทางกฎหมาย/ภาษีและไม่ใช่การยื่นแบบ';

export const SUGGESTIONS = [
  'ภาษีของฉันปีนี้เป็นอย่างไร',
  'ประกันสุขภาพลดหย่อนได้เท่าไหร่',
  'ถ้าบริจาคเพิ่ม 10,000 บาท ภาษีลดเท่าไหร่',
  'ระบบนี้รองรับรายได้แบบไหนบ้าง'
];

export const FALLBACK_TEXT = 'ขออภัย ผมยังไม่เข้าใจคำถามนี้ ลองถามเรื่องเพดานลดหย่อน (ประกันชีวิต/สุขภาพ ดอกเบี้ยบ้าน บริจาค) สรุปภาษีของคุณ หรือถามแบบ "ถ้าบริจาคเพิ่ม 10,000 บาท" ได้ครับ หากต้องการคำตอบที่ยืดหยุ่นกว่านี้ ให้เปิดใช้ผู้ช่วย AI (เฉพาะโหมด Local ที่ผู้ดูแลตั้งค่าไว้)';

/** Simulate adding one verified receipt and compare the two calculations. */
export function whatIf(profile, taxRows, category, amount) {
  if (!WHAT_IF_CATEGORIES.includes(category)) throw Error('จำลองได้เฉพาะ บริจาคทั่วไป ประกันสุขภาพ ประกันชีวิต และดอกเบี้ยที่อยู่อาศัย');
  const extra = Number(amount);
  if (!Number.isFinite(extra) || extra <= 0 || extra > 1e9) throw Error('จำนวนเงินต้องมากกว่า 0 และไม่เกิน 1,000,000,000');
  const before = calculate(profile, taxRows);
  const after = calculate(profile, [...taxRows, {merchant: 'what-if', category, amount: extra, verified: true, date: '2025-06-01'}]);
  const usable = Math.round((after.deductions - before.deductions) * 100) / 100;
  return {
    category, label: categories[category].label, extra,
    taxBefore: before.tax, taxAfter: after.tax,
    taxSaved: Math.round((before.tax - after.tax) * 100) / 100,
    additionalDeductionUsed: usable, overCap: Math.round((extra - usable) * 100) / 100,
    balanceAfter: after.balance, coverageStatus: after.coverageStatus, warnings: after.warnings,
    note: 'จำลองเสมือนว่าบิลที่เพิ่มผ่านการตรวจหลักฐานและเจ้าของยืนยันแล้ว'
  };
}

/** Compact, non-sensitive summary of the user's calculation. */
export function summaryFacts(profile, taxRows) {
  const c = calculate(profile, taxRows);
  return {
    taxYear: 2568, rulesetId: c.rulesetId, income: c.income, expense: c.expense, deductions: c.deductions,
    net: c.net, tax: c.tax, withheld: c.withheld, balance: c.balance, savedByDeductions: c.saved,
    coverageStatus: c.coverageStatus, warnings: c.warnings
  };
}

const parseAmount = text => {
  const m = String(text).replace(/\s+/g, ' ').match(/(\d[\d,]*(?:\.\d+)?)\s*(พัน|หมื่น|แสน|ล้าน|k)?/i);
  if (!m) return NaN;
  const n = Number(m[1].replaceAll(',', ''));
  const mult = {พัน: 1e3, หมื่น: 1e4, แสน: 1e5, ล้าน: 1e6, k: 1e3}[(m[2] || '').toLowerCase()] || 1;
  return n * mult;
};
const detectCategory = t => /บริจาค|มูลนิธิ/.test(t) ? 'donation' : /ประกันสุขภาพ/.test(t) ? 'health' : /ประกันชีวิต/.test(t) ? 'life' : /ดอกเบี้ย|ที่อยู่อาศัย|ผ่อนบ้าน/.test(t) ? 'mortgage' : null;
const reply = (text, extra = {}) => ({reply: text, source: 'rules', ...extra});
const noIncome = p => !(Number(p.salary) + Number(p.bonus) > 0);

/**
 * Answer from fixed rules. Returns null when no rule matches so the caller can
 * hand over to the LLM (if enabled) or show FALLBACK_TEXT.
 * ctx = {profile, taxRows}
 */
export function ruleReply(input, ctx) {
  const text = String(input || '').trim().slice(0, 500);
  if (!text) return null;
  const {profile, taxRows = []} = ctx;
  const t = text.toLowerCase();

  if (/^(สวัสดี|หวัดดี|hello|hi|hey)\b/i.test(t) || /^(สวัสดี|หวัดดี)/.test(t))
    return reply('สวัสดีครับ ผมช่วยอธิบายเพดานลดหย่อนปี 2568 สรุปภาษีของคุณ และจำลองว่าถ้ามีบริจาค/ประกันเพิ่มภาษีจะเปลี่ยนเท่าไหร่ได้ครับ', {suggestions: SUGGESTIONS});

  if (/ช่วยอะไร|ทำอะไรได้|ใช้ยังไง|help/.test(t))
    return reply('ผมตอบได้เกี่ยวกับ: (1) เพดานและเงื่อนไขลดหย่อนที่ระบบรองรับ (2) สรุปภาษีโดยประมาณจากข้อมูลของคุณ (3) จำลอง "ถ้าบริจาค/ซื้อประกัน/จ่ายดอกเบี้ยเพิ่ม X บาท" ผลลัพธ์ทั้งหมดคำนวณจากกฎปี 2568 เท่านั้น', {suggestions: SUGGESTIONS});

  // What-if: a category word + an amount + an "increase" hint.
  const cat = detectCategory(t), amount = parseAmount(t);
  if (cat && Number.isFinite(amount) && /เพิ่ม|อีก|ถ้า|หาก|ซื้อ|จ่าย|ลอง|จำลอง|สมมติ/.test(t)) {
    if (noIncome(profile)) return reply('ยังไม่มีข้อมูลรายได้ จึงจำลองภาษีไม่ได้ครับ กรุณากรอกเงินเดือน/โบนัสในหน้า "คำนวณภาษี" ก่อน');
    try {
      const w = whatIf(profile, taxRows, cat, amount);
      let msg = `ถ้ามี${w.label}เพิ่ม ฿${baht(w.extra)} (สมมติว่าตรวจหลักฐานแล้ว) ภาษีโดยประมาณจะเปลี่ยนจาก ฿${baht(w.taxBefore)} เป็น ฿${baht(w.taxAfter)} ลดลง ฿${baht(w.taxSaved)}`;
      if (w.overCap > 0) msg += ` — ใช้สิทธิเพิ่มได้ ฿${baht(w.additionalDeductionUsed)} ส่วนอีก ฿${baht(w.overCap)} เกินเพดานแล้ว`;
      if (w.taxSaved === 0 && w.overCap === 0) msg += ' (ภาษีไม่เปลี่ยน เพราะรายได้สุทธิอยู่ในช่วงที่อัตราภาษี 0%)';
      return reply(`${msg}\n\n${w.note}. ${DISCLAIMER}${w.coverageStatus === 'incomplete' ? ' (ผลนี้ยังไม่ครบขอบเขต: ' + w.warnings.join(' / ') + ')' : ''}`, {data: w});
    } catch (e) {
      return reply(e.message);
    }
  }

  if (/ภาษี.*(ของ(ฉัน|ผม)|ปีนี้|เท่าไหร่|เท่าไร)|ต้องจ่าย|ขอคืน|คืนภาษี|สรุป/.test(t)) {
    if (noIncome(profile)) return reply('ยังไม่มีข้อมูลรายได้ครับ กรุณากรอกเงินเดือน โบนัส และภาษีหัก ณ ที่จ่ายในหน้า "คำนวณภาษี" ก่อน แล้วผมจะสรุปให้');
    const s = summaryFacts(profile, taxRows);
    const bal = s.balance >= 0 ? `ต้องชำระเพิ่มประมาณ ฿${baht(s.balance)}` : `ขอคืนประมาณ ฿${baht(-s.balance)}`;
    return reply(`ปีภาษี 2568: รายได้ ฿${baht(s.income)} หักค่าใช้จ่าย ฿${baht(s.expense)} และค่าลดหย่อนที่นับได้ ฿${baht(s.deductions)} เงินได้สุทธิ ฿${baht(s.net)} ภาษีโดยประมาณ ฿${baht(s.tax)} หัก ณ ที่จ่าย ฿${baht(s.withheld)} → ${bal}${s.warnings.length ? '\n\nข้อควรระวัง: ' + s.warnings.join(' / ') : ''}\n\n${DISCLAIMER}`, {data: s});
  }

  if (/ครอบครัว|บุตร|ลูก|คู่สมรส|พ่อแม่|ประกันสังคม|กองทุน|rmf|ssf|กบข|pvd|ช้อป|ต่างประเทศ|ฟรีแลนซ์|ธุรกิจ|ค่าเช่า|2 เท่า|สองเท่า|e-?donation|ออกจากงาน|รองรับ/i.test(t))
    return reply(`ระบบรองรับเฉพาะเงินเดือน/โบนัส ม.40(1) ปีภาษี 2568 กับสิทธิ: ประกันชีวิต ประกันสุขภาพ ดอกเบี้ยที่อยู่อาศัย และบริจาคทั่วไป\n\nยังไม่รองรับ: ${ruleset.unsupported.join('; ')}\n\nหากคุณมีรายการเหล่านี้ ให้ตรวจกับเครื่องมือของกรมสรรพากรเพิ่มเติม: ${sources[3].url}`);

  if (/ประกันสุขภาพ/.test(t)) return reply(`ประกันสุขภาพตนเอง หักตามจริงไม่เกิน ฿${baht(rule('health').cap)} และเมื่อรวมกับประกันชีวิตต้องไม่เกิน ฿${baht(rule('health').combinedCap)}\nเงื่อนไข: ${categories.health.condition}`);
  if (/ประกันชีวิต/.test(t)) return reply(`ประกันชีวิตตามเงื่อนไข หักตามจริงไม่เกิน ฿${baht(rule('life').cap)}\nเงื่อนไข: ${categories.life.condition}`);
  if (/ดอกเบี้ย|ที่อยู่อาศัย|ผ่อนบ้าน|กู้บ้าน/.test(t)) return reply(`ดอกเบี้ยกู้ที่อยู่อาศัย หักตามจริงไม่เกิน ฿${baht(rule('mortgage').cap)} (กู้ร่วมต้องแบ่งสิทธิ)\nเงื่อนไข: ${categories.mortgage.condition}`);
  if (/บริจาค/.test(t)) return reply(`บริจาคทั่วไป หักตามจริงแต่ไม่เกิน ${rule('donation').rate * 100}% ของเงินได้หลังหักค่าใช้จ่ายและค่าลดหย่อนอื่น\nเงื่อนไข: ${categories.donation.condition}`);
  if (/ส่วนตัว|ค่าลดหย่อน|ลดหย่อน/.test(t)) return reply(`ค่าลดหย่อนที่ระบบนับ: ส่วนตัว ฿${baht(rule('personal').amount)}, ประกันชีวิต ≤฿${baht(rule('life').cap)}, ประกันสุขภาพ ≤฿${baht(rule('health').cap)} (รวมชีวิต ≤฿${baht(rule('health').combinedCap)}), ดอกเบี้ยบ้าน ≤฿${baht(rule('mortgage').cap)}, บริจาคทั่วไป ≤${rule('donation').rate * 100}% ของฐาน เฉพาะบิลที่เจ้าของยืนยันแล้ว`);
  if (/ค่าใช้จ่าย|50%/.test(t)) return reply(`เงินเดือน ม.40(1) หักค่าใช้จ่าย ${rule('expense').rate * 100}% ไม่เกิน ฿${baht(rule('expense').cap)}`);
  if (/ขั้นบันได|อัตราภาษี|อัตรา/.test(t)) {
    const r = rule('progressive'); let lower = 0;
    const rows = r.limits.map((u, i) => { const row = `${baht(lower)}–${u === null ? 'ขึ้นไป' : baht(u)}: ${r.rates[i] * 100}%`; lower = u; return row; });
    return reply('อัตราภาษีขั้นบันไดปี 2568 (เงินได้สุทธิ บาท)\n' + rows.join('\n'));
  }
  return null;
}
