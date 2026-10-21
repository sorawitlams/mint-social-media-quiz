/* Mint's Crisis Exam Coach — vanilla JS, no backend. Data in window.DATA */
(function(){
'use strict';
const D = window.DATA;
const CH = D.chapters;                       // [{ch,title,short,summary,cards}]
const Q = D.questions;                       // [{id,ch,lv,sc,lo,q,c,ex,w,pg,ev}]  c[0] is correct in source
const QBY = Object.fromEntries(Q.map(q=>[q.id,q]));
const KEYS = ['ก','ข','ค','ง'];
const LV = {1:'จำ/เข้าใจ',2:'แยกแยะแนวคิด',3:'ประยุกต์/สถานการณ์'};
const STORE_KEY = (D.meta.storeKey||'mintcc_v1');
const $app = document.getElementById('app');
const $nav = document.getElementById('navbar');

// ---------- storage (try/catch, works without storage) ----------
let S = {stats:{}, mistakes:{}, minutes:null, session:null, theme:null};
try{ const raw = localStorage.getItem(STORE_KEY); if(raw){ S = Object.assign(S, JSON.parse(raw)); } }catch(e){}
function save(){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(S)); }catch(e){} }
if(S.theme) document.documentElement.setAttribute('data-theme', S.theme);

// ---------- helpers ----------
const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function chTitle(n){ const c=CH.find(x=>x.ch===n); return c?c.title:''; }
function chStats(n){ let a=0,c=0,seen=0; Q.filter(q=>q.ch===n).forEach(q=>{const s=S.stats[q.id]; if(s){a+=s.a;c+=s.c;seen++;}}); return {a,c,seen,total:Q.filter(q=>q.ch===n).length,acc:a?c/a:null}; }
function overall(){ let a=0,c=0,seen=0; Q.forEach(q=>{const s=S.stats[q.id]; if(s){a+=s.a;c+=s.c;seen++;}}); return {a,c,seen,acc:a?c/a:null}; }
function pct(x){ return x==null?'–':Math.round(x*100)+'%'; }
function barColor(x){ return x==null?'var(--line)': x>=.8?'var(--ok)': x>=.6?'var(--warn)':'var(--bad)'; }
function weakChapters(k){
  return CH.map(c=>({ch:c.ch,s:chStats(c.ch)}))
    .sort((x,y)=>{ const ax=x.s.acc==null?-1:x.s.acc, ay=y.s.acc==null?-1:y.s.acc; return ax-ay; })
    .slice(0,k).map(x=>x.ch);
}
function record(id, ok){
  const s = S.stats[id] || {a:0,c:0};
  s.a++; if(ok) s.c++; s.last = ok?1:0; S.stats[id]=s;
  if(ok) delete S.mistakes[id]; else S.mistakes[id]=Date.now();
}
function weightedPick(pool, n){
  const items = pool.map(q=>{ const s=S.stats[q.id]; const wr = s? (1 - s.c/s.a):0.6; const w = 1 + 2.5*wr + (S.mistakes[q.id]?1.5:0); return {q, k: Math.pow(Math.random(), 1/w)}; });
  return items.sort((a,b)=>b.k-a.k).slice(0,n).map(x=>x.q);
}

// ---------- session ----------
function startSession(opts){
  const ids = opts.ids;
  const order = {}; ids.forEach(id=>order[id]=shuffle([0,1,2,3]));
  S.session = { mode:opts.mode, title:opts.title, ids, order, idx:0, ans:{}, sub:{}, skip:{}, feedback:opts.feedback,
    endAt: opts.minutes? Date.now()+opts.minutes*60000 : null, minutes: opts.minutes||null, finished:false, started:Date.now(), back: opts.back||'#/' };
  save(); location.hash = '#/quiz'; render();
}
function finishSession(){
  const s=S.session; if(!s||s.finished) return;
  if(s.feedback==='end'){ s.ids.forEach(id=>{ if(s.ans[id]!=null){ record(id, s.ans[id]===0); } }); }
  s.finished=true; s.finishedAt=Date.now(); save(); location.hash='#/results'; render();
}

// ---------- modal ----------
function confirmBox(msg, okText, onOk){
  const bg=document.createElement('div'); bg.className='modal-bg';
  bg.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt"><p id="mt" style="font-weight:600">${msg}</p><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-x>ยกเลิก</button><button class="btn primary" data-ok>${okText}</button></div></div>`;
  document.body.appendChild(bg);
  const close=()=>bg.remove();
  bg.querySelector('[data-x]').onclick=close;
  bg.querySelector('[data-ok]').onclick=()=>{close();onOk();};
  bg.addEventListener('click',e=>{if(e.target===bg)close();});
  bg.querySelector('[data-ok]').focus();
}

// ---------- views ----------
function setNav(html){ $nav.innerHTML = html? `<div class="wrap">${html}</div>`:''; $nav.style.display = html?'block':'none'; }

function viewHome(){
  const o=overall(); const s=S.session;
  const resume = s && !s.finished ? `<div class="banner"><b>ทำค้างไว้:</b> ${esc(s.title)} — ข้อ ${s.idx+1}/${s.ids.length}<div class="row" style="margin-top:8px"><a class="btn primary sm" href="#/quiz">ทำต่อ</a><button class="btn sm ghost" id="dropS">ทิ้งชุดนี้</button></div></div>`:'';
  const mins=S.minutes;
  const mistakesN = Object.keys(S.mistakes).length;
  $app.innerHTML = `
  <h1>วันนี้อยากฝึกแบบไหน?</h1>
  <p class="muted">ข้อสอบปรนัย ${Q.length} ข้อ จาก${esc(D.meta.sourceShort)} ${CH.length} บท · ทำบนมือถือได้ · ไม่ต้องสมัคร · ความคืบหน้าเก็บในเครื่องนี้เท่านั้น</p>
  ${resume}
  <div class="card">
    <h2 style="margin-top:0">เหลือเวลาเตรียมตัวเท่าไร?</h2>
    <div class="chips" id="mins">${[30,60,120,180].map(m=>`<button class="chip" aria-pressed="${mins===m}" data-m="${m}">${m} นาที</button>`).join('')}
      <span class="row"><input class="input" id="minC" type="number" min="10" max="600" inputmode="numeric" placeholder="กำหนดเอง" value="${mins&&![30,60,120,180].includes(mins)?mins:''}" aria-label="กำหนดนาทีเอง"><button class="chip" id="minGo">ตั้งค่า</button></span></div>
    <div id="plan">${planHtml()}</div>
  </div>
  <h2>โหมดการเรียน</h2>
  <div class="grid">
    <button class="mode" data-go="diag"><span class="tag">เริ่มที่นี่</span><b>วัดความรู้ (Diagnostic)</b><span class="muted">${CH.length+2} ข้อ ครอบคลุม ${CH.length} บท · เฉลยตอนจบ · บอกบทที่อ่อน</span></button>
    <a class="mode" href="#/learn" style="text-decoration:none"><span class="tag">${CH.length} บท</span><b>เรียนตามบท</b><span class="muted">สรุปสั้น · บัตรคำ · แบบฝึกท้ายบท</span></a>
    <a class="mode" href="#/practice" style="text-decoration:none"><span class="tag">ปรนัย</span><b>ฝึกข้อสอบ (Practice)</b><span class="muted">สุ่มหลายบท 10/20/30 ข้อ · เลือกระดับ · เน้นจุดอ่อนได้</span></a>
    <button class="mode" data-go="scen"><span class="tag">สถานการณ์</span><b>Scenario Challenge</b><span class="muted">${Q.filter(q=>q.sc).length} สถานการณ์ เลือกการสื่อสารที่เหมาะสม</span></button>
    <a class="mode" href="#/mistakes" style="text-decoration:none"><span class="tag">ทบทวน</span><b>ข้อที่เคยผิด</b><span class="muted">${mistakesN? mistakesN+' ข้อรอทบทวน':'ยังไม่มี — ทำข้อสอบก่อน'}</span></a>
    <a class="mode" href="#/mock" style="text-decoration:none"><span class="tag">จับเวลา</span><b>สอบจำลอง (Mock Exam)</b><span class="muted">ตั้งจำนวนข้อ/เวลาได้ · เฉลยหลังส่ง · คะแนนแยกบท</span></a>
    <a class="mode" href="#/last" style="text-decoration:none"><span class="tag">ก่อนเข้าห้องสอบ</span><b>ทบทวนนาทีสุดท้าย</b><span class="muted">บัตรคำ + คู่แนวคิดที่สับสนง่าย</span></a>
    <a class="mode" href="#/stats" style="text-decoration:none"><span class="tag">ความคืบหน้า</span><b>ผลรายบท</b><span class="muted">ทำแล้ว ${o.seen}/${Q.length} ข้อ · ถูก ${pct(o.acc)}</span></a>
  </div>
  <p class="footer">${esc(D.meta.examFormat)}. เว็บนี้ทำขึ้นเพื่อทบทวนจากสไลด์ ไม่ใช่ข้อสอบจริงของอาจารย์ และไม่ได้ทำนายว่าข้อใดจะออก · <a href="#/about">เกี่ยวกับ/แหล่งที่มา</a></p>`;
  setNav('');
  $app.querySelectorAll('#mins [data-m]').forEach(b=>b.onclick=()=>{S.minutes=+b.dataset.m;save();viewHome();});
  const mg=document.getElementById('minGo'); mg.onclick=()=>{const v=+document.getElementById('minC').value; if(v>=10){S.minutes=v;save();viewHome();}};
  $app.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
  const d=document.getElementById('dropS'); if(d) d.onclick=()=>confirmBox('ทิ้งชุดข้อสอบที่ทำค้างไว้?','ทิ้ง',()=>{S.session=null;save();viewHome();});
  document.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>go(b.dataset.plan));
}

function planHtml(){
  const m=S.minutes; if(!m) return '<p class="muted small" style="margin-top:10px">เลือกเวลาที่เหลือ แล้วระบบจะจัดลำดับการฝึกให้ (ปรับได้ตลอด)</p>';
  const o=overall(); const weak=weakChapters(3); const hasData=o.seen>=8;
  const wk = weak.map(n=>'บท '+n).join(', ');
  const steps=[];
  if(!hasData) steps.push(['diag',`วัดความรู้ ${CH.length+2} ข้อ (~15 นาที) เพื่อหาบทที่อ่อน`]);
  if(m>=60) steps.push(['weak', hasData? `ฝึกเน้นบทที่อ่อน (${wk}) 20 ข้อ`:'ฝึกเน้นจุดอ่อน 20 ข้อ (ระบบเลือกจากผล Diagnostic)']);
  if(m>=120) steps.push(['learnweak', `อ่านสรุป + บัตรคำ บทที่อ่อนที่สุด (บท ${weak[0]})`]);
  if(m>=180) steps.push(['mock50','สอบจำลอง 50 ข้อ / 60 นาที']);
  if(m>=120) steps.push(['mist','ทบทวนข้อที่ผิดทั้งหมด']);
  if(m<60 && hasData) steps.push(['weak10',`ฝึก 10 ข้อจากบทที่อ่อน (${wk})`]);
  steps.push(['last','ทบทวนคู่แนวคิดที่สับสน + บัตรคำ (10 นาที) แล้วพักผ่อน']);
  return `<ol class="tight" style="margin-top:10px">${steps.map(s=>`<li><button class="btn sm ghost" data-plan="${s[0]}" style="text-align:left;justify-content:flex-start;min-height:36px;padding:4px 8px">${esc(s[1])} →</button></li>`).join('')}</ol>
  <p class="small muted">${m<=60?'เวลาน้อย: เน้นทำข้อสอบแล้วอ่านเฉลยจริงจัง ดีกว่าอ่านสไลด์ใหม่ทั้งหมด':'สลับบทไปมา (interleaving) ช่วยจำได้ดีกว่าอ่านทีละบทยาว ๆ'} · อย่าลืมนอนให้พอ การนอนช่วยให้สมองเก็บสิ่งที่ฝึกไว้</p>`;
}

function go(k){
  if(k==='diag'){ const ids=[]; CH.forEach(c=>{ const p=shuffle(Q.filter(q=>q.ch===c.ch&&!q.x)); if(p.length) ids.push(p[0].id); });
    const rest=shuffle(Q.filter(q=>q.sc && !q.x && !ids.includes(q.id))).slice(0,2).map(q=>q.id);
    return startSession({mode:'diag',title:'วัดความรู้ (Diagnostic)',ids:shuffle(ids.concat(rest)),feedback:'end'}); }
  if(k==='scen'){ return startSession({mode:'scen',title:'Scenario Challenge',ids:shuffle(Q.filter(q=>q.sc).map(q=>q.id)).slice(0,10),feedback:'instant'}); }
  if(k==='weak'||k==='weak10'){ const weak=weakChapters(3); const pool=Q.filter(q=>weak.includes(q.ch)); return startSession({mode:'practice',title:'ฝึกเน้นบทที่อ่อน',ids:weightedPick(pool,k==='weak'?20:10).map(q=>q.id),feedback:'instant'}); }
  if(k==='learnweak'){ location.hash='#/ch/'+weakChapters(1)[0]; return; }
  if(k==='mock50'){ return startMock(50,60); }
  if(k==='mist'){ location.hash='#/mistakes'; return; }
  if(k==='last'){ location.hash='#/last'; return; }
}

function viewLearn(){
  $app.innerHTML = `<h1>เรียนตามบท</h1><p class="muted">แตะบทเพื่ออ่านสรุปสั้น ๆ บัตรคำ แล้วทำแบบฝึกท้ายบท</p>
  ${CH.map(c=>{const s=chStats(c.ch); return `<a class="mode" href="#/ch/${c.ch}" style="text-decoration:none;margin:10px 0"><span class="tag">บทที่ ${c.ch} · ${s.total} ข้อ</span><b>${esc(c.title)}</b><span class="muted">${esc(c.short)}</span><span class="row small" style="width:100%;margin-top:4px"><span class="bar" style="flex:1"><i style="width:${s.seen/s.total*100}%;background:${barColor(s.acc)}"></i></span><span class="muted">ทำแล้ว ${s.seen}/${s.total} · ถูก ${pct(s.acc)}</span></span></a>`;}).join('')}`;
  setNav('<a class="btn" href="#/">หน้าหลัก</a>');
}

function viewChapter(n){
  const c=CH.find(x=>x.ch===n); if(!c){ location.hash='#/learn'; return; }
  const s=chStats(n);
  $app.innerHTML = `<p class="small" style="margin-top:14px"><a href="#/learn">← เรียนตามบท</a></p>
  <h1>บทที่ ${c.ch}: ${esc(c.title)}</h1>
  <p class="muted small">ทำแล้ว ${s.seen}/${s.total} ข้อ · ถูก ${pct(s.acc)}</p>
  <div class="card"><h2 style="margin-top:0">สรุปสั้น (จากสไลด์)</h2><ul class="tight">${c.summary.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
  <h2>บัตรคำ — แตะเพื่อพลิก</h2>
  <div class="grid">${c.cards.map((k,i)=>`<div class="card flash" tabindex="0" role="button" aria-label="บัตรคำ ${esc(k[0])} แตะเพื่อดูความหมาย" data-i="${i}"><div class="term">${esc(k[0])}</div><div class="def" hidden>${esc(k[1])}</div><div class="small muted hint">แตะเพื่อดูคำอธิบาย</div></div>`).join('')}</div>
  <div class="card"><b>ลองตอบในใจก่อนพลิก</b><p class="small muted">การนึกคำตอบเองก่อน (active recall) ช่วยจำได้นานกว่าอ่านซ้ำ</p></div>`;
  bindFlash();
  setNav(`<a class="btn" href="#/learn">ย้อนกลับ</a><button class="btn primary" id="chq">ทำแบบฝึกบทนี้ (${s.total} ข้อ)</button>`);
  document.getElementById('chq').onclick=()=>startSession({mode:'chapter',title:'แบบฝึกบทที่ '+n,ids:shuffle(Q.filter(q=>q.ch===n).map(q=>q.id)),feedback:'instant',back:'#/ch/'+n});
}
function bindFlash(){
  document.querySelectorAll('.flash').forEach(f=>{ const t=()=>{ const d=f.querySelector('.def'), h=f.querySelector('.hint'); const show=d.hidden; d.hidden=!show; h.textContent= show?'แตะเพื่อซ่อน':'แตะเพื่อดูคำอธิบาย'; };
    f.onclick=t; f.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();t();} }; });
}

let pr = {chs:[], n:10, lv:0, weak:false, slideOnly:false};
function viewPractice(){
  $app.innerHTML = `<h1>ฝึกข้อสอบ (Practice)</h1><p class="muted">สุ่มคละบท เฉลยหลังกด "ส่งคำตอบ" ทีละข้อ</p>
  <div class="card"><h3 style="margin-top:0">เลือกบท <span class="muted small">(ไม่เลือก = ทุกบท)</span></h3>
  <div class="chips" id="chs">${CH.map(c=>`<button class="chip" aria-pressed="${pr.chs.includes(c.ch)}" data-c="${c.ch}">บท ${c.ch}</button>`).join('')}</div>
  <h3>จำนวนข้อ</h3><div class="chips" id="ns">${[10,20,30].map(n=>`<button class="chip" aria-pressed="${pr.n===n}" data-n="${n}">${n} ข้อ</button>`).join('')}</div>
  <h3>ระดับ</h3><div class="chips" id="lvs">${[[0,'ทุกระดับ'],[1,LV[1]],[2,LV[2]],[3,LV[3]]].map(([v,t])=>`<button class="chip" aria-pressed="${pr.lv===v}" data-l="${v}">${t}</button>`).join('')}</div>
  <h3>วิธีสุ่ม</h3><div class="chips"><button class="chip" id="wk" aria-pressed="${pr.weak}">เน้นข้อที่เคยผิด/ยังไม่เคยทำ</button>${Q.some(q=>q.x)?`<button class="chip" id="so" aria-pressed="${pr.slideOnly}">เฉพาะข้อจากสไลด์</button>`:''}</div>
  <p class="small muted" id="cnt"></p></div>`;
  const pool=()=>Q.filter(q=>(!pr.chs.length||pr.chs.includes(q.ch))&&(!pr.lv||q.lv===pr.lv)&&(!pr.slideOnly||!q.x));
  const upd=()=>{ document.getElementById('cnt').textContent=`มีข้อที่ตรงเงื่อนไข ${pool().length} ข้อ`; };
  $app.querySelectorAll('#chs .chip').forEach(b=>b.onclick=()=>{const c=+b.dataset.c; pr.chs=pr.chs.includes(c)?pr.chs.filter(x=>x!==c):pr.chs.concat(c); b.setAttribute('aria-pressed',pr.chs.includes(c)); upd();});
  $app.querySelectorAll('#ns .chip').forEach(b=>b.onclick=()=>{pr.n=+b.dataset.n; $app.querySelectorAll('#ns .chip').forEach(x=>x.setAttribute('aria-pressed',x===b));});
  $app.querySelectorAll('#lvs .chip').forEach(b=>b.onclick=()=>{pr.lv=+b.dataset.l; $app.querySelectorAll('#lvs .chip').forEach(x=>x.setAttribute('aria-pressed',x===b)); upd();});
  document.getElementById('wk').onclick=e=>{pr.weak=!pr.weak; e.currentTarget.setAttribute('aria-pressed',pr.weak);}; const so=document.getElementById('so'); if(so) so.onclick=e=>{pr.slideOnly=!pr.slideOnly; e.currentTarget.setAttribute('aria-pressed',pr.slideOnly); upd();};
  upd();
  setNav('<a class="btn" href="#/">หน้าหลัก</a><button class="btn primary" id="st">เริ่มทำ</button>');
  document.getElementById('st').onclick=()=>{ const p=pool(); if(!p.length) return; const sel= pr.weak? weightedPick(p,pr.n): shuffle(p).slice(0,pr.n);
    startSession({mode:'practice',title:'ฝึกข้อสอบ '+sel.length+' ข้อ',ids:sel.map(q=>q.id),feedback:'instant',back:'#/practice'}); };
}

let mk={n:50,perQ:1.2};
function startMock(n,minutes){
  // proportional sampling across chapters
  const ids=[]; const byCh=CH.map(c=>shuffle(Q.filter(q=>q.ch===c.ch)));
  let i=0; while(ids.length<Math.min(n,Q.length)){ const arr=byCh[i%byCh.length]; if(arr.length) ids.push(arr.shift().id); i++; if(i>5000)break; }
  startSession({mode:'mock',title:`สอบจำลอง ${ids.length} ข้อ`,ids:shuffle(ids),feedback:'end',minutes,back:'#/mock'});
}
function viewMock(){
  const t=()=>Math.round(mk.n*mk.perQ);
  $app.innerHTML=`<h1>สอบจำลอง (Mock Exam)</h1>
  <p class="muted">จับเวลา ไม่เฉลยระหว่างทำ เปลี่ยนคำตอบได้จนกว่าจะกดส่ง หมดเวลาระบบส่งให้อัตโนมัติ</p>
  <div class="card"><h3 style="margin-top:0">จำนวนข้อ</h3><div class="chips" id="mn">${[25,50,Q.length].filter((v,i,a)=>v<=Q.length&&a.indexOf(v)===i).map(n=>`<button class="chip" aria-pressed="${mk.n===n}" data-n="${n}">${n===Q.length?'ทั้งหมด '+n:n} ข้อ</button>`).join('')}</div>
  <h3>เวลาต่อข้อ</h3><div class="chips" id="mp">${[[1.2,'1.2 นาที (เท่าสอบจริง)'],[1,'1 นาที (กดดันขึ้น)'],[1.5,'1.5 นาที']].map(([v,l])=>`<button class="chip" aria-pressed="${mk.perQ===v}" data-p="${v}">${l}</button>`).join('')}</div>
  <p class="small" id="mt"></p>
  <p class="small muted">${esc(D.meta.examFormat)} → เฉลี่ย 1.2 นาทีต่อข้อ</p></div>`;
  const upd=()=>{document.getElementById('mt').innerHTML=`รวม <b>${mk.n} ข้อ / ${t()} นาที</b>`;};
  $app.querySelectorAll('#mn .chip').forEach(b=>b.onclick=()=>{mk.n=+b.dataset.n; $app.querySelectorAll('#mn .chip').forEach(x=>x.setAttribute('aria-pressed',x===b)); upd();});
  $app.querySelectorAll('#mp .chip').forEach(b=>b.onclick=()=>{mk.perQ=+b.dataset.p; $app.querySelectorAll('#mp .chip').forEach(x=>x.setAttribute('aria-pressed',x===b)); upd();});
  upd();
  setNav('<a class="btn" href="#/">หน้าหลัก</a><button class="btn primary" id="st">เริ่มสอบ</button>');
  document.getElementById('st').onclick=()=>startMock(mk.n,t());
}

function viewMistakes(){
  const ids=Object.keys(S.mistakes).filter(id=>QBY[id]);
  const by={}; ids.forEach(id=>{const c=QBY[id].ch; by[c]=(by[c]||0)+1;});
  $app.innerHTML=`<h1>ข้อที่เคยผิด</h1>
  ${ids.length?`<p class="muted">${ids.length} ข้อ · ตอบถูกเมื่อไร ข้อนั้นจะออกจากรายการ</p>
  <div class="card"><table><tr><th>บท</th><th>จำนวนข้อที่ผิด</th></tr>${Object.keys(by).sort((a,b)=>a-b).map(c=>`<tr><td>บทที่ ${c} ${esc(chTitle(+c))}</td><td>${by[c]}</td></tr>`).join('')}</table></div>`
  :`<div class="card"><p>ยังไม่มีข้อที่ผิด ลองทำ Diagnostic หรือ Practice ก่อน</p></div>`}`;
  setNav(`<a class="btn" href="#/">หน้าหลัก</a><button class="btn primary" id="st" ${ids.length?'':'disabled'}>ฝึกข้อที่ผิด</button>`);
  const st=document.getElementById('st'); if(ids.length) st.onclick=()=>startSession({mode:'review',title:'ทบทวนข้อที่เคยผิด',ids:shuffle(ids).slice(0,30),feedback:'instant',back:'#/mistakes'});
}

function viewLast(){
  const all=[]; CH.forEach(c=>c.cards.forEach(k=>all.push({ch:c.ch,k})));
  $app.innerHTML=`<h1>ทบทวนนาทีสุดท้าย</h1>
  <div class="card"><h2 style="margin-top:0">เตือนก่อนเข้าห้องสอบ</h2><ul class="tight">
  ${(D.meta.tips||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>
  <h2>คู่แนวคิดที่สับสนง่าย</h2>
  ${D.pairs.map(p=>`<details><summary>${esc(p.t)}</summary><p>▸ ${esc(p.a)}</p><p>▸ ${esc(p.b)}</p><p class="small"><b>วิธีจำ:</b> ${esc(p.tip)}</p><p class="small muted">อ้างอิง: ${esc(p.ref)}</p></details>`).join('')}
  <h2>บัตรคำทุกบท (สุ่มลำดับ)</h2>
  <div class="grid">${shuffle(all).map(x=>`<div class="card flash" tabindex="0" role="button" aria-label="บัตรคำ ${esc(x.k[0])}"><div class="small muted">บทที่ ${x.ch}</div><div class="term">${esc(x.k[0])}</div><div class="def" hidden>${esc(x.k[1])}</div><div class="small muted hint">แตะเพื่อดูคำอธิบาย</div></div>`).join('')}</div>`;
  bindFlash();
  setNav('<a class="btn" href="#/">หน้าหลัก</a>');
}

function viewStats(){
  const o=overall();
  $app.innerHTML=`<h1>ผลรายบท</h1><p class="muted">ทำแล้ว ${o.seen}/${Q.length} ข้อ · ตอบทั้งหมด ${o.a} ครั้ง · ถูก ${pct(o.acc)}</p>
  <div class="card"><table><tr><th>บท</th><th style="width:38%">ความแม่น</th><th>ทำแล้ว</th></tr>
  ${CH.map(c=>{const s=chStats(c.ch); return `<tr><td><a href="#/ch/${c.ch}">บท ${c.ch}</a> <span class="small muted">${esc(c.short)}</span></td><td><div class="bar"><i style="width:${(s.acc||0)*100}%;background:${barColor(s.acc)}"></i></div><span class="small">${pct(s.acc)}</span></td><td class="small">${s.seen}/${s.total}</td></tr>`;}).join('')}
  </table><p class="small muted">เขียว ≥80% · เหลือง 60–79% · แดง &lt;60% (ใช้ประเมินตัวเอง ไม่ใช่คะแนนจริง)</p></div>
  <div class="card"><h3 style="margin-top:0">ธีม</h3><div class="chips">${[['','ตามเครื่อง'],['light','สว่าง'],['dark','มืด']].map(([v,l])=>`<button class="chip" data-t="${v}" aria-pressed="${(S.theme||'')===v}">${l}</button>`).join('')}</div>
  <h3>ล้างข้อมูล</h3><p class="small muted">ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น ไม่มีการส่งออกไปที่ใด</p><button class="btn" id="rs">ล้างความคืบหน้าทั้งหมด</button></div>`;
  $app.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{S.theme=b.dataset.t||null; if(S.theme) document.documentElement.setAttribute('data-theme',S.theme); else document.documentElement.removeAttribute('data-theme'); save(); viewStats();});
  document.getElementById('rs').onclick=()=>confirmBox('ล้างความคืบหน้า ข้อที่ผิด และชุดที่ทำค้างทั้งหมด?','ล้างข้อมูล',()=>{S.stats={};S.mistakes={};S.session=null;save();viewStats();});
  setNav('<a class="btn" href="#/">หน้าหลัก</a>');
}

function viewAbout(){
  $app.innerHTML=`<h1>เกี่ยวกับเว็บนี้</h1><div class="card">
  <p>เว็บติวข้อสอบปรนัยวิชา <b>${esc(D.meta.course)}</b></p><ul class="tight">${(D.meta.about||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div>
  <div class="card"><h3 style="margin-top:0">จำนวนข้อต่อบท</h3><table>${CH.map(c=>`<tr><td>บทที่ ${c.ch} ${esc(c.title)}</td><td>${Q.filter(q=>q.ch===c.ch).length}</td></tr>`).join('')}</table></div>
  <p class="small muted">ปุ่มลัด: กด 1–4 เพื่อเลือกตัวเลือก · Enter = ส่งคำตอบ/ข้อถัดไป</p>`;
  setNav('<a class="btn" href="#/">หน้าหลัก</a>');
}

// ---------- quiz ----------
let tick=null;
function fmt(ms){ ms=Math.max(0,ms); const s=Math.floor(ms/1000); const h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=s%60; return (h?h+':':'')+String(m).padStart(h?2:1,'0')+':'+String(x).padStart(2,'0'); }
function viewQuiz(){
  const s=S.session; if(!s){ location.hash='#/'; return; }
  if(s.finished){ location.hash='#/results'; return; }
  if(s.endAt && Date.now()>=s.endAt){ finishSession(); return; }
  const id=s.ids[s.idx], q=QBY[id], ord=s.order[id];
  const chosen=s.ans[id]; const submitted = s.feedback==='instant' && s.sub[id];
  const answered = Object.keys(s.ans).filter(k=>s.ans[k]!=null).length;
  const head = `<div class="row" style="margin-top:12px"><span class="small muted" style="flex:1">${esc(s.title)}</span>${s.endAt?`<span class="timer" id="tm" aria-live="off">${fmt(s.endAt-Date.now())}</span>`:''}</div>
    <div class="progress" aria-label="ความคืบหน้า" role="progressbar" aria-valuemin="0" aria-valuemax="${s.ids.length}" aria-valuenow="${s.idx+1}"><i style="width:${(s.idx+1)/s.ids.length*100}%"></i></div>
    <div class="qhead"><span>ข้อ ${s.idx+1}/${s.ids.length}</span><span class="pill">บทที่ ${q.ch}</span><span class="pill gray">${LV[q.lv]}</span>${q.sc?'<span class="pill gray">สถานการณ์</span>':''}${q.x?'<span class="pill gray">เสริม นอกสไลด์</span>':''}${s.skip[id]&&chosen==null?'<span class="pill gray">ข้ามไว้</span>':''}</div>`;
  const choices = ord.map((oi,pos)=>{
    let cls='choice', dis=submitted?'disabled':'';
    if(submitted){ if(oi===0) cls+=' correct'; else if(oi===chosen) cls+=' wrong'; }
    return `<button class="${cls}" role="radio" aria-checked="${chosen===oi}" data-oi="${oi}" ${dis}><span class="k">${KEYS[pos]}</span><span>${esc(q.c[oi])}</span></button>`;
  }).join('');
  let fb='';
  if(submitted){ fb = feedbackHtml(q, ord, chosen); }
  $app.innerHTML = `${head}<h1 class="stem" tabindex="-1" id="stem">${esc(q.q)}</h1><div class="choices" role="radiogroup" aria-label="ตัวเลือก">${choices}</div>${fb}
   ${s.mode==='mock'?mockPalette(s):''}<p class="kbd" style="margin-top:14px">ปุ่มลัด: 1–4 เลือก · Enter ${s.feedback==='instant'?'ส่ง/ถัดไป':'ถัดไป'}</p>`;
  // nav
  const isLast = s.idx===s.ids.length-1;
  let nav='';
  if(s.feedback==='instant'){
    nav = `<button class="btn" id="prev" ${s.idx===0?'disabled':''}>ย้อนกลับ</button>`+
      (submitted? `<button class="btn primary" id="next">${isLast?'ดูผลสรุป':'ข้อถัดไป'}</button>`
       : `<button class="btn" id="skip">${isLast?'ข้าม/จบ':'ข้าม'}</button><button class="btn primary" id="sub" ${chosen==null?'disabled':''}>ส่งคำตอบ</button>`);
  } else {
    nav = `<button class="btn" id="prev" ${s.idx===0?'disabled':''}>ก่อนหน้า</button>`+
      (isLast? `<button class="btn primary" id="fin">ส่งข้อสอบ (${answered}/${s.ids.length})</button>` : `<button class="btn primary" id="next">${chosen==null?'ข้าม/ถัดไป':'ถัดไป'}</button>`);
  }
  setNav(nav + `<button class="btn ghost" id="quit" aria-label="ออกไปหน้าหลัก" style="flex:0 0 auto">⋯</button>`);
  // bind
  $app.querySelectorAll('.choice').forEach(b=>b.onclick=()=>{ if(submitted) return; s.ans[id]=+b.dataset.oi; delete s.skip[id]; save(); viewQuiz(); const sb=document.getElementById('sub')||document.getElementById('next')||document.getElementById('fin'); });
  const g=x=>document.getElementById(x);
  if(g('prev')) g('prev').onclick=()=>{ s.idx=Math.max(0,s.idx-1); save(); viewQuiz(); focusStem(); };
  if(g('next')) g('next').onclick=()=>{ if(s.feedback==='end' && s.ans[id]==null) s.skip[id]=1; if(isLast){ finishSession(); } else { s.idx++; save(); viewQuiz(); focusStem(); } };
  if(g('sub')) g('sub').onclick=()=>{ if(s.ans[id]==null) return; s.sub[id]=1; record(id, s.ans[id]===0); save(); viewQuiz(); const f=document.querySelector('.fb'); if(f){ f.setAttribute('tabindex','-1'); f.focus({preventScroll:true}); f.scrollIntoView({behavior:'smooth',block:'nearest'}); } };
  if(g('skip')) g('skip').onclick=()=>{ s.skip[id]=1; if(isLast) finishSession(); else { s.idx++; save(); viewQuiz(); focusStem(); } };
  if(g('fin')) g('fin').onclick=()=>{ const un=s.ids.length-answered; confirmBox(un?`ยังไม่ได้ตอบ ${un} ข้อ ต้องการส่งเลยหรือไม่?`:'ส่งข้อสอบและดูผล?','ส่งข้อสอบ',finishSession); };
  g('quit').onclick=()=>confirmBox('ออกไปหน้าหลัก? (ความคืบหน้าชุดนี้ถูกบันทึกไว้ กลับมาทำต่อได้)','ออก',()=>{location.hash='#/';});
  $app.querySelectorAll('.palette button').forEach(b=>b.onclick=()=>{ s.idx=+b.dataset.i; save(); viewQuiz(); focusStem(); });
  // timer
  clearInterval(tick);
  if(s.endAt){ tick=setInterval(()=>{ const t=document.getElementById('tm'); const left=s.endAt-Date.now(); if(left<=0){ clearInterval(tick); finishSession(); return; } if(t){ t.textContent=fmt(left); t.classList.toggle('low', left<5*60000); } },1000); }
}
function focusStem(){ const h=document.getElementById('stem'); if(h){ h.focus({preventScroll:true}); window.scrollTo({top:0}); } }
function mockPalette(s){
  return `<details style="margin-top:16px"><summary>ภาพรวมข้อสอบ (ตอบแล้ว ${Object.keys(s.ans).filter(k=>s.ans[k]!=null).length}/${s.ids.length})</summary><div class="palette" style="margin-top:10px">${s.ids.map((id,i)=>`<button class="${s.ans[id]!=null?'done':''} ${i===s.idx?'cur':''}" data-i="${i}" aria-label="ไปข้อ ${i+1}">${i+1}</button>`).join('')}</div></details>`;
}
function feedbackHtml(q, ord, chosen){
  const ok = chosen===0;
  const posOf = oi => KEYS[ord.indexOf(oi)];
  const why = ord.map(oi=> oi===0? '' : `<li><span class="k">${posOf(oi)}</span>${esc(q.w[oi-1])}</li>`).join('');
  return `<div class="fb ${chosen==null?'':(ok?'ok':'bad')}" aria-live="polite">
    <div class="verdict">${chosen==null?'ยังไม่ได้ตอบข้อนี้':(ok?'✓ ถูกต้อง':'✗ ยังไม่ถูก')}</div>
    ${ok?'':`<p><b>คำตอบที่ถูก: ${posOf(0)}.</b> ${esc(q.c[0])}</p>`}
    <p><b>เพราะ</b> ${esc(q.ex)}</p>
    <p style="margin-top:10px"><b>ทำไมตัวเลือกอื่นผิด</b></p><ul class="why">${why}</ul>
    <div class="src">${q.x?`📘 บทที่ ${q.ch} · ${esc(q.pg)} — ${esc(q.ev)}`:`📖 บทที่ ${q.ch} ${esc(D.meta.pgLabel||'หน้า')} ${esc(q.pg)} — “${esc(q.ev)}”`}<br><span class="small">จุดประสงค์: ${esc(q.lo)}</span></div>
  </div>`;
}

function viewResults(){
  const s=S.session; if(!s){ location.hash='#/'; return; }
  clearInterval(tick);
  const rows=s.ids.map(id=>({id,q:QBY[id],a:s.ans[id]}));
  const done=rows.filter(r=>s.feedback==='end'? true : s.sub[r.id]);
  const correct=rows.filter(r=>r.a===0 && (s.feedback==='end'||s.sub[r.id])).length;
  const answered=rows.filter(r=>r.a!=null && (s.feedback==='end'||s.sub[r.id])).length;
  const skipped=s.ids.length-answered;
  const by={}; rows.forEach(r=>{ const c=r.q.ch; by[c]=by[c]||{n:0,c:0}; by[c].n++; if(r.a===0 && (s.feedback==='end'||s.sub[r.id])) by[c].c++; });
  const score = correct/s.ids.length;
  const weak = Object.keys(by).filter(c=>by[c].c/by[c].n<0.6).map(Number);
  const dur = s.finishedAt? Math.round((s.finishedAt-s.started)/60000):null;
  const wrongIds = rows.filter(r=>r.a!==0).map(r=>r.id);
  $app.innerHTML=`<h1>ผลสรุป: ${esc(s.title)}</h1>
  <div class="card"><div style="font-size:34px;font-weight:700">${correct}/${s.ids.length} <span style="font-size:20px" class="muted">(${Math.round(score*100)}%)</span></div>
  <p class="muted small">ตอบ ${answered} · ข้าม/ไม่ได้ตอบ ${skipped}${dur!=null?` · ใช้เวลา ~${dur} นาที`:''}</p>
  <p>${score>=.8?'ดีมาก! ระดับนี้อยู่ในช่วง A ตามเกณฑ์ในสไลด์ — ทบทวนข้อที่พลาดแล้วไปต่อ':score>=.6?'มาถูกทางแล้ว เก็บข้อที่พลาดอีกนิดจะขึ้นไปได้อีก':'ไม่เป็นไร ข้อที่ผิดคือแผนที่บอกว่าต้องทบทวนตรงไหน เริ่มจากบทที่อ่อนก่อน'}</p></div>
  <h2>คะแนนแยกบท</h2><div class="card"><table><tr><th>บท</th><th>ถูก</th><th style="width:35%"></th></tr>${Object.keys(by).sort((a,b)=>a-b).map(c=>{const r=by[c].c/by[c].n; return `<tr><td>บท ${c} <span class="small muted">${esc(CH.find(x=>x.ch==c).short)}</span></td><td>${by[c].c}/${by[c].n}</td><td><div class="bar"><i style="width:${r*100}%;background:${barColor(r)}"></i></div></td></tr>`;}).join('')}</table>
  ${weak.length?`<p class="small" style="margin-top:8px">ควรทบทวน: ${weak.map(c=>`<a href="#/ch/${c}">บทที่ ${c}</a>`).join(', ')}</p>`:''}</div>
  <h2>ทบทวนรายข้อ</h2>
  ${rows.map((r,i)=>{ const ok=r.a===0; const show = s.feedback==='end'||s.sub[r.id]; return `<details><summary><span class="${ok?'ok-text':'bad-text'}">${ok?'✓':(r.a==null?'–':'✗')}</span> ข้อ ${i+1} · บท ${r.q.ch} · ${esc(r.q.q.slice(0,70))}${r.q.q.length>70?'…':''}</summary>
    <p style="font-weight:600">${esc(r.q.q)}</p>${r.a!=null&&!ok&&show?`<p class="bad-text small">คุณตอบ: ${esc(r.q.c[r.a])}</p>`:''}${feedbackHtml(r.q, s.order[r.id], show?r.a:null)}</details>`; }).join('')}`;
  const back = s.back||'#/';
  setNav(`<a class="btn" href="#/">หน้าหลัก</a>${wrongIds.length?`<button class="btn primary" id="rw">ฝึกข้อที่ผิด/ข้าม (${wrongIds.length})</button>`:`<a class="btn primary" href="${back}">ทำชุดใหม่</a>`}`);
  const rw=document.getElementById('rw'); if(rw) rw.onclick=()=>startSession({mode:'review',title:'ฝึกข้อที่ผิด/ข้ามจากชุดที่แล้ว',ids:shuffle(wrongIds),feedback:'instant'});
}

// ---------- router ----------
function render(){
  clearInterval(tick);
  const h=location.hash||'#/';
  const m=h.match(/^#\/ch\/(\d+)/);
  window.scrollTo({top:0});
  if(h==='#/'||h==='#'||h==='') viewHome();
  else if(h==='#/learn') viewLearn();
  else if(m) viewChapter(+m[1]);
  else if(h==='#/practice') viewPractice();
  else if(h==='#/mock') viewMock();
  else if(h==='#/mistakes') viewMistakes();
  else if(h==='#/last') viewLast();
  else if(h==='#/stats') viewStats();
  else if(h==='#/about') viewAbout();
  else if(h==='#/quiz') viewQuiz();
  else if(h==='#/results') viewResults();
  else viewHome();
}
window.addEventListener('hashchange', render);
document.addEventListener('keydown', e=>{
  if(location.hash!=='#/quiz' || document.querySelector('.modal-bg')) return;
  if(e.target && (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')) return;
  const n = {'1':0,'2':1,'3':2,'4':3}[e.key];
  if(n!=null){ const b=document.querySelectorAll('.choice')[n]; if(b && !b.disabled){ b.click(); } return; }
  if(e.key==='Enter' && !(e.target && e.target.classList && (e.target.classList.contains('choice')||e.target.tagName==='BUTTON'||e.target.tagName==='A'||e.target.tagName==='SUMMARY'))){
    const b=document.getElementById('sub')||document.getElementById('next')||document.getElementById('fin'); if(b && !b.disabled){ e.preventDefault(); b.click(); }
  }
});
render();
})();
