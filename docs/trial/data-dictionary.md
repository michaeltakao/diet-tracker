# データ辞書 — 6 か月調査で分析に使う列

2026-11-10 作成(vault ADR-008「Analysis-plan items」)。対象は
`docs/trial/cohort-queries.sql` が読む列と、その解釈に要る列。
コードの参照先は `fix/study-p0` ブランチ(`main` へのマージ前)の時点。

## 共通ルール

| 項目 | 内容 |
|---|---|
| 日付(`logged_date`, DATE) | 記録した日の **JST** の暦日。クライアントが `lib/format-date.ts` `todayJst()` / `toJstDate()` で作る(ADR-008 P0-1、`a6c43db`)。**P0-1 より前に保存された行は UTC の日付**で、JST 0〜9 時の記録は前日になっている。調査では day 0(`study_start_at`)以降の行だけを使う。 |
| 時刻(`logged_at` / `recorded_at` / `reported_at`, TIMESTAMPTZ) | UTC で保存。JST に直すときは `at time zone 'Asia/Tokyo'`。 |
| `created_at` | サーバーに最初に届いた時刻(`DEFAULT now()`)。upsert では最初の値が残る。記録した時刻ではないので、分析には使わない(怪しい行の目印にだけ使う)。 |
| 端末のタイムゾーン | **記録していない。** 日付はすべて JST 前提で作る。国外で使った参加者の日付は端末の現地日付と一致しない。**ルール(2026-11-12 決定):** データからは誰も除かない。国外に出た期間は参加者に申告してもらい、主分析はそのまま、申告された日を除いた感度分析を並べて報告する。 |
| ビルド(`build_sha`, `study_build`) | food / weight / workout の行を最後に書いたビルド(`lib/build-stamp.ts`、migration 027)。NULL = 027 以前の行か、`lib/migrate.ts` の一括移行。 |
| 届かなかった行 | food / weight / workout は端末の IndexedDB の送信キュー(`lib/data/outbox.ts`、P0-6)を通る。送れなかった行は端末に残り、再送される。永続エラーで捨てた行と、まだ送れていない行の数は `client_sync_health` に出る(下記)。**その参加者の「記録のない日」を未使用と読む前に確認する。** goal_history / training_programs / ai_usage はキューを通らない(失敗したら端末にだけ残る)。 |

## profiles(参加者)

| 列 | 型 | 出所 | 欠測 |
|---|---|---|---|
| `id` | UUID | Supabase Auth のユーザー ID | — |
| `consented_at` | TIMESTAMPTZ | **研究者が手で入れる**(`docs/trial/consent-roster.sql` R2)。書面の同意書を確認した印。利用者は変更できない(migration 025 のトリガー) | NULL = 対象外 |
| `study_start_at` | TIMESTAMPTZ | **研究者が手で入れる**(同 R2、migration 026)。day 0 = この JST 日付 | NULL = 対象外 |

## food_logs(食事)

書き込み: `lib/data/food.ts` `foodRow()` → `lib/data/outbox.ts`。画面: `app/add/page.tsx`。

| 列 | 型 | 出所・意味 | 欠測の表し方 |
|---|---|---|---|
| `logged_date` | DATE | 保存した日(JST、`app/add/page.tsx` `getTodayDate()` = `todayJst()`)。/add からは今日の日付でしか記録できない | — |
| `meal_type` | enum | breakfast / lunch / dinner / snack。利用者が選ぶ(既定は時刻から推定) | — |
| `calories` | INTEGER ≥ 0 | 利用者の入力、または写真 AI / バーコード / 成分表示の値 × 量 | — |
| `protein_g` / `fat_g` / `carbs_g` | NUMERIC ≥ 0 | 同上 | **0 と未入力を区別できない**(`NOT NULL DEFAULT 0`)。今は P/F/C が入力必須なので 0 は実際の 0。任意にするなら `macros_entered`(P0-13、`supabase/drafts/029_food_macros_entered.sql`、未適用)を先に入れる |
| `source` | TEXT | manual / ai / db / barcode(`lib/types.ts` `FoodSource`)。最近の食事からのクイック追加は元の値を引き継ぐ | NULL = 古い行 |
| `servings` / `amount_g` | NUMERIC | 量のステッパー | NULL = 未使用 |
| `logged_at` | TIMESTAMPTZ | 利用者が選んだ食事時刻(JST の日付 + HH:MM → UTC、`jstTimestamp`) | — |
| `photo_url` | TEXT | 使っていない(写真はサーバーにも端末にも保存しない、P0-2) | NULL |

## weight_logs(体重)

書き込み: `lib/data/weight.ts` → outbox。画面: `app/weight/page.tsx`、初期設定 `app/onboarding/page.tsx`。

| 列 | 型 | 出所・意味 | 欠測の表し方 |
|---|---|---|---|
| `logged_date` | DATE | JST の日付。**(user_id, logged_date) で 1 行**(同じ日に入れ直すと上書き) | — |
| `weight_kg` | NUMERIC(5,2), 0 < x < 700 | 利用者の入力。初期設定でステッパーに触れなかった場合は**行を作らない**(P0-5、`fa76cef`)。それより前の初期設定は 60 kg の仮の値を保存していた | 行がない |
| `logged_at` | TIMESTAMPTZ | 保存した時刻。再送時の後勝ちの比較に使う(同じ日の値は `logged_at` が新しい方が残る) | — |

クリーニング規則(分析計画の補足、ADR-008): 初期設定の既定値と同じ値で初期設定中に書かれた体重は除く。前日比 3 kg を超える変化には印を付ける(除外はしない)。

## workout_logs(運動)

書き込み: `lib/data/workout.ts` `workoutRow()` → outbox。画面: `app/workout/page.tsx`。

| 列 | 型 | 出所・意味 | 欠測の表し方 |
|---|---|---|---|
| `logged_date` | DATE | JST の日付 | — |
| `name` / `category` / `muscle_part` | TEXT / enum | 種目 | `muscle_part` NULL = 有酸素・柔軟 |
| `sets` / `reps` / `weight_kg` / `duration_min` | 数値 | 利用者の入力 | NULL = 入力なし |
| `logged_at` | TIMESTAMPTZ | 記録時刻 | — |

## goal_history(目的・目標体重の履歴)

書き込み: `lib/data/goal-history.ts` `recordGoalSnapshot()`(insert のみ、送信キューなし)。

| 列 | 型 | 出所・意味 | 欠測の表し方 |
|---|---|---|---|
| `recorded_at` | TIMESTAMPTZ | サーバー時刻(トリガーで `now()` に固定、migration 025) | — |
| `fitness_goal` | TEXT | weight_loss / muscle_gain / maintenance / endurance / flexibility | NULL = 選んでいない → `no_goal` |
| `goal_weight_kg` | NUMERIC | 目標体重。初期設定でステッパーに触れたときだけ入る(P0-12、`ba225e9`) | NULL = 未設定 → `no_goal_weight` |

開始時の値の選び方は `cohort-queries.sql` の冒頭(「開始時の目的」「開始時の目標体重」)が正。

## training_programs(運動計画)

書き込み: `lib/data/training-plan.ts`(upsert、送信キューなし)。`data -> 'weekSchedule'` の空でない曜日数 = 週あたりの予定回数。`is_active` の計画だけ使う。

## ai_usage(AI 利用回数)

書き込み: `lib/api-guard.ts` `recordAiUsage()`(サーバー側、AI が成功したときだけ)。`usage_date` = JST の日付、`route` = API 名、`calls` = 回数。AI が失敗した呼び出しは数えない。generate-workout は AI が使えないときも計画を返す(P0-4)ので、**運動計画の表示回数 ≠ ai_usage の generate-workout 回数**。

## client_sync_health(端末の送信状況、migration 028 — 本番に適用済み 2026-11-12)

書き込み: `lib/data/outbox.ts` `reportHealth()`、アプリを開くたびに 1 行。値は前回の報告からの増分。

| 列 | 意味 |
|---|---|
| `synced_count` | 送れた件数 |
| `failed_count` | 一時的な失敗(再送待ち)の回数 |
| `dropped_count` | 永続エラーで**捨てた**件数 = サーバーに届かなかった記録 |
| `superseded_count` | 他の端末の新しい体重があったので送らなかった件数 |
| `queued_count` / `oldest_queued_at` | 報告時点で端末に残っている件数と、その最古の時刻 |

参加者ごとに `sum(dropped_count) > 0`、または最新の `queued_count > 0` が続く場合は、その人のサーバー上の記録が欠けている。端末が申告する値なので監査証跡ではない。

**ルール(2026-11-12 決定、集計は `cohort-queries.sql` の W6):** 該当する参加者も主分析に入れる。その人の記録のない日は「未使用」ではなく「不明」と書く。該当人数を報告し、その人を除いた感度分析を並べて報告する。報告が 1 行もない参加者は欠けの有無が分からないので、人数を別に書く。
