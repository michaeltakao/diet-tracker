-- diet-tracker 6 か月調査 集計クエリ — 2026-10-14 改訂
--
-- 読み取り専用。SELECT のみで、テーブルもビューも作らない。
-- Supabase の SQL エディタ、または MCP の execute_sql で 1 本ずつ実行する。
-- 定義は配布開始前に固定した(研究計画スライド 10 枚目と同じ)。結果を見てから変えない。
--
-- 対象者   : profiles.consented_at が入っているユーザー
--            (= 研究者が書面の同意書を確認済み。consent-roster.sql で入れる)。
-- 対象データ: food_logs / weight_logs / workout_logs / goal_history / training_programs /
--             ai_usage と profiles の id・created_at・consented_at。
--             vital_logs / symptom_logs / profiles.health_conditions / medications は読まない。
-- day 0    : 初回ログイン日 = profiles.created_at を Asia/Tokyo に直した日付。
-- day_n    : logged_date − day 0。logged_date は端末のローカル日付(国内利用なら JST)。
-- 月 m     : day 30(m−1) 〜 30m−1。6 か月目 = day 150〜179。
-- 活動日   : 食事・体重・運動のいずれかを 1 件以上記録した日。
-- 開始時の目的: goal_history で fitness_goal が入っている最も古い行(NULL = 本人が目的を選んでいない)。
--            lose = weight_loss / gain = muscle_gain / maintain = maintenance /
--            other = endurance・flexibility / no_goal = 行がない(初期設定で目的を飛ばした人)。
-- 開始時の目標体重: day 0〜13 に記録された goal_history のうち、goal_weight_kg が入っている最初の行。
-- 統計     : 10〜30 人を 3 群に分けるので検定はしない。人数・中央値・範囲だけを出す。
--            対照群がないので、変化をアプリの効果とは書かない。
-- 注意     : 結果には user_id が出る。メモや論文に貼るときは連番に置き換える。
--            S 系 = 6 か月の指標(最終報告用)。W 系 = 週次の中間確認用。


-- ════════════════════════════════════════════════════════════════════════════
-- S 系: 6 か月の指標
-- ════════════════════════════════════════════════════════════════════════════

-- S0. 参加者一覧(day 0、経過日数、開始時の目的と目標体重)
with p as (
  select
    id as user_id,
    (created_at at time zone 'Asia/Tokyo')::date as day0,
    (consented_at at time zone 'Asia/Tokyo')::date as consent_marked_on,
    (now() at time zone 'Asia/Tokyo')::date - (created_at at time zone 'Asia/Tokyo')::date as age_days
  from public.profiles
  where consented_at is not null
), base_goal as (
  select distinct on (g.user_id) g.user_id, g.fitness_goal, g.recorded_at
  from public.goal_history g
  where g.fitness_goal is not null
  order by g.user_id, g.recorded_at
), base_gw as (
  select distinct on (g.user_id) g.user_id, g.goal_weight_kg
  from public.goal_history g
  join p on p.user_id = g.user_id
  where g.goal_weight_kg is not null
    and (g.recorded_at at time zone 'Asia/Tokyo')::date - p.day0 between 0 and 13
  order by g.user_id, g.recorded_at
)
select
  p.user_id,
  p.day0,
  p.consent_marked_on,
  p.age_days,
  bg.fitness_goal                                              as fitness_goal_raw,
  case
    when bg.fitness_goal is null then 'no_goal'
    when bg.fitness_goal = 'weight_loss' then 'lose'
    when bg.fitness_goal = 'muscle_gain' then 'gain'
    when bg.fitness_goal = 'maintenance' then 'maintain'
    else 'other'
  end                                                          as purpose,
  (bg.recorded_at at time zone 'Asia/Tokyo')::date - p.day0    as purpose_recorded_on_day_n,
  gw.goal_weight_kg                                            as start_goal_weight_kg,
  (select count(*) from public.goal_history g where g.user_id = p.user_id) as goal_rows
from p
left join base_goal bg on bg.user_id = p.user_id
left join base_gw   gw on gw.user_id = p.user_id
order by p.day0, p.user_id;


-- S1. 月ごとの継続(全体と目的別)
--     eligible = その月の窓が終わっている人(age_days >= 30m − 1)。
--     retained = その月の窓に活動日が 1 日以上ある人。6 か月継続 = month_n 6 の行。
--     purpose = '(all)' の行が全体。
with p as (
  select
    id as user_id,
    (created_at at time zone 'Asia/Tokyo')::date as day0,
    (now() at time zone 'Asia/Tokyo')::date - (created_at at time zone 'Asia/Tokyo')::date as age_days
  from public.profiles
  where consented_at is not null
), base_goal as (
  select distinct on (user_id) user_id, fitness_goal
  from public.goal_history
  where fitness_goal is not null
  order by user_id, recorded_at
), pp as (
  select p.*,
    case
      when bg.fitness_goal is null then 'no_goal'
      when bg.fitness_goal = 'weight_loss' then 'lose'
      when bg.fitness_goal = 'muscle_gain' then 'gain'
      when bg.fitness_goal = 'maintenance' then 'maintain'
      else 'other'
    end as purpose
  from p left join base_goal bg on bg.user_id = p.user_id
), act as (
  select user_id, logged_date from public.food_logs
  union
  select user_id, logged_date from public.weight_logs
  union
  select user_id, logged_date from public.workout_logs
), months as (
  select generate_series(1, 6) as month_n
), um as (
  select
    pp.user_id, pp.purpose, m.month_n,
    pp.age_days >= 30 * m.month_n - 1 as eligible,
    exists (
      select 1 from act a
      where a.user_id = pp.user_id
        and a.logged_date - pp.day0 between 30 * (m.month_n - 1) and 30 * m.month_n - 1
    ) as active
  from pp cross join months m
)
select
  coalesce(purpose, '(all)')                          as purpose,
  month_n,
  count(*)                                            as enrolled,
  count(*) filter (where eligible)                    as eligible,
  count(*) filter (where eligible and active)         as retained,
  round(100.0 * count(*) filter (where eligible and active)
        / nullif(count(*) filter (where eligible), 0), 1) as retained_pct
from um
group by grouping sets ((purpose, month_n), (month_n))
order by (purpose is null) desc, purpose, month_n;


-- S2. 脱落までの期間(ユーザー別)
--     観察は day 179 で打ち切る。follow_up_end = min(経過日数, 179)。
--     last_active_day_n = day 0〜179 の最後の活動日(記録なしは NULL)。
--     dropped = follow_up_end − last_active_day_n >= 30(一度も記録していない人は dropped)。
--     time_days = dropped なら最後の活動日(記録なしは 0)、そうでなければ follow_up_end(打ち切り)。
with p as (
  select
    id as user_id,
    (created_at at time zone 'Asia/Tokyo')::date as day0,
    least((now() at time zone 'Asia/Tokyo')::date - (created_at at time zone 'Asia/Tokyo')::date, 179) as follow_up_end
  from public.profiles
  where consented_at is not null
), act as (
  select user_id, logged_date from public.food_logs
  union
  select user_id, logged_date from public.weight_logs
  union
  select user_id, logged_date from public.workout_logs
), last_day as (
  select p.user_id, p.follow_up_end,
         max(a.logged_date - p.day0) filter (where a.logged_date - p.day0 between 0 and 179) as last_active_day_n,
         count(distinct a.logged_date) filter (where a.logged_date - p.day0 between 0 and 179) as active_days
  from p left join act a on a.user_id = p.user_id
  group by p.user_id, p.follow_up_end
)
select
  user_id,
  follow_up_end,
  active_days,
  last_active_day_n,
  (last_active_day_n is null or follow_up_end - last_active_day_n >= 30) as dropped,
  case
    when last_active_day_n is null then 0
    when follow_up_end - last_active_day_n >= 30 then last_active_day_n
    else follow_up_end
  end as time_days
from last_day
order by time_days, user_id;

-- S2b. 継続曲線(Kaplan–Meier、全体のみ)
--      S2 と同じ定義。t = 脱落が起きた日、at_risk = その日まで観察が続いていた人数、
--      survival = Π(1 − dropped / at_risk)。全員が脱落した時点以降は 0。
with p as (
  select
    id as user_id,
    (created_at at time zone 'Asia/Tokyo')::date as day0,
    least((now() at time zone 'Asia/Tokyo')::date - (created_at at time zone 'Asia/Tokyo')::date, 179) as follow_up_end
  from public.profiles
  where consented_at is not null
), act as (
  select user_id, logged_date from public.food_logs
  union
  select user_id, logged_date from public.weight_logs
  union
  select user_id, logged_date from public.workout_logs
), last_day as (
  select p.user_id, p.follow_up_end,
         max(a.logged_date - p.day0) filter (where a.logged_date - p.day0 between 0 and 179) as last_active_day_n
  from p left join act a on a.user_id = p.user_id
  group by p.user_id, p.follow_up_end
), obs as (
  select
    user_id,
    (last_active_day_n is null or follow_up_end - last_active_day_n >= 30) as dropped,
    case
      when last_active_day_n is null then 0
      when follow_up_end - last_active_day_n >= 30 then last_active_day_n
      else follow_up_end
    end as time_days
  from last_day
), ev as (
  select
    o.time_days as t,
    count(*)    as dropped,
    (select count(*) from obs r where r.time_days >= o.time_days) as at_risk
  from obs o
  where o.dropped
  group by o.time_days
)
select
  t,
  at_risk,
  dropped,
  case
    when bool_or(dropped = at_risk) over (order by t) then 0
    else round(exp(sum(ln(nullif(1 - dropped::numeric / at_risk, 0))) over (order by t)), 3)
  end as survival
from ev
order by t;


-- S3. 目標体重への到達率(ユーザー別)
--     w0 = day 0〜13 の最初の体重、w6 = day 150〜179 の体重の中央値、
--     attainment = (w0 − w6) ÷ (w0 − 目標体重)。減量でも増量でも、目標の方向に進めば正。
--     status: ok / window_open(6 か月目の窓が終わっていない)/ no_w0 / no_goal_weight /
--             gap_under_1kg(開始時の差が 1 kg 未満、除外)/ no_w6(欠測、補完しない)。
with p as (
  select
    id as user_id,
    (created_at at time zone 'Asia/Tokyo')::date as day0,
    (now() at time zone 'Asia/Tokyo')::date - (created_at at time zone 'Asia/Tokyo')::date as age_days
  from public.profiles
  where consented_at is not null
), base_goal as (
  select distinct on (user_id) user_id, fitness_goal
  from public.goal_history
  where fitness_goal is not null
  order by user_id, recorded_at
), base_gw as (
  select distinct on (g.user_id) g.user_id, g.goal_weight_kg
  from public.goal_history g
  join p on p.user_id = g.user_id
  where g.goal_weight_kg is not null
    and (g.recorded_at at time zone 'Asia/Tokyo')::date - p.day0 between 0 and 13
  order by g.user_id, g.recorded_at
), w0 as (
  select distinct on (w.user_id) w.user_id, w.weight_kg
  from public.weight_logs w
  join p on p.user_id = w.user_id
  where w.logged_date - p.day0 between 0 and 13
  order by w.user_id, w.logged_date, w.logged_at
), w6 as (
  select w.user_id,
         percentile_cont(0.5) within group (order by w.weight_kg) as weight_kg,
         count(*) as weigh_ins
  from public.weight_logs w
  join p on p.user_id = w.user_id
  where w.logged_date - p.day0 between 150 and 179
  group by w.user_id
)
select
  p.user_id,
  case
    when bg.fitness_goal is null then 'no_goal'
    when bg.fitness_goal = 'weight_loss' then 'lose'
    when bg.fitness_goal = 'muscle_gain' then 'gain'
    when bg.fitness_goal = 'maintenance' then 'maintain'
    else 'other'
  end                                         as purpose,
  w0.weight_kg                                as w0_kg,
  gw.goal_weight_kg                           as goal_kg,
  round(w6.weight_kg::numeric, 1)             as w6_kg,
  w6.weigh_ins                                as month6_weigh_ins,
  case
    when p.age_days < 179            then 'window_open'
    when w0.weight_kg is null        then 'no_w0'
    when gw.goal_weight_kg is null   then 'no_goal_weight'
    when abs(w0.weight_kg - gw.goal_weight_kg) < 1 then 'gap_under_1kg'
    when w6.weight_kg is null        then 'no_w6'
    else 'ok'
  end                                         as status,
  case
    when p.age_days >= 179 and w6.weight_kg is not null
     and abs(w0.weight_kg - gw.goal_weight_kg) >= 1
    then round(((w0.weight_kg - w6.weight_kg::numeric) / (w0.weight_kg - gw.goal_weight_kg))::numeric, 2)
  end                                         as attainment
from p
left join base_goal bg on bg.user_id = p.user_id
left join base_gw   gw on gw.user_id = p.user_id
left join w0 on w0.user_id = p.user_id
left join w6 on w6.user_id = p.user_id
order by status, attainment desc nulls last, p.user_id;

-- S3b. 上の要約(全体と目的別)
--      finished = 6 か月目の窓が終わった人。evaluable = status が ok の人。
--      reached = attainment >= 1.00(目標体重に届いた、または超えた)。
--      reached_pct_of_evaluable と、欠測を「届かなかった」と数える reached_pct_of_finished を並べる。
with p as (
  select
    id as user_id,
    (created_at at time zone 'Asia/Tokyo')::date as day0,
    (now() at time zone 'Asia/Tokyo')::date - (created_at at time zone 'Asia/Tokyo')::date as age_days
  from public.profiles
  where consented_at is not null
), base_goal as (
  select distinct on (user_id) user_id, fitness_goal
  from public.goal_history
  where fitness_goal is not null
  order by user_id, recorded_at
), base_gw as (
  select distinct on (g.user_id) g.user_id, g.goal_weight_kg
  from public.goal_history g
  join p on p.user_id = g.user_id
  where g.goal_weight_kg is not null
    and (g.recorded_at at time zone 'Asia/Tokyo')::date - p.day0 between 0 and 13
  order by g.user_id, g.recorded_at
), w0 as (
  select distinct on (w.user_id) w.user_id, w.weight_kg
  from public.weight_logs w
  join p on p.user_id = w.user_id
  where w.logged_date - p.day0 between 0 and 13
  order by w.user_id, w.logged_date, w.logged_at
), w6 as (
  select w.user_id, percentile_cont(0.5) within group (order by w.weight_kg) as weight_kg
  from public.weight_logs w
  join p on p.user_id = w.user_id
  where w.logged_date - p.day0 between 150 and 179
  group by w.user_id
), per_user as (
  select
    p.user_id,
    case
      when bg.fitness_goal is null then 'no_goal'
      when bg.fitness_goal = 'weight_loss' then 'lose'
      when bg.fitness_goal = 'muscle_gain' then 'gain'
      when bg.fitness_goal = 'maintenance' then 'maintain'
      else 'other'
    end as purpose,
    p.age_days >= 179 as finished,
    case
      when p.age_days >= 179 and w6.weight_kg is not null
       and abs(w0.weight_kg - gw.goal_weight_kg) >= 1
      then (w0.weight_kg - w6.weight_kg::numeric) / (w0.weight_kg - gw.goal_weight_kg)
    end as attainment
  from p
  left join base_goal bg on bg.user_id = p.user_id
  left join base_gw   gw on gw.user_id = p.user_id
  left join w0 on w0.user_id = p.user_id
  left join w6 on w6.user_id = p.user_id
)
select
  coalesce(purpose, '(all)')                                   as purpose,
  count(*)                                                     as enrolled,
  count(*) filter (where finished)                             as finished,
  count(attainment)                                            as evaluable,
  count(*) filter (where finished) - count(attainment)         as finished_not_evaluable,
  round((percentile_cont(0.5) within group (order by attainment))::numeric, 2) as median_attainment,
  round(min(attainment)::numeric, 2)                           as min_attainment,
  round(max(attainment)::numeric, 2)                           as max_attainment,
  count(*) filter (where attainment >= 1)                      as reached,
  round(100.0 * count(*) filter (where attainment >= 1) / nullif(count(attainment), 0), 1)
                                                               as reached_pct_of_evaluable,
  round(100.0 * count(*) filter (where attainment >= 1) / nullif(count(*) filter (where finished), 0), 1)
                                                               as reached_pct_of_finished
from per_user
group by grouping sets ((purpose), ())
order by (purpose is null) desc, purpose;


-- S4. 維持の達成(開始時の目的が「維持」の人)
--     change_pct = |w6 − w0| ÷ w0 × 100。maintained = 3% 以内。
--     w0 か w6 がなければ maintained は NULL(欠測。補完しない)。
with p as (
  select
    id as user_id,
    (created_at at time zone 'Asia/Tokyo')::date as day0,
    (now() at time zone 'Asia/Tokyo')::date - (created_at at time zone 'Asia/Tokyo')::date as age_days
  from public.profiles
  where consented_at is not null
), base_goal as (
  select distinct on (user_id) user_id, fitness_goal
  from public.goal_history
  where fitness_goal is not null
  order by user_id, recorded_at
), w0 as (
  select distinct on (w.user_id) w.user_id, w.weight_kg
  from public.weight_logs w
  join p on p.user_id = w.user_id
  where w.logged_date - p.day0 between 0 and 13
  order by w.user_id, w.logged_date, w.logged_at
), w6 as (
  select w.user_id, percentile_cont(0.5) within group (order by w.weight_kg) as weight_kg
  from public.weight_logs w
  join p on p.user_id = w.user_id
  where w.logged_date - p.day0 between 150 and 179
  group by w.user_id
)
select
  p.user_id,
  p.age_days >= 179                                                  as finished,
  w0.weight_kg                                                       as w0_kg,
  round(w6.weight_kg::numeric, 1)                                    as w6_kg,
  round((100 * abs(w6.weight_kg::numeric - w0.weight_kg) / w0.weight_kg)::numeric, 1) as change_pct,
  case when p.age_days >= 179
       then abs(w6.weight_kg::numeric - w0.weight_kg) / w0.weight_kg <= 0.03 end as maintained
from p
join base_goal bg on bg.user_id = p.user_id and bg.fitness_goal = 'maintenance'
left join w0 on w0.user_id = p.user_id
left join w6 on w6.user_id = p.user_id
order by p.user_id;


-- S5. 運動の頻度(ユーザー別、1 か月目と 6 か月目)
--     per_week = その月の運動日数 ÷ (30 / 7)。
--     planned_per_week = 有効なトレーニング計画の weekSchedule で、セッションが入っている曜日の数。
--       計画は上書き保存で履歴がないため、集計時点の計画を使う(開始時の計画とは限らない)。
--     adherence = per_week ÷ planned_per_week(計画がない人は NULL)。
--     6 か月目の値は、窓が終わっていない人は NULL。
--     6 か月目に運動の記録がない人は 0 として入る。脱落した人と、続けているが運動しなかった人を
--     この表では区別できない。S2 の dropped と並べて読む。
with p as (
  select
    id as user_id,
    (created_at at time zone 'Asia/Tokyo')::date as day0,
    (now() at time zone 'Asia/Tokyo')::date - (created_at at time zone 'Asia/Tokyo')::date as age_days
  from public.profiles
  where consented_at is not null
), base_goal as (
  select distinct on (user_id) user_id, fitness_goal
  from public.goal_history
  where fitness_goal is not null
  order by user_id, recorded_at
), wd as (
  select
    p.user_id,
    count(distinct k.logged_date) filter (where k.logged_date - p.day0 between 0 and 29)    as m1_days,
    count(distinct k.logged_date) filter (where k.logged_date - p.day0 between 150 and 179) as m6_days
  from p left join public.workout_logs k on k.user_id = p.user_id
  group by p.user_id
), plan as (
  select t.user_id,
         max((select count(*) from jsonb_each_text(t.data -> 'weekSchedule') s where s.value <> '')) as planned_per_week
  from public.training_programs t
  where t.is_active
  group by t.user_id
)
select
  p.user_id,
  case
    when bg.fitness_goal is null then 'no_goal'
    when bg.fitness_goal = 'weight_loss' then 'lose'
    when bg.fitness_goal = 'muscle_gain' then 'gain'
    when bg.fitness_goal = 'maintenance' then 'maintain'
    else 'other'
  end                                                             as purpose,
  case when p.age_days >= 29  then round(wd.m1_days / (30 / 7.0), 2) end as m1_per_week,
  case when p.age_days >= 179 then round(wd.m6_days / (30 / 7.0), 2) end as m6_per_week,
  case when p.age_days >= 179 then round((wd.m6_days - wd.m1_days) / (30 / 7.0), 2) end as change_per_week,
  nullif(plan.planned_per_week, 0)                                as planned_per_week,
  case when p.age_days >= 29
       then round(wd.m1_days / (30 / 7.0) / nullif(plan.planned_per_week, 0), 2) end as m1_adherence,
  case when p.age_days >= 179
       then round(wd.m6_days / (30 / 7.0) / nullif(plan.planned_per_week, 0), 2) end as m6_adherence
from p
join wd on wd.user_id = p.user_id
left join base_goal bg on bg.user_id = p.user_id
left join plan on plan.user_id = p.user_id
order by purpose, p.user_id;

-- S5b. 上の要約(全体と目的別、6 か月目の窓が終わった人だけ)
with p as (
  select
    id as user_id,
    (created_at at time zone 'Asia/Tokyo')::date as day0,
    (now() at time zone 'Asia/Tokyo')::date - (created_at at time zone 'Asia/Tokyo')::date as age_days
  from public.profiles
  where consented_at is not null
), base_goal as (
  select distinct on (user_id) user_id, fitness_goal
  from public.goal_history
  where fitness_goal is not null
  order by user_id, recorded_at
), wd as (
  select
    p.user_id,
    case
      when bg.fitness_goal is null then 'no_goal'
      when bg.fitness_goal = 'weight_loss' then 'lose'
      when bg.fitness_goal = 'muscle_gain' then 'gain'
      when bg.fitness_goal = 'maintenance' then 'maintain'
      else 'other'
    end as purpose,
    count(distinct k.logged_date) filter (where k.logged_date - p.day0 between 0 and 29)    / (30 / 7.0) as m1,
    count(distinct k.logged_date) filter (where k.logged_date - p.day0 between 150 and 179) / (30 / 7.0) as m6
  from p
  left join base_goal bg on bg.user_id = p.user_id
  left join public.workout_logs k on k.user_id = p.user_id
  where p.age_days >= 179
  group by p.user_id, bg.fitness_goal
)
select
  coalesce(purpose, '(all)')                                              as purpose,
  count(*)                                                                as finished,
  round((percentile_cont(0.5) within group (order by m1))::numeric, 2)      as median_m1_per_week,
  round((percentile_cont(0.5) within group (order by m6))::numeric, 2)      as median_m6_per_week,
  round((percentile_cont(0.5) within group (order by m6 - m1))::numeric, 2) as median_change_per_week,
  round(min(m6 - m1)::numeric, 2)                                         as min_change_per_week,
  round(max(m6 - m1)::numeric, 2)                                         as max_change_per_week
from wd
group by grouping sets ((purpose), ())
order by (purpose is null) desc, purpose;


-- ════════════════════════════════════════════════════════════════════════════
-- W 系: 週次の中間確認
-- ════════════════════════════════════════════════════════════════════════════

-- W1. 中止条件 1(開始 4 週間 = day 0〜27 に活動日が 3 日以上ある人数。5 人未満なら配布を止める)
--     中止条件 2(3 か月時点の継続が 5 人未満)は S1 の month_n = 3、purpose = '(all)' の retained を見る。
with p as (
  select id as user_id, (created_at at time zone 'Asia/Tokyo')::date as day0
  from public.profiles
  where consented_at is not null
), act as (
  select user_id, logged_date from public.food_logs
  union
  select user_id, logged_date from public.weight_logs
  union
  select user_id, logged_date from public.workout_logs
), per_user as (
  select p.user_id,
         count(a.logged_date) filter (where a.logged_date - p.day0 between 0 and 27) as active_days_4w
  from p left join act a on a.user_id = p.user_id
  group by p.user_id
)
select
  count(*)                                                    as participants,
  count(*) filter (where active_days_4w >= 3)                 as with_3plus_active_days_in_4w,
  percentile_cont(0.5) within group (order by active_days_4w) as median_active_days_4w
from per_user;

-- W2. 週あたり活動日数(ユーザー × 週。week_n = floor(day_n / 7))
with p as (
  select id as user_id, (created_at at time zone 'Asia/Tokyo')::date as day0
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
  floor((a.logged_date - p.day0) / 7.0)::int as week_n,
  count(*)                                   as active_days
from p
join act a on a.user_id = p.user_id
group by p.user_id, week_n
order by p.user_id, week_n;

-- W3. 目標の入力状況(week 1 のお願い「目標体重を入れる」ができているか)
with p as (
  select id as user_id, (created_at at time zone 'Asia/Tokyo')::date as day0
  from public.profiles
  where consented_at is not null
)
select
  count(*)                                                                    as participants,
  count(*) filter (where exists (
    select 1 from public.goal_history g
    where g.user_id = p.user_id and g.fitness_goal is not null))             as with_purpose,
  count(*) filter (where exists (
    select 1 from public.goal_history g
    where g.user_id = p.user_id and g.goal_weight_kg is not null
      and (g.recorded_at at time zone 'Asia/Tokyo')::date - p.day0 between 0 and 13))
                                                                              as with_goal_weight_by_day13,
  count(*) filter (where exists (
    select 1 from public.weight_logs w
    where w.user_id = p.user_id and w.logged_date - p.day0 between 0 and 13)) as with_w0
from p;

-- W4. AI 機能の利用回数(日 × ルート、全参加者の合計)
--     無料枠の上限は全員で共有する。上限に達した日がないかを見る。
--     ai_usage は成功した呼び出しだけを数えるので、上限で失敗した回数は出ない。
select
  u.usage_date,
  u.route,
  sum(u.calls)              as calls,
  count(distinct u.user_id) as users
from public.ai_usage u
join public.profiles p on p.id = u.user_id
where p.consented_at is not null
group by u.usage_date, u.route
order by u.usage_date desc, calls desc;

-- W5. 同意を確認していないアカウントの数(署名なしの登録が増えていないか。中身は読まない)
select
  count(*) filter (where consented_at is not null) as consent_marked,
  count(*) filter (where consented_at is null)     as not_marked
from public.profiles;
