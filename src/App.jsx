import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { uploadRecords, downloadRecords, getToken, saveToken, clearToken, getRemoteMeta } from "./googleSync";

// ── 定数 ─────────────────────────────────────────────
const BET_TYPES = ["単勝", "複勝", "枠連", "馬連", "ワイド", "馬単", "三連複", "三連単"];
const RACE_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1);
const JRA_VENUES = ["札幌", "函館", "福島", "新潟", "中山", "東京", "中京", "阪神", "京都", "小倉"];
const CHIHO_VENUES = ["帯広", "門別", "盛岡", "水沢", "浦和", "船橋", "大井", "川崎", "金沢", "笠松", "名古屋", "園田", "姫路", "高知", "佐賀"];

const BET_TYPE_CONFIG = {
  単勝:   { sep: "",   max: 18, slots: 1, ordered: false },
  複勝:   { sep: "",   max: 18, slots: 1, ordered: false },
  枠連:   { sep: "-",  max: 8,  slots: 2, ordered: false },
  馬連:   { sep: "-",  max: 18, slots: 2, ordered: false },
  ワイド: { sep: "-",  max: 18, slots: 2, ordered: false },
  馬単:   { sep: "→",  max: 18, slots: 2, ordered: true  },
  三連複: { sep: "-",  max: 18, slots: 3, ordered: false },
  三連単: { sep: "→",  max: 18, slots: 3, ordered: true  },
};

const GRADED_RACES = {
  G1: ["フェブラリーS","高松宮記念","大阪杯","桜花賞","皐月賞","天皇賞（春）","NHKマイルC","ヴィクトリアマイル","優駿牝馬（オークス）","東京優駿（日本ダービー）","安田記念","宝塚記念","スプリンターズS","秋華賞","菊花賞","天皇賞（秋）","エリザベス女王杯","マイルCS","ジャパンC","チャンピオンズC","阪神JF","朝日杯FS","有馬記念","ホープフルS"],
  G2: ["AJCC","中山記念","阪急杯","金鯱賞","フローラS","青葉賞","京都新聞杯","目黒記念","エプソムC","ラジオNIKKEI賞（春）","プロキオンS","クイーンS","関屋記念","小倉記念","レパードS","新潟2歳S","セントウルS","オールカマー","神戸新聞杯","ローズS","毎日王冠","府中牝馬S","富士S","アルテミスS","デイリー杯2歳S","スワンS","京王杯2歳S","ステイヤーズS","チャレンジC","中日新聞杯","阪神C"],
  G3: ["京成杯","シンザン記念","愛知杯","根岸S","シルクロードS","東京新聞杯","きさらぎ賞","クイーンC","共同通信杯","小倉大賞典","アーリントンC","フィリーズレビュー","スプリングS","ニュージーランドT","アンタレスS","福島牝馬S","メトロポリタンS","葵S","鳴尾記念","ユニコーンS","マーメイドS","七夕賞","函館スプリントS","函館2歳S","アイビスSD","キーンランドC","紫苑S","ラジオNIKKEI賞（秋）","ファンタジーS","カシオペアS","東京盃","武蔵野S","みやこS","東スポ2歳S","福島記念","京阪杯","キャピタルS","京都大賞典","サウジアラビアRC","ターコイズS","中山大障害","CBC賞","札幌2歳S","京成杯AH","新潟記念"],
  Jpn1: ["川崎記念","帝王賞","JBCクラシック","JBCスプリント","JBCレディスクラシック","JBC2歳優駿","東京大賞典","かしわ記念","さきたま杯","マイルチャンピオンシップ南部杯","全日本2歳優駿"],
  Jpn2: ["名古屋大賞典","ダイオライト記念","兵庫チャンピオンシップ","エンプレス杯","ブリーダーズGC","マーキュリーC","日本TV盃","レディスプレリュード","白山大賞典","浦和記念","兵庫ゴールドT"],
  Jpn3: ["兵庫ジュニアGP","スパーキングレディーC","クラスターC","北海道スプリントC","関東オークス","エーデルワイス賞","マリーンC","習志野きらっとスプリント","名古屋グランプリ"],
  地方重賞: ["東京ダービー","羽田盃","ジャパンダートクラシック","大井記念","京浜盃","南関東クラシック","黒船賞","佐賀記念","高知県知事賞","東海ダービー","名古屋記念","笠松グランプリ","ハイセイコー記念"],
};

const GRADE_COLORS = { G1: "#e8c86a", G2: "#aab8d4", G3: "#c8a0d0", Jpn1: "#d4a875", Jpn2: "#a8b898", Jpn3: "#b898c0", 地方重賞: "#8090a8" };
const GRADE_OPTIONS = { JRA: ["一般", "G3", "G2", "G1"], 地方: ["一般", "地方重賞", "Jpn3", "Jpn2", "Jpn1"] };

const JOCKEYS = [
  "C.ルメール","川田将雅","武豊","戸崎圭太","横山武史","坂井瑠星","岩田望来","松山弘平","北村友一","北村宏司",
  "福永祐一","横山和生","横山典弘","M.デムーロ","田辺裕信","三浦皇成","石橋脩","津村明秀","吉田隼人","鮫島克駿",
  "菅原明良","菊沢一樹","浜中俊","池添謙一","和田竜二","酒井学","藤岡佑介","藤岡康太","幸英明","荻野極",
  "西村淳也","今村聖奈","永野猛蔵","小沢大仁","田口貫太","河原田菜々","佐々木大輔","角田大和","角田大河","国分恭介",
  "国分優作","丸田恭介","松若風馬","古川吉洋","松田大作","森裕太朗","団野大成","C.デムーロ","R.ムーア",
  "W.ビュイック","J.モレイラ","D.レーン","T.マーカンド","O.マーフィー","A.アレンフルート",
];

const HORSES = [
  "ドウデュース","イクイノックス","ソダシ","リバティアイランド","スターズオンアース","オーソクレース",
  "ジャスティンパレス","タイトルホルダー","ステラヴェローチェ","エフフォーリア","ソングライン","シュネルマイスター",
  "サリオス","コントレイル","グランアレグリア","アーモンドアイ","クロノジェネシス","デアリングタクト",
  "ルヴァンスレーヴ","インティ","クリソベリル","チュウワウィザード","カフェファラオ","レモンポップ","ウシュバテソーロ",
  "ドゥラエレーデ","ロマンチックウォリアー","ドンフランキー","ジャックドール","ドウラ","イルーシヴパンサー",
  "ナムラクレア","ママコチャ","ライトバック","ジャンタルマンタル","ミッキーアイル","グレナディアガーズ",
  "セリフォス","ソウルラッシュ","ナミュール","スタニングローズ","アカイイト","ローシャムパーク","プログノーシス",
  "ボッケリーニ","シルヴァーソニック","ディープボンド","ドゥラメンテ","サートゥルナーリア","キセキ","レイパパレ",
  "グローリーヴェイズ","ワールドプレミア","フィエールマン","ラヴズオンリーユー","ユーバーレーベン","タスティエーラ",
  "ソールオリエンス","スキルヴィング","ハーツコンチェルト","シンエンペラー","アーバンシック","ダノンデサイル",
  "ジャスティンミラノ","レガレイラ","ステレンボッシュ","チェルヴィニア","アスコリピチェーノ","ボンドガール",
  "ベラジオオペラ","シャフリヤール","ヴェラアズール","オーソリティ","ブローザホーン","ドゥレッツァ",
  "アスクビクターモア","ダービースマッシュ","ドルチェモア","リバーラ","タマモブラックタイ","シャンパンカラー",
  "ダノンタッチダウン","フリームファクシ","ファントムシーフ","クラシックノーザン",
];

// ── エントリー初期値 ─────────────────
const newEntry = (mode = "manual") => ({
  id: Math.random().toString(36).slice(2, 9),
  mode, text: "", horses: [], axisHorses: [], poolHorses: [], axisPos: "1st", columns: [[], [], []],
  unitAmount: 100, amountMap: {}, tags: [],
  hitCombos: [], // 的中した組み合わせ ["3-7-12", ...]
  oddsMap: {},   // 組み合わせ別オッズ { "3-7-12": 23.4 } 倍率で保存
});

const initialForm = {
  date: new Date().toISOString().slice(0, 10),
  venueType: "JRA", venue: "", raceNo: "", grade: "一般", raceName: "",
  betType: "三連単", entries: [newEntry("manual")],
  oddsMode: "per100",
};

const keepRaceInfo = (prev) => ({
  ...initialForm,
  date: prev.date, venueType: prev.venueType, venue: prev.venue,
  raceNo: prev.raceNo, grade: prev.grade, raceName: prev.raceName,
  oddsMode: prev.oddsMode, betType: prev.betType,
});

// ── 組み合わせ生成（変更なし） ─────────────
function sorted(arr) { return [...arr].sort((a, b) => a - b); }

function computeManual(text) {
  const lines = (text || "").split("\n").map(s => s.trim()).filter(Boolean);
  return { combinations: lines, summary: "通常" };
}
function computeBox(horses, betType) {
  const { slots, ordered, sep } = BET_TYPE_CONFIG[betType];
  const hs = sorted(horses);
  if (hs.length < slots) return { combinations: [], summary: "" };
  const result = [];
  if (slots === 1) hs.forEach(h => result.push(String(h)));
  else if (slots === 2) {
    for (let i = 0; i < hs.length; i++) for (let j = 0; j < hs.length; j++) {
      if (i === j) continue;
      if (ordered || i < j) result.push(`${hs[i]}${sep}${hs[j]}`);
    }
  } else {
    for (let i = 0; i < hs.length; i++) for (let j = 0; j < hs.length; j++) for (let k = 0; k < hs.length; k++) {
      if (i === j || i === k || j === k) continue;
      if (ordered || (i < j && j < k)) result.push(`${hs[i]}${sep}${hs[j]}${sep}${hs[k]}`);
    }
  }
  return { combinations: result, summary: `ボックス：${hs.join(",")}` };
}
function computeWheel(axisHorses, poolHorses, axisPos, betType) {
  const { slots, ordered, sep } = BET_TYPE_CONFIG[betType];
  const axis = sorted(axisHorses);
  const pool = sorted(poolHorses.filter(h => !axis.includes(h)));
  if (axis.length === 0 || pool.length === 0 || slots < 2) return { combinations: [], summary: "" };
  const result = []; let summary = "";
  if (axis.length === 1) {
    const a = axis[0];
    if (slots === 2) {
      if (!ordered) { pool.forEach(p => { const [x, y] = sorted([a, p]); result.push(`${x}${sep}${y}`); }); summary = `軸1頭流し：軸=${a} / 相手=${pool.join(",")}`; }
      else if (axisPos === "1st") { pool.forEach(p => result.push(`${a}${sep}${p}`)); summary = `1着流し：1着=${a} / 2着=${pool.join(",")}`; }
      else { pool.forEach(p => result.push(`${p}${sep}${a}`)); summary = `2着流し：1着=${pool.join(",")} / 2着=${a}`; }
    } else if (slots === 3) {
      if (!ordered) {
        for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) result.push(sorted([a, pool[i], pool[j]]).join(sep));
        summary = `軸1頭流し：軸=${a} / 相手=${pool.join(",")}`;
      } else {
        const addCombo = arr => result.push(arr.join(sep));
        if (axisPos === "1st") { for (let i = 0; i < pool.length; i++) for (let j = 0; j < pool.length; j++) if (i !== j) addCombo([a, pool[i], pool[j]]); summary = `1着流し：1着=${a} / 2・3着=${pool.join(",")}`; }
        else if (axisPos === "2nd") { for (let i = 0; i < pool.length; i++) for (let j = 0; j < pool.length; j++) if (i !== j) addCombo([pool[i], a, pool[j]]); summary = `2着流し：2着=${a} / 1・3着=${pool.join(",")}`; }
        else if (axisPos === "3rd") { for (let i = 0; i < pool.length; i++) for (let j = 0; j < pool.length; j++) if (i !== j) addCombo([pool[i], pool[j], a]); summary = `3着流し：3着=${a} / 1・2着=${pool.join(",")}`; }
        else if (axisPos === "multi") {
          for (let pos = 0; pos < 3; pos++) for (let i = 0; i < pool.length; i++) for (let j = 0; j < pool.length; j++) {
            if (i === j) continue; const arr = [pool[i], pool[j]]; arr.splice(pos, 0, a); addCombo(arr);
          }
          summary = `1頭軸マルチ：軸=${a} / 相手=${pool.join(",")}`;
        }
      }
    }
  } else if (axis.length === 2 && slots === 3 && !ordered) {
    pool.forEach(p => result.push(sorted([...axis, p]).join(sep)));
    summary = `軸2頭流し：軸=${axis.join(",")} / 相手=${pool.join(",")}`;
  }
  return { combinations: result, summary };
}
function computeFormation(columns, betType) {
  const { slots, ordered, sep } = BET_TYPE_CONFIG[betType];
  const cols = columns.slice(0, slots).map(sorted);
  if (cols.some(c => c.length === 0)) return { combinations: [], summary: "" };
  const result = new Set();
  if (slots === 1) cols[0].forEach(h => result.add(String(h)));
  else if (slots === 2) {
    for (const a of cols[0]) for (const b of cols[1]) {
      if (a === b) continue;
      if (ordered) result.add(`${a}${sep}${b}`);
      else { const [x, y] = sorted([a, b]); result.add(`${x}${sep}${y}`); }
    }
  } else {
    for (const a of cols[0]) for (const b of cols[1]) for (const c of cols[2]) {
      if (a === b || a === c || b === c) continue;
      if (ordered) result.add(`${a}${sep}${b}${sep}${c}`);
      else { const [x, y, z] = sorted([a, b, c]); result.add(`${x}${sep}${y}${sep}${z}`); }
    }
  }
  return { combinations: [...result], summary: `フォーメーション：${cols.map(c => c.join(",")).join(" / ")}` };
}
function computeEntry(entry, betType) {
  if (entry.mode === "manual") return computeManual(entry.text);
  if (entry.mode === "box") return computeBox(entry.horses, betType);
  if (entry.mode === "wheel") return computeWheel(entry.axisHorses, entry.poolHorses, entry.axisPos, betType);
  if (entry.mode === "formation") return computeFormation(entry.columns, betType);
  return { combinations: [], summary: "" };
}
function entryInvestment(entry, betType) {
  const { combinations } = computeEntry(entry, betType);
  return combinations.reduce((s, c) => s + (entry.amountMap?.[c] ?? entry.unitAmount), 0);
}
// 1エントリーの的中分の払戻合計
function entryPayout(entry, betType) {
  return (entry.hitCombos || []).reduce((sum, c) => {
    const amt = entry.amountMap?.[c] ?? entry.unitAmount;
    const odds = entry.oddsMap?.[c] || 0;
    if (!odds) return sum;
    return sum + Math.floor((amt * odds) / 10) * 10;
  }, 0);
}

// ── ユーティリティ ─────────────
const normalizeOdds = (raw, mode) => { const n = Number(raw); if (!n || n <= 0) return 0; return mode === "per100" ? n / 100 : n; };
const formatYen = v => { const n = Number(v); return isNaN(n) ? "¥0" : "¥" + n.toLocaleString("ja-JP"); };
const dayOfWeek = s => ["日", "月", "火", "水", "木", "金", "土"][new Date(s).getDay()];
const formatDate = s => { if (!s) return ""; const d = new Date(s); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${dayOfWeek(s)}）`; };

// ── CSV / JSON ─────────────
function recordsToCSV(records) {
  const headers = ["日付","競馬場区分","競馬場","R","グレード","レース名","券種","点数","投資額","的中","払戻金","収支","買い目","タグ"];
  const esc = v => { const s = String(v ?? "").replace(/"/g, '""'); return /[,"\n]/.test(s) ? `"${s}"` : s; };
  const rows = records.map(r => [
    r.date, r.venueType || "", r.venue || "", r.raceNo || "", r.grade || "", r.raceName || "",
    r.betType, r.points, r.investment, r.isHit ? "○" : "×",
    r.payout, r.pnl, (r.combination || "").replace(/\n/g, " | "),
    (r.tags || []).join(" | "),
  ]);
  return [headers, ...rows].map(row => row.map(esc).join(",")).join("\n");
}
function downloadFile(filename, content, mime) {
  try {
    const bom = mime.includes("csv") ? "\ufeff" : "";
    const blob = new Blob([bom + content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    return true;
  } catch { return false; }
}

// ── 共通スタイル ─────────────
const inputStyle = { width: "100%", background: "#1e2a40", border: "1px solid #2a3550", borderRadius: 8, color: "#e4e6eb", padding: "10px 12px", fontSize: 14, marginBottom: 14, boxSizing: "border-box", outline: "none" };

function Label({ children }) { return <div style={{ fontSize: 11, color: "#6b7a99", fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>{children}</div>; }
function BetTypeBadge({ type }) { const c = { 単勝: "#e8a838", 複勝: "#6cbc5e", 枠連: "#5b8fd4", 馬連: "#d46b8f", ワイド: "#8f6bd4", 馬単: "#d48c5b", 三連複: "#5bbcbc", 三連単: "#d45b5b" }; return <span style={{ background: c[type] || "#666", color: "#fff", padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap" }}>{type}</span>; }
function GradeBadge({ grade }) { if (!grade || grade === "一般") return null; return <span style={{ background: GRADE_COLORS[grade], color: "#1a1a2e", padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>{grade}</span>; }
function StatMini({ label, value, color = "#e4e6eb", small }) { return <div style={{ textAlign: "center" }}><div style={{ fontSize: small ? 10 : 11, color: "#6b7a99", marginBottom: 2 }}>{label}</div><div style={{ fontSize: small ? 11 : 13, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div></div>; }
function BigStat({ label, value, color = "#e4e6eb" }) { return <div style={{ background: "#1e2a40", borderRadius: 10, padding: "12px 14px" }}><div style={{ fontSize: 11, color: "#6b7a99", marginBottom: 4 }}>{label}</div><div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: "monospace" }}>{value}</div></div>; }
function PnLText({ value }) { return <span style={{ color: value === 0 ? "#888" : value > 0 ? "#6cbc5e" : "#e05555", fontWeight: 700, fontFamily: "monospace", fontSize: 14 }}>{value > 0 ? "+" : ""}{formatYen(value)}</span>; }

// ── カスタムカレンダー ─────────────
function CalendarPicker({ value, onChange, onClose }) {
  const init = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth());
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length < 42) cells.push(null);
  const prev = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); };
  const next = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); };
  const pick = d => { const mm = String(viewMonth + 1).padStart(2, "0"); const dd = String(d).padStart(2, "0"); onChange(`${viewYear}-${mm}-${dd}`); onClose(); };
  const setToday = () => { onChange(new Date().toISOString().slice(0, 10)); onClose(); };
  const navBtn = { width: 36, height: 36, borderRadius: 10, border: "1px solid #2a3550", background: "#1e2a40", color: "#e4e6eb", fontSize: 20, fontWeight: 700, cursor: "pointer" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#161c2e", borderRadius: 16, padding: 18, width: "100%", maxWidth: 360, border: "1px solid #2a3550" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <button onClick={prev} style={navBtn}>‹</button>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#e8c86a" }}>{viewYear}年 {viewMonth + 1}月</div>
          <button onClick={next} style={navBtn}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
          {["日", "月", "火", "水", "木", "金", "土"].map((w, i) => (
            <div key={w} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, padding: "4px 0", color: i === 0 ? "#e08888" : i === 6 ? "#88a8e0" : "#6b7a99" }}>{w}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {cells.map((d, idx) => {
            if (d === null) return <div key={idx} />;
            const mm = String(viewMonth + 1).padStart(2, "0"); const dd = String(d).padStart(2, "0");
            const thisDate = `${viewYear}-${mm}-${dd}`;
            const dow = new Date(thisDate).getDay();
            const isSelected = thisDate === value; const isToday = thisDate === today;
            return <button key={idx} onClick={() => pick(d)}
              style={{ aspectRatio: "1", borderRadius: 8, border: isToday && !isSelected ? "1.5px solid #e8c86a" : "1.5px solid transparent",
                background: isSelected ? "#e8c86a" : "transparent",
                color: isSelected ? "#0d1117" : dow === 0 ? "#e08888" : dow === 6 ? "#88a8e0" : "#e4e6eb",
                fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{d}</button>;
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={setToday} style={{ flex: 1, padding: 10, borderRadius: 8, background: "#2a3a55", border: "1px solid #3a4f7a", color: "#b8d0ff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>今日</button>
          <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, background: "#1e2a40", border: "1px solid #2a3550", color: "#8899bb", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

// ── 金額ステッパー ─────────────
function AmountStepper({ value, onChange, compact = false }) {
  const val = Number(value) || 0;
  const setTo = n => onChange(Math.max(100, Math.floor(n / 100) * 100));
  const inc = step => setTo(val + step);
  const dec = step => setTo(val - step);
  if (compact) {
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button onClick={() => dec(100)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #3a4f7a", background: "#2a3a55", color: "#b8d0ff", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: 0, lineHeight: 1 }}>−</button>
        <input type="number" value={val} onChange={e => setTo(Number(e.target.value))}
          style={{ width: 70, padding: "5px 6px", background: "#1e2a40", border: "1px solid #2a3550", borderRadius: 6, color: "#e4e6eb", fontSize: 12, textAlign: "right", fontFamily: "monospace" }} />
        <span style={{ color: "#6b7a99", fontSize: 10 }}>円</span>
        <button onClick={() => inc(100)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #3a4f7a", background: "#2a3a55", color: "#b8d0ff", fontSize: 14, fontWeight: 700, cursor: "pointer", padding: 0, lineHeight: 1 }}>＋</button>
      </div>
    );
  }
  const bigBtn = { width: 56, padding: "12px 0", borderRadius: 8, border: "1.5px solid #3a4f7a", background: "#2a3a55", color: "#b8d0ff", fontSize: 12, fontWeight: 800, cursor: "pointer", flexShrink: 0 };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <button onClick={() => dec(100)} style={bigBtn}>−100</button>
        <input type="number" min="100" step="100" value={val} onChange={e => setTo(Number(e.target.value))}
          style={{ flex: 1, padding: "12px 14px", background: "#1e2a40", border: "1.5px solid #2a3550", borderRadius: 8, color: "#e4e6eb", fontSize: 18, fontWeight: 700, textAlign: "center", fontFamily: "monospace" }} />
        <button onClick={() => inc(100)} style={bigBtn}>＋100</button>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[100, 500, 1000, 5000, 10000].map(step => (
          <button key={step} onClick={() => inc(step)} style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: "1px solid #3a4f7a", background: "#1e2a40", color: "#b8d0ff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "monospace" }}>+{step >= 1000 ? `${step / 1000}k` : step}</button>
        ))}
      </div>
    </div>
  );
}

// ── オッズステッパー ─────────────
// value は倍率で保存。100円払戻モードのとき表示は円(value × 100)
function OddsStepper({ value, onChange, oddsMode }) {
  const stepBtn = { width: 28, height: 30, borderRadius: 6, border: "1px solid #2a4a3a", background: "#1a3a1a", color: "#6cbc5e", fontSize: 16, fontWeight: 700, cursor: "pointer", padding: 0, lineHeight: 1, flexShrink: 0 };
  const inputStyleOdds = { flex: 1, minWidth: 60, background: "#1e2a40", border: "1px solid #2a3550", borderRadius: 4, color: "#e4e6eb", fontSize: 14, fontWeight: 700, padding: "4px 8px", fontFamily: "monospace", textAlign: "right" };

  // 入力中の文字列をローカルに保持し、確定時だけスナップして親へ通知
  const [draft, setDraft] = useState(null); // null = 非編集中

  if (oddsMode === "per100") {
    const yenVal = value > 0 ? Math.round(value * 100) : 0;
    const commitYen = (n) => {
      const snapped = Math.max(0, Math.round(Number(n) / 10) * 10);
      onChange(snapped > 0 ? snapped / 100 : 0);
      setDraft(null);
    };
    const stepYen = (delta) => commitYen(yenVal + delta);
    const displayVal = draft !== null ? draft : (yenVal || "");
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button onClick={() => stepYen(-10)} style={stepBtn}>−</button>
        <input
          type="number" min="0" inputMode="numeric"
          value={displayVal}
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commitYen(e.target.value)}
          placeholder="2340"
          style={inputStyleOdds} />
        <span style={{ fontSize: 11, color: "#6b7a99", flexShrink: 0 }}>円</span>
        <button onClick={() => stepYen(+10)} style={stepBtn}>＋</button>
      </div>
    );
  }

  // 倍率モード：0.1単位ステッパー
  const v = value || 0;
  const commitMult = (n) => {
    const snapped = Math.max(0, Math.round(Number(n) * 10) / 10);
    onChange(snapped);
    setDraft(null);
  };
  const stepMult = (delta) => commitMult(v + delta);
  const displayMult = draft !== null ? draft : (v || "");
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <button onClick={() => stepMult(-0.1)} style={stepBtn}>−</button>
      <input
        type="number" min="0" step="0.1" inputMode="decimal"
        value={displayMult}
        onChange={e => setDraft(e.target.value)}
        onBlur={e => commitMult(e.target.value)}
        placeholder="23.4"
        style={inputStyleOdds} />
      <span style={{ fontSize: 11, color: "#6b7a99", flexShrink: 0 }}>倍</span>
      <button onClick={() => stepMult(+0.1)} style={stepBtn}>＋</button>
    </div>
  );
}

// ── タグ入力 ─────────────
function TagInputWithSuggest({ tags, onChange, allHistoryTags, placeholder }) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef();

  useEffect(() => {
    const handler = e => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setFocused(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const suggestions = useMemo(() => {
    if (!input.trim()) return [];
    const q = input.trim().toLowerCase();
    const historyMap = new Map();
    allHistoryTags.forEach(t => historyMap.set(t, (historyMap.get(t) || 0) + 1));
    const pool = [
      ...allHistoryTags.map(t => ({ text: t, source: "history", freq: historyMap.get(t) || 1 })),
      ...JOCKEYS.map(t => ({ text: t, source: "jockey", freq: 0 })),
      ...HORSES.map(t => ({ text: t, source: "horse", freq: 0 })),
    ];
    const seen = new Map();
    pool.forEach(p => { const e = seen.get(p.text); if (!e || p.source === "history") seen.set(p.text, p); });
    return [...seen.values()]
      .filter(p => !tags.includes(p.text) && p.text.toLowerCase().includes(q))
      .sort((a, b) => {
        const aS = a.text.toLowerCase().startsWith(q); const bS = b.text.toLowerCase().startsWith(q);
        if (aS && !bS) return -1; if (!aS && bS) return 1;
        if (a.source === "history" && b.source !== "history") return -1;
        if (b.source === "history" && a.source !== "history") return 1;
        return b.freq - a.freq;
      })
      .slice(0, 8);
  }, [input, tags, allHistoryTags]);

  const addTag = (t) => { const trimmed = t.trim(); if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]); setInput(""); };
  const handleKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); if (suggestions.length > 0) addTag(suggestions[0].text); else if (input.trim()) addTag(input); }
    else if (e.key === "Backspace" && !input && tags.length > 0) onChange(tags.slice(0, -1));
  };
  const sourceColor = { history: "#6cbc5e", jockey: "#8fc7e8", horse: "#e8a888" };
  const sourceLabel = { history: "履歴", jockey: "騎手", horse: "馬" };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <div style={{ minHeight: 44, background: "#1e2a40", border: "1px solid #2a3550", borderRadius: 8, padding: "6px 8px", display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
        {tags.map(t => (
          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#2a3a55", color: "#b8d0ff", padding: "3px 8px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
            #{t}
            <button onClick={() => onChange(tags.filter(x => x !== t))} style={{ background: "rgba(0,0,0,0.2)", border: "none", color: "#b8d0ff", fontSize: 10, fontWeight: 800, cursor: "pointer", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>×</button>
          </span>
        ))}
        <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          placeholder={tags.length === 0 ? placeholder : ""}
          style={{ flex: 1, minWidth: 80, background: "transparent", border: "none", color: "#e4e6eb", fontSize: 13, outline: "none", padding: "4px 0" }} />
      </div>
      {focused && suggestions.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#0f1420", border: "1px solid #2a3550", borderRadius: 8, maxHeight: 260, overflowY: "auto", zIndex: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          {suggestions.map(s => (
            <button key={s.text + s.source} onClick={() => addTag(s.text)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "10px 12px", background: "transparent", border: "none", borderBottom: "1px solid #1e2a40", cursor: "pointer", color: "#e4e6eb", fontSize: 13, fontWeight: 600, textAlign: "left" }}>
              <span>{s.text}</span>
              <span style={{ background: sourceColor[s.source], color: "#0d1117", padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 800 }}>{sourceLabel[s.source]}</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10, color: "#6b7a99", marginTop: 4 }}>名前を入力すると候補を表示。Enter or タップで追加</div>
    </div>
  );
}

// ── 馬番選択グリッド ─────────────
function HorseGrid({ max, selected, onToggle, disabled = [], accent = "#e8c86a" }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${max > 9 ? 9 : max}, 1fr)`, gap: 4 }}>
      {Array.from({ length: max }, (_, i) => i + 1).map(n => {
        const on = selected.includes(n); const d = disabled.includes(n);
        return <button key={n} onClick={() => !d && onToggle(n)} disabled={d}
          style={{ padding: "8px 0", borderRadius: 6, border: "1.5px solid", fontSize: 13, fontWeight: 700, fontFamily: "monospace",
            cursor: d ? "not-allowed" : "pointer", opacity: d ? 0.3 : 1,
            background: on ? accent : "#1e2a40", color: on ? "#0d1117" : "#e4e6eb",
            borderColor: on ? accent : "#2a3550", transition: "all 0.1s",
          }}>{n}</button>;
      })}
    </div>
  );
}

// ── 4モードエディタ ─────────────
function ManualEditor({ entry, onChange, betType }) {
  const { slots, sep, max } = BET_TYPE_CONFIG[betType];
  const text = entry.text || "";

  const handleTap = (n) => {
    let newText;
    if (slots === 1) {
      const t = !text ? "" : (text.endsWith("\n") ? text : text + "\n");
      newText = t + String(n) + "\n";
    } else {
      const lines = text.split("\n");
      const lastLine = lines[lines.length - 1];
      if (!lastLine) {
        newText = text + String(n);
      } else {
        const count = lastLine.split(sep).length;
        if (count >= slots) {
          newText = text + "\n" + String(n);
        } else if (count + 1 >= slots) {
          newText = text + sep + String(n) + "\n";
        } else {
          newText = text + sep + String(n);
        }
      }
    }
    onChange({ ...entry, text: newText });
  };

  const backspace = () => {
    const t = entry.text || "";
    if (!t) return;
    onChange({ ...entry, text: t.slice(0, -1) });
  };
  const clearAll = () => onChange({ ...entry, text: "" });

  const allLines = text.split("\n");
  const completedLines = allLines.slice(0, -1).filter(Boolean);
  const currentLine = allLines[allLines.length - 1] || "";
  const currentCount = !currentLine ? 0 : (slots === 1 ? 1 : currentLine.split(sep).length);

  return (
    <div>
      <div style={{ minHeight: 52, maxHeight: 130, overflowY: "auto", background: "#0f1420", border: "1px solid #2a3550", borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontFamily: "monospace", fontSize: 14 }}>
        {completedLines.length === 0 && !currentLine ? (
          <div style={{ color: "#445", fontSize: 12 }}>
            {slots === 1 ? "馬番をタップして追加" : `馬番タップで入力 — ${slots}頭で1組み合わせ`}
          </div>
        ) : (
          <>
            {completedLines.map((line, i) => (
              <div key={i} style={{ color: "#6cbc5e", letterSpacing: 1, lineHeight: 1.7 }}>✓ {line}</div>
            ))}
            {currentLine && (
              <div style={{ color: "#e8c86a", letterSpacing: 1, lineHeight: 1.7 }}>
                ▶ {currentLine}<span style={{ opacity: 0.4 }}>▊</span>
                {slots > 1 && <span style={{ fontSize: 10, color: "#6b7a99", marginLeft: 6 }}>{currentCount}/{slots}頭</span>}
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ marginBottom: 8 }}>
        <HorseGrid max={max} selected={[]} onToggle={handleTap} />
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={backspace}
          style={{ flex: 2, padding: "10px 0", borderRadius: 6, border: "1px solid #2a3550", background: "#1e2a40", color: "#aab", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
          ⌫
        </button>
        <button onClick={clearAll}
          style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: "1px solid #5a2a2a", background: "#3a1a1a", color: "#e05555", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          全消去
        </button>
      </div>
    </div>
  );
}
function BoxEditor({ entry, onChange, betType }) {
  const max = BET_TYPE_CONFIG[betType].max;
  const toggle = n => { const h = entry.horses.includes(n); onChange({ ...entry, horses: h ? entry.horses.filter(x => x !== n) : [...entry.horses, n] }); };
  return (
    <div>
      <div style={{ fontSize: 11, color: "#6b7a99", marginBottom: 6 }}>馬番を選択（2頭以上）</div>
      <HorseGrid max={max} selected={entry.horses} onToggle={toggle} accent="#e8c86a" />
      {entry.horses.length > 0 && <div style={{ marginTop: 10, fontSize: 11, color: "#8899bb", fontFamily: "monospace" }}>選択中：{sorted(entry.horses).join(", ")}（{entry.horses.length}頭）</div>}
    </div>
  );
}
function WheelEditor({ entry, onChange, betType }) {
  const { max, slots, ordered } = BET_TYPE_CONFIG[betType];
  if (slots === 1) return <div style={{ color: "#e05555", fontSize: 12, padding: 10 }}>流しは単勝・複勝では使えません</div>;
  const supportTwoAxis = slots === 3 && !ordered;
  const toggleAxis = n => { const h = entry.axisHorses.includes(n); const maxA = supportTwoAxis ? 2 : 1;
    if (h) onChange({ ...entry, axisHorses: entry.axisHorses.filter(x => x !== n) });
    else if (entry.axisHorses.length < maxA) onChange({ ...entry, axisHorses: [...entry.axisHorses, n], poolHorses: entry.poolHorses.filter(x => x !== n) });
  };
  const togglePool = n => { if (entry.axisHorses.includes(n)) return; const h = entry.poolHorses.includes(n); onChange({ ...entry, poolHorses: h ? entry.poolHorses.filter(x => x !== n) : [...entry.poolHorses, n] }); };
  return (
    <div>
      {ordered && (
        <>
          <div style={{ fontSize: 11, color: "#6b7a99", marginBottom: 6 }}>軸位置</div>
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {(slots === 2 ? [{ id: "1st", label: "1着流し" }, { id: "2nd", label: "2着流し" }] : [{ id: "1st", label: "1着" }, { id: "2nd", label: "2着" }, { id: "3rd", label: "3着" }, { id: "multi", label: "マルチ" }]).map(p => (
              <button key={p.id} onClick={() => onChange({ ...entry, axisPos: p.id })}
                style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "1.5px solid", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: entry.axisPos === p.id ? "#5b7fbf" : "#1e2a40",
                  color: entry.axisPos === p.id ? "#0d1117" : "#8899bb",
                  borderColor: entry.axisPos === p.id ? "#5b7fbf" : "#2a3550",
                }}>{p.label}</button>
            ))}
          </div>
        </>
      )}
      <div style={{ fontSize: 11, color: "#6b7a99", marginBottom: 6 }}>軸馬（{supportTwoAxis ? "1〜2頭" : "1頭"}）</div>
      <HorseGrid max={max} selected={entry.axisHorses} onToggle={toggleAxis} accent="#e8c86a" />
      <div style={{ fontSize: 11, color: "#6b7a99", margin: "12px 0 6px" }}>相手馬（複数）</div>
      <HorseGrid max={max} selected={entry.poolHorses} onToggle={togglePool} disabled={entry.axisHorses} accent="#5b7fbf" />
      {entry.axisHorses.length > 0 && entry.poolHorses.length > 0 && <div style={{ marginTop: 10, fontSize: 11, color: "#8899bb", fontFamily: "monospace" }}>軸：{sorted(entry.axisHorses).join(",")} ／ 相手：{sorted(entry.poolHorses).join(",")}</div>}
    </div>
  );
}
function FormationEditor({ entry, onChange, betType }) {
  const { max, slots, ordered } = BET_TYPE_CONFIG[betType];
  if (slots === 1) return <div style={{ color: "#e05555", fontSize: 12, padding: 10 }}>フォーメーションは単勝・複勝では使えません</div>;
  const labels = slots === 2 ? (ordered ? ["1着", "2着"] : ["1頭目", "2頭目"]) : (ordered ? ["1着", "2着", "3着"] : ["1頭目", "2頭目", "3頭目"]);
  const toggleCol = (idx, n) => { const col = entry.columns[idx] || []; const h = col.includes(n); const nc = h ? col.filter(x => x !== n) : [...col, n]; const ncs = [...entry.columns]; ncs[idx] = nc; onChange({ ...entry, columns: ncs }); };
  return (
    <div>
      {labels.map((label, idx) => (
        <div key={idx} style={{ marginBottom: idx < labels.length - 1 ? 14 : 0 }}>
          <div style={{ fontSize: 11, color: "#6b7a99", marginBottom: 6, fontWeight: 700 }}>{label}</div>
          <HorseGrid max={max} selected={entry.columns[idx] || []} onToggle={n => toggleCol(idx, n)} accent="#c8a0d0" />
          {(entry.columns[idx] || []).length > 0 && <div style={{ marginTop: 6, fontSize: 10, color: "#8899bb", fontFamily: "monospace" }}>{sorted(entry.columns[idx]).join(",")}（{entry.columns[idx].length}頭）</div>}
        </div>
      ))}
    </div>
  );
}

// ── 組み合わせリスト（チェック・金額・オッズ） ─────────────
function CombinationsList({ entry, combinations, onChange, oddsMode }) {
  const [showAmounts, setShowAmounts] = useState(false);
  const customCount = Object.keys(entry.amountMap || {}).filter(k => combinations.includes(k)).length;

  if (combinations.length === 0) return null;

  const toggleHit = (combo) => {
    const next = new Set(entry.hitCombos || []);
    if (next.has(combo)) next.delete(combo); else next.add(combo);
    onChange({ ...entry, hitCombos: [...next] });
  };

  const setAmount = (combo, amt) => {
    const map = { ...(entry.amountMap || {}) };
    if (amt === entry.unitAmount) delete map[combo];
    else map[combo] = amt;
    onChange({ ...entry, amountMap: map });
  };

  const setOdds = (combo, raw) => {
    const map = { ...(entry.oddsMap || {}) };
    const mult = normalizeOdds(raw, oddsMode);
    if (mult > 0) map[combo] = mult;
    else delete map[combo];
    onChange({ ...entry, oddsMap: map });
  };

  const getOddsDisplay = (combo) => {
    const mult = entry.oddsMap?.[combo];
    if (!mult) return "";
    return oddsMode === "per100" ? Math.round(mult * 100) : mult;
  };

  return (
    <div style={{ marginTop: 14, background: "#0f1420", border: "1px solid #2a3550", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#aab" }}>組み合わせ ({combinations.length}点)</div>
        <button onClick={() => setShowAmounts(!showAmounts)} style={{ background: "none", border: "1px solid #3a4f7a", color: "#8899bb", fontSize: 10, fontWeight: 700, cursor: "pointer", padding: "3px 8px", borderRadius: 12 }}>
          {showAmounts ? "金額を隠す" : "金額を調整"}{customCount > 0 ? ` (${customCount})` : ""}
        </button>
      </div>

      <div style={{ background: "#1a2540", border: "1.5px solid #3a4f7a", borderRadius: 8, padding: "10px 12px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 28, lineHeight: 1 }}>☐</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#b8d0ff", lineHeight: 1.4 }}>をタップして的中をチェック</div>
          <div style={{ fontSize: 11, color: "#6b7a99", marginTop: 2 }}>チェックするとオッズ入力欄が表示されます</div>
        </div>
      </div>

      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {combinations.map(combo => {
          const isHit = (entry.hitCombos || []).includes(combo);
          const amount = entry.amountMap?.[combo] ?? entry.unitAmount;
          const customAmt = entry.amountMap?.[combo];

          return (
            <div key={combo} style={{ padding: "8px 0", borderBottom: "1px solid #1e2a40" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* チェックボックス */}
                <button onClick={() => toggleHit(combo)}
                  style={{
                    width: 36, height: 36, borderRadius: 8, padding: 0, lineHeight: 1,
                    border: `2.5px solid ${isHit ? "#6cbc5e" : "#5a7aaa"}`,
                    background: isHit ? "#6cbc5e" : "#1a2a45",
                    color: isHit ? "#0d1117" : "#5a7aaa", fontSize: 20, fontWeight: 900,
                    cursor: "pointer", flexShrink: 0, boxShadow: isHit ? "0 0 8px #6cbc5e66" : "none",
                  }}>{isHit ? "✓" : "□"}</button>

                {/* 組み合わせ表示 */}
                <div style={{ flex: 1, fontFamily: "monospace", fontSize: 14, fontWeight: 700, letterSpacing: 1,
                  color: isHit ? "#6cbc5e" : (customAmt ? "#e8c86a" : "#e4e6eb") }}>
                  {combo}
                </div>

                {/* 金額 */}
                {showAmounts ? (
                  <AmountStepper value={amount} onChange={v => setAmount(combo, v)} compact />
                ) : (
                  <div style={{ fontSize: 11, color: customAmt ? "#e8c86a" : "#6b7a99", fontFamily: "monospace", fontWeight: 600, minWidth: 50, textAlign: "right" }}>
                    {formatYen(amount)}
                  </div>
                )}
              </div>

              {/* 的中時のみオッズ入力 */}
              {isHit && (
                <div style={{ marginTop: 8, marginLeft: 32, padding: "8px 10px", background: "#1a2a1a", borderRadius: 6, border: "1px solid #2a3a2a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: "#6cbc5e", fontWeight: 700 }}>オッズ</span>
                    {entry.oddsMap?.[combo] && (
                      <span style={{ fontSize: 11, color: "#6cbc5e", fontFamily: "monospace", fontWeight: 700 }}>
                        払戻 {formatYen(Math.floor((amount * entry.oddsMap[combo]) / 10) * 10)}
                      </span>
                    )}
                  </div>
                  <OddsStepper
                    value={entry.oddsMap?.[combo] || 0}
                    onChange={mult => {
                      const map = { ...(entry.oddsMap || {}) };
                      if (mult > 0) map[combo] = mult;
                      else delete map[combo];
                      onChange({ ...entry, oddsMap: map });
                    }}
                    oddsMode={oddsMode}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 通常モード用のチェック付きリスト ─────────────
function ManualHitChecker({ entry, onChange, oddsMode }) {
  const lines = (entry.text || "").split("\n").map(s => s.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  return <CombinationsList entry={entry} combinations={lines} onChange={onChange} oddsMode={oddsMode} />;
}

// ── 買い目エントリーカード ─────────────
function CombinationEntry({ entry, index, onChange, onDelete, betType, isOnly, allHistoryTags, oddsMode }) {
  const cfg = BET_TYPE_CONFIG[betType];
  const result = computeEntry(entry, betType);
  const modeDisabled = { wheel: cfg.slots === 1, formation: cfg.slots === 1 };
  const setMode = (mode) => { const fresh = newEntry(mode); onChange({ ...fresh, id: entry.id, unitAmount: entry.unitAmount, tags: entry.tags }); };

  const invest = result.combinations.reduce((s, c) => s + (entry.amountMap?.[c] ?? entry.unitAmount), 0);
  const payout = entryPayout(entry, betType);
  const hitCount = (entry.hitCombos || []).filter(c => result.combinations.includes(c)).length;
  const isHit = hitCount > 0;
  const missingOdds = (entry.hitCombos || []).filter(c => result.combinations.includes(c) && !entry.oddsMap?.[c]);

  return (
    <div style={{ background: isHit ? "#1a2f1e" : "#161c2e", borderRadius: 12, padding: 14, marginBottom: 10, border: isHit ? "1.5px solid #6cbc5e" : "1px solid #2a3550", transition: "all 0.15s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: isHit ? "#6cbc5e" : "#aab" }}>
          買い目 {index + 1}
          {isHit && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600 }}>✓ {hitCount}点的中</span>}
        </div>
        {!isOnly && <button onClick={onDelete} style={{ background: "none", border: "none", color: "#e05555", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>✕</button>}
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {[{ id: "manual", label: "通常" }, { id: "box", label: "ボックス" }, { id: "wheel", label: "流し" }, { id: "formation", label: "フォメ" }].map(m => (
          <button key={m.id} onClick={() => !modeDisabled[m.id] && setMode(m.id)} disabled={modeDisabled[m.id]}
            style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "1.5px solid", fontSize: 12, fontWeight: 700,
              cursor: modeDisabled[m.id] ? "not-allowed" : "pointer", opacity: modeDisabled[m.id] ? 0.35 : 1,
              background: entry.mode === m.id ? "#e8c86a" : "#1e2a40", color: entry.mode === m.id ? "#0d1117" : "#8899bb",
              borderColor: entry.mode === m.id ? "#e8c86a" : "#2a3550",
            }}>{m.label}</button>
        ))}
      </div>

      {entry.mode === "manual" && <ManualEditor entry={entry} onChange={onChange} betType={betType} />}
      {entry.mode === "box" && <BoxEditor entry={entry} onChange={onChange} betType={betType} />}
      {entry.mode === "wheel" && <WheelEditor entry={entry} onChange={onChange} betType={betType} />}
      {entry.mode === "formation" && <FormationEditor entry={entry} onChange={onChange} betType={betType} />}

      <div style={{ marginTop: 14, padding: "12px", background: "#0f1420", border: "1px solid #2a3550", borderRadius: 10 }}>
        <Label>1点のデフォルト金額</Label>
        <AmountStepper value={entry.unitAmount} onChange={v => onChange({ ...entry, unitAmount: v })} />
      </div>

      {/* 組み合わせリスト：チェック+金額+オッズ */}
      {entry.mode === "manual"
        ? <ManualHitChecker entry={entry} onChange={onChange} oddsMode={oddsMode} />
        : result.combinations.length > 0 && (
          <CombinationsList entry={entry} combinations={result.combinations} onChange={onChange} oddsMode={oddsMode} />
        )
      }

      <div style={{ marginTop: 12 }}>
        <Label>タグ（騎手・馬名など）</Label>
        <TagInputWithSuggest tags={entry.tags || []} onChange={v => onChange({ ...entry, tags: v })} allHistoryTags={allHistoryTags} placeholder="騎手名・馬名を入力..." />
      </div>

      {/* サマリー */}
      <div style={{ marginTop: 12, padding: "10px 12px", background: result.combinations.length > 0 ? "#1a2a1a" : "#2a1a1a", borderRadius: 8, border: `1px solid ${result.combinations.length > 0 ? "#2a3a2a" : "#3a2a2a"}` }}>
        {result.combinations.length > 0 ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isHit ? 6 : 0 }}>
              <span style={{ color: "#6cbc5e", fontWeight: 700, fontSize: 13 }}>{result.combinations.length}点</span>
              <span style={{ color: "#e4e6eb", fontWeight: 800, fontFamily: "monospace", fontSize: 14 }}>{formatYen(invest)}</span>
            </div>
            {isHit && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6, borderTop: "1px solid #2a3a2a" }}>
                <span style={{ color: "#6cbc5e", fontSize: 11 }}>払戻</span>
                <span style={{ color: "#6cbc5e", fontWeight: 800, fontFamily: "monospace", fontSize: 14 }}>{formatYen(payout)}</span>
              </div>
            )}
            {missingOdds.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 10, color: "#e8a838" }}>⚠ {missingOdds.length}点 オッズ未入力</div>
            )}
          </>
        ) : (
          <span style={{ color: "#e05555", fontSize: 12 }}>買い目を設定してください</span>
        )}
      </div>
    </div>
  );
}

// ── 集計 ─────────────
function SummaryCard({ title, subtitle, records }) {
  const inv = records.reduce((s, r) => s + r.investment, 0); const pay = records.reduce((s, r) => s + r.payout, 0);
  const pnl = pay - inv; const hits = records.filter(r => r.isHit).length;
  const roi = inv > 0 ? ((pay / inv) * 100).toFixed(0) : "-";
  return (
    <div style={{ background: "#161c2e", borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${pnl > 0 ? "#2a3a2a" : pnl < 0 ? "#3a2a2a" : "#2a3550"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div><div style={{ fontSize: 15, fontWeight: 800, color: "#e4e6eb", letterSpacing: 0.3 }}>{title}</div>{subtitle && <div style={{ fontSize: 10, color: "#6b7a99", marginTop: 1 }}>{subtitle}</div>}</div>
        <span style={{ color: pnl === 0 ? "#888" : pnl > 0 ? "#6cbc5e" : "#e05555", fontWeight: 800, fontFamily: "monospace", fontSize: 16 }}>{pnl > 0 ? "+" : ""}{formatYen(pnl)}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginTop: 10 }}>
        <StatMini label="件数" value={records.length + "R"} small />
        <StatMini label="投資" value={formatYen(inv)} small />
        <StatMini label="払戻" value={formatYen(pay)} color="#6cbc5e" small />
        <StatMini label="回収率" value={roi === "-" ? "-" : roi + "%"} color="#e8c86a" small />
      </div>
      <div style={{ fontSize: 10, color: "#6b7a99", marginTop: 6, textAlign: "right" }}>的中 {hits}R / {records.length}R（{records.length > 0 ? ((hits / records.length) * 100).toFixed(0) : 0}%）</div>
    </div>
  );
}

function TagStatsList({ records, emptyMsg }) {
  const map = new Map();
  records.forEach(r => { (r.tags || []).forEach(tag => { if (!map.has(tag)) map.set(tag, []); map.get(tag).push(r); }); });
  const list = [...map.entries()].map(([tag, recs]) => {
    const inv = recs.reduce((s, r) => s + r.investment, 0); const pay = recs.reduce((s, r) => s + r.payout, 0);
    return { tag, recs, inv, pay, pnl: pay - inv, hits: recs.filter(r => r.isHit).length };
  }).sort((a, b) => b.inv - a.inv);
  if (list.length === 0) return <div style={{ color: "#445", textAlign: "center", padding: "20px 0", fontSize: 12 }}>{emptyMsg}</div>;
  return list.map(({ tag, recs, inv, pay, pnl, hits }) => (
    <div key={tag} style={{ padding: "10px 0", borderBottom: "1px solid #1e2a40" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ background: "#2a3a55", color: "#b8d0ff", padding: "2px 9px", borderRadius: 10, fontSize: 12, fontWeight: 700 }}>#{tag}</span>
        <PnLText value={pnl} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, fontSize: 11 }}>
        <StatMini label="件数" value={recs.length + "R"} small />
        <StatMini label="的中率" value={recs.length > 0 ? ((hits / recs.length) * 100).toFixed(0) + "%" : "-"} color="#e8c86a" small />
        <StatMini label="投資" value={formatYen(inv)} small />
        <StatMini label="回収率" value={inv > 0 ? ((pay / inv) * 100).toFixed(0) + "%" : "-"} color="#e8c86a" small />
      </div>
    </div>
  ));
}

// ── Google Sheets 同期セクション ─────────────
function GoogleSyncSection({ records, onImport, showToast }) {
  const [synced, setSynced] = useState(!!getToken());
  const [busy, setBusy] = useState(false);
  const [remoteMeta, setRemoteMeta] = useState(null);

  const refreshMeta = async () => {
    if (!getToken()) return;
    const meta = await getRemoteMeta();
    setRemoteMeta(meta);
  };

  useEffect(() => {
    refreshMeta();
  }, []);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      const expiresAt = Date.now() + (tokenResponse.expires_in - 60) * 1000;
      saveToken(tokenResponse.access_token, expiresAt);
      setSynced(true);
      showToast("Googleにログインしました");
      refreshMeta();
    },
    onError: () => showToast("ログインに失敗しました", "#e05555"),
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
  });

  const handleLogout = () => {
    clearToken();
    setSynced(false);
    setRemoteMeta(null);
    showToast("ログアウトしました", "#888");
  };

  const handleUpload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await uploadRecords(records);
      showToast(`${r.count}件をアップロードしました`);
      refreshMeta();
    } catch (e) {
      showToast(e.message || "アップロード失敗", "#e05555");
      if (String(e.message).includes("認証")) { clearToken(); setSynced(false); }
    }
    setBusy(false);
  };

  const handleDownload = async () => {
    if (busy) return;
    if (records.length > 0 && !confirm("ローカルのデータが置き換わります。続行しますか？")) return;
    setBusy(true);
    try {
      const remote = await downloadRecords();
      if (remote.length === 0) {
        showToast("クラウドに記録がありません", "#888");
      } else {
        onImport(remote, true);
        showToast(`${remote.length}件をダウンロードしました`);
      }
    } catch (e) {
      showToast(e.message || "ダウンロード失敗", "#e05555");
      if (String(e.message).includes("認証")) { clearToken(); setSynced(false); }
    }
    setBusy(false);
  };

  return (
    <div style={{ marginBottom: 20, padding: "14px", background: "#0f1c2a", borderRadius: 10, border: "1px solid #2a4a5a" }}>
      <div style={{ fontSize: 13, color: "#88c8e8", fontWeight: 800, marginBottom: 4 }}>☁️ Google Sheets 同期</div>
      <div style={{ fontSize: 11, color: "#6b7a99", marginBottom: 12, lineHeight: 1.5 }}>
        PCとスマホでデータを共有できます。<br />
        Googleドライブに「馬券収支ノート_データ」シートを作成して保存します。
      </div>

      {!synced ? (
        <button onClick={() => login()} disabled={busy}
          style={{ width: "100%", padding: 12, borderRadius: 8, border: "1.5px solid #4287f5", background: "#1a2a55", color: "#88c8e8", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          🔐 Googleでログイン
        </button>
      ) : (
        <>
          <div style={{ fontSize: 11, color: "#6cbc5e", marginBottom: 10, fontWeight: 600 }}>✓ ログイン済み</div>
          {remoteMeta && (
            <div style={{ fontSize: 10, color: "#6b7a99", marginBottom: 10, padding: "6px 10px", background: "#0d1117", borderRadius: 6, fontFamily: "monospace" }}>
              クラウド：{remoteMeta.count}件 / {new Date(remoteMeta.savedAt).toLocaleString("ja-JP")}
            </div>
          )}
          <button onClick={handleUpload} disabled={busy || records.length === 0}
            style={{ width: "100%", padding: 11, borderRadius: 8, border: "1.5px solid #6cbc5e", background: "#1a3a1a", color: "#6cbc5e", fontSize: 13, fontWeight: 700, marginBottom: 8, cursor: busy || records.length === 0 ? "not-allowed" : "pointer", opacity: busy || records.length === 0 ? 0.5 : 1 }}>
            {busy ? "処理中..." : `↑ アップロード（ローカル ${records.length}件 → クラウド）`}
          </button>
          <button onClick={handleDownload} disabled={busy}
            style={{ width: "100%", padding: 11, borderRadius: 8, border: "1.5px solid #e8c86a", background: "#3a3015", color: "#e8c86a", fontSize: 13, fontWeight: 700, marginBottom: 8, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1 }}>
            {busy ? "処理中..." : "↓ ダウンロード（クラウド → ローカル）"}
          </button>
          <button onClick={handleLogout} disabled={busy}
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #2a3550", background: "transparent", color: "#6b7a99", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            ログアウト
          </button>
        </>
      )}
    </div>
  );
}
function DataManagerModal({ records, onClose, onImport }) {
  const [mode, setMode] = useState(null);
  const fileInputRef = useRef();
  const exportCSV = () => {
    const csv = recordsToCSV(records);
    const name = `keiba-records-${new Date().toISOString().slice(0, 10)}.csv`;
    if (!downloadFile(name, csv, "text/csv;charset=utf-8")) setMode({ type: "text", title: "CSV", content: csv });
  };
  const exportJSON = () => {
    const json = JSON.stringify({ version: 5, exportDate: new Date().toISOString(), records }, null, 2);
    const name = `keiba-backup-${new Date().toISOString().slice(0, 10)}.json`;
    if (!downloadFile(name, json, "application/json")) setMode({ type: "text", title: "JSON", content: json });
  };
  const handleFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { const data = JSON.parse(ev.target.result); const recs = data.records || data; if (!Array.isArray(recs)) throw new Error(); setMode({ type: "import-confirm", count: recs.length, records: recs }); }
      catch { alert("ファイルの読み込みに失敗しました"); }
    };
    reader.readAsText(f); e.target.value = "";
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
      <div style={{ background: "#1a2535", borderRadius: 16, padding: 20, maxWidth: 440, width: "100%", maxHeight: "90vh", overflow: "auto", border: "1px solid #2a3550" }}>
        {!mode && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#e8c86a" }}>データ管理</div>
              <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7a99", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
	　　<GoogleSyncSection records={records} onImport={onImport} showToast={alert} />	
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#6b7a99", fontWeight: 700, marginBottom: 10, letterSpacing: 0.5 }}>エクスポート</div>
              <button onClick={exportCSV} disabled={records.length === 0} style={{ width: "100%", padding: "12px", borderRadius: 8, border: "1.5px solid #3a4f7a", background: "#1e2a40", color: "#b8d0ff", fontSize: 13, fontWeight: 700, marginBottom: 8, cursor: records.length > 0 ? "pointer" : "not-allowed", opacity: records.length > 0 ? 1 : 0.5, textAlign: "left" }}>📊 CSV としてダウンロード</button>
              <button onClick={exportJSON} disabled={records.length === 0} style={{ width: "100%", padding: "12px", borderRadius: 8, border: "1.5px solid #3a4f7a", background: "#1e2a40", color: "#b8d0ff", fontSize: 13, fontWeight: 700, cursor: records.length > 0 ? "pointer" : "not-allowed", opacity: records.length > 0 ? 1 : 0.5, textAlign: "left" }}>💾 JSON バックアップ</button>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6b7a99", fontWeight: 700, marginBottom: 10, letterSpacing: 0.5 }}>インポート</div>
              <button onClick={() => fileInputRef.current?.click()} style={{ width: "100%", padding: "12px", borderRadius: 8, border: "1.5px solid #3a4f7a", background: "#1e2a40", color: "#b8d0ff", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>📥 JSON ファイルから復元</button>
              <input type="file" ref={fileInputRef} onChange={handleFile} accept=".json,application/json" style={{ display: "none" }} />
            </div>
          </>
        )}
        {mode?.type === "text" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>{mode.title}</div>
              <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: "#aab", fontSize: 16, cursor: "pointer" }}>←</button>
            </div>
            <textarea readOnly value={mode.content} style={{ ...inputStyle, height: "50vh", fontFamily: "monospace", fontSize: 11, marginBottom: 10 }} />
            <button onClick={() => { navigator.clipboard?.writeText(mode.content); alert("コピーしました"); }}
              style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "#e8c86a", color: "#0d1117", fontWeight: 800, cursor: "pointer" }}>クリップボードにコピー</button>
          </>
        )}
        {mode?.type === "import-confirm" && (
          <>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{mode.count}件のデータを読み込みました</div>
            <div style={{ color: "#aab", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>現在：{records.length}件</div>
            <button onClick={() => { onImport(mode.records, false); onClose(); }} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1.5px solid #3a4f7a", background: "#1e2a40", color: "#b8d0ff", fontSize: 13, fontWeight: 700, marginBottom: 8, cursor: "pointer" }}>マージ</button>
            <button onClick={() => { if (confirm("現在のデータはすべて削除されます")) { onImport(mode.records, true); onClose(); } }} style={{ width: "100%", padding: 12, borderRadius: 8, border: "1.5px solid #5a2a2a", background: "#3a1a1a", color: "#e05555", fontSize: 13, fontWeight: 700, marginBottom: 8, cursor: "pointer" }}>置き換え</button>
            <button onClick={() => setMode(null)} style={{ width: "100%", padding: 10, borderRadius: 8, background: "#2a3550", border: "none", color: "#e4e6eb", fontSize: 13, cursor: "pointer" }}>キャンセル</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── メインApp ─────
export default function App() {
  const [tab, setTab] = useState("input");
  const [form, setForm] = useState(initialForm);
  const [records, setRecords] = useState([]);
  const [filterYear, setFilterYear] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [dataManagerOpen, setDataManagerOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    let local = [];
    try { const v = localStorage.getItem("keiba-records-v3"); if (v) local = JSON.parse(v); } catch {}
    setRecords(local);

    if (!getToken()) return;
    downloadRecords()
      .then(remote => {
        if (!remote.length) return;
        const map = new Map(local.map(r => [r.id, r]));
        let added = 0;
        remote.forEach(r => { if (!map.has(r.id)) { map.set(r.id, r); added++; } });
        if (!added) return;
        const merged = [...map.values()].sort((a, b) => b.id - a.id);
        setRecords(merged);
        try { localStorage.setItem("keiba-records-v3", JSON.stringify(merged)); } catch {}
        setToast({ msg: `☁ ${added}件をクラウドから同期しました`, color: "#6cbc5e" });
        setTimeout(() => setToast(null), 2400);
      })
      .catch(() => {});
  }, []);

  const saveRecords = useCallback(async (next) => {
    setRecords(next);
    try { localStorage.setItem("keiba-records-v3", JSON.stringify(next)); } catch {}
  }, []);

  const syncToCloud = useCallback(async (next) => {
    if (!getToken()) return;
    try { await uploadRecords(next); }
    catch { /* ネットワークエラーは無視、手動同期で対応可 */ }
  }, []);

  const showToast = (msg, color = "#6cbc5e") => { setToast({ msg, color }); setTimeout(() => setToast(null), 2400); };
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleVenueTypeChange = (vt) => setForm(f => ({ ...f, venueType: vt, venue: "", grade: "一般", raceName: "" }));
  const handleGradeChange = (g) => setForm(f => ({ ...f, grade: g, raceName: "" }));
  const handleBetTypeChange = (t) => setForm(f => ({ ...f, betType: t, entries: [newEntry("manual")] }));
  const updateEntry = (id, next) => setForm(f => ({ ...f, entries: f.entries.map(e => e.id === id ? next : e) }));
  const addEntry = () => setForm(f => ({ ...f, entries: [...f.entries, newEntry("manual")] }));
  const deleteEntry = (id) => setForm(f => ({ ...f, entries: f.entries.filter(e => e.id !== id) }));

  const totalPoints = form.entries.reduce((s, e) => s + computeEntry(e, form.betType).combinations.length, 0);
  const totalInvestment = form.entries.reduce((s, e) => s + entryInvestment(e, form.betType), 0);
  const totalPayout = form.entries.reduce((s, e) => s + entryPayout(e, form.betType), 0);
  const totalPnl = totalPayout - totalInvestment;
  const anyHit = form.entries.some(e => {
    const combos = computeEntry(e, form.betType).combinations;
    return (e.hitCombos || []).some(c => combos.includes(c));
  });
  // 的中マーク済みでオッズ未入力の組み合わせを検出
  const missingOddsCount = form.entries.reduce((sum, e) => {
    const combos = computeEntry(e, form.betType).combinations;
    return sum + (e.hitCombos || []).filter(c => combos.includes(c) && !e.oddsMap?.[c]).length;
  }, 0);

  const allHistoryTags = useMemo(() => {
    const s = new Set();
    records.forEach(r => (r.tags || []).forEach(t => s.add(t)));
    return [...s];
  }, [records]);

  const handleSubmit = async (keepRace = false) => {
    if (!form.date) return showToast("日付を入力してください", "#e05555");
    if (totalPoints === 0) return showToast("買い目を設定してください", "#e05555");
    if (anyHit && missingOddsCount > 0) return showToast(`的中組み合わせのオッズ${missingOddsCount}点が未入力です`, "#e05555");

    const allTags = [...new Set(form.entries.flatMap(e => e.tags || []))];

    const combinationText = form.entries.map((e, i) => {
      const r = computeEntry(e, form.betType);
      if (r.combinations.length === 0) return "";
      const hitCount = (e.hitCombos || []).filter(c => r.combinations.includes(c)).length;
      const hitMark = hitCount > 0 ? ` ✓${hitCount}点的中` : "";
      const tagText = (e.tags || []).length > 0 ? `  [${e.tags.map(t => "#" + t).join(" ")}]` : "";
      const header = `◆ 買い目${i + 1}${hitMark}${tagText}\n`;
      const body = e.mode === "manual"
        ? r.combinations.map(c => {
            const isHit = (e.hitCombos || []).includes(c);
            const amt = e.amountMap?.[c] ?? e.unitAmount;
            const odds = e.oddsMap?.[c];
            const amountTag = e.amountMap?.[c] ? ` ⟨${formatYen(amt)}⟩` : "";
            const hitTag = isHit && odds ? ` ✓的中(${odds.toFixed(1)}倍)` : "";
            return `${c}${amountTag}${hitTag}`;
          }).join("\n")
        : `【${r.summary}】(${r.combinations.length}点)\n` +
          r.combinations.map(c => {
            const isHit = (e.hitCombos || []).includes(c);
            const amountTag = e.amountMap?.[c] ? ` ⟨${formatYen(e.amountMap[c])}⟩` : "";
            const hitTag = isHit && e.oddsMap?.[c] ? ` ✓的中(${e.oddsMap[c].toFixed(1)}倍)` : "";
            return `${c}${amountTag}${hitTag}`;
          }).join("\n");
      return header + body;
    }).filter(Boolean).join("\n\n");

    // 代表オッズ（最高オッズの的中）
    const allHitOdds = form.entries.flatMap(e => {
      const combos = computeEntry(e, form.betType).combinations;
      return (e.hitCombos || []).filter(c => combos.includes(c)).map(c => e.oddsMap?.[c] || 0);
    }).filter(o => o > 0);
    const repOdds = allHitOdds.length > 0 ? Math.max(...allHitOdds) : 0;

    const record = {
      id: Date.now(),
      date: form.date, venueType: form.venueType, venue: form.venue, raceNo: form.raceNo,
      grade: form.grade, raceName: form.raceName,
      betType: form.betType, combination: combinationText,
      tags: allTags,
      entries: form.entries.map(e => {
        const r = computeEntry(e, form.betType);
        const validHits = (e.hitCombos || []).filter(c => r.combinations.includes(c));
        return { mode: e.mode, summary: r.summary, count: r.combinations.length, tags: e.tags || [], hitCount: validHits.length };
      }),
      points: totalPoints, unitAmount: form.entries[0]?.unitAmount || 100,
      odds: repOdds, isHit: anyHit,
      investment: totalInvestment, payout: totalPayout, pnl: totalPnl,
    };

    const nextRecords = [record, ...records];
    await saveRecords(nextRecords);
    syncToCloud(nextRecords);
    if (keepRace) {
      setForm(keepRaceInfo(form));
      showToast(anyHit ? `的中！ ${totalPnl >= 0 ? "+" : ""}${formatYen(totalPnl)} (続けて入力)` : `外れ 記録完了 (続けて入力)`);
    } else {
      setForm(f => ({ ...initialForm, date: f.date, venueType: f.venueType, venue: f.venue, oddsMode: f.oddsMode, betType: f.betType }));
      showToast(anyHit ? `的中！ ${totalPnl >= 0 ? "+" : ""}${formatYen(totalPnl)}` : `外れ … -${formatYen(totalInvestment)}`, anyHit ? "#6cbc5e" : "#e05555");
      setTab("history");
    }
  };

  const handleImport = async (newRecords, replace) => {
    if (replace) await saveRecords(newRecords.sort((a, b) => b.id - a.id));
    else { const existing = new Map(records.map(r => [r.id, r])); newRecords.forEach(r => { if (!existing.has(r.id)) existing.set(r.id, r); }); await saveRecords([...existing.values()].sort((a, b) => b.id - a.id)); }
    showToast(`${newRecords.length}件を${replace ? "復元" : "マージ"}しました`);
  };

  const years = [...new Set(records.map(r => r.date.slice(0, 4)))].sort().reverse();
  const months = filterYear === "all" ? [] : [...new Set(records.filter(r => r.date.startsWith(filterYear)).map(r => r.date.slice(5, 7)))].sort().reverse();
  const filtered = records.filter(r => {
    if (filterYear !== "all" && !r.date.startsWith(filterYear)) return false;
    if (filterMonth !== "all" && !r.date.startsWith(`${filterYear}-${filterMonth}`)) return false;
    return true;
  });
  const tInv = filtered.reduce((s, r) => s + r.investment, 0);
  const tPay = filtered.reduce((s, r) => s + r.payout, 0);
  const tPnl = tPay - tInv;
  const hitCount = filtered.filter(r => r.isHit).length;
  const hitRate = filtered.length > 0 ? ((hitCount / filtered.length) * 100).toFixed(1) : "-";

  const groupBy = (arr, fn) => { const m = {}; arr.forEach(r => { const k = fn(r); if (!m[k]) m[k] = []; m[k].push(r); }); return Object.entries(m).sort(([a], [b]) => b.localeCompare(a)); };
  const dailyGroups = groupBy(filtered, r => r.date);
  const monthlyGroups = groupBy(filtered, r => r.date.slice(0, 7));
  const yearlyGroups = groupBy(records, r => r.date.slice(0, 4));
  const monthlyData = groupBy(records, r => r.date.slice(0, 7)).slice(0, 12);

  const venueList = form.venueType === "JRA" ? JRA_VENUES : CHIHO_VENUES;
  const showMonthFilter = viewMode === "list" || viewMode === "daily";
  const showYearFilter = viewMode !== "yearly";

  return (
    <div style={{ fontFamily: "'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif", background: "#0d1117", minHeight: "100vh", color: "#e4e6eb", maxWidth: 480, width: "100%", margin: "0 auto", paddingBottom: 80, boxSizing: "border-box" }}>
      <div style={{ background: "linear-gradient(135deg,#1a2535 0%,#0d1117 100%)", borderBottom: "1px solid #2a3550", padding: "16px 20px 12px", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🏇</span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: 1, color: "#e8c86a" }}>馬券収支ノート</div>
            <div style={{ fontSize: 11, color: "#6b7a99", marginTop: 1 }}>Keiba Tracker</div>
          </div>
        </div>
        <button onClick={() => setDataManagerOpen(true)} style={{ background: "rgba(232,200,106,0.1)", border: "1px solid #3a4f7a", color: "#e8c86a", width: 36, height: 36, borderRadius: 8, fontSize: 16, cursor: "pointer" }}>⚙</button>
      </div>

      {toast && <div style={{ position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", background: toast.color, color: "#fff", padding: "10px 20px", borderRadius: 20, fontSize: 13, fontWeight: 600, zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", whiteSpace: "nowrap" }}>{toast.msg}</div>}
      {calendarOpen && <CalendarPicker value={form.date} onChange={v => setF("date", v)} onClose={() => setCalendarOpen(false)} />}

      {tab === "input" && (
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
            <Label>日付</Label>
            <button onClick={() => setCalendarOpen(true)}
              style={{ width: "100%", padding: "12px 14px", background: "#1e2a40", border: "1px solid #2a3550", borderRadius: 8, color: "#e4e6eb", fontSize: 14, textAlign: "left", cursor: "pointer", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>{formatDate(form.date)}</span>
              <span style={{ color: "#e8c86a", fontSize: 16 }}>📅</span>
            </button>

            <Label>競馬場</Label>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {["JRA", "地方"].map(vt => (
                <button key={vt} onClick={() => handleVenueTypeChange(vt)}
                  style={{ padding: "6px 20px", borderRadius: 6, border: "1.5px solid", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    background: form.venueType === vt ? "#e8c86a" : "#1e2a40", color: form.venueType === vt ? "#0d1117" : "#99aabb",
                    borderColor: form.venueType === vt ? "#e8c86a" : "#2a3550",
                  }}>{vt}</button>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {venueList.map(v => (
                <button key={v} onClick={() => setF("venue", form.venue === v ? "" : v)}
                  style={{ padding: "4px 10px", borderRadius: 6, border: "1.5px solid", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: form.venue === v ? "#3a4f7a" : "#1e2a40", color: form.venue === v ? "#b8d0ff" : "#778899",
                    borderColor: form.venue === v ? "#5b7fbf" : "#2a3550",
                  }}>{v}</button>
              ))}
            </div>

            <Label>レース番号</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {RACE_NUMBERS.map(n => (
                <button key={n} onClick={() => setF("raceNo", form.raceNo === n ? "" : n)}
                  style={{ width: 38, height: 30, borderRadius: 6, border: "1.5px solid", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    background: form.raceNo === n ? "#3a4f7a" : "#1e2a40", color: form.raceNo === n ? "#b8d0ff" : "#778899",
                    borderColor: form.raceNo === n ? "#5b7fbf" : "#2a3550",
                  }}>{n}R</button>
              ))}
            </div>

            <Label>レースグレード</Label>
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {GRADE_OPTIONS[form.venueType].map(g => (
                <button key={g} onClick={() => handleGradeChange(g)}
                  style={{ flex: "1 1 60px", padding: "7px 6px", borderRadius: 7, border: "1.5px solid",
                    fontSize: g.length > 3 ? 11 : 13, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
                    background: form.grade === g ? (g === "一般" ? "#2a3a55" : GRADE_COLORS[g]) : "#1e2a40",
                    color: form.grade === g ? (g === "一般" ? "#b8d0ff" : "#1a1a2e") : "#778899",
                    borderColor: form.grade === g ? (g === "一般" ? "#5b7fbf" : GRADE_COLORS[g]) : "#2a3550",
                  }}>{g}</button>
              ))}
            </div>

            <Label>レース名{form.grade !== "一般" ? `（${form.grade} レース）` : "（任意）"}</Label>
            {form.grade === "一般" ? (
              <input type="text" value={form.raceName} onChange={e => setF("raceName", e.target.value)} placeholder="例：第5回中山11R" style={{ ...inputStyle, marginBottom: 0 }} />
            ) : (
              <select value={form.raceName} onChange={e => setF("raceName", e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
                <option value="">── {form.grade} レースを選択 ──</option>
                {GRADED_RACES[form.grade]?.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
          </div>

          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
            <Label>券種</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {BET_TYPES.map(t => (
                <button key={t} onClick={() => handleBetTypeChange(t)}
                  style={{ padding: "6px 11px", borderRadius: 6, border: "1.5px solid", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    background: form.betType === t ? "#e8c86a" : "#1e2a40", color: form.betType === t ? "#0d1117" : "#99aabb",
                    borderColor: form.betType === t ? "#e8c86a" : "#2a3550",
                  }}>{t}</button>
              ))}
            </div>
          </div>

          {/* オッズ入力方式 */}
          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
            <Label>オッズ入力方式</Label>
            <div style={{ display: "flex", gap: 6 }}>
              {[{ id: "multiplier", label: "倍率", sub: "例：23.4" }, { id: "per100", label: "100円払戻", sub: "例：2,340" }].map(m => (
                <button key={m.id} onClick={() => setF("oddsMode", m.id)}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 7, border: "1.5px solid", cursor: "pointer",
                    background: form.oddsMode === m.id ? "#2a3a55" : "#1e2a40", color: form.oddsMode === m.id ? "#b8d0ff" : "#778899",
                    borderColor: form.oddsMode === m.id ? "#5b7fbf" : "#2a3550",
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>{m.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, padding: "0 4px" }}>
              <div style={{ fontSize: 13, color: "#e4e6eb", fontWeight: 700 }}>買い目 <span style={{ color: "#e05555", fontSize: 11 }}>＊必須</span></div>
              <div style={{ fontSize: 12, color: "#aab" }}>合計 <span style={{ color: totalPoints > 0 ? "#e8c86a" : "#e05555", fontWeight: 800, fontSize: 14 }}>{totalPoints}</span> 点 / <span style={{ color: "#e4e6eb", fontWeight: 700, fontFamily: "monospace" }}>{formatYen(totalInvestment)}</span></div>
            </div>
            {form.entries.map((e, i) => (
              <CombinationEntry key={e.id} entry={e} index={i} betType={form.betType}
                onChange={next => updateEntry(e.id, next)} onDelete={() => deleteEntry(e.id)}
                isOnly={form.entries.length === 1}
                allHistoryTags={allHistoryTags}
                oddsMode={form.oddsMode} />
            ))}
            <button onClick={addEntry} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1.5px dashed #3a4f7a", background: "rgba(58,79,122,0.1)", color: "#8899bb", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              ＋ 買い目を追加
            </button>
          </div>

          {/* プレビュー */}
          {totalPoints > 0 && (
            <div style={{ background: "#161c2e", borderRadius: 14, padding: 16, marginBottom: 14, border: "1px solid #2a3550" }}>
              <div style={{ fontSize: 12, color: "#6b7a99", marginBottom: 10, fontWeight: 600 }}>合計プレビュー</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <StatMini label="投資額" value={formatYen(totalInvestment)} />
                <StatMini label="払戻金" value={formatYen(totalPayout)} color="#6cbc5e" />
                <StatMini label="収支" value={(totalPnl >= 0 ? "+" : "") + formatYen(totalPnl)} color={totalPnl >= 0 ? "#6cbc5e" : "#e05555"} />
              </div>
              {!anyHit && <div style={{ fontSize: 11, color: "#8899bb", marginTop: 10, textAlign: "center" }}>的中した組み合わせは ☐ をタップしてチェックしてください</div>}
              {anyHit && missingOddsCount > 0 && <div style={{ fontSize: 11, color: "#e8a838", marginTop: 10, textAlign: "center" }}>⚠ {missingOddsCount}点の的中組み合わせのオッズが未入力です</div>}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => handleSubmit(false)} style={{ flex: 2, padding: 14, borderRadius: 12, border: "none", fontSize: 15, fontWeight: 800, background: "linear-gradient(135deg,#e8c86a,#d4a830)", color: "#0d1117", cursor: "pointer", letterSpacing: 0.5 }}>
              記録して履歴へ
            </button>
            <button onClick={() => handleSubmit(true)} title="同じレースで続けて入力"
              style={{ flex: 1, padding: 14, borderRadius: 12, border: "1.5px solid #3a4f7a", fontSize: 12, fontWeight: 700, background: "transparent", color: "#b8d0ff", cursor: "pointer", lineHeight: 1.3 }}>
              記録して<br />続けて入力
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#6b7a99", textAlign: "center", marginTop: 8, marginBottom: 8, lineHeight: 1.5 }}>
            「続けて入力」は同じレース情報を残したまま買い目だけリセットします
          </div>
        </div>
      )}

      {tab === "history" && (
        <div style={{ padding: "16px 16px 0", width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", background: "#161c2e", borderRadius: 10, padding: 3, marginBottom: 12, border: "1px solid #2a3550" }}>
            {[{ id: "list", label: "一覧" }, { id: "daily", label: "日別" }, { id: "monthly", label: "月別" }, { id: "yearly", label: "年別" }].map(m => (
              <button key={m.id} onClick={() => setViewMode(m.id)}
                style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                  background: viewMode === m.id ? "#e8c86a" : "transparent", color: viewMode === m.id ? "#0d1117" : "#6b7a99",
                }}>{m.label}</button>
            ))}
          </div>
          {(showYearFilter || showMonthFilter) && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {showYearFilter && (
                <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterMonth("all"); }} style={{ ...inputStyle, flex: 1, marginBottom: 0 }}>
                  <option value="all">全期間</option>{years.map(y => <option key={y} value={y}>{y}年</option>)}
                </select>
              )}
              {showMonthFilter && filterYear !== "all" && (
                <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...inputStyle, flex: 1, marginBottom: 0 }}>
                  <option value="all">全月</option>{months.map(m => <option key={m} value={m}>{Number(m)}月</option>)}
                </select>
              )}
            </div>
          )}
          {(viewMode === "list" || viewMode === "daily") && filtered.length > 0 && (
            <div style={{ background: "#161c2e", borderRadius: 12, padding: "12px 14px", marginBottom: 14, border: "1px solid #2a3550", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
              <StatMini label="投資" value={formatYen(tInv)} small />
              <StatMini label="払戻" value={formatYen(tPay)} color="#6cbc5e" small />
              <StatMini label="収支" value={(tPnl >= 0 ? "+" : "") + formatYen(tPnl)} color={tPnl >= 0 ? "#6cbc5e" : "#e05555"} small />
              <StatMini label="的中率" value={hitRate + "%"} color="#e8c86a" small />
            </div>
          )}
          {viewMode === "list" && (filtered.length === 0 ? <EmptyState /> : filtered.map(r => <RecordCard key={r.id} record={r} onDelete={() => setDeleteTarget(r.id)} />))}
          {viewMode === "daily" && (dailyGroups.length === 0 ? <EmptyState /> : dailyGroups.map(([d, recs]) => <SummaryCard key={d} title={d.replace(/-/g, "/")} subtitle={`(${dayOfWeek(d)}曜日)`} records={recs} />))}
          {viewMode === "monthly" && (monthlyGroups.length === 0 ? <EmptyState /> : monthlyGroups.map(([ym, recs]) => { const [y, m] = ym.split("-"); return <SummaryCard key={ym} title={`${y}年 ${Number(m)}月`} records={recs} />; }))}
          {viewMode === "yearly" && (yearlyGroups.length === 0 ? <EmptyState /> : yearlyGroups.map(([y, recs]) => <SummaryCard key={y} title={`${y}年`} records={recs} />))}

          {deleteTarget && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
              <div style={{ background: "#1a2535", borderRadius: 16, padding: 24, margin: 24, border: "1px solid #2a3550" }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>この記録を削除しますか？</div>
                <div style={{ color: "#6b7a99", fontSize: 13, marginBottom: 20 }}>この操作は元に戻せません</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: 10, borderRadius: 8, background: "#2a3550", border: "none", color: "#e4e6eb", cursor: "pointer", fontWeight: 600 }}>キャンセル</button>
                  <button onClick={async () => { const next = records.filter(r => r.id !== deleteTarget); await saveRecords(next); syncToCloud(next); setDeleteTarget(null); showToast("削除しました", "#888"); }}
                    style={{ flex: 1, padding: 10, borderRadius: 8, background: "#e05555", border: "none", color: "#fff", cursor: "pointer", fontWeight: 700 }}>削除</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "stats" && (
        <div style={{ padding: "16px 16px 0", width: "100%", boxSizing: "border-box" }}>
          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
            <div style={{ fontSize: 12, color: "#6b7a99", fontWeight: 600, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>通算成績</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <BigStat label="総投資額" value={formatYen(records.reduce((s, r) => s + r.investment, 0))} />
              <BigStat label="総払戻金" value={formatYen(records.reduce((s, r) => s + r.payout, 0))} color="#6cbc5e" />
              <BigStat label="通算収支" value={(records.reduce((s, r) => s + r.pnl, 0) >= 0 ? "+" : "") + formatYen(records.reduce((s, r) => s + r.pnl, 0))} color={records.reduce((s, r) => s + r.pnl, 0) >= 0 ? "#6cbc5e" : "#e05555"} />
              <BigStat label="回収率" value={records.reduce((s, r) => s + r.investment, 0) > 0 ? ((records.reduce((s, r) => s + r.payout, 0) / records.reduce((s, r) => s + r.investment, 0)) * 100).toFixed(1) + "%" : "-"} color="#e8c86a" />
              <BigStat label="総レース数" value={records.length + "R"} />
              <BigStat label="的中率" value={records.length > 0 ? ((records.filter(r => r.isHit).length / records.length) * 100).toFixed(1) + "%" : "-"} color="#e8c86a" />
            </div>
          </div>

          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
            <div style={{ fontSize: 12, color: "#6b7a99", fontWeight: 600, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>月別成績</div>
            {monthlyData.length === 0 ? <div style={{ color: "#445", textAlign: "center", padding: "20px 0" }}>データなし</div>
              : monthlyData.map(([ym, recs]) => {
                const inv = recs.reduce((s, r) => s + r.investment, 0); const pay = recs.reduce((s, r) => s + r.payout, 0);
                const pnl = pay - inv; const hits = recs.filter(r => r.isHit).length;
                const maxAbs = Math.max(...monthlyData.map(([, x]) => Math.abs(x.reduce((s, r) => s + r.payout, 0) - x.reduce((s, r) => s + r.investment, 0))), 1);
                return (
                  <div key={ym} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: "#aab", fontWeight: 600 }}>{ym.replace("-", "年")}月</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: pnl >= 0 ? "#6cbc5e" : "#e05555" }}>{pnl >= 0 ? "+" : ""}{formatYen(pnl)}</span>
                    </div>
                    <div style={{ height: 6, background: "#1e2a40", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: (Math.abs(pnl) / maxAbs * 100) + "%", background: pnl >= 0 ? "#6cbc5e" : "#e05555", borderRadius: 3 }} />
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 5 }}>
                      <span style={{ fontSize: 11, color: "#6b7a99" }}>{recs.length}R / {hits}的中</span>
                      <span style={{ fontSize: 11, color: "#6b7a99" }}>回収率 {inv > 0 ? ((pay / inv) * 100).toFixed(0) : 0}%</span>
                    </div>
                  </div>
                );
              })}
          </div>

          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
            <div style={{ fontSize: 12, color: "#6b7a99", fontWeight: 600, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>券種別成績</div>
            {BET_TYPES.filter(bt => records.some(r => r.betType === bt)).length === 0
              ? <div style={{ color: "#445", textAlign: "center", padding: "20px 0" }}>データなし</div>
              : BET_TYPES.filter(bt => records.some(r => r.betType === bt)).map(bt => {
                const g = records.filter(r => r.betType === bt); const pnl = g.reduce((s, r) => s + r.pnl, 0);
                return (
                  <div key={bt} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e2a40" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <BetTypeBadge type={bt} /><span style={{ fontSize: 11, color: "#6b7a99" }}>{g.length}R / {g.filter(r => r.isHit).length}的中</span>
                    </div>
                    <PnLText value={pnl} />
                  </div>
                );
              })}
          </div>

          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
            <div style={{ fontSize: 12, color: "#6b7a99", fontWeight: 600, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>グレード別成績</div>
            {["G1", "G2", "G3", "Jpn1", "Jpn2", "Jpn3", "地方重賞", "一般"].filter(g => records.some(r => (r.grade || "一般") === g)).length === 0
              ? <div style={{ color: "#445", textAlign: "center", padding: "20px 0" }}>データなし</div>
              : ["G1", "G2", "G3", "Jpn1", "Jpn2", "Jpn3", "地方重賞", "一般"].filter(g => records.some(r => (r.grade || "一般") === g)).map(g => {
                const grp = records.filter(r => (r.grade || "一般") === g); const pnl = grp.reduce((s, r) => s + r.pnl, 0);
                return (
                  <div key={g} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e2a40" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {g !== "一般" ? <GradeBadge grade={g} /> : <span style={{ fontSize: 12, color: "#778", fontWeight: 600 }}>一般</span>}
                      <span style={{ fontSize: 11, color: "#6b7a99" }}>{grp.length}R / {grp.filter(r => r.isHit).length}的中</span>
                    </div>
                    <PnLText value={pnl} />
                  </div>
                );
              })}
          </div>

          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, border: "1px solid #2a3550" }}>
            <div style={{ fontSize: 12, color: "#6b7a99", fontWeight: 600, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>タグ別成績</div>
            <TagStatsList records={records} emptyMsg="タグが入力された記録がありません" />
          </div>
        </div>
      )}

      {dataManagerOpen && <DataManagerModal records={records} onClose={() => setDataManagerOpen(false)} onImport={handleImport} />}

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#0d1117", borderTop: "1px solid #2a3550", display: "flex", padding: "8px 0" }}>
        {[{ id: "input", icon: "✏️", label: "入力" }, { id: "history", icon: "📋", label: "履歴" }, { id: "stats", icon: "📊", label: "統計" }].map(item => (
          <button key={item.id} onClick={() => setTab(item.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", padding: "6px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, opacity: tab === item.id ? 1 : 0.4, transition: "opacity 0.15s" }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 10, color: tab === item.id ? "#e8c86a" : "#6b7a99", fontWeight: 600 }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RecordCard({ record: r, onDelete }) {
  const raceLabel = [r.venue, r.raceNo ? `${r.raceNo}R` : "", r.raceName].filter(Boolean).join("  ");
  const totalHitCount = (r.entries || []).reduce((s, e) => s + (e.hitCount || 0), 0);
  return (
    <div style={{ background: "#161c2e", borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${r.isHit ? "#2a3a2a" : "#2a3550"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
            <BetTypeBadge type={r.betType} />
            {r.grade && r.grade !== "一般" && <GradeBadge grade={r.grade} />}
            {r.venueType === "地方" && <span style={{ fontSize: 10, background: "#2a3550", color: "#8899bb", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>地方</span>}
          </div>
          <div style={{ fontSize: 11, color: "#6b7a99" }}>{r.date}（{dayOfWeek(r.date)}）</div>
          {raceLabel && <div style={{ fontSize: 12, color: "#aab8cc", fontWeight: 600, marginTop: 2 }}>{raceLabel}</div>}
          {(r.tags || []).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {r.tags.map(t => <span key={t} style={{ fontSize: 10, background: "#2a3a55", color: "#b8d0ff", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>#{t}</span>)}
            </div>
          )}
        </div>
        <button onClick={onDelete} style={{ background: "none", border: "none", color: "#445", cursor: "pointer", fontSize: 16, padding: "0 4px", flexShrink: 0 }}>🗑</button>
      </div>

      {r.combination && (
        <details style={{ background: "#0f1420", borderRadius: 8, padding: "8px 10px", marginBottom: 8, border: "1px solid #1e2a40" }}>
          <summary style={{ fontSize: 10, color: "#6b7a99", fontWeight: 600, cursor: "pointer", outline: "none" }}>
            買い目詳細 {totalHitCount > 0 ? `（✓${totalHitCount}点的中）` : ""}
          </summary>
          <div style={{ fontSize: 12, color: "#e4e6eb", fontFamily: "monospace", letterSpacing: 0.5, whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 6 }}>{r.combination}</div>
        </details>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
        <StatMini label="点数" value={r.points + "点"} small />
        <StatMini label="投資" value={formatYen(r.investment)} small />
        {r.isHit ? (
          <><StatMini label="払戻" value={formatYen(r.payout)} color="#6cbc5e" small />
          <StatMini label="収支" value={(r.pnl >= 0 ? "+" : "") + formatYen(r.pnl)} color={r.pnl >= 0 ? "#6cbc5e" : "#e05555"} small /></>
        ) : (
          <><StatMini label="結果" value="外れ" color="#e05555" small />
          <StatMini label="収支" value={"-" + formatYen(r.investment)} color="#e05555" small /></>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return <div style={{ textAlign: "center", padding: "60px 20px", color: "#445" }}><div style={{ fontSize: 36, marginBottom: 12 }}>📋</div><div style={{ fontSize: 14 }}>記録がありません</div></div>;
}