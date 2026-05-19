# CLAUDE.md — Keiba Tracker 開発ガイド

Claude Code がこのプロジェクトで作業する際の参照ドキュメントです。

## プロジェクト概要

**馬券収支ノート（Keiba Tracker）** は、競馬の馬券購入記録・収支分析・レース振り返りを行うシングルページ PWA です。ユーザーはスマートフォンのブラウザ（またはホーム画面追加）で使用します。バックエンドは存在せず、データは `localStorage` + Google Sheets API (v4) に直接保存します。

## 技術スタック

| 項目 | 内容 |
|---|---|
| UI フレームワーク | React 19（hooks 中心、クラスコンポーネントなし） |
| ビルドツール | Vite 8 |
| PWA | vite-plugin-pwa 1.2 (Workbox, autoUpdate) |
| Google 認証 | @react-oauth/google 0.13 |
| スタイリング | インラインスタイルのみ（CSS モジュール・Tailwind なし） |
| データ永続化 | localStorage (`keiba-records-v3`) |
| クラウド同期 | Google Sheets API v4 + Drive API v3 |
| デプロイ | Vercel（`main` push で自動デプロイ） |

## 主要ファイル

### `src/App.jsx`（3,000 行超）

アプリ全体のロジックと UI が 1 ファイルに集約されています。主要セクション：

| 行範囲（概算） | 内容 |
|---|---|
| 1–100 | 定数（BET_TYPES, JRA_VENUES, GRADED_RACES, JOCKEYS, HORSES など） |
| 100–130 | `newEntry()` / `newAxisHorse()` / `newHimoHorse()` / `initialForm` |
| 130–240 | 組み合わせ計算関数（`computeManual`, `computeBox`, `computeWheel`, `computeFormation`, `computeEntry`） |
| 240–280 | `entriesFromOldCombinationText()` — 旧フォーマット `combination` テキストから `formEntries` を復元 |
| 280–550 | 分析・集計ユーティリティ（`analyzeCombo`, `mergeRecordsPreferLatest`, `validateRecord` など） |
| 550–650 | 汎用 UI コンポーネント（`Label`, `BetTypeBadge`, `PnLText`, `DashboardRow` など） |
| 650–1100 | 入力系コンポーネント（`CalendarPicker`, `AmountStepper`, `OddsStepper`, `TagInputWithSuggest`, `HorseGrid`） |
| 1100–1230 | `SearchableRaceNameInput`, `SearchableInput`（騎手検索などに共用） |
| 1230–1600 | セクションコンポーネント（`MultiAxisHorsesSection`, `HimoHorsesSection`, `UnifiedResultSection`, `EntryAxisSelector`, `DistanceCourseSection`, `CombinationEntry` など） |
| 1600–1980 | レビュー系コンポーネント（`PurchaseMemoSection`, `ResultOddsInput`, `ReviewMemoSection`, `RecordCard` など） |
| 1980–2080 | App コンポーネント初期化・useState/useRef・Google 認証・クラウド同期処理 |
| 2080–2280 | `restoreFormFromRecord`, `handleEdit`, `handleCopy`, `handleBetTypeChange`, `updateEntry`, auto-himo useEffect |
| 2280–2400 | `handleSubmit`（レコード作成・保存・クラウド同期） |
| 2400–2500 | 導出値（`axisHorseEntries`, `himoHorseEntries`, `betHorseRows`, 各種統計集計） |
| 2500–2700 | 入力タブ JSX |
| 2700–2800 | 履歴タブ JSX |
| 2800–3100 | 統計タブ JSX（概要/日別/月別/年別 サブタブ） |
| 3100+ | データ管理モーダル（DataManagerModal）・タブバー |

### `src/googleSync.js`

Google Sheets API との同期処理。スプレッドシート名は `馬券収支ノート_データ`、シート名は `records`。

- **`uploadRecords(records)`**: `formEntries` フィールドを除外（`combination` から復元可能）してサイズ削減、45,000 文字単位でチャンク分割して `__chunk_0__`, `__chunk_1__`... セルに書き込む
- **`downloadRecords()`**: `__meta__` からチャンク数を読み取り、チャンク行を結合して JSON 復元。旧フォーマット（`__data__` セル）にも fallback
- **`getRemoteMeta()`**: 最終同期日時・件数のみ取得（同期状態の表示用）
- **トークン管理**: `saveToken` / `getToken` / `clearToken` / `isTokenExpired` で localStorage に保存

### `src/main.jsx`

`GoogleOAuthProvider` で `App` をラップするだけのエントリーポイント。`VITE_GOOGLE_CLIENT_ID` 環境変数を注入。

## データ構造

### record（保存レコード）

```js
{
  id: number,               // Date.now() または旧形式の文字列 ID
  date: "YYYY-MM-DD",
  venueType: "JRA" | "地方" | "海外",
  venue: string,            // 競馬場名（海外は自由入力）
  raceNo: string | number,
  grade: string,            // "平場" | "OP" | "G1" | "G2" | "G3" | "Jpn1" ... など
  raceName: string,
  distance: string,         // "1600m" など（DISTANCE_OPTIONS）
  courseType: string,       // "芝" | "ダート" | "障害"
  trackCondition: string,   // "良" | "稍重" | "重" | "不良"
  betType: string,          // BET_TYPES のいずれか
  combination: string,      // 表示用テキスト（買い目全一覧。旧形式の編集時に使用）
  formEntries: Entry[],     // 入力フォームのエントリ配列（クラウド保存時は除外）
  entries: EntryStats[],    // 各エントリの集計値（points, investment, payout, analysis）
  points: number,
  investment: number,
  payout: number,
  pnl: number,
  isHit: boolean,
  odds: number,             // 代表オッズ（最高的中オッズ）
  result: { finishOrder: number[], memo: string },
  raceResult: { first, second, third },  // 旧形式互換
  axisHorsesInfo: AxisHorse[],
  himoHorsesInfo: HimoHorse[],
  review: { purchaseReason, confidence, expectationMemo, missReason, reflectionMemo },
  analysis: { label, reason } | null,
  tags: string[],
  memo: string,
  createdAt: string,        // ISO 8601
  updatedAt: string,
}
```

### Entry（フォームエントリ）

```js
{
  id: string,               // ランダム 7 文字
  mode: "manual" | "box" | "wheel" | "formation",
  text: string,             // manual モードの入力テキスト
  horses: number[],         // box モードの馬番リスト
  axisHorses: number[],     // wheel モードの軸
  poolHorses: number[],     // wheel モードの相手
  axisPos: "1st" | "2nd" | "3rd" | "multi",
  columns: [number[], number[], number[]],  // formation モード
  unitAmount: number,       // デフォルト購入金額（円）
  amountMap: { [combo]: number },  // 組み合わせ別金額（unitAmount と異なる場合のみ）
  hitCombos: string[],      // 的中組み合わせ
  oddsMap: { [combo]: number },    // 的中組み合わせのオッズ（倍率）
  tags: string[],
  entryAxisHorses: number[], // 軸/ヒモ判定用（wheel 以外）
}
```

### AxisHorse / HimoHorse

```js
// AxisHorse
{ horseNo: string, popularity: string, odds: string, finishOrder: string, jockey: string }

// HimoHorse
{ horseNo: string, popularity: string, odds: string }
```

## 開発フロー

```bash
npm run dev          # 開発サーバー起動（http://localhost:5173）
# … 実装・確認 …
npm run build        # ビルドエラー確認
git add src/...
git commit -m "..."
git push             # → Vercel が自動でプロダクションデプロイ
```

手動デプロイが必要な場合：
```bash
npx vercel --prod
```

## 環境変数

| 変数名 | 内容 |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth 2.0 クライアント ID（`.env.local` に記載） |

Vercel 側にも同じ変数を設定すること（プロジェクト設定 → Environment Variables）。

## 機能拡張時の注意点

### データ互換性

- 新フィールドを record に追加する場合は `validateRecord()` に追加し、フォールバック値（空文字 / `undefined`）を設定する。旧レコードに存在しなくても壊れないようにする
- `restoreFormFromRecord()` で編集時に旧フィールドを正しく復元できるか確認する
- `formEntries` は Google Sheets には保存されない（`combination` テキストから `entriesFromOldCombinationText()` で復元する設計）。新フォーマットの `formEntries` が必要な編集は、スマホローカルのデータで行うことを前提とする

### 状態管理

- `form` は `useState` の単一オブジェクト。変更は `setForm(f => ({ ...f, key: value }))` パターンで行う
- `setF(key, value)` ヘルパーが主要フィールドの更新に使える
- `updateEntry(id, next)` でエントリ更新後、`autoMarkHits` が自動で的中判定を更新する
- ヒモ馬自動登録: 買い目変更時に `useEffect` が走り、軸馬以外の買い目馬を `himoHorsesInfo` に自動追加（加算のみ、手動削除は保持される）

### UI 規約

- スタイルはインラインスタイルで記述（既存パターンを踏襲する）
- `inputStyle` 共通変数を再利用する
- 新しいセクションコンポーネントは `function XxxSection({ ... }) { ... }` として App 外に定義し、App の JSX から呼ぶ
- モバイルファースト（最大幅 480px、縦向き固定想定）

### 作業スタイル

- ユーザーから実装依頼が来たら、確認なしで実装を進める
- 実装後は `npm run build` でエラーがないことを確認してから commit する
- commit メッセージは英語で簡潔に（日本語の機能名は混在可）
- deploy は `npx vercel --prod` または git push（Vercel 自動デプロイ）

## 既知の制約・注意事項

### vite-plugin-pwa の peer dependency 問題

`vite-plugin-pwa@1.2.0` は `vite@^6` を peerDependency として要求するが、実際は `vite@8` を使用している。`.npmrc` の `legacy-peer-deps=true` で回避済み。`npm install` 時は必ずこの設定が効いていることを確認する。

### Google Sheets の 1 セル 50,000 文字制限

`googleSync.js` の `uploadRecords()` は以下の対策を実装済み：
1. `formEntries` を除外（`combination` テキストから復元可能なため）
2. 残りのデータを 45,000 文字単位でチャンク分割して複数セルに保存

チャンクフォーマット：
- `A1`: `__meta__` / `{ version: 2, count, chunks, savedAt }`
- `A2`: `__chunk_0__` / 最初の 45,000 文字
- `A3`: `__chunk_1__` / 次の 45,000 文字（以降同様）

旧フォーマット（`__data__` セル）への fallback も実装済みなので後方互換性あり。

### localStorage のキー体系

| キー | 内容 |
|---|---|
| `keiba-records-v3` | レコード配列（JSON） |
| `gsync-token` | Google OAuth アクセストークン |
| `gsync-expires` | トークン有効期限（Unix ms） |
| `gsync-spreadsheet-id` | 作成済みスプレッドシートの ID（再検索を省略） |

### useCallback の依存関係

`restoreFormFromRecord` は `form.oddsMode` に依存する `useCallback` で定義されている。`handleEdit` / `handleCopy` はこれに依存する。依存配列を変更する際は影響範囲を確認する。
