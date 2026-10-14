-- diet-tracker 試用(家族・知人 10〜30 人)集計クエリ — 2026-10-14
--
-- 読み取り専用。SELECT のみで、テーブルもビューも作らない。
-- Supabase の SQL エディタ、または MCP の execute_sql で 1 本ずつ実行する。
--
-- 対象者   : profiles.consented_at が入っているユーザー。
-- 対象データ: food_logs / weight_logs / workout_logs の 3 テーブルと、その行数・日時。
--             vital_logs / symptom_logs / profiles.health_conditions / medications は
--             読まない(/consent の説明と紙の誓約書に合わせる)。
-- 日付     : 活動日 = logged_date(端末のローカル日付。国内利用なら JST)。
--             同意日 = consented_at を Asia/Tokyo に直した日付。
-- 活動日   : 食事・体重・運動のいずれかを 1 件以上記録した日。
-- 経過日数 : day_n = logged_date − 同意日(同意当日 = 0)。
-- 週       : week_n = floor(day_n / 7)(同意日からの 7 日区切り、最初の週 = 0)。
-- 統計     : 10〜30 人なので検定はしない。中央値とユーザー別の表だけを出す。
-- 注意     : 結果には user_id が出る。週次メモに貼るときは連番に置き換える。


-- Q0. 参加者一覧(同意日と経過日数)
select
  p.id                                                   as user_id,
  (p.consented_at at time zone 'Asia/Tokyo')::date       as consent_date,
  (now() at time zone 'Asia/Tokyo')::date
    - (p.consented_at at time zone 'Asia/Tokyo')::date   as days_since_consent
from public.profiles p
where p.consented_at is not null
order by p.consented_at;


-- Q1. 初回記録までの時間(同意 → 最初の食事・体重・運動の記録)
--     同意前の記録は proxy.ts が /consent に戻すため通常は存在しない。
--     負の値が出たら、その経路を調べる。
with act as (
  select user_id, created_at from public.food_logs
  union all
  select user_id, created_at from public.weight_logs
  union all
  select user_id, created_at from public.workout_logs
), first_rec as (
  select user_id, min(created_at) as first_record_at
  from act
  group by user_id
)
select
  p.id                                    as user_id,
  p.consented_at,
  f.first_record_at,
  round((extract(epoch from (f.first_record_at - p.consented_at)) / 60)::numeric, 1)
                                          as minutes_to_first_record
from public.profiles p
left join first_rec f on f.user_id = p.id
where p.consented_at is not null
order by minutes_to_first_record nulls last;

-- Q1b. 上の中央値(未記録の人は分母から外れる。未記録の人数も並べて出す)
with act as (
  select user_id, created_at from public.food_logs
  union all
  select user_id, created_at from public.weight_logs
  union all
  select user_id, created_at from public.workout_logs
), first_rec as (
  select user_id, min(created_at) as first_record_at
  from act
  group by user_id
)
select
  count(*)                                                      as consented_users,
  count(f.user_id)                                              as users_with_a_record,
  count(*) - count(f.user_id)                                   as users_without_a_record,
  round((percentile_cont(0.5) within group (
    order by extract(epoch from (f.first_record_at - p.consented_at)) / 60
  ))::numeric, 1)                                               as median_minutes_to_first_record
from public.profiles p
left join first_rec f on f.user_id = p.id
where p.consented_at is not null;


-- Q2. 継続(同意から N 日目以降に活動日がある人数、N = 1 / 7 / 14 / 28)
--     eligible_dN = 同意から N 日以上たっている人数(分母)。
--     まだ N 日たっていない人を分母に入れると継続率が低く見えるため分ける。
with p as (
  select
    id as user_id,
    (consented_at at time zone 'Asia/Tokyo')::date as consent_date,
    (now() at time zone 'Asia/Tokyo')::date
      - (consented_at at time zone 'Asia/Tokyo')::date as age_days
  from public.profiles
  where consented_at is not null
), act as (
  select user_id, logged_date from public.food_logs
  union
  select user_id, logged_date from public.weight_logs
  union
  select user_id, logged_date from public.workout_logs
), last_day as (
  select p.user_id, p.age_days, max(a.logged_date - p.consent_date) as last_day_n
  from p
  left join act a on a.user_id = p.user_id
  group by p.user_id, p.age_days
)
select
  count(*)                                                    as consented_users,
  count(*) filter (where last_day_n is not null)              as ever_active,
  count(*) filter (where age_days >= 1)                       as eligible_d1,
  count(*) filter (where age_days >= 1  and last_day_n >= 1)  as retained_d1,
  count(*) filter (where age_days >= 7)                       as eligible_d7,
  count(*) filter (where age_days >= 7  and last_day_n >= 7)  as retained_d7,
  count(*) filter (where age_days >= 14)                      as eligible_d14,
  count(*) filter (where age_days >= 14 and last_day_n >= 14) as retained_d14,
  count(*) filter (where age_days >= 28)                      as eligible_d28,
  count(*) filter (where age_days >= 28 and last_day_n >= 28) as retained_d28
from last_day;

-- Q2b. 中止条件の確認(活動日が 3 日以上ある人数。4 週間で 5 人未満なら見直し)
with act as (
  select user_id, logged_date from public.food_logs
  union
  select user_id, logged_date from public.weight_logs
  union
  select user_id, logged_date from public.workout_logs
), per_user as (
  select p.id as user_id, count(a.logged_date) as active_days
  from public.profiles p
  left join act a on a.user_id = p.id
  where p.consented_at is not null
  group by p.id
)
select
  count(*)                                  as consented_users,
  count(*) filter (where active_days >= 3)  as users_with_3plus_active_days,
  percentile_cont(0.5) within group (order by active_days) as median_active_days
from per_user;


-- Q3. 週あたり活動日数(ユーザー × 週)
with p as (
  select id as user_id, (consented_at at time zone 'Asia/Tokyo')::date as consent_date
  from public.profiles
  where consented_at is not null
), act as (
  select user_id, logged_date from public.food_logs
  union
  select user_id, logged_date from public.weight_logs
  union
  select user_id, logged_date from public.workout_logs
)
select
  p.user_id,
  floor((a.logged_date - p.consent_date) / 7.0)::int as week_n,
  count(*)                                           as active_days
from p
join act a on a.user_id = p.user_id
group by p.user_id, week_n
order by p.user_id, week_n;

-- Q3b. 週ごとの中央値(その週に 1 日以上活動した人だけが分母)
with p as (
  select id as user_id, (consented_at at time zone 'Asia/Tokyo')::date as consent_date
  from public.profiles
  where consented_at is not null
), act as (
  select user_id, logged_date from public.food_logs
  union
  select user_id, logged_date from public.weight_logs
  union
  select user_id, logged_date from public.workout_logs
), per_week as (
  select
    p.user_id,
    floor((a.logged_date - p.consent_date) / 7.0)::int as week_n,
    count(*) as active_days
  from p
  join act a on a.user_id = p.user_id
  group by p.user_id, week_n
)
select
  week_n,
  count(*)                                                 as active_users,
  percentile_cont(0.5) within group (order by active_days) as median_active_days
from per_week
group by week_n
order by week_n;


-- Q4. 機能の使われ方(ユーザー × 週 × テーブルの行数)
--     行数だけを数える。水分・歩数・体調チェックは「使われたか」を見るために含める。
--     vital_logs / symptom_logs は数えない。
with p as (
  select id as user_id, (consented_at at time zone 'Asia/Tokyo')::date as consent_date
  from public.profiles
  where consented_at is not null
), rows_ as (
  select 'food_logs'    as tbl, user_id, logged_date from public.food_logs
  union all
  select 'weight_logs'  as tbl, user_id, logged_date from public.weight_logs
  union all
  select 'workout_logs' as tbl, user_id, logged_date from public.workout_logs
  union all
  select 'water_logs'   as tbl, user_id, logged_date from public.water_logs
  union all
  select 'steps_logs'   as tbl, user_id, logged_date from public.steps_logs
  union all
  select 'checkins'     as tbl, user_id, logged_date from public.checkins
)
select
  p.user_id,
  floor((r.logged_date - p.consent_date) / 7.0)::int as week_n,
  r.tbl,
  count(*)                                           as row_count
from p
join rows_ r on r.user_id = p.user_id
group by p.user_id, week_n, r.tbl
order by p.user_id, week_n, r.tbl;

-- Q4b. AI 機能の利用回数(ユーザー × ルート)。費用の見積もりにも使う。
select
  u.user_id,
  u.route,
  sum(u.calls)        as calls,
  sum(u.est_tokens)   as est_tokens,
  count(*)            as days_used
from public.ai_usage u
join public.profiles p on p.id = u.user_id
where p.consented_at is not null
group by u.user_id, u.route
order by u.user_id, calls desc;


-- Q5. 食事の中身(ユーザー別、記録のある日だけを対象にした 1 日あたりの中央値)
--     記録漏れのある日は実際の摂取量より少なく出る。値は「記録された量」として読む。
with daily as (
  select
    f.user_id,
    f.logged_date,
    sum(f.calories)  as kcal,
    sum(f.protein_g) as protein_g,
    sum(f.fat_g)     as fat_g,
    sum(f.carbs_g)   as carbs_g,
    count(*)         as entries
  from public.food_logs f
  join public.profiles p on p.id = f.user_id
  where p.consented_at is not null
  group by f.user_id, f.logged_date
)
select
  user_id,
  count(*)                                                                   as days_logged,
  round((percentile_cont(0.5) within group (order by kcal))::numeric)        as median_kcal,
  round((percentile_cont(0.5) within group (order by protein_g))::numeric)   as median_protein_g,
  round((percentile_cont(0.5) within group (order by fat_g))::numeric)       as median_fat_g,
  round((percentile_cont(0.5) within group (order by carbs_g))::numeric)     as median_carbs_g,
  round((percentile_cont(0.5) within group (order by entries))::numeric, 1)  as median_entries_per_day
from daily
group by user_id
order by days_logged desc;

-- Q5b. 入力経路の内訳(source: manual / ai / db / barcode、NULL は一括移行分)
select
  f.user_id,
  coalesce(f.source, '(null)') as source,
  count(*)                     as entries
from public.food_logs f
join public.profiles p on p.id = f.user_id
where p.consented_at is not null
group by f.user_id, coalesce(f.source, '(null)')
order by f.user_id, entries desc;

-- Q5c. 食事区分の内訳(朝・昼・夕・間食)
select
  f.user_id,
  f.meal_type,
  count(*)                      as entries,
  count(distinct f.logged_date) as days
from public.food_logs f
join public.profiles p on p.id = f.user_id
where p.consented_at is not null
group by f.user_id, f.meal_type
order by f.user_id, f.meal_type;


-- Q6. 体重(記録頻度と変化)
--     変化 = 同意から 28 日目までの最後の記録 − 最初の記録。
--     記録が 1 件だけなら change_kg は 0、span_days も 0 になる。
with w as (
  select
    w.user_id,
    w.weight_kg,
    w.logged_date,
    w.logged_at,
    w.logged_date - (p.consented_at at time zone 'Asia/Tokyo')::date as day_n
  from public.weight_logs w
  join public.profiles p on p.id = w.user_id
  where p.consented_at is not null
), win as (
  select * from w where day_n between 0 and 28
)
select
  user_id,
  count(*)                                                     as weigh_ins,
  count(distinct logged_date)                                  as days_weighed,
  max(logged_date) - min(logged_date)                          as span_days,
  (array_agg(weight_kg order by logged_date, logged_at))[1]            as first_kg,
  (array_agg(weight_kg order by logged_date desc, logged_at desc))[1]  as last_kg,
  round(((array_agg(weight_kg order by logged_date desc, logged_at desc))[1]
       - (array_agg(weight_kg order by logged_date, logged_at))[1])::numeric, 1)
                                                               as change_kg
from win
group by user_id
order by days_weighed desc;


-- Q7. 運動(ユーザー × 週の実施日数と記録数)
with p as (
  select id as user_id, (consented_at at time zone 'Asia/Tokyo')::date as consent_date
  from public.profiles
  where consented_at is not null
)
select
  p.user_id,
  floor((k.logged_date - p.consent_date) / 7.0)::int as week_n,
  count(distinct k.logged_date)                      as workout_days,
  count(*)                                           as logged_exercises
from p
join public.workout_logs k on k.user_id = p.user_id
group by p.user_id, week_n
order by p.user_id, week_n;

-- Q7b. 運動の内訳(種別 × 部位。部位は筋トレのみ、それ以外は NULL)
select
  k.user_id,
  k.category,
  coalesce(k.muscle_part::text, '(none)') as muscle_part,
  count(*)                                as logged_exercises,
  count(distinct k.logged_date)           as days
from public.workout_logs k
join public.profiles p on p.id = k.user_id
where p.consented_at is not null
group by k.user_id, k.category, coalesce(k.muscle_part::text, '(none)')
order by k.user_id, logged_exercises desc;
