-- diet-tracker 6 か月調査 — 同意の記録(研究者が手作業で実行する) — 2026-10-14
--
-- アプリ内に同意画面はない。同意は紙の「研究参加の説明文書・同意書」
-- (data-use-agreement-ja.md)だけで取る。profiles.consented_at は
-- 「研究者が署名済みの同意書を確認した」という印で、ここの UPDATE でだけ入れる。
-- 集計(cohort-queries.sql)と研究エクスポートは consented_at IS NOT NULL の人だけを読む。
-- profiles.study_start_at(migration 026)は調査の 0 日目。R2 で consented_at と同時に入れる。
-- 既定値 = greatest(署名日の正午 JST, アカウント作成時刻)。集計は day 0 より前の行を使わない
-- (家族トライアル期の記録を除くため。vault ADR-008 P0-9)。
--
-- 実行場所: Supabase ダッシュボードの SQL エディタ(RLS を通らない管理者権限)。
--           migration 025・026 以降、参加者本人はアプリからこの 2 列を変更できない。
-- 手順    : 1) 署名済みの同意書を受け取る → 2) 本人が初回ログインする →
--           3) 下の R1 で、同意書に書かれたメールアドレスのアカウントがあることを確かめる →
--           4) R2 で consented_at と study_start_at を入れる → 5) R3 で確かめる。
--           0 日目は人ごとに直してよい(例: URL を渡した日)。直すときは R2b を使い、理由を記録する。
-- 注意    : メールアドレスは同意書に書かれたものを 1 文字ずつ照合する。
--           同意書のない人のアドレスを入れない。このファイルに実際のアドレスを保存しない。


-- R0. 調査を始める前に 1 回だけ実行する(読み取りのみ)。0 でなければ止まる。
--     ここで出る行は、削除済みのアプリ内画面(「研究には使いません」と書いてあった)で
--     入った値で、研究への同意ではない。本人に書面で取り直すか、下の R4 と同じ UPDATE で
--     NULL に戻してから、最初の参加者を記録する。2026-10-14 時点の本番は 0 行。
select id, created_at, consented_at, study_start_at
from public.profiles
where consented_at is not null
   or study_start_at is not null;


-- R1. アカウントの確認(読み取りのみ)。行が出なければ、まだログインしていないか、
--     同意書と違うアドレスでログインしている。
select u.id, u.email, p.created_at, p.consented_at, p.study_start_at
from auth.users u
join public.profiles p on p.id = u.id
where lower(u.email) in (
  lower('participant1@example.com')   -- ← 同意書のメールアドレスに置き換える
);


-- R2. 同意と 0 日目の記録。日付は同意書の署名日(JST の正午として入れる)。
--     study_start_at は署名日の正午とアカウント作成時刻の遅いほう
--     (署名より後に初回ログインした人は、ログインした時点から数える)。
--     consented_at is null の条件があるので、すでに入っている人は上書きしない。
--     1 人ずつ実行し、「1 row」と出ることを確かめる。署名日は 2 か所とも同じ値にする。
update public.profiles p
set consented_at   = timestamptz '2026-12-01 12:00:00+09',                      -- ← 署名日に置き換える
    study_start_at = greatest(timestamptz '2026-12-01 12:00:00+09', p.created_at) -- ← 同じ署名日
from auth.users u
where u.id = p.id
  and lower(u.email) = lower('participant1@example.com')   -- ← 同意書のメールアドレスに置き換える
  and p.consented_at is null;


-- R2b. 0 日目だけを直す(例: 配布日に合わせる)。同意済みの人だけが対象。理由を研究ノートに書く。
update public.profiles p
set study_start_at = timestamptz '2026-12-03 12:00:00+09'   -- ← 新しい 0 日目
from auth.users u
where u.id = p.id
  and lower(u.email) = lower('participant1@example.com')   -- ← 対象者のメールアドレス
  and p.consented_at is not null;


-- R3. 記録の確認(読み取りのみ)。consent_marked が手元の署名済み同意書の枚数と合い、
--     3 つの数がすべて同じであること(どちらか片方だけ入っている人がいない)。
select
  count(*) filter (where consented_at is not null)                            as consent_marked,
  count(*) filter (where study_start_at is not null)                          as study_start_set,
  count(*) filter (where consented_at is not null and study_start_at is not null) as both_set
from public.profiles;


-- R4. 同意の撤回。本人がアプリの「アカウントとすべてのデータを削除」を使えば行ごと消える。
--     データは残すが研究には使わないでほしい、という申し出の場合だけ、これを実行する。
update public.profiles p
set consented_at   = null,
    study_start_at = null
from auth.users u
where u.id = p.id
  and lower(u.email) = lower('participant1@example.com');  -- ← 撤回した人のアドレスに置き換える
