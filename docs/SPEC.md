# diet-tracker 現行仕様書

版: 2026-11-17(3・4・6 章と 7 章の一部を ADR-011 の削減に合わせて更新)。対象: ブランチ `refactor/core-loop`(`fix/study-p0` から分岐)。それ以外の章は 2026-10-14 版(`feat/trial-data-notice`)のまま。

**ADR-011(2026-11-17)で削除したもの:** ゲーム要素(ランク・XP・クエスト・バッジ・称号・チャレンジ・連続日数の表示)、`/form`・`/plan`・`/vitals`・`/symptoms`・`/meds`・`/report`、AI 栄養士・AI コーチ・AI トレーナー・習慣レポート・週次レポート、歩数、TDEE カード。理由と計測値は `docs/reviews/RADICAL_CRITIQUE_2026-11.md`。

コードを読んで起こした「今の実際の仕様」です。各項目に根拠のファイルを付けています。コードで確かめていない点は **未確認** と書きました。本番(`main`)とこのブランチで違う点は、最後の「本番との差」にまとめています。

## 1. 概要

- 食事・体重・運動を記録する Web アプリ(PWA)。Next.js 16.3.8(App Router)+ Supabase(Postgres・Auth)+ Google Gemini 2.5 Flash。
- 記録はまずブラウザの `localStorage` に保存し、ログイン中ならサーバーにも書く(二重書き込み)。サーバーから端末への読み戻しはない(`lib/data/_write.ts`、`lib/data/*.ts`)。
- 本番: https://diet-tracker-two-blue.vercel.app(Vercel)。外部の人のログインは未開通(`STATUS.md` の公開ログイン手順)。

## 2. 利用モード

| | ゲスト | ログイン |
|---|---|---|
| 入り方 | ログイン画面の「アカウントなしで続ける」(`dt-guest=1` cookie) | Google OAuth、またはメールのマジックリンク |
| 記録の保存先 | 端末の `localStorage` のみ | `localStorage` + Supabase |
| AI 機能 | `APP_ACCESS_CODE` が設定されていれば、その合言葉が必要。未設定の本番では拒否(503) | 使える。1 日の上限あり(4 章) |
| おすすめ(パーソナライズ推薦)、TDEE 推定、週次レポート、通知、SUS アンケート | 使えない(ログインを促す表示) | 使える |
| 調査の対象 | ならない | 研究者が同意書を確認したアカウントだけ |

根拠: `proxy.ts`、`app/login/page.tsx`、`lib/api-guard.ts`、`components/RecommendationCard.tsx` ほか `isAuthenticated` を見る 7 コンポーネント。

画面の振り分け(`proxy.ts`):

- 未ログイン・非ゲストが `/` を開く → ランディングページ。それ以外のページ → `/login?next=…`。
- ログイン済み、またはゲストが `/` か `/login` を開く → `/dashboard`。
- `dt-onboarded=1` cookie がない → `/onboarding`(端末ごと。新しい端末ではもう一度出る)。
- アプリ内の同意画面はない。ログインしただけでは調査の対象にならない(7 章)。
- Supabase の環境変数がプレースホルダーのとき(ローカル開発)は、振り分けをすべて素通しする。

## 3. 画面(10 ページ)

下部ナビは 4 つ(ホーム / 記録 / 運動 / 体重)。食事追加のボタン(FAB)はナビと一緒にどのタブにも出る(`components/BottomNav.tsx`)。

| パス | できること | 根拠 |
|---|---|---|
| `/` | 紹介ページ(未ログインの人だけに見える) | `app/page.tsx` |
| `/login` | Google ログイン、メールのマジックリンク、ゲストで続ける | `app/login/page.tsx` |
| `/onboarding` | 初期設定 2 問(目的 / 生年・性別・身長・体重・目標体重)。各問は飛ばせる。最後に 1 日のカロリー・PFC 目標を表示し、最初の食事の記録へ進む | `app/onboarding/page.tsx` |
| `/dashboard` | 上から: 今日の残りカロリー(目標比のバー、P/F/C は入力があるときだけ)→ 今日の食事 → 体重のワンタップ記録(前回値を入れておく)→ おすすめ(ログイン時)→ 水分 → 通知の案内 | `app/dashboard/page.tsx`、`components/QuickWeightCard.tsx` |
| `/add` | 食事の追加。**手入力が最初のタブ**、写真(料理/栄養成分表示)とバーコードは 2 番目以降。よく記録する食品のワンタップ追加、スピードモード、食事テンプレート。**P/F/C は任意**(3 つ全部か kcal だけ) | `app/add/page.tsx`、`components/FoodEntryForm.tsx` |
| `/log` | 週・月の記録一覧(月の点は食事・運動・体重)、日ごとの合計、編集・削除、お気に入り、食事テンプレート、SUS アンケート、推移(体重の傾向と kcal の目標達成のみ) | `app/log/page.tsx`、`components/TrendsPanel.tsx` |
| `/workout` | 運動の簡易記録: 種目名(過去の記録と種目一覧から候補)、部位、任意の重量×回数×セット、今日の一覧と削除。持病・服薬の注意(MedWarning)を表示 | `app/workout/page.tsx` |
| `/weight` | 体重の記録、推移グラフ、目標体重までの差、90 日の単純予測 | `app/weight/page.tsx` |
| `/settings` | 栄養目標、目標体重、健康プロフィール(年齢・性別・身長・持病・服薬・食事制限・目的・活動量)、言語、単位、文字サイズ、通知、データの書き出し・読み込み、アカウントとデータの削除 | `app/settings/page.tsx` |
| `/research` | 研究者用の参加者一覧(`profiles.role = 'researcher'` のみ) | `app/research/page.tsx`、`app/api/research/` |

`/auth/callback` はログイン後のコード交換用で、画面ではない。

## 4. AI 機能(3 種)

すべて `gemini-2.5-flash`、JSON の構造化出力。一時的な失敗(429・5xx)は最大 3 回まで再試行する(`lib/gemini.ts`)。

| ルート | 内容 | 呼び出し元 | 持病・服薬を送るか |
|---|---|---|---|
| `/api/analyze-food` | 料理の写真 → 料理名と kcal・PFC | `/add`(写真) | いいえ |
| `/api/analyze-label` | 栄養成分表示の写真 → 数値 | `/add`(成分表示) | いいえ |
| `/api/recommend` | 食事・運動のおすすめ(安全レイヤーを通す)— **研究の対象** | ダッシュボード(ログイン時) | **はい**(健康プロフィール全体) |

削除(ADR-011): `/api/nutritionist`、`/api/coach`、`/api/generate-workout`、`/api/suggest-workout`、`/api/habit-report`、`/api/weekly-report`、`/api/tdee/*`。

`/api/product-lookup` は AI ではなく、Open Food Facts へのバーコード照会(`lib/off.ts`)。

上限(`lib/rate-limit.ts`、`lib/api-guard.ts`):

| ルート | 短時間の上限(サーバーのメモリ上、再起動で消える) | 1 人 1 日(JST、成功した回数) |
|---|---|---|
| analyze-food | 10 回 / 分 | 100 |
| analyze-label | 10 回 / 分 | 50 |
| recommend | 10 回 / 分 | 100 |
| product-lookup | 30 回 / 分 | 300 |

- 全ルート合計で 1 人 1 日 400 回まで。1 日の上限はログイン利用者だけに適用され、`ai_usage` テーブルで数える。上限の確認に失敗したとき(DB 障害)は 503 で止める。
- これとは別に、Gemini 側の上限がある。無料枠では API キーのプロジェクト単位で全利用者が共有し、1 日分は太平洋時間の午前 0 時に戻る(Google の公式ページ、2026-10-14 閲覧)。回数は AI Studio でしか確認できず、**未確認**。
- Gemini が上限で断ったとき(429)は、3 ルートとも 429 と日英併記の文言(「AI機能が混み合っているか、本日の利用上限に達しました…」)を返す(`lib/gemini.ts` の `aiQuotaResponse`)。画面にその文言がそのまま出るかは、呼び出し元ごとには **未確認**。
- AI の返答は、画面の言語を英語にしても日本語で返ることがある(AI 栄養士で 2026-10-14 に確認)。

## 5. 安全レイヤー

言語モデルは文章を作るだけで、安全に関わる判断は決まった規則で行う(`lib/recommend-safety.ts`、`lib/medication-rules.ts`)。

- 持病の規則 9 件: 糖尿病、高血圧、腎臓病、心臓病、骨粗鬆症、甲状腺疾患、高脂血症、痛風、貧血。それぞれに運動と栄養の注意。
- 薬の規則 10 件: ワーファリン、スタチン系、メトホルミン、インスリン、レボチロキシン、降圧薬、利尿薬、ビスホスホネート、NSAIDs、テトラサイクリン系。避ける食品と服用時刻の注意。
- `/api/recommend` では二重にかける。`buildSafetyReport` が規則をプロンプトに入れ、`filterRecommendation` が返ってきた提案を調べ直して、禁忌の食品を取り除く。`clampMacros` が栄養目標の調整幅を制限する(例: 腎臓病のたんぱく質は 0.8 g/kg/日 まで)。
- 12〜17 歳には「成長期のためカロリー制限は推奨されません」を必ず付ける。
- 初期設定のカロリー目標は食事摂取基準 2025 から計算し、赤字(減量用の制限)は付けない(`app/onboarding/page.tsx`、`lib/nutrition-standards.ts`)。
- 血圧・血糖・症状は記録と表示だけで、判定しない(`app/vitals/page.tsx`、`app/symptoms/page.tsx`)。
- 規則は一般的な薬理・診療ガイドラインに基づくとコードに書かれているが、医療の専門家による確認は受けていない。安全レイヤーが二重にかかるのは `/api/recommend` で、ほかの AI ルートは規則をプロンプトに入れるだけか、入れていない。ルートごとの詳細は **未確認**。

## 6. サーバーに保存されるデータ

アプリが書くテーブル(ADR-011 後):

| テーブル | 内容 | 書き込み |
|---|---|---|
| `profiles` | 表示名、年齢、性別、身長、持病、服薬、食事制限、目的、活動量、栄養目標、目標体重、`role`、`consented_at`、`study_cohort` | `lib/data/health-profile.ts`、`lib/data/profile.ts` |
| `goal_history` | 目的と目標の変更履歴(追記のみ) | `lib/data/goal-history.ts` |
| `food_logs` | 食事の記録。`macros_entered`(migration 029、**本番未適用**)= false なら P/F/C は未入力の 0 | `lib/data/food.ts` |
| `weight_logs` | 体重(1 人 1 日 1 件) | `lib/data/weight.ts` |
| `workout_logs` | 運動の記録 | `lib/data/workout.ts` |
| `water_logs` | 水分 | `lib/data/water.ts` |
| `favorite_foods`、`meal_templates` | お気に入り、食事テンプレート | `lib/data/favorites.ts`、`meal-templates.ts` |
| `recommendation_feedback` | おすすめへの反応 | `lib/data/recommendation-feedback.ts` |
| `personal_records` | 端末に残っていた自己ベストの一括移行のみ | `lib/migrate.ts` |
| `ai_usage`、`sus_responses`、`beta_feedback`、`push_subscriptions`、`push_send_log`、`researcher_access_log`、`client_sync_health` | サーバー側・調査用 | 各 API ルート、`lib/data/outbox.ts` |

もう書かないテーブル: `training_programs`(cohort-queries S5 が読むので残す)、および `supabase/drafts/030_drop_unused_tables.sql`(**未適用**)で消す 13 テーブル(ゲーム要素 7、`vital_logs`、`symptom_logs`、`checkins`、`tdee_estimates`、`steps_logs`、`weekly_reports`)。

サーバーに保存されないもの: 写真(Gemini に送るだけ)、初期設定の完了記録、運動の開始設定(場所・器具)、経験レベル、連続日数、利用イベント(`lib/telemetry.ts` は端末内のみ)。

削除: 設定の「アカウントとすべてのデータを削除」→ `/api/participant/self-delete`。`profiles` の行を消すと、ほかのテーブルは外部キーの CASCADE で消える。認証アカウントの削除(`auth.admin.deleteUser`)の経路は本番で未検証(`STATUS.md`)。

## 7. 調査のための仕組み

- 同意は紙だけ(`docs/trial/data-use-agreement-ja.md`)。`profiles.consented_at` は、研究者が署名済みの同意書を確認したあとに SQL で入れる(`docs/trial/consent-roster.sql`)。migration 025 を適用すると、本人はこの列を変更できない。
- 集計(`docs/trial/cohort-queries.sql`)と研究エクスポート(`app/api/research/`)は、`consented_at` が入っている人だけを読む。
- SUS アンケートは、`consented_at` から 14 日たつと表示される(`lib/sus-gate.ts`、`components/SusSurveyCard.tsx`)。`consented_at` には同意書の署名日を入れるので、「使い始めて 14 日」ではなく「署名から 14 日」になる。研究者が記録するまでは表示されない。日本語訳は妥当性を確認していない(`STATUS.md`)。
- 目標の履歴(`goal_history`): 初期設定を完了したときと、設定を保存したときに、前回と違えば 1 行足す。目的は、本人が選んだ場合だけ記録する(初期設定の目的の質問に答えた、または設定で目的をタップして保存した)。選んでいなければ目的は NULL で、集計では「目標未設定」になる。初期設定で体の入力を飛ばした場合、栄養目標は NULL で記録し、サーバーの `profiles` も書き換えない。目標体重は設定画面でしか入力できない。記録日時はサーバーが付け、利用者は指定できない。
- 週あたりの運動の目標: 以前は `/plan` の計画(`TrainingProgram.weekSchedule`)から取っていたが、ADR-011 で `/plan` を削除したため、新しい参加者にはない(S5 の `planned_per_week` は NULL)。
- `study_cohort`(2 群の割り付け)は今後の利用者では NULL のまま。`lib/cohort.ts` は ADR-011 で削除した(git の履歴にある)。

## 8. 既知の制約

1. **2 台目の端末は空に見える。** サーバーから端末への読み戻しがない。2 台目で設定を保存すると、その端末の値でサーバーの `profiles` を上書きする。
2. **目標体重は初期設定で聞かない。** 設定画面で入力しないと、目標体重への到達率を計算できない。
3. **記録は自己入力。** 体重の測定条件はそろっていない。記録がない日は「食べなかった・運動しなかった」と区別できない。
4. **二重書き込みは失敗しても再送しない。** サーバーへの書き込みが失敗すると、コンソールに警告を出すだけで、その記録は端末にしか残らない。失敗の頻度は **未確認**。
5. **短時間の上限はサーバーのメモリ上。** Vercel の関数インスタンスごとに別々に数えるため、厳密な上限にはならない。
6. **外部の人はまだログインできない。** Google プロバイダの有効化、リダイレクト URL、サービスロールキーの設定が残っている(`STATUS.md`)。
7. **年齢の確認はコードにない。** 18 歳未満かどうかは、紙の同意書で確認する。
8. **初期設定の画面は日本語のみ。** そのほかの画面にも、英語表示で日本語が残る箇所がある(例: `/plan` の見出し、設定の健康プロフィール)。
9. **Gemini の無料枠の規約と合わない点がある。** 無料枠の規約は、個人情報や機微な情報を送らないこと、18 歳以上であること、医療上の助言に使わないことを求めている(https://ai.google.dev/gemini-api/terms 、2026-03-23 発効、2026-10-14 閲覧)。現行の実装は、記録と、4 つのルートでは持病・服薬を送る。扱いは指導教員と相談中。

## 9. 本番との差(このブランチで変わる点)

| 項目 | 本番(`main` `f8a3d37`) | このブランチ |
|---|---|---|
| ログイン後の同意画面 | `/consent` に必ず飛ばす | 画面とルート(`/consent`、`/api/consent`)を削除 |
| `consented_at` | 本人が同意画面で入れる | 研究者が SQL で入れる。本人は変更できない(migration 025 適用後) |
| 栄養目標・目標体重 | 一括移行のときだけサーバーに届く | 保存のたびに `profiles` に書く |
| 目標の履歴 | なし | `goal_history` に追記(migration 025 適用後) |
| Gemini の上限(429) | 「失敗しました」(500) | 上限と分かる文言(429) |

migration 025 は本番に未適用。適用前にこのブランチをデプロイすると、`goal_history` への書き込みだけが失敗し(警告のみ)、ほかは動く。

## 10. 確認した数値の出どころ

- 上限回数: `lib/rate-limit.ts` の `RATE_LIMITS`、`DAILY_QUOTAS`、`GLOBAL_DAILY_QUOTA`。
- 規則の件数: `lib/medication-rules.ts` の `CONDITION_RULES`(9)、`MEDICATION_RULES`(10)。
- テーブル数: `lib/database.types.ts` の `Tables`(30、`goal_history` を含む)。
- ページ数: `npm run build` の出力(2026-10-14)。
