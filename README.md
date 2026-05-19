# 馬券収支ノート / Keiba Tracker

馬券の購入記録・収支管理・レース分析をスマートフォンで完結させる PWA アプリです。

## 主な機能

| カテゴリ | 内容 |
|---|---|
| **記録** | 券種・買い目（通常/ボックス/流し/フォーメーション）・投資額・払戻金を入力 |
| **馬情報** | 軸馬（馬番・騎手・人気・オッズ・着順）、ヒモ馬を買い目から自動登録 |
| **レース詳細** | 距離・コース種別・馬場状態・グレード・海外レース対応 |
| **分析** | 的中判定（的中/順番違い/1頭違い/軸のみ/相手のみ/完敗）を自動算出 |
| **統計** | 回収率・的中率・券種別/競馬場別/距離別/馬場状態別/軸馬・ヒモ馬成績など多角的に集計 |
| **同期** | Google Sheets へのクラウドバックアップ（OAuth 2.0、チャンク分割で大容量対応）|
| **PWA** | ホーム画面に追加してオフラインでも動作 |
| **CSV/JSON** | データのエクスポート・インポート対応 |

## 技術スタック

- **フロントエンド**: React 19 + Vite 8
- **スタイリング**: インラインスタイル（CSS フレームワーク不使用）
- **PWA**: `vite-plugin-pwa` (Workbox、autoUpdate モード)
- **Google 認証**: `@react-oauth/google`
- **データ保存**: `localStorage`（ローカル）/ Google Sheets API v4（クラウド）
- **デプロイ**: Vercel

## セットアップ

### 前提条件

- Node.js 18 以上
- Google Cloud Console でのプロジェクト作成と OAuth 2.0 クライアント ID の取得

### インストール

```bash
git clone https://github.com/wrr0527/keiba-tracker.git
cd keiba-tracker
npm install
```

### 環境変数

プロジェクトルートに `.env.local` を作成します。

```
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

Google Cloud Console での設定：
1. 「APIとサービス」→「認証情報」→「OAuth 2.0 クライアント ID」を作成
2. アプリケーションの種類：**ウェブアプリケーション**
3. 承認済みの JavaScript 生成元に `http://localhost:5173`（開発）と本番 URL を追加
4. **Google Sheets API** と **Google Drive API** を有効化

### 開発サーバー起動

```bash
npm run dev
# → http://localhost:5173
```

### 本番ビルド

```bash
npm run build
npm run preview   # ローカルで本番ビルドを確認
```

## デプロイ（Vercel）

```bash
npx vercel --prod
```

または GitHub リポジトリと Vercel を連携すると `main` ブランチへの push で自動デプロイされます。

Vercel のプロジェクト設定 → Environment Variables で `VITE_GOOGLE_CLIENT_ID` を設定してください。

## 注意事項

- `vite-plugin-pwa` の peer dependency 問題のため `.npmrc` に `legacy-peer-deps=true` を設定しています
- クラウド同期には Google アカウントへのログインが必要です（アクセストークンは `localStorage` に保存、有効期限 1 時間）
- ローカルデータは `localStorage` キー `keiba-records-v3` に保存されます。ブラウザのキャッシュクリア前に Google Sheets へバックアップすることを推奨します
- Google Sheets の 1 セル上限（50,000 文字）に対応するため、データはチャンク分割して保存します

## ライセンス

Private project. All rights reserved.
