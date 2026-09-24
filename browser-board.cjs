const { FirefoxClient } = require('./firefox-client.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let queue = Promise.resolve();

async function readBoard(operation, model) {
  if (!['list_models', 'list_entities', 'list_cubes'].includes(operation)) throw new Error('Unknown Board operation');
  if (operation !== 'list_models' && (typeof model !== 'string' || !model.trim() || /[\\/\x00-\x1f]/.test(model) || ['.', '..'].includes(model))) throw new Error('Invalid Data Model name');
  const client = new FirefoxClient();
  try {
    await client.connect();
    const context = await client.boardContext();
    const language = await client.evaluate(context, 'location.pathname.split("/")[1]');
    if (!/^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(language)) throw new Error('Sign in to Board in the dedicated Firefox window.');
    const base = `/${language}/data-models`;
    const pagePath = operation === 'list_models' ? base : `${base}/${encodeURIComponent(model)}/${operation === 'list_entities' ? 'entities' : 'cubes'}`;
    await client.send('browsingContext.navigate', { context, url: `http://localhost${pagePath}`, wait: 'complete' });
    let snapshot;
    let previous;
    let stable = 0;
    const collected = new Map();
    for (let attempt = 0; attempt < 60; attempt++) {
      await sleep(500);
      snapshot = JSON.parse(await client.evaluate(context, `JSON.stringify((() => {
        const visible = e => !!e && e.getClientRects().length > 0;
        if (document.querySelector('input[type="password"]')) return {loginRequired:true};
        const base = ${JSON.stringify(base)};
        if (${JSON.stringify(operation)} === 'list_models') {
          const models = [...new Set([...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => h.startsWith(base + '/') && h.slice(base.length + 1).indexOf('/') < 0).map(h => decodeURIComponent(h.slice(base.length + 1))))];
          return {ready:models.length > 0, models, url:location.href};
        }
        const grid = [...document.querySelectorAll('div.dx-datagrid')].find(g => visible(g) && g.querySelector('.dx-header-row'));
        if (!grid) return {ready:false};
        const headers = [...grid.querySelectorAll('.dx-header-row td')].map(h => ({index:h.getAttribute('aria-colindex'),label:h.innerText.trim()})).filter(h => h.label);
        const rows = [...grid.querySelectorAll('.dx-datagrid-rowsview .dx-data-row')].map(row => Object.fromEntries(headers.map(h => {
          const cell = [...row.children].find(c => c.getAttribute('aria-colindex') === h.index);
          const checked = cell?.querySelector('[role="checkbox"]')?.getAttribute('aria-checked');
          return [h.label, checked === 'true' ? true : checked === 'false' ? false : cell?.innerText.trim() ?? null];
        })));
        const below = [...grid.querySelectorAll('.dx-datagrid-rowsview .dx-scrollable-container')].some(e => e.scrollHeight > e.clientHeight + e.scrollTop + 2);
        const possibleMoreRows = below || [...grid.querySelectorAll('.dx-page')].length > 1 || !!grid.querySelector('.dx-group-row');
        const filtered = [...grid.querySelectorAll('.dx-filter-row input:not([type="hidden"])')].some(e => e.value.trim()) || [...grid.querySelectorAll('.dx-searchbox input')].some(e => e.value.trim());
        const loading = [...document.querySelectorAll('.dx-loadpanel')].some(visible);
        const empty = [...grid.querySelectorAll('.dx-datagrid-nodata')].some(visible);
        return {ready:!loading && (rows.length > 0 || empty), rows, columns:headers.map(h=>h.label), below, possibleMoreRows, filtered, url:location.href};
      })())`));
      if (snapshot.loginRequired) throw new Error('Board session expired. Sign in again in the dedicated Firefox window.');
      const signature = JSON.stringify(snapshot);
      stable = snapshot.ready && signature === previous ? stable + 1 : 0;
      previous = signature;
      if (snapshot.ready && snapshot.rows) for (const row of snapshot.rows) collected.set(JSON.stringify(row), row);
      if (stable >= 2) {
        if (!snapshot.below) break;
        const moved = await client.evaluate(context, `(() => {
          let moved = false;
          for (const e of document.querySelectorAll('.dx-datagrid-rowsview .dx-scrollable-container')) {
            const before = e.scrollTop; e.scrollTop += Math.max(1, e.clientHeight / 2); moved ||= e.scrollTop > before;
          }
          return moved;
        })()`);
        if (!moved) break;
        stable = 0;
      }
    }
    if (!snapshot?.ready || stable < 2) throw new Error('Board metadata did not load. Check the Firefox window, sign-in, and model access.');
    if (new URL(snapshot.url).pathname !== pagePath) throw new Error('Board redirected away from the requested model page. Check model access.');
    delete snapshot.ready;
    delete snapshot.below;
    if (snapshot.rows) snapshot.rows = [...collected.values()];
    return {source:'Board authenticated Firefox UI', operation, ...(model ? {model} : {}), ...snapshot,
      count: snapshot.models?.length ?? snapshot.rows.length,
      scope: operation === 'list_models' ? 'Model links rendered in the authenticated model list.' : 'Rendered UI metadata; column labels follow the Board session language. This is not the full Public API schema.',
      ...(operation !== 'list_models' ? {allRowsRead: !snapshot.possibleMoreRows && !snapshot.filtered} : {})};
  } finally { await client.close(); }
}

module.exports.callBoard = (operation, model) => {
  const result = queue.then(() => readBoard(operation, model));
  queue = result.catch(() => {});
  return result;
};
