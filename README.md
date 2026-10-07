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
| `folderTable`（Drive フォルダIDのハードコード） | 添付ファイルは DB（`attachments` テーブル）に保存。フォルダ管理は不要 |
| `ScriptProperties` の連番（ロックなし） | `counters` テーブルを `INSERT … ON CONFLICT DO UPDATE` で原子的に採番 |
| n8n Webhook（口座情報も送信） | n8n Webhook（**口座情報は除外**、`X-Webhook-Secret` ヘッダ付き） |
| `e.values[n]`（列番号依存） | zod スキーマで設問名ベースに検証 |

### 旧GASで直っている問題
- 3か所コピーの同期ずれ（行の手修正・並べ替えでずれる）
- onEdit で対象行が見つからないと `findIndex(-1) + 2 = 1` で**見出し行を上書き**する
- 同時送信時の行の上書き・連番の重複
- フォームの設問追加で全項目がずれる

## 権限

財務局長と管理者はできることが同じで、肩書きだけが違います。それ以外の委員はすべて「一般」です。

| | 一般 | 財務局長 | 管理者 |
| --- | :-: | :-: | :-: |
| 申請・自分の申請の閲覧 | ○ | ○ | ○ |
| 全申請の閲覧（台帳） | | ○ | ○ |
| 口座情報の閲覧 | | ○ | ○ |
| 対応済み操作 | | ○ | ○ |
| 予算の取り込み | | ○ | ○ |
| 委員の登録・権限変更 | | ○ | ○ |

- 権限の定義は `shared/roles.ts` の1か所だけ。サーバー（`requirePermission`）も画面（`usePermissions`）もここを見る。
  役割を増やしたり、財務局長と管理者でできることを分けたりするときもここを直せばよい
- 財務局長・管理者が「ユーザー」画面で、委員をメールアドレスで先に登録したり権限を変えたりする。
  登録していない人は初回ログインで「一般」として登録される。変更は再ログインなしで次の操作から効く
- `NUXT_ADMIN_EMAILS` のユーザーはログインのたびに管理者になる（最初の管理者用。画面からは変更不可）
- 財務局長・管理者が1人もいなくなる変更はできない
- 口座情報は申請後は本人にも返さない

### ログイン方式の差し替え
ログインの入口は `server/utils/auth.ts` の `loginAs(event, email, name)` だけです。
委員会のログイン制度につなぐときは、本人確認ができたところで `loginAs` を呼ぶルートを `server/routes/auth/` に追加すれば、
権限管理はそのまま使えます（今は Google OAuth と開発用ログインがこれを呼んでいます）。

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

ローカルの DB（`file:` の SQLite）は初回起動時に `server/db/migrations` から自動で作成されます（既定は `.data/app.db`）。
スキーマを変えたら `npm run db:generate` でマイグレーションを追加してください。

## Vercel + Turso へのデプロイ

1. **Turso** でデータベースを作り、URL（`libsql://…`）とトークンを用意する
2. **Google Cloud Console** で OAuth クライアント（ウェブアプリケーション）を作る
   - 承認済みのリダイレクト URI: `https://<Vercelのドメイン>/auth/google`
3. **Vercel** で GitHub リポジトリをインポートし、環境変数を設定する

   | 変数 | 値 |
   | --- | --- |
   | `NUXT_SESSION_PASSWORD` | 32文字以上のランダム文字列 |
   | `NUXT_DATABASE_URL` / `NUXT_DATABASE_AUTH_TOKEN` | Turso の URL / トークン |
   | `NUXT_OAUTH_GOOGLE_CLIENT_ID` / `NUXT_OAUTH_GOOGLE_CLIENT_SECRET` | Google OAuth |
   | `NUXT_ADMIN_EMAILS` | 会計担当のメール（カンマ区切り） |
   | `NUXT_N8N_WEBHOOK_URL` / `NUXT_N8N_WEBHOOK_SECRET` | 任意 |

   `NUXT_PUBLIC_DEV_LOGIN` は**設定しない**こと。
4. デプロイ。ビルド時に `drizzle-kit migrate` が Turso にテーブルを作る（`vercel.json` → `npm run build:vercel`）

### 添付ファイルについて
Vercel の関数は 4.5MB までしかリクエストを受け取れないため、添付は **4MB まで**。
スマホ写真は送信前にブラウザで長辺 2000px の JPEG に縮小しています（`app/composables/useSubmit.ts`）。
ファイルは Turso の `attachments` テーブルに入ります（無料枠 5GB。領収書なら数千枚は入る）。

## 本番に向けて残っていること
- **既存データの移行**: スプレッドシートの「執行依頼」「証憑管理」シートから `entries` への取り込みスクリプト
- **n8n 側**: 受け取る JSON の形が変わる（`{ event, entry }`）ので Slack 投稿ワークフローの修正が必要
- Nuxt は 4.5 系に固定しています（4.6.0 は Windows でビルドすると SSR の precomputed が空になり 500 になるため）
