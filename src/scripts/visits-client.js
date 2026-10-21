// One controller per document; Astro swaps the header on client navigation.
export function createVisitorCounter({ hostname, getElement, request }) {
  const isProd = ['y-m-apps-site.pages.dev', 'y-m-apps.com', 'www.y-m-apps.com'].includes(hostname);
  let requested = false;
  let pending = null;
  let previousElement = null;
  let lastCount = null;

  function render(value, title) {
    const element = getElement();
    if (!element) return;
    element.textContent = value;
    element.title = title;
  }

  return function update() {
    const element = getElement();
    if (!element || element === previousElement) return pending;
    previousElement = element;
    if (!isProd) {
      render('DEV', '開発・プレビュー環境では集計しません');
      return null;
    }
    if (lastCount !== null) render(String(lastCount).padStart(6, '0'), '累計アクセス数');
    if (pending) return pending;
    const url = requested ? '/api/visits?peek=1' : '/api/visits';
    // An uncertain response must not cause a second increment on navigation.
    requested = true;
    pending = (async () => {
      try {
        const response = await request(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Number.isSafeInteger(data.count) || data.count < 0) throw new Error('Invalid visit count');
        lastCount = data.count;
        render(String(lastCount).padStart(6, '0'), '累計アクセス数');
      } catch {
        render(lastCount === null ? '—' : String(lastCount).padStart(6, '0'), 'アクセス数を更新できませんでした');
      } finally {
        pending = null;
      }
    })();
    return pending;
  };
}
