// Your web app's Firebase configuration (Replace with your own project credentials from Step 1)
const firebaseConfig = {
  apiKey: "AIzaSyDcVC2hG5ueXg1hkyU5aYfYkv0VYzKxfL0",
  authDomain: "bible-in-2-years.firebaseapp.com",
  projectId: "bible-in-2-years",
  storageBucket: "bible-in-2-years.firebasestorage.app",
  messagingSenderId: "854337495111",
  appId: "1:854337495111:web:e170baf50dcb1adabf9162",
  measurementId: "G-EQNCPL0P9F"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Change this to point "Read" links at a different online Bible reader.
// {ref} is replaced with the passage, e.g. "Genesis 1-2".
const READER = "https://www.biblegateway.com/passage/?version=RSVCE&search={ref}";
const LABELS = ["Old Testament","New Testament","Psalm"];
const $ = s => document.querySelector(s);
const app = $("#app");
let plan, members = {}, tab = "today", offset = 0, loadTimer;
const S = { // state
  meId: null, canWrite: true, saving: false
};

function esc(s){const d=document.createElement("div");d.textContent=s;return d.innerHTML}
function todayIndex(){ // days since plan start, local time
  const [y,m,d]=plan.start.split("-").map(Number);
  const a=new Date(y,m-1,d), n=new Date(); const b=new Date(n.getFullYear(),n.getMonth(),n.getDate());
  return Math.round((b-a)/864e5);
}
function dateOf(i){const [y,m,d]=plan.start.split("-").map(Number);return new Date(y,m-1,d+i)}
function fmt(i){return dateOf(i).toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
function linkFor(text){
  let t=text.replace(/^Re-read\s+/i,"");
  if(/^(Catch-up|Notes)/i.test(t)) return null;
  return READER.replace("{ref}",encodeURIComponent(t.replace(/–/g,"-")));
}
function bits(m,i){ const s=(m&&m.d)||""; return +(s[i]||0) }
function stats(m){
  const t=todayIndex(), N=plan.days.length; let full=0,streak=0,due=0,behind=0,items=0;
  for(let i=0;i<N;i++){const b=bits(m,i); if(b===7)full++; items+=(b&1)+(b>>1&1)+(b>>2&1)}
  const last=Math.min(t,N-1);
  for(let i=0;i<=last;i++){due++; if(bits(m,i)!==7)behind++}
  let i=last; if(i>=0 && bits(m,i)!==7) i--; // today still open doesn't break streak
  while(i>=0 && bits(m,i)===7){streak++;i--}
  return {full,streak,behind,due,pct:Math.round(full/N*100)}
}
function setBit(i,k,on){
  const N=plan.days.length, me_=members[S.meId]||{}, arr=((me_.d||"").padEnd(N,"0")).split("");
  let b=+arr[i]||0; b = on ? (b|(1<<k)) : (b&~(1<<k)); arr[i]=String(b);
  save({d:arr.join("")});
}
async function save(patch){
  const cur=members[S.meId]||{};
  const next=Object.assign({},cur,patch,{t:Date.now()});
  members[S.meId]=next; render();
  try{ await db.doc("members/"+S.meId).set(next) }catch(e){ console.error(e); S.err="Couldn't save — your change may not stick." ; render() }
}
function dayCard(i,m,editable){
  const day=plan.days[i], b=bits(m,i);
  if(!day) return "";
  return `<div class="card"><div class="row"><div><b>Day ${i+1}</b><div class="muted">${esc(fmt(i))}</div></div>
  <span class="pill ${b===7?"ok":"no"}">${b===7?"Done":"To read"}</span></div>
  ${day.map((t,k)=>{const l=linkFor(t);return `<label class="item"><input type="checkbox" ${(b>>k&1)?"checked":""} ${editable?"":"disabled"} data-i="${i}" data-k="${k}">
  <div><div class="lab">${LABELS[k]}</div><div class="ref">${esc(t)}</div></div>${l?`<a href="${l}" target="_blank" rel="noopener">Read ↗</a>`:""}</label>`}).join("")}</div>`;
}
function friendsOf(id){
  const mine = (members[id] && members[id].follows) || [];
  return mine.filter(f => members[f] && (members[f].follows || []).includes(id));
}
function view(){
  if(!plan || !Array.isArray(plan.days) || !plan.start){
    return `<h1>Bible in 2 Years</h1><p class="sub">Loading the reading plan…</p>`;
  }
  const mm=members[S.meId]; const t=todayIndex(), N=plan.days.length;
  if(!mm||!mm.name) return `<h1>Bible in 2 Years</h1><p class="sub">Welcome. Pick a name your friends will see.</p>
  <div class="card"><input type="text" id="nm" maxlength="30" placeholder="Your name" value="${esc(S.defName||"")}"><p></p><button class="btn pri" id="go">Start reading</button></div>`;
  let h=`<h1>Bible in 2 Years</h1><p class="sub">Hello, ${esc(mm.name)}</p>
  <nav>${[["today","Today"],["plan","Plan"],["friends","Friends"]].map(([k,l])=>`<button data-tab="${k}" class="${tab===k?"on":""}">${l}</button>`).join("")}</nav>`;
  if(S.err) h+=`<p class="card muted">${esc(S.err)}</p>`;
  if(tab==="today"||tab==="plan"){
    if(t<0) h+=`<div class="card">The plan starts on ${esc(fmt(0))}. ${-t} day${t===-1?"":"s"} to go.</div>`;
    const idx = tab==="today" ? Math.max(0,Math.min(t,N-1)) : Math.max(0,Math.min(t+offset,N-1));
    if(tab==="plan") h+=`<div class="days"><button class="btn" data-off="-1">← Prev</button><button class="btn" data-off="0">Today</button><button class="btn" data-off="1">Next →</button></div>`;
    h+=dayCard(idx,mm,true);
    if(tab==="today"){
      const s=stats(mm);
      h+=`<div class="card"><div class="row"><b>Your progress</b><span class="muted">${s.pct}% of the plan</span></div><div class="bar" style="margin-top:8px"><i style="width:${s.pct}%"></i></div>
      <div class="stats"><div><b>${s.full}</b><span>days done</span></div><div><b>${s.streak}</b><span>day streak</span></div><div><b>${s.behind}</b><span>behind</span></div></div></div>`;
      const fs=friendsOf(S.meId);
      if(fs.length&&t>=0){
        h+=`<h2>Today with friends</h2>`+fs.map(f=>{const b=bits(members[f],Math.min(t,N-1));return `<div class="card row"><span>${esc(members[f].name||"Friend")}</span><span class="pill ${b===7?"ok":"no"}">${b===7?"Read today":b?"Partly read":"Not yet"}</span></div>`}).join("");
      }
    }
  }
  if(tab==="friends"){
    const fs=friendsOf(S.meId), mine=mm.follows||[];
    h+=`<h2>Friends</h2>`;
    if(!fs.length) h+=`<p class="muted">No friends yet. Add someone below; you're friends once you've both added each other.</p>`;
    fs.forEach(f=>{const m=members[f],s=stats(m),tt=Math.min(Math.max(t,0),N-1);
      let dots="";for(let i=Math.max(0,tt-13);i<=tt;i++)dots+=`<i class="${bits(m,i)===7?"f":""}"></i>`;
      const b=bits(m,tt);
      h+=`<div class="card"><div class="row"><b>${esc(m.name||"Friend")}</b><span class="pill ${b===7?"ok":"no"}">${b===7?"Read today":"Not yet today"}</span></div>
      <div class="bar" style="margin-top:8px"><i style="width:${s.pct}%"></i></div>
      <div class="stats"><div><b>${s.full}</b><span>days done</span></div><div><b>${s.streak}</b><span>streak</span></div><div><b>${s.behind}</b><span>behind</span></div></div>
      <div class="dots" title="last 14 days">${dots}</div><div class="muted" style="margin-top:4px">Last 14 days</div>
      <p><button class="btn" data-unf="${f}">Remove</button></p></div>`});
    const others=Object.keys(members).filter(k=>k!==S.meId&&members[k].name);
    const incoming=others.filter(k=>(members[k].follows||[]).includes(S.meId)&&!mine.includes(k));
    const pendingOut=mine.filter(k=>members[k]&&!(members[k].follows||[]).includes(S.meId));
    if(incoming.length) h+=`<h2>Requests</h2>`+incoming.map(k=>`<div class="card row"><span>${esc(members[k].name)} wants to be friends</span><button class="btn pri" data-add="${k}">Accept</button></div>`).join("");
    if(pendingOut.length) h+=`<h2>Waiting</h2>`+pendingOut.map(k=>`<div class="card row"><span>${esc(members[k].name)}</span><span class="muted">request sent</span></div>`).join("");
    const addable=others.filter(k=>!mine.includes(k)&&!incoming.includes(k));
    h+=`<h2>Add a friend</h2>`+(addable.length?addable.map(k=>`<div class="card row"><span>${esc(members[k].name)}</span><button class="btn" data-add="${k}">Add</button></div>`).join(""):`<p class="muted">Nobody else has joined yet. Share the page link with them, and once they open it they'll show up here.</p>`);
    h+=`<h2>Your name</h2><div class="card"><input type="text" id="rn" maxlength="30" value="${esc(mm.name)}"><p></p><button class="btn" id="rs">Save name</button></div>`;
  }
  return h;
}
function render(){
  if(!plan || !Array.isArray(plan.days) || !plan.start){
    app.innerHTML = "<p class='muted'>The reading plan hasn't been loaded yet.</p>";
    return;
  }
  const keep=document.activeElement&&document.activeElement.id;
  app.innerHTML=view();
  if(keep){const e=document.getElementById(keep);if(e)e.focus()}
}
app.addEventListener("click",e=>{
  const t=e.target.closest("button,input[type=checkbox]"); if(!t) return;
  if(t.dataset.tab){tab=t.dataset.tab;offset=0;render()}
  else if(t.dataset.off!==undefined){offset=t.dataset.off==="0"?0:offset+ +t.dataset.off;render()}
  else if(t.dataset.add){const f=(members[S.meId].follows||[]).slice();if(!f.includes(t.dataset.add))f.push(t.dataset.add);save({follows:f})}
  else if(t.dataset.unf){save({follows:(members[S.meId].follows||[]).filter(x=>x!==t.dataset.unf)})}
  else if(t.id==="go"){const v=$("#nm").value.trim();if(v)save({name:v,d:"",follows:[]})}
  else if(t.id==="rs"){const v=$("#rn").value.trim();if(v)save({name:v})}
  else if(t.type==="checkbox"){setBit(+t.dataset.i,+t.dataset.k,t.checked)}
});

async function init(){
  try{
    let user = auth.currentUser;
    if (!user) {
      const cred = await auth.signInAnonymously();
      user = cred.user;
    }
    S.meId = user.uid;

    loadTimer=setTimeout(()=>{if(!plan)app.innerHTML="<p class='muted'>Still trying to reach the data…</p>"},10000);
    
    db.doc("plan/main").onSnapshot(s=>{ 
      if(s.exists){
        plan=s.data();
        clearTimeout(loadTimer);
        render();
      } else if(!plan){
        app.innerHTML="<p class='muted'>The reading plan hasn't been loaded yet.</p>";
      }
    }, e=>{ app.innerHTML="<p class='muted'>Couldn't load the plan.</p>" });

    db.collection("members").onSnapshot(q=>{ 
      const o={}; 
      q.docs.forEach(d=>o[d.id]=d.data()); 
      members=o; 
      if(plan)render(); 
    }, e=>{ S.err="Lost connection to friends' data."; render(); });

  }catch(e){
    console.error(e);
    app.innerHTML="<p class='muted'>Something went wrong loading the page.</p>";
  }
}

init();