import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────
const CHALLENGE_START = new Date("2025-07-01");
const TOTAL_DAYS = 184;
const MONTHS = ["Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NUMS = [6,7,8,9,10,11];
const DAYS_SHORT = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

function getDayNumber() {
  const diff = Math.floor((new Date() - CHALLENGE_START) / 86400000) + 1;
  return Math.max(1, Math.min(diff, TOTAL_DAYS));
}
function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function todayKey() { return dateKey(); }
function weekKey(date = new Date()) {
  const d = new Date(date); d.setHours(0,0,0,0);
  d.setDate(d.getDate() - d.getDay());
  return `week-${dateKey(d)}`;
}
function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
}
function last7() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return { key: dateKey(d), day: DAYS_SHORT[d.getDay()], date: d.getDate() };
  });
}
function isSunday() { return new Date().getDay() === 0; }
function getThisSundayKey() {
  const d = new Date(); d.setHours(0,0,0,0);
  d.setDate(d.getDate() - d.getDay());
  return `review-${dateKey(d)}`;
}

// ─── Storage ──────────────────────────────────────────────────────────────────
async function load(key) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}
async function save(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}
// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:        "#050505",
  bg2:       "#0C0C0C",
  bg3:       "#141414",
  bg4:       "#1C1C1C",
  glass:     "rgba(255,255,255,0.03)",
  border:    "rgba(255,255,255,0.07)",
  borderHi:  "rgba(255,255,255,0.12)",
  white:     "#FFFFFF",
  text1:     "#FFFFFF",
  text2:     "rgba(255,255,255,0.65)",
  text3:     "rgba(255,255,255,0.35)",
  text4:     "rgba(255,255,255,0.14)",
  // Rule: green = done/positive, pink = action/workout. Everything else = white at opacity.
  green:     "#39FF14",
  greenBg:   "rgba(57,255,20,0.06)",
  greenGlow: "rgba(57,255,20,0.15)",
  pink:      "#FF1B6B",
  pinkBg:    "rgba(255,27,107,0.06)",
  pinkGlow:  "rgba(255,27,107,0.15)",
  // Accent-only: used once per screen max
  orange:    "#FF8C42",
  purple:    "#C47AFF",
  sep:       "rgba(255,255,255,0.05)",
};

const T = {
  display: { fontSize:80, fontWeight:800, letterSpacing:-5, lineHeight:1, fontVariantNumeric:"tabular-nums" },
  hero:    { fontSize:48, fontWeight:800, letterSpacing:-2.5, lineHeight:1, fontVariantNumeric:"tabular-nums" },
  h1:      { fontSize:28, fontWeight:700, letterSpacing:-1, lineHeight:1.1 },
  h2:      { fontSize:22, fontWeight:700, letterSpacing:-0.5, lineHeight:1.2 },
  h3:      { fontSize:17, fontWeight:600, letterSpacing:-0.2, lineHeight:1.3 },
  body:    { fontSize:15, fontWeight:400, letterSpacing:-0.1, lineHeight:1.6 },
  small:   { fontSize:13, fontWeight:400, letterSpacing:0,    lineHeight:1.5 },
  label:   { fontSize:10, fontWeight:700, letterSpacing:1.6,  lineHeight:1.4 },
  num:     { fontSize:30, fontWeight:700, letterSpacing:-1,   lineHeight:1, fontVariantNumeric:"tabular-nums" },
};

// ─── Base Components ──────────────────────────────────────────────────────────
const GlassCard = ({ children, style, onClick, glow }) => {
  const glowColor   = glow==="green" ? C.greenGlow : glow==="pink" ? C.pinkGlow : "transparent";
  const borderColor = glow==="green" ? "rgba(57,255,20,0.2)" : glow==="pink" ? "rgba(255,27,107,0.2)" : C.border;
  return (
    <div onClick={onClick} style={{
      background: C.glass,
      backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
      border:`1px solid ${borderColor}`,
      borderRadius:18,
      boxShadow: glow ? `0 0 28px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.04)` : `inset 0 1px 0 rgba(255,255,255,0.04)`,
      cursor: onClick ? "pointer" : undefined,
      transition:"box-shadow 0.2s, border-color 0.2s",
      ...style,
    }}>{children}</div>
  );
};

const Label = ({ children, color }) => (
  <div style={{ ...T.label, color: color||C.text3, textTransform:"uppercase" }}>{children}</div>
);

const Progress = ({ value, color=C.green, height=2, style, glow }) => (
  <div style={{ height, background:C.bg4, borderRadius:height, overflow:"hidden", ...style }}>
    <div style={{
      width:`${Math.min(100,Math.max(0,value))}%`, height:"100%",
      background: glow ? `linear-gradient(90deg,${color}88,${color})` : color,
      borderRadius:height,
      boxShadow: glow ? `0 0 8px ${color}55` : "none",
      transition:"width 0.5s cubic-bezier(0.4,0,0.2,1)",
    }} />
  </div>
);

const Btn = ({ children, onClick, color=C.green, style, disabled, variant="fill" }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width:"100%",
    background: disabled ? C.bg4 : variant==="fill" ? color : "transparent",
    color: disabled ? C.text3 : variant==="fill" ? "#000" : color,
    border: variant==="fill" ? "none" : `1px solid ${color}33`,
    borderRadius:12, padding:"15px 20px", ...T.h3,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled||variant!=="fill" ? "none" : `0 0 18px ${color}44`,
    transition:"all 0.15s", fontWeight:700,
    ...style,
  }}>{children}</button>
);

const TxtBtn = ({ children, onClick, color=C.green, style }) => (
  <button onClick={onClick} style={{
    background:"none", border:"none", color, cursor:"pointer",
    ...T.small, fontWeight:600, padding:"4px 0", ...style,
  }}>{children}</button>
);

const Input = ({ value, onChange, placeholder, type="text", style }) => (
  <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{
      background:C.bg3, border:`1px solid ${C.border}`, borderRadius:10,
      color:C.white, padding:"13px 14px", ...T.body, width:"100%",
      outline:"none", boxSizing:"border-box", WebkitAppearance:"none",
      fontFamily:"inherit", ...style,
    }} />
);

const Textarea = ({ value, onChange, placeholder, rows=3 }) => (
  <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{
      background:C.bg3, border:`1px solid ${C.border}`, borderRadius:10,
      color:C.white, padding:"13px 14px", ...T.body, width:"100%",
      outline:"none", boxSizing:"border-box", resize:"none", fontFamily:"inherit",
    }} />
);

const Sep = ({ inset=0 }) => (
  <div style={{ height:1, background:C.sep, marginLeft:inset }} />
);

const NavBar = ({ title, onBack, right, sub }) => (
  <div style={{ paddingTop:16, paddingBottom:12, position:"relative" }}>
    <button onClick={onBack} style={{ background:"none", border:"none", color:C.green,
      cursor:"pointer", ...T.small, fontWeight:600, padding:"4px 0" }}>‹ Back</button>
    <div style={{ ...T.h1, marginTop:6 }}>{title}</div>
    {sub && <div style={{ ...T.label, color:C.text3, marginTop:4 }}>{sub}</div>}
    {right && <div style={{ position:"absolute", right:0, top:22 }}>{right}</div>}
  </div>
);

function Sheet({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)",
      backdropFilter:"blur(18px)", zIndex:200, display:"flex",
      alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:C.bg2, border:`1px solid ${C.borderHi}`,
        borderRadius:"22px 22px 0 0", padding:"0 0 48px",
        width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto",
        boxShadow:"0 -20px 80px rgba(0,0,0,0.9)" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:32, height:3, background:C.bg4, borderRadius:2 }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 20px 18px" }}>
          <div style={T.h3}>{title}</div>
          <button onClick={onClose} style={{ background:C.bg3, border:`1px solid ${C.border}`,
            color:C.text2, width:28, height:28, borderRadius:14, cursor:"pointer", fontSize:12,
            display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>
        <div style={{ padding:"0 20px" }}>{children}</div>
      </div>
    </div>
  );
}

function Toast({ msg }) {
  return (
    <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)",
      background:"rgba(12,12,12,0.97)", color:C.white, padding:"10px 18px",
      borderRadius:12, border:`1px solid ${C.borderHi}`, ...T.small, zIndex:999,
      whiteSpace:"nowrap", boxShadow:"0 4px 32px rgba(0,0,0,0.8)", backdropFilter:"blur(24px)" }}>{msg}</div>
  );
}

const Badge = ({ children, color=C.green }) => (
  <span style={{ background:`${color}12`, color, borderRadius:20, padding:"3px 9px",
    ...T.label, letterSpacing:1, border:`1px solid ${color}25` }}>{children}</span>
);

// Inline number field — tap to edit, no sheet needed
function InlineLog({ value, unit, placeholder, color, onSave }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState("");
  const ref = useRef(null);
  useEffect(() => { if(editing) ref.current?.focus(); }, [editing]);
  const submit = () => { const n=parseFloat(v); if(!isNaN(n)) onSave(n); setEditing(false); setV(""); };
  if (editing) return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <input ref={ref} type="number" value={v} onChange={e=>setV(e.target.value)}
        onBlur={submit} onKeyDown={e=>e.key==="Enter"&&submit()}
        placeholder={placeholder}
        style={{ background:"transparent", border:"none", borderBottom:`1px solid ${color}`,
          color, fontSize:28, fontWeight:700, width:80, outline:"none",
          fontVariantNumeric:"tabular-nums", padding:"2px 0",
          fontFamily:"inherit", WebkitAppearance:"none" }} />
      {unit && <span style={{ ...T.small, color:C.text3 }}>{unit}</span>}
    </div>
  );
  return (
    <div onClick={()=>setEditing(true)} style={{ cursor:"pointer", display:"flex", alignItems:"baseline", gap:6 }}>
      <span style={{ fontSize:28, fontWeight:700, color: value!=null ? color : C.text4,
        fontVariantNumeric:"tabular-nums", letterSpacing:-1 }}>
        {value!=null ? value : "—"}
      </span>
      {value!=null && unit && <span style={{ ...T.small, color:C.text3 }}>{unit}</span>}
      {value==null && <span style={{ ...T.label, color:color, marginLeft:4 }}>TAP TO LOG</span>}
    </div>
  );
}

// Smart insight generator
function getInsight(data) {
  const sessions = data.sessions || [];
  const habits   = data.habits   || [];
  const today    = new Date(); today.setHours(0,0,0,0);

  // Consecutive Monday workouts
  let monStreak = 0;
  for (let i = 0; i < 8; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i*7);
    if (d.getDay() !== 1) { const diff = (1 - d.getDay() + 7)%7; d.setDate(d.getDate()-diff); }
    if (sessions.some(s=>s.date===dateKey(d))) monStreak++; else break;
  }
  if (monStreak>=3) return `💪 ${monStreak} Mondays in a row — you never skip Monday`;

  // PR detection
  const last = [...sessions].sort((a,b)=>b.date.localeCompare(a.date))[0];
  if (last) {
    last.exercises?.forEach(ex => {
      const prev = sessions.filter(s=>s.date!==last.date).flatMap(s=>s.exercises||[]).filter(e=>e.name===ex.name);
      const max  = Math.max(0, ...prev.map(e=>parseFloat(e.weight)||0));
      if (parseFloat(ex.weight)>max && max>0) return `🏆 New ${ex.name} PR — ${ex.weight}kg`;
    });
  }

  // Screen time weekends vs weekdays
  const days7 = last7();
  const wkend = days7.filter(d=>["SUN","SAT"].includes(d.day)).map(d=>data.screenTime?.[d.key]).filter(v=>v!=null);
  const wkday = days7.filter(d=>!["SUN","SAT"].includes(d.day)).map(d=>data.screenTime?.[d.key]).filter(v=>v!=null);
  if (wkend.length&&wkday.length) {
    const we = wkend.reduce((a,b)=>a+b,0)/wkend.length;
    const wd = wkday.reduce((a,b)=>a+b,0)/wkday.length;
    if (we>wd+1.5) return `📱 Screen time ${(we-wd).toFixed(1)}h higher on weekends`;
  }

  // Habit streak
  const best = habits.reduce((mx,h)=>{
    let s=0; const d=new Date(today);
    for(let i=0;i<60;i++){if(h.completions?.[dateKey(d)]==="done"){s++;d.setDate(d.getDate()-1);}else break;}
    return s>mx?s:mx;
  }, 0);
  if (best>=7) return `🔥 ${best}-day habit streak — keep it going`;

  // Sessions this month
  const mo = sessions.filter(s=>s.date.startsWith(monthKey())).length;
  if (mo>0) return `📈 ${mo} workout${mo>1?"s":""} this month so far`;

  return null;
}

// ─── App Shell ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]   = useState("dashboard");
  const [data, setData] = useState({
    habits:[], routines:[], sessions:[], goals:[],
    weights:{}, photos:{}, screenTime:{},
    screenTimeGoal:3, weightStart:null, weightTarget:null,
    reviews:{}, noZeroCheckins:{},
  });
  const [loaded, setLoaded]         = useState(false);
  const [toast, setToast]           = useState(null);
  const [sundayBanner, setSundayBanner] = useState(false);
  const [quickStart, setQuickStart] = useState(false);

  useEffect(() => {
    (async () => { const d = await load("tracker-v2"); if (d) setData(d); setLoaded(true); })();
  }, []);
  useEffect(() => {
    if (!loaded) return;
    if (isSunday()) load(`dismissed-${getThisSundayKey()}`).then(v=>{ if(!v) setTimeout(()=>setSundayBanner(true),600); });
  }, [loaded]);

  const persist   = useCallback(async (next)=>{ setData(next); await save("tracker-v2",next); }, []);
  const showToast = (msg)=>{ setToast(msg); setTimeout(()=>setToast(null),2200); };

  if (!loaded) return (
    <div style={{ background:C.bg, minHeight:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", flexDirection:"column", gap:14 }}>
      <div style={{ width:36, height:36, border:`1px solid ${C.green}44`, borderTopColor:C.green,
        borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ ...T.label, color:C.text3, letterSpacing:3 }}>LOADING</div>
    </div>
  );

  const TABS = [
    { id:"dashboard", label:"Home",      sym:"⌂" },
    { id:"habits",    label:"Habits",    sym:"◉" },
    { id:"fitness",   label:"Train",     sym:"↑" },
    { id:"goals",     label:"Goals",     sym:"◎" },
    { id:"challenge", label:"Challenge", sym:"⬡" },
  ];

  return (
    <div style={{ background:C.bg, minHeight:"100vh", maxWidth:430, margin:"0 auto",
      fontFamily:"'Inter','SF Pro Display','Helvetica Neue',sans-serif",
      color:C.white, paddingBottom:90 }}>
      {toast && <Toast msg={toast} />}

      <div style={{ padding:"0 16px" }}>
        {tab==="dashboard" && <Dashboard data={data} persist={persist} showToast={showToast}
          onReview={()=>setTab("review")} onQuickStart={()=>setQuickStart(true)} />}
        {tab==="habits"    && <Habits    data={data} persist={persist} showToast={showToast} />}
        {tab==="fitness"   && <Fitness   data={data} persist={persist} showToast={showToast} />}
        {tab==="goals"     && <Goals     data={data} persist={persist} showToast={showToast} />}
        {tab==="challenge" && <Challenge data={data} persist={persist} showToast={showToast} />}
        {tab==="review"    && <WeeklyReview data={data} persist={persist} showToast={showToast} onBack={()=>setTab("dashboard")} />}
      </div>

      {/* Quick Start */}
      {quickStart && (
        <Sheet title="Start Workout" onClose={()=>setQuickStart(false)}>
          {data.routines.length===0
            ? <div style={{ textAlign:"center", padding:"40px 0", ...T.body, color:C.text3 }}>No routines yet. Go to Train to create one.</div>
            : data.routines.map(r=>{
                const last=[...data.sessions].filter(s=>s.routineId===r.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
                return (
                  <GlassCard key={r.id} glow="pink" style={{ marginBottom:10, padding:"16px" }}>
                    <div style={{ ...T.h3, marginBottom:3 }}>{r.name}</div>
                    <div style={{ ...T.small, color:C.text3, marginBottom:last?4:14 }}>{r.exercises.map(e=>e.name).join(" · ").slice(0,50)}</div>
                    {last && <div style={{ ...T.label, color:C.text3, marginBottom:14 }}>LAST: {last.date}</div>}
                    <Btn color={C.pink} onClick={()=>{ setQuickStart(false); setTab("fitness"); setTimeout(()=>window._startRoutine?.(r.id),120); }}>
                      ▶ Start {r.name}
                    </Btn>
                  </GlassCard>
                );
              })
          }
        </Sheet>
      )}

      {/* Sunday banner */}
      {sundayBanner && tab!=="review" && (
        <div style={{ position:"fixed", bottom:100, left:16, right:16, maxWidth:398, margin:"0 auto",
          background:"rgba(8,8,8,0.97)", borderRadius:16, padding:"14px 16px", zIndex:90,
          display:"flex", alignItems:"center", gap:12,
          boxShadow:"0 8px 48px rgba(0,0,0,0.8)",
          backdropFilter:"blur(28px)", border:`1px solid rgba(196,122,255,0.2)` }}>
          <div style={{ width:38, height:38, background:"rgba(196,122,255,0.08)", borderRadius:10,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>📋</div>
          <div style={{ flex:1 }}>
            <div style={{ ...T.small, fontWeight:700, color:C.purple }}>Weekly Review</div>
            <div style={{ ...T.label, color:C.text3, marginTop:2 }}>SUNDAY CHECK-IN</div>
          </div>
          <TxtBtn onClick={()=>{ setTab("review"); setSundayBanner(false); save(`dismissed-${getThisSundayKey()}`,true); }} color={C.purple}>Open</TxtBtn>
          <button onClick={()=>{ setSundayBanner(false); save(`dismissed-${getThisSundayKey()}`,true); }}
            style={{ background:"none", border:"none", color:C.text3, cursor:"pointer", fontSize:16, padding:4 }}>×</button>
        </div>
      )}

      {/* Tab Bar */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:430, background:"rgba(5,5,5,0.96)",
        borderTop:`1px solid ${C.border}`,
        display:"flex", paddingBottom:14, paddingTop:8, backdropFilter:"blur(40px)" }}>
        {TABS.map(t=>{
          const active = tab===t.id;
          const col    = t.id==="fitness" ? C.pink : C.green;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              flex:1, background:"none", border:"none", padding:"4px 0 2px",
              cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
              <span style={{ fontSize:17, opacity:active?1:0.25, color:active?col:C.white,
                filter:active?`drop-shadow(0 0 4px ${col})`:"none", transition:"all 0.2s" }}>{t.sym}</span>
              <span style={{ ...T.label, fontSize:9, letterSpacing:1.2,
                color:active?col:C.text3, fontWeight:active?700:500, transition:"color 0.15s" }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dashboard — focused on one job: what do I do today ───────────────────────
function Dashboard({ data, persist, showToast, onReview, onQuickStart }) {
  const dayNum  = getDayNumber();
  const pct     = Math.round((dayNum/TOTAL_DAYS)*100);
  const today   = todayKey();
  const wk      = weekKey();
  const insight = getInsight(data);

  // Inline log state
  const [logWeightMode,  setLogWeightMode]  = useState(false);
  const [logScreenMode,  setLogScreenMode]  = useState(false);
  const [setupSheet,     setSetupSheet]     = useState(false);
  const [startW,  setStartW]  = useState(data.weightStart?String(data.weightStart):"");
  const [targetW, setTargetW] = useState(data.weightTarget?String(data.weightTarget):"");
  const [scGoalI, setScGoalI] = useState(String(data.screenTimeGoal||3));
  const [showSecondary, setShowSecondary] = useState(false);

  const totalH   = data.habits.length;
  const doneH    = data.habits.filter(h=>h.completions?.[today]==="done").length;
  const allDone  = totalH>0 && doneH===totalH;
  const thisWt   = data.weights?.[wk];
  const todaySc  = data.screenTime?.[today];
  const scGoal   = data.screenTimeGoal||3;
  const workedOut= data.sessions.some(s=>s.date===today);
  const didToday = doneH>0 || workedOut || todaySc!=null || data.noZeroCheckins?.[today];

  const nzStreak = (() => {
    let s=0; const d=new Date(); d.setHours(0,0,0,0);
    for(let i=0;i<365;i++){
      const k=dateKey(d);
      if(data.habits.some(h=>h.completions?.[k]==="done")||data.sessions.some(s=>s.date===k)||data.screenTime?.[k]!=null||data.noZeroCheckins?.[k]){s++;d.setDate(d.getDate()-1);}else break;
    }
    return s;
  })();

  const logWeight = async (v) => {
    await persist({...data, weights:{...data.weights,[wk]:v}});
    showToast("Weight logged ✓");
  };
  const logScreen = async (v) => {
    await persist({...data, screenTime:{...data.screenTime,[today]:v}});
    showToast("Screen time logged ✓");
  };
  const markNZ    = async () => { await persist({...data,noZeroCheckins:{...data.noZeroCheckins,[today]:true}}); showToast("No zero day ✓"); };
  const saveSetup = async () => {
    const s=parseFloat(startW), t=parseFloat(targetW), g=parseFloat(scGoalI);
    await persist({...data, weightStart:isNaN(s)?data.weightStart:s, weightTarget:isNaN(t)?data.weightTarget:t, screenTimeGoal:isNaN(g)?data.screenTimeGoal:g});
    setSetupSheet(false); showToast("Saved");
  };
  const wtPct = (() => {
    if(!data.weightStart||!data.weightTarget||!thisWt) return null;
    const t=Math.abs(data.weightTarget-data.weightStart); if(!t) return 100;
    return Math.min(100,Math.round((Math.abs(thisWt-data.weightStart)/t)*100));
  })();
  const cycleHabit = async (id) => {
    const habits = data.habits.map(h=>{
      if(h.id!==id) return h;
      const cur=h.completions?.[today]||null;
      const next=cur===null?"done":cur==="done"?"missed":null;
      const comp={...h.completions,[today]:next};
      let streak=0; const d=new Date(); d.setHours(0,0,0,0);
      for(let i=0;i<365;i++){const k=dateKey(d);if(comp[k]==="done"){streak++;d.setDate(d.getDate()-1);}else break;}
      return {...h,completions:comp,streak};
    });
    await persist({...data,habits});
  };

  const exportData = () => {
    try {
      const b=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
      const u=URL.createObjectURL(b); const a=document.createElement("a");
      a.href=u; a.download=`tracker-${todayKey()}.json`; a.click(); URL.revokeObjectURL(u);
      showToast("Exported ✓");
    } catch { showToast("Export failed"); }
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});

  return (
    <div style={{ paddingTop:52 }}>

      {/* ── HERO: Day + Streak ── */}
      <div style={{ marginBottom:24, position:"relative" }}>
        {/* Ambient glow behind the number */}
        <div style={{ position:"absolute", top:-20, left:-20, width:180, height:180,
          borderRadius:"50%", background:`radial-gradient(circle, ${C.greenGlow} 0%, transparent 65%)`,
          pointerEvents:"none" }} />

        <div style={{ ...T.label, color:C.text3, marginBottom:10 }}>{dateStr.toUpperCase()}</div>

        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", position:"relative" }}>
          <div>
            <div style={{ ...T.display, color:C.green, textShadow:`0 0 60px ${C.greenGlow}`, lineHeight:0.9 }}>{dayNum}</div>
            <div style={{ ...T.label, color:C.text3, marginTop:8 }}>OF {TOTAL_DAYS} DAYS</div>
          </div>
          {nzStreak > 0 && (
            <div style={{ textAlign:"right", paddingBottom:4 }}>
              <div style={{ fontSize:44, fontWeight:800, letterSpacing:-2,
                color:C.pink, textShadow:`0 0 40px ${C.pinkGlow}`,
                fontVariantNumeric:"tabular-nums" }}>{nzStreak}</div>
              <div style={{ ...T.label, color:C.text3, marginTop:4 }}>DAY STREAK 🔥</div>
            </div>
          )}
        </div>

        {/* Challenge bar */}
        <div style={{ marginTop:14 }}>
          <Progress value={pct} color={C.green} height={2} glow />
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
            <span style={{ ...T.label, color:C.text3 }}>{pct}% COMPLETE</span>
            <span style={{ ...T.label, color:C.text3 }}>{TOTAL_DAYS-dayNum} DAYS LEFT</span>
          </div>
        </div>
      </div>

      {/* ── SMART INSIGHT ── */}
      {insight && (
        <div style={{ marginBottom:16, padding:"10px 14px",
          background:C.greenBg, borderRadius:12,
          border:`1px solid rgba(57,255,20,0.12)` }}>
          <div style={{ ...T.small, color:C.text2 }}>{insight}</div>
        </div>
      )}

      {/* ── START WORKOUT — primary CTA ── */}
      <div style={{ marginBottom:20 }}>
        <Btn onClick={onQuickStart} color={C.pink}>▶  Start Workout</Btn>
      </div>

      {/* ── TODAY'S HABITS — inline, big tap targets ── */}
      <GlassCard glow={allDone?"green":undefined} style={{ marginBottom:16 }}>
        <div style={{ padding:"16px 16px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <Label color={allDone?C.green:C.text3}>TODAY'S HABITS</Label>
          <span style={{ ...T.label, color:allDone?C.green:C.text3 }}>{doneH}/{totalH}</span>
        </div>
        {totalH===0 ? (
          <div style={{ padding:"0 16px 16px", ...T.small, color:C.text3 }}>No habits yet — add some in the Habits tab</div>
        ) : (
          <>
            <Progress value={totalH?(doneH/totalH)*100:0} color={allDone?C.green:C.pink} height={2} glow={allDone}
              style={{ marginLeft:16, marginRight:16, marginBottom:8 }} />
            <div style={{ paddingBottom:8 }}>
              {data.habits.map((h,idx)=>{
                const state = h.completions?.[today]||null;
                const done  = state==="done";
                const missed= state==="missed";
                return (
                  <div key={h.id}>
                    <button onClick={()=>cycleHabit(h.id)} style={{
                      width:"100%", background:"none", border:"none", cursor:"pointer",
                      display:"flex", alignItems:"center", gap:14, padding:"13px 16px",
                      textAlign:"left",
                    }}>
                      {/* Big checkbox — 44px touch target */}
                      <div style={{
                        width:26, height:26, borderRadius:8, flexShrink:0,
                        border:`1.5px solid ${done?C.green:missed?C.pink:C.border}`,
                        background:done?C.greenBg:missed?C.pinkBg:"transparent",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:14, color:done?C.green:missed?C.pink:C.text4,
                        transition:"all 0.12s",
                        boxShadow:done?`0 0 8px ${C.greenGlow}`:"none",
                      }}>
                        {done?"✓":missed?"✕":""}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ ...T.small, fontWeight:500,
                          color:done?C.text2:C.text1,
                          textDecoration:missed?"line-through":"none" }}>{h.name}</div>
                        {h.streak>0 && <div style={{ ...T.label, color:C.orange, marginTop:2 }}>🔥 {h.streak} DAYS</div>}
                      </div>
                    </button>
                    {idx<data.habits.length-1 && <Sep inset={56} />}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </GlassCard>

      {/* ── STATUS STRIP — weight · screen · workout ── */}
      <GlassCard style={{ marginBottom:16 }}>
        <div style={{ display:"flex" }}>
          {/* Weight */}
          <div style={{ flex:1, padding:"14px 14px", borderRight:`1px solid ${C.sep}` }}>
            <Label color={C.text3}>WEIGHT</Label>
            <div style={{ marginTop:6 }}>
              <InlineLog value={thisWt} unit="kg" placeholder="0" color={C.text2}
                onSave={logWeight} />
            </div>
            {data.weightTarget && thisWt && (
              <div style={{ ...T.label, color:C.text3, marginTop:4 }}>
                {wtPct}% TO {data.weightTarget}KG
              </div>
            )}
          </div>
          {/* Screen */}
          <div style={{ flex:1, padding:"14px 14px", borderRight:`1px solid ${C.sep}` }}>
            <Label color={C.text3}>SCREEN</Label>
            <div style={{ marginTop:6 }}>
              <InlineLog value={todaySc} unit="h" placeholder="0" color={todaySc>scGoal?C.pink:C.text2}
                onSave={logScreen} />
            </div>
            <div style={{ ...T.label, color:C.text3, marginTop:4 }}>GOAL {scGoal}H</div>
          </div>
          {/* Workout */}
          <div style={{ flex:1, padding:"14px 14px" }}>
            <Label color={C.text3}>WORKOUT</Label>
            <div style={{ fontSize:26, marginTop:8, color:workedOut?C.green:C.text4,
              textShadow:workedOut?`0 0 16px ${C.greenGlow}`:"none" }}>
              {workedOut?"✓":"—"}
            </div>
            <div style={{ ...T.label, color:C.text3, marginTop:4 }}>
              {workedOut?"DONE":"TODAY"}
            </div>
          </div>
        </div>
        {data.weightTarget && thisWt && (
          <div style={{ padding:"0 14px 12px" }}>
            <Progress value={wtPct||0} color={wtPct>=100?C.green:C.text2} height={1} style={{ opacity:0.4 }} />
          </div>
        )}
      </GlassCard>

      {/* ── NO ZERO DAY ── */}
      {!didToday && (
        <div style={{ marginBottom:16, display:"flex", alignItems:"center", gap:12,
          padding:"14px 16px", borderRadius:14,
          background:C.pinkBg, border:`1px solid rgba(255,27,107,0.15)` }}>
          <span style={{ fontSize:20 }}>⚡</span>
          <div style={{ flex:1, ...T.small, color:C.text2 }}>Don't make today a zero day</div>
          <button onClick={markNZ} style={{ background:C.pink, color:"#000", border:"none",
            borderRadius:8, padding:"7px 12px", ...T.label, letterSpacing:1, cursor:"pointer",
            fontWeight:700 }}>DONE</button>
        </div>
      )}

      {/* ── SECONDARY (collapsed by default) ── */}
      <button onClick={()=>setShowSecondary(s=>!s)} style={{
        width:"100%", background:"none", border:"none", cursor:"pointer",
        display:"flex", alignItems:"center", justifyContent:"center", gap:6,
        padding:"8px 0", marginBottom:showSecondary?12:0,
        color:C.text3, ...T.label,
      }}>
        {showSecondary?"▲ LESS":"▼ MORE"}
      </button>

      {showSecondary && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:8 }}>
          {[
            { icon:"📋", label:"WEEKLY\nREVIEW",  color:C.purple, action:onReview },
            { icon:"⚙",  label:"SETTINGS",        color:C.text3,  action:()=>{ setStartW(data.weightStart?String(data.weightStart):""); setTargetW(data.weightTarget?String(data.weightTarget):""); setScGoalI(String(data.screenTimeGoal||3)); setSetupSheet(true); } },
            { icon:"💾", label:"EXPORT",           color:C.text3,  action:exportData },
          ].map(a=>(
            <GlassCard key={a.label} onClick={a.action} style={{ padding:"14px 8px", cursor:"pointer" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                <span style={{ fontSize:20 }}>{a.icon}</span>
                <div style={{ ...T.label, color:a.color, textAlign:"center", lineHeight:1.6, whiteSpace:"pre-line" }}>{a.label}</div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {setupSheet && (
        <Sheet title="Settings" onClose={()=>setSetupSheet(false)}>
          <Label color={C.text3}>STARTING WEIGHT (KG)</Label>
          <Input value={startW} onChange={setStartW} placeholder="e.g. 85" type="number" style={{ marginTop:8, marginBottom:16 }} />
          <Label color={C.text3}>TARGET WEIGHT (KG)</Label>
          <Input value={targetW} onChange={setTargetW} placeholder="e.g. 75" type="number" style={{ marginTop:8, marginBottom:16 }} />
          <Label color={C.text3}>SCREEN TIME GOAL (HRS/DAY)</Label>
          <Input value={scGoalI} onChange={setScGoalI} placeholder="e.g. 3" type="number" style={{ marginTop:8, marginBottom:22 }} />
          <Btn onClick={saveSetup} color={C.green}>Save</Btn>
        </Sheet>
      )}
    </div>
  );
}

// ─── Habits ───────────────────────────────────────────────────────────────────
function Habits({ data, persist, showToast }) {
  const [addSheet, setAddSheet] = useState(false);
  const [name, setName]         = useState("");
  const today = todayKey();
  const days  = last7();

  const addHabit = async () => {
    if (!name.trim()) return;
    await persist({...data,habits:[...data.habits,{id:Date.now(),name:name.trim(),completions:{}}]});
    setName(""); setAddSheet(false); showToast("Habit added");
  };
  const cycle = async (id, key) => {
    const habits = data.habits.map(h=>{
      if(h.id!==id) return h;
      const cur=h.completions?.[key]||null;
      const next=cur===null?"done":cur==="done"?"missed":null;
      const comp={...h.completions,[key]:next};
      let streak=0; const d=new Date(); d.setHours(0,0,0,0);
      for(let i=0;i<365;i++){const k=dateKey(d);if(comp[k]==="done"){streak++;d.setDate(d.getDate()-1);}else break;}
      return {...h,completions:comp,streak};
    });
    await persist({...data,habits});
  };
  const del = async (id)=>{ await persist({...data,habits:data.habits.filter(h=>h.id!==id)}); showToast("Removed"); };

  const chartData=[...days].reverse().map(d=>({
    day:d.day.slice(0,1),
    pct:data.habits.length?Math.round((data.habits.filter(h=>h.completions?.[d.key]==="done").length/data.habits.length)*100):0
  }));

  const doneToday = data.habits.filter(h=>h.completions?.[today]==="done").length;
  const habitPct  = data.habits.length?Math.round((doneToday/data.habits.length)*100):0;
  const allDone   = data.habits.length>0 && doneToday===data.habits.length;

  const ST = {
    null:   { bg:"transparent",  color:C.text4, sym:"·", border:C.border },
    done:   { bg:C.greenBg,      color:C.green, sym:"✓", border:"rgba(57,255,20,0.4)" },
    missed: { bg:C.pinkBg,       color:C.pink,  sym:"✕", border:"rgba(255,27,107,0.35)" },
  };

  return (
    <div style={{ paddingTop:52 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div style={T.h1}>Habits</div>
        <TxtBtn onClick={()=>setAddSheet(true)} color={C.green} style={{ paddingTop:8 }}>+ Add</TxtBtn>
      </div>

      {data.habits.length>0 && (
        <>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <Progress value={habitPct} color={allDone?C.green:C.pink} height={2} glow={allDone} style={{ flex:1 }} />
            <span style={{ ...T.label, color:allDone?C.green:C.text3, flexShrink:0 }}>{doneToday}/{data.habits.length}</span>
          </div>
        </>
      )}

      {data.habits.length===0 && (
        <div style={{ textAlign:"center", padding:"72px 0 40px" }}>
          <div style={{ fontSize:48, marginBottom:14 }}>◉</div>
          <div style={{ ...T.h3, color:C.text3, marginBottom:8 }}>No habits yet</div>
          <TxtBtn onClick={()=>setAddSheet(true)} color={C.green}>Add your first habit</TxtBtn>
        </div>
      )}

      {/* 7-day grid with bigger cells */}
      {data.habits.length>0 && (
        <>
          {/* Day headers */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr repeat(7,40px)", gap:4, marginBottom:6, alignItems:"end" }}>
            <div />
            {days.map(d=>(
              <div key={d.key} style={{ textAlign:"center" }}>
                <div style={{ ...T.label, color:C.text4, marginBottom:3, fontSize:8 }}>{d.day.slice(0,2)}</div>
                <div style={{
                  fontSize:11, fontWeight:d.key===today?700:400,
                  color:d.key===today?"#000":C.text3,
                  background:d.key===today?C.green:"transparent",
                  width:26, height:26, borderRadius:7,
                  display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto",
                  boxShadow:d.key===today?`0 0 10px ${C.greenGlow}`:"none",
                }}>{d.date}</div>
              </div>
            ))}
          </div>

          {/* Rows — 44px min height per row */}
          <GlassCard style={{ overflow:"hidden", marginBottom:20 }}>
            {data.habits.map((h,idx)=>(
              <div key={h.id}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr repeat(7,40px)", gap:4,
                  alignItems:"center", padding:"8px 12px", minHeight:52 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0, paddingRight:4 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ ...T.small, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{h.name}</div>
                      {h.streak>0 && <div style={{ ...T.label, color:C.orange, marginTop:1 }}>🔥 {h.streak}D</div>}
                    </div>
                    <button onClick={()=>del(h.id)} style={{ background:"none",border:"none",color:C.text4,cursor:"pointer",fontSize:14,padding:6,flexShrink:0 }}>×</button>
                  </div>
                  {days.map(d=>{
                    const state=h.completions?.[d.key]||null;
                    const s=ST[String(state)];
                    return (
                      <button key={d.key} onClick={()=>cycle(h.id,d.key)} style={{
                        width:36, height:36, borderRadius:9,  // bigger tap target
                        border:`1.5px solid ${s.border}`,
                        background:s.bg, color:s.color,
                        fontSize:13, fontWeight:700, cursor:"pointer",
                        display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto",
                        transition:"all 0.1s",
                      }}>{s.sym}</button>
                    );
                  })}
                </div>
                {idx<data.habits.length-1 && <Sep inset={12} />}
              </div>
            ))}
          </GlassCard>

          {/* Chart */}
          <GlassCard style={{ padding:"16px", marginBottom:16 }}>
            <Label color={C.text3}>7-DAY COMPLETION</Label>
            <ResponsiveContainer width="100%" height={86} style={{ marginTop:10 }}>
              <BarChart data={chartData} barSize={22}>
                <XAxis dataKey="day" tick={{ fill:C.text3, fontSize:10 }} axisLine={false} tickLine={false} />
                <Bar dataKey="pct" fill={C.green} radius={[4,4,0,0]} />
                <Tooltip formatter={v=>`${v}%`} contentStyle={{ background:C.bg2, border:`1px solid ${C.border}`, fontSize:11, borderRadius:8, color:C.white }} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </>
      )}

      {addSheet && (
        <Sheet title="New Habit" onClose={()=>setAddSheet(false)}>
          <Input value={name} onChange={setName} placeholder="e.g. Drink 3L water" style={{ marginBottom:14 }} />
          <Btn onClick={addHabit} color={C.green}>Add Habit</Btn>
        </Sheet>
      )}
    </div>
  );
}

// ─── Fitness ──────────────────────────────────────────────────────────────────
function Fitness({ data, persist, showToast }) {
  const [view,    setView]    = useState("home");
  const [editR,   setEditR]   = useState(null);
  const [activeR, setActiveR] = useState(null);
  const [histR,   setHistR]   = useState(null);

  useEffect(() => {
    window._startRoutine = (id) => {
      const r = data.routines.find(r=>r.id===id);
      if (r) { setActiveR(r); setView("session"); }
    };
    return () => { delete window._startRoutine; };
  }, [data.routines]);

  const RoutineEditor = ({ routine, onDone }) => {
    const [rName, setRName]   = useState(routine?.name||"");
    const [exList, setExList] = useState(routine?.exercises||[{name:"",defaultSets:"3",defaultReps:"10"}]);
    const addEx = () => setExList([...exList,{name:"",defaultSets:"3",defaultReps:"10"}]);
    const updEx = (i,f,v) => setExList(exList.map((e,idx)=>idx===i?{...e,[f]:v}:e));
    const remEx = (i) => setExList(exList.filter((_,idx)=>idx!==i));
    const saveR = async () => {
      if(!rName.trim()) return;
      const valid=exList.filter(e=>e.name.trim()); if(!valid.length) return;
      if(routine){ await persist({...data,routines:data.routines.map(r=>r.id===routine.id?{...r,name:rName,exercises:valid}:r)}); showToast("Updated"); }
      else{ await persist({...data,routines:[...data.routines,{id:Date.now(),name:rName,exercises:valid}]}); showToast("Created"); }
      onDone();
    };
    const delR = async () => { await persist({...data,routines:data.routines.filter(r=>r.id!==routine.id)}); showToast("Deleted"); onDone(); };
    return (
      <div style={{ paddingTop:4 }}>
        <NavBar title={routine?"Edit Routine":"New Routine"} onBack={onDone}
          right={routine&&<TxtBtn onClick={delR} color={C.pink}>Delete</TxtBtn>} />
        <Label color={C.text3}>NAME</Label>
        <Input value={rName} onChange={setRName} placeholder="e.g. Push Day A" style={{ marginTop:8, marginBottom:22 }} />
        <Label color={C.text3}>EXERCISES</Label>
        <div style={{ marginTop:10 }}>
          {exList.map((e,i)=>(
            <GlassCard key={i} style={{ marginBottom:10, padding:"14px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ ...T.label, color:C.text3 }}>EXERCISE {i+1}</div>
                {exList.length>1 && <TxtBtn onClick={()=>remEx(i)} color={C.pink} style={{ ...T.label }}>REMOVE</TxtBtn>}
              </div>
              <Input value={e.name} onChange={v=>updEx(i,"name",v)} placeholder="e.g. Bench Press" style={{ marginBottom:10 }} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div><Label color={C.text3}>SETS</Label><Input value={e.defaultSets} onChange={v=>updEx(i,"defaultSets",v)} placeholder="3" type="number" style={{ marginTop:6 }} /></div>
                <div><Label color={C.text3}>REPS</Label><Input value={e.defaultReps} onChange={v=>updEx(i,"defaultReps",v)} placeholder="10" type="number" style={{ marginTop:6 }} /></div>
              </div>
            </GlassCard>
          ))}
        </div>
        <button onClick={addEx} style={{ width:"100%",background:"transparent",border:`1px dashed ${C.border}`,color:C.text3,borderRadius:10,padding:14,cursor:"pointer",...T.small,marginBottom:20 }}>+ Add Exercise</button>
        <Btn onClick={saveR} color={C.pink}>{routine?"Save Changes":"Create Routine"}</Btn>
      </div>
    );
  };

  const ActiveSession = ({ routine, onDone }) => {
    const lastSame=[...data.sessions].filter(s=>s.routineId===routine.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const [exercises, setExercises] = useState(
      routine.exercises.map((e,i)=>({
        name:e.name,
        weight:lastSame?.exercises[i]?.weight||"",
        sets:lastSame?.exercises[i]?.sets||e.defaultSets||"3",
        reps:lastSame?.exercises[i]?.reps||e.defaultReps||"10",
      }))
    );
    const [note,      setNote]      = useState("");
    const [showNote,  setShowNote]  = useState(false);
    const [activeEx,  setActiveEx]  = useState(0);
    const [timer,     setTimer]     = useState(null);
    const [timeLeft,  setTL]        = useState(0);
    const timerRef = useRef(null);

    const updEx=(i,f,v)=>setExercises(exercises.map((e,idx)=>idx===i?{...e,[f]:v}:e));
    const startTimer=(s)=>{
      if(timerRef.current) clearInterval(timerRef.current);
      setTL(s); setTimer(s);
      timerRef.current=setInterval(()=>setTL(t=>{ if(t<=1){clearInterval(timerRef.current);setTimer(null);return 0;} return t-1; }),1000);
    };
    useEffect(()=>()=>{if(timerRef.current)clearInterval(timerRef.current);},[]);

    const saveSession=async()=>{
      const valid=exercises.filter(e=>e.name);
      let prs=[];
      valid.forEach(e=>{
        const pm=Math.max(0,...data.sessions.filter(s=>s.routineId===routine.id).flatMap(s=>s.exercises||[]).filter(ex=>ex.name.toLowerCase()===e.name.toLowerCase()).map(ex=>parseFloat(ex.weight)||0));
        if(parseFloat(e.weight)>pm&&pm>0) prs.push(e.name);
      });
      await persist({...data,sessions:[...data.sessions,{id:Date.now(),date:todayKey(),routineId:routine.id,routineName:routine.name,exercises:valid,note:note.trim()}]});
      if(prs.length) showToast(`🏆 PR! ${prs.slice(0,2).join(", ")}`);
      else showToast("Session saved ✓");
      onDone();
    };

    const ex=exercises[activeEx];
    const lastEx=lastSame?.exercises[activeEx];

    return (
      <div style={{ paddingTop:4 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, paddingTop:20, paddingBottom:14 }}>
          <button onClick={onDone} style={{ background:"none",border:"none",color:C.pink,cursor:"pointer",...T.small,fontWeight:600 }}>‹ Back</button>
          <div style={{ flex:1 }}>
            <div style={T.h3}>{routine.name}</div>
            <div style={{ ...T.label, color:C.text3, marginTop:2 }}>{todayKey()}</div>
          </div>
          <Badge color={C.pink}>{activeEx+1}/{exercises.length}</Badge>
        </div>

        {/* Exercise pills */}
        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:8, marginBottom:14 }}>
          {exercises.map((e,i)=>(
            <button key={i} onClick={()=>setActiveEx(i)} style={{
              flexShrink:0,
              background:i===activeEx?C.pinkBg:"transparent",
              border:`1px solid ${i===activeEx?C.pink:C.border}`,
              color:i===activeEx?C.pink:C.text3,
              borderRadius:20, padding:"7px 14px", ...T.label,
              cursor:"pointer", boxShadow:i===activeEx?`0 0 12px ${C.pinkGlow}`:"none",
              transition:"all 0.15s",
            }}>{e.name.split(" ")[0].toUpperCase()}</button>
          ))}
        </div>

        {/* Exercise card */}
        <GlassCard glow="pink" style={{ marginBottom:12, padding:"18px 16px" }}>
          <div style={{ ...T.h2, marginBottom:lastEx?4:16 }}>{ex.name}</div>
          {lastEx && <div style={{ ...T.label, color:C.text3, marginBottom:16 }}>LAST: {lastEx.weight}KG × {lastEx.sets}S × {lastEx.reps}R</div>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            {[{l:"KG",f:"weight",ph:"0"},{l:"SETS",f:"sets",ph:"3"},{l:"REPS",f:"reps",ph:"10"}].map(fi=>(
              <div key={fi.f}>
                <Label color={C.text3}>{fi.l}</Label>
                <input type="number" value={ex[fi.f]} onChange={e=>updEx(activeEx,fi.f,e.target.value)}
                  placeholder={fi.ph}
                  style={{ background:C.bg3, border:`1px solid ${C.border}`, borderRadius:10,
                    color:C.white, padding:"12px 6px", fontSize:22, fontWeight:700,
                    width:"100%", outline:"none", boxSizing:"border-box",
                    textAlign:"center", marginTop:8, WebkitAppearance:"none", fontFamily:"inherit" }} />
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Rest timer */}
        <GlassCard style={{ marginBottom:12, padding:"12px 14px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:timer?8:0 }}>
            <Label color={C.text3}>REST</Label>
            {timer && <div style={{ ...T.num, color:timeLeft<=10?C.pink:C.green, fontSize:22,
              textShadow:timeLeft<=10?`0 0 12px ${C.pinkGlow}`:`0 0 10px ${C.greenGlow}` }}>{timeLeft}s</div>}
          </div>
          {timer && <Progress value={(timeLeft/timer)*100} color={timeLeft<=10?C.pink:C.green} height={2} glow style={{ marginBottom:8 }} />}
          <div style={{ display:"flex", gap:8 }}>
            {[60,90,120].map(s=>(
              <button key={s} onClick={()=>startTimer(s)} style={{
                flex:1, background:timer===s?C.greenBg:"transparent",
                border:`1px solid ${timer===s?C.green:C.border}`,
                color:timer===s?C.green:C.text2, borderRadius:9, padding:"9px 0",
                ...T.small, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>{s}s</button>
            ))}
            {timer && <button onClick={()=>{clearInterval(timerRef.current);setTimer(null);setTL(0);}}
              style={{ background:"transparent",border:`1px solid ${C.border}`,color:C.text3,borderRadius:9,padding:"9px 12px",...T.small,cursor:"pointer" }}>✕</button>}
          </div>
        </GlassCard>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
          <Btn onClick={()=>setActiveEx(Math.max(0,activeEx-1))} variant="outline" color={C.text2} disabled={activeEx===0}>← Prev</Btn>
          <Btn onClick={()=>setActiveEx(Math.min(exercises.length-1,activeEx+1))} color={C.pink} disabled={activeEx===exercises.length-1}>Next →</Btn>
        </div>

        {showNote
          ? <GlassCard style={{ marginBottom:12, padding:"14px 14px" }}>
              <Label color={C.text3}>NOTE</Label>
              <div style={{ marginTop:8 }}><Textarea value={note} onChange={setNote} placeholder="Felt strong / tired..." rows={2} /></div>
            </GlassCard>
          : <TxtBtn onClick={()=>setShowNote(true)} color={C.text3} style={{ marginBottom:12, display:"block" }}>+ Add note</TxtBtn>
        }

        {lastSame && (
          <GlassCard style={{ marginBottom:12, padding:"12px 14px" }}>
            <Label color={C.text3}>LAST SESSION — {lastSame.date}</Label>
            <div style={{ marginTop:8 }}>
              {lastSame.exercises.map((e,i)=>(
                <div key={i} style={{ ...T.small, color:C.text3, marginTop:3 }}>
                  {e.name} <span style={{ color:C.text2, fontWeight:600 }}>{e.weight}kg × {e.sets}×{e.reps}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        <Btn onClick={saveSession} color={C.green} style={{ marginBottom:24 }}>Finish Session</Btn>
      </div>
    );
  };

  const RoutineHistory = ({ routine, onDone }) => {
    const sessions=[...data.sessions].filter(s=>s.routineId===routine.id).sort((a,b)=>b.date.localeCompare(a.date));
    const delSess=async(id)=>{ await persist({...data,sessions:data.sessions.filter(s=>s.id!==id)}); showToast("Removed"); };
    const exNames=[...new Set(sessions.flatMap(s=>s.exercises.map(e=>e.name)))];
    const [selEx,setSelEx]=useState(exNames[0]||"");
    const pts=sessions.map((s,i)=>{ const e=s.exercises.find(ex=>ex.name===selEx); return { s:`W${sessions.length-i}`, kg:parseFloat(e?.weight)||0 }; }).reverse();
    return (
      <div style={{ paddingTop:4 }}>
        <NavBar title={routine.name} sub="Progress & History" onBack={onDone} />
        {exNames.length>0 && (
          <div style={{ marginBottom:18 }}>
            <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
              {exNames.map(n=>(
                <button key={n} onClick={()=>setSelEx(n)} style={{
                  flexShrink:0, background:selEx===n?C.pinkBg:"transparent",
                  border:`1px solid ${selEx===n?C.pink:C.border}`,
                  color:selEx===n?C.pink:C.text3, borderRadius:20, padding:"6px 14px",
                  ...T.label, cursor:"pointer", transition:"all 0.15s" }}>{n.toUpperCase()}</button>
              ))}
            </div>
          </div>
        )}
        {pts.length>=2 && (
          <GlassCard style={{ marginBottom:18, padding:"14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <Label color={C.text3}>{selEx.toUpperCase()} — KG</Label>
              {pts[pts.length-1].kg>pts[0].kg && <Badge color={C.green}>+{(pts[pts.length-1].kg-pts[0].kg).toFixed(1)}KG</Badge>}
            </div>
            <ResponsiveContainer width="100%" height={90}>
              <LineChart data={pts}>
                <XAxis dataKey="s" tick={{ fill:C.text3, fontSize:10 }} axisLine={false} tickLine={false} />
                <Line type="monotone" dataKey="kg" stroke={C.pink} strokeWidth={2} dot={{ fill:C.pink, r:3 }} />
                <Tooltip formatter={v=>`${v}kg`} contentStyle={{ background:C.bg2, border:`1px solid ${C.border}`, fontSize:11, borderRadius:8, color:C.white }} />
              </LineChart>
            </ResponsiveContainer>
          </GlassCard>
        )}
        <Label color={C.text3}>ALL SESSIONS ({sessions.length})</Label>
        <div style={{ marginTop:10 }}>
          {sessions.length===0
            ? <div style={{ textAlign:"center", color:C.text3, padding:40, ...T.body }}>No sessions yet.</div>
            : sessions.map(s=>(
              <GlassCard key={s.id} style={{ marginBottom:10, padding:"14px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <Badge color={C.pink}>{s.date}</Badge>
                  <TxtBtn onClick={()=>delSess(s.id)} color={C.pink} style={{ ...T.label }}>DELETE</TxtBtn>
                </div>
                {s.exercises.map((e,i)=>(
                  <div key={i} style={{ ...T.small, color:C.text3, marginTop:3 }}>
                    {e.name} <span style={{ color:C.text2, fontWeight:600 }}>{e.weight}kg × {e.sets}×{e.reps}</span>
                  </div>
                ))}
                {s.note && <div style={{ ...T.small, color:C.text3, marginTop:8, fontStyle:"italic", borderTop:`1px solid ${C.sep}`, paddingTop:8 }}>{s.note}</div>}
              </GlassCard>
            ))
          }
        </div>
      </div>
    );
  };

  if(view==="newRoutine")           return <RoutineEditor routine={null} onDone={()=>setView("home")} />;
  if(view==="editRoutine"&&editR)   return <RoutineEditor routine={editR} onDone={()=>{setView("home");setEditR(null);}} />;
  if(view==="session"&&activeR)     return <ActiveSession routine={activeR} onDone={()=>{setView("home");setActiveR(null);}} />;
  if(view==="history"&&histR)       return <RoutineHistory routine={histR} onDone={()=>{setView("home");setHistR(null);}} />;

  const totalSess=data.sessions.length;
  const wkSess=data.sessions.filter(s=>weekKey(new Date(s.date))===weekKey()).length;
  const mData=MONTHS.map((m,i)=>({m,c:data.sessions.filter(s=>(parseInt(s.date.split("-")[1])-1)===MONTH_NUMS[i]).length}));

  return (
    <div style={{ paddingTop:52 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div style={T.h1}>Train</div>
        <TxtBtn onClick={()=>setView("newRoutine")} color={C.pink} style={{ paddingTop:8 }}>+ Routine</TxtBtn>
      </div>
      <div style={{ ...T.label, color:C.text3, marginBottom:20 }}>{wkSess} SESSION{wkSess!==1?"S":""} THIS WEEK</div>

      <div style={{ display:"flex", gap:10, marginBottom:18 }}>
        <GlassCard style={{ flex:1, padding:"14px 14px" }}>
          <Label color={C.text3}>TOTAL</Label>
          <div style={{ ...T.num, color:C.pink, marginTop:6 }}>{totalSess}</div>
        </GlassCard>
        <GlassCard style={{ flex:1, padding:"14px 14px" }}>
          <Label color={C.text3}>THIS WEEK</Label>
          <div style={{ ...T.num, color:C.pink, marginTop:6 }}>{wkSess}</div>
        </GlassCard>
      </div>

      {totalSess>0 && (
        <GlassCard style={{ marginBottom:18, padding:"14px" }}>
          <Label color={C.text3}>6-MONTH</Label>
          <ResponsiveContainer width="100%" height={70} style={{ marginTop:10 }}>
            <BarChart data={mData} barSize={22}>
              <XAxis dataKey="m" tick={{ fill:C.text3, fontSize:10 }} axisLine={false} tickLine={false} />
              <Bar dataKey="c" fill={C.pink} radius={[4,4,0,0]} />
              <Tooltip contentStyle={{ background:C.bg2, border:`1px solid ${C.border}`, fontSize:11, borderRadius:8, color:C.white }} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      <Label color={C.text3}>ROUTINES ({data.routines.length})</Label>

      {data.routines.length===0 && (
        <div style={{ textAlign:"center", padding:"60px 0" }}>
          <div style={{ fontSize:48, marginBottom:14 }}>↑</div>
          <div style={{ ...T.h3, color:C.text3, marginBottom:8 }}>No routines yet</div>
          <TxtBtn onClick={()=>setView("newRoutine")} color={C.pink}>Create your first routine</TxtBtn>
        </div>
      )}

      <div style={{ marginTop:12 }}>
        {data.routines.map(r=>{
          const sc=data.sessions.filter(s=>s.routineId===r.id).length;
          const ls=[...data.sessions].filter(s=>s.routineId===r.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
          return (
            <GlassCard key={r.id} style={{ marginBottom:12, padding:"14px 14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={T.h3}>{r.name}</div>
                  <div style={{ ...T.label, color:C.text3, marginTop:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {r.exercises.map(e=>e.name).join(" · ").toUpperCase()}
                  </div>
                  <div style={{ ...T.label, color:C.text4, marginTop:2 }}>{sc} SESSION{sc!==1?"S":""}  {ls?`· LAST ${ls.date}`:""}</div>
                </div>
                <div style={{ display:"flex", gap:10, marginLeft:10 }}>
                  <TxtBtn onClick={()=>{setHistR(r);setView("history");}} color={C.text3} style={{ ...T.label }}>HISTORY</TxtBtn>
                  <TxtBtn onClick={()=>{setEditR(r);setView("editRoutine");}} color={C.text3} style={{ ...T.label }}>EDIT</TxtBtn>
                </div>
              </div>
              <button onClick={()=>{setActiveR(r);setView("session");}} style={{
                width:"100%", background:C.pinkBg, color:C.pink,
                border:`1px solid rgba(255,27,107,0.25)`, borderRadius:10,
                padding:"12px 0", ...T.h3, cursor:"pointer",
                boxShadow:`0 0 14px ${C.pinkGlow}44`,
              }}>▶ Start {r.name}</button>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

// ─── Goals ────────────────────────────────────────────────────────────────────
function Goals({ data, persist, showToast }) {
  const [addSheet, setAddSheet] = useState(false);
  const [updId,    setUpdId]    = useState(null);
  const [gName,    setGName]    = useState("");
  const [gTarget,  setGTarget]  = useState("");

  const add = async () => {
    if(!gName.trim()||!gTarget) return;
    await persist({...data,goals:[...data.goals,{id:Date.now(),name:gName.trim(),target:parseFloat(gTarget),current:0}]});
    setGName(""); setGTarget(""); setAddSheet(false); showToast("Goal added");
  };
  const updGoal = async (id, v) => {
    if(isNaN(v)) return;
    await persist({...data,goals:data.goals.map(g=>g.id===id?{...g,current:Math.min(v,g.target)}:g)});
    showToast("Updated");
  };
  const del = async (id) => { await persist({...data,goals:data.goals.filter(g=>g.id!==id)}); showToast("Removed"); };
  const done = data.goals.filter(g=>g.current>=g.target).length;

  return (
    <div style={{ paddingTop:52 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div style={T.h1}>Goals</div>
        <TxtBtn onClick={()=>setAddSheet(true)} color={C.orange} style={{ paddingTop:8 }}>+ Add</TxtBtn>
      </div>
      {data.goals.length>0 && <div style={{ ...T.label, color:C.text3, marginBottom:20 }}>{done} OF {data.goals.length} COMPLETE</div>}

      {data.goals.length===0 && (
        <div style={{ textAlign:"center", padding:"72px 0 40px" }}>
          <div style={{ fontSize:48, marginBottom:14 }}>◎</div>
          <div style={{ ...T.h3, color:C.text3, marginBottom:8 }}>No goals yet</div>
          <TxtBtn onClick={()=>setAddSheet(true)} color={C.orange}>Set your first goal</TxtBtn>
        </div>
      )}

      {data.goals.map(g=>{
        const pct=Math.min(100,Math.round((g.current/g.target)*100));
        const isDone=pct>=100;
        const col=isDone?C.green:pct>=50?C.orange:C.pink;
        return (
          <GlassCard key={g.id} glow={isDone?"green":undefined} style={{ marginBottom:12, padding:"16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div style={{ flex:1 }}>
                <div style={T.h3}>{g.name}{isDone?" 🏆":""}</div>
              </div>
              <TxtBtn onClick={()=>del(g.id)} color={C.text4} style={{ ...T.label, marginLeft:12 }}>✕</TxtBtn>
            </div>
            {/* Inline progress update */}
            <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:12 }}>
              <InlineLog value={g.current} unit={`/ ${g.target}`} placeholder="0" color={col}
                onSave={v=>updGoal(g.id,v)} />
              <span style={{ ...T.label, color:col, marginLeft:4 }}>{pct}%{isDone?" ✓":""}</span>
            </div>
            <Progress value={pct} color={col} height={2} glow={isDone} />
          </GlassCard>
        );
      })}

      {addSheet && (
        <Sheet title="New Goal" onClose={()=>setAddSheet(false)}>
          <Label color={C.text3}>GOAL NAME</Label>
          <Input value={gName} onChange={setGName} placeholder="e.g. Run 100km total" style={{ marginTop:8, marginBottom:16 }} />
          <Label color={C.text3}>TARGET</Label>
          <Input value={gTarget} onChange={setGTarget} placeholder="e.g. 100" type="number" style={{ marginTop:8, marginBottom:22 }} />
          <Btn onClick={add} color={C.orange}>Add Goal</Btn>
        </Sheet>
      )}
    </div>
  );
}

// ─── Challenge ────────────────────────────────────────────────────────────────
function Challenge({ data, persist, showToast }) {
  const dayNum = getDayNumber();
  const today  = new Date(); today.setHours(0,0,0,0);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [photoMonth, setPhotoMonth] = useState(null);
  const [compare,    setCompare]    = useState(false);
  const [newDot,     setNewDot]     = useState(false);

  const days = Array.from({length:TOTAL_DAYS},(_,i)=>{
    const d=new Date(CHALLENGE_START); d.setDate(d.getDate()+i);
    const k=dateKey(d);
    return { k, isPast:d<today, isToday:k===todayKey(),
      complete:(data.habits.length>0&&data.habits.some(h=>h.completions?.[k]==="done"))||data.sessions.some(s=>s.date===k),
      n:i+1 };
  });

  let streak=0;
  for(let i=dayNum-1;i>=0;i--){ if(days[i].complete) streak++; else break; }

  const monthStats=MONTHS.map((m,idx)=>{
    const mo=MONTH_NUMS[idx];
    const md=days.filter(d=>parseInt(d.k.split("-")[1])-1===mo);
    const cp=md.filter(d=>d.complete).length;
    return { m, total:md.length, cp, pct:md.length?Math.round((cp/md.length)*100):0 };
  });

  const photoKeys=MONTHS.map((_,i)=>monthKey(new Date(`2025-${String(MONTH_NUMS[i]+1).padStart(2,"0")}-01`)));
  const withPhotos=photoKeys.map((k,i)=>({m:MONTHS[i],key:k,src:data.photos?.[k]})).filter(p=>p.src);

  const handlePhoto=async(e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=async(ev)=>{ await persist({...data,photos:{...data.photos,[photoKeys[photoMonth]]:ev.target.result}}); setPhotoSheet(false); showToast("Photo saved"); };
    reader.readAsDataURL(file);
  };

  const todayDone = days.find(d=>d.isToday)?.complete;

  return (
    <div style={{ paddingTop:52 }}>
      <div style={{ ...T.h1, marginBottom:4 }}>Challenge</div>
      <div style={{ ...T.label, color:C.text3, marginBottom:20 }}>JUL 1 → DEC 31, 2025</div>

      {/* Hero streak — bigger, more impact */}
      <GlassCard glow={streak>0?"green":undefined} style={{ padding:"24px 20px", marginBottom:14, position:"relative", overflow:"hidden" }}>
        {streak>0 && (
          <div style={{ position:"absolute", top:-30, right:-30, width:160, height:160,
            borderRadius:"50%", background:`radial-gradient(circle, ${C.greenGlow} 0%, transparent 65%)`,
            pointerEvents:"none" }} />
        )}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
          <div>
            <Label color={C.text3}>STREAK</Label>
            <div style={{ fontSize:88, fontWeight:800, letterSpacing:-5, lineHeight:0.9,
              color:streak>0?C.green:C.text4,
              textShadow:streak>0?`0 0 60px ${C.greenGlow}`:"none",
              fontVariantNumeric:"tabular-nums", marginTop:8 }}>{streak}</div>
            <div style={{ ...T.label, color:C.text3, marginTop:10 }}>DAYS 🔥</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <Label color={C.text3}>DAY</Label>
            <div style={{ fontSize:44, fontWeight:800, letterSpacing:-2, color:C.white,
              fontVariantNumeric:"tabular-nums", marginTop:4 }}>{dayNum}</div>
            <div style={{ ...T.label, color:C.text3, marginTop:4 }}>OF {TOTAL_DAYS}</div>
            <Progress value={(dayNum/TOTAL_DAYS)*100} color={C.green} height={2} glow style={{ width:80, marginTop:10 }} />
          </div>
        </div>
        {/* Today indicator */}
        <div style={{ marginTop:16, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:8, height:8, borderRadius:"50%",
            background:todayDone?C.green:C.text4,
            boxShadow:todayDone?`0 0 8px ${C.green}`:"none",
            animation:todayDone?"none":"pulse 2s ease-in-out infinite",
          }} />
          <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>
          <span style={{ ...T.label, color:todayDone?C.green:C.text3 }}>
            {todayDone?"TODAY COMPLETE":"TODAY NOT LOGGED YET"}
          </span>
        </div>
      </GlassCard>

      {/* Monthly bars */}
      <GlassCard style={{ marginBottom:14 }}>
        <div style={{ padding:"14px 14px 8px" }}>
          <Label color={C.text3}>MONTHLY</Label>
        </div>
        {monthStats.map((ms,idx)=>(
          <div key={ms.m}>
            <div style={{ padding:"8px 14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                <span style={{ ...T.small, fontWeight:600 }}>{ms.m}</span>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ ...T.label, color:C.text3 }}>{ms.cp}/{ms.total}</span>
                  <Badge color={ms.pct>=80?C.green:ms.pct>=50?C.orange:C.pink}>{ms.pct}%</Badge>
                </div>
              </div>
              <Progress value={ms.pct} color={ms.pct>=80?C.green:ms.pct>=50?C.orange:C.pink} height={2} glow={ms.pct>=80} />
            </div>
            {idx<monthStats.length-1 && <Sep inset={14} />}
          </div>
        ))}
      </GlassCard>

      {/* 184-day dot grid */}
      <GlassCard style={{ padding:"16px", marginBottom:14 }}>
        <Label color={C.text3}>184-DAY GRID</Label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:3.5, marginTop:14 }}>
          {days.map(d=>(
            <div key={d.k} title={`Day ${d.n}`} style={{
              width:14, height:14, borderRadius:4, flexShrink:0,
              background: d.isToday
                ? C.green
                : d.complete ? `${C.green}44`
                : d.isPast   ? C.bg4
                : C.bg3,
              boxShadow: d.isToday ? `0 0 10px ${C.green}` : "none",
              transform: d.isToday ? "scale(1.15)" : "scale(1)",
              transition:"transform 0.3s, background 0.3s",
            }} />
          ))}
        </div>
        <div style={{ display:"flex", gap:14, marginTop:12, flexWrap:"wrap" }}>
          {[{c:C.green,l:"Today"},{c:`${C.green}44`,l:"Done"},{c:C.bg4,l:"Missed"},{c:C.bg3,l:"Upcoming"}].map(l=>(
            <div key={l.l} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:8, height:8, borderRadius:2, background:l.c }} />
              <span style={{ ...T.label, color:C.text3, fontSize:8 }}>{l.l.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Progress photos */}
      <GlassCard style={{ padding:"14px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <Label color={C.text3}>PROGRESS PHOTOS</Label>
          {withPhotos.length>=2 && (
            <TxtBtn onClick={()=>setCompare(!compare)} color={C.text3} style={{ ...T.label }}>
              {compare?"GRID":"COMPARE"}
            </TxtBtn>
          )}
        </div>
        {compare && withPhotos.length>=2 ? (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[withPhotos[0],withPhotos[withPhotos.length-1]].map(p=>(
              <div key={p.key}>
                <Label color={C.text3}>{p.m.toUpperCase()}</Label>
                <img src={p.src} alt={p.m} style={{ width:"100%", borderRadius:10, objectFit:"cover", height:150, marginTop:6 }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
            {MONTHS.map((m,i)=>{
              const src=data.photos?.[photoKeys[i]];
              return (
                <div key={m} onClick={()=>{setPhotoMonth(i);setPhotoSheet(true);}} style={{
                  aspectRatio:"1", borderRadius:10, overflow:"hidden",
                  background:C.bg3, cursor:"pointer", position:"relative",
                  border:`1px solid ${C.border}` }}>
                  {src
                    ? <img src={src} alt={m} style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                    : <div style={{ height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4 }}>
                        <span style={{ fontSize:16 }}>📷</span>
                        <span style={{ ...T.label, color:C.text3, fontSize:8 }}>{m.toUpperCase()}</span>
                      </div>
                  }
                  {src && (
                    <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(0,0,0,0.8))",padding:"10px 6px 4px" }}>
                      <span style={{ ...T.label, color:C.white, fontSize:8 }}>{m.toUpperCase()}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {photoSheet && (
        <Sheet title={`${MONTHS[photoMonth]} Photo`} onClose={()=>setPhotoSheet(false)}>
          <label style={{ display:"block", background:C.bg3, border:`1px solid ${C.border}`, borderRadius:12, padding:48, textAlign:"center", cursor:"pointer" }}>
            <div style={{ fontSize:36, marginBottom:10 }}>📷</div>
            <div style={{ ...T.small, color:C.text3 }}>Tap to choose photo</div>
            <input type="file" accept="image/*" onChange={handlePhoto} style={{ display:"none" }} />
          </label>
        </Sheet>
      )}
    </div>
  );
}

// ─── Weekly Review — simplified to 30-second default ─────────────────────────
function WeeklyReview({ data, persist, showToast, onBack }) {
  const key  = getThisSundayKey();
  const ex   = data.reviews?.[key]||{};
  const [mood,    setMood]    = useState(ex.mood||null);
  const [win,     setWin]     = useState(ex.win||"");
  const [improve, setImprove] = useState(ex.improve||"");
  const [showMore, setShowMore] = useState(false);
  const [gymNotes, setGymNotes] = useState(ex.gymNotes||"");
  const [past,     setPast]     = useState(false);

  const wk     = weekKey();
  const thisWt = data.weights?.[wk];
  const wkDays = last7();
  const gymCnt = data.sessions.filter(s=>weekKey(new Date(s.date))===wk).length;
  const avgSc  = (()=>{ const v=wkDays.map(d=>data.screenTime?.[d.key]).filter(v=>v!=null); return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):null; })();
  const habAvg = (()=>{ if(!data.habits.length) return null; const v=wkDays.map(d=>Math.round((data.habits.filter(h=>h.completions?.[d.key]==="done").length/data.habits.length)*100)); return Math.round(v.reduce((a,b)=>a+b,0)/v.length); })();

  const saveReview=async()=>{
    await persist({...data,reviews:{...data.reviews,[key]:{mood,win,improve,gymNotes,savedAt:new Date().toISOString(),weight:thisWt}}});
    showToast("Review saved ✓");
  };

  const pastReviews=Object.entries(data.reviews||{}).filter(([k])=>k!==key).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,8);
  const MOODS=[{e:"😔",l:"Rough"},{e:"😐",l:"Okay"},{e:"😊",l:"Good"},{e:"💪",l:"Great"},{e:"🔥",l:"Crushed"}];

  if(past) return (
    <div style={{ paddingTop:4 }}>
      <NavBar title="Past Reviews" onBack={()=>setPast(false)} />
      {pastReviews.length===0
        ? <div style={{ textAlign:"center", color:C.text3, padding:48, ...T.body }}>No past reviews yet.</div>
        : pastReviews.map(([k,rv])=>(
          <GlassCard key={k} style={{ marginBottom:12, padding:"14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <div style={{ ...T.small, fontWeight:600, color:C.purple }}>{k.replace("review-","")}</div>
              <span style={{ fontSize:16 }}>{MOODS.find(m=>m.l===rv.mood)?.e||""}</span>
            </div>
            {rv.weight && <div style={{ ...T.label, color:C.text3, marginBottom:6 }}>⚖️ {rv.weight}KG</div>}
            {rv.win     && <div style={{ marginBottom:6 }}><Label color={C.green}>WIN</Label><div style={{ ...T.small, marginTop:3, color:C.text2 }}>{rv.win}</div></div>}
            {rv.improve && <div style={{ marginBottom:6 }}><Label color={C.pink}>IMPROVE</Label><div style={{ ...T.small, marginTop:3, color:C.text2 }}>{rv.improve}</div></div>}
            {rv.gymNotes && <div><Label color={C.text3}>GYM</Label><div style={{ ...T.small, marginTop:3, color:C.text2 }}>{rv.gymNotes}</div></div>}
          </GlassCard>
        ))
      }
    </div>
  );

  return (
    <div style={{ paddingTop:4 }}>
      <div style={{ paddingTop:16, paddingBottom:10 }}>
        <button onClick={onBack} style={{ background:"none",border:"none",color:C.green,cursor:"pointer",...T.small,fontWeight:600,padding:"4px 0" }}>‹ Back</button>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginTop:6 }}>
          <div style={{ ...T.h1 }}>Weekly Review</div>
          <TxtBtn onClick={()=>setPast(true)} color={C.text3} style={{ paddingTop:8, ...T.label }}>HISTORY</TxtBtn>
        </div>
        <div style={{ ...T.label, color:C.text3, marginTop:4 }}>{key.replace("review-","")}</div>
      </div>

      {/* Week stats strip */}
      <div style={{ display:"flex", gap:0, marginBottom:16,
        background:C.glass, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden" }}>
        {[
          { l:"WEIGHT", v:thisWt?`${thisWt}kg`:"—", c:C.text2 },
          { l:"GYM",    v:`${gymCnt}`, c:C.pink },
          { l:"SCREEN", v:avgSc?`${avgSc}h`:"—", c:avgSc&&parseFloat(avgSc)>(data.screenTimeGoal||3)?C.pink:C.green },
          { l:"HABITS", v:habAvg!=null?`${habAvg}%`:"—", c:habAvg>=80?C.green:habAvg>=50?C.orange:C.pink },
        ].map((s,i,arr)=>(
          <div key={s.l} style={{ flex:1, padding:"12px 6px", textAlign:"center",
            borderRight:i<arr.length-1?`1px solid ${C.sep}`:"none" }}>
            <div style={{ ...T.label, color:C.text3, marginBottom:4 }}>{s.l}</div>
            <div style={{ fontSize:17, fontWeight:700, color:s.c, letterSpacing:-0.5 }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Mood — simplified primary action */}
      <GlassCard style={{ padding:"16px", marginBottom:14 }}>
        <Label color={C.text3}>HOW WAS YOUR WEEK?</Label>
        <div style={{ display:"flex", gap:8, marginTop:12 }}>
          {MOODS.map(m=>(
            <button key={m.l} onClick={()=>setMood(m.l)} style={{
              flex:1, background:mood===m.l?"rgba(196,122,255,0.12)":"transparent",
              border:`1px solid ${mood===m.l?C.purple:C.border}`,
              borderRadius:10, padding:"12px 4px", cursor:"pointer",
              display:"flex", flexDirection:"column", alignItems:"center", gap:4,
              transition:"all 0.15s",
              boxShadow:mood===m.l?`0 0 14px rgba(196,122,255,0.18)`:"none",
            }}>
              <span style={{ fontSize:20 }}>{m.e}</span>
              <span style={{ ...T.label, fontSize:8, color:mood===m.l?C.purple:C.text3 }}>{m.l.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Two quick fields — default view */}
      <GlassCard style={{ marginBottom:14, padding:"14px" }}>
        <Label color={C.green}>ONE WIN</Label>
        <Input value={win} onChange={setWin} placeholder="e.g. Hit all my PRs this week" style={{ marginTop:8 }} />
      </GlassCard>

      <GlassCard style={{ marginBottom:14, padding:"14px" }}>
        <Label color={C.pink}>ONE THING TO IMPROVE</Label>
        <Input value={improve} onChange={setImprove} placeholder="e.g. Sleep earlier" style={{ marginTop:8 }} />
      </GlassCard>

      {/* Expandable gym notes */}
      <button onClick={()=>setShowMore(s=>!s)} style={{
        width:"100%", background:"none", border:"none", cursor:"pointer",
        display:"flex", alignItems:"center", justifyContent:"center", gap:6,
        padding:"8px 0", marginBottom:showMore?12:16,
        color:C.text3, ...T.label,
      }}>
        {showMore?"▲ LESS":"▼ ADD GYM NOTES"}
      </button>

      {showMore && (
        <GlassCard style={{ marginBottom:16, padding:"14px" }}>
          <Label color={C.text3}>GYM NOTES ({gymCnt} sessions)</Label>
          <div style={{ marginTop:8 }}>
            <Textarea value={gymNotes} onChange={setGymNotes} placeholder="Lifts, form cues, how it felt..." rows={3} />
          </div>
        </GlassCard>
      )}

      <Btn onClick={saveReview} color={C.purple} style={{ marginBottom:32 }}>Save Review</Btn>
    </div>
  );
}
