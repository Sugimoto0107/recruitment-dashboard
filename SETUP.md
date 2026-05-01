# 採用ダッシュボード - 適用手順

このパッチは、既存の `recruitment-dashboard` リポジトリに対して以下の機能を追加・更新します。

## 追加・変更される機能

1. **契約企業数 (RA セクション)**
   - 総数に加えて Notion の `ステータス`（契約 / 人ありき / 友人 / 停止 / 契約書はまだだけど合意済み / アライアンス）別にも表示
2. **求人数 (RA セクション)**
   - 総数 ＋ ステータス別（公開中 / 準備中 / 非公開 / 募集停止）
   - 公開中求人の **職種コード別** 内訳（Notion 側で職種コードが入った時点で自動的に表示）
3. **応募ファネル（新規セクション）**
   - 応募管理 DB から、推薦 → 1次 → 2次 → 最終 → 内定 → 内定承諾 → 入社 の歩留まりを集計
   - 書類NG / 面接NG / 求職者辞退の件数も併せて表示
   - 現フェーズ別の応募件数も表示
4. **求職者個別の状況（新規セクション）**
   - 求職者管理 DB の各候補者について
     推薦数・面接設定数・面接実施数・1次通過・2次実施/通過・最終実施・内定・承諾・承諾日・入社・入社日 を一覧表示
   - 氏名 / 候補者NO / 担当者で絞り込み可能
5. **毎朝の自動更新**
   - `/api/revalidate?token=...` を新設
   - GitHub Actions の cron が毎朝 9:00 JST に上記を叩いてキャッシュを再生成
   - `/api/dashboard` は 24 時間キャッシュ + 手動 revalidate に切り替え

## ファイル一覧

差分として置き換える、または新規追加するファイル：

```
src/lib/notion.ts                  ←上書き
src/lib/process-data.ts            ←上書き
src/app/page.tsx                   ←上書き
src/app/api/dashboard/route.ts     ←上書き
src/app/api/revalidate/route.ts    ←新規追加
.github/workflows/daily-refresh.yml ←新規追加
```

## 適用手順

### 1. パッチ内容を取り込む

このフォルダの構造はリポジトリ root と同じです。リポジトリの `recruitment-dashboard/` ディレクトリ直下に、このフォルダの中身をすべてコピーしてください。

> 既存のファイルは上書きされます。心配であれば事前に `git switch -c add-daily-update` のようにブランチを切ってください。

### 2. 環境変数の設定

#### 2-1. Vercel に追加

Vercel プロジェクトの **Settings → Environment Variables** に以下を追加します。

| Key | Value | 環境 |
|---|---|---|
| `NOTION_API_KEY` | （既設） Notion インテグレーションのトークン | Production / Preview |
| `REVALIDATE_TOKEN` | 任意の長いランダム文字列 (例: `openssl rand -hex 32`) | Production |

> 既に `NOTION_API_KEY` は設定済みのはずなので、追加するのは `REVALIDATE_TOKEN` のみです。

#### 2-2. ローカル開発用 (`.env.local`)

```env
NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
REVALIDATE_TOKEN=同じトークン文字列を入れる（任意。ローカルで /api/revalidate を試したい時のみ）
```

### 3. GitHub の Secrets に登録

GitHub リポジトリの **Settings → Secrets and variables → Actions → New repository secret** から以下 2 つを追加します。

| Secret 名 | 値 |
|---|---|
| `DASHBOARD_URL` | `https://recruitment-dashboard-msugimoto-6537s-projects.vercel.app` （末尾スラッシュなし） |
| `REVALIDATE_TOKEN` | Vercel に設定したのと **同じ** 文字列 |

### 4. デプロイ & 動作確認

```bash
git add .
git commit -m "feat: status breakdowns, application funnel, candidate table, daily revalidation"
git push
```

Vercel の自動デプロイが完了した後、以下で確認できます。

1. **ダッシュボード本体** : `https://...vercel.app/` を開いて新しいセクションが表示されること
2. **revalidate エンドポイント** :
   ```bash
   curl "https://...vercel.app/api/revalidate?token=YOUR_TOKEN"
   # => {"ok":true,"revalidated":["/api/dashboard","/"], "now": "..."}
   ```
3. **GitHub Actions の手動実行** : Actions タブ → "Daily dashboard refresh" → Run workflow

### 5. 毎朝の自動実行

`.github/workflows/daily-refresh.yml` の cron は `0 0 * * *`（毎日 00:00 UTC = 09:00 JST）です。最初の自動実行はマージ翌日朝です。

時間を変えたい場合は cron 行を編集してください（例: 8:00 JST にしたい場合 `0 23 * * *`）。

## Notion 側の補足

- **契約企業 ステータス**: 想定外の値（例: 新しい option が追加された場合）でもダッシュボード側でカウントされます（その他扱いにはなりません）。
- **求人 職種コード**: テキストプロパティです。空のままでも壊れません。コードを入れた求人のみが「公開中求人の職種コード別内訳」に集計されます。
- **応募管理 DB のフェーズ**: 既存の 13 種に対応しています。新しいフェーズを追加する場合は `src/lib/notion.ts` の `APPLICATION_PHASES` にも追加してください（追加しなくても集計には含まれます）。
- **求職者管理 DB の数値項目**: 推薦社数・面接設定社数・面接実施社数・一次面接通過数・二次面接実施数・二次面接通過数・最終面接実施数・内定数・内定承諾数・入社数 はそのまま参照しています。Notion 側で値を入れていない場合は 0 として扱われます。

## トラブルシュート

- **ダッシュボードが「Notion未接続」と表示される** → Vercel に `NOTION_API_KEY` が設定されていない / 値が `your_notion_api_key_here` のまま
- **`/api/revalidate` が 401** → `REVALIDATE_TOKEN` が一致していない（Vercel と GitHub Secret 両方を確認）
- **`/api/revalidate` が 500 で `REVALIDATE_TOKEN is not configured`** → Vercel 側に `REVALIDATE_TOKEN` が未設定
- **ファネル数が想定と違う** → 応募管理 DB の各日付プロパティ（推薦日時・各面接実施日・内定日・内定承諾日 等）が運用上正しく入力されているかを確認してください。集計はそれらの日付の有無で判定しています。

## 注意事項

- Next.js のビルド済みキャッシュはデプロイのたびに作り直されるため、デプロイ後はそのまま新しいデータが取得されます。意図せず古い値が出た時は `Run workflow` で手動実行するか、ヘッダーの「更新」ボタンを押してください。
- ダッシュボードの「更新」ボタンは `cache: "no-store"` で API を呼び直すので、必要なときにいつでも最新値を強制取得できます。
