# 調査用ビルドの凍結確認（毎週） — ADR-008 P0-11

方法の節に「全参加者が同じビルドを使った」と書くための記録。
調査期間中は本番のビルドを変えない。変えた場合はこの表に理由を書き、逸脱として報告する。

## 配布前に 1 回だけ

1. Vercel の Production 環境変数に `NEXT_PUBLIC_STUDY_BUILD=1` を入れる
   （入っていないと本番ビルドは失敗する。`next.config.ts`）。
2. 本番に出すコミットにタグを付けて push する:
   `git tag -a study-v1 <sha> -m "6-month study build" && git push origin study-v1`
3. **本番の自動デプロイを止める。** Vercel は本番ブランチ（今は `main`）に push するたびに
   本番を作り直すので、STATUS.md を 1 行直しただけでも凍結が破れる。調査用の専用ブランチを作り、
   Vercel → Settings → Git → Production Branch をそれに変える:
   `git branch study study-v1 && git push origin study`（Production Branch = `study`）。
   調査期間中は `study` に push しない。`main` への push はプレビューになるだけで、本番は変わらない。
   切り替えたあとに走る `study` の本番デプロイの sha が `study-v1` と同じことを、下の「毎週」で確かめる。
4. 本番に Supabase の migration 025〜028 が適用済みであることを確かめる
   （027 が無いと刻印なしで書き込まれる。`lib/build-stamp.ts`。028 が無いと送信状況の報告が
   届かない。`lib/data/outbox.ts`）。
   2026-11-12 時点: **027・028 は適用済み。025・026 は未適用** — `main` の同意画面
   （`app/api/consent/route.ts`）が利用者の権限で `consented_at` を書くので、025 を先に入れると
   本番で同意が 500 になり、誰もアプリに入れなくなる。同意画面をなくす PR #21 を本番に出した
   **直後に** 025 → 026 の順で入れる。
5. 下の「毎週」を 1 回実行し、最初の行として記録する。Vercel の deployment id も書く。

## 毎週

GitHub Actions の `.github/workflows/freeze-check.yml` が毎週月曜 9:00 (JST) に下と同じスクリプトを
本番に対して実行する（`main` にマージされてから動く。手動実行は Actions → Study freeze check →
Run workflow）。`study-v1` タグができるまでは何も確かめずに成功で終わる。失敗（終了コード 1 と 2）は
GitHub からメールが届く。**記録表は自動では埋まらない**: 実行結果の Summary に出る 4 行を見て、
下の表に手で 1 行足す。手元で実行する場合:

```bash
cd ~/diet-tracker && git fetch --tags
node scripts/check-study-freeze.mjs https://<本番のホスト>
```

- 終了コード 0（`OK`）: 表に 1 行足す。
- 1（`FAIL`）: 本番が `study-v1` と違うコミット、または調査用ビルドでない。
  Vercel の Instant Rollback で、記録表の最初の行の deployment id（`study-v1` の**本番**デプロイ）に戻す。
  **プレビューのデプロイを Promote しない**: プレビューは `next.config.ts` の本番ゲートを通らずに
  ビルドされるので、`NEXT_PUBLIC_STUDY_BUILD` なし（ゲストあり・study_build = false）の場合がある。
  戻したらスクリプトをもう一度実行して 0 を確かめ、いつから違っていたかを下の SQL で確かめて表に書く。
- 2: 確認できなかった（URL・タグ・ネットワーク）。直して再実行する。

ビルドごとの行数（読み取りのみ。`study-v1` 以外の行が増えていないか）:

```sql
select 'food' as t, build_sha, study_build, count(*), min(created_at), max(created_at)
from public.food_logs group by 1, 2, 3
union all
select 'weight', build_sha, study_build, count(*), min(created_at), max(created_at)
from public.weight_logs group by 1, 2, 3
union all
select 'workout', build_sha, study_build, count(*), min(created_at), max(created_at)
from public.workout_logs group by 1, 2, 3
order by 1, 5;
```

`build_sha` が NULL の行は 027 以前の行、または初回の一括移行（`lib/migrate.ts`）で入った過去データ。
`build_sha` は端末が送る値なので改ざんの証拠にはならない。凍結の根拠は上のスクリプトの記録。

## 記録

| 日付 (JST) | deployed sha | study_build | 結果 | deployment id / メモ |
|---|---|---|---|---|
| | | | | |
