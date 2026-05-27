import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Diet Tracker — PFC & Calorie Log',
    short_name: 'DietTracker',
    description: '食事・体重・ワークアウトを記録してAIコーチングを受けよう',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f8fafc',
    theme_color: '#22c55e',
    categories: ['health', 'fitness', 'food'],
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    screenshots: [],
    shortcuts: [
      {
        name: '食事を追加',
        short_name: '追加',
        description: '今日の食事をすばやく追加する',
        url: '/add',
        icons: [{ src: '/icon.png', sizes: '96x96' }],
      },
      {
        name: '体重を記録',
        short_name: '体重',
        description: '今日の体重を記録する',
        url: '/weight',
        icons: [{ src: '/icon.png', sizes: '96x96' }],
      },
    ],
  };
}
