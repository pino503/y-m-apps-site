# Y.M Apps — 公式ホームページ

PINO (@Pinopino503) が個人開発しているプロダクト群（InkPress / PLAYCORD / RainWiper / Sidewalk Defender / ぴのくんスタンプ）の公式サイト。

## デザイン方針

- **トーン**: Warm Paper Editorial × ぴのくん物語 — 紙・温かみベースの editorial layout に、マスコット ぴのくん が各章のホスト役として登場する
- **フォント**: Klee One（見出し・手書き温度）+ Shippori Mincho（本文・優雅な明朝）+ EB Garamond（数値・ラテン）+ Reenie Beanie（手書きスパイス）+ Press Start 2P（Sidewalk Defender 用）
- **アクセント色**: 朱赤 #b04632（章節記号・リンク）+ ぴのくんイエロー #FFD84D（ハイライト）
- **不変ルール**: 各アプリのカード・ヒーロー領域は **そのアプリ固有の世界観** を保つ（美術館スタイル）

## スタック

- [Astro 5](https://astro.build/) + TypeScript
- 静的生成（SSG）/ Cloudflare Pages デプロイ想定
- Content Collections（`src/content/apps/*.md`, `src/content/writings/*.md`）

## 開発

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # → dist/
npm run preview  # built output preview
```

## ディレクトリ構成

```
y-m-apps-site/
├── public/
│   ├── assets/pinokun/        # ぴのくんアイコン・スタンプ24枚
│   ├── assets/apps/           # 各アプリのスクショ
│   ├── games/sidewalk-defender/  # 同梱HTML5ゲーム
│   └── press-kit/             # プレスキットZIP
├── src/
│   ├── content/
│   │   ├── apps/              # 5プロダクトのMD定義
│   │   └── writings/          # note記事リンク
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── SectionHead.astro  # 章番号 + ぴのくん + 見出し
│   │   └── WorkCard.astro     # 世界観プリセット対応カード
│   ├── layouts/BaseLayout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── works/[slug].astro
│   │   ├── writings/index.astro
│   │   ├── press-kit/index.astro
│   │   └── 404.astro
│   └── styles/
│       ├── global.css          # Warm Paper デザインシステム
│       └── world-themes.css    # アプリ毎の世界観プリセット
└── astro.config.mjs
```

## ぴのくん配役（スタンプ番号）

| 場所 | スタンプ | セリフ |
|------|---------|--------|
| Hero | 1 | あそぼ！ |
| Works 章 | 7 | たのしみ！ |
| Writings 章 | 24 | 何時にする？ |
| About 章 | 5 | まってる！ |
| Press Kit 章 | 12 | それなw |
| Contact 章 | 10 | また連絡する |
| Footer | 14 | むりw |
| 404 | 21 | どこ？ |

## TBD（実装フェーズ後に対応）

- LINEスタンプ商品ページの正確なURL（`src/content/apps/pinokun-stamps.md` の `storeUrl`）
- X (Twitter) アカウントURL
- 各アプリストアの最終URL確認
- カスタムドメイン取得 → `astro.config.mjs` の `site` 更新
- Cloudflare Pages 本番デプロイ
