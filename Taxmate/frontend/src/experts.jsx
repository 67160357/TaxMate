import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {Search,SendHorizontal,LoaderCircle,Info,ArrowLeft,MessageCircle,Check,UserRound} from 'lucide-react';
import {api} from './data';
const when=t=>new Date(t).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'});
const Head=({title,children})=><div className="page-head"><div><p className="eyebrow">TAXMATE WORKSPACE</p><h1>{title}</h1><p>{children}</p></div></div>;
const ErrorText=({text})=>text?<div role="alert" className="alert error">{text}</div>:null;
const LocalOnly=()=><div className="alert">ฟังก์ชันนี้ใช้กับ Local API เพื่อบังคับสิทธิ์จาก backend เปิดผ่าน run-local แล้วเข้าสู่บัญชีส่วนตัว · GitHub Pages เป็นสาธิตบนเบราว์เซอร์</div>;
const Unverified=()=><div className="alert"><Info size={18}/><span>คุณวุฒิและประสบการณ์เป็นข้อมูลที่ผู้เชี่ยวชาญแจ้งเอง Taxmate <strong>ยังไม่ได้ตรวจสอบ</strong>ใบอนุญาตหรือวุฒิการศึกษา โปรดตรวจสอบเองก่อนตัดสินใจ และไม่ควรส่งเลขบัตรประชาชน เลขบัญชี หรือรหัสผ่านในแชท</span></div>;
const fire=()=>window.dispatchEvent(new Event('taxmate:unread'));

/** Unread badge for the sidebar; refreshes every 20s and on 'taxmate:unread'. */
export function useUnread(user){
  const[n,setN]=useState(0);
  useEffect(()=>{
    if(!user||api.mode!=='local'||user.demo){setN(0);return;}
    let live=true;const tick=()=>{if(document.hidden)return;api.request('/conversations/unread').then(d=>live&&setN(d.count)).catch(()=>{});};
    tick();const t=setInterval(tick,20000);window.addEventListener('taxmate:unread',tick);
    return()=>{live=false;clearInterval(t);window.removeEventListener('taxmate:unread',tick);};
  },[user?.id]);
  return n;
}

function Chips({items}){return items?.length?<div className="chip-list">{items.map(s=><span key={s} className="chip">{s}</span>)}</div>:null}

export function ExpertDirectory(){
  const[q,setQ]=useState(''),[specialty,setSpecialty]=useState(''),[accepting,setAccepting]=useState(false),[page,setPage]=useState(1),[data,setData]=useState(null),[error,setError]=useState('');
  useEffect(()=>{
    if(api.mode!=='local')return;let live=true;
    const t=setTimeout(()=>{const p={page,pageSize:12};if(q.trim())p.q=q.trim();if(specialty)p.specialty=specialty;if(accepting)p.accepting='1';
      api.request('/expert-directory?'+new URLSearchParams(p)).then(d=>{if(live){setData(d);setError('');}}).catch(e=>live&&setError(e.message));},250);
    return()=>{live=false;clearTimeout(t);};
  },[q,specialty,accepting,page]);
  if(api.mode!=='local')return <><Head title="ค้นหาผู้เชี่ยวชาญ"/><LocalOnly/></>;
  return <>
    <Head title="ค้นหาผู้เชี่ยวชาญ">เลือกผู้เชี่ยวชาญที่ตรงกับเรื่องของคุณ แล้วเริ่มแชทได้ทันที</Head>
    <Unverified/>
    <div className="filter-row">
      <label className="search-box"><Search size={17}/><input aria-label="ค้นหาชื่อหรือหัวข้อ" placeholder="ค้นหาชื่อหรือหัวข้อ" value={q} onChange={e=>{setQ(e.target.value);setPage(1);}}/></label>
      <select aria-label="ความเชี่ยวชาญ" value={specialty} onChange={e=>{setSpecialty(e.target.value);setPage(1);}}><option value="">ทุกความเชี่ยวชาญ</option>{(data?.specialties||[]).map(s=><option key={s}>{s}</option>)}</select>
      <label className="checkbox-label"><input type="checkbox" checked={accepting} onChange={e=>{setAccepting(e.target.checked);setPage(1);}}/><span>เฉพาะที่รับผู้ปรึกษาใหม่</span></label>
    </div>
    <ErrorText text={error}/>
    {!data?<div className="loading"><LoaderCircle className="spin"/>กำลังโหลด…</div>:!data.items.length?<div className="empty"><UserRound size={34}/><h3>ยังไม่พบผู้เชี่ยวชาญ</h3><p>ลองเปลี่ยนคำค้นหา หรือรอให้ผู้เชี่ยวชาญเผยแพร่โปรไฟล์</p></div>:
    <div className="expert-grid">{data.items.map(e=><Link key={e.id} to={`/experts/${e.id}`} className="card card-padding expert-card">
      <div className="expert-top"><span className="avatar">{e.name.slice(0,1)}</span><div><h3>{e.name}</h3><small className="muted">{e.experienceYears>0?`ประสบการณ์ ${e.experienceYears} ปี`:'ผู้เชี่ยวชาญ'}</small></div></div>
      <p className="expert-headline">{e.headline}</p><Chips items={e.specialties}/><p className="muted expert-bio">{e.bio}{e.bio.length>=160?'…':''}</p>
      <span className={`badge ${e.accepting?'eligible':'review'}`}>{e.accepting?'รับผู้ปรึกษาใหม่':'ไม่รับรายใหม่ชั่วคราว'}</span></Link>)}</div>}
    {data&&data.pages>1&&<div className="table-footer"><span>{data.total} คน · หน้า {data.page}/{data.pages}</span><div className="button-row"><button className="button secondary" disabled={page<=1} onClick={()=>setPage(page-1)}>ก่อนหน้า</button><button className="button secondary" disabled={page>=data.pages} onClick={()=>setPage(page+1)}>ถัดไป</button></div></div>}
  </>;
}

export function ExpertProfilePage({user}){
  const{id}=useParams(),nav=useNavigate(),[p,setP]=useState(null),[msg,setMsg]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(api.mode!=='local')return;setP(null);api.request('/experts/'+id).then(setP).catch(e=>setError(e.message));},[id]);
  if(api.mode!=='local')return <><Head title="โปรไฟล์ผู้เชี่ยวชาญ"/><LocalOnly/></>;
  async function start(e){e.preventDefault();setBusy(true);setError('');try{const r=await api.request('/conversations','POST',{expertId:id,message:msg});fire();nav('/messages/'+r.conversationId);}catch(err){setError(err.message);setBusy(false);}}
  const self=user.id===id;
  return <>
    <Link className="text-link" to="/experts"><ArrowLeft size={16}/>กลับรายชื่อผู้เชี่ยวชาญ</Link>
    <ErrorText text={error}/>
    {!p?!error&&<div className="loading"><LoaderCircle className="spin"/>กำลังโหลด…</div>:<div className="expert-detail">
      <section className="card card-padding">
        <div className="expert-top"><span className="avatar big">{p.name.slice(0,1)}</span><div><h1>{p.name}</h1><p className="expert-headline">{p.headline}</p></div></div>
        <Chips items={p.specialties}/>
        <h2>แนะนำตัว</h2><p className="preserve-lines">{p.bio}</p>
        <dl className="facts"><div><dt>ประสบการณ์</dt><dd>{p.experienceYears} ปี</dd></div>{p.languages.length>0&&<div><dt>ภาษา</dt><dd>{p.languages.join(', ')}</dd></div>}{p.availability&&<div><dt>ช่วงเวลาที่ตอบ</dt><dd>{p.availability}</dd></div>}{p.credentials&&<div><dt>คุณวุฒิ/ประสบการณ์ (แจ้งเอง)</dt><dd className="preserve-lines">{p.credentials}</dd></div>}</dl>
        <Unverified/>
      </section>
      <aside className="card card-padding">
        <h2>เริ่มคุยกับผู้เชี่ยวชาญ</h2>
        {self?<p className="muted">นี่คือโปรไฟล์ของคุณเอง</p>:user.demo?<div className="alert">บัญชีสาธิตใช้ร่วมกันหลายคน กรุณาสมัครบัญชีส่วนตัวก่อนแชท</div>:
        <form onSubmit={start}>
          <label className="field"><span>ข้อความแรก</span><textarea required rows={5} maxLength={2000} value={msg} onChange={e=>setMsg(e.target.value)} placeholder="เล่าเรื่องที่อยากปรึกษาโดยย่อ เช่น ประกันสุขภาพของพ่อแม่ใช้ลดหย่อนได้ไหม"/><small>{msg.length}/2000 · อย่าใส่เลขบัตรประชาชน เลขบัญชี หรือรหัสผ่าน</small></label>
          <button className="button" disabled={busy||!msg.trim()}>{busy?<LoaderCircle className="spin" size={17}/>:<MessageCircle size={17}/>}ส่งข้อความและเริ่มแชท</button>
          {!p.accepting&&<p className="muted small-note">ผู้เชี่ยวชาญไม่รับรายใหม่ชั่วคราว หากเคยคุยกันแล้วจะส่งต่อในบทสนทนาเดิมได้</p>}
        </form>}
        <p className="muted small-note">ต้องการให้ตรวจบิลเฉพาะใบ? ใช้เมนู "ส่งบิลให้ตรวจ" เพื่อเปิดสิทธิ์ให้อ่านเฉพาะบิลนั้น</p>
      </aside>
    </div>}
  </>;
}

export function MyExpertProfile({notify}){
  const[f,setF]=useState(null),[langs,setLangs]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(api.mode!=='local')return;api.request('/expert-profile').then(p=>{setF(p);setLangs(p.languages.join(', '));}).catch(e=>setError(e.message));},[]);
  if(api.mode!=='local')return <><Head title="โปรไฟล์ผู้เชี่ยวชาญ"/><LocalOnly/></>;
  if(!f)return <><Head title="โปรไฟล์ผู้เชี่ยวชาญ"/><ErrorText text={error}/>{!error&&<div className="loading"><LoaderCircle className="spin"/>กำลังโหลด…</div>}</>;
  const set=(k,v)=>setF({...f,[k]:v}),toggle=s=>set('specialties',f.specialties.includes(s)?f.specialties.filter(x=>x!==s):[...f.specialties,s]);
  async function save(e){e.preventDefault();setBusy(true);setError('');try{const body={...f,languages:langs.split(',').map(x=>x.trim()).filter(Boolean),experienceYears:Number(f.experienceYears)};const p=await api.request('/expert-profile','PUT',body);setF({...p,specialtyOptions:f.specialtyOptions});setLangs(p.languages.join(', '));notify(p.published?'บันทึกและเผยแพร่โปรไฟล์แล้ว':'บันทึกฉบับร่างแล้ว');}catch(err){setError(err.message);}finally{setBusy(false);}}
  return <>
    <Head title="โปรไฟล์ผู้เชี่ยวชาญของฉัน">ข้อมูลนี้จะแสดงให้ผู้ใช้ที่ล็อกอินเห็นเมื่อคุณเผยแพร่ ไม่แสดงอีเมลของคุณ</Head>
    {f.hidden&&<div className="alert error" role="alert">ผู้ดูแลระบบซ่อนโปรไฟล์ของคุณจากรายชื่อ ผู้ใช้ใหม่จะค้นหาและเริ่มแชทไม่ได้ กรุณาติดต่อผู้ดูแลระบบ</div>}
    <ErrorText text={error}/>
    <form className="card card-padding manage-editor" onSubmit={save}>
      <label className="field"><span>หัวข้อแนะนำตัว (ไม่เกิน 120 ตัวอักษร)</span><input maxLength={120} value={f.headline} onChange={e=>set('headline',e.target.value)} placeholder="เช่น อดีตเจ้าหน้าที่สรรพากร เชี่ยวชาญภาษีเงินเดือน"/></label>
      <label className="field"><span>แนะนำตัวและแนวทางให้คำปรึกษา</span><textarea rows={6} maxLength={2000} value={f.bio} onChange={e=>set('bio',e.target.value)}/><small>{f.bio.length}/2000 · ต้องมีอย่างน้อย 20 ตัวอักษรเพื่อเผยแพร่</small></label>
      <fieldset className="field"><span>ความเชี่ยวชาญ (เลือกได้ไม่เกิน 6)</span><div className="check-grid">{f.specialtyOptions.map(s=><label key={s} className="checkbox-label"><input type="checkbox" checked={f.specialties.includes(s)} onChange={()=>toggle(s)}/><span>{s}</span></label>)}</div></fieldset>
      <div className="two-col">
        <label className="field"><span>ประสบการณ์ (ปี)</span><input type="number" min="0" max="60" step="1" value={f.experienceYears} onChange={e=>set('experienceYears',e.target.value)}/></label>
        <label className="field"><span>ภาษา (คั่นด้วย ,)</span><input value={langs} onChange={e=>setLangs(e.target.value)} placeholder="ไทย, English"/></label>
      </div>
      <label className="field"><span>คุณวุฒิ/ประสบการณ์ (แจ้งเอง ไม่เกิน 300 ตัวอักษร)</span><textarea rows={3} maxLength={300} value={f.credentials} onChange={e=>set('credentials',e.target.value)}/><small>ระบบจะแสดงข้อความว่า "ยังไม่ได้ตรวจสอบ" ข้างข้อมูลนี้เสมอ อย่าอ้างใบอนุญาตที่คุณไม่มี</small></label>
      <label className="field"><span>ช่วงเวลาที่มักตอบ</span><input maxLength={200} value={f.availability} onChange={e=>set('availability',e.target.value)} placeholder="เช่น วันธรรมดา 18:00–20:00"/></label>
      <label className="checkbox-label"><input type="checkbox" checked={f.accepting} onChange={e=>set('accepting',e.target.checked)}/><span>รับผู้ปรึกษารายใหม่</span></label>
      <label className="checkbox-label"><input type="checkbox" checked={f.published} onChange={e=>set('published',e.target.checked)}/><span><strong>เผยแพร่โปรไฟล์</strong> ให้ผู้ใช้ค้นหาและเริ่มแชทได้ (ไม่ติ๊ก = ฉบับร่าง)</span></label>
      <div className="button-row"><button className="button" disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:<Check size={17}/>}บันทึกโปรไฟล์</button>{f.published&&!f.hidden&&<Link className="button secondary" to={`/experts/${f.id}`}>ดูหน้าที่ผู้ใช้เห็น</Link>}</div>
    </form>
  </>;
}

export function Messages({user,notify}){
  const{id}=useParams(),nav=useNavigate();
  const[list,setList]=useState({items:[],total:0}),[thread,setThread]=useState(null),[text,setText]=useState(''),[error,setError]=useState(''),[sending,setSending]=useState(false);
  const lastId=useRef(0),box=useRef(),stick=useRef(true);
  const loadList=useCallback(()=>api.request('/conversations?pageSize=50').then(setList).catch(e=>setError(e.message)),[]);
  useEffect(()=>{if(api.mode!=='local')return;loadList();const t=setInterval(()=>{if(!document.hidden)loadList();},15000);return()=>clearInterval(t);},[loadList]);
  useEffect(()=>{
    if(api.mode!=='local'||!id){setThread(null);return;}
    let live=true;lastId.current=0;stick.current=true;setThread(null);setError('');
    api.request(`/conversations/${id}/messages`).then(d=>{if(!live)return;setThread(d);lastId.current=d.items.at(-1)?.id||0;fire();loadList();}).catch(e=>live&&setError(e.message));
    const t=setInterval(()=>{if(document.hidden)return;api.request(`/conversations/${id}/messages?after=${lastId.current}`).then(d=>{if(!live)return;
      setThread(old=>old?{...old,conversation:d.conversation,items:[...old.items,...d.items.filter(m=>!old.items.some(x=>x.id===m.id))]}:old);
      if(d.items.length){lastId.current=Math.max(lastId.current,d.items.at(-1).id);if(d.items.some(m=>!m.mine)){fire();loadList();}}}).catch(()=>{});},4000);
    return()=>{live=false;clearInterval(t);};
  },[id,loadList]);
  useEffect(()=>{const el=box.current;if(el&&stick.current)el.scrollTop=el.scrollHeight;},[thread?.items.length]);
  if(api.mode!=='local')return <><Head title="ข้อความ"/><LocalOnly/></>;
  async function older(){const first=thread.items[0]?.id;if(!first)return;try{const d=await api.request(`/conversations/${id}/messages?before=${first}`);stick.current=false;setThread(t=>({...t,items:[...d.items,...t.items],hasMore:d.hasMore}));}catch(e){setError(e.message);}}
  async function send(e){e?.preventDefault();const body=text.trim();if(!body||sending)return;setSending(true);setError('');
    try{const m=await api.request(`/conversations/${id}/messages`,'POST',{body});stick.current=true;lastId.current=Math.max(lastId.current,m.id);setThread(t=>({...t,items:t.items.some(x=>x.id===m.id)?t.items:[...t.items,m]}));setText('');loadList();}
    catch(err){setError(err.message);}finally{setSending(false);}}
  const onScroll=e=>{const el=e.currentTarget;stick.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;};
  return <>
    <Head title="ข้อความ">คุยกับผู้เชี่ยวชาญแบบตัวต่อตัว ผู้ดูแลระบบไม่มีเมนูอ่านข้อความของคุณ</Head>
    <ErrorText text={error}/>
    <div className={`msg-layout ${id?'has-thread':''}`}>
      <aside className="card msg-list" aria-label="รายการบทสนทนา">
        {!list.items.length?<div className="empty small"><MessageCircle/><p>ยังไม่มีบทสนทนา</p><Link className="text-link" to="/experts">ค้นหาผู้เชี่ยวชาญ</Link></div>:
        list.items.map(c=><button key={c.id} className={`msg-item ${c.id===id?'active':''}`} onClick={()=>nav('/messages/'+c.id)}>
          <span className="avatar">{c.otherName.slice(0,1)}</span>
          <span className="msg-meta"><strong>{c.otherName}{c.asRole==='expert'&&<small> · ผู้ปรึกษา</small>}</strong><small>{c.lastBody}</small></span>
          <span className="msg-side"><small>{when(c.lastMessageAt)}</small>{c.unread>0&&<span className="nav-count">{c.unread}</span>}</span></button>)}
      </aside>
      <section className="card msg-thread">
        {!id?<div className="empty"><MessageCircle size={34}/><h3>เลือกบทสนทนา</h3><p>หรือไปที่ "ค้นหาผู้เชี่ยวชาญ" เพื่อเริ่มคุยใหม่</p></div>:!thread?<div className="loading"><LoaderCircle className="spin"/>กำลังโหลด…</div>:<>
          <header className="thread-head"><button className="icon-button back-btn" onClick={()=>nav('/messages')} aria-label="กลับ"><ArrowLeft/></button><div><strong>{thread.conversation.other.name}</strong>{thread.conversation.other.headline&&<small>{thread.conversation.other.headline}</small>}</div></header>
          <div className="thread-note"><Info size={14}/>ข้อความเก็บในฐานข้อมูลของระบบนี้ ไม่ได้เข้ารหัสแบบ end-to-end อย่าส่งเลขบัตรประชาชน เลขบัญชี หรือรหัสผ่าน</div>
          <div className="thread-log" ref={box} onScroll={onScroll} aria-live="polite">
            {thread.hasMore&&<button className="text-button" onClick={older}>โหลดข้อความเก่า</button>}
            {thread.items.map(m=><div key={m.id} className={`bubble ${m.mine?'mine':'theirs'}`}><p>{m.body}</p><small>{when(m.createdAt)}</small></div>)}
          </div>
          {thread.conversation.canSend?<form className="thread-form" onSubmit={send}><textarea rows={2} maxLength={2000} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send();}}} placeholder="พิมพ์ข้อความ (Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่)" aria-label="ข้อความ"/><button className="button" disabled={sending||!text.trim()} aria-label="ส่ง"><SendHorizontal size={18}/></button></form>
          :<div className="alert">บทสนทนานี้ปิดแล้ว (ผู้เชี่ยวชาญไม่ได้เปิดใช้งาน) อ่านย้อนหลังได้เท่านั้น</div>}
        </>}
      </section>
    </div>
  </>;
}

export function AdminExperts({notify}){
  const[d,setD]=useState({items:[],total:0}),[error,setError]=useState(''),[tick,setTick]=useState(0);
  useEffect(()=>{if(api.mode!=='local')return;api.request('/admin/expert-profiles?pageSize=100').then(setD).catch(e=>setError(e.message));},[tick]);
  if(api.mode!=='local')return <><Head title="โปรไฟล์ผู้เชี่ยวชาญ"/><LocalOnly/></>;
  async function hide(x,hidden){try{await api.request('/admin/expert-profiles/'+x.id,'PUT',{hidden});setTick(v=>v+1);notify(hidden?'ซ่อนโปรไฟล์แล้ว':'แสดงโปรไฟล์แล้ว');}catch(e){setError(e.message);}}
  return <>
    <Head title="ดูแลโปรไฟล์ผู้เชี่ยวชาญ">ซ่อนโปรไฟล์ที่ไม่เหมาะสมจากรายชื่อสาธารณะ ผู้ดูแลอ่านข้อความแชทไม่ได้ หากต้องการหยุดใช้งานเต็มรูปแบบให้ปิดบัญชีที่หน้าจัดการผู้ใช้</Head>
    <ErrorText text={error}/>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>ชื่อ</th><th>หัวข้อ</th><th>คุณวุฒิ (แจ้งเอง)</th><th>สถานะ</th><th></th></tr></thead><tbody>
      {d.items.map(x=><tr key={x.id}><td>{x.name}<br/><small className="muted">@{x.username}{x.status!=='active'?' · ปิดบัญชี':''}</small></td><td>{x.headline||'—'}</td><td>{x.credentials||'—'}</td><td>{x.hidden?'ซ่อนโดยแอดมิน':x.published?'เผยแพร่':'ฉบับร่าง'}</td><td><button className="button secondary" onClick={()=>hide(x,!x.hidden)}>{x.hidden?'แสดงอีกครั้ง':'ซ่อน'}</button></td></tr>)}
      {!d.items.length&&<tr><td colSpan="5" className="muted">ยังไม่มีผู้เชี่ยวชาญ (กำหนดบทบาทที่หน้าจัดการผู้ใช้)</td></tr>}
    </tbody></table></div></section>
  </>;
}
