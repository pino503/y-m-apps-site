/**
 * 訪問カウンター（Cloudflare Pages Function + KV）
 *
 * 以前は外部サービス counterapi.dev の v1 を叩いていたが、v1 が廃止され
 * HTTP 410 を返すようになり、カウントが表示されなくなった。外部サービスに
 * 依存しないよう、Cloudflare 側で自前に持つ。
 *
 * GET /api/visits         … 1 増やして、増やしたあとの値を返す
 * GET /api/visits?peek=1  … 増やさずに現在値だけ返す
 *
 * 必要なバインド: KV 名前空間を "VISITS" という名前で結びつけること。
 * KV は結果整合なので、同時アクセスが重なるとまれに数え落とす。
 * 表示用のゆるいカウンターとして許容する。
 */

const KEY = 'total';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function parseCount(raw) {
  const n = Number.parseInt(raw ?? '0', 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function onRequestGet(context) {
  const kv = context.env && context.env.VISITS;
  if (!kv) {
    // バインド漏れ。呼び出し側が気づけるよう、黙って 0 を返さない。
    return json({ error: 'kv_not_bound' }, 503);
  }

  let current;
  try {
    current = parseCount(await kv.get(KEY));
  } catch (err) {
    return json({ error: 'kv_read_failed', detail: String(err) }, 502);
  }

  const peek = new URL(context.request.url).searchParams.get('peek') === '1';
  if (peek) {
    return json({ count: current }, 200);
  }

  const next = current + 1;
  try {
    context.waitUntil(kv.put(KEY, String(next)));
  } catch (err) {
    // 書き込みに失敗しても、読めた値は返す（表示だけは保つ）。
    return json({ count: current, warning: 'kv_write_failed' }, 200);
  }
  return json({ count: next }, 200);
}
