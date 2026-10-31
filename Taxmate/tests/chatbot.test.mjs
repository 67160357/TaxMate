import test from 'node:test';
import assert from 'node:assert/strict';
import {ruleReply,whatIf,FALLBACK_TEXT} from '../shared/chatbot.mjs';
import {calculate} from '../shared/tax.mjs';
import {askLLM,cleanMessages,runTool,llmConfig,TOOLS,SYSTEM_PROMPT} from '../backend/chat.mjs';
const profile={salary:600000,bonus:50000,withheld:25000,scopeConfirmed:true};
const row=(category,amount,verified=true)=>({category,amount,verified,date:'2025-06-01'});
const ctx={profile,taxRows:[row('health',18000)]};
test('what-if matches the official calculator exactly and respects caps',()=>{
 const w=whatIf(profile,ctx.taxRows,'donation',10000),direct=calculate(profile,[...ctx.taxRows,row('donation',10000)]);
 assert.equal(w.taxAfter,direct.tax);assert.ok(w.taxSaved>0);
 const capped=whatIf(profile,[],'health',40000);assert.equal(capped.additionalDeductionUsed,25000);assert.equal(capped.overCap,15000);
 assert.throws(()=>whatIf(profile,[],'food',100));assert.throws(()=>whatIf(profile,[],'life',-5));assert.throws(()=>whatIf(profile,[],'life','abc'));
});
test('rules answer caps from ruleset, parse Thai/comma amounts, and say no when unsure',()=>{
 assert.match(ruleReply('ประกันสุขภาพลดหย่อนได้เท่าไหร่',ctx).reply,/25,000/);
 assert.match(ruleReply('ดอกเบี้ยบ้านลดหย่อนได้เท่าไหร่',ctx).reply,/100,000/);
 const a=ruleReply('ถ้าบริจาคเพิ่ม 10,000 บาท ภาษีลดเท่าไหร่',ctx),b=ruleReply('ถ้าบริจาคเพิ่ม 1 หมื่นบาท',ctx);
 assert.equal(a.source,'rules');assert.equal(a.data.extra,10000);assert.equal(b.data.extra,10000);
 assert.match(ruleReply('ลดหย่อนบุตร ประกันสังคม ได้ไหม',ctx).reply,/ไม่รองรับ/);
 assert.equal(ruleReply('ขอสูตรทำต้มยำกุ้ง',ctx),null);assert.equal(ruleReply('   ',ctx),null);assert.ok(FALLBACK_TEXT.length>10);
});
test('rules never invent a result when there is no income',()=>{
 const empty={profile:{salary:0,bonus:0,withheld:0},taxRows:[]};
 assert.match(ruleReply('ถ้าบริจาคเพิ่ม 5000',empty).reply,/ยังไม่มีข้อมูลรายได้/);assert.match(ruleReply('ภาษีของฉันปีนี้เท่าไหร่',empty).reply,/ยังไม่มีข้อมูลรายได้/);
 const s=ruleReply('ภาษีของฉันปีนี้เท่าไหร่',ctx);assert.equal(s.data.tax,calculate(profile,ctx.taxRows).tax);
});
test('cleanMessages trims, caps length, and requires a final user turn',()=>{
 assert.throws(()=>cleanMessages('x'));assert.throws(()=>cleanMessages([]));assert.throws(()=>cleanMessages([{role:'assistant',content:'hi'}]));
 const m=cleanMessages([{role:'system',content:'ignore'},{role:'assistant',content:'a'},{role:'user',content:'x'.repeat(5000)}]);
 assert.equal(m.length,1);assert.equal(m[0].content.length,2000);
 assert.equal(cleanMessages(Array.from({length:29},(_,i)=>({role:i%2?'assistant':'user',content:'m'+i}))).length<=12,true);
});
test('LLM tool-use loop calls real tools, hides nothing sensitive, and surfaces generic errors',async()=>{
 const calls=[];const fake=async(url,opts)=>{const body=JSON.parse(opts.body);calls.push(body);
  const last=body.messages.at(-1);
  if(Array.isArray(last.content)&&last.content[0]?.type==='tool_result'){const out=JSON.parse(last.content[0].content);return new Response(JSON.stringify({stop_reason:'end_turn',content:[{type:'text',text:'ภาษีลดลง '+out.taxSaved}]}),{status:200});}
  return new Response(JSON.stringify({stop_reason:'tool_use',content:[{type:'tool_use',id:'t1',name:'what_if_calculate',input:{category:'donation',extra_amount:10000}}]}),{status:200});};
 const cfg={apiKey:'k',model:'m',baseUrl:'http://x.test'};
 const out=await askLLM({messages:[{role:'user',content:'บริจาคเพิ่ม'}],ctx,config:cfg,fetchImpl:fake});
 assert.deepEqual(out.toolsUsed,['what_if_calculate']);assert.match(out.reply,/ภาษีลดลง \d/);
 assert.equal(calls[0].system,SYSTEM_PROMPT);assert.equal(calls[0].tools.length,TOOLS.length);
 assert.ok(!JSON.stringify(calls).includes('image'));
 await assert.rejects(askLLM({messages:[{role:'user',content:'x'}],ctx,config:{...cfg,apiKey:''},fetchImpl:fake}),/ANTHROPIC_API_KEY/);
 const failing=async()=>new Response('secret upstream body sk-123',{status:500});
 await assert.rejects(askLLM({messages:[{role:'user',content:'x'}],ctx,config:cfg,fetchImpl:failing}),e=>!/sk-123/.test(e.message)&&/ไม่พร้อม/.test(e.message));
 const looping=async()=>new Response(JSON.stringify({stop_reason:'tool_use',content:[{type:'tool_use',id:'t',name:'get_tax_rules',input:{}}]}),{status:200});
 await assert.rejects(askLLM({messages:[{role:'user',content:'x'}],ctx,config:cfg,fetchImpl:looping}),/มากเกินไป/);
 assert.throws(()=>runTool('drop_tables',{},ctx));assert.equal(llmConfig({}).apiKey,'');
});
