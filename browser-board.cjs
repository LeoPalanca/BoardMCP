const { FirefoxClient } = require('./firefox-client.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let queue = Promise.resolve();

async function readBoard(operation, model, options = {}) {
  if (!['list_models', 'list_entities', 'list_cubes', 'list_entity_members', 'list_relationships', 'read_cube_data'].includes(operation)) throw new Error('Unknown Board operation');
  if (operation !== 'list_models' && (typeof model !== 'string' || !model.trim() || /[\\/\x00-\x1f]/.test(model) || ['.', '..'].includes(model))) throw new Error('Invalid Data Model name');
  if (operation === 'list_entity_members' && options.entity !== undefined && !validBoardName(options.entity)) throw new Error('Invalid Entity name');
  if (operation === 'read_cube_data' && !validBoardName(options.cube)) throw new Error('A Cube name is required');
  if (['list_entity_members', 'list_relationships', 'read_cube_data'].includes(operation)) return readExtendedBoard(operation, model, options);
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

function validBoardName(value) {
  return typeof value === 'string' && value.trim().length > 0 && !/[\\/\x00-\x1f]/.test(value) && !['.', '..'].includes(value.trim());
}

async function readExtendedBoard(operation, model, options) {
  const client = new FirefoxClient();
  try {
    await client.connect();
    const context = await client.boardContext();
    const language = await client.evaluate(context, 'location.pathname.split("/")[1]');
    if (!/^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(language)) throw new Error('Sign in to Board in the dedicated Firefox window.');
    if (operation === 'list_entity_members') return await readEntityMembers(client, context, language, model, options.entity);
    if (operation === 'list_relationships') return await readRelationships(client, context, language, model);
    return await readCubeData(client, context, language, model, options.cube);
  } finally { await client.close(); }
}

async function waitForPage(client, context, pathname, predicate, attempts = 50) {
  let previous;
  let stable = 0;
  for (let i = 0; i < attempts; i++) {
    await sleep(300);
    const snapshot = JSON.parse(await client.evaluate(context, `JSON.stringify({pathname:location.pathname,ok:(${predicate})})`));
    if (snapshot.pathname !== pathname) throw new Error('Board redirected away from the requested page. Check model access.');
    const signature = JSON.stringify(snapshot);
    stable = snapshot.ok && signature === previous ? stable + 1 : 0;
    previous = signature;
    if (stable >= 2) return;
  }
  throw new Error('Board data did not load. Check the Firefox window, sign-in, and model access.');
}

async function readEntityMembers(client, context, language, model, onlyEntity) {
  const pagePath = `/${language}/data-models/${encodeURIComponent(model)}/entities`;
  await client.send('browsingContext.navigate', {context, url:`http://localhost${pagePath}`, wait:'complete'});
  await waitForPage(client, context, pagePath, `!![...document.querySelectorAll('.dx-datagrid')].find(g=>g.querySelector('.dx-header-row')&&/Nome|Name/.test(g.querySelector('.dx-header-row').innerText))`);
  const metadata = JSON.parse(await client.evaluate(context, `JSON.stringify((()=>{const visible=e=>!!e&&e.getClientRects().length>0;const grid=[...document.querySelectorAll('.dx-datagrid')].find(g=>visible(g)&&g.querySelector('.dx-header-row')&&/Nome|Name/.test(g.querySelector('.dx-header-row').innerText));if(!grid)return null;const headers=[...grid.querySelectorAll('.dx-header-row td')].map(h=>({index:h.getAttribute('aria-colindex'),label:h.innerText.trim()})).filter(h=>h.label);return {headers,rows:[...grid.querySelectorAll('.dx-datagrid-rowsview .dx-data-row')].map(row=>Object.fromEntries(headers.map(h=>{const cell=[...row.children].find(c=>c.getAttribute('aria-colindex')===h.index);return [h.label,cell?.innerText.trim()??null]})))}})())`));
  if (!metadata?.rows?.length) throw new Error('Board entity list is empty or unavailable.');
  const nameColumn = metadata.headers.find(h => /^(Nome|Name)$/i.test(h.label))?.label;
  const entities = metadata.rows.map(row => row[nameColumn]).filter(name => typeof name === 'string' && name.trim());
  const targets = onlyEntity ? entities.filter(name => name.toLocaleLowerCase() === onlyEntity.toLocaleLowerCase()) : entities;
  if (onlyEntity && !targets.length) throw new Error(`Entity not found in model ${model}: ${onlyEntity}`);
  const results = [];
  for (const entity of targets) {
    const selected = await client.evaluate(context, `(()=>{const visible=e=>!!e&&e.getClientRects().length>0;const grid=[...document.querySelectorAll('.dx-datagrid')].find(g=>visible(g)&&g.querySelector('.dx-header-row')&&/Nome|Name/.test(g.querySelector('.dx-header-row').innerText));const row=[...grid.querySelectorAll('.dx-datagrid-rowsview .dx-data-row')].find(r=>[...r.children].some(c=>c.innerText.trim()===${JSON.stringify(entity)}));if(!row)return false;row.click();return true})()`);
    if (!selected) throw new Error(`Could not select Entity: ${entity}`);
    await waitForPage(client, context, pagePath, `!![...document.querySelectorAll('[role="tab"]')].find(t=>/^(Contenuto|Content)$/i.test(t.innerText.trim()))`);
    const clicked = await client.evaluate(context, `(()=>{const tab=[...document.querySelectorAll('[role="tab"]')].find(t=>/^(Contenuto|Content)$/i.test(t.innerText.trim()));if(!tab)return false;tab.click();return true})()`);
    if (!clicked) throw new Error(`Entity member tab is unavailable for ${entity}`);
    await waitForPage(client, context, pagePath, `!![...document.querySelectorAll('.dx-datagrid')].find(g=>{const h=[...g.querySelectorAll('.dx-header-row td')].map(e=>e.innerText.trim().toLocaleLowerCase());return h.some(x=>['codice','code'].includes(x))&&h.some(x=>['descrizione','description'].includes(x))})`);
    await sleep(500);
    const members = await scrapeMemberGrid(client, context);
    if (!members) throw new Error(`Could not read member rows for ${entity}`);
    results.push({entity, count:members.rows.length, ...members, allRowsRead:!members.possibleMoreRows&&!members.filtered});
  }
  return {source:'Board authenticated Firefox UI',operation:'list_entity_members',model,entities:results,count:results.reduce((n,e)=>n+e.count,0),scope:'Rendered Entity member grids, including member Code and Description fields. Completeness flags indicate detected paging, scrolling, or filters.'};
}

async function scrapeMemberGrid(client, context) {
  const collected = new Map();
  let snapshot;
  let possibleMoreRows = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    snapshot = JSON.parse(await client.evaluate(context, `JSON.stringify((()=>{const visible=e=>!!e&&e.getClientRects().length>0;const norm=s=>s.trim().toLocaleLowerCase();const grid=[...document.querySelectorAll('.dx-datagrid')].find(g=>visible(g)&&(()=>{const h=[...g.querySelectorAll('.dx-header-row td')].map(e=>norm(e.innerText));return h.some(x=>['codice','code'].includes(x))&&h.some(x=>['descrizione','description'].includes(x))})());if(!grid)return null;const headers=[...grid.querySelectorAll('.dx-header-row td')].map(h=>({index:h.getAttribute('aria-colindex'),label:h.innerText.trim()})).filter(h=>h.label);const rows=[...grid.querySelectorAll('.dx-datagrid-rowsview .dx-data-row')].map(row=>Object.fromEntries(headers.map(h=>{const cell=[...row.children].find(c=>c.getAttribute('aria-colindex')===h.index);return [h.label,cell?.innerText.trim()??null]})));const scroll=[...grid.querySelectorAll('.dx-datagrid-rowsview .dx-scrollable-container')];const below=scroll.some(e=>e.scrollHeight>e.clientHeight+e.scrollTop+2);const filtered=[...grid.querySelectorAll('.dx-filter-row input:not([type="hidden"]),.dx-searchbox input')].some(e=>e.value.trim());const pages=[...grid.querySelectorAll('.dx-page')].length;return {columns:headers.map(h=>h.label),rows,below,possibleMoreRows:pages>1||!!grid.querySelector('.dx-group-row'),filtered}})())`));
    if (!snapshot) throw new Error('Entity member grid disappeared while reading it.');
    for (const row of snapshot.rows) collected.set(JSON.stringify(row), row);
    if (!snapshot.below) break;
    const moved = await client.evaluate(context, `(()=>{for(const grid of document.querySelectorAll('.dx-datagrid')){const h=[...grid.querySelectorAll('.dx-header-row td')].map(e=>e.innerText.trim().toLocaleLowerCase());if(!h.some(x=>['codice','code'].includes(x))||!h.some(x=>['descrizione','description'].includes(x)))continue;for(const e of grid.querySelectorAll('.dx-datagrid-rowsview .dx-scrollable-container')){const before=e.scrollTop;e.scrollTop+=Math.max(1,e.clientHeight/2);if(e.scrollTop>before)return true}}return false})()`);
    if (!moved) { possibleMoreRows = true; break; }
    await sleep(250);
  }
  return {...snapshot,rows:[...collected.values()],possibleMoreRows:possibleMoreRows||snapshot.possibleMoreRows};
}

async function readRelationships(client, context, language, model) {
  const pagePath = `/${language}/data-models/${encodeURIComponent(model)}/relationships`;
  if (await client.evaluate(context, 'location.pathname') !== pagePath) await client.send('browsingContext.navigate', {context, url:`http://localhost${pagePath}`, wait:'complete'});
  await waitForPage(client, context, pagePath, `document.body.innerText.includes('ANALIZZA')||document.body.innerText.includes('ANALYZE')`);
  const tree = JSON.parse(await client.evaluate(context, `JSON.stringify((()=>{const rows=[...document.querySelectorAll('[role="row"][aria-level]')].filter(r=>!r.classList.contains('brd-nav-tree-child')&&!r.classList.contains('brd-nav-tree-leaf'));return rows.map(r=>({name:[...r.children].map(c=>c.innerText.trim()).find(Boolean)||r.innerText.trim(),level:Number(r.getAttribute('aria-level'))})).filter(r=>r.name&&r.name!==${JSON.stringify(model)})})())`));
  const stack=[];const relationships=[];const roots=[];
  for(const item of tree){while(stack.length&&stack.at(-1).level>=item.level)stack.pop();if(stack.length)relationships.push({parent:stack.at(-1).name,child:item.name});else roots.push(item.name);stack.push(item);}
  return {source:'Board authenticated Firefox UI',operation:'list_relationships',model,roots,relationships,count:relationships.length,scope:'Hierarchy edges inferred from the rendered Relationships tree levels. This does not assert cube usage beyond the hierarchy shown.'};
}

function normalizeLayoutResult(data) {
  const rows=data.columnAndRowInfoses?.rowInfoses||[];
  const cols=data.columnAndRowInfoses?.columnInfoses||[];
  const totalRows=data.dvBoundariesIDs?.totalNrOfDwRow;
  const totalCols=data.dvBoundariesIDs?.totalNrOfDwCols;
  return {
    databaseName:data.databaseName,
    blocks:data.blockInfos||[],
    dimensions:(data.entities||[]).map(e=>({name:e.description,axis:e.byRow?'rows':'columns'})),
    columns:cols.map(c=>c.headerInfo?.value??null),
    rows:rows.map(r=>r.cellInfos?.map(c=>c.value??null)||[]),
    rowCount:rows.length,
    columnCount:cols.length,
    totalRows:totalRows??null,
    totalColumns:totalCols??null,
    allLayoutRowsRead:Number.isInteger(totalRows)?rows.length>=totalRows:null,
    allLayoutColumnsRead:Number.isInteger(totalCols)?cols.length>=totalCols:null,
  };
}

async function readCubeData(client, context, language, model, cube) {
  await client.send('session.subscribe', {events:['network.responseCompleted']});
  const collector=await client.send('network.addDataCollector',{contexts:[context],dataTypes:['response'],maxEncodedDataSize:10000000});
  const listPath=`/${language}/capsules`;
  await client.send('browsingContext.navigate',{context,url:`http://localhost${listPath}`,wait:'complete'});
  await waitForPage(client,context,listPath,`[...document.querySelectorAll('a[href]')].some(a=>a.getAttribute('href').includes('.bcps/screen'))`);
  const routes=JSON.parse(await client.evaluate(context,`JSON.stringify([...new Set([...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>h&&h.startsWith(${JSON.stringify(`/${language}/capsules/`)})&&h.includes('.bcps/screen')))])`));
  const views=[];const failures=[];const handled=new Set();
  for(const route of routes){
    const before=new Set(client.events.filter(e=>e.method==='network.responseCompleted').map(e=>e.params?.request?.request));
    try{
      await client.send('browsingContext.navigate',{context,url:`http://localhost${route}`,wait:'complete'});
      let found=false;let idle=0;
      for(let attempt=0;attempt<30;attempt++){
        await sleep(400);
        const pending=client.events.filter(e=>e.method==='network.responseCompleted'&&!before.has(e.params?.request?.request)&&e.params?.request?.url?.includes('/api/DataView/SingleLayoutResult'));
        if(pending.length){found=true;idle++;if(idle>=3)break;}else if(found)break;
      }
      const events=client.events.filter(e=>e.method==='network.responseCompleted'&&!before.has(e.params?.request?.request)&&e.params?.request?.url?.includes('/api/DataView/SingleLayoutResult'));
      for(const event of events){
        const requestId=event.params?.request?.request;
        if(!requestId||handled.has(requestId))continue;
        handled.add(requestId);
        const response=await client.send('network.getData',{request:requestId,dataType:'response',collector:collector.collector});
        const raw=response.bytes?.value;
        let data;try{data=JSON.parse(raw)}catch{continue;}
        const layout=normalizeLayoutResult(data);
        if(layout.databaseName!==model||!layout.blocks.some(b=>String(b.blockName).toLocaleLowerCase()===cube.toLocaleLowerCase()))continue;
        views.push({capsule:decodeURIComponent(route.split('/').filter(Boolean).at(-2)||''),...layout});
      }
    }catch(error){failures.push({capsule:decodeURIComponent(route.split('/').filter(Boolean).at(-2)||''),message:error.message});}
  }
  return {source:'Board DataView results from existing authenticated capsule screens',operation:'read_cube_data',model,cube,views,count:views.length,screenCount:routes.length,failures,scope:'Returns cube cells present in existing DataView layouts. These may be filtered or aggregated by each screen; this is not a guaranteed dump of every stored cube cell. No matching DataView means Board exposed no screen values for this cube.'};
}

module.exports.callBoard = (operation, model, options = {}) => {
  const result = queue.then(() => readBoard(operation, model, options));
  queue = result.catch(() => {});
  return result;
};
