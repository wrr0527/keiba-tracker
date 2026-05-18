import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { uploadRecords, downloadRecords, getToken, saveToken, clearToken, getRemoteMeta, isTokenExpired } from "./googleSync";

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
const MODE_LABELS = { manual: "通常", box: "ボックス", wheel: "流し", formation: "フォーメーション", unknown: "不明" };

const ANALYSIS_RANK = { 的中: 5, 順番違い: 4, "1頭違い": 3, 軸のみ: 2, 相手のみ: 1, 完敗: 0 };
const ANALYSIS_COLORS = {
  的中: { bg: "#1a4a1a", fg: "#6cbc5e", border: "#6cbc5e" },
  順番違い: { bg: "#493c18", fg: "#e8c86a", border: "#725c24" },
  "1頭違い": { bg: "#2f3d1d", fg: "#b7d46a", border: "#4f652c" },
  軸のみ: { bg: "#1d3146", fg: "#88c0ff", border: "#3a5d82" },
  相手のみ: { bg: "#2d2848", fg: "#b6a0ff", border: "#574b88" },
  完敗: { bg: "#3a1a1a", fg: "#e05555", border: "#5a2a2a" },
};

const GRADED_RACES = {
  G1: ["フェブラリーS","高松宮記念","大阪杯","桜花賞","皐月賞","天皇賞（春）","NHKマイルC","ヴィクトリアマイル","オークス","優駿牝馬（オークス）","日本ダービー","東京優駿（日本ダービー）","安田記念","宝塚記念","スプリンターズS","秋華賞","菊花賞","天皇賞（秋）","エリザベス女王杯","マイルチャンピオンシップ","マイルCS","ジャパンC","チャンピオンズC","阪神ジュベナイルF","阪神JF","朝日杯フューチュリティS","朝日杯FS","ホープフルS","有馬記念"],
  G2: ["日経新春杯","アメリカJCC","AJCC","プロキオンS","京都記念","中山記念","チューリップ賞","フィリーズレビュー","弥生賞","弥生賞ディープインパクト記念","スプリングS","金鯱賞","阪神大賞典","日経賞","ニュージーランドT","阪神牝馬S","青葉賞","フローラS","マイラーズC","京王杯スプリングC","京王杯SC","京都新聞杯","目黒記念","札幌記念","紫苑S","セントウルS","ローズS","セントライト記念","オールカマー","神戸新聞杯","毎日王冠","京都大賞典","アイルランドT","スワンS","富士S","京王杯2歳S","アルゼンチン共和国杯","デイリー杯2歳S","東スポ杯2歳S","東京スポーツ杯2歳S","ステイヤーズS","阪神C"],
  G3: ["中山金杯","京都金杯","フェアリーS","シンザン記念","京成杯","小倉牝馬S","根岸S","シルクロードS","東京新聞杯","きさらぎ賞","クイーンC","共同通信杯","ダイヤモンドS","阪急杯","小倉大賞典","オーシャンS","中山牝馬S","フラワーC","ファルコンS","愛知杯","毎日杯","マーチS","ダービー卿チャレンジT","ダービー卿CT","チャーチルダウンズC","アーリントンC","アンタレスS","福島牝馬S","ユニコーンS","エプソムC","新潟大賞典","平安S","葵S","函館スプリントS","府中牝馬S","しらさぎS","ラジオNIKKEI賞","函館記念","北九州記念","七夕賞","小倉記念","函館2歳S","関屋記念","東海S","アイビスサマーダッシュ","アイビスSD","クイーンS","エルムS","レパードS","CBC賞","中京記念","新潟2歳S","キーンランドC","新潟記念","中京2歳S","京成杯オータムH","京成杯AH","札幌2歳S","チャレンジC","シリウスS","サウジアラビアロイヤルC","サウジアラビアRC","アルテミスS","ファンタジーS","みやこS","武蔵野S","福島記念","京都2歳S","京阪杯","鳴尾記念","中日新聞杯","カペラS","ターコイズS","東スポ杯2歳S","東京スポーツ杯2歳S","富士S"],
  Jpn1: ["川崎記念","羽田盃","かしわ記念","東京ダービー","さきたま杯","帝王賞","ジャパンダートクラシック","マイルチャンピオンシップ南部杯","JBCレディスクラシック","JBCスプリント","JBCクラシック","全日本2歳優駿","東京大賞典"],
  Jpn2: ["ダイオライト記念","京浜盃","兵庫チャンピオンシップ","名古屋グランプリ","エンプレス杯","関東オークス","不来方賞","日本テレビ盃","日本TV盃","レディスプレリュード","東京盃","浦和記念","兵庫ジュニアグランプリ","兵庫ジュニアGP"],
  Jpn3: ["ブルーバードカップ","佐賀記念","クイーン賞","雲取賞","かきつばた記念","黒船賞","兵庫女王盃","東京スプリント","スパーキングレディーカップ","スパーキングレディーC","マーキュリーカップ","マーキュリーC","クラスターカップ","クラスターC","北海道スプリントカップ","北海道スプリントC","ブリーダーズゴールドカップ","ブリーダーズGC","サマーチャンピオン","テレ玉杯オーバルスプリント","白山大賞典","マリーンカップ","マリーンC","エーデルワイス賞","JBC2歳優駿","名古屋大賞典","兵庫ゴールドトロフィー","兵庫ゴールドT"],
  地方重賞: ["帯広記念","天馬賞","川崎マイラーズ","新春賞","名古屋記念","佐賀若駒賞","ニューイヤーカップ","ゴールドスプリント","新春ペガサスカップ","コウノトリ賞","大高坂賞","報知グランプリカップ","白銀争覇","兵庫クイーンセレクション","ヒロインズカップ","花吹雪賞","金盃","梅見月杯","兵庫ウインターカップ","翔雲賞","黒潮スプリンターズカップ","ゴールドジュニア","報知オールスターカップ","黒ユリ賞","飛燕賞","スプリングカップ","白鷺賞","チャンピオンカップ","だるま夕日賞","ブルーリボンマイル","兵庫ユースカップ","たんぽぽ賞","レジーナディンヴェルノ賞","ユングフラウ賞","ポプラ賞","御厨人窟賞","ジュニアグローリー","兵庫若駒賞","イレネー記念","土佐春花賞","九州クラウン","京成盃グランドマイラーズ","フジノウェーブ記念","若草賞土古記念","ばんえい記念","ネクストスター東日本","桜花賞","マーチカップ","あやめ賞","ネクストスター西日本","白嶺賞","はがくれ大賞典","ネクストスター中日本","菊水賞","ネクストスター北日本","ル・プランタン賞","クラウンカップ","東海桜花賞","東海クイーンカップ","金沢スプリングカップ","二十四万石賞","佐賀がばいスプリント","赤松杯","ブリリアントカップ","飛山濃水杯","留守杯日高賞","ノトキリシマ賞","佐賀ヴィーナスカップ","しらさぎ賞","エトワール賞","栗駒賞","利家盃","新緑賞","東京プリンセス賞","北斗盃","ダイヤモンドカップ","黒潮皐月賞","佐賀皐月賞","駿蹄賞","兵庫大賞典","コスモバルク記念","東京湾カップ","西日本クラシック","お松の方賞","フロイラインスプリント","オグリキャップ記念","カーネーションカップ","ばんえい十勝オッズパーク杯","シアンモア記念","北日本新聞杯","佐賀スプリングカップ","大井記念","ヒダカソウカップ","のじぎく賞","イーハトーブマイル","福永洋一記念","プラチナカップ","あすなろ賞","九州優駿栄城賞","若潮スプリント","東海優駿","グランシャリオ門別スプリント","六甲盃","東北優駿","百万石賞","北海優駿","ぎふ清流カップ","北斗賞","早池峰スーパースプリント","石川優駿","佐賀王冠賞","川崎スパーキングスプリント","赤レンガ記念","園田FCスプリント","ウイナーカップ","高知優駿","栄冠賞","フロイラインカップ","トリトン争覇","兵庫優駿","柏林賞","一條記念みちのく大賞典","加賀友禅賞","佐賀ユースカップ","サファイア賞","ハヤテスプリント","金沢クイーン賞","星雲賞","兵庫サマークイーン賞","旭川記念","岩鷲賞","兼六園スプリント","いしがきマイラーズ","サンタアニタトロフィー","ノースクイーンカップ","優駿スプリント","吉野ヶ里記念","ばんえい大賞典","やまびこ賞","日本海スプリント","トレノ賞","名港盃","若鮎賞","霧島賞","リリーカップ","王冠賞","百万石かがやきナイター賞","せきれい賞","習志野きらっとスプリント","ポラリスサマースプリント","ひまわり賞(オークス)","黒潮菊花賞","旭岳賞","オパールカップ","読売レディス杯","サッポロクラシックカップ","ばんえいグランプリ","フェアリーカップ","岐阜金賞","黒潮盃","くろゆり賞","摂津盃","ジュニアグランプリ","フルールカップ","ルーキーズサマーカップ","ブリーダーズゴールドジュニアカップ","ベイスプリント","はまなす賞","岩手県知事杯OROカップ","九州チャンピオンシップ","スパーキングサマーカップ","フリオーソレジェンドカップ","撫子争覇","ビギナーズカップ","アフター5スター賞","秋桜賞","ビューチフルドリーマーカップ","サラブレッド大賞典","西日本3歳優駿","戸塚記念","若武者賞","岩見沢記念","石川テレビ杯","百万石スプリント","建依別賞","若駒賞","九州ジュニアチャンピオン","東京記念","フローラルカップ","秋の鞍","園田プリンセスカップ","青藍賞","オータムカップ","ウポポイオータムスプリント","瑞穂賞","兵庫ジュベナイルカップ","園田チャレンジカップ","銀河賞","オータムティアラ","珊瑚冠賞","イヌワシ賞","サンライズカップ","ネクストスター門別","姫山菊花賞","ヴィーナススプリント","鳥栖大賞","グランシャリオクイーンズ","園田オータムトロフィー","金沢鼓門賞","ナナカマド賞","ネクストスター盛岡","金沢シンデレラカップ","ネクストスター佐賀","鎌倉記念","ゴールド争覇","兵庫ゴールドカップ","トパーズカップ","MRO金賞","佐賀オータムスプリント","マイルグランプリ","ネクストスター笠松","東海クラウン","兵庫クイーンカップ","金沢スプリントカップ","北見記念","プリンセスカップ","ネクストスター高知","ロータスクラウン賞","ネクストスター金沢","埼玉新聞栄冠賞","ネクストスター園田","ネクストスター名古屋","ばんえい菊花賞","すずらん賞","土佐秋月賞","九州大賞典","北海道2歳スプリント","道営スプリント","平和賞","道営記念","楠賞","クインカップ","北國王冠","黒潮マイルチャンピオンシップ","カペラ賞","南部駒賞","ハイセイコー記念","ブロッサムカップ","東海菊花賞","レジェンドハンター記念","絆カップ","徽軫賞","ウインターチャンピオン","ローレル賞","ロジータ記念","ラブミーチャン記念","ドリームエイジカップ","寒菊賞","金沢ヤングチャンピオン","笠松グランプリ","園田金盃","ばんえいオークス","北上川大賞典","フォーマルハウト賞","勝島王冠","ジェムストーン賞","中日杯","九州産グランプリ","船橋記念","ゴールドウィング賞","トウケイニセイ記念","金杯","ゴールドカップ","金沢ファンセレクトカップ2025","金の鞍賞","中島記念","ヤングチャンピオンシップ","ばんえいダービー","東京シンデレラマイル","ライデンリーダー記念","桐花賞","東京2歳優駿牝馬","東海ゴールドカップ","園田ジュニアカップ","高知県知事賞"],
};

const GRADE_COLORS = { G1: "#e8c86a", G2: "#aab8d4", G3: "#c8a0d0", Jpn1: "#d4a875", Jpn2: "#a8b898", Jpn3: "#b898c0", 地方重賞: "#8090a8" };
const GRADE_OPTIONS = { JRA: ["平場", "OP", "G3", "G2", "G1"], 地方: ["平場", "OP", "地方重賞", "Jpn3", "Jpn2", "Jpn1"] };
const PURCHASE_REASONS = ["勝負", "遊び", "現地", "テレビ観戦"];
const CONFIDENCE_OPTIONS = ["A", "B", "C"];
const MISS_REASONS = ["軸飛び", "相手抜け", "3着抜け", "買い目絞りすぎ", "完全読み違い"];

const JOCKEYS = [
  // JRA トップ・主力
  "C.ルメール","川田将雅","武豊","戸崎圭太","横山武史","坂井瑠星","岩田望来","岩田康誠","松山弘平","北村友一","北村宏司",
  "福永祐一","横山和生","横山典弘","M.デムーロ","田辺裕信","三浦皇成","石橋脩","津村明秀","吉田隼人","鮫島克駿",
  "菅原明良","菊沢一樹","浜中俊","池添謙一","和田竜二","酒井学","藤岡佑介","藤岡康太","幸英明","荻野極",
  "西村淳也","今村聖奈","永野猛蔵","小沢大仁","田口貫太","河原田菜々","佐々木大輔","角田大和","角田大河","国分恭介",
  "国分優作","丸田恭介","松若風馬","古川吉洋","松田大作","森裕太朗","団野大成",
  // JRA 追加（現役・主力）
  "丸山元気","松岡正海","石川裕紀人","吉田豊","内田博幸","柴田大知","柴田善臣",
  "泉谷楓真","黛弘人","大野拓弥","丹内祐次","木幡初也","木幡巧也",
  "斎藤新","秋山稔樹","横山琉人","鮫島駿大","高倉稜","菱田裕二","原優介",
  // 外国人騎手
  "C.デムーロ","R.ムーア","W.ビュイック","J.モレイラ","D.レーン","T.マーカンド","O.マーフィー","A.アレンフルート",
  "B.ムルザバエフ","H.ドイル",
];

const HORSES = [
  // 2024〜2025 現役・話題馬
  "フォーエバーヤング","クロワデュノール","ダノンエアズロック","オメガギネス","ショウナンバシット",
  "エコロアジール","サトノシャイニング","パワーホール","ニシノスーベニア","コスモキュービック",
  // 2023〜2024 主力
  "ドウデュース","イクイノックス","リバティアイランド","ジャスティンパレス","タイトルホルダー",
  "ソールオリエンス","タスティエーラ","ジャスティンミラノ","ダノンデサイル","シンエンペラー",
  "アーバンシック","レガレイラ","ステレンボッシュ","チェルヴィニア","アスコリピチェーノ",
  "ボンドガール","ライトバック","ジャンタルマンタル","セリフォス","ソウルラッシュ",
  "ナミュール","ローシャムパーク","プログノーシス","ブローザホーン","ドゥレッツァ",
  "ベラジオオペラ","ソングライン","ナムラクレア","ママコチャ","スタニングローズ",
  // ダート主力
  "レモンポップ","ウシュバテソーロ","テーオーケインズ","クラウンプライド","ウィルソンテソーロ",
  "メイショウハリオ","ノットゥルノ","セキフウ","オメガパフューム","カフェファラオ",
  "チュウワウィザード","クリソベリル","ルヴァンスレーヴ","ドゥラエレーデ","ドンフランキー",
  // 2022〜2023 活躍馬
  "スターズオンアース","ソダシ","エフフォーリア","シュネルマイスター","グレナディアガーズ",
  "イルーシヴパンサー","アカイイト","ユーバーレーベン","ハーパー","モリアーナ","シンリョクカ",
  "サトノグランツ","ファントムシーフ","ハーツコンチェルト","スキルヴィング","ドルチェモア",
  "シャンパンカラー","ダノンタッチダウン","フリームファクシ","アスクビクターモア","ドゥラエレーデ",
  "ロマンチックウォリアー","パンサラッサ","デルマソトガケ","テーオーロイヤル","サリエラ",
  "ジャックドール","ショウナンバシット","ダービースマッシュ","クラシックノーザン","ボッケリーニ",
  // 名馬・種牡馬（馬券購入後も参照されやすい）
  "コントレイル","グランアレグリア","アーモンドアイ","クロノジェネシス","デアリングタクト",
  "フィエールマン","ワールドプレミア","グローリーヴェイズ","ラヴズオンリーユー","オーソリティ",
  "サリオス","サートゥルナーリア","ドゥラメンテ","シャフリヤール","ヴェラアズール",
  "キタサンブラック","ゴールドシップ","キセキ","ディープボンド","シルヴァーソニック",
  "レイパパレ","タマモブラックタイ","オーソクレース","ステラヴェローチェ","リバーラ",
];

// ── エントリー初期値 ─────────────────
const newEntry = (mode = "manual") => ({
  id: Math.random().toString(36).slice(2, 9),
  mode, text: "", horses: [], axisHorses: [], poolHorses: [], axisPos: "1st", columns: [[], [], []],
  unitAmount: 100, amountMap: {}, tags: [],
  hitCombos: [], // 的中した組み合わせ ["3-7-12", ...]
  oddsMap: {},   // 組み合わせ別オッズ { "3-7-12": 23.4 } 倍率で保存
  axisHorseInfo: { popularity: "", odds: "", finishOrder: "" },
});

const initialForm = {
  date: new Date().toISOString().slice(0, 10),
  venueType: "JRA", venue: "", raceNo: "", grade: "平場", raceName: "",
  betType: "三連単", entries: [newEntry("manual")],
  oddsMode: "per100", memo: "",
  result: { finishOrder: [], memo: "" },
  raceResult: { first: "", second: "", third: "" },
  review: {
    purchaseReason: "", confidence: "",
    axisPopularity: "", axisOdds: "",
    expectationMemo: "", missReason: "", reflectionMemo: "",
  },
};

const keepRaceInfo = (prev) => ({
  ...initialForm,
  date: prev.date, venueType: prev.venueType, venue: prev.venue,
  raceNo: prev.raceNo, grade: prev.grade, raceName: prev.raceName,
  oddsMode: prev.oddsMode, betType: prev.betType, memo: prev.memo,
  result: { finishOrder: [], memo: "" },
  review: { ...initialForm.review, purchaseReason: prev.review?.purchaseReason || "", confidence: prev.review?.confidence || "" },
});

// ── 組み合わせ生成（変更なし） ─────────────
function sorted(arr) { return [...arr].sort((a, b) => a - b); }

function normalizeComboText(line, betType) {
  const cfg = BET_TYPE_CONFIG[betType];
  const nums = (line.match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= cfg.max);
  if (nums.length !== cfg.slots || new Set(nums).size !== nums.length) return null;
  return (cfg.ordered ? nums : sorted(nums)).join(cfg.sep);
}

function computeManual(text, betType) {
  const result = new Set();
  (text || "").split("\n").map(s => s.trim()).filter(Boolean).forEach(line => {
    const combo = normalizeComboText(line, betType);
    if (combo) result.add(combo);
  });
  return { combinations: [...result], summary: "通常" };
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
  if (entry.mode === "manual") return computeManual(entry.text, betType);
  if (entry.mode === "box") return computeBox(entry.horses, betType);
  if (entry.mode === "wheel") return computeWheel(entry.axisHorses, entry.poolHorses, entry.axisPos, betType);
  if (entry.mode === "formation") return computeFormation(entry.columns, betType);
  return { combinations: [], summary: "" };
}

function parseCombo(combo, betType) {
  const { slots, sep } = BET_TYPE_CONFIG[betType];
  const parts = slots === 1 ? [combo] : String(combo).split(sep);
  return parts.map(v => Number(String(v).trim())).filter(n => Number.isFinite(n) && n > 0);
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const aa = sorted(a); const bb = sorted(b);
  return aa.every((v, i) => v === bb[i]);
}

function countOverlap(a, b) {
  const bs = new Set(b);
  return [...new Set(a)].filter(v => bs.has(v)).length;
}

function computeWinningCombos(finishOrder, betType) {
  const top = (finishOrder || []).map(Number).filter(n => n > 0);
  const [first, second, third] = top;
  if (!first) return [];
  switch (betType) {
    case "単勝":
    case "複勝":
      return betType === "単勝" ? [String(first)] : top.slice(0, 3).map(String);
    case "枠連":
    case "馬連":
      return first && second ? [sorted([first, second]).join("-")] : [];
    case "馬単":
      return first && second ? [`${first}→${second}`] : [];
    case "ワイド":
      return top.length >= 3
        ? [sorted([first, second]).join("-"), sorted([first, third]).join("-"), sorted([second, third]).join("-")]
        : [];
    case "三連複":
      return top.length >= 3 ? [sorted(top.slice(0, 3)).join("-")] : [];
    case "三連単":
      return top.length >= 3 ? [`${first}→${second}→${third}`] : [];
    default:
      return [];
  }
}

function getEntryFocus(entry, betType) {
  if (entry.mode === "wheel") return { axis: entry.axisHorses || [], pool: entry.poolHorses || [] };
  if (entry.mode === "formation") {
    const columns = entry.columns || [];
    return { axis: columns[0] || [], pool: [...new Set(columns.slice(1).flat())] };
  }
  if (BET_TYPE_CONFIG[betType].ordered) {
    const combos = computeEntry(entry, betType).combinations;
    const firsts = combos.map(c => parseCombo(c, betType)[0]).filter(Boolean);
    const uniqueFirsts = [...new Set(firsts)];
    if (uniqueFirsts.length === 1) {
      const all = combos.flatMap(c => parseCombo(c, betType));
      return { axis: uniqueFirsts, pool: [...new Set(all.filter(n => n !== uniqueFirsts[0]))] };
    }
  }
  return { axis: [], pool: [] };
}

function analyzeCombo(combo, betType, finishOrder, entry) {
  const winningCombos = computeWinningCombos(finishOrder, betType);
  if (winningCombos.length === 0) return null;
  if (winningCombos.includes(combo)) return { label: "的中", reason: "的中組み合わせと完全一致" };

  const cfg = BET_TYPE_CONFIG[betType];
  const predicted = parseCombo(combo, betType);
  const resultHorses = [...new Set(winningCombos.flatMap(c => parseCombo(c, betType)))];
  const overlap = countOverlap(predicted, resultHorses);
  const winningSameSet = winningCombos.some(c => sameSet(predicted, parseCombo(c, betType)));

  if (cfg.ordered && winningSameSet) return { label: "順番違い", reason: "必要な馬は合っていたが着順違い" };
  if (cfg.slots >= 2 && overlap >= Math.max(1, cfg.slots - 1)) return { label: "1頭違い", reason: `${cfg.slots}頭中${overlap}頭が一致` };

  const { axis, pool } = getEntryFocus(entry, betType);
  const axisOverlap = countOverlap(axis, resultHorses);
  const poolOverlap = countOverlap(pool, resultHorses);
  if (axis.length > 0 && axisOverlap > 0) return { label: "軸のみ", reason: "軸馬は来たが相手が足りない" };
  if (pool.length > 0 && poolOverlap > 0) return { label: "相手のみ", reason: "相手候補だけが馬券圏内" };

  return { label: "完敗", reason: overlap > 0 ? `${overlap}頭のみ一致` : "馬券圏内と噛み合わず" };
}

function bestAnalysis(analyses) {
  const valid = analyses.filter(Boolean);
  if (valid.length === 0) return null;
  return valid.reduce((best, cur) => ANALYSIS_RANK[cur.label] > ANALYSIS_RANK[best.label] ? cur : best, valid[0]);
}

function analyzeEntry(entry, betType, finishOrder) {
  const combos = computeEntry(entry, betType).combinations;
  const perCombo = Object.fromEntries(combos.map(c => [c, analyzeCombo(c, betType, finishOrder, entry)]));
  return { best: bestAnalysis(Object.values(perCombo)), perCombo };
}

function analyzeRecordEntries(entries, betType, finishOrder) {
  const entryAnalyses = (entries || []).map(e => analyzeEntry(e, betType, finishOrder).best);
  return bestAnalysis(entryAnalyses);
}

function autoMarkHits(entries, betType, finishOrder, clearWhenEmpty = false) {
  const winning = new Set(computeWinningCombos(finishOrder, betType));
  if (winning.size === 0) return clearWhenEmpty ? entries.map(e => ({ ...e, hitCombos: [] })) : entries;
  return entries.map(e => {
    const combos = computeEntry(e, betType).combinations;
    const hitCombos = combos.filter(c => winning.has(c));
    const oddsMap = Object.fromEntries(Object.entries(e.oddsMap || {}).filter(([c]) => hitCombos.includes(c)));
    return { ...e, hitCombos, oddsMap };
  });
}
function entryInvestment(entry, betType) {
  const { combinations } = computeEntry(entry, betType);
  return combinations.reduce((s, c) => s + (entry.amountMap?.[c] ?? entry.unitAmount), 0);
}
// 1エントリーの的中分の払戻合計
function entryPayout(entry) {
  return (entry.hitCombos || []).reduce((sum, c) => {
    const amt = entry.amountMap?.[c] ?? entry.unitAmount;
    const odds = entry.oddsMap?.[c] || 0;
    if (!odds) return sum;
    return sum + Math.floor((amt * odds) / 10) * 10;
  }, 0);
}

function entryStats(entry, betType) {
  const { combinations, summary } = computeEntry(entry, betType);
  const hitCombos = (entry.hitCombos || []).filter(c => combinations.includes(c));
  const investment = combinations.reduce((s, c) => s + (entry.amountMap?.[c] ?? entry.unitAmount), 0);
  const payout = hitCombos.reduce((sum, c) => {
    const amt = entry.amountMap?.[c] ?? entry.unitAmount;
    const odds = entry.oddsMap?.[c] || 0;
    return odds ? sum + Math.floor((amt * odds) / 10) * 10 : sum;
  }, 0);
  return {
    mode: entry.mode,
    summary,
    count: combinations.length,
    tags: entry.tags || [],
    hitCount: hitCombos.length,
    investment,
    payout,
    pnl: payout - investment,
    isHit: hitCombos.length > 0,
  };
}

function recordUpdatedAt(record) {
  return Date.parse(record?.updatedAt || record?.createdAt || record?.date || 0) || 0;
}

function mergeRecordsPreferLatest(localRecords, remoteRecords) {
  const map = new Map();
  [...localRecords, ...remoteRecords].forEach(record => {
    if (!record || record.id == null) return;
    const current = map.get(record.id);
    if (!current || recordUpdatedAt(record) >= recordUpdatedAt(current)) map.set(record.id, record);
  });
  return [...map.values()].sort((a, b) => recordUpdatedAt(b) - recordUpdatedAt(a));
}

function validateRecord(raw) {
  if (!raw || typeof raw !== "object") return null;
  const date = typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null;
  if (!date) return null;
  const id = raw.id ?? `${date}-${raw.raceNo || ""}-${raw.betType || ""}-${raw.combination || ""}`;
  const investment = Number(raw.investment);
  const payout = Number(raw.payout);
  const safeInvestment = Number.isFinite(investment) ? Math.max(0, investment) : 0;
  const safePayout = Number.isFinite(payout) ? Math.max(0, payout) : 0;
  return {
    ...raw,
    id,
    date,
    venueType: raw.venueType === "地方" ? "地方" : "JRA",
    venue: typeof raw.venue === "string" ? raw.venue : "",
    raceNo: raw.raceNo || "",
    grade: typeof raw.grade === "string" ? raw.grade : "一般",
    raceName: typeof raw.raceName === "string" ? raw.raceName : "",
    betType: BET_TYPES.includes(raw.betType) ? raw.betType : "三連単",
    combination: typeof raw.combination === "string" ? raw.combination : "",
    memo: typeof raw.memo === "string" ? raw.memo : "",
    tags: Array.isArray(raw.tags) ? raw.tags.filter(t => typeof t === "string") : [],
    formEntries: Array.isArray(raw.formEntries) ? raw.formEntries : undefined,
    entries: Array.isArray(raw.entries) ? raw.entries : [],
    points: Number.isFinite(Number(raw.points)) ? Math.max(0, Number(raw.points)) : 0,
    investment: safeInvestment,
    payout: safePayout,
    pnl: Number.isFinite(Number(raw.pnl)) ? Number(raw.pnl) : safePayout - safeInvestment,
    isHit: Boolean(raw.isHit),
    createdAt: raw.createdAt || new Date(`${date}T00:00:00`).toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date(`${date}T00:00:00`).toISOString(),
  };
}

function validateRecords(rawRecords) {
  if (!Array.isArray(rawRecords)) return [];
  return rawRecords.map(validateRecord).filter(Boolean);
}

function createTimestamp() {
  return new Date().toISOString();
}

function recordMatchesFilters(record, filters) {
  if (!record) return false;
  if (filters.year && filters.year !== "all" && !String(record.date || "").startsWith(filters.year)) return false;
  if (filters.month && filters.month !== "all" && !String(record.date || "").startsWith(`${filters.year}-${filters.month}`)) return false;
  if (filters.venueType && filters.venueType !== "all" && record.venueType !== filters.venueType) return false;
  if (filters.venue && filters.venue !== "all" && record.venue !== filters.venue) return false;
  if (filters.betType && filters.betType !== "all" && record.betType !== filters.betType) return false;
  if (filters.grade && filters.grade !== "all" && (record.grade || "一般") !== filters.grade) return false;
  if (filters.tag && filters.tag !== "all" && !(record.tags || []).includes(filters.tag)) return false;
  if (filters.result === "hit" && !record.isHit) return false;
  if (filters.result === "miss" && record.isHit) return false;
  if (filters.result === "plus" && Number(record.pnl) <= 0) return false;
  if (filters.result === "minus" && Number(record.pnl) >= 0) return false;
  if (filters.query) {
    const q = filters.query.trim().toLowerCase();
    const haystack = [
      record.date, record.venueType, record.venue, record.raceNo, record.grade, record.raceName,
      record.betType, record.combination, record.memo, ...(record.tags || []),
    ].join(" ").toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function summarizeRecords(records) {
  const investment = records.reduce((s, r) => s + Number(r.investment || 0), 0);
  const payout = records.reduce((s, r) => s + Number(r.payout || 0), 0);
  const hits = records.filter(r => r.isHit).length;
  return {
    count: records.length,
    investment,
    payout,
    pnl: payout - investment,
    hits,
    roi: investment > 0 ? (payout / investment) * 100 : null,
    hitRate: records.length > 0 ? (hits / records.length) * 100 : null,
    avgInvestment: records.length > 0 ? investment / records.length : 0,
    avgPayout: records.length > 0 ? payout / records.length : 0,
  };
}

function groupRecordsBy(records, keyFn) {
  const map = new Map();
  records.forEach(record => {
    const key = keyFn(record) || "未設定";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(record);
  });
  return [...map.entries()].map(([key, recs]) => ({ key, ...summarizeRecords(recs) }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
}

function entryAmountFallback(record, entry) {
  if (Number.isFinite(Number(entry?.investment))) {
    const investment = Number(entry.investment || 0);
    const payout = Number(entry.payout || 0);
    return { investment, payout, pnl: Number.isFinite(Number(entry.pnl)) ? Number(entry.pnl) : payout - investment };
  }
  if ((record.entries || []).length === 1) {
    return { investment: Number(record.investment || 0), payout: Number(record.payout || 0), pnl: Number(record.pnl || 0) };
  }
  const totalPoints = (record.entries || []).reduce((s, e) => s + Number(e.count || 0), 0) || 1;
  const ratio = Number(entry?.count || 0) / totalPoints;
  const investment = Math.round(Number(record.investment || 0) * ratio);
  const payout = Math.round(Number(record.payout || 0) * ratio);
  return { investment, payout, pnl: payout - investment };
}

function summarizeByEntryMode(records) {
  const map = new Map();
  records.forEach(record => {
    (record.entries || []).forEach(entry => {
      const key = entry.mode || "unknown";
      const amounts = entryAmountFallback(record, entry);
      const current = map.get(key) || { key, count: 0, points: 0, hits: 0, investment: 0, payout: 0, pnl: 0 };
      current.count += 1;
      current.points += Number(entry.count || 0);
      current.hits += Number(entry.hitCount || 0);
      current.investment += amounts.investment;
      current.payout += amounts.payout;
      current.pnl += amounts.pnl;
      map.set(key, current);
    });
  });
  return [...map.values()].sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
}

// ── ユーティリティ ─────────────
const formatYen = v => { const n = Number(v); return isNaN(n) ? "¥0" : "¥" + n.toLocaleString("ja-JP"); };
const dayOfWeek = s => ["日", "月", "火", "水", "木", "金", "土"][new Date(s).getDay()];
const formatDate = s => { if (!s) return ""; const d = new Date(s); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${dayOfWeek(s)}）`; };

// ── CSV / JSON ─────────────
function recordsToCSV(records) {
  const headers = ["日付","競馬場区分","競馬場","R","グレード","レース名","券種","点数","投資額","的中","判定","購入理由","自信度","軸馬人気","軸馬オッズ","外れ方","払戻金","収支","結果","結果メモ","期待値メモ","反省","買い目","タグ","メモ"];
  const esc = v => { const s = String(v ?? "").replace(/"/g, '""'); return /[,"\n]/.test(s) ? `"${s}"` : s; };
  const rows = records.map(r => [
    r.date, r.venueType || "", r.venue || "", r.raceNo || "", r.grade || "", r.raceName || "",
    r.betType, r.points, r.investment, r.isHit ? "○" : "×", r.analysis?.label || "",
    r.review?.purchaseReason || "", r.review?.confidence || "", r.review?.axisPopularity || "", r.review?.axisOdds || "", r.review?.missReason || "",
    r.payout, r.pnl, computeWinningCombos(r.result?.finishOrder || [], r.betType).join(" / "), r.result?.memo || "", r.review?.expectationMemo || "", r.review?.reflectionMemo || "", (r.combination || "").replace(/\n/g, " | "),
    (r.tags || []).join(" | "), r.memo || "",
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

function loadLocalRecords() {
  try {
    const v = localStorage.getItem("keiba-records-v3");
    return v ? JSON.parse(v) : [];
  } catch {
    return [];
  }
}

function persistLocalRecords(records) {
  try {
    localStorage.setItem("keiba-records-v3", JSON.stringify(records));
  } catch {
    // localStorage may be unavailable in private or constrained browser contexts.
  }
}

function makeRecordId() {
  return Date.now();
}

function recordRoi(record) {
  return record.investment > 0 ? (record.payout / record.investment) * 100 : 0;
}

// ── 共通スタイル ─────────────
const inputStyle = { width: "100%", background: "#1e2a40", border: "1px solid #2a3550", borderRadius: 8, color: "#e4e6eb", padding: "10px 12px", fontSize: 14, marginBottom: 14, boxSizing: "border-box", outline: "none" };

function Label({ children }) { return <div style={{ fontSize: 11, color: "#6b7a99", fontWeight: 700, marginBottom: 6, letterSpacing: 0.5 }}>{children}</div>; }
function BetTypeBadge({ type }) { const c = { 単勝: "#e8a838", 複勝: "#6cbc5e", 枠連: "#5b8fd4", 馬連: "#d46b8f", ワイド: "#8f6bd4", 馬単: "#d48c5b", 三連複: "#5bbcbc", 三連単: "#d45b5b" }; return <span style={{ background: c[type] || "#666", color: "#fff", padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap" }}>{type}</span>; }
function GradeBadge({ grade }) { if (!grade || ["一般", "平場"].includes(grade)) return null; return <span style={{ background: GRADE_COLORS[grade] || "#2a3a55", color: GRADE_COLORS[grade] ? "#1a1a2e" : "#b8d0ff", padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>{grade}</span>; }
function StatMini({ label, value, color = "#e4e6eb", small }) { return <div style={{ textAlign: "center" }}><div style={{ fontSize: small ? 10 : 11, color: "#6b7a99", marginBottom: 2 }}>{label}</div><div style={{ fontSize: small ? 11 : 13, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div></div>; }
function BigStat({ label, value, color = "#e4e6eb" }) { return <div style={{ background: "#1e2a40", borderRadius: 10, padding: "12px 14px" }}><div style={{ fontSize: 11, color: "#6b7a99", marginBottom: 4 }}>{label}</div><div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: "monospace" }}>{value}</div></div>; }
function PnLText({ value }) { return <span style={{ color: value === 0 ? "#888" : value > 0 ? "#6cbc5e" : "#e05555", fontWeight: 700, fontFamily: "monospace", fontSize: 14 }}>{value > 0 ? "+" : ""}{formatYen(value)}</span>; }
function FilterSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, marginBottom: 0, minWidth: 0, fontSize: 12, padding: "9px 10px" }}>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}
function DashboardRow({ label, stats, badge }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid #1e2a40" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          {badge}
          <span style={{ fontSize: 13, color: "#e4e6eb", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        </div>
        <PnLText value={stats.pnl} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
        <StatMini label="件数" value={(stats.count ?? 0) + "件"} small />
        <StatMini label="投資" value={formatYen(stats.investment || 0)} small />
        <StatMini label="回収率" value={stats.investment > 0 ? ((stats.payout / stats.investment) * 100).toFixed(0) + "%" : "-"} color="#e8c86a" small />
        <StatMini label="的中率" value={stats.count > 0 ? ((stats.hits / stats.count) * 100).toFixed(0) + "%" : "-"} color="#e8c86a" small />
      </div>
    </div>
  );
}

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
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select value={viewYear} onChange={e => setViewYear(Number(e.target.value))}
              style={{ background: "#1e2a40", border: "1px solid #2a3550", borderRadius: 6, color: "#e8c86a", fontSize: 15, fontWeight: 800, padding: "4px 6px", cursor: "pointer" }}>
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
            <select value={viewMonth} onChange={e => setViewMonth(Number(e.target.value))}
              style={{ background: "#1e2a40", border: "1px solid #2a3550", borderRadius: 6, color: "#e8c86a", fontSize: 15, fontWeight: 800, padding: "4px 6px", cursor: "pointer" }}>
              {Array.from({ length: 12 }, (_, i) => i).map(m => (
                <option key={m} value={m}>{m + 1}月</option>
              ))}
            </select>
          </div>
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
  const setTo = n => onChange(Math.max(0, Math.floor(n / 100) * 100));
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
  const incBtn = { flex: 1, padding: "7px 0", borderRadius: 6, border: "1px solid #3a4f7a", background: "#1e2a40", color: "#b8d0ff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "monospace" };
  const decBtn = { flex: 1, padding: "7px 0", borderRadius: 6, border: "1px solid #5a3a6a", background: "#2a1a3a", color: "#d0a0ff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "monospace" };
  const bigBtn = { width: 56, padding: "12px 0", borderRadius: 8, border: "1.5px solid #3a4f7a", background: "#2a3a55", color: "#b8d0ff", fontSize: 12, fontWeight: 800, cursor: "pointer", flexShrink: 0 };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <button onClick={() => dec(100)} style={bigBtn}>−100</button>
        <input type="number" min="0" step="100" value={val} onChange={e => setTo(Number(e.target.value))}
          style={{ flex: 1, padding: "12px 14px", background: "#1e2a40", border: "1.5px solid #2a3550", borderRadius: 8, color: "#e4e6eb", fontSize: 18, fontWeight: 700, textAlign: "center", fontFamily: "monospace" }} />
        <button onClick={() => inc(100)} style={bigBtn}>＋100</button>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        {[100, 500, 1000, 5000, 10000].map(step => (
          <button key={step} onClick={() => inc(step)} style={incBtn}>+{step >= 1000 ? `${step / 1000}k` : step}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[100, 500, 1000, 5000, 10000].map(step => (
          <button key={step} onClick={() => dec(step)} style={decBtn}>−{step >= 1000 ? `${step / 1000}k` : step}</button>
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

  // 入力中も親へ反映して、保存ボタン操作と入力確定の順番に左右されないようにする
  const [draft, setDraft] = useState(null); // null = 非編集中

  if (oddsMode === "per100") {
    const yenVal = value > 0 ? Math.round(value * 100) : 0;
    const applyYenDraft = (raw) => {
      setDraft(raw);
      const n = Number(raw);
      if (raw === "" || !Number.isFinite(n) || n <= 0) onChange(0);
      else onChange(n / 100);
    };
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
          onChange={e => applyYenDraft(e.target.value)}
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
  const applyMultDraft = (raw) => {
    setDraft(raw);
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n) || n <= 0) onChange(0);
    else onChange(n);
  };
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
        onChange={e => applyMultDraft(e.target.value)}
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
function AnalysisBadge({ label }) {
  if (!label) return null;
  const c = ANALYSIS_COLORS[label] || ANALYSIS_COLORS.完敗;
  return <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.fg, padding: "2px 7px", borderRadius: 10, fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>{label}</span>;
}

function OptionChips({ options, value, onChange, color = "#e8c86a", allowClear = true }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <button key={opt} onClick={() => onChange(active && allowClear ? "" : opt)}
            style={{ padding: "7px 11px", borderRadius: 8, border: "1.5px solid", fontSize: 12, fontWeight: 800, cursor: "pointer",
              background: active ? color : "#1e2a40", color: active ? "#0d1117" : "#8899bb",
              borderColor: active ? color : "#2a3550",
            }}>{opt}</button>
        );
      })}
    </div>
  );
}

function SearchableRaceNameInput({ value, onChange, grade }) {
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef(null);
  const options = useMemo(() => [...new Set(GRADED_RACES[grade] || [])], [grade]);
  const query = value.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (options.length === 0) return [];
    const scored = options
      .filter(name => !query || name.toLowerCase().includes(query))
      .sort((a, b) => {
        const as = a.toLowerCase().startsWith(query);
        const bs = b.toLowerCase().startsWith(query);
        if (as && !bs) return -1;
        if (!as && bs) return 1;
        return a.localeCompare(b, "ja");
      });
    return scored.slice(0, 12);
  }, [options, query]);

  useEffect(() => {
    const handler = e => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setFocused(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        placeholder={["一般", "平場"].includes(grade) ? "例：第5回中山11R" : "候補を検索、または直接入力"}
        style={{ ...inputStyle, marginBottom: 0 }}
      />
      {focused && suggestions.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#0f1420", border: "1px solid #2a3550", borderRadius: 8, maxHeight: 280, overflowY: "auto", zIndex: 30, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          {suggestions.map(name => (
            <button key={name} onClick={() => { onChange(name); setFocused(false); }}
              style={{ width: "100%", padding: "10px 12px", background: "transparent", border: "none", borderBottom: "1px solid #1e2a40", color: "#e4e6eb", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
              {name}
            </button>
          ))}
        </div>
      )}
      {!["一般", "平場"].includes(grade) && (
        <div style={{ fontSize: 10, color: "#6b7a99", marginTop: 4 }}>候補にないレース名もそのまま入力できます</div>
      )}
    </div>
  );
}

function CombinationsList({ entry, combinations, onChange, analysisPerCombo, resultDriven }) {
  const [showAmounts, setShowAmounts] = useState(false);
  const customCount = Object.keys(entry.amountMap || {}).filter(k => combinations.includes(k)).length;

  if (combinations.length === 0) return null;

  const toggleHit = (combo) => {
    if (resultDriven) return;
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

  return (
    <div style={{ marginTop: 14, background: "#0f1420", border: "1px solid #2a3550", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#aab" }}>組み合わせ ({combinations.length}点)</div>
        <button onClick={() => setShowAmounts(!showAmounts)} style={{ background: "none", border: "1px solid #3a4f7a", color: "#8899bb", fontSize: 10, fontWeight: 700, cursor: "pointer", padding: "3px 8px", borderRadius: 12 }}>
          {showAmounts ? "金額を隠す" : "金額を調整"}{customCount > 0 ? ` (${customCount})` : ""}
        </button>
      </div>

      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {combinations.map(combo => {
          const isHit = (entry.hitCombos || []).includes(combo);
          const amount = entry.amountMap?.[combo] ?? entry.unitAmount;
          const customAmt = entry.amountMap?.[combo];
          const analysis = analysisPerCombo?.[combo];

          return (
            <div key={combo} style={{ padding: "8px 0", borderBottom: "1px solid #1e2a40" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* チェックボックス */}
                <button onClick={() => toggleHit(combo)} disabled={resultDriven}
                  title={resultDriven ? "レース結果から自動判定されます" : "手動で的中を切り替え"}
                  style={{
                    width: 36, height: 36, borderRadius: 8, padding: 0, lineHeight: 1,
                    border: `2.5px solid ${isHit ? "#6cbc5e" : "#5a7aaa"}`,
                    background: isHit ? "#6cbc5e" : "#1a2a45",
                    color: isHit ? "#0d1117" : "#5a7aaa", fontSize: 20, fontWeight: 900,
                    cursor: resultDriven ? "default" : "pointer", flexShrink: 0, boxShadow: isHit ? "0 0 8px #6cbc5e66" : "none",
                    opacity: resultDriven && !isHit ? 0.55 : 1,
                  }}>{isHit ? "✓" : "□"}</button>

                {/* 組み合わせ表示 */}
                <div style={{ flex: 1, fontFamily: "monospace", fontSize: 14, fontWeight: 700, letterSpacing: 1,
                  color: isHit ? "#6cbc5e" : (customAmt ? "#e8c86a" : "#e4e6eb") }}>
                  {combo}
                </div>

                {analysis && <AnalysisBadge label={analysis.label} />}

                {/* 金額 */}
                {showAmounts ? (
                  <AmountStepper value={amount} onChange={v => setAmount(combo, v)} compact />
                ) : (
                  <div style={{ fontSize: 11, color: customAmt ? "#e8c86a" : "#6b7a99", fontFamily: "monospace", fontWeight: 600, minWidth: 50, textAlign: "right" }}>
                    {formatYen(amount)}
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 通常モード用のチェック付きリスト ─────────────
function ManualHitChecker({ entry, onChange, analysisPerCombo, resultDriven }) {
  const lines = (entry.text || "").split("\n").map(s => s.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  return <CombinationsList entry={entry} combinations={lines} onChange={onChange} analysisPerCombo={analysisPerCombo} resultDriven={resultDriven} />;
}

// ── 軸馬詳細情報 ─────────────
function AxisHorseInfoSection({ axisHorseInfo, onChange }) {
  const info = axisHorseInfo || { popularity: "", odds: "", finishOrder: "" };
  const set = (key, value) => onChange({ ...info, [key]: value });
  const hasAny = info.popularity || info.odds || info.finishOrder;
  return (
    <details style={{ marginTop: 10 }}>
      <summary style={{ color: hasAny ? "#e8c86a" : "#6b7a99", fontSize: 12, fontWeight: 800, cursor: "pointer", userSelect: "none", outline: "none" }}>
        ▶ 軸馬の詳細情報を記録（任意）{hasAny ? " ●" : ""}
      </summary>
      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 800, marginBottom: 5 }}>最終人気</div>
          <select value={info.popularity} onChange={e => set("popularity", e.target.value)}
            style={{ ...inputStyle, marginBottom: 0, textAlign: "center" }}>
            <option value="">-</option>
            {Array.from({ length: 18 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}人気</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 800, marginBottom: 5 }}>単勝オッズ</div>
          <input type="number" min="1" step="0.1" inputMode="decimal" value={info.odds}
            onChange={e => set("odds", e.target.value)} placeholder="例：5.8"
            style={{ ...inputStyle, marginBottom: 0, textAlign: "center" }} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 800, marginBottom: 5 }}>着順</div>
          <select value={info.finishOrder} onChange={e => set("finishOrder", e.target.value)}
            style={{ ...inputStyle, marginBottom: 0, textAlign: "center" }}>
            <option value="">-</option>
            {Array.from({ length: 18 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}着</option>)}
            <option value="着外">着外</option>
          </select>
        </div>
      </div>
    </details>
  );
}

// ── レース結果記録（馬番）─────────────
function RaceResultSection({ raceResult, onChange, entries, betType }) {
  const result = raceResult || { first: "", second: "", third: "" };
  const set = (key, value) => onChange({ ...result, [key]: value });
  const hasAny = result.first || result.second || result.third;

  const allBetHorses = useMemo(() => {
    const nums = new Set();
    (entries || []).forEach(e => {
      computeEntry(e, betType).combinations.forEach(c => {
        parseCombo(c, betType).forEach(n => nums.add(n));
      });
    });
    return [...nums].sort((a, b) => a - b);
  }, [entries, betType]);

  const first = Number(result.first) || null;
  const second = Number(result.second) || null;
  const third = Number(result.third) || null;

  return (
    <details style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
      <summary style={{ color: hasAny ? "#e8c86a" : "#6b7a99", fontSize: 13, fontWeight: 800, cursor: "pointer", userSelect: "none", outline: "none" }}>
        ▶ レース結果を記録（任意）{hasAny ? " ●" : ""}
      </summary>
      <div style={{ marginTop: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
          {[["first", "1着"], ["second", "2着"], ["third", "3着"]].map(([key, label]) => (
            <div key={key}>
              <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 800, marginBottom: 5 }}>{label}馬番</div>
              <select value={result[key]} onChange={e => set(key, e.target.value)}
                style={{ ...inputStyle, marginBottom: 0, textAlign: "center" }}>
                <option value="">-</option>
                {Array.from({ length: 18 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          ))}
        </div>
        {hasAny && allBetHorses.length > 0 && (
          <div style={{ background: "#0f1420", border: "1px solid #2a3550", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 700, marginBottom: 8 }}>買い目に含む馬の着順</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {allBetHorses.map(h => {
                const pos = h === first ? "1着" : h === second ? "2着" : h === third ? "3着" : null;
                return (
                  <span key={h} style={{
                    padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 800, fontFamily: "monospace",
                    background: pos ? "#1a4a1a" : "#1e2a40",
                    color: pos ? "#6cbc5e" : "#445",
                    border: `1px solid ${pos ? "#6cbc5e" : "#2a3550"}`,
                  }}>
                    {h}{pos ? `(${pos})` : ""}
                  </span>
                );
              })}
            </div>
            {(() => {
              const placed = allBetHorses.filter(h => h === first || h === second || h === third);
              return placed.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: "#6cbc5e" }}>
                  買い目馬 {allBetHorses.length}頭中 {placed.length}頭が1〜3着圏
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </details>
  );
}

// ── 買い目エントリーカード ─────────────
function CombinationEntry({ entry, index, onChange, onDelete, betType, isOnly, allHistoryTags, finishOrder }) {
  const cfg = BET_TYPE_CONFIG[betType];
  const result = computeEntry(entry, betType);
  const modeDisabled = { wheel: cfg.slots === 1, formation: cfg.slots === 1 };
  const setMode = (mode) => { const fresh = newEntry(mode); onChange({ ...fresh, id: entry.id, unitAmount: entry.unitAmount, tags: entry.tags }); };

  const invest = result.combinations.reduce((s, c) => s + (entry.amountMap?.[c] ?? entry.unitAmount), 0);
  const payout = entryPayout(entry, betType);
  const hitCount = (entry.hitCombos || []).filter(c => result.combinations.includes(c)).length;
  const isHit = hitCount > 0;
  const missingOdds = (entry.hitCombos || []).filter(c => result.combinations.includes(c) && !entry.oddsMap?.[c]);
  const entryAnalysis = analyzeEntry(entry, betType, finishOrder || []);
  const resultDriven = computeWinningCombos(finishOrder || [], betType).length > 0;

  return (
    <div style={{ background: isHit ? "#1a2f1e" : "#161c2e", borderRadius: 12, padding: 14, marginBottom: 10, border: isHit ? "1.5px solid #6cbc5e" : "1px solid #2a3550", transition: "all 0.15s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: isHit ? "#6cbc5e" : "#aab" }}>
          買い目 {index + 1}
          {isHit && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600 }}>✓ {hitCount}点的中</span>}
        </div>
        {entryAnalysis.best && <AnalysisBadge label={entryAnalysis.best.label} />}
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
        ? <ManualHitChecker entry={entry} onChange={onChange} analysisPerCombo={entryAnalysis.perCombo} resultDriven={resultDriven} />
        : result.combinations.length > 0 && (
          <CombinationsList entry={entry} combinations={result.combinations} onChange={onChange} analysisPerCombo={entryAnalysis.perCombo} resultDriven={resultDriven} />
        )
      }

      <div style={{ marginTop: 12 }}>
        <Label>タグ（騎手・馬名など）</Label>
        <TagInputWithSuggest tags={entry.tags || []} onChange={v => onChange({ ...entry, tags: v })} allHistoryTags={allHistoryTags} placeholder="騎手名・馬名を入力..." />
      </div>

      <AxisHorseInfoSection axisHorseInfo={entry.axisHorseInfo} onChange={info => onChange({ ...entry, axisHorseInfo: info })} />

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

function ResultInput({ result, betType, onChange, entries }) {
  const cfg = BET_TYPE_CONFIG[betType];
  const slots = betType === "ワイド" ? 3 : Math.min(cfg.slots === 1 ? (betType === "複勝" ? 3 : 1) : cfg.slots, 3);
  const finishOrder = result.finishOrder || [];
  const winningCombos = computeWinningCombos(finishOrder, betType);
  const analysis = analyzeRecordEntries(entries, betType, finishOrder);
  const setPlace = (idx, value) => {
    const next = [...finishOrder];
    const n = Number(value);
    if (n > 0) next[idx] = n; else next[idx] = "";
    onChange({ ...result, finishOrder: next });
  };
  const clear = () => onChange({ finishOrder: [], memo: "" });
  const labels = ["1着", "2着", "3着"].slice(0, slots);

  return (
    <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Label>レース結果</Label>
        {analysis && <AnalysisBadge label={analysis.label} />}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${labels.length},1fr)`, gap: 8, marginBottom: 10 }}>
        {labels.map((label, idx) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 800, marginBottom: 5 }}>{label}</div>
            <input type="number" min="1" max={cfg.max} inputMode="numeric" value={finishOrder[idx] || ""} onChange={e => setPlace(idx, e.target.value)}
              placeholder="馬番" style={{ ...inputStyle, marginBottom: 0, textAlign: "center", fontWeight: 800 }} />
          </div>
        ))}
      </div>
      <textarea value={result.memo || ""} onChange={e => onChange({ ...result, memo: e.target.value })} placeholder="結果メモ（例：軸は来たが相手抜け）"
        style={{ ...inputStyle, minHeight: 68, resize: "vertical", marginBottom: 10 }} />
      {winningCombos.length > 0 && (
        <div style={{ background: "#0f1420", border: "1px solid #2a3550", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#6b7a99", marginBottom: 4, fontWeight: 700 }}>実際の的中組み合わせ</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ color: "#e8c86a", fontFamily: "monospace", fontSize: 16, fontWeight: 900, letterSpacing: 1, wordBreak: "break-word" }}>{winningCombos.join(" / ")}</div>
            {analysis && <AnalysisBadge label={analysis.label} />}
          </div>
          {analysis?.reason && <div style={{ color: "#8899bb", fontSize: 11, marginTop: 5 }}>{analysis.reason}</div>}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={clear} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid #5a2a2a", background: "#2a1616", color: "#e05555", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>結果をクリア</button>
        <div style={{ flex: 2, color: "#6b7a99", fontSize: 11, lineHeight: 1.5 }}>入力すると買い目の的中チェックと判定ラベルが自動更新されます</div>
      </div>
    </div>
  );
}

function ResultOddsInput({ entries, betType, oddsMode, onChangeEntry }) {
  const rows = entries.flatMap((entry, entryIndex) => {
    const combos = computeEntry(entry, betType).combinations;
    return (entry.hitCombos || [])
      .filter(combo => combos.includes(combo))
      .map(combo => ({
        entry,
        entryIndex,
        combo,
        amount: entry.amountMap?.[combo] ?? entry.unitAmount,
        odds: entry.oddsMap?.[combo] || 0,
      }));
  });

  if (rows.length === 0) return null;

  const setOdds = (entry, combo, mult) => {
    const map = { ...(entry.oddsMap || {}) };
    if (mult > 0) map[combo] = mult;
    else delete map[combo];
    onChangeEntry(entry.id, { ...entry, oddsMap: map });
  };

  return (
    <div style={{ background: "#141f14", borderRadius: 14, padding: 18, marginBottom: 14, border: "1.5px solid #2f5a35" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: "#6cbc5e", fontWeight: 800 }}>払戻オッズ</div>
          <div style={{ fontSize: 11, color: "#7da37d", marginTop: 2 }}>的中した組み合わせだけ入力</div>
        </div>
        <AnalysisBadge label="的中" />
      </div>
      {rows.map(({ entry, entryIndex, combo, amount, odds }) => (
        <div key={`${entry.id}-${combo}`} style={{ background: "#0f1420", border: "1px solid #2a3a2a", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: "#7da37d", fontWeight: 700 }}>買い目 {entryIndex + 1}</div>
              <div style={{ fontFamily: "monospace", fontSize: 15, color: "#6cbc5e", fontWeight: 900, letterSpacing: 1 }}>{combo}</div>
            </div>
            {odds > 0 && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "#7da37d" }}>払戻</div>
                <div style={{ fontSize: 13, color: "#6cbc5e", fontFamily: "monospace", fontWeight: 900 }}>{formatYen(Math.floor((amount * odds) / 10) * 10)}</div>
              </div>
            )}
          </div>
          <OddsStepper value={odds} onChange={mult => setOdds(entry, combo, mult)} oddsMode={oddsMode} />
        </div>
      ))}
    </div>
  );
}

function PurchaseMemoSection({ review, onChange }) {
  const set = (key, value) => onChange({ ...review, [key]: value });
  return (
    <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <Label>購入メモ</Label>
        <span style={{ color: "#6b7a99", fontSize: 10, fontWeight: 700 }}>任意</span>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 800, marginBottom: 6 }}>購入理由</div>
        <OptionChips options={PURCHASE_REASONS} value={review.purchaseReason || ""} onChange={v => set("purchaseReason", v)} color="#88c0ff" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 800, marginBottom: 6 }}>自信度</div>
        <OptionChips options={CONFIDENCE_OPTIONS} value={review.confidence || ""} onChange={v => set("confidence", v)} />
      </div>
      <details>
        <summary style={{ color: "#8899bb", fontSize: 12, fontWeight: 800, cursor: "pointer", marginBottom: 10 }}>詳細を入力</summary>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "10px 0 12px" }}>
          <div>
            <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 800, marginBottom: 5 }}>軸馬人気</div>
            <input type="number" min="1" inputMode="numeric" value={review.axisPopularity || ""} onChange={e => set("axisPopularity", e.target.value)}
              placeholder="例：3" style={{ ...inputStyle, marginBottom: 0, textAlign: "center" }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 800, marginBottom: 5 }}>軸馬オッズ</div>
            <input type="number" min="0" step="0.1" inputMode="decimal" value={review.axisOdds || ""} onChange={e => set("axisOdds", e.target.value)}
              placeholder="例：5.8" style={{ ...inputStyle, marginBottom: 0, textAlign: "center" }} />
          </div>
        </div>
        <textarea value={review.expectationMemo || ""} onChange={e => set("expectationMemo", e.target.value)}
          placeholder="購入前の期待値メモ" style={{ ...inputStyle, minHeight: 64, resize: "vertical", marginBottom: 0 }} />
      </details>
    </div>
  );
}

function ReviewMemoSection({ review, isHit, onChange }) {
  const set = (key, value) => onChange({ ...review, [key]: value });
  return (
    <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <Label>振り返り</Label>
        <span style={{ color: "#6b7a99", fontSize: 10, fontWeight: 700 }}>任意</span>
      </div>
      {!isHit && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 800, marginBottom: 6 }}>外れ方</div>
          <OptionChips options={MISS_REASONS} value={review.missReason || ""} onChange={v => set("missReason", v)} color="#e8a838" />
        </div>
      )}
      <textarea value={review.reflectionMemo || ""} onChange={e => set("reflectionMemo", e.target.value)}
        placeholder="レース後の反省" style={{ ...inputStyle, minHeight: 72, resize: "vertical", marginBottom: 0 }} />
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

function ReviewStatsList({ records, field, options, emptyMsg }) {
  const list = options.map(option => {
    const recs = records.filter(r => r.review?.[field] === option);
    const inv = recs.reduce((s, r) => s + r.investment, 0);
    const pay = recs.reduce((s, r) => s + r.payout, 0);
    return { option, recs, inv, pay, pnl: pay - inv, hits: recs.filter(r => r.isHit).length };
  }).filter(x => x.recs.length > 0);
  if (list.length === 0) return <div style={{ color: "#445", textAlign: "center", padding: "20px 0", fontSize: 12 }}>{emptyMsg}</div>;
  return list.map(({ option, recs, inv, pay, pnl, hits }) => (
    <div key={option} style={{ padding: "10px 0", borderBottom: "1px solid #1e2a40" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "#b8d0ff", fontWeight: 800 }}>{option}</span>
        <PnLText value={pnl} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, fontSize: 11 }}>
        <StatMini label="件数" value={recs.length + "R"} small />
        <StatMini label="的中率" value={recs.length > 0 ? ((hits / recs.length) * 100).toFixed(0) + "%" : "-"} color="#e8c86a" small />
        <StatMini label="回収率" value={inv > 0 ? ((pay / inv) * 100).toFixed(0) + "%" : "-"} color="#e8c86a" small />
        <StatMini label="投資" value={formatYen(inv)} small />
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
    let active = true;
    if (getToken()) {
      getRemoteMeta().then(meta => { if (active) setRemoteMeta(meta); });
    }
    return () => { active = false; };
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
      const remote = validateRecords(await downloadRecords());
      const merged = mergeRecordsPreferLatest(records, remote);
      const r = await uploadRecords(merged);
      if (remote.length > 0 && merged.length !== records.length) onImport(merged, true);
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
      const safeRemote = validateRecords(remote);
      if (safeRemote.length === 0) {
        showToast("クラウドに記録がありません", "#888");
      } else {
        onImport(safeRemote, true);
        showToast(`${safeRemote.length}件をダウンロードしました`);
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
      try {
        const data = JSON.parse(ev.target.result);
        const recs = validateRecords(data.records || data);
        if (recs.length === 0) throw new Error();
        setMode({ type: "import-confirm", count: recs.length, records: recs });
      }
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
  const [records, setRecords] = useState(loadLocalRecords);
  const [viewMode, setViewMode] = useState("list");
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [dataManagerOpen, setDataManagerOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [historySort, setHistorySort] = useState({ key: "date", dir: "desc" });
  const [historyFilters, setHistoryFilters] = useState({ query: "", result: "all", betType: "all", venue: "all", grade: "all", tag: "all" });
  const [statsFilters, setStatsFilters] = useState({ year: "all", month: "all", venueType: "all", venue: "all", betType: "all", grade: "all", result: "all", tag: "all" });
  const showToast = useCallback((msg, color = "#6cbc5e") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => {
    // トークン期限切れなら再ログイン促しトーストを表示（3秒後）
    if (isTokenExpired()) {
      setTimeout(() => {
        setToast({ msg: "☁ Google セッション期限切れ — ⚙ から再ログインできます", color: "#e8a838" });
        setTimeout(() => setToast(null), 4000);
      }, 1500);
      return;
    }

    if (!getToken()) return;
    downloadRecords()
      .then(remote => {
        const safeRemote = validateRecords(remote);
        if (!safeRemote.length) return;
        setRecords(current => {
          const merged = mergeRecordsPreferLatest(current, safeRemote);
          const changed = JSON.stringify(merged) !== JSON.stringify(current);
          if (changed) {
            persistLocalRecords(merged);
            setToast({ msg: "☁ クラウドから同期しました", color: "#6cbc5e" });
            setTimeout(() => setToast(null), 2400);
          }
          return changed ? merged : current;
        });
      })
      .catch(() => {
        // Initial cloud sync is best-effort; manual sync remains available.
      });
  }, []);

  const saveRecords = useCallback(async (next) => {
    setRecords(next);
    persistLocalRecords(next);
  }, []);

  const syncToCloud = useCallback(async (next) => {
    if (!getToken()) return;
    try {
      const remote = validateRecords(await downloadRecords());
      const merged = mergeRecordsPreferLatest(next, remote);
      await uploadRecords(merged);
      if (JSON.stringify(merged) !== JSON.stringify(next)) {
        setRecords(merged);
        persistLocalRecords(merged);
      }
    }
    catch { /* ネットワークエラーは無視、手動同期で対応可 */ }
  }, []);

  const restoreFormFromRecord = useCallback((r, clearHits = false) => {
    const entries = r.formEntries
      ? r.formEntries.map(e => ({
          ...e,
          id: Math.random().toString(36).slice(2, 9),
          ...(clearHits ? { hitCombos: [], oddsMap: {} } : {}),
        }))
      : [newEntry("manual")];
    return {
      ...initialForm,
      date: r.date, venueType: r.venueType || "JRA", venue: r.venue || "",
      raceNo: r.raceNo || "", grade: r.grade || "平場", raceName: r.raceName || "",
      betType: r.betType || "三連単",
      oddsMode: form.oddsMode,
      memo: r.memo || "",
      result: clearHits ? { finishOrder: [], memo: "" } : (r.result || { finishOrder: [], memo: "" }),
      raceResult: clearHits ? { first: "", second: "", third: "" } : (r.raceResult || { first: "", second: "", third: "" }),
      review: clearHits
        ? { ...initialForm.review, purchaseReason: r.review?.purchaseReason || "", confidence: r.review?.confidence || "", axisPopularity: r.review?.axisPopularity || "", axisOdds: r.review?.axisOdds || "", expectationMemo: r.review?.expectationMemo || "" }
        : { ...initialForm.review, ...(r.review || {}) },
      entries,
    };
  }, [form.oddsMode]);

  const handleCopy = useCallback((r) => {
    setForm(restoreFormFromRecord(r, true));
    setEditingId(null);
    setTab("input");
    showToast("コピーしました。内容を確認して記録してください", "#e8c86a");
  }, [restoreFormFromRecord, showToast]);

  const handleEdit = useCallback((r) => {
    setForm(restoreFormFromRecord(r, false));
    setEditingId(r.id);
    setTab("input");
    showToast("編集モード：保存すると上書きされます", "#5b7fbf");
  }, [restoreFormFromRecord, showToast]);
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleVenueTypeChange = (vt) => setForm(f => ({ ...f, venueType: vt, venue: "", grade: "平場", raceName: "" }));
  const handleGradeChange = (g) => setForm(f => ({ ...f, grade: g, raceName: "" }));
  const handleBetTypeChange = (t) => setForm(f => ({ ...f, betType: t, entries: autoMarkHits([newEntry("manual")], t, f.result?.finishOrder || []) }));
  const updateEntry = (id, next) => setForm(f => {
    const entries = f.entries.map(e => e.id === id ? next : e);
    return { ...f, entries: autoMarkHits(entries, f.betType, f.result?.finishOrder || []) };
  });
  const addEntry = () => setForm(f => ({ ...f, entries: autoMarkHits([...f.entries, newEntry("manual")], f.betType, f.result?.finishOrder || []) }));
  const deleteEntry = (id) => setForm(f => ({ ...f, entries: f.entries.filter(e => e.id !== id) }));
  const handleResultChange = (result) => setForm(f => {
    const finishOrder = (result.finishOrder || []).map(n => Number(n) || "").filter((n, i, arr) => n || i < arr.length - 1);
    const cleanResult = { ...result, finishOrder };
    return { ...f, result: cleanResult, entries: autoMarkHits(f.entries, f.betType, finishOrder, true) };
  });
  const handleReviewChange = (review) => setForm(f => ({ ...f, review }));

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
    const recordAnalysis = analyzeRecordEntries(form.entries, form.betType, form.result?.finishOrder || []);

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
    const now = createTimestamp();
    const previous = editingId ? records.find(r => r.id === editingId) : null;

    const record = {
      id: editingId || now,
      date: form.date, venueType: form.venueType, venue: form.venue, raceNo: form.raceNo,
      grade: form.grade, raceName: form.raceName,
      betType: form.betType, combination: combinationText,
      tags: allTags,
      memo: form.memo.trim(),
      formEntries: form.entries, // 編集・コピー用にフォームデータを保存
      entries: form.entries.map(e => {
        const stats = entryStats(e, form.betType);
        const analysis = analyzeEntry(e, form.betType, form.result?.finishOrder || []).best;
        return { ...stats, analysis };
      }),
      points: totalPoints, unitAmount: form.entries[0]?.unitAmount || 100,
      odds: repOdds, isHit: anyHit,
      result: form.result || { finishOrder: [], memo: "" },
      raceResult: form.raceResult || { first: "", second: "", third: "" },
      review: form.review || initialForm.review,
      analysis: recordAnalysis,
      investment: totalInvestment, payout: totalPayout, pnl: totalPnl,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
    };

    const base = editingId ? records.filter(r => r.id !== editingId) : records;
    const nextRecords = [record, ...base];
    await saveRecords(nextRecords);
    syncToCloud(nextRecords);
    setEditingId(null);

    if (keepRace) {
      setForm(keepRaceInfo(form));
      showToast(anyHit ? `的中！ ${totalPnl >= 0 ? "+" : ""}${formatYen(totalPnl)} (続けて入力)` : `外れ 記録完了 (続けて入力)`);
    } else {
      // 日付・競馬場・券種を維持してフォームをリセット（履歴タブへは遷移しない）
      setForm(f => ({
        ...initialForm,
        date: f.date, venueType: f.venueType, venue: f.venue,
        oddsMode: f.oddsMode, betType: f.betType,
        result: { finishOrder: [], memo: "" },
        review: { ...initialForm.review },
      }));
      showToast(anyHit ? `的中！ ${totalPnl >= 0 ? "+" : ""}${formatYen(totalPnl)}` : `外れ … −${formatYen(totalInvestment)}`, anyHit ? "#6cbc5e" : "#e05555");
    }
  };

  const handleImport = async (newRecords, replace) => {
    const safeRecords = validateRecords(newRecords);
    if (safeRecords.length === 0) return showToast("読み込める記録がありません", "#e05555");
    const next = replace ? safeRecords : mergeRecordsPreferLatest(records, safeRecords);
    await saveRecords(next);
    syncToCloud(next);
    showToast(`${safeRecords.length}件を${replace ? "復元" : "マージ"}しました`);
  };

  const years = [...new Set(records.map(r => String(r.date).slice(0, 4)))].filter(Boolean).sort().reverse();
  const statsMonths = statsFilters.year === "all" ? [] : [...new Set(records.filter(r => String(r.date).startsWith(statsFilters.year)).map(r => String(r.date).slice(5, 7)))].sort().reverse();
  const allVenues = [...new Set(records.map(r => r.venue).filter(Boolean))].sort();
  const allGrades = [...new Set(records.map(r => r.grade || "平場"))].sort();
  const allTags = allHistoryTags;
  const filtered = records.filter(r => recordMatchesFilters(r, historyFilters));
  const historySummary = summarizeRecords(filtered);
  const statsRecords = records.filter(r => recordMatchesFilters(r, statsFilters));
  const statsSummary = summarizeRecords(statsRecords);
  const sortedFiltered = [...filtered].sort((a, b) => {
    const dir = historySort.dir === "asc" ? 1 : -1;
    const value = (r) => {
      if (historySort.key === "roi") return recordRoi(r);
      if (historySort.key === "pnl") return r.pnl;
      return new Date(r.date).getTime() || 0;
    };
    const diff = value(a) - value(b);
    if (diff !== 0) return diff * dir;
    return (String(a.id) > String(b.id) ? 1 : -1) * dir;
  });
  const setSortKey = (key) => setHistorySort(s => key === s.key ? { ...s, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "date" ? "desc" : "asc" });

  const groupBy = (arr, fn) => { const m = {}; arr.forEach(r => { const k = fn(r); if (!m[k]) m[k] = []; m[k].push(r); }); return Object.entries(m).sort(([a], [b]) => b.localeCompare(a)); };
  const dailyGroups = groupBy(filtered, r => r.date);
  const monthlyGroups = groupBy(filtered, r => r.date.slice(0, 7));
  const yearlyGroups = groupBy(filtered, r => r.date.slice(0, 4));
  const monthlyData = groupBy(statsRecords, r => r.date.slice(0, 7)).slice(0, 12);
  const modeStats = summarizeByEntryMode(statsRecords);
  const axisHorseEntries = statsRecords.flatMap(r =>
    (r.formEntries || [])
      .filter(e => e.axisHorseInfo?.finishOrder !== "" && e.axisHorseInfo?.finishOrder != null)
      .map(e => ({
        popularity: e.axisHorseInfo.popularity !== "" ? Number(e.axisHorseInfo.popularity) : null,
        odds: e.axisHorseInfo.odds !== "" ? Number(e.axisHorseInfo.odds) : null,
        fo: e.axisHorseInfo.finishOrder === "着外" ? 99 : Number(e.axisHorseInfo.finishOrder),
      }))
  );
  const betHorseRows = statsRecords.flatMap(r => {
    if (!r.raceResult) return [];
    const first = Number(r.raceResult.first) || null;
    const second = Number(r.raceResult.second) || null;
    const third = Number(r.raceResult.third) || null;
    if (!first && !second && !third) return [];
    const allHorses = [...new Set(
      (r.formEntries || []).flatMap(e => computeEntry(e, r.betType).combinations.flatMap(c => parseCombo(c, r.betType)))
    )];
    return allHorses.map(h => ({ isFirst: h === first, isTop2: h === first || h === second, isTop3: h === first || h === second || h === third }));
  });
  const betTypeStats = groupRecordsBy(statsRecords, r => r.betType);
  const venueStats = groupRecordsBy(statsRecords, r => r.venue || "未設定");
  const gradeStats = groupRecordsBy(statsRecords, r => r.grade || "一般");
  const tagStats = groupRecordsBy(statsRecords.flatMap(r => (r.tags || []).map(tag => ({ ...r, tag }))), r => r.tag);

  const venueList = form.venueType === "JRA" ? JRA_VENUES : CHIHO_VENUES;

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
                    background: form.grade === g ? (GRADE_COLORS[g] || "#2a3a55") : "#1e2a40",
                    color: form.grade === g ? (GRADE_COLORS[g] ? "#1a1a2e" : "#b8d0ff") : "#778899",
                    borderColor: form.grade === g ? (GRADE_COLORS[g] || "#5b7fbf") : "#2a3550",
                  }}>{g}</button>
              ))}
            </div>

            <Label>レース名{!["一般", "平場"].includes(form.grade) ? `（${form.grade} レース）` : "（任意）"}</Label>
            <SearchableRaceNameInput value={form.raceName} onChange={v => setF("raceName", v)} grade={form.grade} />
          </div>

          <PurchaseMemoSection review={form.review || initialForm.review} onChange={handleReviewChange} />

          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
            <Label>メモ</Label>
            <textarea
              value={form.memo}
              onChange={e => setF("memo", e.target.value)}
              placeholder="予想理由・反省・馬場読みなど"
              rows={3}
              style={{ ...inputStyle, minHeight: 82, resize: "vertical", lineHeight: 1.5, marginBottom: 0 }}
            />
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
                finishOrder={form.result?.finishOrder || []} />
            ))}
            <button onClick={addEntry} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1.5px dashed #3a4f7a", background: "rgba(58,79,122,0.1)", color: "#8899bb", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              ＋ 買い目を追加
            </button>
          </div>

          {totalPoints > 0 && (
            <>
              <ResultInput result={form.result || { finishOrder: [], memo: "" }} betType={form.betType} entries={form.entries} onChange={handleResultChange} />
              <ResultOddsInput entries={form.entries} betType={form.betType} oddsMode={form.oddsMode} onChangeEntry={updateEntry} />
              <RaceResultSection
                raceResult={form.raceResult}
                onChange={rr => setF("raceResult", rr)}
                entries={form.entries}
                betType={form.betType}
              />
              {computeWinningCombos(form.result?.finishOrder || [], form.betType).length > 0 && (
                <ReviewMemoSection review={form.review || initialForm.review} isHit={anyHit} onChange={handleReviewChange} />
              )}
            </>
          )}

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

          {editingId && (
            <div style={{ background: "#1a2a4a", border: "1.5px solid #5b7fbf", borderRadius: 10, padding: "10px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>✏️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#88c0ff" }}>編集モード</div>
                <div style={{ fontSize: 11, color: "#6b7a99" }}>保存すると元の記録が上書きされます</div>
              </div>
              <button onClick={() => { setEditingId(null); setForm(f => ({ ...initialForm, date: f.date, venueType: f.venueType, venue: f.venue, oddsMode: f.oddsMode, betType: f.betType, result: { finishOrder: [], memo: "" }, review: { ...initialForm.review } })); }}
                style={{ background: "none", border: "1px solid #3a4f7a", color: "#6b7a99", fontSize: 11, padding: "4px 8px", borderRadius: 6, cursor: "pointer" }}>キャンセル</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => handleSubmit(false)} style={{ flex: 2, padding: 14, borderRadius: 12, border: "none", fontSize: 15, fontWeight: 800, background: "linear-gradient(135deg,#e8c86a,#d4a830)", color: "#0d1117", cursor: "pointer", letterSpacing: 0.5 }}>
              {editingId ? "上書き保存" : "記録する"}
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
          <div style={{ background: "#161c2e", borderRadius: 12, padding: 12, marginBottom: 14, border: "1px solid #2a3550" }}>
            <input
              value={historyFilters.query}
              onChange={e => setHistoryFilters(f => ({ ...f, query: e.target.value }))}
              placeholder="レース名・買い目・タグ・メモを検索"
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <FilterSelect value={historyFilters.result} onChange={v => setHistoryFilters(f => ({ ...f, result: v }))} options={[
                { value: "all", label: "結果すべて" }, { value: "hit", label: "的中" }, { value: "miss", label: "外れ" }, { value: "plus", label: "プラス" }, { value: "minus", label: "マイナス" },
              ]} />
              <FilterSelect value={historyFilters.betType} onChange={v => setHistoryFilters(f => ({ ...f, betType: v }))} options={[{ value: "all", label: "券種すべて" }, ...BET_TYPES.map(t => ({ value: t, label: t }))]} />
              <FilterSelect value={historyFilters.venue} onChange={v => setHistoryFilters(f => ({ ...f, venue: v }))} options={[{ value: "all", label: "競馬場すべて" }, ...allVenues.map(v => ({ value: v, label: v }))]} />
              <FilterSelect value={historyFilters.grade} onChange={v => setHistoryFilters(f => ({ ...f, grade: v }))} options={[{ value: "all", label: "グレードすべて" }, ...allGrades.map(g => ({ value: g, label: g }))]} />
              <FilterSelect value={historyFilters.tag} onChange={v => setHistoryFilters(f => ({ ...f, tag: v }))} options={[{ value: "all", label: "タグすべて" }, ...allTags.map(t => ({ value: t, label: `#${t}` }))]} />
              <button onClick={() => setHistoryFilters({ query: "", result: "all", betType: "all", venue: "all", grade: "all", tag: "all" })}
                style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #2a3550", background: "#1e2a40", color: "#8899bb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                条件クリア
              </button>
            </div>
          </div>
          {(viewMode === "list" || viewMode === "daily") && filtered.length > 0 && (
            <div style={{ background: "#161c2e", borderRadius: 12, padding: "12px 14px", marginBottom: 14, border: "1px solid #2a3550", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4 }}>
              <StatMini label="投資" value={formatYen(historySummary.investment)} small />
              <StatMini label="払戻" value={formatYen(historySummary.payout)} color="#6cbc5e" small />
              <StatMini label="収支" value={(historySummary.pnl >= 0 ? "+" : "") + formatYen(historySummary.pnl)} color={historySummary.pnl >= 0 ? "#6cbc5e" : "#e05555"} small />
              <StatMini label="回収率" value={historySummary.roi !== null ? historySummary.roi.toFixed(1) + "%" : "-"} color="#e8c86a" small />
              <StatMini label="的中率" value={historySummary.hitRate !== null ? historySummary.hitRate.toFixed(1) + "%" : "-"} color="#e8c86a" small />
            </div>
          )}
          {viewMode === "list" && filtered.length > 0 && (
            <div style={{ background: "#161c2e", borderRadius: 12, padding: 10, marginBottom: 14, border: "1px solid #2a3550" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                {[{ key: "date", label: "日付" }, { key: "roi", label: "回収率" }, { key: "pnl", label: "収支" }].map(item => (
                  <button key={item.key} onClick={() => setSortKey(item.key)}
                    style={{ padding: "8px 4px", borderRadius: 8, border: "1.5px solid", cursor: "pointer", fontSize: 12, fontWeight: 800,
                      background: historySort.key === item.key ? "#e8c86a" : "#1e2a40",
                      color: historySort.key === item.key ? "#0d1117" : "#8899bb",
                      borderColor: historySort.key === item.key ? "#e8c86a" : "#2a3550",
                    }}>
                    {item.label} {historySort.key === item.key ? (historySort.dir === "asc" ? "↑" : "↓") : ""}
                  </button>
                ))}
              </div>
            </div>
          )}
          {viewMode === "list" && (filtered.length === 0 ? <EmptyState /> : sortedFiltered.map(r => <RecordCard key={r.id} record={r} onDelete={() => setDeleteTarget(r.id)} onEdit={() => handleEdit(r)} onCopy={() => handleCopy(r)} />))}
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
          <div style={{ background: "#161c2e", borderRadius: 12, padding: 12, marginBottom: 14, border: "1px solid #2a3550" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <FilterSelect value={statsFilters.year} onChange={v => setStatsFilters(f => ({ ...f, year: v, month: "all" }))} options={[{ value: "all", label: "全期間" }, ...years.map(y => ({ value: y, label: `${y}年` }))]} />
              <FilterSelect value={statsFilters.month} onChange={v => setStatsFilters(f => ({ ...f, month: v }))} options={[{ value: "all", label: "全月" }, ...statsMonths.map(m => ({ value: m, label: `${Number(m)}月` }))]} />
              <FilterSelect value={statsFilters.venueType} onChange={v => setStatsFilters(f => ({ ...f, venueType: v, venue: "all" }))} options={[{ value: "all", label: "区分すべて" }, { value: "JRA", label: "JRA" }, { value: "地方", label: "地方" }]} />
              <FilterSelect value={statsFilters.venue} onChange={v => setStatsFilters(f => ({ ...f, venue: v }))} options={[{ value: "all", label: "競馬場すべて" }, ...allVenues.map(v => ({ value: v, label: v }))]} />
              <FilterSelect value={statsFilters.betType} onChange={v => setStatsFilters(f => ({ ...f, betType: v }))} options={[{ value: "all", label: "券種すべて" }, ...BET_TYPES.map(t => ({ value: t, label: t }))]} />
              <FilterSelect value={statsFilters.grade} onChange={v => setStatsFilters(f => ({ ...f, grade: v }))} options={[{ value: "all", label: "グレードすべて" }, ...allGrades.map(g => ({ value: g, label: g }))]} />
              <FilterSelect value={statsFilters.result} onChange={v => setStatsFilters(f => ({ ...f, result: v }))} options={[
                { value: "all", label: "結果すべて" }, { value: "hit", label: "的中" }, { value: "miss", label: "外れ" }, { value: "plus", label: "プラス" }, { value: "minus", label: "マイナス" },
              ]} />
              <FilterSelect value={statsFilters.tag} onChange={v => setStatsFilters(f => ({ ...f, tag: v }))} options={[{ value: "all", label: "タグすべて" }, ...allTags.map(t => ({ value: t, label: `#${t}` }))]} />
            </div>
            <button onClick={() => setStatsFilters({ year: "all", month: "all", venueType: "all", venue: "all", betType: "all", grade: "all", result: "all", tag: "all" })}
              style={{ width: "100%", marginTop: 8, padding: "9px 10px", borderRadius: 8, border: "1px solid #2a3550", background: "#1e2a40", color: "#8899bb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              条件クリア
            </button>
          </div>

          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
            <div style={{ fontSize: 12, color: "#6b7a99", fontWeight: 600, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>集計成績</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <BigStat label="総投資額" value={formatYen(statsSummary.investment)} />
              <BigStat label="総払戻金" value={formatYen(statsSummary.payout)} color="#6cbc5e" />
              <BigStat label="通算収支" value={(statsSummary.pnl >= 0 ? "+" : "") + formatYen(statsSummary.pnl)} color={statsSummary.pnl >= 0 ? "#6cbc5e" : "#e05555"} />
              <BigStat label="回収率" value={statsSummary.roi !== null ? statsSummary.roi.toFixed(1) + "%" : "-"} color="#e8c86a" />
              <BigStat label="総レース数" value={statsSummary.count + "R"} />
              <BigStat label="的中率" value={statsSummary.hitRate !== null ? statsSummary.hitRate.toFixed(1) + "%" : "-"} color="#e8c86a" />
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
            {betTypeStats.length === 0
              ? <div style={{ color: "#445", textAlign: "center", padding: "20px 0" }}>データなし</div>
              : betTypeStats.map(row => <DashboardRow key={row.key} label={row.key} stats={row} badge={<BetTypeBadge type={row.key} />} />)}
          </div>

          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
            <div style={{ fontSize: 12, color: "#6b7a99", fontWeight: 600, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>買い方別成績</div>
            {modeStats.length === 0
              ? <div style={{ color: "#445", textAlign: "center", padding: "20px 0" }}>データなし</div>
              : modeStats.map(row => (
                <DashboardRow
                  key={row.key}
                  label={MODE_LABELS[row.key] || row.key}
                  stats={{ ...row, count: row.points || row.count }}
                  badge={<span style={{ fontSize: 11, background: "#2a3a55", color: "#b8d0ff", padding: "2px 7px", borderRadius: 4, fontWeight: 800 }}>{MODE_LABELS[row.key] || row.key}</span>}
                />
              ))}
          </div>

          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
            <div style={{ fontSize: 12, color: "#6b7a99", fontWeight: 600, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>競馬場別成績</div>
            {venueStats.length === 0
              ? <div style={{ color: "#445", textAlign: "center", padding: "20px 0" }}>データなし</div>
              : venueStats.map(row => <DashboardRow key={row.key} label={row.key} stats={row} />)}
          </div>

          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
            <div style={{ fontSize: 12, color: "#6b7a99", fontWeight: 600, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>購入理由別成績</div>
            <ReviewStatsList records={records} field="purchaseReason" options={PURCHASE_REASONS} emptyMsg="購入理由が入力された記録がありません" />
          </div>

          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
            <div style={{ fontSize: 12, color: "#6b7a99", fontWeight: 600, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>自信度別成績</div>
            <ReviewStatsList records={records} field="confidence" options={CONFIDENCE_OPTIONS} emptyMsg="自信度が入力された記録がありません" />
          </div>

          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
            <div style={{ fontSize: 12, color: "#6b7a99", fontWeight: 600, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>外れ方別成績</div>
            <ReviewStatsList records={records.filter(r => !r.isHit)} field="missReason" options={MISS_REASONS} emptyMsg="外れ方が入力された記録がありません" />
          </div>

          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
            <div style={{ fontSize: 12, color: "#6b7a99", fontWeight: 600, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>グレード別成績</div>
            {gradeStats.length === 0
              ? <div style={{ color: "#445", textAlign: "center", padding: "20px 0" }}>データなし</div>
              : gradeStats.map(row => <DashboardRow key={row.key} label={row.key} stats={row} badge={!["一般", "平場", "OP"].includes(row.key) ? <GradeBadge grade={row.key} /> : undefined} />)}
          </div>

          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #2a3550" }}>
            <div style={{ fontSize: 12, color: "#6b7a99", fontWeight: 600, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>タグ別成績</div>
            {tagStats.length === 0
              ? <div style={{ color: "#445", textAlign: "center", padding: "20px 0", fontSize: 12 }}>タグが入力された記録がありません</div>
              : tagStats.map(row => <DashboardRow key={row.key} label={`#${row.key}`} stats={row} />)}
          </div>

          <div style={{ background: "#161c2e", borderRadius: 14, padding: 18, border: "1px solid #2a3550" }}>
            <div style={{ fontSize: 12, color: "#6b7a99", fontWeight: 600, marginBottom: 16, letterSpacing: 1, textTransform: "uppercase" }}>馬の成績</div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "#b8d0ff", fontWeight: 700, marginBottom: 10 }}>軸馬の成績</div>
              {axisHorseEntries.length === 0 ? (
                <div style={{ color: "#445", fontSize: 12 }}>軸馬の着順が入力された記録がありません</div>
              ) : (() => {
                const total = axisHorseEntries.length;
                const pct = (n, d) => d > 0 ? (n / d * 100).toFixed(1) + "%" : "-";
                const popBands = [
                  { label: "1人気", f: d => d.popularity === 1 },
                  { label: "2人気", f: d => d.popularity === 2 },
                  { label: "3人気", f: d => d.popularity === 3 },
                  { label: "4-6人気", f: d => d.popularity >= 4 && d.popularity <= 6 },
                  { label: "7人気以上", f: d => d.popularity >= 7 },
                ];
                const oddsBands = [
                  { label: "〜2.9倍", f: d => d.odds !== null && d.odds < 3 },
                  { label: "3〜5.9倍", f: d => d.odds !== null && d.odds >= 3 && d.odds < 6 },
                  { label: "6〜9.9倍", f: d => d.odds !== null && d.odds >= 6 && d.odds < 10 },
                  { label: "10〜19倍", f: d => d.odds !== null && d.odds >= 10 && d.odds < 20 },
                  { label: "20倍以上", f: d => d.odds !== null && d.odds >= 20 },
                ];
                const row = (band) => ({
                  n: band.length,
                  w: pct(band.filter(d => d.fo === 1).length, band.length),
                  r: pct(band.filter(d => d.fo <= 2).length, band.length),
                  f: pct(band.filter(d => d.fo <= 3).length, band.length),
                });
                const overall = row(axisHorseEntries);
                return (
                  <>
                    <div style={{ background: "#0f1420", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                        <StatMini label="サンプル" value={total + "件"} small />
                        <StatMini label="勝率" value={overall.w} color="#e8c86a" small />
                        <StatMini label="連対率" value={overall.r} color="#e8c86a" small />
                        <StatMini label="複勝率" value={overall.f} color="#e8c86a" small />
                      </div>
                    </div>
                    {axisHorseEntries.some(d => d.popularity !== null) && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 700, marginBottom: 6 }}>人気帯別</div>
                        {popBands.map(({ label, f }) => {
                          const band = axisHorseEntries.filter(d => d.popularity !== null && f(d));
                          if (band.length === 0) return null;
                          const r = row(band);
                          return (
                            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #1e2a40" }}>
                              <span style={{ fontSize: 11, color: "#aab", minWidth: 55 }}>{label}</span>
                              <span style={{ fontSize: 10, color: "#6b7a99", minWidth: 28 }}>{band.length}件</span>
                              <span style={{ fontSize: 11, color: "#e8c86a" }}>勝{r.w}</span>
                              <span style={{ fontSize: 11, color: "#e8c86a" }}>連{r.r}</span>
                              <span style={{ fontSize: 11, color: "#e8c86a" }}>複{r.f}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {axisHorseEntries.some(d => d.odds !== null) && (
                      <div>
                        <div style={{ fontSize: 10, color: "#6b7a99", fontWeight: 700, marginBottom: 6 }}>オッズ帯別</div>
                        {oddsBands.map(({ label, f }) => {
                          const band = axisHorseEntries.filter(f);
                          if (band.length === 0) return null;
                          const r = row(band);
                          return (
                            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #1e2a40" }}>
                              <span style={{ fontSize: 11, color: "#aab", minWidth: 55 }}>{label}</span>
                              <span style={{ fontSize: 10, color: "#6b7a99", minWidth: 28 }}>{band.length}件</span>
                              <span style={{ fontSize: 11, color: "#e8c86a" }}>勝{r.w}</span>
                              <span style={{ fontSize: 11, color: "#e8c86a" }}>連{r.r}</span>
                              <span style={{ fontSize: 11, color: "#e8c86a" }}>複{r.f}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div>
              <div style={{ fontSize: 12, color: "#b8d0ff", fontWeight: 700, marginBottom: 10 }}>買い目の馬の成績</div>
              {betHorseRows.length === 0 ? (
                <div style={{ color: "#445", fontSize: 12 }}>レース結果（馬番）が入力された記録がありません</div>
              ) : (() => {
                const total = betHorseRows.length;
                const pct = (n, d) => d > 0 ? (n / d * 100).toFixed(1) + "%" : "-";
                return (
                  <div style={{ background: "#0f1420", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                      <StatMini label="延べ頭数" value={total + "頭"} small />
                      <StatMini label="勝率" value={pct(betHorseRows.filter(d => d.isFirst).length, total)} color="#e8c86a" small />
                      <StatMini label="連対率" value={pct(betHorseRows.filter(d => d.isTop2).length, total)} color="#e8c86a" small />
                      <StatMini label="複勝率" value={pct(betHorseRows.filter(d => d.isTop3).length, total)} color="#e8c86a" small />
                    </div>
                  </div>
                );
              })()}
            </div>
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

function RecordCard({ record: r, onDelete, onEdit, onCopy }) {
  const raceLabel = [r.venue, r.raceNo ? `${r.raceNo}R` : "", r.raceName].filter(Boolean).join("  ");
  const totalHitCount = (r.entries || []).reduce((s, e) => s + (e.hitCount || 0), 0);
  const analysis = r.analysis || analyzeRecordEntries(r.formEntries || [], r.betType, r.result?.finishOrder || []);
  const winningCombos = computeWinningCombos(r.result?.finishOrder || [], r.betType);
  const roi = r.investment > 0 ? recordRoi(r).toFixed(0) + "%" : "-";
  const iconBtn = { background: "none", border: "none", color: "#445", cursor: "pointer", fontSize: 16, padding: "0 4px", flexShrink: 0 };
  return (
    <div style={{ background: r.isHit ? "#141f14" : "#161c2e", borderRadius: 12, padding: 14, marginBottom: 10, border: `1.5px solid ${r.isHit ? "#3a5a3a" : "#2a3550"}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
            <BetTypeBadge type={r.betType} />
            {r.grade && !["一般", "平場"].includes(r.grade) && <GradeBadge grade={r.grade} />}
            {r.review?.purchaseReason && <span style={{ fontSize: 10, background: "#1d3146", color: "#88c0ff", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>{r.review.purchaseReason}</span>}
            {r.review?.confidence && <span style={{ fontSize: 10, background: "#3a3320", color: "#e8c86a", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>自信{r.review.confidence}</span>}
            {r.review?.missReason && !r.isHit && <span style={{ fontSize: 10, background: "#3a1a1a", color: "#e8a838", padding: "1px 6px", borderRadius: 4, fontWeight: 800 }}>{r.review.missReason}</span>}
            {r.venueType === "地方" && <span style={{ fontSize: 10, background: "#2a3550", color: "#8899bb", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>地方</span>}
            {r.isHit && (
              <span style={{ background: "#1a4a1a", border: "1.5px solid #6cbc5e", color: "#6cbc5e", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>
                ✓ 的中 {totalHitCount > 0 ? `${totalHitCount}点` : ""}
              </span>
            )}
            {analysis && !r.isHit && <AnalysisBadge label={analysis.label} />}
          </div>
          <div style={{ fontSize: 11, color: "#6b7a99" }}>{r.date}（{dayOfWeek(r.date)}）</div>
          {raceLabel && <div style={{ fontSize: 12, color: "#aab8cc", fontWeight: 600, marginTop: 2 }}>{raceLabel}</div>}
          {(r.tags || []).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {r.tags.map(t => <span key={t} style={{ fontSize: 10, background: "#2a3a55", color: "#b8d0ff", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>#{t}</span>)}
            </div>
          )}
          {r.memo && <div style={{ marginTop: 8, padding: "8px 10px", background: "#101827", border: "1px solid #1e2a40", borderRadius: 8, color: "#aab8cc", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{r.memo}</div>}
        </div>
        <div style={{ display: "flex", gap: 0, alignItems: "center", flexShrink: 0 }}>
          <button onClick={onEdit} style={iconBtn} title="編集">✏️</button>
          <button onClick={onCopy} style={iconBtn} title="コピー">📋</button>
          <button onClick={onDelete} style={iconBtn} title="削除">🗑</button>
        </div>
      </div>

      {r.combination && (
        <details style={{ background: "#0f1420", borderRadius: 8, padding: "8px 10px", marginBottom: 8, border: "1px solid #1e2a40" }}>
          <summary style={{ fontSize: 10, color: "#6b7a99", fontWeight: 600, cursor: "pointer", outline: "none" }}>
            買い目詳細 {totalHitCount > 0 ? `（✓${totalHitCount}点的中）` : ""}
          </summary>
          <div style={{ fontSize: 12, color: "#e4e6eb", fontFamily: "monospace", letterSpacing: 0.5, whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 6 }}>{r.combination}</div>
        </details>
      )}

      {winningCombos.length > 0 && (
        <div style={{ background: "#0f1420", borderRadius: 8, padding: "8px 10px", marginBottom: 8, border: "1px solid #1e2a40" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "#6b7a99", fontWeight: 700 }}>レース結果</span>
            {analysis && <AnalysisBadge label={analysis.label} />}
          </div>
          <div style={{ fontFamily: "monospace", color: "#e8c86a", fontSize: 13, fontWeight: 900, letterSpacing: 1, wordBreak: "break-word" }}>{winningCombos.join(" / ")}</div>
          {analysis?.reason && <div style={{ color: "#8899bb", fontSize: 11, marginTop: 4 }}>{analysis.reason}</div>}
          {r.result?.memo && <div style={{ color: "#aab8cc", fontSize: 11, marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{r.result.memo}</div>}
        </div>
      )}

      {(r.review?.expectationMemo || r.review?.reflectionMemo || r.review?.axisPopularity || r.review?.axisOdds) && (
        <details style={{ background: "#0f1420", borderRadius: 8, padding: "8px 10px", marginBottom: 8, border: "1px solid #1e2a40" }}>
          <summary style={{ fontSize: 10, color: "#6b7a99", fontWeight: 600, cursor: "pointer", outline: "none" }}>購入・反省メモ</summary>
          <div style={{ color: "#aab8cc", fontSize: 11, marginTop: 6, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {r.review?.axisPopularity && `軸人気: ${r.review.axisPopularity}番人気\n`}
            {r.review?.axisOdds && `軸オッズ: ${r.review.axisOdds}倍\n`}
            {r.review?.expectationMemo && `購入前: ${r.review.expectationMemo}\n`}
            {r.review?.reflectionMemo && `反省: ${r.review.reflectionMemo}`}
          </div>
        </details>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
        <StatMini label="点数" value={r.points + "点"} small />
        <StatMini label="投資" value={formatYen(r.investment)} small />
        {r.isHit ? (
          <><StatMini label="払戻" value={formatYen(r.payout)} color="#6cbc5e" small />
          <StatMini label="収支" value={(r.pnl >= 0 ? "+" : "") + formatYen(r.pnl)} color={r.pnl >= 0 ? "#6cbc5e" : "#e05555"} small /></>
        ) : (
          <><StatMini label="結果" value="外れ" color="#e05555" small />
          <StatMini label="収支" value={"−" + formatYen(r.investment)} color="#e05555" small /></>
        )}
        <StatMini label="回収率" value={roi} color={r.payout >= r.investment && r.investment > 0 ? "#6cbc5e" : "#e8c86a"} small />
      </div>
    </div>
  );
}

function EmptyState() {
  return <div style={{ textAlign: "center", padding: "60px 20px", color: "#445" }}><div style={{ fontSize: 36, marginBottom: 12 }}>📋</div><div style={{ fontSize: 14 }}>記録がありません</div></div>;
}
