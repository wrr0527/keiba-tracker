// Google Sheets 同期モジュール

const SPREADSHEET_NAME = "馬券収支ノート_データ";
const SHEET_NAME = "records";

// アクセストークンを保存
export const saveToken = (token, expiresAt) => {
  localStorage.setItem("gsync-token", token);
  localStorage.setItem("gsync-expires", expiresAt);
};

export const getToken = () => {
  const token = localStorage.getItem("gsync-token");
  const expires = Number(localStorage.getItem("gsync-expires") || 0);
  if (!token || Date.now() > expires) return null;
  return token;
};

export const clearToken = () => {
  localStorage.removeItem("gsync-token");
  localStorage.removeItem("gsync-expires");
  localStorage.removeItem("gsync-spreadsheet-id");
};

// トークンが存在するが期限切れ（再ログインが必要）かどうか
export const isTokenExpired = () => {
  const token = localStorage.getItem("gsync-token");
  const expires = Number(localStorage.getItem("gsync-expires") || 0);
  return !!token && Date.now() > expires;
};

const getSpreadsheetId = () => localStorage.getItem("gsync-spreadsheet-id");
const setSpreadsheetId = (id) => localStorage.setItem("gsync-spreadsheet-id", id);

// Drive APIで既存のスプレッドシートを検索
async function findSpreadsheet(token) {
  const q = encodeURIComponent(`name='${SPREADSHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive search failed: ${res.status}`);
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

// スプレッドシートを新規作成
async function createSpreadsheet(token) {
  const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title: SPREADSHEET_NAME },
      sheets: [{ properties: { title: SHEET_NAME } }],
    }),
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status}`);
  const data = await res.json();
  return data.spreadsheetId;
}

// スプレッドシートIDを確実に取得（無ければ作成、見つからなければ探す）
async function ensureSpreadsheetId(token) {
  let id = getSpreadsheetId();
  if (id) {
    // 存在確認
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=spreadsheetId`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return id;
  }
  // Driveから検索
  id = await findSpreadsheet(token);
  if (id) {
    setSpreadsheetId(id);
    return id;
  }
  // 新規作成
  id = await createSpreadsheet(token);
  setSpreadsheetId(id);
  return id;
}

// 全データをアップロード（上書き）
export async function uploadRecords(records) {
  const token = getToken();
  if (!token) throw new Error("認証が切れています。再ログインしてください");

  const id = await ensureSpreadsheetId(token);

  // シート全体をクリア
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${SHEET_NAME}:clear`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  // recordsをJSON文字列にして1セルに保存（シンプルかつ完全復元可）
  const json = JSON.stringify(records);
  // セルサイズ制限のためバージョン情報も付ける
  const meta = JSON.stringify({ version: 1, count: records.length, savedAt: new Date().toISOString() });

  const values = [
    ["__meta__", meta],
    ["__data__", json],
  ];

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${SHEET_NAME}!A1?valueInputOption=RAW`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upload failed: ${res.status} ${errText}`);
  }
  return { count: records.length };
}

// 全データをダウンロード
export async function downloadRecords() {
  const token = getToken();
  if (!token) throw new Error("認証が切れています。再ログインしてください");

  const id = await ensureSpreadsheetId(token);

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${SHEET_NAME}!A1:B2`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const data = await res.json();
  const rows = data.values || [];

  // データ行を探す
  const dataRow = rows.find(r => r[0] === "__data__");
  if (!dataRow || !dataRow[1]) return [];

  try {
    return JSON.parse(dataRow[1]);
  } catch {
    throw new Error("データの解析に失敗しました");
  }
}

// 最後の同期メタ情報を取得
export async function getRemoteMeta() {
  const token = getToken();
  if (!token) return null;

  try {
    const id = await ensureSpreadsheetId(token);
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${SHEET_NAME}!A1:B1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const metaRow = (data.values || []).find(r => r[0] === "__meta__");
    if (!metaRow || !metaRow[1]) return null;
    return JSON.parse(metaRow[1]);
  } catch {
    return null;
  }
}