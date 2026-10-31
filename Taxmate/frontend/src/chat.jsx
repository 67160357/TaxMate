import React,{useEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {MessageCircle,X,SendHorizontal,Info,UserRound} from 'lucide-react';
import {api} from './data';
import {ruleReply,FALLBACK_TEXT,SUGGESTIONS} from '../../shared/chatbot.mjs';
// Automatic helper: fixed rules only, computed on this device. No AI service, nothing is sent anywhere.
const GREETING={role:'assistant',content:'สวัสดีครับ ผมคือผู้ช่วยอัตโนมัติของ Taxmate ถามเรื่องเพดานลดหย่อน สรุปภาษีของคุณ หรือลองจำลองว่า "ถ้าบริจาคเพิ่ม 10,000 บาท" ได้เลย ส่วนเรื่องเฉพาะตัว คุยกับผู้เชี่ยวชาญได้ที่เมนู "ค้นหาผู้เชี่ยวชาญ"'};
export function ChatWidget({data}){
  const[open,setOpen]=useState(false),[msgs,setMsgs]=useState([GREETING]),[text,setText]=useState(''),end=useRef(),input=useRef(),{pathname}=useLocation();
  useEffect(()=>{end.current?.scrollIntoView({block:'end'});},[msgs,open]);
  useEffect(()=>{if(!open)return;input.current?.focus();const esc=e=>{if(e.key==='Escape')setOpen(false);};window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc);},[open]);
  function send(raw){
    const q=String(raw??text).trim().slice(0,500);if(!q)return;
    const r=ruleReply(q,{profile:data.profile,taxRows:data.taxRows||data.receipts});
    setMsgs(m=>[...m,{role:'user',content:q},{role:'assistant',content:r?r.reply:FALLBACK_TEXT,fallback:!r,suggestions:r?.suggestions}]);setText('');
  }
  return <>
    {!open&&!pathname.startsWith('/messages')&&<button className="chat-fab" onClick={()=>setOpen(true)} aria-label="เปิดผู้ช่วยอัตโนมัติ"><MessageCircle size={24}/><span>ถามผู้ช่วย</span></button>}
    {open&&<section className="chat-panel" role="dialog" aria-label="ผู้ช่วยอัตโนมัติ Taxmate">
      <header><div><strong>ผู้ช่วยอัตโนมัติ</strong><small>ตอบจากกฎภาษีปี 2568 • ทำงานบนเครื่องคุณ</small></div><button className="icon-button" onClick={()=>setOpen(false)} aria-label="ปิดแชท"><X size={19}/></button></header>
      <div className="chat-log" aria-live="polite">
        {msgs.map((m,i)=><div key={i} className={`chat-msg ${m.role}`}><p>{m.content}</p>
          {m.fallback&&<Link className="chat-link" to="/experts" onClick={()=>setOpen(false)}><UserRound size={14}/>คุยกับผู้เชี่ยวชาญ</Link>}
          {m.suggestions&&<div className="chat-chips">{m.suggestions.map(s=><button key={s} onClick={()=>send(s)}>{s}</button>)}</div>}</div>)}
        {msgs.length===1&&<div className="chat-chips">{SUGGESTIONS.map(s=><button key={s} onClick={()=>send(s)}>{s}</button>)}</div>}
        <div ref={end}/>
      </div>
      <p className="chat-note"><Info size={13}/>ประมาณการเพื่อเตรียมข้อมูล ไม่ใช่คำแนะนำภาษีหรือการยื่นแบบ</p>
      <form onSubmit={e=>{e.preventDefault();send();}}><input ref={input} value={text} maxLength={500} onChange={e=>setText(e.target.value)} placeholder="พิมพ์คำถามเกี่ยวกับภาษีปี 2568" aria-label="ข้อความถึงผู้ช่วย"/><button className="button" disabled={!text.trim()} aria-label="ส่ง"><SendHorizontal size={18}/></button></form>
    </section>}
  </>;
}
