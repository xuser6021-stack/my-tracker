import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";

const CHALLENGE_START = new Date("2025-07-01");
const TOTAL_DAYS = 184;
const MONTHS = ["Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_NUMS = [6,7,8,9,10,11];
const DAYS_SHORT = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

// ── Schema versioning ─────────────────────────────────────────────────────────
const SCHEMA_VERSION = 5;

function validateImport(parsed) {
  if (!parsed || typeof parsed !== "object") return { ok:false, error:"Not a valid JSON object" };
  const isWrapped = parsed.schemaVersion != null || parsed._schemaVersion != null || parsed.data != null;
  const raw = isWrapped ? (parsed.data || parsed) : parsed;
  const fromVersion = isWrapped ? (parsed.schemaVersion || parsed._schemaVersion || 1) : 1;
  const required = ["habits","sessions","goals","weights","screenTime","reviews","onboarded"];
  for (const k of required) {
    if (!(k in raw)) return { ok:false, error:`Missing field: ${k}` };
  }
  if (!Array.isArray(raw.habits))   return { ok:false, error:"habits must be an array" };
  if (!Array.isArray(raw.sessions)) return { ok:false, error:"sessions must be an array" };
  if (!Array.isArray(raw.goals))    return { ok:false, error:"goals must be an array" };
  return { ok:true, data:raw, fromVersion };
}

function runMigrations(d, fromVersion = 1) {
  let out = { ...d };
  if (fromVersion < 2) {
    out.goals = (out.goals||[]).map(g => ({ linkedHabitIds:[], ...g }));
  }
  if (fromVersion < 3) {
    if (!out.prHistory)        out.prHistory = {};
    if (!out.photos)           out.photos = {};
    if (!out.noZeroCheckins)   out.noZeroCheckins = {};
    if (!out.routines)         out.routines = [];
  }
  if (fromVersion < 4) {
    if (!out.mealTemplates)    out.mealTemplates = [];
    if (!out.mealLogs)         out.mealLogs = {};
  }
  if (fromVersion < 5) {
    out.sessions = (out.sessions || []).map(sess => ({
      ...sess,
      exercises: sess.exercises.map(ex => {
        if (ex.sets && Array.isArray(ex.sets)) return ex; 
        const numSets = parseInt(ex.sets) || 1;
        const weight = ex.weight || "";
        const reps = ex.reps || "";
        const newSets = Array.from({ length: numSets }, () => ({ weight, reps }));
        return { name: ex.name, sets: newSets };
      })
    }));
  }
  return out;
}

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

function migrateData(d) {
  if (!d) return d;
  const fromVersion = d._schemaVersion || 1;
  const migrated = runMigrations(d, fromVersion);
  migrated._schemaVersion = SCHEMA_VERSION;
  if (fromVersion < SCHEMA_VERSION) save("tracker-v2", migrated);
  return migrated;
}

// ── PR helpers ───────────────────────────────────────────────────────────────
function getPR(prHistory, exerciseName) {
  const history = prHistory?.[exerciseName];
  if (!history || !history.length) return null;
  return Math.max(...history.map(e => parseFloat(e.weight) || 0));
}

function detectAndStorePRs(exercises, prHistory) {
  const updated = { ...prHistory };
  const newPRs = new Set();
  for (const ex of exercises) {
    const name = ex.name.trim();
    if (!name || !ex.sets) continue;
    let maxW = 0;
    for (const s of ex.sets) {
      const w = parseFloat(s.weight);
      if (w > maxW) maxW = w;
    }
    if (maxW <= 0) continue;
    const prev = getPR(updated, name);
    if (prev === null || maxW > prev) {
      updated[name] = [...(updated[name] || []), { date: todayKey(), weight: maxW }];
      newPRs.add(name);
    }
  }
  return { updatedHistory: updated, newPRs };
}

// ── Calendar Heatmap helpers ─────────────────────────────────────────────────
function buildHeatmapCells(habits, days = 90) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    d.setHours(0, 0, 0, 0);
    const key = dateKey(d);
    const done  = habits.filter(h => h.completions?.[key] === "done").length;
    const missed = habits.filter(h => h.completions?.[key] === "missed").length;
    const total = habits.length;
    return {
      key, date: d, done, missed, total,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
      month: d.toLocaleDateString("en-US", { month: "short" }),
      dayOfMonth: d.getDate(),
      dayOfWeek: d.getDay(), 
      isToday: key === todayKey(),
    };
  });
}

function getGoalSupportScore(goal, habits) {
  const ids = goal.linkedHabitIds || [];
  if (!ids.length) return null;
  const linked = habits.filter(h => ids.includes(h.id));
  if (!linked.length) return null;
  const today = todayKey();
  const done = linked.filter(h => h.completions?.[today] === "done").length;
  return Math.round((done / linked.length) * 100);
}

// ── Meal Tracker helpers ─────────────────────────────────────────────────
function getMealStatsForDay(data, dKey) {
  const templates = data.mealTemplates || [];
  const logs = (data.mealLogs || {})[dKey] || {};
  let total = 0;
  let done = 0;
  templates.forEach(t => {
    total += t.items.length;
    const tLog = logs[t.id] || {};
    t.items.forEach((_, i) => {
      if (tLog[i]) done++;
    });
  });
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, pct, isSuccess: pct >= 80 && total > 0 };
}

function getCurrentMealStreak(data) {
  let streak = 0;
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const todayStats = getMealStatsForDay(data, dateKey(d));
  if (todayStats.isSuccess) streak++;
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const k = dateKey(d);
    const stats = getMealStatsForDay(data, k);
    if (stats.isSuccess) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

function getBestMealStreak(data) {
  const logs = data.mealLogs || {};
  const dates = Object.keys(logs).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  if (!dates.length) return 0;
  let best = 0;
  let run = 0;
  let prevDate = null;
  for (const d of dates) {
    const stats = getMealStatsForDay(data, d);
    if (stats.isSuccess) {
      const currDate = new Date(d);
      if (!prevDate) {
        run = 1;
      } else {
        const diffDays = Math.round((currDate - prevDate) / 86400000);
        if (diffDays === 1) { run++; }
        else { run = 1; }
      }
      if (run > best) best = run;
      prevDate = currDate;
    } else {
      run = 0;
      prevDate = null;
    }
  }
  const current = getCurrentMealStreak(data);
  return Math.max(best, current);
}

// ── Design Tokens (Mapped to Theme Variables) ─────────────────────────────────
const C = {
  pageBg:     "var(--pageBg)",
  cardDark:   "var(--cardDark)",
  cardPurple: "var(--cardPurple)",
  cardWhite:  "var(--cardWhite)",
  cardMid:    "var(--cardMid)",
  textDark1:  "var(--textDark1)",
  textDark2:  "var(--textDark2)",
  textDark3:  "var(--textDark3)",
  textLight1: "var(--textLight1)",
  textLight2: "var(--textLight2)",
  textLight3: "var(--textLight3)",
  textLight4: "var(--textLight4)",
  purple:     "var(--purple)",
  purpleDark: "var(--purpleDark)",
  lime:       "var(--lime)",
  limeDim:    "var(--limeDim)",
  green:      "var(--green)",
  red:        "var(--red)",
  orange:     "var(--orange)",
  yellow:     "var(--yellow)",
  ink:        "var(--ink)",
  sepDark:    "var(--sepDark)",
};

const F = '"Impact", "Arial Black", sans-serif';
const FB = '"Courier New", Courier, monospace';
const FM = '"Courier New", Courier, monospace';

const HS = (size=4, col=C.ink) => `${size}px ${size}px 0px ${col}`;

// ── Base Components ─────────────────────────────────────────────────────────
const DarkCard = ({ children, style, onClick, color }) => (
  <div onClick={onClick} style={{
    background: color || C.cardDark, color:C.textDark1, border:`3px solid ${C.ink}`,
    padding:16, marginBottom:16, boxShadow:HS(4), position:"relative",
    cursor: onClick ? "pointer" : undefined, ...style
  }}>{children}</div>
);

const WhiteCard = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{
    background:C.cardWhite, color:C.textLight1, border:`3px solid ${C.ink}`,
    padding:16, marginBottom:16, boxShadow:HS(4),
    cursor: onClick ? "pointer" : undefined, ...style
  }}>{children}</div>
);

const Label = ({ children, dark, color, style }) => (
  <div style={{
    fontSize:11, fontWeight:900, fontFamily:FB, letterSpacing:"1px",
    textTransform:"uppercase", color: color || (dark ? C.textDark3 : C.textLight3),
    marginBottom:4, ...style
  }}>{children}</div>
);

const BigNum = ({ children, color, size }) => (
  <div style={{
    fontSize: size || 44, fontFamily:F, fontWeight:900, lineHeight:"1",
    color: color || C.textDark1, letterSpacing:"-1px", textTransform:"uppercase"
  }}>{children}</div>
);

const MedNum = ({ children, color, style }) => (
  <div style={{
    fontSize: 26, fontFamily:F, fontWeight:900, lineHeight:"1",
    color: color || C.textDark1, textTransform:"uppercase", ...style
  }}>{children}</div>
);

const ProgressRing = ({ value, dayNum, total, size=120, stroke=10, color, bg, dark }) => {
  const pct = Math.min(100, Math.max(0, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct/100);
  const ringColor = color || C.lime;
  const trackColor = bg || (dark ? "var(--trackBg)" : C.cardMid);
  const textColor = dark ? C.textDark1 : C.textLight1;
  const subColor = dark ? C.textDark3 : C.textLight3;
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={radius} fill="none"
          stroke={ringColor} strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="square"
          style={{ transition:"stroke-dashoffset 0.4s steps(10)" }}
        />
      </svg>
      <div style={{
        position:"absolute", inset:0, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", textAlign:"center",
      }}>
        <div style={{ fontSize:9, fontWeight:800, color:subColor, letterSpacing:"1.5px", textTransform:"uppercase", fontFamily:FB, marginBottom:2 }}>Day</div>
        <div style={{ fontSize:22, fontWeight:900, color:textColor, fontFamily:FM, letterSpacing:"-0.5px", lineHeight:1 }}>{dayNum}<span style={{ fontSize:12, fontWeight:700, color:subColor }}>/{total}</span></div>
        <div style={{ fontSize:11, fontWeight:800, color:ringColor, marginTop:4, fontFamily:FM }}>{pct}%</div>
      </div>
    </div>
  );
};

const Progress = ({ value=0, max=100, color=C.lime, height=12, bg, style }) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{
      width:"100%", height, background:bg||C.pageBg, border:`2px solid ${C.ink}`,
      position:"relative", overflow:"hidden", ...style
    }}>
      <div style={{ width:`${pct}%`, height:"100%", background:color||C.purple, transition:"width 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }} />
    </div>
  );
};

const PurpleBtn = ({ children, onClick, disabled, style }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width:"100%", background: disabled ? C.cardMid : C.lime,
    color: disabled ? C.textLight3 : "var(--btnTextOverride)",
    border:`3px solid ${C.ink}`, padding:"14px 0",
    fontSize:14, fontWeight:900, cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : HS(3), fontFamily:F,
    textTransform:"uppercase", ...style,
  }}>{children}</button>
);

const DangerBtn = ({ children, onClick, style }) => (
  <button onClick={onClick} style={{
    width:"100%", background: C.red, color:"#FFFFFF",
    border:`3px solid ${C.ink}`, padding:"14px 0",
    fontSize:14, fontWeight:900, cursor:"pointer",
    boxShadow: HS(3), fontFamily:F,
    textTransform:"uppercase", ...style,
  }}>{children}</button>
);

const GhostBtn = ({ children, onClick, color, style }) => (
  <button onClick={onClick} style={{
    background:C.cardWhite, color: color||C.ink,
    border:`3px solid ${C.ink}`, padding:"12px 16px",
    fontSize:13, fontWeight:900, cursor:"pointer",
    fontFamily:F, textTransform:"uppercase", boxShadow: HS(2), ...style,
  }}>{children}</button>
);

const TxtBtn = ({ children, onClick, color, style }) => (
  <button onClick={onClick} style={{
    background:"none", border:"none", color: color||C.purple, cursor:"pointer",
    fontSize:13, fontWeight:800, padding:"4px 0", fontFamily:FB, textTransform:"uppercase",
    textDecoration:"underline", textDecorationThickness:"2px", ...style,
  }}>{children}</button>
);

const Input = ({ value, onChange, placeholder, type="text", style, dark }) => (
  <input
    type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{
      background: dark ? C.cardDark : C.pageBg,
      border:`2px solid ${dark ? "var(--ink)" : C.ink}`,
      color: dark ? C.textDark1 : C.textLight1,
      padding:"10px 12px", fontSize:14, width:"100%", outline:"none", boxSizing:"border-box",
      fontFamily:FB, fontWeight:700, ...style,
    }}
  />
);

const Textarea = ({ value, onChange, placeholder, rows=3, dark }) => (
  <textarea value={value} onChange={e => onChange(e.target.value)}
    placeholder={placeholder} rows={rows}
    style={{
      background: dark ? C.cardDark : C.pageBg,
      border:`2px solid ${dark ? "var(--ink)" : C.ink}`,
      color: dark ? C.textDark1 : C.textLight1,
      padding:"10px 12px", fontSize:14, width:"100%", outline:"none", boxSizing:"border-box",
      resize:"vertical", fontFamily:FB, fontWeight:700,
    }} />
);

const Pill = ({ children, color, bg }) => {
  const fill = bg || color || C.purple;
  return (
    <span style={{
      background: fill, color: "var(--pillTextOverride)",
      border:`2px solid ${C.ink}`, padding:"4px 10px",
      fontSize:11, fontWeight:800, fontFamily:FB, textTransform:"uppercase",
    }}>{children}</span>
  );
};

const Sep = ({ inset=0 }) => (
  <div style={{ height:2, background:C.ink, marginLeft:inset }} />
);

function Sheet({ title, onClose, children, dark }) {
  const bg = dark ? C.cardDark : C.pageBg;
  const tx = dark ? C.textDark1 : C.textLight1;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ position:"absolute", inset:0, background:"rgba(10,10,10,0.65)" }} onClick={onClose} />
      <div style={{
        position:"relative", background:bg, borderTop:`4px solid ${C.ink}`,
        padding:"0 0 calc(48px + env(safe-area-inset-bottom))", width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto",
        boxShadow:"0px -4px 20px rgba(0,0,0,0.15)",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 20px" }}>
          <div style={{ fontSize:18, fontWeight:900, color:tx, fontFamily:F, textTransform:"uppercase" }}>{title}</div>
          <button onClick={onClose} style={{
            background:C.cardDark, color:"var(--textDark1)", border:`2px solid ${C.ink}`,
            width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center",
            fontWeight:900, cursor:"pointer"
          }}>×</button>
        </div>
        <div style={{ padding:"0 20px" }}>{children}</div>
      </div>
    </div>
  );
}

function Toast({ msg }) {
  return (
    <div style={{
      position:"fixed", bottom:"calc(84px + env(safe-area-inset-bottom))", left:16, right:16, maxWidth:430, margin:"0 auto",
      background:C.cardDark, color:"var(--textDark1)", border:`3px solid ${C.ink}`,
      padding:"12px 16px", zIndex:1000, fontFamily:FB, fontSize:12, fontWeight:800,
      textTransform:"uppercase", boxShadow:HS(3), display:"flex", justifyContent:"center"
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
        textTransform:"uppercase", textDecoration:"underline", textDecorationThickness:"2px",
      }}>← Back</button>
      <div style={{ marginTop:12, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize:26, fontWeight:900, color:C.textLight1, fontFamily:F, textTransform:"uppercase" }}>{title}</div>
          {sub && <div style={{ fontSize:11, fontWeight:800, color:C.textLight3, marginTop:4, fontFamily:FB, textTransform:"uppercase" }}>{sub}</div>}
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
          outline:"none", fontFamily:FM, padding:"2px 0",
        }} />
      {unit && <span style={{ fontSize:12, fontWeight:700, color: dark ? C.textDark3 : C.textLight3, fontFamily:FB }}>{unit}</span>}
    </div>
  );
  return (
    <div onClick={() => setEditing(true)} style={{ cursor:"pointer", display:"flex", alignItems:"baseline", gap:5 }}>
      <span style={{ fontSize:24, fontWeight:800, color: value!=null ? (color||C.textDark1) : (dark?C.textDark3:C.textLight4), fontFamily:FM }}>
        {value!=null ? value : "—"}
      </span>
      {value!=null && unit && <span style={{ fontSize:12, fontWeight:700, color: dark ? C.textDark3 : C.textLight3, fontFamily:FB }}>{unit}</span>}
      {value==null && <span style={{ fontSize:10, fontWeight:900, color:C.lime, marginLeft:2, fontFamily:F, background:"#0A0A0A", padding:"2px 6px", border:`2px solid var(--ink)` }}>TAP</span>}
    </div>
  );
}

function getCurrentStreak(habit) {
  let streak = 0;
  const d = new Date(); d.setHours(0,0,0,0);
  for (let i = 0; i < 365; i++) {
    const k = dateKey(d);
    if (habit.completions?.[k] === "done") { streak++; d.setDate(d.getDate()-1); }
    else break;
  }
  return streak;
}

// ── Main Layout Stylesheet Injection ──────────────────────────────────────────
const themeStyles = `
  :root {
    --pageBg: #F5F1E8;
    --cardDark: #0A0A0A;
    --cardPurple: #3D5AFF;
    --cardWhite: #FFFFFF;
    --cardMid: #ECE7DA;
    --textDark1: #FFFFFF;
    --textDark2: #C8C8C8;
    --textDark3: #8A8A8A;
    --textLight1: #0A0A0A;
    --textLight2: #4A4A4A;
    --textLight3: #706E64;
    --textLight4: #B8B2A4;
    --purple: #6366F1;
    --purpleDark: #2840CC;
    --lime: #A3E635;
    --limeDim: #A8D600;
    --green: #22C55E;
    --red: #EF4444;
    --orange: #FF8A00;
    --yellow: #FACC15;
    --ink: #0A0A0A;
    --sepDark: rgba(255,255,255,0.16);
    --trackBg: #1A1A1A;
    --btnTextOverride: #0A0A0A;
    --pillTextOverride: #0A0A0A;
  }
  [data-theme='dark'] {
    --pageBg: #121212;
    --cardDark: #1C1C1E;
    --cardPurple: #2D46CD;
    --cardWhite: #1A1A1A;
    --cardMid: #2A2A2D;
    --textDark1: #FFFFFF;
    --textDark2: #D1D1D6;
    --textDark3: #8E8E93;
    --textLight1: #FFFFFF;
    --textLight2: #E5E5EA;
    --textLight3: #AEAEB2;
    --textLight4: #48484A;
    --purple: #818CF8;
    --purpleDark: #4338CA;
    --lime: #A3E635;
    --limeDim: #BEF264;
    --green: #34C759;
    --red: #FF453A;
    --orange: #FF9500;
    --yellow: #FFD60A;
    --ink: #FFFFFF;
    --sepDark: rgba(255,255,255,0.24);
    --trackBg: #0A0A0A;
    --btnTextOverride: #0A0A0A;
    --pillTextOverride: #FFFFFF;
  }
`;

function getBestStreak(habit) {
  const comp = habit.completions || {};
  const doneDates = Object.keys(comp)
    .filter(k => comp[k] === "done" && /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort();
  if (!doneDates.length) return 0;
  let best = 1, run = 1;
  for (let i = 1; i < doneDates.length; i++) {
    const prev = new Date(doneDates[i-1]);
    const cur = new Date(doneDates[i]);
    const diffDays = Math.round((cur - prev) / 86400000);
    if (diffDays === 1) { run++; } else { run = 1; }
    if (run > best) best = run;
  }
  const current = getCurrentStreak(habit);
  return Math.max(best, current);
}

function getLatestWeight(data) {
  const weights = data.weights || {};
  const keys = Object.keys(weights).filter(k => k.startsWith("week-")).sort();
  if (!keys.length) return null;
  return weights[keys[keys.length-1]];
}

function getWeightProgressPct(weightStart, weightTarget, current) {
  if (weightStart == null || weightTarget == null || current == null) return null;
  const totalDelta = weightTarget - weightStart;
  if (totalDelta === 0) return 100;
  const progressDelta = current - weightStart;
  const pct = (progressDelta / totalDelta) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function getWeeklyWeightChange(data) {
  const weights = data.weights || {};
  const keys = Object.keys(weights).filter(k => k.startsWith("week-")).sort();
  if (keys.length < 2) return null;
  const latest = weights[keys[keys.length-1]];
  const prev = weights[keys[keys.length-2]];
  if (latest == null || prev == null) return null;
  return Math.round((latest - prev) * 10) / 10;
}

function getWeightHistory(data, limit = 8) {
  const weights = data.weights || {};
  const keys = Object.keys(weights).filter(k => k.startsWith("week-")).sort();
  const recent = keys.slice(-limit);
  return recent.map(k => ({
    week: k.replace("week-",""),
    label: k.replace("week-","").slice(5),
    weight: weights[k],
  }));
}

function getDashboardScore(data) {
  const today = todayKey();
  const wk = weekKey();
  let habitsPts = 0;
  if (data.habits.length > 0) {
    const doneCount = data.habits.filter(h => h.completions?.[today] === "done").length;
    habitsPts = Math.round((doneCount / data.habits.length) * 40);
  }
  const workoutPts = data.sessions.some(s => s.date === today) ? 30 : 0;
  const todaySc = data.screenTime?.[today];
  const scGoal = data.screenTimeGoal || 3;
  const screenPts = (todaySc != null && todaySc <= scGoal) ? 20 : 0;
  const weightPts = data.weights?.[wk] != null ? 10 : 0;
  const total = habitsPts + workoutPts + screenPts + weightPts;
  return {
    total: Math.max(0, Math.min(100, total)),
    breakdown: { habitsPts, workoutPts, screenPts, weightPts },
  };
}

function WeightChart({ data }) {
  const history = getWeightHistory(data);
  const current = getLatestWeight(data);
  const target = data.weightTarget;
  const start = data.weightStart;
  const weeklyChange = getWeeklyWeightChange(data);
  const pct = getWeightProgressPct(start, target, current);
  const goalIsLoss = (target != null && start != null) ? target < start : null;
  if (!history.length) {
    return (
      <WhiteCard style={{ marginBottom:14 }}>
        <Label style={{ marginBottom:8 }}>Weight Trend</Label>
        <div style={{ fontSize:13, fontWeight:700, color:C.textLight3, fontFamily:FB, padding:"8px 0" }}>
          Log your weight on the dashboard to start tracking your trend.
        </div>
      </WhiteCard>
    );
  }

  return (
    <WhiteCard style={{ marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
        <Label>Weight Trend</Label>
        {weeklyChange != null && (
          <Pill color={weeklyChange===0 ? C.purple : (goalIsLoss ? (weeklyChange<0?C.green:C.red) : (weeklyChange>0?C.green:C.red))}>
            {weeklyChange>0?"+":""}{weeklyChange}kg/wk
          </Pill>
        )}
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={history}>
          <XAxis dataKey="label" tick={{ fill:C.textLight3, fontSize:10, fontFamily:FB, fontWeight:700 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={v=>`${v}kg`} contentStyle={{ background:"#0A0A0A", border:`2px solid ${C.ink}`, fontSize:11, borderRadius:0, color:"#fff", fontFamily:FM, fontWeight:700 }} />
          <Line type="monotone" dataKey="weight" stroke={C.purple} strokeWidth={3} dot={{ r:3, fill:C.purple, strokeWidth:2, stroke:C.ink }} />
        </LineChart>
      </ResponsiveContainer>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:14 }}>
        <DarkCard style={{ padding:"10px 8px", textAlign:"center", marginBottom:0 }}>
          <div style={{ fontSize:9, fontWeight:800, color:C.textDark3, marginBottom:4, textTransform:"uppercase", fontFamily:FB }}>Current</div>
          <div style={{ fontSize:18, fontWeight:900, color:C.textDark1, fontFamily:FM }}>{current!=null?`${current}kg`:"—"}</div>
        </DarkCard>
        <DarkCard style={{ padding:"10px 8px", textAlign:"center", marginBottom:0 }}>
          <div style={{ fontSize:9, fontWeight:800, color:C.textDark3, marginBottom:4, textTransform:"uppercase", fontFamily:FB }}>Target</div>
          <div style={{ fontSize:18, fontWeight:900, color:C.textDark1, fontFamily:FM }}>{target!=null?`${target}kg`:"—"}</div>
        </DarkCard>
      </div>

      {pct != null && (
        <div style={{ marginTop:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:10, fontWeight:800, color:C.textLight3, textTransform:"uppercase", fontFamily:FB }}>
              {goalIsLoss ? "Progress to loss goal" : "Progress to gain goal"}
            </span>
            <span style={{ fontSize:10, fontWeight:800, color:C.textLight1, fontFamily:FM }}>{pct}%</span>
          </div>
          <Progress value={pct} max={100} color={pct>=100?C.green:C.purple} height={6} bg={C.cardMid} />
        </div>
      )}
    </WhiteCard>
  );
}

function CalendarHeatmap({ habits }) {
  const [tooltip, setTooltip] = useState(null);
  const cells = buildHeatmapCells(habits, 90);
  const firstDow = cells[0].dayOfWeek;
  const padded = [...Array(firstDow).fill(null), ...cells];
  const cols = [];
  for (let i = 0; i < padded.length; i += 7) cols.push(padded.slice(i, i + 7));
  const monthLabels = [];
  let lastMonth = "";
  cells.forEach((cell, i) => {
    const colIdx = Math.floor((i + firstDow) / 7);
    if (cell.month !== lastMonth) {
      monthLabels.push({ label: cell.month, colIdx });
      lastMonth = cell.month;
    }
  });
  const cellColor = (cell) => {
    if (!cell) return "transparent";
    if (cell.isToday) return C.lime;
    if (cell.total === 0) return C.cardMid;
    if (cell.done === 0 && cell.missed === 0) return C.cardWhite;
    if (cell.done === 0) return C.red;
    if (cell.pct === 100) return C.green;
    if (cell.pct >= 50) return "#00884A";
    return "#A8D600";
  };
  const DOW = ["S","M","T","W","T","F","S"];

  return (
    <div>
      {tooltip && (
        <div style={{
          position:"fixed", top:0, left:0, right:0, zIndex:300,
          display:"flex", justifyContent:"center", pointerEvents:"none",
          paddingTop:72,
        }}>
          <div style={{
            background:"#0A0A0A", color:"#fff", border:`2px solid ${C.lime}`,
            padding:"8px 14px", fontSize:12, fontWeight:800,
            fontFamily:FM, boxShadow:HS(4),
          }}>
            {tooltip.date.toLocaleDateString("en-US",{ weekday:"short", month:"short", day:"numeric" })}
            {"  "}
            {tooltip.total > 0
              ? (tooltip.done === 0 && tooltip.missed === 0 ? "No data" : `${tooltip.done}/${tooltip.total} habits`)
              : "No habits set"}
          </div>
        </div>
      )}

      <div style={{ display:"flex", marginBottom:4, paddingLeft:20 }}>
        {cols.map((_, ci) => {
          const lbl = monthLabels.find(m => m.colIdx === ci);
          return (
            <div key={ci} style={{ flex:1, minWidth:0, fontSize:8, fontWeight:800, color:C.textLight3, fontFamily:FB, textAlign:"left" }}>
              {lbl ? lbl.label.toUpperCase() : ""}
            </div>
          );
        })}
      </div>

      <div style={{ display:"flex", gap:2 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:2, marginRight:4 }}>
          {DOW.map((d,i) => (
            <div key={i} style={{ height:13, fontSize:8, fontWeight:800, color:C.textLight4, fontFamily:FB, lineHeight:"13px" }}>
              {i % 2 === 1 ? d : ""}
            </div>
          ))}
        </div>

        {cols.map((col, ci) => (
          <div key={ci} style={{ display:"flex", flexDirection:"column", gap:2, flex:1, minWidth:0 }}>
            {col.map((cell, ri) => (
              <div
                key={ri}
                onClick={() => cell ? setTooltip(tooltip?.key === cell.key ? null : cell) : null}
                style={{
                  height:13, background: cellColor(cell),
                  border: cell ? cell.isToday ? `2px solid ${C.ink}` : `1px solid ${cell.done===0&&cell.missed===0&&cell.total>0?"#ddd":C.ink}` : "none",
                  cursor: cell ? "pointer" : "default",
                  opacity: cell ? 1 : 0, transition:"opacity 0.1s",
                  outline: tooltip?.key === cell?.key ? `2px solid ${C.purple}` : "none", outlineOffset:1,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:10, marginTop:10, flexWrap:"wrap" }}>
        {[
          { c:C.green,    l:"100%" },
          { c:"#00884A",  l:"50–99%" },
          { c:"#A8D600",  l:"1–49%" },
          { c:C.red,      l:"Missed" },
          { c:C.cardWhite, l:"None" },
        ].map(item => (
          <div key={item.l} style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:10, height:10, background:item.c, border:`1.5px solid ${C.ink}`, flexShrink:0 }} />
            <span style={{ fontSize:9, fontWeight:800, color:C.textLight3, fontFamily:FB }}>{item.l}</span>
          </div>
        ))}
      </div>
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
                background: scGoal===h ? C.lime : C.cardDark,
                color: scGoal===h ? "var(--btnTextOverride)" : C.textDark2,
                border:`3px solid ${scGoal===h ? C.ink : "#fff"}`,
                cursor:"pointer", fontSize:18, fontWeight:900, fontFamily:F,
                boxShadow: scGoal===h ? HS(3) : "none",
              }}>{h}<span style={{ fontSize:11, fontWeight:700 }}>h</span></button>
            ))}
          </div>
          <div style={{ fontSize:12, fontWeight:700, color:C.textDark3, textAlign:"center", fontFamily:FB, textTransform:"uppercase" }}>hours per day</div>
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
                background: habit1===h ? C.lime : C.cardDark,
                color: habit1===h ? "var(--btnTextOverride)" : C.textDark2,
                border:`2px solid ${habit1===h ? C.ink : "#fff"}`,
                cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:FB,
                textTransform:"uppercase",
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
        mealTemplates:[], mealLogs:{},
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
      minHeight:"100vh", background:C.cardDark, display:"flex", flexDirection:"column", justifyContent:"center",
      padding:"0 24px 48px", maxWidth:460, margin:"0 auto", fontFamily:FB,
    }}>
      <div style={{ display:"flex", gap:6, marginBottom:52, justifyContent:"center" }}>
        {steps.map((_, i) => (
          <div key={i} style={{
            width: i===step ? 28 : 8, height:8,
            background: i<=step ? C.lime : "#333",
            border:`2px solid ${i<=step ? C.ink : "#333"}`, transition:"all 0.3s",
          }} />
        ))}
      </div>
      <div style={{ fontSize:52, marginBottom:24, textAlign:"center" }}>{cur.emoji}</div>
      <div style={{ textAlign:"center", marginBottom:36 }}>
        <div style={{ fontSize:34, fontWeight:900, color:C.textDark1, marginBottom:10, fontFamily:F, textTransform:"uppercase" }}>{cur.title}</div>
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
  
  // Theme Toggle Engine configuration
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("app-theme") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("app-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(t => t === "light" ? "dark" : "light");
  };

  useEffect(() => {
    (async () => {
      let d = await load("tracker-v2");
      if (d) { d = migrateData(d); setData(d); }
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

  const handleExport = () => {
    if (!data) return;
    const backup = { _schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tracker-backup-v${SCHEMA_VERSION}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup downloaded ✓");
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const result = validateImport(parsed);
        if (!result.ok) { showToast(`Import failed: ${result.error}`); return; }
        const migrated = runMigrations(result.data, result.fromVersion);
        await save("tracker-v2", migrated);
        setData(migrated);
        showToast("Data restored ✓");
      } catch {
        showToast("Invalid backup file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (!loaded) return null;
  if (!data || !data.onboarded) return <Onboarding onDone={initData => setData(initData)} />;

  const TABS = [
    { id:"dashboard", label:"Home",     sym:"⌂" },
    { id:"habits",    label:"Habits",   sym:"◉" },
    { id:"meals",     label:"Meals",    sym:"🍽" },
    { id:"fitness",   label:"Train",    sym:"↑" },
  ];

  return (
    <div style={{ background:C.pageBg, minHeight:"100vh", color:C.ink, paddingBottom:"calc(80px + env(safe-area-inset-bottom))", paddingLeft:16, paddingRight:16, boxSizing:"border-box" }}>
      <style>{themeStyles}</style>
      <div style={{ maxWidth:460, margin:"0 auto" }}>
        
        {/* Dynamic Neubrutalist Theme Toggle Row */}
        <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 14, paddingBottom: 2 }}>
          <button onClick={toggleTheme} style={{
            background: C.cardWhite, color: C.ink, border: `2px solid ${C.ink}`,
            padding: "5px 10px", fontSize: 11, fontWeight: 900, fontFamily: FB,
            cursor: "pointer", boxShadow: HS(2), textTransform: "uppercase"
          }}>
            {theme === "light" ? "🌙 Dark" : "☀️ Light"}
          </button>
        </div>

        {toast && <Toast msg={toast} />}

        {tab==="dashboard" && <Dashboard data={data} persist={persist} showToast={showToast} onReview={() => setTab("review")} onQuickStart={() => setQuickStart(true)} setTab={setTab} />}
        {tab==="habits"    && <Habits    data={data} persist={persist} showToast={showToast} />}
        {tab==="meals"     && <Meals     data={data} persist={persist} showToast={showToast} />}
        {tab==="fitness"   && <Fitness   data={data} persist={persist} showToast={showToast} />}

        {quickStart && (
          <Sheet title="Start Workout" onClose={() => setQuickStart(false)} dark>
            {data.routines.length===0
              ? <div style={{ textAlign:"center", padding:"40px 0", fontSize:14, fontWeight:700, color:C.textDark2, fontFamily:FB, textTransform:"uppercase" }}>No routines yet. Go to Train to create one.</div>
              : data.routines.map(r => {
                  const last = [...data.sessions].filter(s => s.routineId===r.id).sort((a,b) => b.date.localeCompare(a.date))[0];
                  return (
                    <DarkCard key={r.id} style={{ marginBottom:16 }}>
                      <div style={{ fontSize:18, fontWeight:900, color:C.textDark1, fontFamily:F, textTransform:"uppercase" }}>{r.name}</div>
                      <div style={{ fontSize:12, fontWeight:700, color:C.textDark3, marginBottom:14, fontFamily:FB }}>{r.exercises.map(e=>e.name).join(" · ").slice(0,50)}</div>
                      {last && <div style={{ fontSize:10, fontWeight:800, color:C.lime, marginBottom:12, fontFamily:FB }}>LAST: {last.date}</div>}
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
            position:"fixed", bottom:"calc(80px + env(safe-area-inset-bottom))", left:16, right:16, maxWidth:460, margin:"0 auto",
            background:C.lime, padding:"14px 16px", zIndex:90, display:"flex", alignItems:"center", gap:12,
            boxShadow:HS(4), border:`3px solid ${C.ink}`
          }}>
            <div style={{ fontSize:22 }}>📋</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:900, color:C.ink, fontFamily:F, textTransform:"uppercase" }}>Weekly Review</div>
              <div style={{ fontSize:10, fontWeight:800, color:C.textLight2, marginTop:2, fontFamily:FB }}>SUNDAY CHECK-IN</div>
            </div>
            <TxtBtn onClick={() => { setTab("review"); setSundayBanner(false); save(`dismissed-${getThisSundayKey()}`,true); }} color={C.ink}>Open</TxtBtn>
            <button onClick={() => { setSundayBanner(false); save(`dismissed-${getThisSundayKey()}`,true); }} style={{ background:"none", border:"none", color:C.ink, cursor:"pointer", fontSize:18, fontWeight:900, padding:4 }}>×</button>
          </div>
        )}

        <div style={{
          position:"fixed", bottom:0, left:0, right:0, height:"calc(64px + env(safe-area-inset-bottom))", paddingBottom:"env(safe-area-inset-bottom)", background:"#0A0A0A",
          borderTop:`3px solid var(--ink)`, display:"flex", zIndex:90, paddingLeft:6, paddingRight:6
        }}>
          {TABS.map(t => {
            const active = tab===t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex:1, background:"none", border:"none", display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center", color: active ? C.lime : C.textDark3,
                cursor:"pointer", padding:0
              }}>
                <span style={{ fontSize:18, marginBottom:2 }}>{t.sym}</span>
                <span style={{ fontSize:9, fontWeight:900, fontFamily:FB, textTransform:"uppercase" }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({ data, persist, showToast, onReview, onQuickStart, setTab }) {
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
  const thisWt = data.weights?.[wk] ?? getLatestWeight(data);
  const todaySc = data.screenTime?.[today];
  const scGoal = data.screenTimeGoal||3;
  const workedOut = data.sessions.some(s => s.date===today);
  const didToday = doneH>0 || workedOut || todaySc!=null || data.noZeroCheckins?.[today];
  const score = getDashboardScore(data);
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

  const wtPct = getWeightProgressPct(data.weightStart, data.weightTarget, thisWt);
  const cycleHabit = async (id) => {
    const habits = data.habits.map(h => {
      if (h.id!==id) return h;
      const cur=h.completions?.[today]||null;
      const next=cur===null?"done":cur==="done"?"missed":null;
      const comp={ ...h.completions, [today]:next };
      const updated = { ...h, completions:comp };
      const streak = getCurrentStreak(updated);
      const bestStreak = getBestStreak(updated);
      return { ...updated, streak, bestStreak };
    });
    await persist({ ...data, habits });
  };

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
  const dateStr = now.toLocaleDateString("en-US", { weekday:"long", month:"short", day:"numeric" });
  const mealStats = getMealStatsForDay(data, todayKey());
  const mealStreak = getCurrentMealStreak(data);

  return (
    <div style={{ paddingTop:12 }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:800, color:C.textLight3, textTransform:"uppercase", marginBottom:6, fontFamily:FB }}>{dateStr}</div>
        <div style={{ fontSize:28, fontWeight:900, color:C.textLight1, fontFamily:F, textTransform:"uppercase" }}>{greeting}, {userName}</div>
        {insight && (
          <div style={{ display:"inline-block", marginTop:8, background:C.lime, border:`2px solid ${C.ink}`, padding:"4px 10px", fontSize:12, fontWeight:700, color:"#0A0A0A", fontFamily:FB }}>{insight}</div>
        )}
      </div>

      <DarkCard>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
          <div style={{ flex:1 }}>
            <Label dark style={{ marginBottom:8 }}>184-Day Challenge</Label>
            <BigNum color={C.textDark1}>{dayNum}</BigNum>
            <div style={{ fontSize:12, fontWeight:700, color:C.textDark3, marginTop:6, fontFamily:FB, textTransform:"uppercase" }}>of {TOTAL_DAYS} days</div>
            {nzStreak>0 && (
              <div style={{ marginTop:16 }}>
                <Label dark>Streak</Label>
                <MedNum color={C.lime}>{nzStreak}</MedNum>
                <div style={{ fontSize:11, fontWeight:700, color:C.textDark3, marginTop:4, fontFamily:FB, textTransform:"uppercase" }}>days 🔥</div>
              </div>
            )}
          </div>
          <ProgressRing value={pct} dayNum={dayNum} total={TOTAL_DAYS} color={C.lime} dark />
        </div>
        <div style={{ marginTop:20 }}>
          <Progress value={pct} max={100} color={C.lime} height={10} bg="var(--trackBg)" />
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
            <span style={{ fontSize:11, color:C.textDark2, fontWeight:800, fontFamily:FM }}>{pct}% COMPLETE</span>
            <span style={{ fontSize:11, color:C.textDark2, fontWeight:800, fontFamily:FM }}>{TOTAL_DAYS-dayNum} LEFT</span>
          </div>
        </div>
      </DarkCard>

      <DarkCard color={C.cardPurple}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <Label dark color="#D8DEFF">Today Score</Label>
            <div style={{ display:"flex", alignItems:"baseline", gap:6, marginTop:8 }}>
              <BigNum color={C.textDark1}>{score.total}</BigNum>
              <span style={{ fontSize:16, fontWeight:800, color:"#D8DEFF", fontFamily:FM }}>/100</span>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, textAlign:"right" }}>
            {[
              { l:"Habits", v:score.breakdown.habitsPts, max:40 },
              { l:"Workout", v:score.breakdown.workoutPts, max:30 },
              { l:"Screen", v:score.breakdown.screenPts, max:20 },
              { l:"Weight", v:score.breakdown.weightPts, max:10 },
            ].map(b => (
              <div key={b.l} style={{ fontSize:11, fontWeight:800, color:"#D8DEFF", fontFamily:FM }}>
                {b.l.toUpperCase()} {b.v}/{b.max}
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop:16 }}>
          <Progress value={score.total} max={100} color={score.total>=80?C.lime:C.cardWhite} height={6} bg="rgba(0,0,0,0.2)" />
        </div>
      </DarkCard>

      <div style={{
        background:C.lime, border:`3px solid ${C.ink}`, padding:"16px 18px", marginBottom:16,
        display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:HS(4), cursor:"pointer",
      }} onClick={onQuickStart}>
        <div>
          <div style={{ fontSize:18, fontWeight:900, color:"#0A0A0A", fontFamily:F, textTransform:"uppercase" }}>Start Workout</div>
          <div style={{ fontSize:12, fontWeight:700, color:"#4A4A4A", marginTop:4, fontFamily:FB }}>
            {data.routines.length>0 ? data.routines[0].name : "Create a routine first"}
          </div>
        </div>
        <div style={{ width:42, height:42, background:"#0A0A0A", border:`2px solid var(--ink)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, color:C.lime }}>▶</div>
      </div>

      <WhiteCard>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:16, fontWeight:900, color:C.textLight1, fontFamily:F, textTransform:"uppercase" }}>Today's Habits</div>
          <Pill color={allDone ? C.green : C.purple}>{doneH} / {totalH}</Pill>
        </div>
        {totalH>0 && <Progress value={totalH ? (doneH/totalH)*100 : 0} max={100} color={allDone?C.green:C.purple} height={8} bg={C.cardMid} />}
        {totalH===0
          ? <div style={{ paddingTop:16, paddingBottom:8, textAlign:"center", fontSize:13, fontWeight:700, color:C.textLight3, fontFamily:FB }}>Add habits in the Habits tab</div>
          : <div style={{ marginTop:12 }}>
              {data.habits.map((h,idx) => {
                const state=h.completions?.[today]||null;
                const done=state==="done"; const missed=state==="missed";
                const curStreak = getCurrentStreak(h);
                const bestStreak = getBestStreak(h);
                return (
                  <div key={h.id}>
                    <button onClick={() => cycleHabit(h.id)} style={{
                      width:"100%", background:"none", border:"none", cursor:"pointer",
                      display:"flex", alignItems:"center", gap:12, padding:"12px 0", textAlign:"left",
                    }}>
                      <div style={{
                        width:26, height:26, border:`2px solid ${C.ink}`, flexShrink:0,
                        background: done?C.green:missed?C.red:C.cardWhite,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:14, fontWeight:900, color: done||missed?"#fff":"transparent",
                        transition:"all 0.08s",
                      }}>
                        {done?"✓":missed?"✕":""}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:700, color: missed?C.textLight4:C.textLight1, textDecoration: missed?"line-through":"none", fontFamily:FB }}>{h.name}</div>
                        {curStreak>0 && <div style={{ fontSize:10, fontWeight:800, color:C.orange, marginTop:4, fontFamily:FB }}>🔥 {curStreak}D STREAK</div>}
                        {bestStreak>0 && <div style={{ fontSize:9, fontWeight:700, color:C.textLight4, marginTop:2, fontFamily:FB }}>BEST {bestStreak}D</div>}
                      </div>
                      {done && <Pill color={C.green}>✓</Pill>}
                    </button>
                    {idx<data.habits.length-1 && <Sep inset={38} />}
                  </div>
                );
              })}
            </div>
        }
      </WhiteCard>

      <DarkCard onClick={() => setTab("meals")}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🍽</span>
            <Label dark style={{ marginBottom:0 }}>Meals Today</Label>
          </div>
          {mealStreak > 0 && <Pill color={C.orange}>🔥 {mealStreak} Day{mealStreak!==1?"s":""}</Pill>}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
          <BigNum color={C.textDark1}>{mealStats.done}</BigNum>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.textDark3, fontFamily: FM }}>/ {mealStats.total} Completed</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.textDark2, fontFamily: FB, textTransform: "uppercase" }}>{mealStats.pct}% Adherence</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.purple, fontFamily: FB, textTransform: "uppercase" }}>Go to meals →</span>
        </div>
        <Progress value={mealStats.pct} max={100} color={mealStats.isSuccess ? C.green : C.purple} height={6} bg="var(--trackBg)" />
      </DarkCard>

      <DarkCard color={C.cardPurple}>
        <div style={{ display:"flex" }}>
          <div style={{ flex:1, paddingRight:16, borderRight:`2px solid ${C.ink}` }}>
            <Label dark color="#D8DEFF">Weight</Label>
            <div style={{ marginTop:8 }}><InlineLog dark value={thisWt} unit="kg" color={C.textDark1} onSave={logWeight} /></div>
            {data.weightTarget && thisWt && <div style={{ fontSize:10, fontWeight:800, color:"#D8DEFF", marginTop:6, fontFamily:FB }}>{wtPct}% TO GOAL</div>}
          </div>
          <div style={{ flex:1, paddingLeft:16, paddingRight:16, borderRight:`2px solid ${C.ink}` }}>
            <Label dark color="#D8DEFF">Screen</Label>
            <div style={{ marginTop:8 }}><InlineLog dark value={todaySc} unit="h" color={todaySc>scGoal?C.red:C.textDark1} onSave={logScreen} /></div>
            <div style={{ fontSize:10, fontWeight:800, color:"#D8DEFF", marginTop:6, fontFamily:FB }}>GOAL {scGoal}H</div>
          </div>
          <div style={{ flex:1, paddingLeft:16 }}>
            <Label dark color="#D8DEFF">Workout</Label>
            <div style={{ fontSize:26, marginTop:8, fontWeight:900, color: workedOut?C.lime:"#D8DEFF" }}>{workedOut?"✓":"—"}</div>
            <div style={{ fontSize:10, fontWeight:800, color:"#D8DEFF", marginTop:6, fontFamily:FB }}>{workedOut?"DONE":"TODAY"}</div>
          </div>
        </div>
        {data.weightTarget && thisWt && (
          <div style={{ marginTop:16 }}>
            <Progress value={wtPct||0} max={100} color={wtPct>=100?C.lime:C.cardWhite} height={6} bg="rgba(0,0,0,0.2)" />
          </div>
        )}
      </DarkCard>

      {!didToday && (
        <DarkCard>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ fontSize:28 }}>⚡</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:16, fontWeight:900, color:C.textDark1, fontFamily:F, textTransform:"uppercase" }}>Don't zero today</div>
              <div style={{ fontSize:12, fontWeight:700, color:C.textDark3, marginTop:4, fontFamily:FB }}>Do at least one thing</div>
            </div>
            <button onClick={markNZ} style={{
              background:C.lime, color:"#0A0A0A", border:`3px solid ${C.ink}`,
              padding:"10px 16px", fontSize:12, fontWeight:900, cursor:"pointer", fontFamily:F, boxShadow:HS(3),
            }}>DONE</button>
          </div>
        </DarkCard>
      )}

      <button onClick={() => setShowMore(s=>!s)} style={{
        width:"100%", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
        padding:"12px 0", marginBottom: showMore ? 16 : 0, color:C.textLight3, fontSize:11, fontWeight:800, fontFamily:FB, textTransform:"uppercase"
      }}>
        {showMore ? "▲ less" : "▼ more"}
      </button>

      {showMore && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
          {[
            { icon:"📋", label:"Weekly\nReview", action:onReview },
            { icon:"⚙", label:"Settings", action:() => { setStartW(data.weightStart?String(data.weightStart):""); setTargetW(data.weightTarget?String(data.weightTarget):""); setScGoalI(String(data.screenTimeGoal||3)); setSetupSheet(true); } },
            { icon:"💾", label:"Export", action:() => { try { const b=new Blob([JSON.stringify(data,null,2)],{ type:"application/json" }); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download=`tracker-${todayKey()}.json`; a.click(); URL.revokeObjectURL(u); showToast("Exported ✓"); } catch { showToast("Failed"); } } },
          ].map(a => (
            <WhiteCard key={a.label} onClick={a.action} style={{ padding:"16px 8px", marginBottom:0 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:24 }}>{a.icon}</span>
                <div style={{ fontSize:10, fontWeight:800, color:C.textLight1, textAlign:"center", lineHeight:1.6, whiteSpace:"pre-line", fontFamily:FB, textTransform:"uppercase" }}>{a.label}</div>
              </div>
            </WhiteCard>
          ))}
        </div>
      )}

      {setupSheet && (
        <Sheet title="Settings" onClose={() => setSetupSheet(false)} dark>
          <Label dark>Starting weight (kg)</Label>
          <Input dark value={startW} onChange={setStartW} placeholder="85" type="number" style={{ marginTop:8, marginBottom:20 }} />
          <Label dark>Target weight (kg)</Label>
          <Input dark value={targetW} onChange={setTargetW} placeholder="75" type="number" style={{ marginTop:8, marginBottom:20 }} />
          <Label dark>Screen time goal (hrs/day)</Label>
          <Input dark value={scGoalI} onChange={setScGoalI} placeholder="3" type="number" style={{ marginTop:8, marginBottom:28 }} />
          <PurpleBtn onClick={saveSetup}>Save</PurpleBtn>
        </Sheet>
      )}
    </div>
  );
}

// ── Meals ───────────────────────────────────────────────────────────────────
function Meals({ data, persist, showToast }) {
  const [templateSheet, setTemplateSheet] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [tName, setTName] = useState("");
  const [tItems, setTItems] = useState([""]);

  const todayK = todayKey();
  const mealStats = getMealStatsForDay(data, todayK);
  const currentStreak = getCurrentMealStreak(data);
  const bestStreak = getBestStreak(data);
  const templates = data.mealTemplates || [];

  const openAdd = () => {
    setTName(""); setTItems([""]); setEditTemplate(null); setTemplateSheet(true);
  };
  const openEdit = (template) => {
    setTName(template.name); setTItems([...template.items]); setEditTemplate(template); setTemplateSheet(true);
  };

  const saveTemplate = async () => {
    const validItems = tItems.map(i => i.trim()).filter(i => i.length > 0);
    if (!tName.trim() || validItems.length === 0) return;
    if (editTemplate) {
      const updated = templates.map(t => t.id === editTemplate.id ? { ...t, name: tName.trim(), items: validItems } : t);
      await persist({ ...data, mealTemplates: updated });
      showToast("Template updated ✓");
    } else {
      const newTemplate = { id: Date.now(), name: tName.trim(), items: validItems };
      await persist({ ...data, mealTemplates: [...templates, newTemplate] });
      showToast("Template created ✓");
    }
    setTemplateSheet(false);
  };

  const delTemplate = async (id) => {
    if (!window.confirm("Delete this meal template?")) return;
    const updated = templates.filter(t => t.id !== id);
    await persist({ ...data, mealTemplates: updated });
    showToast("Template deleted");
  };

  const toggleItem = async (templateId, itemIndex) => {
    const todayLogs = (data.mealLogs || {})[todayK] || {};
    const tLog = todayLogs[templateId] || {};
    const isDone = !!tLog[itemIndex];
    const newTLog = { ...tLog, [itemIndex]: !isDone };
    const newTodayLogs = { ...todayLogs, [templateId]: newTLog };
    await persist({
      ...data,
      mealLogs: { ...(data.mealLogs || {}), [todayK]: newTodayLogs }
    });
  };

  const copyYesterday = async () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    const yKey = dateKey(d);
    const yLog = (data.mealLogs || {})[yKey];
    if (!yLog || Object.keys(yLog).length === 0) {
      showToast("No meals logged yesterday");
      return;
    }
    await persist({
      ...data,
      mealLogs: { ...(data.mealLogs || {}), [todayK]: JSON.parse(JSON.stringify(yLog)) }
    });
    showToast("Copied yesterday's meals ✓");
  };

  const yestDate = new Date(); yestDate.setDate(yestDate.getDate() - 1);
  const yestHasData = Object.keys((data.mealLogs || {})[dateKey(yestDate)] || {}).length > 0;

  return (
    <div style={{ paddingTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: C.textLight1, fontFamily: F, textTransform: "uppercase" }}>Meals</div>
        <TxtBtn onClick={openAdd}>+ Template</TxtBtn>
      </div>

      {templates.length > 0 && (
        <>
          <DarkCard>
            <Label dark style={{ marginBottom: 8 }}>Today's Progress</Label>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
              <BigNum color={C.textDark1}>{mealStats.done}</BigNum>
              <span style={{ fontSize: 18, fontWeight: 800, color: C.textDark3, fontFamily: FM }}>/ {mealStats.total}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: C.textDark2, fontFamily: FB, textTransform: "uppercase" }}>Adherence</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: mealStats.isSuccess ? C.lime : C.textDark1, fontFamily: FM }}>{mealStats.pct}%</span>
            </div>
            <Progress value={mealStats.pct} max={100} color={mealStats.isSuccess ? C.lime : C.purple} height={8} bg="var(--trackBg)" />
          </DarkCard>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <DarkCard style={{ textAlign: "center", padding:"16px 8px", marginBottom:0 }}>
              <Label dark style={{ marginBottom: 6 }}>Streak</Label>
              <MedNum color={C.orange}>{currentStreak}</MedNum>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textDark3, marginTop: 6, fontFamily: FB, textTransform: "uppercase" }}>Days 🔥</div>
            </DarkCard>
            <DarkCard style={{ textAlign: "center", padding:"16px 8px", marginBottom:0 }}>
              <Label dark style={{ marginBottom: 6 }}>Best Streak</Label>
              <MedNum color={C.textDark1}>{bestStreak}</MedNum>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textDark3, marginTop: 6, fontFamily: FB, textTransform: "uppercase" }}>Days</div>
            </DarkCard>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <GhostBtn onClick={copyYesterday} style={{ opacity: yestHasData ? 1 : 0.4 }}>Copy Yesterday</GhostBtn>
          </div>

          <div style={{ marginTop: 8 }}>
            {templates.map(t => {
              const tLog = ((data.mealLogs || {})[todayK] || {})[t.id] || {};
              const tDone = t.items.filter((_, i) => tLog[i]).length;
              const tTotal = t.items.length;
              return (
                <WhiteCard key={t.id} style={{ padding: "18px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: C.textLight1, fontFamily: F, textTransform: "uppercase" }}>{t.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: C.textLight3, fontFamily: FM }}>{tDone}/{tTotal}</span>
                      <button onClick={() => openEdit(t)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textLight3, fontSize: 12, fontWeight: 800, textDecoration: "underline", fontFamily:FB }}>Edit</button>
                    </div>
                  </div>
                  <div>
                    {t.items.map((item, i) => {
                      const isDone = !!tLog[i];
                      return (
                        <div key={i} style={{ marginBottom: i < t.items.length - 1 ? 10 : 0 }}>
                          <button onClick={() => toggleItem(t.id, i)} style={{
                            display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", width: "100%", textAlign: "left", cursor: "pointer", padding: "6px 0"
                          }}>
                            <div style={{
                              width: 26, height: 26, border: `2px solid ${C.ink}`, flexShrink: 0,
                              background: isDone ? C.green : C.cardWhite, color: isDone ? "#fff" : "transparent",
                              display: "flex", justifyContent: "center", alignItems: "center", fontWeight: 900, fontSize: 14, transition: "all 0.08s"
                            }}>✓</div>
                            <span style={{ fontSize: 15, fontWeight: 700, fontFamily: FB, color: isDone ? C.textLight4 : C.textLight1, textDecoration: isDone ? "line-through" : "none" }}>
                              {item}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </WhiteCard>
              );
            })}
          </div>
        </>
      )}

      {templates.length === 0 && (
        <div style={{ textAlign: "center", padding: "72px 0 32px" }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>🍽</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.textLight3, marginBottom: 12, fontFamily: FB, textTransform: "uppercase" }}>No meal templates yet</div>
          <TxtBtn onClick={openAdd}>+ Create First Meal</TxtBtn>
        </div>
      )}

      {templateSheet && (
        <Sheet title={editTemplate ? "Edit Template" : "New Meal Template"} onClose={() => setTemplateSheet(false)}>
          <Label>Meal Name</Label>
          <Input value={tName} onChange={setTName} placeholder="e.g. Breakfast, Meal 1..." style={{ marginTop: 8, marginBottom: 20 }} />
          <Label>Items</Label>
          <div style={{ marginBottom: 24 }}>
            {tItems.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Input value={item} onChange={(val) => {
                  const newItems = [...tItems]; newItems[i] = val; setTItems(newItems);
                }} placeholder="e.g. Eggs, Oats..." style={{ flex: 1 }} />
                {tItems.length > 1 && (
                  <button onClick={() => {
                    const newItems = tItems.filter((_, idx) => idx !== i); setTItems(newItems);
                  }} style={{ background: C.cardWhite, border: `2px solid ${C.ink}`, color: C.ink, width: 44, height: 44, fontSize: 16, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent:"center" }}>✕</button>
                )}
              </div>
            ))}
            <button onClick={() => setTItems([...tItems, ""])} style={{
              width: "100%", background: "none", border: `2px dashed ${C.textLight3}`, color: C.textLight2,
              padding: "14px", fontSize: 13, fontWeight: 800, fontFamily: FB, textTransform: "uppercase", cursor: "pointer", marginTop: 4
            }}>+ Add Item</button>
          </div>
          <PurpleBtn onClick={saveTemplate} style={{ marginBottom: editTemplate ? 14 : 0 }}>{editTemplate ? "Save Changes" : "Create Template"}</PurpleBtn>
          {editTemplate && (
            <GhostBtn onClick={() => { delTemplate(editTemplate.id); setTemplateSheet(false); }} style={{ width: "100%", color: C.red }}>Delete Template</GhostBtn>
          )}
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
      const updated = { ...h, completions:comp };
      const streak = getCurrentStreak(updated);
      const bestStreak = getBestStreak(updated);
      return { ...updated, streak, bestStreak };
    });
    await persist({ ...data, habits });
  };
  
  const del = async (id) => { 
    if(!window.confirm("Delete this habit forever?")) return;
    await persist({ ...data, habits:data.habits.filter(h=>h.id!==id) }); 
    showToast("Removed"); 
  };

  const doneToday = data.habits.filter(h => h.completions?.[today]==="done").length;
  const habitPct = data.habits.length ? Math.round((doneToday/data.habits.length)*100) : 0;
  const allDone = data.habits.length>0 && doneToday===data.habits.length;

  const chartData = [...days].reverse().map(d => ({
    day: d.day.slice(0,1),
    pct: data.habits.length ? Math.round((data.habits.filter(h=>h.completions?.[d.key]==="done").length/data.habits.length)*100) : 0
  }));

  return (
    <div style={{ paddingTop:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
        <div style={{ fontSize:26, fontWeight:900, color:C.textLight1, fontFamily:F, textTransform:"uppercase" }}>Habits</div>
        <TxtBtn onClick={() => setAddSheet(true)}>+ Add</TxtBtn>
      </div>

      {data.habits.length>0 && (
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
          <Progress value={habitPct} max={100} color={allDone?C.green:C.purple} height={10} bg={C.cardWhite} style={{ flex:1 }} />
          <span style={{ fontSize:14, fontWeight:800, color:C.textLight1, flexShrink:0, fontFamily:FM }}>{doneToday}/{data.habits.length}</span>
        </div>
      )}

      {data.habits.length===0 && (
        <div style={{ textAlign:"center", padding:"72px 0 32px" }}>
          <div style={{ fontSize:44, marginBottom:16 }}>◉</div>
          <div style={{ fontSize:16, fontWeight:800, color:C.textLight3, marginBottom:12, fontFamily:FB, textTransform:"uppercase" }}>No habits yet</div>
          <TxtBtn onClick={() => setAddSheet(true)}>Add your first habit</TxtBtn>
        </div>
      )}

      {data.habits.length>0 && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr repeat(7,38px)", gap:4, marginBottom:8, alignItems:"end" }}>
            <div />
            {days.map(d => (
              <div key={d.key} style={{ textAlign:"center" }}>
                <div style={{ fontSize:9, fontWeight:800, color:C.textLight4, marginBottom:4, fontFamily:FB }}>{d.day.slice(0,2)}</div>
                <div style={{
                  fontSize:12, fontWeight: d.key===today ? 900 : 700, color: d.key===today ? "#0A0A0A" : C.textLight3,
                  background: d.key===today ? C.lime : "transparent", border: d.key===today ? `2px solid var(--ink)` : "none",
                  width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto", fontFamily:FM,
                }}>{d.date}</div>
              </div>
            ))}
          </div>

          <WhiteCard style={{ overflow:"hidden", padding:0 }}>
            {data.habits.map((h,idx) => (
              <div key={h.id}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr repeat(7,38px)", gap:4, alignItems:"center", padding:"12px 14px", minHeight:64 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", color:C.textLight1, fontFamily:FB }}>{h.name}</div>
                      {getCurrentStreak(h)>0 && <div style={{ fontSize:10, fontWeight:800, color:C.orange, marginTop:4, fontFamily:FB }}>🔥 {getCurrentStreak(h)}D</div>}
                      {getBestStreak(h)>0 && <div style={{ fontSize:9, fontWeight:700, color:C.textLight4, marginTop:2, fontFamily:FB }}>BEST {getBestStreak(h)}D</div>}
                    </div>
                    <button onClick={() => del(h.id)} style={{ background:"none", border:"none", color:C.textLight4, cursor:"pointer", fontSize:18, fontWeight:900, padding:6, flexShrink:0 }}>×</button>
                  </div>
                  {days.map(d => {
                    const state=h.completions?.[d.key]||null;
                    const done=state==="done"; const missed=state==="missed";
                    return (
                      <button key={d.key} onClick={() => cycle(h.id, d.key)} style={{
                        width:36, height:36, borderRadius:0, border:`2px solid ${C.ink}`,
                        background: done?C.green:missed?C.red:C.cardWhite,
                        color: done||missed?"#fff":"transparent",
                        fontSize:16, fontWeight:900, cursor:"pointer",
                        display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto", transition:"all 0.06s",
                      }}>{done?"✓":missed?"✕":""}</button>
                    );
                  })}
                </div>
                {idx<data.habits.length-1 && <Sep inset={14} />}
              </div>
            ))}
          </WhiteCard>

          <WhiteCard style={{ padding:"16px" }}>
            <Label style={{ marginBottom:12 }}>7-day completion</Label>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={chartData} barSize={22}>
                <XAxis dataKey="day" tick={{ fill:C.textLight3, fontSize:11, fontFamily:FB, fontWeight:700 }} axisLine={false} tickLine={false} />
                <Bar dataKey="pct" fill={C.purple} stroke={C.ink} strokeWidth={2} />
                <Tooltip formatter={v=>`${v}%`} contentStyle={{ background:"#0A0A0A", border:`2px solid ${C.ink}`, fontSize:11, borderRadius:0, color:"#fff", fontFamily:FM, fontWeight:700 }} />
              </BarChart>
            </ResponsiveContainer>
          </WhiteCard>

          <WhiteCard>
            <Label style={{ marginBottom:16 }}>90-day heatmap</Label>
            <CalendarHeatmap habits={data.habits} />
          </WhiteCard>
        </>
      )}

      {addSheet && (
        <Sheet title="New Habit" onClose={() => setAddSheet(false)}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:20 }}>
            {["Drink 3L water","Read 30 mins","Meditate","No junk food","Walk 30 mins","Cold shower"].map(h => (
              <button key={h} onClick={() => setName(h)} style={{
                padding:"8px 14px", background: name===h ? C.lime : C.cardWhite, color:C.ink,
                border:`2px solid ${C.ink}`, borderRadius:0, cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:FB, textTransform:"uppercase",
              }}>{h}</button>
            ))}
          </div>
          <Input value={name} onChange={setName} placeholder="Or type your own habit..." style={{ marginBottom:20 }} />
          <PurpleBtn onClick={addHabit}>Add Habit</PurpleBtn>
        </Sheet>
      )}
    </div>
  );
}

// ── Fitness (Fully Restored & Operational Template) ───────────────────────────
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
    const delR = async () => { 
      if (!window.confirm("Delete this routine completely?")) return;
      await persist({ ...data, routines:data.routines.filter(r=>r.id!==routine.id) }); 
      showToast("Deleted"); 
      onDone(); 
    };

    return (
      <div style={{ paddingTop:4 }}>
        <NavBar title={routine?"Edit Routine":"New Routine"} onBack={onDone}
          right={routine && <TxtBtn onClick={delR} color={C.red}>Delete</TxtBtn>} />
        <Label>Name</Label>
        <Input value={rName} onChange={setRName} placeholder="e.g. Push Day A" style={{ marginTop:8, marginBottom:24 }} />
        <Label>Exercises</Label>
        <div style={{ marginTop:12 }}>
          {exList.map((e,i) => (
            <WhiteCard key={i} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:800, color:C.textLight3, fontFamily:FB, textTransform:"uppercase" }}>Exercise {i+1}</div>
                {exList.length>1 && <TxtBtn onClick={() => remEx(i)} color={C.red} style={{ fontSize:12 }}>Remove</TxtBtn>}
              </div>
              <Input value={e.name} onChange={v=>updEx(i,"name",v)} placeholder="e.g. Bench Press" style={{ marginBottom:12 }} />
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div><Label>Target Sets</Label><Input value={e.defaultSets} onChange={v=>updEx(i,"defaultSets",v)} placeholder="3" type="number" style={{ marginTop:6 }} /></div>
                <div><Label>Target Reps</Label><Input value={e.defaultReps} onChange={v=>updEx(i,"defaultReps",v)} placeholder="10" type="number" style={{ marginTop:6 }} /></div>
              </div>
            </WhiteCard>
          ))}
        </div>
        <button onClick={addEx} style={{ width:"100%", background:C.pageBg, border:`3px dashed ${C.ink}`, color:C.textLight1, padding:14, cursor:"pointer", fontSize:14, fontWeight:800, marginBottom:24, fontFamily:FB, textTransform:"uppercase" }}>+ Add Exercise</button>
        <PurpleBtn onClick={saveR}>{routine?"Save Changes":"Create Routine"}</PurpleBtn>
      </div>
    );
  };

  const ActiveSession = ({ routine, onDone }) => {
    const lastSame = [...data.sessions].filter(s=>s.routineId===routine.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const [exercises, setExercises] = useState(
      routine.exercises.map((e,i) => {
        const lastSameEx = lastSame?.exercises.find(lx => lx.name === e.name) || lastSame?.exercises[i];
        if (lastSameEx && lastSameEx.sets && Array.isArray(lastSameEx.sets)) {
          return { name: e.name, sets: lastSameEx.sets.map(s => ({ weight: s.weight, reps: s.reps })) };
        }
        const numSets = parseInt(e.defaultSets) || 3;
        return {
          name: e.name,
          sets: Array.from({ length: numSets }, () => ({ weight: "", reps: e.defaultReps || "10" }))
        };
      })
    );
    const [note, setNote] = useState("");
    const [showNote, setShowNote] = useState(false);
    const [activeEx, setActiveEx] = useState(0);
    const [timer, setTimer] = useState(null);
    const [timeLeft, setTL] = useState(0);
    const timerRef = useRef(null);

    const updSet = (exIdx, setIdx, field, val) => {
      setExercises(exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const newSets = ex.sets.map((s, j) => j === setIdx ? { ...s, [field]: val } : s);
        return { ...ex, sets: newSets };
      }));
    };
    const addSet = (exIdx) => {
      setExercises(exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const lastSet = ex.sets[ex.sets.length - 1] || { weight: "", reps: "" };
        return { ...ex, sets: [...ex.sets, { weight: lastSet.weight, reps: lastSet.reps }] };
      }));
    };
    const remSet = (exIdx, setIdx) => {
      setExercises(exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        return { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) };
      }));
    };

    const startTimer = (s) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setTL(s); setTimer(s);
      timerRef.current = setInterval(() => setTL(t => { if (t<=1) { clearInterval(timerRef.current); setTimer(null); return 0; } return t-1; }), 1000);
    };
    useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

    const livePRs = (() => {
      const result = {};
      for (const ex of exercises) {
        let maxW = 0;
        for (const s of ex.sets) {
          const w = parseFloat(s.weight);
          if (w > maxW) maxW = w;
        }
        if (maxW <= 0) continue;
        const prev = getPR(data.prHistory || {}, ex.name);
        result[ex.name] = prev === null ? "first" : maxW > prev ? "new" : maxW === prev ? "tie" : "below";
      }
      return result;
    })();

    const saveSession = async () => {
      const valid = exercises.map(ex => ({
        ...ex,
        sets: ex.sets.filter(s => s.weight !== "" || s.reps !== "")
      })).filter(ex => ex.name && ex.sets.length > 0);
      const { updatedHistory, newPRs: prs } = detectAndStorePRs(valid, data.prHistory || {});
      await persist({
        ...data,
        prHistory: updatedHistory,
        sessions: [...data.sessions, {
          id:Date.now(), date:todayKey(),
          routineId:routine.id, routineName:routine.name,
          exercises:valid, note:note.trim(),
        }],
      });
      if (prs.size > 0) showToast(`New PR${prs.size>1?"s":""} 🎉`);
      else showToast("Session saved ✓");
      onDone();
    };

    const ex = exercises[activeEx];
    const lastEx = lastSame?.exercises.find(lx => lx.name === ex.name);
    const currentPR = getPR(data.prHistory || {}, ex.name);
    const liveStatus = livePRs[ex.name];
    const vol = ex.sets.reduce((sum, s) => sum + (parseFloat(s.weight)||0) * (parseInt(s.reps)||0), 0);
    const maxW = Math.max(0, ...ex.sets.map(s => parseFloat(s.weight)||0));

    return (
      <div style={{ paddingTop:4 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, paddingTop:20, paddingBottom:16 }}>
          <button onClick={onDone} style={{ background:"none", border:"none", color:C.purple, cursor:"pointer", fontSize:14, fontWeight:800, fontFamily:FB, textTransform:"uppercase", textDecoration:"underline", textDecorationThickness:"2px" }}>← Back</button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:20, fontWeight:900, color:C.textLight1, fontFamily:F, textTransform:"uppercase" }}>{routine.name}</div>
            <div style={{ fontSize:12, fontWeight:700, color:C.textLight3, marginTop:4, fontFamily:FM }}>{todayKey()}</div>
          </div>
          <Pill>{activeEx+1}/{exercises.length}</Pill>
        </div>

        <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:10, marginBottom:16 }}>
          {exercises.map((e,i) => {
            const s = livePRs[e.name];
            return (
              <button key={i} onClick={() => setActiveEx(i)} style={{
                flexShrink:0, background: i===activeEx ? C.lime : C.cardWhite,
                border:`2px solid ${C.ink}`, color:C.ink, position:"relative",
                padding:"8px 16px", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:FB,
              }}>
                {e.name.split(" ")[0].toUpperCase()}
                {(s==="new"||s==="first") && <span style={{ position:"absolute", top:-8, right:-8, fontSize:12, lineHeight:1 }}>🎉</span>}
              </button>
            );
          })}
        </div>

        <DarkCard>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom: lastEx ? 14 : 8 }}>
            <div style={{ fontSize:24, fontWeight:900, color:C.textDark1, fontFamily:F, textTransform:"uppercase" }}>{ex.name}</div>
            {liveStatus === "new" && (
              <div style={{ background:C.lime, border:`2px solid ${C.ink}`, padding:"4px 10px", fontSize:11, fontWeight:900, color:"#0A0A0A", fontFamily:F }}>NEW PR 🎉</div>
            )}
            {liveStatus === "first" && (
              <div style={{ background:C.purple, border:`2px solid ${C.ink}`, padding:"4px 10px", fontSize:11, fontWeight:900, color:"#fff", fontFamily:F }}>FIRST LOG</div>
            )}
          </div>

          {currentPR !== null && (
            <div style={{ fontSize:11, fontWeight:800, color:C.textDark3, marginBottom:12, fontFamily:FB }}>
              CURRENT PR: <span style={{ color: liveStatus==="new" ? C.lime : C.textDark2 }}>{currentPR}KG</span>
            </div>
          )}

          {lastEx && (
            <div style={{ background:"#1A1A1A", padding:"12px", marginBottom:20, borderLeft:`3px solid ${C.lime}` }}>
              <div style={{ fontSize:11, fontWeight:800, color:C.lime, marginBottom:8, fontFamily:FB }}>LAST SESSION</div>
              {lastEx.sets && lastEx.sets.map((ls, li) => (
                <div key={li} style={{ fontSize:14, fontWeight:700, color:C.textDark2, fontFamily:FM, marginBottom:4 }}>
                  Set {li+1}: <span style={{ color:C.textDark1 }}>{ls.weight}kg × {ls.reps}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"grid", gridTemplateColumns:"28px 1fr 20px 1fr 36px", gap:10, alignItems:"center", marginBottom:6, padding:"0 4px" }}>
              <div style={{ fontSize:11, fontWeight:800, color:C.textDark3, fontFamily:FB, textAlign:"center" }}>SET</div>
              <div style={{ fontSize:11, fontWeight:800, color:C.textDark3, fontFamily:FB }}>KG</div>
              <div />
              <div style={{ fontSize:11, fontWeight:800, color:C.textDark3, fontFamily:FB }}>REPS</div>
              <div />
            </div>

            {ex.sets.map((s, i) => (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"28px 1fr 20px 1fr 36px", gap:10, alignItems:"center" }}>
                <div style={{ fontSize:16, fontWeight:900, color:C.textDark3, fontFamily:FM, textAlign:"center" }}>{i+1}</div>
                <input type="number" value={s.weight} onChange={e=>updSet(activeEx, i, "weight", e.target.value)} placeholder="0"
                  style={{
                    background:"var(--trackBg)", border:`2px solid ${parseFloat(s.weight) > (currentPR||0) && liveStatus==="new" ? C.lime : "#333"}`,
                    color: parseFloat(s.weight) > (currentPR||0) && liveStatus==="new" ? C.lime : C.textDark1,
                    padding:"12px 10px", fontSize:20, fontWeight:800, width:"100%", outline:"none", boxSizing:"border-box", textAlign:"center", fontFamily:FM,
                  }} />
                <div style={{ color:C.textDark3, fontSize:16, fontWeight:900, textAlign:"center" }}>×</div>
                <input type="number" value={s.reps} onChange={e=>updSet(activeEx, i, "reps", e.target.value)} placeholder="0"
                  style={{
                    background:"var(--trackBg)", border:`2px solid #333`, color: C.textDark1,
                    padding:"12px 10px", fontSize:20, fontWeight:800, width:"100%", outline:"none", boxSizing:"border-box", textAlign:"center", fontFamily:FM,
                  }} />
                <button onClick={() => remSet(activeEx, i)} style={{ background:"none", border:"none", color:C.red, fontSize:24, fontWeight:900, cursor:"pointer", padding:0 }}>×</button>
              </div>
            ))}
            <button onClick={() => addSet(activeEx)} style={{
              background:"transparent", border:`2px dashed #333`, color:C.textDark2,
              padding:"12px 0", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:FB, textTransform:"uppercase", marginTop:6
            }}>+ Add Set</button>
          </div>

          <div style={{ display:"flex", justifyContent:"space-between", marginTop:20, paddingTop:14, borderTop:`2px solid #333` }}>
            <div style={{ fontSize:12, fontWeight:800, color:C.textDark3, fontFamily:FB }}>VOL: <span style={{ color:C.textDark1, fontFamily:FM }}>{vol}KG</span></div>
            <div style={{ fontSize:12, fontWeight:800, color:C.textDark3, fontFamily:FB }}>MAX: <span style={{ color:C.textDark1, fontFamily:FM }}>{maxW}KG</span></div>
          </div>
        </DarkCard>

        <WhiteCard>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: timer?10:0 }}>
            <Label>Rest timer</Label>
            {timer && <div style={{ fontSize:26, fontWeight:900, color: timeLeft<=10?C.red:C.green, fontFamily:FM }}>{timeLeft}s</div>}
          </div>
          {timer && <Progress value={(timeLeft/timer)*100} max={100} color={timeLeft<=10?C.red:C.green} height={8} bg={C.cardMid} style={{ marginBottom:10 }} />}
          <div style={{ display:"flex", gap:10, marginTop: timer?0:6 }}>
            {[60,90,120].map(s => (
              <button key={s} onClick={() => startTimer(s)} style={{
                flex:1, background: timer===s ? C.lime : C.cardWhite, border:`2px solid ${C.ink}`, color:C.ink,
                padding:"10px 0", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:FB,
              }}>{s}s</button>
            ))}
            {timer && <button onClick={() => { clearInterval(timerRef.current); setTimer(null); setTL(0); }} style={{ background:C.red, border:`2px solid ${C.ink}`, color:"#fff", padding:"10px 14px", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:FB }}>✕</button>}
          </div>
        </WhiteCard>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
          <GhostBtn onClick={() => setActiveEx(Math.max(0,activeEx-1))} style={{ opacity: activeEx===0?0.4:1 }}>← Prev</GhostBtn>
          <PurpleBtn onClick={() => setActiveEx(Math.min(exercises.length-1,activeEx+1))} disabled={activeEx===exercises.length-1}>Next →</PurpleBtn>
        </div>

        {showNote
          ? <WhiteCard>
              <Label>Session note</Label>
              <div style={{ marginTop:10 }}><Textarea value={note} onChange={setNote} placeholder="How did it feel?" rows={2} /></div>
            </WhiteCard>
          : <TxtBtn onClick={() => setShowNote(true)} color={C.textLight3} style={{ marginBottom:16, display:"block", fontSize:14 }}>+ Add note</TxtBtn>
        }

        <PurpleBtn onClick={saveSession} style={{ marginBottom:28, background:C.green, color:"#fff" }}>Finish Session ✓</PurpleBtn>
      </div>
    );
  };

  const RoutineHistory = ({ routine, onDone }) => {
    const sessions = [...data.sessions].filter(s=>s.routineId===routine.id).sort((a,b)=>b.date.localeCompare(a.date));
    const delSess = async (id) => { 
      if (!window.confirm("Delete this session?")) return;
      await persist({ ...data, sessions:data.sessions.filter(s=>s.id!==id) }); 
      showToast("Removed"); 
    };
    const exNames = [...new Set(sessions.flatMap(s=>s.exercises.map(e=>e.name)))];
    const [selEx, setSelEx] = useState(exNames[0]||"");
    const pts = sessions.map((s,i) => { 
      const e = s.exercises.find(ex => ex.name === selEx);
      const maxW = e?.sets ? Math.max(0, ...e.sets.map(set => parseFloat(set.weight)||0)) : 0;
      return { s:`W${sessions.length-i}`, kg: maxW };
    }).reverse();

    return (
      <div style={{ paddingTop:4 }}>
        <NavBar title={routine.name} sub="Progress & History" onBack={onDone} />
        {exNames.length>0 && (
          <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:6, marginBottom:20 }}>
            {exNames.map(n => {
              const pr = getPR(data.prHistory || {}, n);
              return (
                <button key={n} onClick={() => setSelEx(n)} style={{
                  flexShrink:0, background: selEx===n ? C.lime : C.cardWhite,
                  border:`2px solid ${C.ink}`, color:C.ink,
                  padding:"8px 16px", fontSize:12, fontWeight:800, cursor:"pointer", fontFamily:FB, position:"relative",
                }}>
                  {n.toUpperCase()}
                  {pr !== null && selEx===n && (
                    <span style={{ display:"block", fontSize:9, fontWeight:900, color:C.ink, marginTop:4 }}>PR {pr}KG</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {pts.length>=2 && (
          <WhiteCard>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <Label>{selEx} — kg</Label>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                {getPR(data.prHistory||{}, selEx) !== null && (
                  <Pill color={C.yellow}>🏆 PR {getPR(data.prHistory||{}, selEx)}kg</Pill>
                )}
                {pts[pts.length-1].kg > pts[0].kg && <Pill color={C.green}>+{(pts[pts.length-1].kg-pts[0].kg).toFixed(1)}kg</Pill>}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={90}>
              <LineChart data={pts}>
                <XAxis dataKey="s" tick={{ fill:C.textLight3, fontSize:11, fontFamily:FB, fontWeight:700 }} axisLine={false} tickLine={false} />
                <Line type="monotone" dataKey="kg" stroke={C.purple} strokeWidth={3} dot={{ fill:C.lime, stroke:C.ink, strokeWidth:2, r:4 }} />
                <Tooltip formatter={v=>`${v}kg`} contentStyle={{ background:"#0A0A0A", border:`2px solid ${C.ink}`, fontSize:12, borderRadius:0, color:"#fff", fontFamily:FM, fontWeight:700 }} />
              </LineChart>
            </ResponsiveContainer>
          </WhiteCard>
        )}
        <Label>All sessions ({sessions.length})</Label>
        <div style={{ marginTop:12 }}>
          {sessions.length===0
            ? <div style={{ textAlign:"center", color:C.textLight3, fontWeight:700, padding:48, fontSize:15, fontFamily:FB, textTransform:"uppercase" }}>No sessions yet.</div>
            : sessions.map(s => (
              <WhiteCard key={s.id}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                  <Pill>{s.date}</Pill>
                  <TxtBtn onClick={() => delSess(s.id)} color={C.red} style={{ fontSize:12 }}>Delete</TxtBtn>
                </div>
                {s.exercises.map((e,i) => {
                  const vol = e.sets ? e.sets.reduce((sum, set) => sum + (parseFloat(set.weight)||0) * (parseInt(set.reps)||0), 0) : 0;
                  const maxW = e.sets ? Math.max(0, ...e.sets.map(set => parseFloat(set.weight)||0)) : 0;
                  return (
                    <div key={i} style={{ marginTop:10, paddingBottom:10, borderBottom: i < s.exercises.length-1 ? `2px solid ${C.cardMid}` : 'none' }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                        <div style={{ fontSize:14, fontWeight:800, color:C.textLight1, fontFamily:FB }}>{e.name}</div>
                        <div style={{ fontSize:11, fontWeight:700, color:C.textLight3, fontFamily:FM }}>Max {maxW}kg · Vol {vol}kg</div>
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                        {e.sets && e.sets.map((set, si) => (
                           <span key={si} style={{ fontSize:12, fontWeight:700, color:C.textLight2, fontFamily:FM, background:C.cardMid, padding:"3px 8px" }}>
                             {set.weight}kg × {set.reps}
                           </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {s.note && <div style={{ fontSize:13, fontWeight:600, color:C.textLight2, marginTop:10, fontStyle:"italic", borderTop:`2px solid ${C.ink}`, paddingTop:10, fontFamily:FB }}>{s.note}</div>}
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
  const wkSess = data.sessions.filter(s => {
    try { return weekKey(new Date(s.date)) === weekKey(); }
    catch { return false; }
  }).length;

  return (
    <div style={{ paddingTop:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
        <div style={{ fontSize:26, fontWeight:900, color:C.textLight1, fontFamily:F, textTransform:"uppercase" }}>Train</div>
        <TxtBtn onClick={() => setView("newRoutine")}>+ Routine</TxtBtn>
      </div>

      <DarkCard>
        <Label dark style={{ marginBottom:8 }}>Workout Stats</Label>
        <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:4 }}>
          <BigNum color={C.textDark1}>{wkSess}</BigNum>
          <span style={{ fontSize:14, fontWeight:800, color:C.textDark3, fontFamily:FB, textTransform:"uppercase" }}>Sessions This Week</span>
        </div>
        <div style={{ fontSize:11, fontWeight:700, color:C.textDark2, fontFamily:FM }}>TOTAL SESSIONS LOGGED: {totalSess}</div>
      </DarkCard>

      <div style={{ marginTop:16 }}>
        <Label>My Routines</Label>
        {data.routines.length === 0 ? (
          <div style={{ textAlign:"center", padding:"32px 0", fontSize:13, fontWeight:700, color:C.textLight3, fontFamily:FB, textTransform:"uppercase" }}>
            No routines found. Tap "+ Routine" above to create one.
          </div>
        ) : (
          data.routines.map(r => {
            const rSess = [...data.sessions].filter(s => s.routineId === r.id).sort((a,b) => b.date.localeCompare(a.date));
            const lastDate = rSess[0]?.date;
            return (
              <WhiteCard key={r.id} style={{ padding: "16px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:18, fontWeight:900, color:C.textLight1, fontFamily:F, textTransform:"uppercase" }}>{r.name}</div>
                    <div style={{ fontSize:11, fontWeight:700, color:C.textLight3, marginTop:2, fontFamily:FB }}>
                      {r.exercises.length} exercise{r.exercises.length > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <TxtBtn onClick={() => { setHistR(r); setView("history"); }}>History</TxtBtn>
                    <TxtBtn onClick={() => { setEditR(r); setView("editRoutine"); }}>Edit</TxtBtn>
                  </div>
                </div>
                {lastDate && <div style={{ fontSize:10, fontWeight:800, color:C.purple, marginBottom:12, fontFamily:FB }}>LAST DONE: {lastDate}</div>}
                <PurpleBtn onClick={() => { setActiveR(r); setView("session"); }}>▶ Start Workout</PurpleBtn>
              </WhiteCard>
            );
          })
        )}
      </div>
    </div>
  );
}