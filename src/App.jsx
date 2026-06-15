import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";

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

async function load(key) {
  try { const val = localStorage.getItem(key); return val ? JSON.parse(val) : null; }
  catch { return null; }
}
async function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ── Design Tokens: Sharp File-1 base + File-2 warmth as accents ────────────
const C = {
  pageBg:     "#F5F1E8",
  cardDark:   "#0A0A0A",
  cardPurple: "#3D5AFF",
  cardWhite:  "#FFFFFF",
  cardMid:    "#ECE7DA",
  textDark1:  "#FFFFFF",
  textDark2:  "#C8C8C8",
  textDark3:  "#8A8A8A",
  textLight1: "#0A0A0A",
  textLight2: "#3A3A3A",
  textLight3: "#6E6E6E",
  textLight4: "#B8B2A4",
  purple:     "#3D5AFF",
  purpleDark: "#2840CC",
  lime:       "#CCFF00",
  limeDim:    "#A8D600",
  green:      "#00C853",
  red:        "#FF3D3D",
  orange:     "#FF8A00",
  yellow:     "#FFD700",
  ink:        "#0A0A0A",
  sepDark:    "rgba(255,255,255,0.16)",
};

// Tri-font stack from File 1
const F  = "'Archivo Black','Helvetica Neue',Arial,sans-serif";   // headers
const FB = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";   // body
const FM = "'JetBrains Mono','Courier New',monospace";            // numbers

// Shadow helper: angular hard shadow (File 1) with softness toggle
const HS  = (off=4, col="#0A0A0A") => `${off}px ${off}px 0 ${col}`;
// Soft variant for inner-card elements (File 2 accent)
const HSS = (off=3) => `${off}px ${off}px 0 rgba(0,0,0,0.18)`;

// ── Base Components ─────────────────────────────────────────────────────────
const DarkCard = ({ children, style, onClick, color }) => (
  <div onClick={onClick} style={{
    background: color || C.cardDark,
    borderRadius: 0,
    border: `3px solid ${C.ink}`,
    padding: "20px 18px",
    boxShadow: HS(5),
    cursor: onClick ? "pointer" : undefined,
    transition: "transform 0.08s, box-shadow 0.08s",
    ...style,
  }}>{children}</div>
);

// WhiteCard: angular border but with 8px radius as the File-2 "softness accent"
const WhiteCard = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{
    background: C.cardWhite,
    borderRadius: 8,
    padding: "16px",
    boxShadow: HS(5),
    border: `3px solid ${C.ink}`,
    cursor: onClick ? "pointer" : undefined,
    ...style,
  }}>{children}</div>
);

const Label = ({ children, dark, color, style }) => (
  <div style={{
    fontSize: 11, fontWeight: 800, letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: color || (dark ? C.textDark2 : C.textLight1),
    fontFamily: FB,
    ...style,
  }}>{children}</div>
);

const BigNum = ({ children, color, size }) => (
  <div style={{
    fontSize: size || 56, fontWeight: 900, letterSpacing: "-1px",
    lineHeight: 1, fontVariantNumeric: "tabular-nums",
    color: color || C.textDark1, fontFamily: FM,
  }}>{children}</div>
);

const MedNum = ({ children, color }) => (
  <div style={{
    fontSize: 30, fontWeight: 800, letterSpacing: "-0.5px",
    lineHeight: 1, fontVariantNumeric: "tabular-nums",
    color: color || C.textDark1, fontFamily: FM,
  }}>{children}</div>
);

const Progress = ({ value, color, height=10, bg, style }) => (
  <div style={{ height, background: bg || C.cardWhite, border: `2px solid ${C.ink}`, borderRadius: 0, overflow:"hidden", ...style }}>
    <div style={{
      width: `${Math.min(100,Math.max(0,value))}%`, height:"100%",
      background: color || C.purple,
      borderRight: value > 0 && value < 100 ? `2px solid ${C.ink}` : "none",
      transition: "width 0.4s steps(10)",
    }} />
  </div>
);

const PurpleBtn = ({ children, onClick, disabled, style }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width:"100%", background: disabled ? C.cardMid : C.lime,
    color: disabled ? C.textLight3 : C.ink,
    border:`3px solid ${C.ink}`, borderRadius:0, padding:"15px 20px",
    fontSize:14, fontWeight:900, cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : HS(4),
    transition:"all 0.08s", fontFamily:F,
    letterSpacing:"0.5px", textTransform:"uppercase",
    ...style,
  }}
  onMouseDown={e => { if(!disabled) { e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="translate(4px,4px)"; }}}
  onMouseUp={e => { e.currentTarget.style.boxShadow=disabled?"none":HS(4); e.currentTarget.style.transform="translate(0,0)"; }}
  >{children}</button>
);

const DangerBtn = ({ children, onClick, style }) => (
  <button onClick={onClick} style={{
    width:"100%", background: C.red,
    color:"#FFFFFF",
    border:`3px solid ${C.ink}`, borderRadius:0, padding:"15px 20px",
    fontSize:14, fontWeight:900, cursor:"pointer",
    boxShadow: HS(4),
    transition:"all 0.08s", fontFamily:F,
    letterSpacing:"0.5px", textTransform:"uppercase",
    ...style,
  }}
  onMouseDown={e => { e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="translate(4px,4px)"; }}
  onMouseUp={e => { e.currentTarget.style.boxShadow=HS(4); e.currentTarget.style.transform="translate(0,0)"; }}
  >{children}</button>
);

const GhostBtn = ({ children, onClick, color, style }) => (
  <button onClick={onClick} style={{
    background:C.cardWhite, color: color||C.ink,
    border:`3px solid ${C.ink}`,
    borderRadius:0, padding:"10px 16px",
    fontSize:13, fontWeight:800, cursor:"pointer",
    fontFamily:F, transition:"all 0.08s",
    textTransform:"uppercase", letterSpacing:"0.5px",
    boxShadow: HS(3),
    ...style,
  }}>{children}</button>
);

const TxtBtn = ({ children, onClick, color, style }) => (
  <button onClick={onClick} style={{
    background:"none", border:"none",
    color: color||C.purple, cursor:"pointer",
    fontSize:13, fontWeight:800, padding:"4px 0",
    fontFamily:FB, textTransform:"uppercase", letterSpacing:"0.5px",
    textDecoration:"underline", textDecorationThickness:"2px",
    ...style,
  }}>{children}</button>
);

const Input = ({ value, onChange, placeholder, type="text", style, dark }) => (
  <input
    type={type} value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      background: dark ? "#1A1A1A" : C.cardWhite,
      border:`3px solid ${dark ? "#fff" : C.ink}`,
      borderRadius:0, color: dark ? C.textDark1 : C.textLight1,
      padding:"12px 14px", fontSize:15, width:"100%",
      outline:"none", boxSizing:"border-box",
      WebkitAppearance:"none", fontFamily:FB, fontWeight:600,
      transition:"box-shadow 0.1s",
      ...style,
    }}
    onFocus={e => e.target.style.boxShadow=`4px 4px 0 ${dark?"#fff":C.ink}`}
    onBlur={e => e.target.style.boxShadow="none"}
  />
);

const Textarea = ({ value, onChange, placeholder, rows=3, dark }) => (
  <textarea value={value} onChange={e => onChange(e.target.value)}
    placeholder={placeholder} rows={rows}
    style={{
      background: dark ? "#1A1A1A" : C.cardWhite,
      border:`3px solid ${dark ? "#fff" : C.ink}`,
      borderRadius:0, color: dark ? C.textDark1 : C.textLight1,
      padding:"12px 14px", fontSize:14, width:"100%",
      outline:"none", boxSizing:"border-box",
      resize:"none", fontFamily:FB, fontWeight:600,
    }} />
);

const Pill = ({ children, color, bg }) => {
  const fill = bg || color || C.purple;
  const lightBgs = new Set([C.lime, C.yellow, C.cardWhite, C.cardMid]);
  const onLight = lightBgs.has(fill);
  return (
    <span style={{
      background: fill,
      color: onLight ? C.ink : "#fff",
      border:`2px solid ${C.ink}`,
      borderRadius:0, padding:"3px 10px",
      fontSize:11, fontWeight:800,
      fontFamily:FB, letterSpacing:"0.5px",
      textTransform:"uppercase",
    }}>{children}</span>
  );
};

const Sep = ({ inset=0 }) => (
  <div style={{ height:2, background:C.ink, marginLeft:inset }} />
);

function Sheet({ title, onClose, children, dark }) {
  const bg = dark ? C.cardDark : C.cardWhite;
  const tx = dark ? C.textDark1 : C.textLight1;
  return (
    <div style={{
      position:"fixed", inset:0,
      background:"rgba(10,10,10,0.65)",
      zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center",
    }}>
      <div style={{
        background:bg,
        borderTop:`3px solid ${C.ink}`,
        borderLeft:`3px solid ${C.ink}`,
        borderRight:`3px solid ${C.ink}`,
        borderRadius:"12px 12px 0 0",
        padding:"0 0 48px",
        width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto",
        boxShadow:"0 -6px 0 0 #0A0A0A",
      }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"14px 0 4px" }}>
          <div style={{ width:44, height:5, background: dark?"#fff":C.ink, borderRadius:2 }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 20px 18px" }}>
          <div style={{ fontSize:18, fontWeight:900, color:tx, fontFamily:F, textTransform:"uppercase", letterSpacing:"0.5px" }}>{title}</div>
          <button onClick={onClose} style={{
            background:C.lime, border:`2px solid ${C.ink}`, color:C.ink,
            width:30, height:30, borderRadius:0, cursor:"pointer", fontSize:14, fontWeight:900,
            display:"flex", alignItems:"center", justifyContent:"center", fontFamily:F,
          }}>✕</button>
        </div>
        <div style={{ padding:"0 20px" }}>{children}</div>
      </div>
    </div>
  );
}

function Toast({ msg }) {
  return (
    <div style={{
      position:"fixed", top:24, left:"50%", transform:"translateX(-50%)",
      background:C.lime, color:C.ink,
      padding:"11px 20px", borderRadius:0,
      border:`3px solid ${C.ink}`,
      fontSize:13, fontWeight:800, zIndex:999,
      whiteSpace:"nowrap", boxShadow:HS(4),
      fontFamily:F, textTransform:"uppercase", letterSpacing:"0.5px",
    }}>{msg}</div>
  );
}

function NavBar({ title, onBack, right, sub }) {
  return (
    <div style={{ paddingTop:16, paddingBottom:16 }}>
      <button onClick={onBack} style={{
        background:"none", border:"none", color:C.purple, cursor:"pointer",
        fontSize:13, fontWeight:800, padding:"4px 0",
        fontFamily:FB, display:"flex", alignItems:"center", gap:4,
        textTransform:"uppercase", letterSpacing:"0.5px",
        textDecoration:"underline", textDecorationThickness:"2px",
      }}>← Back</button>
      <div style={{ marginTop:10, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize:26, fontWeight:900, letterSpacing:"-0.5px", color:C.textLight1, fontFamily:F, textTransform:"uppercase" }}>{title}</div>
          {sub && <div style={{ fontSize:11, fontWeight:800, color:C.textLight3, marginTop:3, fontFamily:FB, letterSpacing:"1px", textTransform:"uppercase" }}>{sub}</div>}
        </div>
        {right}
      </div>
    </div>
  );
}

function InlineLog({ value, unit, color, onSave, dark }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState("");
  const ref = useRef(null);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  const submit = () => { const n = parseFloat(v); if (!isNaN(n)) onSave(n); setEditing(false); setV(""); };
  if (editing) return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <input ref={ref} type="number" value={v} onChange={e => setV(e.target.value)}
        onBlur={submit} onKeyDown={e => e.key==="Enter" && submit()}
        style={{
          background:"transparent", border:"none",
          borderBottom:`3px solid ${color||C.lime}`,
          color: dark ? C.textDark1 : C.textLight1,
          fontSize:24, fontWeight:800, width:76,
          outline:"none", fontFamily:FM, WebkitAppearance:"none", padding:"2px 0",
        }} />
      {unit && <span style={{ fontSize:12, fontWeight:700, color: dark ? C.textDark3 : C.textLight3, fontFamily:FB }}>{unit}</span>}
    </div>
  );
  return (
    <div onClick={() => setEditing(true)} style={{ cursor:"pointer", display:"flex", alignItems:"baseline", gap:5 }}>
      <span style={{ fontSize:24, fontWeight:800, color: value!=null ? (color||C.textDark1) : (dark?C.textDark3:C.textLight4), fontVariantNumeric:"tabular-nums", letterSpacing:"-0.5px", fontFamily:FM }}>
        {value!=null ? value : "—"}
      </span>
      {value!=null && unit && <span style={{ fontSize:12, fontWeight:700, color: dark ? C.textDark3 : C.textLight3, fontFamily:FB }}>{unit}</span>}
      {value==null && <span style={{ fontSize:10, fontWeight:900, color:C.lime, marginLeft:2, letterSpacing:"0.5px", fontFamily:F, background:C.ink, padding:"2px 6px", border:`2px solid ${C.ink}` }}>TAP</span>}
    </div>
  );
}

function getInsight(data) {
  const sessions = data.sessions || [];
  const habits = data.habits || [];
  const today = new Date(); today.setHours(0,0,0,0);
  const mo = sessions.filter(s => s.date.startsWith(monthKey())).length;
  if (mo > 0) return `${mo} workout${mo>1?"s":""} logged this month`;
  const best = habits.reduce((mx,h) => {
    let s = 0; const d = new Date(today);
    for (let i = 0; i < 60; i++) { if (h.completions?.[dateKey(d)]==="done") { s++; d.setDate(d.getDate()-1); } else break; }
    return s > mx ? s : mx;
  }, 0);
  if (best >= 5) return `${best}-day habit streak — incredible`;
  return null;
}

// ── Onboarding ──────────────────────────────────────────────────────────────
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [startW, setStartW] = useState("");
  const [targetW, setTargetW] = useState("");
  const [scGoal, setScGoal] = useState("3");
  const [habit1, setHabit1] = useState("");

  const steps = [
    {
      emoji:"👋", title:"Welcome", sub:"Your 184-day transformation starts here",
      content:(
        <div>
          <Label dark>Your name</Label>
          <Input dark value={name} onChange={setName} placeholder="e.g. Sanjay" style={{ marginTop:8 }} />
        </div>
      ),
      canNext: () => name.trim().length > 0,
    },
    {
      emoji:"⚖️", title:"Weight Goal", sub:"Track your body transformation",
      content:(
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div><Label dark>Current (kg)</Label><Input dark value={startW} onChange={setStartW} placeholder="85" type="number" style={{ marginTop:8 }} /></div>
          <div><Label dark>Target (kg)</Label><Input dark value={targetW} onChange={setTargetW} placeholder="75" type="number" style={{ marginTop:8 }} /></div>
        </div>
      ),
      canNext: () => true,
    },
    {
      emoji:"📱", title:"Screen Time", sub:"Set your daily limit",
      content:(
        <div>
          <div style={{ display:"flex", gap:10, marginBottom:16 }}>
            {["2","3","4","5"].map(h => (
              <button key={h} onClick={() => setScGoal(h)} style={{
                flex:1, padding:"14px 0",
                background: scGoal===h ? C.lime : "#1A1A1A",
                color: scGoal===h ? C.ink : C.textDark2,
                border:`3px solid ${scGoal===h ? C.ink : "#fff"}`,
                borderRadius:0, cursor:"pointer",
                fontSize:18, fontWeight:900, fontFamily:F,
                boxShadow: scGoal===h ? HS(3) : "none",
              }}>{h}<span style={{ fontSize:11, fontWeight:700 }}>h</span></button>
            ))}
          </div>
          <div style={{ fontSize:12, fontWeight:700, color:C.textDark3, textAlign:"center", fontFamily:FB, textTransform:"uppercase", letterSpacing:"1px" }}>hours per day</div>
        </div>
      ),
      canNext: () => true,
    },
    {
      emoji:"✅", title:"First Habit", sub:"One daily habit to start with",
      content:(
        <div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
            {["Drink 3L water","Read 30 mins","Meditate","No junk food","Sleep by 11pm","Walk 30 mins"].map(h => (
              <button key={h} onClick={() => setHabit1(h)} style={{
                padding:"8px 14px",
                background: habit1===h ? C.lime : "#1A1A1A",
                color: habit1===h ? C.ink : C.textDark2,
                border:`2px solid ${habit1===h ? C.ink : "#fff"}`,
                borderRadius:0, cursor:"pointer",
                fontSize:12, fontWeight:700, fontFamily:FB,
                textTransform:"uppercase", letterSpacing:"0.5px",
              }}>{h}</button>
            ))}
          </div>
          <Label dark>Or type your own</Label>
          <Input dark value={habit1} onChange={setHabit1} placeholder="e.g. Cold shower" style={{ marginTop:8 }} />
        </div>
      ),
      canNext: () => true,
    },
  ];

  const cur = steps[step];
  const isLast = step === steps.length - 1;

  const handleNext = async () => {
    if (!cur.canNext()) return;
    if (isLast) {
      const habits = habit1.trim() ? [{ id:Date.now(), name:habit1.trim(), completions:{} }] : [];
      const initData = {
        name: name.trim()||"there",
        habits, routines:[], sessions:[], goals:[],
        weights:{}, photos:{}, screenTime:{},
        screenTimeGoal: parseFloat(scGoal)||3,
        weightStart: parseFloat(startW)||null,
        weightTarget: parseFloat(targetW)||null,
        reviews:{}, noZeroCheckins:{}, onboarded:true,
      };
      await save("tracker-v2", initData);
      onDone(initData);
    } else {
      setStep(s => s+1);
    }
  };

  return (
    <div style={{
      minHeight:"100vh", background:C.cardDark,
      display:"flex", flexDirection:"column", justifyContent:"center",
      padding:"0 24px 48px", maxWidth:430, margin:"0 auto", fontFamily:FB,
    }}>
      <div style={{ display:"flex", gap:6, marginBottom:52, justifyContent:"center" }}>
        {steps.map((_,i) => (
          <div key={i} style={{
            width: i===step ? 28 : 8, height:8, borderRadius:0,
            background: i<=step ? C.lime : "#333",
            border:`2px solid ${i<=step ? C.ink : "#333"}`,
            transition:"all 0.3s",
          }} />
        ))}
      </div>
      <div style={{ fontSize:52, marginBottom:24, textAlign:"center" }}>{cur.emoji}</div>
      <div style={{ textAlign:"center", marginBottom:36 }}>
        <div style={{ fontSize:34, fontWeight:900, letterSpacing:"-0.5px", color:C.textDark1, marginBottom:10, fontFamily:F, textTransform:"uppercase" }}>{cur.title}</div>
        <div style={{ fontSize:14, fontWeight:600, color:C.textDark2, fontFamily:FB }}>{cur.sub}</div>
      </div>
      <div style={{ marginBottom:36 }}>{cur.content}</div>
      <PurpleBtn onClick={handleNext}>
        {isLast ? `Let's go, ${name||"there"} →` : "Continue →"}
      </PurpleBtn>
      {step > 0 && (
        <div style={{ textAlign:"center", marginTop:16 }}>
          <TxtBtn onClick={() => setStep(s => s-1)} color={C.textDark3}>← Back</TxtBtn>
        </div>
      )}
    </div>
  );
}

// ── App Shell ───────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [sundayBanner, setSundayBanner] = useState(false);
  const [quickStart, setQuickStart] = useState(false);

  useEffect(() => {
    (async () => {
      const d = await load("tracker-v2");
      if (d) setData(d);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded || !data) return;
    if (isSunday()) {
      load(`dismissed-${getThisSundayKey()}`).then(v => { if (!v) setTimeout(() => setSundayBanner(true), 600); });
    }
  }, [loaded, data]);

  const persist = useCallback(async (next) => { setData(next); await save("tracker-v2", next); }, []);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const handleFullReset = async () => {
    localStorage.removeItem("tracker-v2");
    setData(null);
  };

  if (!loaded) return (
    <div style={{ background:C.cardDark, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:14, fontFamily:F }}>
      <div style={{ width:32, height:32, border:`4px solid #333`, borderTopColor:C.lime, borderRadius:"50%", animation:"spin 0.6s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!data || !data.onboarded) return <Onboarding onDone={initData => setData(initData)} />;

  const TABS = [
    { id:"dashboard", label:"Home",     sym:"⌂" },
    { id:"habits",    label:"Habits",   sym:"◉" },
    { id:"fitness",   label:"Train",    sym:"↑" },
    { id:"goals",     label:"Goals",    sym:"◎" },
    { id:"challenge", label:"Progress", sym:"⬡" },
  ];

  return (
    <div style={{ background:C.pageBg, minHeight:"100vh", maxWidth:430, margin:"0 auto", fontFamily:FB, color:C.textLight1, paddingBottom:96 }}>
      {toast && <Toast msg={toast} />}

      <div style={{ padding:"0 14px" }}>
        {tab==="dashboard" && <Dashboard data={data} persist={persist} showToast={showToast} onReview={() => setTab("review")} onQuickStart={() => setQuickStart(true)} />}
        {tab==="habits"    && <Habits    data={data} persist={persist} showToast={showToast} />}
        {tab==="fitness"   && <Fitness   data={data} persist={persist} showToast={showToast} />}
        {tab==="goals"     && <Goals     data={data} persist={persist} showToast={showToast} />}
        {tab==="challenge" && <Challenge data={data} persist={persist} showToast={showToast} onReset={handleFullReset} />}
        {tab==="review"    && <WeeklyReview data={data} persist={persist} showToast={showToast} onBack={() => setTab("dashboard")} />}
      </div>

      {quickStart && (
        <Sheet title="Start Workout" onClose={() => setQuickStart(false)} dark>
          {data.routines.length===0
            ? <div style={{ textAlign:"center", padding:"40px 0", fontSize:14, fontWeight:700, color:C.textDark2, fontFamily:FB, textTransform:"uppercase", letterSpacing:"0.5px" }}>No routines yet. Go to Train to create one.</div>
            : data.routines.map(r => {
                const last = [...data.sessions].filter(s => s.routineId===r.id).sort((a,b) => b.date.localeCompare(a.date))[0];
                return (
                  <DarkCard key={r.id} style={{ marginBottom:12 }}>
                    <div style={{ fontSize:18, fontWeight:900, color:C.textDark1, marginBottom:4, fontFamily:F, textTransform:"uppercase" }}>{r.name}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:C.textDark3, marginBottom:14, fontFamily:FB }}>{r.exercises.map(e=>e.name).join(" · ").slice(0,50)}</div>
                    {last && <div style={{ fontSize:10, fontWeight:800, color:C.lime, marginBottom:12, letterSpacing:"1px", fontFamily:FB }}>LAST: {last.date}</div>}
                    <PurpleBtn onClick={() => { setQuickStart(false); setTab("fitness"); setTimeout(() => window._startRoutine?.(r.id), 120); }}>
                      ▶ Start {r.name}
                    </PurpleBtn>
                  </DarkCard>
                );
              })
          }
        </Sheet>
      )}

      {sundayBanner && tab!=="review" && (
        <div style={{
          position:"fixed", bottom:108, left:14, right:14, maxWidth:402, margin:"0 auto",
          background:C.lime, borderRadius:0, padding:"14px 16px", zIndex:90,
          display:"flex", alignItems:"center", gap:12,
          boxShadow:HS(5), border:`3px solid ${C.ink}`,
        }}>
          <div style={{ fontSize:22 }}>📋</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:900, color:C.ink, fontFamily:F, textTransform:"uppercase" }}>Weekly Review</div>
            <div style={{ fontSize:10, fontWeight:800, color:C.textLight2, marginTop:1, letterSpacing:"1px", fontFamily:FB }}>SUNDAY CHECK-IN</div>
          </div>
          <TxtBtn onClick={() => { setTab("review"); setSundayBanner(false); save(`dismissed-${getThisSundayKey()}`,true); }} color={C.ink}>Open</TxtBtn>
          <button onClick={() => { setSundayBanner(false); save(`dismissed-${getThisSundayKey()}`,true); }} style={{ background:"none", border:"none", color:C.ink, cursor:"pointer", fontSize:18, fontWeight:900, padding:4 }}>×</button>
        </div>
      )}

      {/* Tab Bar */}
      <div style={{
        position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
        width:"100%", maxWidth:430,
        background:C.cardDark,
        borderTop:`3px solid ${C.ink}`,
        display:"flex", paddingBottom:20, paddingTop:10,
        zIndex:100,
      }}>
        {TABS.map(t => {
          const active = tab===t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, background:"none", border:"none", padding:"4px 0 2px",
              cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4,
            }}>
              <span style={{
                fontSize:16, color: active ? C.ink : C.textDark2,
                background: active ? C.lime : "transparent",
                border: active ? `2px solid ${C.ink}` : "2px solid transparent",
                width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center",
              }}>{t.sym}</span>
              <span style={{ fontSize:9, fontWeight: active ? 900 : 700, color: active ? C.lime : C.textDark3, letterSpacing:"0.8px", fontFamily:FB }}>
                {t.label.toUpperCase()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({ data, persist, showToast, onReview, onQuickStart }) {
  const dayNum = getDayNumber();
  const pct = Math.round((dayNum/TOTAL_DAYS)*100);
  const today = todayKey();
  const wk = weekKey();
  const insight = getInsight(data);
  const userName = data.name||"there";

  const [setupSheet, setSetupSheet] = useState(false);
  const [startW, setStartW] = useState(data.weightStart ? String(data.weightStart) : "");
  const [targetW, setTargetW] = useState(data.weightTarget ? String(data.weightTarget) : "");
  const [scGoalI, setScGoalI] = useState(String(data.screenTimeGoal||3));
  const [showMore, setShowMore] = useState(false);

  const totalH = data.habits.length;
  const doneH = data.habits.filter(h => h.completions?.[today]==="done").length;
  const allDone = totalH>0 && doneH===totalH;
  const thisWt = data.weights?.[wk];
  const todaySc = data.screenTime?.[today];
  const scGoal = data.screenTimeGoal||3;
  const workedOut = data.sessions.some(s => s.date===today);
  const didToday = doneH>0 || workedOut || todaySc!=null || data.noZeroCheckins?.[today];

  const nzStreak = (() => {
    let s=0; const d=new Date(); d.setHours(0,0,0,0);
    for (let i=0; i<365; i++) {
      const k=dateKey(d);
      if (data.habits.some(h=>h.completions?.[k]==="done")||data.sessions.some(s=>s.date===k)||data.screenTime?.[k]!=null||data.noZeroCheckins?.[k]) { s++; d.setDate(d.getDate()-1); }
      else break;
    }
    return s;
  })();

  const logWeight = async (v) => { await persist({ ...data, weights:{ ...data.weights, [wk]:v } }); showToast("Weight logged ✓"); };
  const logScreen = async (v) => { await persist({ ...data, screenTime:{ ...data.screenTime, [today]:v } }); showToast("Screen time logged ✓"); };
  const markNZ = async () => { await persist({ ...data, noZeroCheckins:{ ...data.noZeroCheckins, [today]:true } }); showToast("No zero day ✓"); };

  const saveSetup = async () => {
    const s=parseFloat(startW), t=parseFloat(targetW), g=parseFloat(scGoalI);
    await persist({ ...data, weightStart:isNaN(s)?data.weightStart:s, weightTarget:isNaN(t)?data.weightTarget:t, screenTimeGoal:isNaN(g)?data.screenTimeGoal:g });
    setSetupSheet(false); showToast("Saved ✓");
  };

  const wtPct = (() => {
    if (!data.weightStart||!data.weightTarget||!thisWt) return null;
    const t=Math.abs(data.weightTarget-data.weightStart); if (!t) return 100;
    return Math.min(100, Math.round((Math.abs(thisWt-data.weightStart)/t)*100));
  })();

  const cycleHabit = async (id) => {
    const habits = data.habits.map(h => {
      if (h.id!==id) return h;
      const cur=h.completions?.[today]||null;
      const next=cur===null?"done":cur==="done"?"missed":null;
      const comp={ ...h.completions, [today]:next };
      let streak=0; const d=new Date(); d.setHours(0,0,0,0);
      for (let i=0; i<365; i++) { const k=dateKey(d); if (comp[k]==="done") { streak++; d.setDate(d.getDate()-1); } else break; }
      return { ...h, completions:comp, streak };
    });
    await persist({ ...data, habits });
  };

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
  const dateStr = now.toLocaleDateString("en-US", { weekday:"long", month:"short", day:"numeric" });

  return (
    <div style={{ paddingTop:56 }}>
      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:11, fontWeight:800, color:C.textLight3, letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:6, fontFamily:FB }}>{dateStr}</div>
        <div style={{ fontSize:30, fontWeight:900, color:C.textLight1, letterSpacing:"-1px", fontFamily:F, textTransform:"uppercase" }}>{greeting}, {userName}</div>
        {insight && (
          <div style={{ display:"inline-block", marginTop:8, background:C.lime, border:`2px solid ${C.ink}`, padding:"3px 10px", fontSize:12, fontWeight:700, color:C.ink, fontFamily:FB }}>{insight}</div>
        )}
      </div>

      {/* Challenge card */}
      <DarkCard style={{ marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
          <div>
            <Label dark style={{ marginBottom:8 }}>184-Day Challenge</Label>
            <BigNum color={C.textDark1}>{dayNum}</BigNum>
            <div style={{ fontSize:12, fontWeight:700, color:C.textDark3, marginTop:6, fontFamily:FB, textTransform:"uppercase", letterSpacing:"0.5px" }}>of {TOTAL_DAYS} days</div>
          </div>
          {nzStreak>0 && (
            <div style={{ textAlign:"right" }}>
              <Label dark>Streak</Label>
              <MedNum color={C.lime}>{nzStreak}</MedNum>
              <div style={{ fontSize:11, fontWeight:700, color:C.textDark3, marginTop:4, fontFamily:FB, textTransform:"uppercase" }}>days 🔥</div>
            </div>
          )}
        </div>
        <Progress value={pct} color={C.lime} height={10} bg="#1A1A1A" />
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
          <span style={{ fontSize:11, color:C.textDark2, fontWeight:800, fontFamily:FM }}>{pct}% COMPLETE</span>
          <span style={{ fontSize:11, color:C.textDark2, fontWeight:800, fontFamily:FM }}>{TOTAL_DAYS-dayNum} LEFT</span>
        </div>
      </DarkCard>

      {/* Start Workout CTA */}
      <div style={{
        background:C.lime, border:`3px solid ${C.ink}`, borderRadius:0, padding:"16px 18px", marginBottom:14,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        boxShadow:HS(5), cursor:"pointer",
      }} onClick={onQuickStart}>
        <div>
          <div style={{ fontSize:18, fontWeight:900, color:C.ink, fontFamily:F, textTransform:"uppercase" }}>Start Workout</div>
          <div style={{ fontSize:12, fontWeight:700, color:C.textLight2, marginTop:3, fontFamily:FB }}>
            {data.routines.length>0 ? data.routines[0].name : "Create a routine first"}
          </div>
        </div>
        <div style={{ width:42, height:42, background:C.ink, border:`2px solid ${C.ink}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, color:C.lime }}>▶</div>
      </div>

      {/* Habits card — white with 8px radius (File-2 softness accent) */}
      <WhiteCard style={{ marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ fontSize:14, fontWeight:900, color:C.textLight1, fontFamily:F, textTransform:"uppercase" }}>Today's Habits</div>
          <Pill color={allDone ? C.green : C.purple} bg={allDone ? C.green : C.purple}>{doneH} / {totalH}</Pill>
        </div>
        {totalH>0 && <Progress value={totalH ? (doneH/totalH)*100 : 0} color={allDone?C.green:C.purple} height={6} bg={C.cardMid} />}
        {totalH===0
          ? <div style={{ paddingTop:12, fontSize:13, fontWeight:700, color:C.textLight3, fontFamily:FB }}>Add habits in the Habits tab</div>
          : <div style={{ marginTop:4 }}>
              {data.habits.map((h,idx) => {
                const state=h.completions?.[today]||null;
                const done=state==="done"; const missed=state==="missed";
                return (
                  <div key={h.id}>
                    <button onClick={() => cycleHabit(h.id)} style={{
                      width:"100%", background:"none", border:"none", cursor:"pointer",
                      display:"flex", alignItems:"center", gap:12, padding:"13px 0", textAlign:"left",
                    }}>
                      <div style={{
                        width:26, height:26, borderRadius:0, flexShrink:0,
                        border:`2.5px solid ${C.ink}`,
                        background: done?C.green:missed?C.red:C.cardWhite,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:14, fontWeight:900, color: done||missed?"#fff":C.textLight4,
                        transition:"all 0.08s",
                      }}>
                        {done?"✓":missed?"✕":""}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:700, color: missed?C.textLight4:C.textLight1, textDecoration: missed?"line-through":"none", fontFamily:FB }}>{h.name}</div>
                        {h.streak>0 && <div style={{ fontSize:10, fontWeight:800, color:C.orange, marginTop:2, fontFamily:FB, letterSpacing:"0.5px" }}>{h.streak}D STREAK</div>}
                      </div>
                      {done && <Pill color={C.green} bg={C.green}>✓</Pill>}
                    </button>
                    {idx<data.habits.length-1 && <Sep inset={38} />}
                  </div>
                );
              })}
            </div>
        }
      </WhiteCard>

      {/* Stats — dark purple */}
      <DarkCard color={C.cardPurple} style={{ marginBottom:14 }}>
        <div style={{ display:"flex" }}>
          <div style={{ flex:1, paddingRight:16, borderRight:`2px solid ${C.ink}` }}>
            <Label dark color="#D8DEFF">Weight</Label>
            <div style={{ marginTop:8 }}><InlineLog dark value={thisWt} unit="kg" color={C.textDark1} onSave={logWeight} /></div>
            {data.weightTarget && thisWt && <div style={{ fontSize:10, fontWeight:800, color:"#D8DEFF", marginTop:4, fontFamily:FB }}>{wtPct}% TO GOAL</div>}
          </div>
          <div style={{ flex:1, paddingLeft:16, paddingRight:16, borderRight:`2px solid ${C.ink}` }}>
            <Label dark color="#D8DEFF">Screen</Label>
            <div style={{ marginTop:8 }}><InlineLog dark value={todaySc} unit="h" color={todaySc>scGoal?C.red:C.textDark1} onSave={logScreen} /></div>
            <div style={{ fontSize:10, fontWeight:800, color:"#D8DEFF", marginTop:4, fontFamily:FB }}>GOAL {scGoal}H</div>
          </div>
          <div style={{ flex:1, paddingLeft:16 }}>
            <Label dark color="#D8DEFF">Workout</Label>
            <div style={{ fontSize:26, marginTop:8, fontWeight:900, color: workedOut?C.lime:"#D8DEFF" }}>{workedOut?"✓":"—"}</div>
            <div style={{ fontSize:10, fontWeight:800, color:"#D8DEFF", marginTop:4, fontFamily:FB }}>{workedOut?"DONE":"TODAY"}</div>
          </div>
        </div>
        {data.weightTarget && thisWt && (
          <div style={{ marginTop:14 }}>
            <Progress value={wtPct||0} color={wtPct>=100?C.lime:C.cardWhite} height={6} bg="#2840CC" />
          </div>
        )}
      </DarkCard>

      {/* No zero day */}
      {!didToday && (
        <DarkCard style={{ marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ fontSize:28 }}>⚡</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:900, color:C.textDark1, fontFamily:F, textTransform:"uppercase" }}>Don't zero today</div>
              <div style={{ fontSize:12, fontWeight:700, color:C.textDark3, marginTop:3, fontFamily:FB }}>Do at least one thing</div>
            </div>
            <button onClick={markNZ} style={{
              background:C.lime, color:C.ink, border:`2px solid ${C.ink}`,
              borderRadius:0, padding:"10px 16px",
              fontSize:12, fontWeight:900, cursor:"pointer", fontFamily:F, boxShadow:HS(3),
            }}>DONE</button>
          </div>
        </DarkCard>
      )}

      {/* More */}
      <button onClick={() => setShowMore(s=>!s)} style={{
        width:"100%", background:"none", border:"none", cursor:"pointer",
        display:"flex", alignItems:"center", justifyContent:"center", gap:4,
        padding:"10px 0", marginBottom: showMore ? 12 : 0,
        color:C.textLight3, fontSize:11, fontWeight:800, fontFamily:FB,
        textTransform:"uppercase", letterSpacing:"1px",
      }}>
        {showMore ? "▲ less" : "▼ more"}
      </button>

      {showMore && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:8 }}>
          {[
            { icon:"📋", label:"Weekly\nReview", action:onReview },
            { icon:"⚙", label:"Settings", action:() => { setStartW(data.weightStart?String(data.weightStart):""); setTargetW(data.weightTarget?String(data.weightTarget):""); setScGoalI(String(data.screenTimeGoal||3)); setSetupSheet(true); } },
            { icon:"💾", label:"Export", action:() => { try { const b=new Blob([JSON.stringify(data,null,2)],{ type:"application/json" }); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download=`tracker-${todayKey()}.json`; a.click(); URL.revokeObjectURL(u); showToast("Exported ✓"); } catch { showToast("Failed"); } } },
          ].map(a => (
            <WhiteCard key={a.label} onClick={a.action} style={{ padding:"14px 8px", cursor:"pointer" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:20 }}>{a.icon}</span>
                <div style={{ fontSize:10, fontWeight:800, color:C.textLight1, textAlign:"center", lineHeight:1.6, whiteSpace:"pre-line", fontFamily:FB, textTransform:"uppercase", letterSpacing:"0.5px" }}>{a.label}</div>
              </div>
            </WhiteCard>
          ))}
        </div>
      )}

      {setupSheet && (
        <Sheet title="Settings" onClose={() => setSetupSheet(false)} dark>
          <Label dark>Starting weight (kg)</Label>
          <Input dark value={startW} onChange={setStartW} placeholder="85" type="number" style={{ marginTop:8, marginBottom:16 }} />
          <Label dark>Target weight (kg)</Label>
          <Input dark value={targetW} onChange={setTargetW} placeholder="75" type="number" style={{ marginTop:8, marginBottom:16 }} />
          <Label dark>Screen time goal (hrs/day)</Label>
          <Input dark value={scGoalI} onChange={setScGoalI} placeholder="3" type="number" style={{ marginTop:8, marginBottom:24 }} />
          <PurpleBtn onClick={saveSetup}>Save</PurpleBtn>
        </Sheet>
      )}
    </div>
  );
}

// ── Habits ──────────────────────────────────────────────────────────────────
function Habits({ data, persist, showToast }) {
  const [addSheet, setAddSheet] = useState(false);
  const [name, setName] = useState("");
  const today = todayKey();
  const days = last7();

  const addHabit = async () => {
    if (!name.trim()) return;
    await persist({ ...data, habits:[...data.habits, { id:Date.now(), name:name.trim(), completions:{} }] });
    setName(""); setAddSheet(false); showToast("Habit added ✓");
  };
  const cycle = async (id, key) => {
    const habits = data.habits.map(h => {
      if (h.id!==id) return h;
      const cur=h.completions?.[key]||null;
      const next=cur===null?"done":cur==="done"?"missed":null;
      const comp={ ...h.completions, [key]:next };
      let streak=0; const d=new Date(); d.setHours(0,0,0,0);
      for (let i=0; i<365; i++) { const k=dateKey(d); if (comp[k]==="done") { streak++; d.setDate(d.getDate()-1); } else break; }
      return { ...h, completions:comp, streak };
    });
    await persist({ ...data, habits });
  };
  const del = async (id) => { await persist({ ...data, habits:data.habits.filter(h=>h.id!==id) }); showToast("Removed"); };

  const doneToday = data.habits.filter(h => h.completions?.[today]==="done").length;
  const habitPct = data.habits.length ? Math.round((doneToday/data.habits.length)*100) : 0;
  const allDone = data.habits.length>0 && doneToday===data.habits.length;

  const chartData = [...days].reverse().map(d => ({
    day: d.day.slice(0,1),
    pct: data.habits.length ? Math.round((data.habits.filter(h=>h.completions?.[d.key]==="done").length/data.habits.length)*100) : 0
  }));

  return (
    <div style={{ paddingTop:56 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div style={{ fontSize:30, fontWeight:900, letterSpacing:"-1px", color:C.textLight1, fontFamily:F, textTransform:"uppercase" }}>Habits</div>
        <TxtBtn onClick={() => setAddSheet(true)} style={{ paddingTop:10 }}>+ Add</TxtBtn>
      </div>

      {data.habits.length>0 && (
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18 }}>
          <Progress value={habitPct} color={allDone?C.green:C.purple} height={8} bg={C.cardWhite} style={{ flex:1 }} />
          <span style={{ fontSize:12, fontWeight:800, color:C.textLight1, flexShrink:0, fontFamily:FM }}>{doneToday}/{data.habits.length}</span>
        </div>
      )}

      {data.habits.length===0 && (
        <div style={{ textAlign:"center", padding:"72px 0 32px" }}>
          <div style={{ fontSize:44, marginBottom:14 }}>◉</div>
          <div style={{ fontSize:16, fontWeight:800, color:C.textLight3, marginBottom:10, fontFamily:FB, textTransform:"uppercase" }}>No habits yet</div>
          <TxtBtn onClick={() => setAddSheet(true)}>Add your first habit</TxtBtn>
        </div>
      )}

      {data.habits.length>0 && (
        <>
          {/* Day headers */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr repeat(7,38px)", gap:3, marginBottom:6, alignItems:"end" }}>
            <div />
            {days.map(d => (
              <div key={d.key} style={{ textAlign:"center" }}>
                <div style={{ fontSize:8, fontWeight:800, color:C.textLight4, marginBottom:3, letterSpacing:"1px", fontFamily:FB }}>{d.day.slice(0,2)}</div>
                <div style={{
                  fontSize:11, fontWeight: d.key===today ? 900 : 700,
                  color: d.key===today ? C.ink : C.textLight3,
                  background: d.key===today ? C.lime : "transparent",
                  border: d.key===today ? `2px solid ${C.ink}` : "none",
                  width:26, height:26,
                  display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto",
                  fontFamily:FM,
                }}>{d.date}</div>
              </div>
            ))}
          </div>

          <WhiteCard style={{ overflow:"hidden", marginBottom:16, padding:0 }}>
            {data.habits.map((h,idx) => (
              <div key={h.id}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr repeat(7,38px)", gap:3, alignItems:"center", padding:"8px 14px", minHeight:56 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", color:C.textLight1, fontFamily:FB }}>{h.name}</div>
                      {h.streak>0 && <div style={{ fontSize:10, fontWeight:800, color:C.orange, marginTop:2, fontFamily:FB }}>{h.streak}D 🔥</div>}
                    </div>
                    <button onClick={() => del(h.id)} style={{ background:"none", border:"none", color:C.textLight4, cursor:"pointer", fontSize:16, fontWeight:900, padding:4, flexShrink:0 }}>×</button>
                  </div>
                  {days.map(d => {
                    const state=h.completions?.[d.key]||null;
                    const done=state==="done"; const missed=state==="missed";
                    return (
                      <button key={d.key} onClick={() => cycle(h.id, d.key)} style={{
                        width:34, height:34, borderRadius:0,
                        border:`2px solid ${C.ink}`,
                        background: done?C.green:missed?C.red:C.cardWhite,
                        color: done||missed?"#fff":C.textLight4,
                        fontSize:14, fontWeight:900, cursor:"pointer",
                        display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto",
                        transition:"all 0.06s",
                      }}>{done?"✓":missed?"✕":""}</button>
                    );
                  })}
                </div>
                {idx<data.habits.length-1 && <Sep inset={14} />}
              </div>
            ))}
          </WhiteCard>

          <WhiteCard style={{ padding:"14px", marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:800, color:C.textLight1, letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:10, fontFamily:FB }}>7-day completion</div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={chartData} barSize={20}>
                <XAxis dataKey="day" tick={{ fill:C.textLight3, fontSize:10, fontFamily:FB, fontWeight:700 }} axisLine={false} tickLine={false} />
                <Bar dataKey="pct" fill={C.purple} stroke={C.ink} strokeWidth={2} />
                <Tooltip formatter={v=>`${v}%`} contentStyle={{ background:C.ink, border:`2px solid ${C.ink}`, fontSize:11, borderRadius:0, color:"#fff", fontFamily:FM, fontWeight:700 }} />
              </BarChart>
            </ResponsiveContainer>
          </WhiteCard>
        </>
      )}

      {addSheet && (
        <Sheet title="New Habit" onClose={() => setAddSheet(false)}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
            {["Drink 3L water","Read 30 mins","Meditate","No junk food","Walk 30 mins","Cold shower"].map(h => (
              <button key={h} onClick={() => setName(h)} style={{
                padding:"7px 14px",
                background: name===h ? C.lime : C.cardWhite,
                color:C.ink,
                border:`2px solid ${C.ink}`,
                borderRadius:0, cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:FB,
                textTransform:"uppercase", letterSpacing:"0.5px",
              }}>{h}</button>
            ))}
          </div>
          <Input value={name} onChange={setName} placeholder="Or type your own habit..." style={{ marginBottom:16 }} />
          <PurpleBtn onClick={addHabit}>Add Habit</PurpleBtn>
        </Sheet>
      )}
    </div>
  );
}

// ── Fitness ─────────────────────────────────────────────────────────────────
function Fitness({ data, persist, showToast }) {
  const [view, setView] = useState("home");
  const [editR, setEditR] = useState(null);
  const [activeR, setActiveR] = useState(null);
  const [histR, setHistR] = useState(null);

  useEffect(() => {
    window._startRoutine = (id) => {
      const r = data.routines.find(r=>r.id===id);
      if (r) { setActiveR(r); setView("session"); }
    };
    return () => { delete window._startRoutine; };
  }, [data.routines]);

  const RoutineEditor = ({ routine, onDone }) => {
    const [rName, setRName] = useState(routine?.name||"");
    const [exList, setExList] = useState(routine?.exercises||[{ name:"", defaultSets:"3", defaultReps:"10" }]);
    const addEx = () => setExList([...exList, { name:"", defaultSets:"3", defaultReps:"10" }]);
    const updEx = (i,f,v) => setExList(exList.map((e,idx)=>idx===i?{ ...e,[f]:v }:e));
    const remEx = (i) => setExList(exList.filter((_,idx)=>idx!==i));
    const saveR = async () => {
      if (!rName.trim()) return;
      const valid=exList.filter(e=>e.name.trim()); if (!valid.length) return;
      if (routine) { await persist({ ...data, routines:data.routines.map(r=>r.id===routine.id?{ ...r, name:rName, exercises:valid }:r) }); showToast("Updated ✓"); }
      else { await persist({ ...data, routines:[...data.routines, { id:Date.now(), name:rName, exercises:valid }] }); showToast("Created ✓"); }
      onDone();
    };
    const delR = async () => { await persist({ ...data, routines:data.routines.filter(r=>r.id!==routine.id) }); showToast("Deleted"); onDone(); };
    return (
      <div style={{ paddingTop:4 }}>
        <NavBar title={routine?"Edit Routine":"New Routine"} onBack={onDone}
          right={routine && <TxtBtn onClick={delR} color={C.red}>Delete</TxtBtn>} />
        <Label>Name</Label>
        <Input value={rName} onChange={setRName} placeholder="e.g. Push Day A" style={{ marginTop:8, marginBottom:20 }} />
        <Label>Exercises</Label>
        <div style={{ marginTop:10 }}>
          {exList.map((e,i) => (
            <WhiteCard key={i} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ fontSize:10, fontWeight:800, color:C.textLight3, letterSpacing:"1.5px", textTransform:"uppercase", fontFamily:FB }}>Exercise {i+1}</div>
                {exList.length>1 && <TxtBtn onClick={() => remEx(i)} color={C.red} style={{ fontSize:11 }}>Remove</TxtBtn>}
              </div>
              <Input value={e.name} onChange={v=>updEx(i,"name",v)} placeholder="e.g. Bench Press" style={{ marginBottom:10 }} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div><Label>Sets</Label><Input value={e.defaultSets} onChange={v=>updEx(i,"defaultSets",v)} placeholder="3" type="number" style={{ marginTop:6 }} /></div>
                <div><Label>Reps</Label><Input value={e.defaultReps} onChange={v=>updEx(i,"defaultReps",v)} placeholder="10" type="number" style={{ marginTop:6 }} /></div>
              </div>
            </WhiteCard>
          ))}
        </div>
        <button onClick={addEx} style={{ width:"100%", background:C.cardWhite, border:`3px dashed ${C.ink}`, color:C.textLight1, borderRadius:0, padding:12, cursor:"pointer", fontSize:13, fontWeight:800, marginBottom:20, fontFamily:FB, textTransform:"uppercase", letterSpacing:"0.5px" }}>+ Add Exercise</button>
        <PurpleBtn onClick={saveR}>{routine?"Save Changes":"Create Routine"}</PurpleBtn>
      </div>
    );
  };

  const ActiveSession = ({ routine, onDone }) => {
    const lastSame = [...data.sessions].filter(s=>s.routineId===routine.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const [exercises, setExercises] = useState(
      routine.exercises.map((e,i) => ({
        name:e.name,
        weight:lastSame?.exercises[i]?.weight||"",
        sets:lastSame?.exercises[i]?.sets||e.defaultSets||"3",
        reps:lastSame?.exercises[i]?.reps||e.defaultReps||"10",
      }))
    );
    const [note, setNote] = useState("");
    const [showNote, setShowNote] = useState(false);
    const [activeEx, setActiveEx] = useState(0);
    const [timer, setTimer] = useState(null);
    const [timeLeft, setTL] = useState(0);
    const timerRef = useRef(null);

    const updEx = (i,f,v) => setExercises(exercises.map((e,idx)=>idx===i?{ ...e,[f]:v }:e));
    const startTimer = (s) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setTL(s); setTimer(s);
      timerRef.current = setInterval(() => setTL(t => { if (t<=1) { clearInterval(timerRef.current); setTimer(null); return 0; } return t-1; }), 1000);
    };
    useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

    const saveSession = async () => {
      const valid=exercises.filter(e=>e.name);
      await persist({ ...data, sessions:[...data.sessions, { id:Date.now(), date:todayKey(), routineId:routine.id, routineName:routine.name, exercises:valid, note:note.trim() }] });
      showToast("Session saved ✓"); onDone();
    };

    const ex=exercises[activeEx];
    const lastEx=lastSame?.exercises[activeEx];

    return (
      <div style={{ paddingTop:4 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, paddingTop:20, paddingBottom:14 }}>
          <button onClick={onDone} style={{ background:"none", border:"none", color:C.purple, cursor:"pointer", fontSize:13, fontWeight:800, fontFamily:FB, textTransform:"uppercase", letterSpacing:"0.5px", textDecoration:"underline", textDecorationThickness:"2px" }}>← Back</button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:18, fontWeight:900, color:C.textLight1, fontFamily:F, textTransform:"uppercase" }}>{routine.name}</div>
            <div style={{ fontSize:11, fontWeight:700, color:C.textLight3, marginTop:2, fontFamily:FM }}>{todayKey()}</div>
          </div>
          <Pill>{activeEx+1}/{exercises.length}</Pill>
        </div>

        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:8, marginBottom:12 }}>
          {exercises.map((e,i) => (
            <button key={i} onClick={() => setActiveEx(i)} style={{
              flexShrink:0, background: i===activeEx ? C.lime : C.cardWhite,
              border:`2px solid ${C.ink}`,
              color:C.ink,
              borderRadius:0, padding:"7px 14px", fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:FB,
            }}>{e.name.split(" ")[0].toUpperCase()}</button>
          ))}
        </div>

        <DarkCard style={{ marginBottom:12 }}>
          <div style={{ fontSize:22, fontWeight:900, color:C.textDark1, marginBottom: lastEx ? 4 : 16, fontFamily:F, textTransform:"uppercase" }}>{ex.name}</div>
          {lastEx && <div style={{ fontSize:11, fontWeight:800, color:C.lime, marginBottom:16, letterSpacing:"0.5px", fontFamily:FM }}>LAST: {lastEx.weight}KG × {lastEx.sets}S × {lastEx.reps}R</div>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            {[{ l:"Weight (kg)",f:"weight",ph:"0" },{ l:"Sets",f:"sets",ph:"3" },{ l:"Reps",f:"reps",ph:"10" }].map(fi => (
              <div key={fi.f}>
                <Label dark>{fi.l}</Label>
                <input type="number" value={ex[fi.f]} onChange={e=>updEx(activeEx,fi.f,e.target.value)}
                  placeholder={fi.ph}
                  style={{
                    background:"#1A1A1A", border:`2px solid #fff`, borderRadius:0,
                    color:C.textDark1, padding:"12px 6px", fontSize:22, fontWeight:800,
                    width:"100%", outline:"none", boxSizing:"border-box",
                    textAlign:"center", marginTop:8, WebkitAppearance:"none", fontFamily:FM,
                  }} />
              </div>
            ))}
          </div>
        </DarkCard>

        <WhiteCard style={{ marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: timer?8:0 }}>
            <Label>Rest timer</Label>
            {timer && <div style={{ fontSize:24, fontWeight:900, color: timeLeft<=10?C.red:C.green, fontFamily:FM, fontVariantNumeric:"tabular-nums" }}>{timeLeft}s</div>}
          </div>
          {timer && <Progress value={(timeLeft/timer)*100} color={timeLeft<=10?C.red:C.green} height={6} bg={C.cardMid} style={{ marginBottom:8 }} />}
          <div style={{ display:"flex", gap:8, marginTop: timer?0:4 }}>
            {[60,90,120].map(s => (
              <button key={s} onClick={() => startTimer(s)} style={{
                flex:1, background: timer===s ? C.lime : C.cardWhite,
                border:`2px solid ${C.ink}`, color:C.ink,
                borderRadius:0, padding:"9px 0",
                fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:FB,
              }}>{s}s</button>
            ))}
            {timer && <button onClick={() => { clearInterval(timerRef.current); setTimer(null); setTL(0); }} style={{ background:C.red, border:`2px solid ${C.ink}`, color:"#fff", borderRadius:0, padding:"9px 12px", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:FB }}>✕</button>}
          </div>
        </WhiteCard>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
          <GhostBtn onClick={() => setActiveEx(Math.max(0,activeEx-1))} style={{ opacity: activeEx===0?0.4:1 }}>← Prev</GhostBtn>
          <PurpleBtn onClick={() => setActiveEx(Math.min(exercises.length-1,activeEx+1))} disabled={activeEx===exercises.length-1}>Next →</PurpleBtn>
        </div>

        {showNote
          ? <WhiteCard style={{ marginBottom:12 }}>
              <Label>Session note</Label>
              <div style={{ marginTop:8 }}><Textarea value={note} onChange={setNote} placeholder="How did it feel?" rows={2} /></div>
            </WhiteCard>
          : <TxtBtn onClick={() => setShowNote(true)} color={C.textLight3} style={{ marginBottom:12, display:"block", fontSize:13 }}>+ Add note</TxtBtn>
        }

        {lastSame && (
          <WhiteCard style={{ marginBottom:12 }}>
            <Label>Last session — {lastSame.date}</Label>
            <div style={{ marginTop:8 }}>
              {lastSame.exercises.map((e,i) => (
                <div key={i} style={{ fontSize:13, fontWeight:700, color:C.textLight3, marginTop:4, fontFamily:FB }}>
                  {e.name} <span style={{ color:C.textLight1, fontWeight:800, fontFamily:FM }}>{e.weight}kg × {e.sets}×{e.reps}</span>
                </div>
              ))}
            </div>
          </WhiteCard>
        )}

        <PurpleBtn onClick={saveSession} style={{ marginBottom:24, background:C.green, color:"#fff" }}>Finish Session ✓</PurpleBtn>
      </div>
    );
  };

  const RoutineHistory = ({ routine, onDone }) => {
    const sessions = [...data.sessions].filter(s=>s.routineId===routine.id).sort((a,b)=>b.date.localeCompare(a.date));
    const delSess = async (id) => { await persist({ ...data, sessions:data.sessions.filter(s=>s.id!==id) }); showToast("Removed"); };
    const exNames = [...new Set(sessions.flatMap(s=>s.exercises.map(e=>e.name)))];
    const [selEx, setSelEx] = useState(exNames[0]||"");
    const pts = sessions.map((s,i) => { const e=s.exercises.find(ex=>ex.name===selEx); return { s:`W${sessions.length-i}`, kg:parseFloat(e?.weight)||0 }; }).reverse();
    return (
      <div style={{ paddingTop:4 }}>
        <NavBar title={routine.name} sub="Progress & History" onBack={onDone} />
        {exNames.length>0 && (
          <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4, marginBottom:16 }}>
            {exNames.map(n => (
              <button key={n} onClick={() => setSelEx(n)} style={{
                flexShrink:0, background: selEx===n ? C.lime : C.cardWhite,
                border:`2px solid ${C.ink}`, color:C.ink,
                borderRadius:0, padding:"6px 14px", fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:FB,
              }}>{n.toUpperCase()}</button>
            ))}
          </div>
        )}
        {pts.length>=2 && (
          <WhiteCard style={{ marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <Label>{selEx} — kg</Label>
              {pts[pts.length-1].kg > pts[0].kg && <Pill color={C.green} bg={C.green}>+{(pts[pts.length-1].kg-pts[0].kg).toFixed(1)}kg</Pill>}
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={pts}>
                <XAxis dataKey="s" tick={{ fill:C.textLight3, fontSize:10, fontFamily:FB, fontWeight:700 }} axisLine={false} tickLine={false} />
                <Line type="monotone" dataKey="kg" stroke={C.purple} strokeWidth={3} dot={{ fill:C.lime, stroke:C.ink, strokeWidth:2, r:4 }} />
                <Tooltip formatter={v=>`${v}kg`} contentStyle={{ background:C.ink, border:`2px solid ${C.ink}`, fontSize:11, borderRadius:0, color:"#fff", fontFamily:FM, fontWeight:700 }} />
              </LineChart>
            </ResponsiveContainer>
          </WhiteCard>
        )}
        <Label>All sessions ({sessions.length})</Label>
        <div style={{ marginTop:10 }}>
          {sessions.length===0
            ? <div style={{ textAlign:"center", color:C.textLight3, fontWeight:700, padding:40, fontSize:14, fontFamily:FB, textTransform:"uppercase" }}>No sessions yet.</div>
            : sessions.map(s => (
              <WhiteCard key={s.id} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <Pill>{s.date}</Pill>
                  <TxtBtn onClick={() => delSess(s.id)} color={C.red} style={{ fontSize:11 }}>Delete</TxtBtn>
                </div>
                {s.exercises.map((e,i) => (
                  <div key={i} style={{ fontSize:13, fontWeight:700, color:C.textLight3, marginTop:4, fontFamily:FB }}>
                    {e.name} <span style={{ color:C.textLight1, fontWeight:800, fontFamily:FM }}>{e.weight}kg × {e.sets}×{e.reps}</span>
                  </div>
                ))}
                {s.note && <div style={{ fontSize:12, fontWeight:600, color:C.textLight2, marginTop:8, fontStyle:"italic", borderTop:`2px solid ${C.ink}`, paddingTop:8, fontFamily:FB }}>{s.note}</div>}
              </WhiteCard>
            ))
          }
        </div>
      </div>
    );
  };

  if (view==="newRoutine")            return <RoutineEditor routine={null} onDone={() => setView("home")} />;
  if (view==="editRoutine" && editR)  return <RoutineEditor routine={editR} onDone={() => { setView("home"); setEditR(null); }} />;
  if (view==="session" && activeR)    return <ActiveSession routine={activeR} onDone={() => { setView("home"); setActiveR(null); }} />;
  if (view==="history" && histR)      return <RoutineHistory routine={histR} onDone={() => { setView("home"); setHistR(null); }} />;

  const totalSess = data.sessions.length;
  const wkSess = data.sessions.filter(s=>weekKey(new Date(s.date))===weekKey()).length;
  const mData = MONTHS.map((m,i) => ({ m, c:data.sessions.filter(s=>(parseInt(s.date.split("-")[1])-1)===MONTH_NUMS[i]).length }));

  return (
    <div style={{ paddingTop:56 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
        <div style={{ fontSize:30, fontWeight:900, letterSpacing:"-1px", color:C.textLight1, fontFamily:F, textTransform:"uppercase" }}>Train</div>
        <TxtBtn onClick={() => setView("newRoutine")} style={{ paddingTop:10 }}>+ Routine</TxtBtn>
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:C.textLight3, marginBottom:18, fontFamily:FB, textTransform:"uppercase", letterSpacing:"0.5px" }}>{wkSess} session{wkSess!==1?"s":""} this week</div>

      <div style={{ display:"flex", gap:10, marginBottom:14 }}>
        <DarkCard style={{ flex:1, padding:"14px" }}>
          <Label dark>Total</Label>
          <MedNum color={C.textDark1} style={{ marginTop:6 }}>{totalSess}</MedNum>
        </DarkCard>
        <DarkCard style={{ flex:1, padding:"14px" }}>
          <Label dark>This week</Label>
          <MedNum color={C.lime} style={{ marginTop:6 }}>{wkSess}</MedNum>
        </DarkCard>
      </div>

      {totalSess>0 && (
        <WhiteCard style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:800, color:C.textLight1, letterSpacing:"1.5px", textTransform:"uppercase", marginBottom:10, fontFamily:FB }}>6-month activity</div>
          <ResponsiveContainer width="100%" height={64}>
            <BarChart data={mData} barSize={20}>
              <XAxis dataKey="m" tick={{ fill:C.textLight3, fontSize:10, fontFamily:FB, fontWeight:700 }} axisLine={false} tickLine={false} />
              <Bar dataKey="c" fill={C.purple} stroke={C.ink} strokeWidth={2} />
              <Tooltip contentStyle={{ background:C.ink, border:`2px solid ${C.ink}`, fontSize:11, borderRadius:0, color:"#fff", fontFamily:FM, fontWeight:700 }} />
            </BarChart>
          </ResponsiveContainer>
        </WhiteCard>
      )}

      {data.routines.length===0 && (
        <div style={{ textAlign:"center", padding:"56px 0" }}>
          <div style={{ fontSize:44, marginBottom:14 }}>↑</div>
          <div style={{ fontSize:16, fontWeight:800, color:C.textLight3, marginBottom:10, fontFamily:FB, textTransform:"uppercase" }}>No routines yet</div>
          <TxtBtn onClick={() => setView("newRoutine")}>Create your first routine</TxtBtn>
        </div>
      )}

      <div style={{ marginTop:4 }}>
        {data.routines.map(r => {
          const sc = data.sessions.filter(s=>s.routineId===r.id).length;
          const ls = [...data.sessions].filter(s=>s.routineId===r.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
          return (
            <DarkCard key={r.id} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:18, fontWeight:900, color:C.textDark1, fontFamily:F, textTransform:"uppercase" }}>{r.name}</div>
                  <div style={{ fontSize:11, fontWeight:700, color:C.textDark3, marginTop:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:FB }}>
                    {r.exercises.map(e=>e.name).join(" · ").toUpperCase()}
                  </div>
                  <div style={{ fontSize:10, fontWeight:800, color:C.lime, marginTop:4, letterSpacing:"0.5px", fontFamily:FM }}>{sc} SESSION{sc!==1?"S":""} {ls?`· LAST ${ls.date}`:""}</div>
                </div>
                <div style={{ display:"flex", gap:10, marginLeft:10 }}>
                  <TxtBtn onClick={() => { setHistR(r); setView("history"); }} color={C.textDark2} style={{ fontSize:11 }}>History</TxtBtn>
                  <TxtBtn onClick={() => { setEditR(r); setView("editRoutine"); }} color={C.textDark2} style={{ fontSize:11 }}>Edit</TxtBtn>
                </div>
              </div>
              <PurpleBtn onClick={() => { setActiveR(r); setView("session"); }}>▶ Start {r.name}</PurpleBtn>
            </DarkCard>
          );
        })}
      </div>
    </div>
  );
}

// ── Goals ───────────────────────────────────────────────────────────────────
function Goals({ data, persist, showToast }) {
  const [addSheet, setAddSheet] = useState(false);
  const [gName, setGName] = useState("");
  const [gTarget, setGTarget] = useState("");

  const add = async () => {
    if (!gName.trim()||!gTarget) return;
    await persist({ ...data, goals:[...data.goals, { id:Date.now(), name:gName.trim(), target:parseFloat(gTarget), current:0 }] });
    setGName(""); setGTarget(""); setAddSheet(false); showToast("Goal added ✓");
  };
  const updGoal = async (id, v) => {
    if (isNaN(v)) return;
    await persist({ ...data, goals:data.goals.map(g=>g.id===id?{ ...g, current:Math.min(v,g.target) }:g) });
    showToast("Updated ✓");
  };
  const del = async (id) => { await persist({ ...data, goals:data.goals.filter(g=>g.id!==id) }); showToast("Removed"); };
  const done = data.goals.filter(g=>g.current>=g.target).length;

  return (
    <div style={{ paddingTop:56 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
        <div style={{ fontSize:30, fontWeight:900, letterSpacing:"-1px", color:C.textLight1, fontFamily:F, textTransform:"uppercase" }}>Goals</div>
        <TxtBtn onClick={() => setAddSheet(true)} style={{ paddingTop:10 }}>+ Add</TxtBtn>
      </div>
      {data.goals.length>0 && <div style={{ fontSize:12, fontWeight:700, color:C.textLight3, marginBottom:18, fontFamily:FB, textTransform:"uppercase", letterSpacing:"0.5px" }}>{done} of {data.goals.length} complete</div>}

      {data.goals.length===0 && (
        <div style={{ textAlign:"center", padding:"72px 0 32px" }}>
          <div style={{ fontSize:44, marginBottom:14 }}>◎</div>
          <div style={{ fontSize:16, fontWeight:800, color:C.textLight3, marginBottom:10, fontFamily:FB, textTransform:"uppercase" }}>No goals yet</div>
          <TxtBtn onClick={() => setAddSheet(true)}>Set your first goal</TxtBtn>
        </div>
      )}

      {data.goals.map(g => {
        const pct = Math.min(100, Math.round((g.current/g.target)*100));
        const isDone = pct>=100;
        const col = isDone ? C.green : pct>=50 ? C.orange : C.purple;
        return (
          <DarkCard key={g.id} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
              <div style={{ fontSize:18, fontWeight:900, color:C.textDark1, fontFamily:F, textTransform:"uppercase" }}>{g.name}{isDone?" 🏆":""}</div>
              <TxtBtn onClick={() => del(g.id)} color={C.textDark2} style={{ fontSize:16, padding:"0 0 0 12px", textDecoration:"none" }}>✕</TxtBtn>
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:14 }}>
              <InlineLog dark value={g.current} unit={`/ ${g.target}`} color={col} onSave={v=>updGoal(g.id,v)} />
              <Pill color={col} bg={col}>{pct}%{isDone?" ✓":""}</Pill>
            </div>
            <Progress value={pct} color={col} height={8} bg="#1A1A1A" />
          </DarkCard>
        );
      })}

      {addSheet && (
        <Sheet title="New Goal" onClose={() => setAddSheet(false)}>
          <Label>Goal name</Label>
          <Input value={gName} onChange={setGName} placeholder="e.g. Run 100km total" style={{ marginTop:8, marginBottom:16 }} />
          <Label>Target number</Label>
          <Input value={gTarget} onChange={setGTarget} placeholder="e.g. 100" type="number" style={{ marginTop:8, marginBottom:22 }} />
          <PurpleBtn onClick={add}>Add Goal</PurpleBtn>
        </Sheet>
      )}
    </div>
  );
}

// ── Challenge (with Reset) ──────────────────────────────────────────────────
function Challenge({ data, persist, showToast, onReset }) {
  const dayNum = getDayNumber();
  const today = new Date(); today.setHours(0,0,0,0);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [photoMonth, setPhotoMonth] = useState(null);
  const [compare, setCompare] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const days = Array.from({ length:TOTAL_DAYS }, (_,i) => {
    const d = new Date(CHALLENGE_START); d.setDate(d.getDate()+i);
    const k = dateKey(d);
    return {
      k, isPast: d<today, isToday: k===todayKey(),
      complete: (data.habits.length>0 && data.habits.some(h=>h.completions?.[k]==="done"))||data.sessions.some(s=>s.date===k),
      n: i+1
    };
  });

  let streak = 0;
  for (let i=dayNum-1; i>=0; i--) { if (days[i].complete) streak++; else break; }

  const monthStats = MONTHS.map((m,idx) => {
    const mo = MONTH_NUMS[idx];
    const md = days.filter(d=>(parseInt(d.k.split("-")[1])-1)===mo);
    const cp = md.filter(d=>d.complete).length;
    return { m, total:md.length, cp, pct: md.length ? Math.round((cp/md.length)*100) : 0 };
  });

  const photoKeys = MONTHS.map((_,i) => monthKey(new Date(`2025-${String(MONTH_NUMS[i]+1).padStart(2,"00")}-01`)));
  const withPhotos = photoKeys.map((k,i) => ({ m:MONTHS[i], key:k, src:data.photos?.[k] })).filter(p=>p.src);

  const handlePhoto = async (e) => {
    const file=e.target.files?.[0]; if (!file) return;
    const reader=new FileReader();
    reader.onload = async (ev) => { await persist({ ...data, photos:{ ...data.photos, [photoKeys[photoMonth]]:ev.target.result } }); setPhotoSheet(false); showToast("Photo saved ✓"); };
    reader.readAsDataURL(file);
  };

  const todayDone = days.find(d=>d.isToday)?.complete;

  return (
    <div style={{ paddingTop:56 }}>
      <div style={{ fontSize:30, fontWeight:900, letterSpacing:"-1px", color:C.textLight1, fontFamily:F, textTransform:"uppercase", marginBottom:4 }}>Progress</div>
      <div style={{ fontSize:12, fontWeight:700, color:C.textLight3, marginBottom:20, fontFamily:FM, letterSpacing:"0.5px" }}>JUL 1 → DEC 31, 2025</div>

      {/* Streak hero */}
      <DarkCard style={{ marginBottom:14, position:"relative", overflow:"hidden" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
          <div>
            <Label dark>Current streak</Label>
            <BigNum size={76} color={streak>0?C.lime:C.textDark3}>{streak}</BigNum>
            <div style={{ fontSize:13, fontWeight:800, color:C.textDark2, marginTop:8, fontFamily:FB, textTransform:"uppercase" }}>days 🔥</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <Label dark>Day</Label>
            <MedNum color={C.textDark1} style={{ fontSize:40, marginTop:4 }}>{dayNum}</MedNum>
            <div style={{ fontSize:11, fontWeight:700, color:C.textDark3, marginTop:4, fontFamily:FB, textTransform:"uppercase" }}>of {TOTAL_DAYS}</div>
            <Progress value={(dayNum/TOTAL_DAYS)*100} color={C.lime} height={6} bg="#1A1A1A" style={{ width:80, marginTop:10 }} />
          </div>
        </div>
        <div style={{ marginTop:18, display:"inline-flex", alignItems:"center", gap:8, background: todayDone?C.lime:"#1A1A1A", border:`2px solid ${todayDone?C.ink:"#fff"}`, padding:"4px 10px" }}>
          <span style={{ fontSize:11, fontWeight:800, color: todayDone?C.ink:C.textDark2, fontFamily:FB, letterSpacing:"0.5px" }}>
            {todayDone?"TODAY COMPLETE ✓":"TODAY NOT LOGGED YET"}
          </span>
        </div>
      </DarkCard>

      {/* Monthly breakdown */}
      <WhiteCard style={{ marginBottom:14, padding:0, overflow:"hidden" }}>
        <div style={{ padding:"14px 16px 8px" }}><Label>Monthly breakdown</Label></div>
        {monthStats.map((ms,idx) => (
          <div key={ms.m}>
            <div style={{ padding:"10px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{ fontSize:14, fontWeight:800, color:C.textLight1, fontFamily:F, textTransform:"uppercase" }}>{ms.m}</span>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:C.textLight3, fontFamily:FM }}>{ms.cp}/{ms.total}</span>
                  <Pill color={ms.pct>=80?C.green:ms.pct>=50?C.orange:C.purple} bg={ms.pct>=80?C.green:ms.pct>=50?C.orange:C.purple}>{ms.pct}%</Pill>
                </div>
              </div>
              <Progress value={ms.pct} color={ms.pct>=80?C.green:ms.pct>=50?C.orange:C.purple} height={5} bg={C.cardMid} />
            </div>
            {idx<monthStats.length-1 && <Sep />}
          </div>
        ))}
      </WhiteCard>

      {/* Dot grid */}
      <WhiteCard style={{ marginBottom:14 }}>
        <Label style={{ marginBottom:14 }}>184-day grid</Label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginTop:12 }}>
          {days.map(d => (
            <div key={d.k} title={`Day ${d.n}`} style={{
              width:13, height:13, borderRadius:0, flexShrink:0,
              background: d.isToday?C.lime:d.complete?C.purple:d.isPast?C.cardMid:C.cardWhite,
              border:`1.5px solid ${C.ink}`,
              transition:"background 0.2s",
            }} />
          ))}
        </div>
        <div style={{ display:"flex", gap:14, marginTop:14, flexWrap:"wrap" }}>
          {[{ c:C.lime, l:"Today" },{ c:C.purple, l:"Done" },{ c:C.cardMid, l:"Missed" },{ c:C.cardWhite, l:"Upcoming" }].map(l => (
            <div key={l.l} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:10, height:10, borderRadius:0, background:l.c, border:`1.5px solid ${C.ink}` }} />
              <span style={{ fontSize:9, fontWeight:800, color:C.textLight2, fontFamily:FB, letterSpacing:"0.8px" }}>{l.l.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </WhiteCard>

      {/* Photos */}
      <WhiteCard style={{ marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <Label>Progress photos</Label>
          {withPhotos.length>=2 && (
            <TxtBtn onClick={() => setCompare(!compare)} color={C.textLight2} style={{ fontSize:11 }}>
              {compare?"Grid":"Compare"}
            </TxtBtn>
          )}
        </div>
        {compare && withPhotos.length>=2 ? (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[withPhotos[0], withPhotos[withPhotos.length-1]].map(p => (
              <div key={p.key}>
                <Label style={{ marginBottom:6 }}>{p.m}</Label>
                <img src={p.src} alt={p.m} style={{ width:"100%", borderRadius:0, border:`2px solid ${C.ink}`, objectFit:"cover", height:150 }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
            {MONTHS.map((m,i) => {
              const src = data.photos?.[photoKeys[i]];
              return (
                <div key={m} onClick={() => { setPhotoMonth(i); setPhotoSheet(true); }} style={{
                  aspectRatio:"1", borderRadius:0, overflow:"hidden",
                  background:C.cardMid, cursor:"pointer", border:`2px solid ${C.ink}`,
                }}>
                  {src
                    ? <img src={src} alt={m} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4 }}>
                        <span style={{ fontSize:16 }}>📷</span>
                        <span style={{ fontSize:9, fontWeight:800, color:C.textLight2, fontFamily:FB, letterSpacing:"0.5px" }}>{m.toUpperCase()}</span>
                      </div>
                  }
                </div>
              );
            })}
          </div>
        )}
      </WhiteCard>

      {/* ── RESET ZONE ── */}
      <div style={{ marginTop:32, marginBottom:24 }}>
        <div style={{ borderTop:`3px solid ${C.ink}`, paddingTop:24 }}>
          <div style={{ fontSize:11, fontWeight:800, color:C.textLight3, letterSpacing:"2px", textTransform:"uppercase", fontFamily:FB, marginBottom:12 }}>Danger Zone</div>
          {!confirmReset ? (
            <>
              <WhiteCard style={{ marginBottom:0, background:"#FFF5F5", border:`3px solid ${C.red}`, boxShadow:`4px 4px 0 ${C.red}` }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                  <span style={{ fontSize:24, flexShrink:0 }}>⚠️</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:900, color:C.ink, fontFamily:F, textTransform:"uppercase", marginBottom:4 }}>Reset & Start Fresh</div>
                    <div style={{ fontSize:12, fontWeight:600, color:C.textLight2, fontFamily:FB, marginBottom:16, lineHeight:1.5 }}>
                      This wipes everything — your name, habits, workouts, goals, photos, and all logs. You'll go through onboarding again. This cannot be undone.
                    </div>
                    <button onClick={() => setConfirmReset(true)} style={{
                      background:"#FFF5F5", color:C.red,
                      border:`2.5px solid ${C.red}`, borderRadius:0,
                      padding:"10px 20px", fontSize:13, fontWeight:900,
                      cursor:"pointer", fontFamily:F, textTransform:"uppercase",
                      letterSpacing:"0.5px", boxShadow:`3px 3px 0 ${C.red}`,
                    }}>
                      Reset Everything →
                    </button>
                  </div>
                </div>
              </WhiteCard>
            </>
          ) : (
            <DarkCard style={{ background:"#1A0000", border:`3px solid ${C.red}`, boxShadow:`5px 5px 0 ${C.red}` }}>
              <div style={{ fontSize:18, fontWeight:900, color:"#FF6B6B", fontFamily:F, textTransform:"uppercase", marginBottom:6 }}>Are you sure?</div>
              <div style={{ fontSize:13, fontWeight:600, color:C.textDark2, fontFamily:FB, marginBottom:20, lineHeight:1.5 }}>
                All your data will be permanently deleted. Day {dayNum} of your challenge, every habit, every session — gone.
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <GhostBtn onClick={() => setConfirmReset(false)} style={{ background:"#1A0000", color:C.textDark1, border:`2px solid ${C.textDark2}` }}>
                  Cancel
                </GhostBtn>
                <DangerBtn onClick={onReset}>
                  Yes, Wipe It
                </DangerBtn>
              </div>
            </DarkCard>
          )}
        </div>
      </div>

      {photoSheet && (
        <Sheet title={`${MONTHS[photoMonth]} Photo`} onClose={() => setPhotoSheet(false)}>
          <label style={{ display:"block", background:C.cardWhite, border:`3px dashed ${C.ink}`, borderRadius:0, padding:40, textAlign:"center", cursor:"pointer" }}>
            <div style={{ fontSize:32, marginBottom:8 }}>📷</div>
            <div style={{ fontSize:13, fontWeight:700, color:C.textLight2, fontFamily:FB, textTransform:"uppercase", letterSpacing:"0.5px" }}>Tap to choose photo</div>
            <input type="file" accept="image/*" onChange={handlePhoto} style={{ display:"none" }} />
          </label>
        </Sheet>
      )}
    </div>
  );
}

// ── Weekly Review ───────────────────────────────────────────────────────────
function WeeklyReview({ data, persist, showToast, onBack }) {
  const key = getThisSundayKey();
  const ex = data.reviews?.[key]||{};
  const [mood, setMood] = useState(ex.mood||null);
  const [win, setWin] = useState(ex.win||"");
  const [improve, setImprove] = useState(ex.improve||"");
  const [showMore, setShowMore] = useState(false);
  const [gymNotes, setGymNotes] = useState(ex.gymNotes||"");
  const [past, setPast] = useState(false);

  const wk = weekKey();
  const thisWt = data.weights?.[wk];
  const wkDays = last7();
  const gymCnt = data.sessions.filter(s=>weekKey(new Date(s.date))===wk).length;
  const avgSc = (() => { const v=wkDays.map(d=>data.screenTime?.[d.key]).filter(v=>v!=null); return v.length ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(1) : null; })();
  const habAvg = (() => { if (!data.habits.length) return null; const v=wkDays.map(d=>Math.round((data.habits.filter(h=>h.completions?.[d.key]==="done").length/data.habits.length)*100)); return Math.round(v.reduce((a,b)=>a+b,0)/v.length); })();

  const saveReview = async () => {
    await persist({ ...data, reviews:{ ...data.reviews, [key]:{ mood, win, improve, gymNotes, savedAt:new Date().toISOString(), weight:thisWt } } });
    showToast("Review saved ✓");
  };

  const pastReviews = Object.entries(data.reviews||{}).filter(([k])=>k!==key).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,8);
  const MOODS = [{ e:"😔",l:"Rough" },{ e:"😐",l:"Okay" },{ e:"😊",l:"Good" },{ e:"💪",l:"Great" },{ e:"🔥",l:"Crushed" }];

  if (past) return (
    <div style={{ paddingTop:4 }}>
      <NavBar title="Past Reviews" onBack={() => setPast(false)} />
      {pastReviews.length===0
        ? <div style={{ textAlign:"center", color:C.textLight3, fontWeight:700, padding:48, fontSize:14, fontFamily:FB, textTransform:"uppercase" }}>No past reviews yet.</div>
        : pastReviews.map(([k,rv]) => (
          <WhiteCard key={k} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <div style={{ fontSize:14, fontWeight:900, color:C.textLight1, fontFamily:F, textTransform:"uppercase" }}>{k.replace("review-","")}</div>
              <span style={{ fontSize:18 }}>{MOODS.find(m=>m.l===rv.mood)?.e||""}</span>
            </div>
            {rv.weight && <div style={{ fontSize:11, fontWeight:800, color:C.textLight1, marginBottom:8, fontFamily:FM }}>⚖️ {rv.weight}kg</div>}
            {rv.win && <div style={{ marginBottom:8 }}><Label color={C.green}>Win</Label><div style={{ fontSize:13, fontWeight:600, marginTop:3, color:C.textLight2, fontFamily:FB }}>{rv.win}</div></div>}
            {rv.improve && <div style={{ marginBottom:8 }}><Label color={C.purple}>Improve</Label><div style={{ fontSize:13, fontWeight:600, marginTop:3, color:C.textLight2, fontFamily:FB }}>{rv.improve}</div></div>}
            {rv.gymNotes && <div><Label>Gym</Label><div style={{ fontSize:13, fontWeight:600, marginTop:3, color:C.textLight2, fontFamily:FB }}>{rv.gymNotes}</div></div>}
          </WhiteCard>
        ))
      }
    </div>
  );

  return (
    <div style={{ paddingTop:4 }}>
      <div style={{ paddingTop:16, paddingBottom:12 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:C.purple, cursor:"pointer", fontSize:13, fontWeight:800, padding:"4px 0", fontFamily:FB, textTransform:"uppercase", letterSpacing:"0.5px", textDecoration:"underline", textDecorationThickness:"2px" }}>← Back</button>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginTop:10 }}>
          <div style={{ fontSize:30, fontWeight:900, letterSpacing:"-1px", color:C.textLight1, fontFamily:F, textTransform:"uppercase" }}>Weekly Review</div>
          <TxtBtn onClick={() => setPast(true)} color={C.textLight2} style={{ paddingTop:10, fontSize:12 }}>History</TxtBtn>
        </div>
        <div style={{ fontSize:11, fontWeight:700, color:C.textLight3, marginTop:6, fontFamily:FM, letterSpacing:"0.5px" }}>{key.replace("review-","")}</div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:16 }}>
        {[
          { l:"Weight", v: thisWt?`${thisWt}kg`:"—", c:C.textDark1 },
          { l:"Gym",    v:`${gymCnt}`, c:C.lime },
          { l:"Screen", v: avgSc?`${avgSc}h`:"—", c: avgSc&&parseFloat(avgSc)>(data.screenTimeGoal||3)?C.red:C.green },
          { l:"Habits", v: habAvg!=null?`${habAvg}%`:"—", c: habAvg>=80?C.green:habAvg>=50?C.orange:C.purple },
        ].map(s => (
          <DarkCard key={s.l} style={{ padding:"12px 8px", textAlign:"center" }}>
            <div style={{ fontSize:9, fontWeight:800, color:C.textDark3, marginBottom:6, letterSpacing:"1px", textTransform:"uppercase", fontFamily:FB }}>{s.l}</div>
            <div style={{ fontSize:16, fontWeight:900, color:s.c, fontFamily:FM, letterSpacing:"-0.3px" }}>{s.v}</div>
          </DarkCard>
        ))}
      </div>

      {/* Mood */}
      <WhiteCard style={{ marginBottom:14 }}>
        <Label style={{ marginBottom:12 }}>How was your week?</Label>
        <div style={{ display:"flex", gap:6 }}>
          {MOODS.map(m => (
            <button key={m.l} onClick={() => setMood(m.l)} style={{
              flex:1, background: mood===m.l ? C.lime : C.cardWhite,
              border:`2px solid ${C.ink}`,
              borderRadius:0, padding:"12px 4px", cursor:"pointer",
              display:"flex", flexDirection:"column", alignItems:"center", gap:5,
              transition:"all 0.1s",
            }}>
              <span style={{ fontSize:20 }}>{m.e}</span>
              <span style={{ fontSize:8, fontWeight:800, color:C.ink, fontFamily:FB, letterSpacing:"0.8px" }}>{m.l.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </WhiteCard>

      <WhiteCard style={{ marginBottom:14 }}>
        <Label color={C.green} style={{ marginBottom:8 }}>One win this week</Label>
        <Input value={win} onChange={setWin} placeholder="e.g. Hit all my PRs" />
      </WhiteCard>

      <WhiteCard style={{ marginBottom:14 }}>
        <Label color={C.red} style={{ marginBottom:8 }}>One thing to improve</Label>
        <Input value={improve} onChange={setImprove} placeholder="e.g. Sleep earlier" />
      </WhiteCard>

      <button onClick={() => setShowMore(s=>!s)} style={{
        width:"100%", background:"none", border:"none", cursor:"pointer",
        display:"flex", alignItems:"center", justifyContent:"center", gap:4,
        padding:"8px 0", marginBottom: showMore?12:16,
        color:C.textLight3, fontSize:11, fontWeight:800, fontFamily:FB,
        textTransform:"uppercase", letterSpacing:"1px",
      }}>
        {showMore?"▲ less":"▼ gym notes"}
      </button>

      {showMore && (
        <WhiteCard style={{ marginBottom:16 }}>
          <Label style={{ marginBottom:8 }}>Gym notes ({gymCnt} sessions)</Label>
          <Textarea value={gymNotes} onChange={setGymNotes} placeholder="Lifts, form cues, how it felt..." rows={3} />
        </WhiteCard>
      )}

      <PurpleBtn onClick={saveReview} style={{ marginBottom:32 }}>Save Review</PurpleBtn>
    </div>
  );
}