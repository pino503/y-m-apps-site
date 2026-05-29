import { defineCollection, z } from "astro:content";

const apps = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    tagline: z.string(),
    world: z.enum([
      "inkpress",
      "playcord",
      "rainwiper",
      "sidewalk-defender",
      "pinokun-stamps",
      "cosmo-cleaner",
    ]),
    platform: z.string(),
    badges: z.array(z.string()).default([]),
    storeUrl: z.string().url().optional(),
    storeLabel: z.string().optional(),
    iconImage: z.string().optional(),
    coverImage: z.string().optional(),
    screenshots: z.array(z.string()).default([]),
    features: z.array(z.object({ title: z.string(), body: z.string() })).default([]),
    releaseDate: z.string().optional(),
    version: z.string().optional(),
    color: z.string().optional(),
    order: z.number().default(99),
    embedPath: z.string().optional(),
    // 種類グルーピング — Works section で見出しに使う
    category: z.enum(["tool", "game", "sticker"]).default("tool"),
    // 新作マーク — Works 行に NEW バッジを出す
    isNew: z.boolean().default(false),
    // 未公開マーク — ストアにまだ並んでいない（内部テスト中・申請待ち等）。
    // 表示上「準備中」グレーバッジを出し、storeUrl があってもクリック不可にする。
    unpublished: z.boolean().default(false),
  }),
});

const writings = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.string(),
    url: z.string().url(),
    summary: z.string().optional(),
    relatedApp: z.string().optional(),
  }),
});

export const collections = { apps, writings };
