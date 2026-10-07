# 予算執行（Nuxt 版）

スプレッドシート「予算執行」＋ GAS（formSubmit.gs / onEdit.gs / constant.gs）で行っていた
執行依頼・証憑提出・台帳管理を Nuxt で置き換える試作です。

## 旧GASとの対応

| 旧（GAS / スプレッドシート） | 新（このアプリ） |
| --- | --- |
| 執行依頼フォーム → `onFormSubmit` | `/requests/new` → `POST /api/entries` |
| 証憑管理フォーム → `onFormSubmit`（`e.values[11][0] == "h"` で判定） | `/evidences/new` → `POST /api/evidences`（エンドポイントを分離） |
| 形態別シート・番号順・申請順に**同じ行をコピー** | `entries` テーブル1つ。一覧は `/entries?view=number\|time\|振込\|…` で切り替え |
| A列チェック → `onChange` がタイムスタンプで他シートの行を探して書き戻し | 「対応済みにする」ボタン → `POST /api/entries/:id/execute`（行は1つなので同期不要） |
| `folderTable`（Drive フォルダIDのハードコード） | 項目番号（`out-03-02` 単位）のフォルダを自動作成して保存 |
| `ScriptProperties` の連番（ロックなし） | `counters` テーブルを `INSERT … ON CONFLICT DO UPDATE` で原子的に採番 |
| n8n Webhook（口座情報も送信） | n8n Webhook（**口座情報は除外**、`X-Webhook-Secret` ヘッダ付き） |
| `e.values[n]`（列番号依存） | zod スキーマで設問名ベースに検証 |

### 旧GASで直っている問題
- 3か所コピーの同期ずれ（行の手修正・並べ替えでずれる）
- onEdit で対象行が見つからないと `findIndex(-1) + 2 = 1` で**見出し行を上書き**する
- 同時送信時の行の上書き・連番の重複
- フォームの設問追加で全項目がずれる

## 権限
- ログイン: Google OAuth。`NUXT_ALLOWED_EMAIL_DOMAIN`（既定 `g.ecc.u-tokyo.ac.jp`）のアカウントのみ
- 一般委員: 自分の申請だけ閲覧。口座情報は申請後は本人にも返さない
- 会計担当（`NUXT_ADMIN_EMAILS`）: 全件閲覧・口座情報の閲覧・対応済み操作・添付ファイル閲覧

## ローカルで動かす

Node.js 22.21 以上（または 24.11 以上）が必要です。

```bash
npm install
cp .env.example .env   # NUXT_SESSION_PASSWORD を32文字以上で設定
npm run dev
```

Google OAuth を用意していない場合は `.env` で `NUXT_PUBLIC_DEV_LOGIN=true` にすると、
ログイン画面に任意のメールでログインできるフォームが出ます（**本番では絶対に有効にしない**）。
`NUXT_ADMIN_EMAILS` に入れたメールでログインすると会計担当として扱われます。

DB は初回起動時に `server/db/migrations` から自動で作成されます（既定は `.data/app.db`）。
スキーマを変えたら `npm run db:generate` でマイグレーションを追加してください。

## 本番に向けて残っていること
- **ファイル保存先**: 今はサーバーのローカルディスク（`.data/uploads`）。永続ディスクのないホスティング（Vercel など）では
  Google Drive API か S3 互換ストレージに差し替える必要があります（`server/utils/upload.ts` だけ変えれば済む構成）
- **DB**: ローカルは SQLite。本番は `NUXT_DATABASE_URL` に Turso（libsql）の URL を入れればそのまま動きます
- **既存データの移行**: スプレッドシートの「執行依頼」「証憑管理」シートから `entries` への取り込みスクリプト
- **n8n 側**: 受け取る JSON の形が変わる（`{ event, entry }`）ので Slack 投稿ワークフローの修正が必要
- Nuxt は 4.5 系に固定しています（4.6.0 は Windows でビルドすると SSR の precomputed が空になり 500 になるため）
