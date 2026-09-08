#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""取扱説明書の「アプリ用パッケージ」を作る。

`public/works/inkpress/manual/` の静的 HTML を、InkPress のアプリ内で
オフラインのまま開ける形へ書き換えて `dist/works/inkpress/manual/app/` に出す。

  - `/assets/...` の絶対パス参照 → パッケージ内の相対パスへ
  - 言語切替リンク → パッケージ内の相対パスへ
  - Google Fonts の <link> を除去（オフラインで無駄な通信を発生させない。
    font-family のフォールバックが効くので見た目は大きく崩れない）
  - E-ink 向けの上書き CSS を `</head>` 直前へ挿入
  - 参照アセットを `assets/` へコピー
  - 同一性判定用の `manifest.json` を書き出す

以前は EinkPDFViewer 側の `tools/sync_manual.py` がこの変換をしていた。
変換ロジックを1か所にまとめるため、サイトのビルドへ移した。
アプリ側の `sync_manual.py` は、ここが出したものをコピーするだけになっている。

    python tools/build_app_manual.py [--out <出力ディレクトリ>]
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import sys
from datetime import datetime, timezone

SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_PUBLIC = os.path.join(SITE_ROOT, "public")
SRC_MANUAL = os.path.join(SRC_PUBLIC, "works", "inkpress", "manual")
DEFAULT_OUT = os.path.join(SITE_ROOT, "dist", "works", "inkpress", "manual", "app")

MANIFEST_SCHEMA = 1

# 出力するページ: (パッケージ内の相対パス, アセットまでの上り段数)
PAGES = [("index.html", 0), ("en/index.html", 1)]

# 版表記の抽出: (パッケージ内の相対パス, 正規表現)
VERSION_PATTERNS = [
    ("index.html", re.compile(r"バージョン\s*([0-9]+\.[0-9]+\.[0-9]+)")),
    ("en/index.html", re.compile(r"Version\s*([0-9]+\.[0-9]+\.[0-9]+)")),
]

# HTML 内の絶対パス → パッケージ内の相対パス（キーは置換元、値は index.html から見た相対パス）
ASSET_PREFIXES = [
    ("/assets/inkpress-manual/icons/", "assets/icons/"),
    ("/assets/apps/", "assets/"),
]

FONT_LINK_PATTERNS = [
    r'<link rel="preconnect" href="https://fonts\.googleapis\.com">\s*',
    r'<link rel="preconnect" href="https://fonts\.gstatic\.com" crossorigin>\s*',
    r'<link href="https://fonts\.googleapis\.com/css2[^"]*" rel="stylesheet">\s*',
]

# E-ink（モノクロ電子ペーパー）向けの上書き。
#
# Web 版はクリーム地＋黄色アクセントで、そのままだと 16 階調グレースケールで
# 全体が薄いグレーに沈み、影のぶんだけ余計に濁る。地を純白・文字を黒に寄せ、
# 黄色の装飾（章番号バッジ・箇条書きの点・見出しの縦棒）は黒へ振って輪郭を残す。
#
# 元の HTML はスタイルがすべてインライン指定なので !important が必要。
# インライン由来に勝つため、属性セレクタで詳細度も上げている。
EINK_STYLE = """
<style id="inkpress-eink-overrides">
  /* 地と文字：純白 × 黒 */
  html, body, .doc { background: #FFFFFF !important; color: #000000 !important; }
  h1, h2, h3, h4, p, li, td, th, span, div, a, strong { color: #000000 !important; }
  /* 影は電子ペーパーでは濁るだけなので落とす */
  * { box-shadow: none !important; text-shadow: none !important; }
  /* カード・囲みの地色は白に、枠線は黒で残す */
  [style*="background:#FFFFFF"], [style*="background:#FBFAF6"],
  [style*="background:#FFF8DD"], [style*="background:#FFF3C9"],
  [style*="background:#FFFBEF"] { background-color: #FFFFFF !important; }
  [style*="border"] { border-color: #000000 !important; }
  /* 黄色のベタ塗り装飾（バッジ・点・縦棒・区切り）は黒に */
  [style*="background:#FFD84D"], [style*="background:#E8BE2E"] {
    background-color: #000000 !important; color: #FFFFFF !important;
  }
  [style*="background:#FFD84D"] * { color: #FFFFFF !important; }
  /* 表ヘッダは白地・黒罫で区別する */
  th { background-color: #FFFFFF !important; border-bottom: 2px solid #000000 !important; }
</style>
"""


def rewrite(html, depth):
    """depth: index.html から見たアセットディレクトリまでの上り段数（ja=0, en=1）"""
    up = "../" * depth
    for src_prefix, dest_prefix in ASSET_PREFIXES:
        html = html.replace('="' + src_prefix, '="' + up + dest_prefix)
    # 言語切替リンク（長い方を先に置換しないと前方一致で壊れる）
    html = html.replace('href="/works/inkpress/manual/en"', 'href="en/index.html"')
    html = html.replace('href="/works/inkpress/manual"', 'href="../index.html"')
    for pat in FONT_LINK_PATTERNS:
        html = re.sub(pat, "", html)
    # E-ink 用の上書きは既存の <style> より後に置く必要があるので </head> 直前へ
    if "</head>" not in html:
        raise ValueError("</head> が見つからず E-ink スタイルを差し込めない")
    html = html.replace("</head>", EINK_STYLE + "</head>", 1)
    return html


def collect_assets(html):
    """HTML が参照しているサイト内アセットの (元パス, パッケージ内の相対パス) を返す。"""
    found = []
    for ref in sorted(set(re.findall(r'="(/assets/[^"]+)"', html))):
        for src_prefix, dest_prefix in ASSET_PREFIXES:
            if ref.startswith(src_prefix):
                rel = dest_prefix + ref[len(src_prefix):]
                found.append((os.path.join(SRC_PUBLIC, ref.lstrip("/").replace("/", os.sep)), rel))
                break
        else:
            print("  !! 変換ルールが無い参照:", ref)
    return found


def extract_version(sources):
    """日本語版と英語版の版表記を取り出す。取れないか食い違えば None。"""
    versions = {}
    for rel, pattern in VERSION_PATTERNS:
        m = pattern.search(sources[rel])
        if not m:
            print("版表記が見つからない: %s（%s）" % (rel, pattern.pattern))
            return None
        versions[rel] = m.group(1)
    found = set(versions.values())
    if len(found) != 1:
        print("日本語版と英語版で版表記が違う: " + ", ".join(
            "%s=%s" % (rel, ver) for rel, ver in versions.items()))
        return None
    return found.pop()


def build_manifest(out_dir, version):
    """出力ディレクトリの中身から manifest の中身（dict）を組み立てる。"""
    files = []
    for root, _, names in os.walk(out_dir):
        for name in names:
            full = os.path.join(root, name)
            rel = os.path.relpath(full, out_dir).replace(os.sep, "/")
            if rel == "manifest.json":
                continue
            with open(full, "rb") as f:
                data = f.read()
            files.append({
                "path": rel,
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            })
    files.sort(key=lambda e: e["path"])
    # contentHash: path 順に並べた "path:sha256\n" の連結の sha256
    joined = "".join("%s:%s\n" % (e["path"], e["sha256"]) for e in files)
    return {
        "schema": MANIFEST_SCHEMA,
        "version": version,
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "contentHash": hashlib.sha256(joined.encode("utf-8")).hexdigest(),
        "files": files,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=DEFAULT_OUT, help="出力ディレクトリ")
    args = ap.parse_args()
    out_dir = os.path.abspath(args.out)

    # 1. 元の HTML を読む
    sources = {}
    for rel, _ in PAGES:
        src = os.path.join(SRC_MANUAL, rel.replace("/", os.sep))
        if not os.path.isfile(src):
            print("マニュアルが見つからない:", src)
            return 1
        with open(src, encoding="utf-8") as f:
            sources[rel] = f.read()

    # 2. 版表記の確認（食い違ったまま配れないよう、書き出す前に止める）
    version = extract_version(sources)
    if version is None:
        return 1

    # 3. 変換して書き出す
    if os.path.isdir(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(out_dir)

    assets = {}
    for rel, depth in PAGES:
        for src_path, asset_rel in collect_assets(sources[rel]):
            assets[asset_rel] = src_path
        out_path = os.path.join(out_dir, rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(rewrite(sources[rel], depth))
        print("HTML  %s (%.1f KB)" % (rel, os.path.getsize(out_path) / 1024))

    total = 0
    for rel, src in sorted(assets.items()):
        dst = os.path.join(out_dir, rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        total += os.path.getsize(dst)
    print("ASSET %d files (%.1f KB)" % (len(assets), total / 1024))

    # 4. 変換後に絶対パス参照が残っていないか確認する
    leftovers = 0
    for root, _, names in os.walk(out_dir):
        for name in names:
            if not name.endswith(".html"):
                continue
            path = os.path.join(root, name)
            with open(path, encoding="utf-8") as f:
                text = f.read()
            for ref in re.findall(r'="(/[^"]+)"', text) + re.findall(r'="(https?://[^"]+)"', text):
                print("  !! 絶対参照が残っている:", path, ref)
                leftovers += 1
    if leftovers:
        return 1

    # 5. manifest.json
    manifest = build_manifest(out_dir, version)
    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("MANIFEST version=%s contentHash=%s files=%d" % (
        manifest["version"], manifest["contentHash"], len(manifest["files"])))
    print("OK:", out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
