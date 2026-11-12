# 分析計画の固定(freeze)記録

vault ADR-008「Analysis-plan items」: 配布(URL を渡す)前に、分析に使う
クエリをコミットハッシュで固定し、日付を残す。結果を見てから定義を変えない。

## 現在の候補(2026-11-10 記録 — まだ固定していない)

| 対象 | 値 |
|---|---|
| ファイル | `docs/trial/cohort-queries.sql` |
| 最後に変更したコミット | `dd63cdc17c0eaf89f29019f71afd252572285e12`(2026-11-04、ADR-008 P0-9: day 0 = `study_start_at`) |
| ファイルの git blob | `6a1acf750c3efab28f93eb7ab31a6a9e7e0e2248` |
| 補足資料 | `docs/trial/data-dictionary.md`(列の出所・タイムゾーン・欠測の表し方、クリーニング規則) |

確認方法: `git rev-parse <固定コミット>:docs/trial/cohort-queries.sql` が上の
blob と一致すれば、クエリは 1 文字も変わっていない。

## 固定する前に決まっていないこと

- 教員の 3 つの回答(倫理審査、パイロットか計画の改訂か、Gemini の tier)。
- P/F/C を任意にするか(P1、Q1)。任意にするなら migration 029
  (`supabase/drafts/029_food_macros_entered.sql`)を入れ、食事の分析で
  `macros_entered = false` の行の P/F/C を欠測として扱う文をクエリに足してから固定する。
- 時刻帯のルール: 国外で記録した参加者を除くか(端末のタイムゾーンは記録していない)。
- `client_sync_health`(migration 028)の扱い: `dropped_count > 0` の参加者を
  どう報告するか。

## 固定するときの手順

1. 上の未決事項を決め、`cohort-queries.sql` を最終版にしてコミットする。
2. このファイルの「固定」欄に、そのコミットハッシュ・blob・日付・決めた人を書く。
3. git tag `analysis-plan-v1` を付けて push する。
4. 以後 `cohort-queries.sql` を変えるときは、変更理由と日付を下の「変更履歴」に書き、
   変更前の結果も残す(論文では逸脱として報告する)。

## 固定

(未記入)

## 変更履歴

(なし)
