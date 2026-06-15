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

// ── Data Migration Schema Pipeline ──────────────────────────────────────────
function runMigrationPipeline(rawData) {
  if (!rawData) return null;
  let migrated = { ...rawData };

  if (!migrated.version) {
    migrated.version = 1;
  }

  if (migrated.version === 1) {
    if (!migrated.habits) migrated.habits = [];
    if (!migrated.routines) migrated.routines = [];
    if (!migrated.sessions) migrated.sessions = [];
    if (!migrated.goals) migrated.goals = [];
    if (!migrated.weights) migrated.weights = {};
    if (!migrated.photos) migrated.photos = {};
    if (!migrated.screenTime) migrated.screenTime = {};
    migrated.version = 2;
  }

  if (migrated.version === 2) {
    if (migrated.screenTimeGoal === undefined) migrated.screenTimeGoal = 3;
    if (!migrated.reviews) migrated.reviews = {};
    if (!migrated.noZeroCheckins) migrated.noZeroCheckins = {};
    migrated.version = 3;
  }

  return migrated;
}

// ── Design Tokens ───────────────────────────────────────────────────────────
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
  textLight2: "#4A4A4A",
  textLight3: "#706E64",
  ink:        "#0A0A0A",
  lime:       "#A3E635",
  purple:     "#6366F1",
  yellow:     "#FACC15",
  red:        "#EF4444",
  green:      "#22C55E",
};

const F = '"Impact", "Arial Black", sans-serif';
const FB = '"Courier New", Courier, monospace';
const FM = '"Courier New", Courier, monospace';

const HS = (size=4) => `${size}px ${size}px 0px ${C.ink}`;
const HSS = "2px 2px 0px rgba(0,0,0,0.15)";

// ── Base Components ─────────────────────────────────────────────────────────
function DarkCard({ children, style }) {
  return (
    <div style={{
      background:C.cardDark, color:C.textDark1, border:`3px solid ${C.ink}`,
      padding:16, marginBottom:12, boxShadow:HS(4), position:"relative", ...style
    }}>{children}</div>
  );
}

function WhiteCard({ children, style }) {
  return (
    <div style={{
      background:C.cardWhite, color:C.textLight1, border:`3px solid ${C.ink}`,
      padding:16, marginBottom:12, boxShadow:HS(4), ...style
    }}>{children}</div>
  );
}

function Label({ children, dark, color, style }) {
  return (
    <div style={{
      fontSize:11, fontWeight:900, fontFamily:FB, letterSpacing:"1px",
      textTransform:"uppercase", color: color || (dark ? C.textDark3 : C.textLight3),
      marginBottom:2, ...style
    }}>{children}</div>
  );
}

function BigNum({ children, color }) {
  return (
    <div style={{
      fontSize:44, fontFamily:F, fontWeight:900, lineHeight:"44px",
      color: color || C.textDark1, letterSpacing:"-1px", textTransform:"uppercase"
    }}>{children}</div>
  );
}

function MedNum({ children, color }) {
  return (
    <div style={{
      fontSize:26, fontFamily:F, fontWeight:900, lineHeight:"26px",
      color: color || C.textDark1, textTransform:"uppercase"
    }}>{children}</div>
  );
}

function Progress({ value=0, max=100, color=C.lime, height=12, style }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{
      width:"100%", height, background:C.pageBg, border:`2px solid ${C.ink}`,
      position:"relative", overflow:"hidden", ...style
    }}>
      <div style={{ width:`${pct}%`, height:"100%", background:color, transition:"width 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }} />
    </div>
  );
}

function Input({ style, ...p }) {
  return (
    <input style={{
      width:"100%", background:C.pageBg, border:`2px solid ${C.ink}`,
      padding:"8px 10px", fontSize:13, fontWeight:700, fontFamily:FB,
      color:C.ink, outline:"none", boxSizing:"border-box", ...style
    }} {...p} />
  );
}

function Textarea({ style, ...p }) {
  return (
    <textarea style={{
      width:"100%", background:C.pageBg, border:`2px solid ${C.ink}`,
      padding:"8px 10px", fontSize:13, fontWeight:700, fontFamily:FB,
      color:C.ink, outline:"none", boxSizing:"border-box", height:70, resize:"vertical", ...style
    }} {...p} />
  );
}

function Sheet({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"flex-end" }}>
      <div style={{ position:"absolute", inset:0, background:"rgba(10,10,10,0.4)" }} onClick={onClose} />
      <div style={{
        position:"relative", width:"100%", background:C.pageBg, borderTop:`4px solid ${C.ink}`,
        padding:20, boxSizing:"border-box", maxHeight:"85vh", overflowY:"auto",
        boxShadow:"0px -4px 20px rgba(0,0,0,0.15)"
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:18, fontWeight:900, fontFamily:F, textTransform:"uppercase" }}>{title}</div>
          <button onClick={onClose} style={{
            background:C.cardDark, color:"#fff", border:`2px solid ${C.ink}`,
            width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center",
            fontWeight:900, cursor:"pointer"
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position:"fixed", bottom:84, left:16, right:16, background:C.cardDark,
      color:"#fff", border:`3px solid ${C.ink}`, padding:"10px 14px", zIndex:110,
      fontFamily:FB, fontSize:11, fontWeight:800, textTransform:"uppercase",
      boxShadow:HS(3), display:"flex", justifyContent:"between"
    }}>
      <span>{message}</span>
    </div>
  );
}

function NavBar({ activeTab, onTabSelect, tabs }) {
  return (
    <div style={{
      position:"fixed", bottom:0, left:0, right:0, height:64, background:C.cardDark,
      borderTop:`3px solid ${C.ink}`, display:"flex", zIndex:90, padding:"0 6px"
    }}>
      {tabs.map(t => {
        const isSel = activeTab === t.id;
        return (
          <button key={t.id} onClick={() => onTabSelect(t.id)} style={{
            flex:1, background:"none", border:"none", display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center", color: isSel ? C.lime : C.textDark3,
            cursor:"pointer", padding:0
          }}>
            <span style={{ fontSize:18, marginBottom:2 }}>{t.sym}</span>
            <span style={{ fontSize:9, fontWeight:900, fontFamily:FB, textTransform:"uppercase" }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function InlineLog({ keyName, label, data, persist }) {
  const val = data.screenTime?.[keyName] || "";
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
      <span style={{ fontSize:12, fontWeight:800, fontFamily:FB }}>{label}</span>
      <input type="number" step="0.1" value={val} placeholder="0.0"
        onChange={async (e) => {
          const c = { ...data };
          if (!c.screenTime) c.screenTime = {};
          c.screenTime[keyName] = e.target.value;
          await persist(c);
        }}
        style={{
          width:55, background:C.cardWhite, border:`2px solid ${C.ink}`,
          padding:"3px 6px", fontFamily:FM, fontSize:12, fontWeight:700, textAlign:"center"
        }}
      />
    </div>
  );
}

function getInsight(data) {
  const tk = todayKey();
  const hc = data.habits.length;
  const hd = data.habits.filter(h => h.completions?.[tk] === "done").length;
  if(hc > 0 && hd === hc) return "FLAWLESS BLUEPRINT FOR TODAY. SECURE ALL FRONTS.";
  const doneSess = data.sessions?.filter(s => s.date === tk) || [];
  if(doneSess.length > 0) return "IRON TEMPLE HAS RECEIVED SACRIFICE. KEEP DRIVING.";
  return "THE KINETIC ENGINE WAITS. EXECUTE AT LEAST ONE PROTOCOL.";
}

// ── Onboarding ──────────────────────────────────────────────────────────────
function Onboarding({ onComplete }) {
  const [name, setName] = useState("");
  const [wStart, setWStart] = useState("");
  const [wTarget, setWTarget] = useState("");
  const [stGoal, setStGoal] = useState("3");

  const submit = () => {
    if(!name || !wStart || !wTarget) return alert("All nodes required.");
    onComplete({
      version: 3,
      onboarded: true,
      userName: name,
      weightStart: parseFloat(wStart),
      weightTarget: parseFloat(wTarget),
      screenTimeGoal: parseFloat(stGoal),
      habits: [
        { id:1, name:"Read Blueprint", frequency:"daily", completions:{} },
        { id:2, name:"Cold Plunge / Focus", frequency:"daily", completions:{} },
        { id:3, name:"Zero Sugar Protocol", frequency:"daily", completions:{} }
      ],
      routines: [
        { id:1, name:"A: Push Force", exercises:[{ name:"Bench Press", sets:[{ lbs:135, reps:10 },{ lbs:135, reps:10 }] }] },
        { id:2, name:"B: Pull Load", exercises:[{ name:"Deadlift", sets:[{ lbs:225, reps:5 }] }] }
      ],
      sessions: [],
      goals: [
        { id:1, text:"Execute complete tracker system integrity", completed:false, deadline:"" }
      ],
      weights: {},
      photos: {},
      screenTime: {},
      reviews: {},
      noZeroCheckins: {}
    });
  };

  return (
    <div style={{ padding:20, minHeight:"100vh", background:C.pageBg, display:"flex", flexDirection:"column", justifyContent:"center" }}>
      <DarkCard style={{ padding:24 }}>
        <BigNum color={C.lime}>INITIALIZE</BigNum>
        <div style={{ fontSize:12, fontFamily:FB, color:C.textDark2, marginTop:4, marginBottom:20 }}>COGNITIVE TRACKER SYSTEM INTEGRATION</div>

        <Label dark>OPERATOR INITIALS / NAME</Label>
        <Input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. ALPHA" style={{ marginBottom:14 }} />

        <div style={{ display:"flex", gap:12, marginBottom:14 }}>
          <div style={{ flex:1 }}>
            <Label dark>STARTING MASS (KG)</Label>
            <Input type="number" value={wStart} onChange={e=>setWStart(e.target.value)} placeholder="85" />
          </div>
          <div style={{ flex:1 }}>
            <Label dark>TARGET MASS (KG)</Label>
            <Input type="number" value={wTarget} onChange={e=>setWTarget(e.target.value)} placeholder="80" />
          </div>
        </div>

        <Label dark>SCREEN CONSTRAINT GOAL (HOURS/DAY)</Label>
        <Input type="number" value={stGoal} onChange={e=>setStGoal(e.target.value)} placeholder="3" style={{ marginBottom:20 }} />

        <button onClick={submit} style={{
          width:"100%", background:C.lime, color:C.ink, border:`3px solid ${C.ink}`,
          padding:"12px 0", fontSize:14, fontWeight:900, fontFamily:F,
          textTransform:"uppercase", cursor:"pointer", boxShadow:HS(3)
        }}>Establish Core Registry</button>
      </DarkCard>
    </div>
  );
}

// ── App Shell ───────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      let d = await load("tracker-v2");
      if (d) {
        const migrated = runMigrationPipeline(d);
        if (migrated.version !== d.version || !d.version) {
          await save("tracker-v2", migrated);
        }
        setData(migrated);
      }
      setLoaded(true);
    })();
  }, []);

  const persist = async (next) => {
    setData(next);
    await save("tracker-v2", next);
  };

  const showToast = (msg) => setToast(msg);

  const handleFullReset = async () => {
    if(confirm("CRITICAL WARNING: ERASE COMPREHENSIVE ARCHIVE DATA?")) {
      localStorage.removeItem("tracker-v2");
      setData(null);
      setTab("dashboard");
    }
  };

  if(!loaded) return null;
  if(!data || !data.onboarded) {
    return <Onboarding onComplete={(d) => persist(d)} />;
  }

  const TABS = [
    { id:"dashboard", label:"Home",     sym:"⌂" },
    { id:"habits",    label:"Habits",   sym:"◉" },
    { id:"fitness",   label:"Train",    sym:"↑" },
    { id:"goals",     label:"Goals",    sym:"◎" },
    { id:"challenge", label:"Progress", sym:"⬡" },
    { id:"analytics", label:"Charts",   sym:"📊" },
  ];

  return (
    <div style={{ background:C.pageBg, minHeight:"100vh", color:C.ink, paddingBottom:80, paddingLeft:16, paddingRight:16, boxSizing:"border-box" }}>
      <div style={{ maxWidth:460, margin:"0 auto" }}>
        {tab==="dashboard" && <Dashboard data={data} persist={persist} onTabChange={setTab} showToast={showToast} />}
        {tab==="habits"    && <Habits data={data} persist={persist} showToast={showToast} />}
        {tab==="fitness"   && <Fitness data={data} persist={persist} showToast={showToast} />}
        {tab==="goals"     && <Goals data={data} persist={persist} showToast={showToast} />}
        {tab==="challenge" && <Challenge data={data} persist={persist} showToast={showToast} onReset={handleFullReset} />}
        {tab==="analytics" && <AnalyticsPage data={data} persist={persist} showToast={showToast} />}
        {tab==="review"    && <WeeklyReview data={data} persist={persist} showToast={showToast} onBack={() => setTab("dashboard")} />}

        <NavBar activeTab={tab} onTabSelect={setTab} tabs={TABS} />
        {toast && <Toast message={toast} onClose={() => setToast("")} />}
      </div>
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({ data, persist, onTabChange, showToast }) {
  const tk = todayKey();
  const dayNum = getDayNumber();
  const progressPct = Math.round((dayNum / TOTAL_DAYS) * 100);

  const doneHabits = data.habits.filter(h => h.completions?.[tk] === "done").length;
  const totalHabits = data.habits.length;

  const currentWkKey = weekKey();
  const loggedWeight = data.weights?.[currentWkKey] || "";

  const isSunDay = isSunday();
  const revKey = getThisSundayKey();
  const reviewDone = !!data.reviews?.[revKey];

  return (
    <div style={{ paddingTop:24 }}>
      <div style={{ display:"flex", justifyContent:"between", alignItems:"center", marginBottom:14 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:800, fontFamily:FB, color:C.textLight3 }}>SYSTEM COMMENCE: {data.userName}</div>
          <div style={{ fontSize:28, fontWeight:900, fontFamily:F, lineHeight:"28px", textTransform:"uppercase" }}>CONTROL DECK</div>
        </div>
      </div>

      {isSunDay && (
        <div onClick={() => onTabChange("review")} style={{
          background: reviewDone ? C.green : C.yellow, border:`3px solid ${C.ink}`,
          padding:12, marginBottom:14, boxShadow:HS(3), cursor:"pointer",
          display:"flex", justifyContent:"space-between", alignItems:"center"
        }}>
          <span style={{ fontSize:11, fontWeight:900, fontFamily:F, textTransform:"uppercase" }}>
            {reviewDone ? "✓ WEEKLY RUNTIME SUMMARY SECURED" : "🚨 SUNDAY AUDIT: EXECUTE WEEKLY OVERVIEW"}
          </span>
          <span style={{ fontSize:14 }}>→</span>
        </div>
      )}

      <DarkCard>
        <Label dark>CHALLENGE ENGINE STATUS</Label>
        <BigNum color={C.lime}>DAY {dayNum} <span style={{ fontSize:18, fontFamily:FB, color:C.textDark3 }}>/ {TOTAL_DAYS}</span></BigNum>
        <Progress value={dayNum} max={TOTAL_DAYS} color={C.lime} style={{ marginTop:10, marginBottom:4 }} />
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, fontFamily:FB, color:C.textDark2 }}>
          <span>VELOCITY: {progressPct}%</span>
          <span>REMAINING: {TOTAL_DAYS - dayNum} DAYS</span>
        </div>
      </DarkCard>

      <WhiteCard style={{ background:C.cardMid, padding:"10px 14px" }}>
        <Label style={{ fontSize:9, marginBottom:0 }}>ORACLE CORE FEED</Label>
        <div style={{ fontSize:12, fontWeight:800, fontFamily:FB, color:C.ink, letterSpacing:"-0.2px" }}>
          "{getInsight(data)}"
        </div>
      </WhiteCard>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:4 }}>
        <WhiteCard style={{ display:"flex", flexDirection:"column", justifyContent:"between" }} onClick={() => onTabChange("habits")}>
          <div>
            <Label>HABIT LAYER</Label>
            <MedNum color={C.ink}>{doneHabits}/{totalHabits}</MedNum>
          </div>
          <Progress value={doneHabits} max={totalHabits||1} color={C.purple} height={8} style={{ marginTop:12 }} />
        </WhiteCard>

        <WhiteCard>
          <Label>WEIGHT REGISTRY</Label>
          <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
            <input type="number" step="0.1" value={loggedWeight} placeholder={data.weightStart}
              onChange={async (e) => {
                const c = { ...data };
                if (!c.weights) c.weights = {};
                c.weights[currentWkKey] = e.target.value;
                await persist(c);
              }}
              style={{
                fontSize:26, fontFamily:F, fontWeight:900, width:"75px",
                background:"none", border:"none", outline:"none", color:C.ink
              }}
            />
            <span style={{ fontSize:12, fontFamily:F, fontWeight:900 }}>KG</span>
          </div>
          <Label style={{ fontSize:9, marginTop:2 }}>WEEK ID: {currentWkKey.replace("week-","")}</Label>
        </WhiteCard>
      </div>

      <WhiteCard>
        <Label style={{ marginBottom:10 }}>SCREEN LOG CONSTRAINTS</Label>
        {last7().map(d => (
          <InlineLog key={d.key} keyName={d.key} label={`${d.day} (${d.date})`} data={data} persist={persist} />
        ))}
      </WhiteCard>
    </div>
  );
}

// ── Habits Heatmap Component ───────────────────────────────────────────────
function HabitHeatmap({ habits }) {
  const gridCells = [];
  const startOffset = new Date(CHALLENGE_START);
  const calendarDayPointer = new Date(startOffset);
  
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const key = dateKey(calendarDayPointer);
    let doneCount = 0;
    habits.forEach(h => {
      if (h.completions?.[key] === "done") doneCount++;
    });
    
    let intensity = 0;
    if (habits.length > 0 && doneCount > 0) {
      intensity = doneCount / habits.length;
    }
    
    gridCells.push({ key, intensity, dateStr: calendarDayPointer.getDate() });
    calendarDayPointer.setDate(calendarDayPointer.getDate() + 1);
  }

  return (
    <WhiteCard style={{ padding: "14px", marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: C.textLight1, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 10, fontFamily: FB }}>
        184-Day System Matrix Grid
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(23, 1fr)", gap: "3px" }}>
        {gridCells.map((cell, idx) => {
          let bg = "#E5E1D4";
          if (cell.intensity > 0) bg = "#C4F45D";
          if (cell.intensity > 0.4) bg = "#A3E635";
          if (cell.intensity > 0.7) bg = "#65A30D";
          if (cell.intensity === 1) bg = "#15803D";

          return (
            <div key={idx} title={`${cell.key}`} style={{
              width: "100%", aspectRatio: "1/1", background: bg,
              border: `1px solid rgba(10,10,10,0.15)`
            }} />
          );
        })}
      </div>
    </WhiteCard>
  );
}

// ── Habits ──────────────────────────────────────────────────────────────────
function Habits({ data, persist, showToast }) {
  const tk = todayKey();
  const [newH, setNewH] = useState("");

  const toggle = async (id) => {
    const c = { ...data };
    c.habits = c.habits.map(h => {
      if(h.id === id) {
        const completions = { ...(h.completions || {}) };
        completions[tk] = completions[tk] === "done" ? "none" : "done";
        return { ...h, completions };
      }
      return h;
    });
    await persist(c);
  };

  const addH = async () => {
    if(!newH) return;
    const c = { ...data };
    c.habits.push({ id: Date.now(), name: newH, frequency:"daily", completions:{} });
    await persist(c);
    setNewH("");
    showToast("Habit registered ✓");
  };

  const removeH = async (id) => {
    if(!confirm("Purge choice habit loop?")) return;
    const c = { ...data };
    c.habits = c.habits.filter(h => h.id !== id);
    await persist(c);
  };

  return (
    <div style={{ paddingTop:24 }}>
      <div style={{ fontSize:26, fontWeight:900, fontFamily:F, textTransform:"uppercase", marginBottom:16 }}>HABIT REPOSITORY</div>

      <HabitHeatmap habits={data.habits} />

      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <Input value={newH} onChange={e=>setNewH(e.target.value)} placeholder="New routine directive..." />
        <button onClick={addH} style={{
          background:C.cardDark, color:"#fff", border:`2px solid ${C.ink}`,
          padding:"0 16px", fontWeight:900, cursor:"pointer"
        }}>+</button>
      </div>

      {data.habits.map(h => {
        const isDone = h.completions?.[tk] === "done";
        return (
          <div key={h.id} style={{
            background: isDone ? C.lime : C.cardWhite, border:`3px solid ${C.ink}`,
            padding:"14px 16px", marginBottom:10, boxShadow:HS(3),
            display:"flex", justifyContent:"space-between", alignItems:"center",
            transition:"background 0.2s"
          }}>
            <div onClick={() => toggle(h.id)} style={{ flex:1, cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{
                width:20, height:20, border:`2px solid ${C.ink}`, background: isDone ? C.cardDark : "#fff",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:C.lime, fontWeight:900
              }}>
                {isDone && "✓"}
              </div>
              <span style={{ fontSize:14, fontWeight:800, fontFamily:FB, textDecoration: isDone?"line-through":"none" }}>{h.name}</span>
            </div>
            <button onClick={() => removeH(h.id)} style={{
              background:"none", border:"none", color:C.red, fontWeight:900, fontSize:14, cursor:"pointer", padding:"0 4px"
            }}>×</button>
          </div>
        );
      })}
    </div>
  );
}

// ── Fitness ─────────────────────────────────────────────────────────────────
function Fitness({ data, persist, showToast }) {
  const [activeRoutine, setActiveRoutine] = useState(null);
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [newRName, setNewRName] = useState("");

  const startSession = (routine) => {
    setActiveRoutine(JSON.parse(JSON.stringify(routine)));
  };

  const handleCreateRoutine = async () => {
    if(!newRName) return;
    const c = { ...data };
    c.routines.push({ id: Date.now(), name: newRName, exercises:[] });
    await persist(c);
    setNewRName("");
    setShowAddRoutine(false);
    showToast("Routine established ✓");
  };

  const handleDeleteRoutine = async (id) => {
    if(!confirm("Erase blueprint configuration?")) return;
    const c = { ...data };
    c.routines = c.routines.filter(r => r.id !== id);
    await persist(c);
  };

  if (activeRoutine) {
    return (
      <ActiveSession 
        routine={activeRoutine} 
        onDone={async (completedSession) => {
          if (completedSession) {
            const c = { ...data };
            c.sessions.push(completedSession);
            await persist(c);
            showToast("Session synced to archive ledger ✓");
          }
          setActiveRoutine(null);
        }} 
      />
    );
  }

  return (
    <div style={{ paddingTop:24 }}>
      <div style={{ display:"flex", justifyContent:"between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontSize:26, fontWeight:900, fontFamily:F, textTransform:"uppercase" }}>TRAINING PROTOCOLS</div>
        <button onClick={() => setShowAddRoutine(true)} style={{
          background:C.lime, color:C.ink, border:`2px solid ${C.ink}`,
          padding:"4px 10px", fontSize:11, fontWeight:900, fontFamily:F, textTransform:"uppercase", cursor:"pointer"
        }}>+ Create</button>
      </div>

      <RoutineHistory sessions={data.sessions} routines={data.routines} />

      <div style={{ fontSize:12, fontWeight:900, fontFamily:FB, textTransform:"uppercase", color:C.textLight3, marginBottom:8, marginTop:16 }}>Available Matrices</div>
      {data.routines.map(r => (
        <WhiteCard key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:16, fontWeight:900, fontFamily:F, textTransform:"uppercase" }}>{r.name}</div>
            <div style={{ fontSize:11, fontFamily:FB, color:C.textLight3 }}>{r.exercises.length} movements trackable</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => startSession(r)} style={{
              background:C.purple, color:"#fff", border:`2px solid ${C.ink}`,
              padding:"6px 12px", fontSize:11, fontWeight:900, fontFamily:F, textTransform:"uppercase", cursor:"pointer", boxShadow:HS(2)
            }}>Initiate</button>
            <button onClick={() => handleDeleteRoutine(r.id)} style={{
              background:"none", border:"none", color:C.red, fontSize:16, fontWeight:900, cursor:"pointer"
            }}>×</button>
          </div>
        </WhiteCard>
      ))}

      <Sheet isOpen={showAddRoutine} onClose={() => setShowAddRoutine(false)} title="New Blueprint Core">
        <Label>Routine Variant Identifier</Label>
        <Input value={newRName} onChange={e=>setNewRName(e.target.value)} placeholder="e.g. Pull Load Volume C" style={{ marginBottom:14 }} />
        <button onClick={handleCreateRoutine} style={{
          width:"100%", background:C.lime, border:`2px solid ${C.ink}`, padding:"10px 0",
          fontFamily:F, fontSize:12, fontWeight:900, textTransform:"uppercase", cursor:"pointer"
        }}>Commit Target Blueprint</button>
      </Sheet>
    </div>
  );
}

const ActiveSession = ({ routine, onDone }) => {
  const [exercises, setExercises] = useState(routine.exercises || []);
  const [exName, setExName] = useState("");

  const addExercise = () => {
    if(!exName) return;
    setExercises([...exercises, { name: exName, sets: [{ lbs: "", reps: "" }] }]);
    setExName("");
  };

  const updateSet = (exIdx, setIdx, field, val) => {
    const next = [...exercises];
    next[exIdx].sets[setIdx][field] = val;
    setExercises(next);
  };

  const addSet = (exIdx) => {
    const next = [...exercises];
    const lastSet = next[exIdx].sets[next[exIdx].sets.length - 1] || { lbs: 135, reps: 10 };
    next[exIdx].sets.push({ lbs: lastSet.lbs, reps: lastSet.reps });
    setExercises(next);
  };

  const removeSet = (exIdx, setIdx) => {
    const next = [...exercises];
    next[exIdx].sets.splice(setIdx, 1);
    setExercises(next);
  };

  const commitSession = () => {
    onDone({
      id: Date.now(),
      routineId: routine.id,
      name: routine.name,
      date: todayKey(),
      exercises: exercises.filter(e => e.sets.length > 0)
    });
  };

  return (
    <div style={{ paddingTop:24 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <Label>Active Run Protocol</Label>
          <div style={{ fontSize:24, fontWeight:900, fontFamily:F, textTransform:"uppercase" }}>{routine.name}</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => onDone(null)} style={{
            background:C.cardDark, color:"#fff", border:`2px solid ${C.ink}`, padding:"6px 10px",
            fontFamily:F, fontSize:10, textTransform:"uppercase", cursor:"pointer"
          }}>Abort</button>
          <button onClick={commitSession} style={{
            background:C.lime, color:C.ink, border:`2px solid ${C.ink}`, padding:"6px 12px",
            fontFamily:F, fontSize:11, fontWeight:900, textTransform:"uppercase", cursor:"pointer", boxShadow:HS(2)
          }}>Finish</button>
        </div>
      </div>

      {exercises.map((ex, exIdx) => (
        <WhiteCard key={exIdx} style={{ marginBottom:14 }}>
          <div style={{ fontSize:15, fontWeight:900, fontFamily:F, textTransform:"uppercase", marginBottom:10, borderBottom:`2px solid ${C.ink}`, paddingBottom:2 }}>
            {ex.name}
          </div>
          
          {ex.sets.map((s, sIdx) => (
            <div key={sIdx} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <span style={{ fontSize:10, fontFamily:FB, fontWeight:900, width:45 }}>SET {sIdx+1}</span>
              <Input type="number" placeholder="lbs" value={s.lbs} onChange={e => updateSet(exIdx, sIdx, "lbs", e.target.value)} style={{ flex:1, padding:"4px 6px", textAlign:"center" }} />
              <span style={{ fontSize:10, fontFamily:FB }}>×</span>
              <Input type="number" placeholder="reps" value={s.reps} onChange={e => updateSet(exIdx, sIdx, "reps", e.target.value)} style={{ flex:1, padding:"4px 6px", textAlign:"center" }} />
              <button onClick={() => removeSet(exIdx, sIdx)} style={{ background:"none", border:"none", color:C.red, fontWeight:900, cursor:"pointer", padding:"0 6px" }}>×</button>
            </div>
          ))}

          <button onClick={() => addSet(exIdx)} style={{
            marginTop:6, background:C.pageBg, border:`2px solid ${C.ink}`, width:"100%", padding:"4px 0",
            fontSize:10, fontFamily:FB, fontWeight:900, textTransform:"uppercase", cursor:"pointer"
          }}>+ Append System Set</button>
        </WhiteCard>
      ))}

      <WhiteCard style={{ background:C.cardMid }}>
        <Label>Inject Movement Dynamic</Label>
        <div style={{ display:"flex", gap:8 }}>
          <Input value={exName} onChange={e=>setExName(e.target.value)} placeholder="e.g. Incline DB Fly" />
          <button onClick={addExercise} style={{
            background:C.cardDark, color:"#fff", border:`2px solid ${C.ink}`, padding:"0 14px", fontWeight:900, cursor:"pointer"
          }}>+</button>
        </div>
      </WhiteCard>
    </div>
  );
};

const RoutineHistory = ({ sessions }) => {
  const [expanded, setExpanded] = useState(false);
  if(!sessions || sessions.length === 0) return null;
  const recent = [...sessions].reverse().slice(0, expanded ? 20 : 2);

  return (
    <DarkCard>
      <Label dark>Ledger Core History Logs</Label>
      {recent.map((s, idx) => (
        <div key={idx} style={{ padding:"6px 0", borderBottom: idx===recent.length-1?"none":`1px solid ${C.textDark3}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontFamily:FB, fontWeight:800 }}>
            <span style={{ color:C.lime }}>{s.name.toUpperCase()}</span>
            <span style={{ color:C.textDark3 }}>{s.date}</span>
          </div>
          <div style={{ fontSize:11, color:C.textDark2, fontFamily:FM, marginTop:2 }}>
            {s.exercises.map(e => `${e.name} (${e.sets.length}s)`).join(", ")}
          </div>
        </div>
      ))}
      {sessions.length > 2 && (
        <button onClick={() => setExpanded(!expanded)} style={{
          width:"100%", background:"none", border:"none", color:C.lime, fontSize:9,
          fontFamily:FB, fontWeight:900, textTransform:"uppercase", textAlign:"center", marginTop:6, cursor:"pointer"
        }}>
          {expanded ? "Collapse Backlog" : `Show Complete History Logs (${sessions.length})`}
        </button>
      )}
    </DarkCard>
  );
};

// ── Goals ───────────────────────────────────────────────────────────────────
function Goals({ data, persist, showToast }) {
  const [text, setText] = useState("");
  const [deadline, setDeadline] = useState("");
  const [linkedHabitId, setLinkedHabitId] = useState("");

  const toggleGoal = async (id) => {
    const c = { ...data };
    c.goals = c.goals.map(g => {
      if(g.id === id) {
        const nextState = !g.completed;
        return { ...g, completed: nextState, status: nextState ? "completed" : "active" };
      }
      return g;
    });
    await persist(c);
    showToast("Goal status synchronized ✓");
  };

  const addGoal = async () => {
    if(!text) return;
    const c = { ...data };
    if(!c.goals) c.goals = [];
    c.goals.push({
      id: Date.now(),
      text,
      completed: false,
      status: "active",
      deadline,
      linkedHabitId: linkedHabitId ? Number(linkedHabitId) : null
    });
    await persist(c);
    setText("");
    setDeadline("");
    setLinkedHabitId("");
    showToast("Blueprint directive established ✓");
  };

  const removeGoal = async (id) => {
    if(!confirm("Erase blueprint structural goal?")) return;
    const c = { ...data };
    c.goals = c.goals.filter(g => g.id !== id);
    await persist(c);
  };

  return (
    <div style={{ paddingTop:24 }}>
      <div style={{ fontSize:26, fontWeight:900, fontFamily:F, textTransform:"uppercase", marginBottom:16 }}>CRITICAL DIRECTIVES</div>

      <WhiteCard style={{ background:C.cardMid }}>
        <Label>Formulate Macro Directive Target</Label>
        <Input value={text} onChange={e=>setText(e.target.value)} placeholder="Objective parameter..." style={{ marginBottom:10 }} />
        
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
          <div>
            <Label style={{ fontSize:10 }}>Target Date Cutoff</Label>
            <Input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} style={{ padding:"6px" }} />
          </div>
          <div>
            <Label style={{ fontSize:10 }}>Link Habit Generator</Label>
            <select 
              value={linkedHabitId} 
              onChange={e => setLinkedHabitId(e.target.value)}
              style={{
                width:"100%", background:C.pageBg, border:`2px solid ${C.ink}`,
                padding:"7px 6px", fontSize:11, fontWeight:700, fontFamily:FB, color:C.ink
              }}
            >
              <option value="">-- No link --</option>
              {data.habits.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button onClick={addGoal} style={{
          width:"100%", background:C.cardDark, color:"#fff", border:`2px solid ${C.ink}`,
          padding:"8px 0", fontFamily:F, fontSize:12, fontWeight:900, textTransform:"uppercase", cursor:"pointer"
        }}>Register System Directive</button>
      </WhiteCard>

      {data.goals?.map(g => {
        const linkedHabit = data.habits.find(h => h.id === g.linkedHabitId);
        return (
          <div key={g.id} style={{
            background: g.completed ? C.cardMid : C.cardWhite, border:`3px solid ${C.ink}`,
            padding:"14px 16px", marginBottom:10, boxShadow:HS(3),
            display:"flex", justifyContent:"space-between", alignItems:"center"
          }}>
            <div style={{ flex:1, display:"flex", alignItems:"flex-start", gap:12 }}>
              <div onClick={() => toggleGoal(g.id)} style={{
                width:20, height:20, border:`2px solid ${C.ink}`, background: g.completed ? C.cardDark : "#fff",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:C.lime, fontWeight:900, marginTop:2, cursor:"pointer"
              }}>
                {g.completed && "✓"}
              </div>
              <div>
                <span style={{ fontSize:14, fontWeight:800, fontFamily:FB, textDecoration: g.completed?"line-through":"none" }}>
                  {g.text}
                </span>
                <div style={{ display:"flex", gap:10, marginTop:4 }}>
                  {g.deadline && (
                    <span style={{ fontSize:9, fontFamily:FM, background:C.cardDark, color:"#fff", padding:"1px 5px", textTransform:"uppercase" }}>
                      📅 Target: {g.deadline}
                    </span>
                  )}
                  {linkedHabit && (
                    <span style={{ fontSize:9, fontFamily:FM, background:C.purple, color:"#fff", padding:"1px 5px", textTransform:"uppercase" }}>
                      ⚙️ Loop: {linkedHabit.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={() => removeGoal(g.id)} style={{
              background:"none", border:"none", color:C.red, fontWeight:900, fontSize:14, cursor:"pointer", padding:"0 4px"
            }}>×</button>
          </div>
        );
      })}
    </div>
  );
}

// ── Challenge (with Reset) ──────────────────────────────────────────────────
function Challenge({ data, persist, showToast, onReset }) {
  const currentDay = getDayNumber();

  const handleDayTap = async (dayIdx) => {
    const c = { ...data };
    if(!c.noZeroCheckins) c.noZeroCheckins = {};
    const currentStatus = c.noZeroCheckins[dayIdx];
    
    if(!currentStatus) c.noZeroCheckins[dayIdx] = "done";
    else if(currentStatus === "done") c.noZeroCheckins[dayIdx] = "fail";
    else delete c.noZeroCheckins[dayIdx];

    await persist(c);
  };

  return (
    <div style={{ paddingTop:24 }}>
      <div style={{ fontSize:26, fontWeight:900, fontFamily:F, textTransform:"uppercase", marginBottom:4 }}>CHALLENGE MATRIX</div>
      <div style={{ fontSize:11, fontFamily:FB, color:C.textLight3, marginBottom:16 }}>TRACK NO-ZERO COMPLIANCE (TAP TO ROTATE STATUS)</div>

      <WhiteCard style={{ padding:12 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:4 }}>
          {Array.from({ length: TOTAL_DAYS }, (_, i) => {
            const dayNum = i + 1;
            const status = data.noZeroCheckins?.[dayNum];
            const isPast = dayNum < currentDay;
            const isCurr = dayNum === currentDay;

            let bg = C.cardWhite;
            let borderStyle = `2px solid ${C.ink}`;
            let color = C.ink;

            if (status === "done") bg = C.lime;
            if (status === "fail") bg = C.red;
            if (isCurr && !status) {
              borderStyle = `2.5px dashed ${C.purple}`;
            }

            return (
              <div key={dayNum} onClick={() => handleDayTap(dayNum)} style={{
                aspectRatio:"1/1", display:"flex", alignItems:"center", justifyContent:"center",
                background:bg, border:borderStyle, color:color, fontSize:10, fontWeight:900,
                fontFamily:FM, cursor:"pointer", opacity: (isPast||isCurr)? 1 : 0.35, position:"relative"
              }}>
                {dayNum}
              </div>
            );
          })}
        </div>
      </WhiteCard>

      <WhiteCard style={{ border:`3px solid ${C.red}`, background:"#FFF1F1", marginTop:24 }}>
        <Label color={C.red}>DANGER SPACE</Label>
        <div style={{ fontSize:12, fontFamily:FB, color:C.ink, marginBottom:12 }}>RESET THE LOCAL APPLICATION ENVIRONMENT CONTAINER. ALL COMPLETED WORKOUT LOGS AND SEED METRICS WILL VANISH FOREVER.</div>
        <button onClick={onReset} style={{
          background:C.red, color:"#fff", border:`2px solid ${C.ink}`, width:"100%", padding:"10px 0",
          fontFamily:F, fontSize:12, fontWeight:900, textTransform:"uppercase", cursor:"pointer", boxShadow:HS(2)
        }}>Destroy Storage Indexes</button>
      </WhiteCard>
    </div>
  );
}

// ── Weekly Review ───────────────────────────────────────────────────────────
function WeeklyReview({ data, persist, showToast, onBack }) {
  const rKey = getThisSundayKey();
  const [win, setWin] = useState(data.reviews?.[rKey]?.win || "");
  const [improve, setImprove] = useState(data.reviews?.[rKey]?.improve || "");
  const [gymNotes, setGymNotes] = useState(data.reviews?.[rKey]?.gymNotes || "");
  const [showMore, setShowMore] = useState(false);

  // Compute calculated metrics for this week dynamically
  const cwk = weekKey();
  const currW = data.weights?.[cwk] || "Not Logged";

  const tKey = todayKey();
  const weekComps = data.habits.reduce((acc, h) => {
    let done = 0;
    last7().forEach(d => { if(h.completions?.[d.key] === "done") done++; });
    return acc + done;
  }, 0);
  const totalPossible = data.habits.length * 7;
  const habitPct = totalPossible ? Math.round((weekComps / totalPossible) * 100) : 0;

  const weekSessions = data.sessions?.filter(s => {
    const sDate = new Date(s.date);
    const diffTime = Math.abs(new Date() - sDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  }) || [];
  const gymCnt = weekSessions.length;

  const saveReview = async () => {
    const c = { ...data };
    if(!c.reviews) c.reviews = {};
    c.reviews[rKey] = { win, improve, gymNotes };
    await persist(c);
    showToast("Audit parameters logged to disk ✓");
    onBack();
  };

  const metrics = [
    { l:"Habits Kept", v:`${habitPct}%` },
    { l:"Workouts Logged", v:`${gymCnt} sessions` },
    { l:"Current weight", v: currW !== "Not Logged" ? `${currW} KG` : currW }
  ];

  return (
    <div style={{ paddingTop:24 }}>
      <div style={{ display:"flex", justifyContent:"between", alignItems:"center", marginBottom:16 }}>
        <div>
          <Label>System Audit Endpoint</Label>
          <div style={{ fontSize:26, fontWeight:900, fontFamily:F, textTransform:"uppercase" }}>SUNDAY PROTOCOL REVIEW</div>
        </div>
        <button onClick={onBack} style={{
          background:C.cardDark, color:"#fff", border:`2px solid ${C.ink}`, padding:"4px 10px",
          fontFamily:F, fontSize:10, textTransform:"uppercase", cursor:"pointer"
        }}>Back</button>
      </div>

      <WhiteCard style={{ background:C.lime, padding:14, marginBottom:14 }}>
        <Label dark style={{ color:C.textLight3 }}>Weekly Automated Sync Capture</Label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:8 }}>
          {metrics.map((m, i) => (
            <div key={i} style={{ background:C.cardWhite, border:`2px solid ${C.ink}`, padding:8, textAlign:"center" }}>
              <div style={{ fontSize:16, fontFamily:F, fontWeight:900 }}>{m.v}</div>
              <div style={{ fontSize:8, fontWeight:800, color:C.ink, fontFamily:FB, letterSpacing:"0.8px" }}>{m.l.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </WhiteCard>

      <WhiteCard style={{ marginBottom:14 }}>
        <Label color={C.green} style={{ marginBottom:8 }}>One win this week</Label>
        <Input value={win} onChange={e=>setWin(e.target.value)} placeholder="e.g. Hit all my PRs" />
      </WhiteCard>

      <WhiteCard style={{ marginBottom:14 }}>
        <Label color={C.red} style={{ marginBottom:8 }}>One thing to improve</Label>
        <Input value={improve} onChange={e=>setImprove(e.target.value)} placeholder="e.g. Sleep earlier" />
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
          <Textarea value={gymNotes} onChange={e=>setGymNotes(e.target.value)} placeholder="Lifts, form cues, how it felt..." />
        </WhiteCard>
      )}

      <button onClick={saveReview} style={{
        width:"100%", background:C.cardDark, color:"#fff", border:`3px solid ${C.ink}`,
        padding:"12px 0", fontSize:13, fontWeight:900, fontFamily:F, textTransform:"uppercase",
        boxShadow:HS(4), cursor:"pointer"
      }}>Commit Review Record</button>
    </div>
  );
}

// ── Analytics Page Component ────────────────────────────────────────────────
function AnalyticsPage({ data, persist, showToast }) {
  const [subTab, setSubTab] = useState("habits");

  // 1. Habit Calculations
  const habitStats = data.habits.map(h => {
    const comps = Object.values(h.completions || {});
    const doneCount = comps.filter(v => v === "done").length;
    const totalCount = comps.length || 1;
    const pct = Math.round((doneCount / totalCount) * 100);

    let bestStreak = 0;
    let tempStreak = 0;
    const checkD = new Date(); checkD.setHours(0,0,0,0);

    for (let i = 0; i < 184; i++) {
      const k = dateKey(checkD);
      if (h.completions?.[k] === "done") {
        tempStreak++;
        if (tempStreak > bestStreak) bestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
      checkD.setDate(checkD.getDate() - 1);
    }

    let currentStreak = 0;
    const activeD = new Date(); activeD.setHours(0,0,0,0);
    if (h.completions?.[dateKey(activeD)] !== "done") {
      activeD.setDate(activeD.getDate() - 1);
    }
    while (h.completions?.[dateKey(activeD)] === "done") {
      currentStreak++;
      activeD.setDate(activeD.getDate() - 1);
    }

    return { name: h.name, pct, bestStreak, currentStreak };
  });

  const overallHabitPct = data.habits.length 
    ? Math.round(habitStats.reduce((acc, h) => acc + h.pct, 0) / data.habits.length) 
    : 0;
  const bestOverallStreak = Math.max(...habitStats.map(h => h.bestStreak), 0);
  const currentOverallStreak = Math.max(...habitStats.map(h => h.currentStreak), 0);

  // 2. Workout Calculations
  const totalWorkouts = data.sessions?.length || 0;
  const elapsedWeeks = Math.max(1, Math.ceil(getDayNumber() / 7));
  const weeklyFreq = (totalWorkouts / elapsedWeeks).toFixed(1);

  const routineCounts = (data.sessions || []).reduce((acc, s) => {
    acc[s.routineId] = (acc[s.routineId] || 0) + 1;
    return acc;
  }, {});
  
  let mostTrainedRoutine = "None";
  let maxCount = 0;
  Object.entries(routineCounts).forEach(([id, count]) => {
    if (count > maxCount) {
      maxCount = count;
      const r = data.routines.find(rt => String(rt.id) === String(id));
      if (r) mostTrainedRoutine = r.name;
    }
  });

  // 3. Weight Calculations
  const weightEntries = Object.entries(data.weights || {})
    .map(([wk, w]) => ({ name: wk.replace("week-", ""), weight: parseFloat(w) || data.weightStart }))
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const currentWeight = weightEntries.length ? weightEntries[weightEntries.length - 1].weight : data.weightStart;
  const totalWeightChange = data.weightStart && currentWeight ? (currentWeight - data.weightStart).toFixed(1) : "0.0";
  const targetWeightDiff = data.weightStart && data.weightTarget ? Math.abs(data.weightTarget - data.weightStart) : 0;
  const currentProgressDiff = data.weightStart && currentWeight ? Math.abs(currentWeight - data.weightStart) : 0;
  const weightProgressPct = targetWeightDiff ? Math.min(100, Math.round((currentProgressDiff / targetWeightDiff) * 100)) : 0;

  // 4. Screen Time Calculations
  const scValues = Object.values(data.screenTime || {});
  const scLoggedDays = scValues.length || 1;
  const scSum = scValues.reduce((acc, val) => acc + parseFloat(val || 0), 0);
  const scDailyAvg = (scSum / scLoggedDays).toFixed(1);
  const scWeeklyAvg = (parseFloat(scDailyAvg) * 7).toFixed(1);
  const scAdherencePct = scValues.length 
    ? Math.round((scValues.filter(v => parseFloat(v) <= (data.screenTimeGoal || 3)).length / scValues.length) * 100)
    : 100;

  const scChartData = Object.entries(data.screenTime || {})
    .map(([date, hrs]) => ({ name: date.slice(5), hours: parseFloat(hrs) }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(-7);

  // 5. Goal Calculations
  const completedGoals = data.goals?.filter(g => g.completed || g.status === "completed").length || 0;
  const activeGoals = data.goals?.filter(g => !g.completed && g.status !== "completed").length || 0;
  const totalGoals = completedGoals + activeGoals;
  const goalCompletionPct = totalGoals ? Math.round((completedGoals / totalGoals) * 100) : 0;

  return (
    <div style={{ paddingTop: 24 }}>
      <div style={{ fontSize: 26, fontWeight: 900, fontFamily: F, textTransform: "uppercase", marginBottom: 16 }}>
        Metrics Engine
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12, marginBottom: 16 }}>
        {["habits", "workouts", "weight", "screen", "goals"].map(t => (
          <button key={t} onClick={() => setSubTab(t)} style={{
            background: subTab === t ? C.lime : C.cardWhite,
            color: C.ink, border: `2px solid ${C.ink}`, borderRadius: 0,
            padding: "6px 12px", fontSize: 11, fontWeight: 800, fontFamily: FB,
            textTransform: "uppercase", letterSpacing: "0.5px", cursor: "pointer",
            boxShadow: subTab === t ? HS(2) : "none"
          }}>
            {t}
          </button>
        ))}
      </div>

      {subTab === "habits" && (
        <div>
          <DarkCard style={{ marginBottom: 14 }}>
            <Label dark>Habit Completion Matrix</Label>
            <BigNum color={C.lime}>{overallHabitPct}%</BigNum>
            <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
              <div>
                <Label dark style={{ fontSize: 10 }}>Best Streak</Label>
                <MedNum color={C.textDark2}>{bestOverallStreak}d</MedNum>
              </div>
              <div>
                <Label dark style={{ fontSize: 10 }}>Current Streak</Label>
                <MedNum color={C.purple}>{currentOverallStreak}d</MedNum>
              </div>
            </div>
          </DarkCard>

          <WhiteCard>
            <Label style={{ marginBottom: 12 }}>Manifest Breakdown</Label>
            {habitStats.map((h, i) => (
              <div key={i} style={{ marginBottom: 12, borderBottom: `2px solid ${C.pageBg}`, paddingBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, fontFamily: FB, marginBottom: 4 }}>
                  <span>{h.name}</span>
                  <span style={{ fontFamily: FM }}>{h.pct}%</span>
                </div>
                <Progress value={h.pct} color={C.purple} height={8} />
                <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 10, color: C.textLight3, fontFamily: FB }}>
                  <span>CURRENT: {h.currentStreak}d</span>
                  <span>PEAK: {h.bestStreak}d</span>
                </div>
              </div>
            ))}
          </WhiteCard>
        </div>
      )}

      {subTab === "workouts" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <DarkCard style={{ flex: 1, padding: "14px" }}>
              <Label dark>Total Lift Logs</Label>
              <MedNum color={C.textDark2}>{totalWorkouts}</MedNum>
            </DarkCard>
            <DarkCard style={{ flex: 1, padding: "14px" }}>
              <Label dark>Weekly Tempo</Label>
              <MedNum color={C.lime}>{weeklyFreq}</MedNum>
            </DarkCard>
          </div>

          <WhiteCard style={{ marginBottom: 14 }}>
            <Label>Dominant Routine Core</Label>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: F, color: C.purple, marginTop: 4, textTransform: "uppercase" }}>
              {mostTrainedRoutine}
            </div>
          </WhiteCard>

          {totalWorkouts > 0 && (
            <WhiteCard>
              <Label style={{ marginBottom: 12 }}>Volume Graph Distribution</Label>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={data.routines.map(r => ({ name: r.name.slice(0, 6), sessions: routineCounts[r.id] || 0 }))}>
                  <XAxis dataKey="name" stroke={C.ink} style={{ fontSize: 10, fontFamily: FM }} />
                  <Tooltip />
                  <Bar dataKey="sessions" fill={C.purple} stroke={C.ink} strokeWidth={2} />
                </BarChart>
              </ResponsiveContainer>
            </WhiteCard>
          )}
        </div>
      )}

      {subTab === "weight" && (
        <div>
          <DarkCard style={{ marginBottom: 14 }}>
            <Label dark>Net Scale Variance</Label>
            <BigNum color={parseFloat(totalWeightChange) <= 0 ? C.lime : C.red}>
              {parseFloat(totalWeightChange) > 0 ? `+${totalWeightChange}` : totalWeightChange} <span style={{ fontSize: 20 }}>KG</span>
            </BigNum>
            <div style={{ fontSize: 11, color: C.textDark2, fontFamily: FB, marginTop: 6 }}>
              PROGRESS EN ROUTE TO TARGET: {weightProgressPct}%
            </div>
            <Progress value={weightProgressPct} color={C.lime} height={8} style={{ marginTop: 8 }} />
          </DarkCard>

          {weightEntries.length > 0 && (
            <WhiteCard>
              <Label style={{ marginBottom: 12 }}>Body Mass Index Progression</Label>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={weightEntries}>
                  <XAxis dataKey="name" stroke={C.ink} style={{ fontSize: 10, fontFamily: FM }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="weight" stroke={C.purple} strokeWidth={3} dot={{ fill: C.lime, stroke: C.ink, strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </WhiteCard>
          )}
        </div>
      )}

      {subTab === "screen" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <DarkCard style={{ flex: 1, padding: "14px" }}>
              <Label dark>Daily Mean</Label>
              <MedNum color={C.textDark2}>{scDailyAvg}h</MedNum>
            </DarkCard>
            <DarkCard style={{ flex: 1, padding: "14px" }}>
              <Label dark>Weekly Velocity</Label>
              <MedNum color={C.lime}>{scWeeklyAvg}h</MedNum>
            </DarkCard>
          </div>

          <DarkCard style={{ marginBottom: 14, background: C.purple }}>
            <Label dark>Goal Adherence Rate</Label>
            <BigNum color={C.lime}>{scAdherencePct}%</BigNum>
            <div style={{ fontSize: 11, color: C.textDark2, fontFamily: FB, marginTop: 4 }}>
              LOGGED DAYS CONSTRAINED BELOW {data.screenTimeGoal || 3}H LIMIT
            </div>
          </DarkCard>

          {scChartData.length > 0 && (
            <WhiteCard>
              <Label style={{ marginBottom: 12 }}>Usage Vectors (Last 7 Submissions)</Label>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={scChartData}>
                  <XAxis dataKey="name" stroke={C.ink} style={{ fontSize: 10, fontFamily: FM }} />
                  <Tooltip />
                  <Bar dataKey="hours" fill={C.yellow} stroke={C.ink} strokeWidth={2} />
                </BarChart>
              </ResponsiveContainer>
            </WhiteCard>
          )}
        </div>
      )}

      {subTab === "goals" && (
        <div>
          <DarkCard style={{ marginBottom: 14 }}>
            <Label dark>Goal Execution Matrix</Label>
            <BigNum color={C.lime}>{goalCompletionPct}%</BigNum>
            <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
              <div>
                <Label dark style={{ fontSize: 10 }}>Active Targets</Label>
                <MedNum color={C.textDark2}>{activeGoals}</MedNum>
              </div>
              <div>
                <Label dark style={{ fontSize: 10 }}>Fulfilled Blueprints</Label>
                <MedNum color={C.lime}>{completedGoals}</MedNum>
              </div>
            </div>
          </DarkCard>
        </div>
      )}

      <TransformationTimelineSection data={data} persist={persist} showToast={showToast} />
      <BackupExportSection data={data} persist={persist} showToast={showToast} />
    </div>
  );
}

// ── Transformation Timeline ──────────────────────────────────────────────────
function TransformationTimelineSection({ data, persist, showToast }) {
  const [fullscreen, setFullscreen] = useState(null);

  const milestones = [
    { key: "week1",  label: "Week 1",  meta: "Baseline Registry" },
    { key: "week4",  label: "Week 4",  meta: "First Ignition" },
    { key: "week8",  label: "Week 8",  meta: "Midpoint Crux" },
    { key: "week12", label: "Week 12", meta: "Peak Transmutation" },
  ];

  const capturePhoto = (key, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const payload = {
        url: reader.result,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      };
      await persist({
        ...data,
        photos: { ...data.photos, [key]: payload }
      });
      showToast(`${key.toUpperCase()} State captured ✓`);
    };
    reader.readAsDataURL(file);
  };

  return (
    <WhiteCard style={{ marginBottom: 14, marginTop: 14 }}>
      <Label style={{ marginBottom: 12 }}>⚡ Transformation Timeline</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {milestones.map(m => {
          const slot = data.photos?.[m.key];
          const populated = !!slot?.url;
          return (
            <div key={m.key} style={{ border: `3px solid ${C.ink}`, padding: 8, background: C.pageBg, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 11, fontWeight: 900, fontFamily: F, textTransform: "uppercase" }}>{m.label}</div>
              
              <div style={{ 
                width: "100%", height: 100, background: "#E5E1D4", border: `2px solid ${C.ink}`, 
                marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", 
                overflow: "hidden", cursor: populated ? "pointer" : "default" 
              }} onClick={() => populated && setFullscreen(slot)}>
                {populated ? (
                  <img src={slot.url} alt={m.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 20 }}>📸</span>
                )}
              </div>

              <div style={{ fontSize: 9, fontWeight: 800, fontFamily: FM, color: C.textLight3, marginTop: 4 }}>
                {populated ? slot.date : m.meta}
              </div>

              <label style={{ 
                marginTop: 6, display: "block", background: C.ink, color: C.lime, 
                fontSize: 9, fontWeight: 900, fontFamily: F, padding: "4px 0", 
                textAlign: "center", cursor: "pointer", textTransform: "uppercase" 
              }}>
                {populated ? "Replace" : "Upload"}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => capturePhoto(m.key, e.target.files[0])} />
              </label>
            </div>
          );
        })}
      </div>

      {fullscreen && (
        <div style={{ 
          position: "fixed", inset: 0, background: "rgba(10,10,10,0.95)", zIndex: 9999, 
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 
        }} onClick={() => setFullscreen(null)}>
          <div style={{ color: "#fff", fontFamily: F, fontSize: 12, marginBottom: 8, letterSpacing: "1px" }}>
            PREVIEW • {fullscreen.date.toUpperCase()}
          </div>
          <img src={fullscreen.url} alt="Fullscreen Mode" style={{ maxWidth: "100%", maxHeight: "80vh", border: `3px solid ${C.lime}` }} />
          <div style={{ color: C.textDark3, fontFamily: FB, fontSize: 11, marginTop: 12 }}>TAP ANYWHERE TO COLLAPSE</div>
        </div>
      )}
    </WhiteCard>
  );
}

// ── Backup & Export ─────────────────────────────────────────────────────────
function BackupExportSection({ data, persist, showToast }) {
  
  const handleExport = () => {
    const activeVersion = data.version || 3;
    const stream = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const targetUrl = URL.createObjectURL(stream);
    const downloadHook = document.createElement("a");
    downloadHook.href = targetUrl;
    downloadHook.download = `tracker-backup-v${activeVersion}.json`;
    document.body.appendChild(downloadHook);
    downloadHook.click();
    document.body.removeChild(downloadHook);
    URL.revokeObjectURL(targetUrl);
    showToast("Backup Manifest Exported ✓");
  };

  const handleImport = (file) => {
    if (!file) return;
    const engine = new FileReader();
    engine.onload = async (e) => {
      try {
        const payload = JSON.parse(e.target.result);
        
        if (!payload || typeof payload !== "object") throw new Error("Faulty structural layout.");
        if (!payload.onboarded) throw new Error("Missing verification onboarding handshake tags.");
        if (!Array.isArray(payload.habits)) throw new Error("Habit repository corrupted.");
        if (!Array.isArray(payload.routines)) throw new Error("Routine manifest index broken.");
        if (!Array.isArray(payload.sessions)) throw new Error("Session history ledger unreadable.");

        const consolidated = runMigrationPipeline(payload);

        await persist(consolidated);
        showToast("System State Restored ✓");
        setTimeout(() => window.location.reload(), 500);
      } catch (err) {
        alert(`Ingestion Terminated: ${err.message}`);
      }
    };
    text = engine.readAsText(file);
  };

  return (
    <WhiteCard style={{ marginBottom: 14 }}>
      <Label style={{ marginBottom: 10 }}>💾 Core Ledger Custody</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button onClick={handleExport} style={{
          background: C.cardDark, color: C.lime, padding: "10px 0",
          border: `2px solid ${C.ink}`, fontFamily: F, fontSize: 11,
          textTransform: "uppercase", cursor: "pointer", boxShadow: HS(2)
        }}>
          📥 Export State
        </button>
        
        <label style={{
          background: C.yellow, color: C.ink, padding: "10px 0",
          border: `2px solid ${C.ink}`, fontFamily: F, fontSize: 11,
          textTransform: "uppercase", cursor: "pointer", display: "block",
          textAlign: "center", boxShadow: HS(2)
        }}>
          📤 Import Block
          <input type="file" accept=".json" style={{ display: "none" }} onChange={e => handleImport(e.target.files[0])} />
        </label>
      </div>
    </WhiteCard>
  );
}