// `npm run deploy`（直接公開）の前の見張り。
//
// 2026-10-14 に、git に入れていない変更を作業フォルダから直接公開した。
// そのあと main の自動公開（GitHub → Cloudflare Pages）がその公開を上書きし、
// よじねこ！などのページが消えた。
// 公開してよいのは「GitHub の main と同じ中身」だけ、という決まりをここで守る。
//
// ふだんの公開は main に push するだけでよい（Cloudflare が自動で作り直す）。
// これは自動公開が動かないときの予備。

import { execFileSync } from "node:child_process";

const gitRaw = (...args) => execFileSync("git", args, { encoding: "utf8" });
const git = (...args) => gitRaw(...args).trim();

const problems = [];

// サイトの中身になる場所。ここに未コミットの変更や新しいファイルがあれば止める。
// ルートに置いた計画メモ（*.md）などは公開に影響しないので見逃す。
const SITE_PATHS = /^(src|public|functions|tools)\/|^(astro\.config\.mjs|package(-lock)?\.json|wrangler\.jsonc)$/;
// 行頭の空白も状態の一部なので trim しない。
const dirty = gitRaw("status", "--porcelain")
  .split("\n")
  .filter(Boolean)
  .map((line) => ({ code: line.slice(0, 2), path: line.slice(3).replace(/^"|"$/g, "") }))
  .filter(({ code, path }) => code !== "??" || SITE_PATHS.test(path));
if (dirty.length > 0) {
  problems.push(
    "コミットしていない変更があります（このまま公開すると、次の自動公開で消えます）:\n" +
      dirty.map(({ code, path }) => `    ${code} ${path}`).join("\n"),
  );
}

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== "main") {
  problems.push(`いまのブランチは「${branch}」です。公開は main からだけ行います。`);
}

git("fetch", "--quiet", "origin", "main");
const head = git("rev-parse", "HEAD");
const remote = git("rev-parse", "origin/main");
if (head !== remote) {
  const behind = git("rev-list", "--count", `HEAD..origin/main`);
  const ahead = git("rev-list", "--count", `origin/main..HEAD`);
  problems.push(
    `GitHub の main と中身が違います（GitHub より ${behind} 件古く、${ahead} 件まだ送っていない）。` +
      "\n    git pull で最新にし、自分の変更は push してから公開してください。",
  );
}

if (problems.length > 0) {
  console.error("\n公開を止めました。\n");
  for (const p of problems) console.error("- " + p + "\n");
  console.error("ふだんは main に push するだけで自動で公開されます（数十秒〜20分ほど）。\n");
  process.exit(1);
}

console.log(`公開前の確認 OK（main ${head.slice(0, 7)} = GitHub の main）`);
