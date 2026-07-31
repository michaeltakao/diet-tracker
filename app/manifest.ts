import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Diet Tracker — ワークアウト & 栄養プランナー',
    short_name: 'DietTracker',
    description: 'ワークアウトを計画・記録し、食事・体重も一緒に管理してAIコーチングを受けよう',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f7f7f7',
    theme_color: '#58cc02',
    categories: ['health', 'fitness', 'food'],
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    screenshots: [],
    shortcuts: [
      {
        name: 'ワークアウトを記録',
        short_name: 'ワークアウト',
        description: '今日のトレーニングを記録する',
        url: '/workout',
        icons: [{ src: '/icon', sizes: '96x96' }],
      },
      {
        name: '食事を追加',
        short_name: '追加',
        description: '今日の食事をすばやく追加する',
        url: '/add',
        icons: [{ src: '/icon', sizes: '96x96' }],
      },
      {
        name: '体重を記録',
        short_name: '体重',
        description: '今日の体重を記録する',
        url: '/weight',
        icons: [{ src: '/icon', sizes: '96x96' }],
      },
    ],
  };
}
