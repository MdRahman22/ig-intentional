// ---------- helpers ----------
const el = id => document.getElementById(id);
const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ---------- state ----------
let totalSec = 0, leftSec = 0, nudgeSec = 0, timer = null;
let plan = { intention:"", minutes:10, startedAt:null };
let didIntention = null;

// ---------- screen switching ----------
function show(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  el(id).classList.add('active');
  if(id==='session') updateUI();
  if(id==='stats') renderStats();
}

// ---------- storage ----------
function sessions(){ return JSON.parse(localStorage.getItem('igi_sessions')||'[]'); }
function saveSession(s){ const arr = sessions(); arr.push(s); localStorage.setItem('igi_sessions', JSON.stringify(arr)); }

// ---------- notifications / vibration ----------
function notify(msg){
  try{
    if(Notification.permission==='granted') new Notification(msg);
    else if(Notification.permission!=='denied') Notification.requestPermission();
  }catch(e){}
  if(navigator.vibrate) navigator.vibrate([80,40,80]);
}

// ---------- setup interactions ----------
el('intention').addEventListener('change', e=>{
  el('customIntention').classList.toggle('hidden', e.target.value!=='Custom');
});

el('to-setup').onclick = ()=> show('setup');
el('to-stats').onclick = ()=> show('stats');

el('start').onclick = ()=>{
  const sel = el('intention').value;
  plan.intention = (sel==='Custom') ? (el('customIntention').value || 'Custom intention') : sel;
  plan.minutes   = parseInt(el('minutes').value, 10);
  nudgeSec       = parseInt(el('nudge').value, 10);
  plan.startedAt = new Date().toISOString();

  totalSec = leftSec = plan.minutes * 60;

  // open Instagram
  if (mobile) {
    // deep link may be blocked by some browsers: user can tap 'Open Instagram' button in session
    window.location.href = 'instagram://app';
  } else {
    window.open('https://www.instagram.com','_blank');
  }

  show('session');
  startTimer();
};

el('openIG').onclick = ()=>{
  if (mobile) window.location.href = 'instagram://app';
  else window.open('https://www.instagram.com','_blank');
};

el('snooze').onclick = ()=> { leftSec += 60; totalSec += 60; updateUI(); };
el('endEarly').onclick = ()=> finishSession();

document.querySelectorAll('#review .choices button').forEach(b=>{
  b.onclick = ()=> { didIntention = b.dataset.did === 'yes'; };
});
el('saveLog').onclick = ()=>{
  const mood = parseInt(el('mood').value, 10);
  saveSession({
    startedAt: plan.startedAt,
    intention: plan.intention,
    plannedMin: plan.minutes,
    actualMin: Math.round((totalSec - leftSec)/60),
    completed: !!didIntention,
    mood
  });
  didIntention = null;
  notify('Saved. Nice work staying intentional!');
  show('stats');
};

// ---------- timer ----------
function startTimer(){
  notify(`Go do it: ${plan.intention} (${plan.minutes} min)`);
  updateUI();
  let lastNudge = 0;

  clearInterval(timer);
  timer = setInterval(()=>{
    leftSec--;
    if (leftSec <= 0) { finishSession(); return; }
    if (nudgeSec>0 && (totalSec - leftSec) - lastNudge >= nudgeSec){
      lastNudge = totalSec - leftSec;
      notify('Nudge: still on intention?');
    }
    updateUI();
  },1000);
}

function finishSession(){
  clearInterval(timer);
  el('countdown').textContent = '00:00';
  notify('Time’s up—wrap up on Instagram.');
  show('review');
}

function updateUI(){
  el('countdown').textContent = fmt(Math.max(leftSec,0));
  const pct = 100 * (totalSec - leftSec) / Math.max(totalSec,1);
  el('fill').style.width = Math.min(100, Math.max(0, pct)) + '%';
}

// ---------- stats ----------
function renderStats(){
  const arr = sessions();
  if (!arr.length){
    el('summary').innerHTML = '<p>No sessions yet.</p>';
    el('list').innerHTML = '';
    return;
  }
  const total = arr.reduce((a,b)=>a + b.actualMin, 0);
  const adherence = Math.round(100 * arr.filter(s=>s.completed).length / arr.length);
  const avgMood = (arr.reduce((a,b)=>a + (b.mood||0),0) / arr.length).toFixed(2);
  el('summary').innerHTML = `<p><strong>${arr.length}</strong> sessions · <strong>${total}</strong> min total · Intention kept <strong>${adherence}%</strong> · Avg mood <strong>${avgMood}</strong></p>`;
  el('list').innerHTML = arr.slice().reverse().map(s=>(
    `<li>${new Date(s.startedAt).toLocaleString()} — “${s.intention}” · planned ${s.plannedMin}m, actual ${s.actualMin}m · kept: ${s.completed ? '✓' : '—'} · mood ${s.mood||'-'}</li>`
  )).join('');
}

el('export').onclick = ()=>{
  const arr = sessions();
  const header = 'startedAt,intention,plannedMin,actualMin,completed,mood\n';
  const rows = arr.map(s=>[s.startedAt, `"${s.intention.replace(/"/g,'""')}"`, s.plannedMin, s.actualMin, s.completed, s.mood ?? ''].join(',')).join('\n');
  const blob = new Blob([header + rows], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='ig-intentional.csv'; a.click();
  URL.revokeObjectURL(url);
};

el('clear').onclick = ()=>{ if(confirm('Delete all local data?')) { localStorage.removeItem('igi_sessions'); renderStats(); } };

// default view
show('setup');
