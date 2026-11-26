# UX 監査 — 2026-11-26

ラベル: **事実** / **仮定** / **仮説** / **意見** (CURRENT_STATE.md と同じ)。行番号は `refactor/core-loop` @48f1b12 時点。

## 1. 最大の問題点 TOP10 (すべて事実; 影響の大きさは意見)

| # | 問題 | 根拠 (file:line) |
|---|---|---|
| 1 | ホームに「次にやること」がない。運動状況も出ない。提案は推薦カードのボタンを押した時だけ | `app/dashboard/page.tsx` 全体 (次の一手を出す層がない) |
| 2 | P/F/C は合計だけで目標・残りがない。オンボーディングで P/F/C 目標を算出しているのにホームで未使用 | `dashboard/page.tsx:176-181` (合計のみ), `DailyGoals.protein/fat/carbs` (`lib/types.ts:98`) |
| 3 | 「昨日をコピー」は確認なし・連打で重複登録。MealCard 削除は確認も取り消しもない | `dashboard/page.tsx:81-94`, `components/MealCard.tsx:277` |
| 4 | ロード/エラー状態がない: `error.tsx`/`loading.tsx`/`not-found.tsx`/`global-error.tsx` が 0 個。ダッシュボードは `goalsReady` まで何も描画しない | `app/` 配下, `dashboard/page.tsx:150` |
| 5 | セーフエリア未対応: `viewportFit: 'cover'` + `black-translucent` なのに `env(safe-area-inset-*)` が 0 件 | `app/layout.tsx:58,70`; grep 0 件 |
| 6 | 右下の固定要素が 3 つ重なる (FAB / フィードバック / インストールバナー)。フィードバックは `/add` `/onboarding` にも出る | `BottomNav.tsx:32`, `FeedbackButton.tsx:69`, `PwaInstallBanner.tsx:94` |
| 7 | タップ領域 44px 未満: MealCard アイコン ≈30px、推薦の評価ボタン ≈20px、水分グラス ≈28px、`/add` ヘッダーボタン ≈30px | `MealCard.tsx:253,264,279` (`p-2`+14px), `WaterTracker.tsx:77`, `add/page.tsx:375,384` |
| 8 | 写真 AI の信頼度は表示だけ。low でも全項目が同じ見た目で確定扱い。量の調整は手入力 | `PhotoUpload.tsx:215-223` |
| 9 | 言語の混在: onboarding 49 行・settings 45 行が日本語直書き。API エラーは英語のまま表示。metadata が削除済み機能 (AI ワークアウト生成, 1RM) を宣伝 | `onboarding/page.tsx`, `settings/page.tsx`, `PhotoUpload.tsx:122`, `layout.tsx:40-53` |
| 10 | 入力検証の不一致とデータ経路の抜け: 体重はホーム 20–300kg / `/weight` は >0。水分は outbox を通らず失敗時は `console.warn` のみ | `QuickWeightCard.tsx:19-20`, `weight/page.tsx:42`, `lib/data/water.ts:59` |

## 2. 使いにくさの原因 (意見)
- 画面ごとに作られた機能の寄せ集めで、「今日の状態 → 次の一手」をまとめる層がない。
- 削除 (ADR-011) で量は減ったが、残った画面の**状態設計 (読み込み・空・失敗・取り消し)** が手つかず。
- AI の出力が「参考値」として扱われる UI になっていない (信頼度で見た目が変わらない)。

## 3. 測れないもの (事実)
SUS・D1/D7/D30・記録頻度・AI 採用率は実ユーザーがいないため測れない。研究評価用の定義は REDESIGN_PROPOSAL.md §8。
