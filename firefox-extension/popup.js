const byId = id => document.getElementById(id);
let lastScan = null;

function selectedAgent() {
  if (byId('agent').value !== 'personalized') return byId('agent').value === 'claude' ? 'Claude' : 'Codex';
  return byId('custom-agent').value.trim() || 'Personalized agent';
}

async function restoreAgent() {
  const saved = await browser.storage.local.get(['agentType', 'agentName']);
  byId('agent').value = saved.agentType || 'claude';
  byId('custom-agent').value = saved.agentName || '';
  updateAgentField();
}

function updateAgentField() {
  const custom = byId('agent').value === 'personalized';
  byId('custom-agent').hidden = !custom;
  byId('custom-agent').setAttribute('aria-label', 'Personalized agent name');
}

async function saveAgent() {
  await browser.storage.local.set({agentType: byId('agent').value, agentName: byId('custom-agent').value.trim()});
  if (lastScan) renderReport();
}

function analyzePage() {
  const safeUrl = url => `${url.origin}${url.pathname}`;
  const decode = value => {
    try { return decodeURIComponent(value); } catch { return value; }
  };
  const routeSegments = pathname => pathname.split('/').filter(Boolean);
  const moduleIndex = (parts, module) => parts.map(decode).findIndex(segment => segment.toLocaleLowerCase() === module);
  const routeRoot = (url, module, includeNext = false) => {
    const raw = routeSegments(url.pathname);
    const index = moduleIndex(raw, module);
    if (index < 0) return null;
    const length = Math.min(raw.length, index + (includeNext ? 2 : 1));
    return `${url.origin}/${raw.slice(0, length).join('/')}`;
  };
  const knownModelSections = new Set(['entities', 'relationships', 'cubes', 'datasets', 'time-range', 'time range', 'data-processing', 'entity-options', 'analytics', 'security']);
  const unique = items => [...new Map(items.map(item => [item.url, item])).values()];
  const links = [...document.querySelectorAll('a[href]')]
    .filter(anchor => anchor.getClientRects().length > 0)
    .map(anchor => {
      try {
        const url = new URL(anchor.href, location.href);
        if (url.origin !== location.origin) return null;
        return {url, label: (anchor.innerText || anchor.getAttribute('aria-label') || '').trim()};
      } catch { return null; }
    })
    .filter(Boolean);

  const models = [];
  const capsules = [];
  function addModel(name, url, label) {
    if (!name || knownModelSections.has(name.toLocaleLowerCase())) return;
    models.push({name, url, label});
  }
  function addCapsule(name, url, label) {
    if (!name) return;
    capsules.push({name, url, label});
  }

  for (const link of links) {
    const segments = link.url.pathname.split('/').filter(Boolean).map(decode);
    const modelIndex = segments.findIndex(segment => /^data-models?$/i.test(segment));
    if (modelIndex >= 0 && segments[modelIndex + 1]) {
      const name = segments[modelIndex + 1];
      if (!knownModelSections.has(name.toLocaleLowerCase())) addModel(name, routeRoot(link.url, 'data-models', true), link.label);
    }
    const capsuleIndex = segments.findIndex(segment => /^capsules?$/i.test(segment));
    if (capsuleIndex >= 0 && segments[capsuleIndex + 1]) {
      const routeName = segments[capsuleIndex + 1];
      const name = routeName.replace(/\.bcps$/i, '');
      if (!/^(screen|edit|new)$/i.test(name)) addCapsule(name, safeUrl(link.url), link.label);
    }
  }

  const current = new URL(location.href);
  const currentSegments = current.pathname.split('/').filter(Boolean).map(decode);
  const currentModelIndex = currentSegments.findIndex(segment => /^data-models?$/i.test(segment));
  if (currentModelIndex >= 0 && currentSegments[currentModelIndex + 1]) {
    const name = currentSegments[currentModelIndex + 1];
    if (!knownModelSections.has(name.toLocaleLowerCase())) addModel(name, routeRoot(current, 'data-models', true), document.title);
  }
  const currentCapsuleIndex = currentSegments.findIndex(segment => /^capsules?$/i.test(segment));
  if (currentCapsuleIndex >= 0 && currentSegments[currentCapsuleIndex + 1]) {
    const name = currentSegments[currentCapsuleIndex + 1].replace(/\.bcps$/i, '');
    if (!/^(screen|edit|new)$/i.test(name)) addCapsule(name, safeUrl(current), document.title);
  }

  const headings = [...document.querySelectorAll('h1,h2,h3,[role="heading"]')]
    .filter(element => element.getClientRects().length > 0)
    .map(element => element.innerText.trim())
    .filter(Boolean)
    .slice(0, 12);
  const visibleText = document.body?.innerText?.slice(0, 5000) || '';
  const clues = `${document.title} ${current.hostname} ${current.pathname} ${headings.join(' ')} ${links.map(link => link.label).join(' ')} ${visibleText.slice(0, 2000)}`;
  const boardDetected = /board|data models?|capsules?|relationships|dataview|modelli dati|relazioni|capsule/i.test(clues) || models.length > 0 || capsules.length > 0;
  const signInPrompt = !!document.querySelector('input[type="password"]') || /sign in to board|accedi a board|sessione scaduta/i.test(visibleText);
  const crossOriginFrameHosts = [...document.querySelectorAll('iframe[src]')]
    .map(frame => {
      try {
        const frameUrl = new URL(frame.src, location.href);
        return frameUrl.origin === current.origin ? '' : frameUrl.hostname;
      } catch { return ''; }
    })
    .filter(Boolean);

  function listUrlFor(module) {
    for (const link of links) {
      const root = routeRoot(link.url, module);
      if (root) return root;
    }
    const raw = routeSegments(current.pathname);
    const decoded = raw.map(decode);
    let prefix;
    const pathModuleIndex = decoded.findIndex(segment => segment === module);
    if (pathModuleIndex >= 0) prefix = raw.slice(0, pathModuleIndex);
    else {
      const languageIndex = decoded.findIndex(segment => /^[a-z]{2}(?:-[a-z]{2})?$/i.test(segment));
      const documentLanguage = (document.documentElement.lang || '').split('-')[0];
      prefix = languageIndex >= 0 ? raw.slice(0, languageIndex + 1) : [/^[a-z]{2}$/i.test(documentLanguage) ? documentLanguage : 'en'];
    }
    return `${current.origin}/${[...prefix, module].join('/')}`;
  }

  return {
    title: document.title || '(untitled page)',
    url: safeUrl(current),
    host: current.hostname,
    boardDetected,
    signInPrompt,
    headings,
    models: unique(models).sort((a,b) => a.name.localeCompare(b.name)),
    capsules: unique(capsules).sort((a,b) => a.name.localeCompare(b.name)),
    modelListUrl: listUrlFor('data-models'),
    capsuleListUrl: listUrlFor('capsules'),
    crossOriginFrameHosts: [...new Set(crossOriginFrameHosts)],
    checkedModels: [],
    checkedCapsules: [],
    scannedAt: new Date().toISOString(),
    scope: 'Active page plus Board list pages opened in background tabs on the same origin. The extension performs read-only page navigation and no Board write actions.'
  };
}

function inspectCatalogPage(kind) {
  const decode = value => {
    try { return decodeURIComponent(value); } catch { return value; }
  };
  const module = kind === 'models' ? 'data-models' : 'capsules';
  const items = [];
  for (const anchor of document.querySelectorAll('a[href]')) {
    if (!anchor.getClientRects().length) continue;
    try {
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin) continue;
      const parts = url.pathname.split('/').filter(Boolean).map(decode);
      const index = parts.findIndex(part => part.toLocaleLowerCase() === module);
      if (index < 0 || !parts[index + 1]) continue;
      let name = parts[index + 1];
      if (kind === 'models' && /^(entities|relationships|cubes|datasets|time-range|analytics)$/i.test(name)) continue;
      if (kind === 'capsules') {
        name = name.replace(/\.bcps$/i, '');
        if (/^(screen|edit|new)$/i.test(name)) continue;
      }
      const rawParts = url.pathname.split('/').filter(Boolean);
      const route = kind === 'models'
        ? `${url.origin}/${rawParts.slice(0, index + 2).join('/')}`
        : `${url.origin}/${rawParts.join('/')}`;
      items.push({name, url: route, label: (anchor.innerText || anchor.getAttribute('aria-label') || '').trim()});
    } catch {}
  }
  const current = new URL(location.href);
  const bodyText = document.body?.innerText || '';
  const ready = document.readyState === 'complete' && (!!items.length || bodyText.length > 40);
  return {
    ready,
    items: [...new Map(items.map(item => [item.url, item])).values()],
    url: `${current.origin}${current.pathname}`,
    title: document.title,
    loginPrompt: !!document.querySelector('input[type="password"]') || /sign in to board|accedi a board/i.test(bodyText.slice(0, 3000))
  };
}

function inspectSelectedPage(kind) {
  const visible = element => !!element && element.getClientRects().length > 0;
  const gridData = grid => {
    const headers = [...grid.querySelectorAll('.dx-header-row td, thead th')]
      .map((cell, index) => ({index:cell.getAttribute('aria-colindex') || String(index + 1), label:cell.innerText.trim()}))
      .filter(cell => cell.label);
    const rowEls = [...grid.querySelectorAll('.dx-data-row, tbody tr')];
    const rows = rowEls.map(row => headers.map(header => {
      const cell = [...row.children].find((child, index) => (child.getAttribute('aria-colindex') || String(index + 1)) === header.index);
      return cell?.innerText.trim() || '';
    })).filter(row => row.some(Boolean));
    const scrolls = [...grid.querySelectorAll('.dx-scrollable-container')];
    const possibleMoreRows = scrolls.some(element => element.scrollHeight > element.clientHeight + element.scrollTop + 2) || [...grid.querySelectorAll('.dx-page')].length > 1;
    const filtered = [...grid.querySelectorAll('.dx-filter-row input:not([type="hidden"]), .dx-searchbox input')].some(input => input.value.trim());
    return {columns:headers.map(header => header.label), rows, possibleMoreRows, filtered};
  };
  const waitFor = async predicate => {
    for (let attempt = 0; attempt < 30; attempt++) {
      if (predicate()) return true;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return false;
  };
  const visibleGrids = () => [
    ...[...document.querySelectorAll('.dx-datagrid')].filter(visible),
    ...[...document.querySelectorAll('table')].filter(table => visible(table) && !table.closest('.dx-datagrid'))
  ];
  const allTables = () => visibleGrids().map(grid => ({label:grid.getAttribute('aria-label') || '', ...gridData(grid)}));

  return (async () => {
    if (kind === 'entities') {
      const entityGrid = [...document.querySelectorAll('.dx-datagrid')].find(grid => visible(grid) && /Nome|Name/i.test(grid.querySelector('.dx-header-row')?.innerText || ''));
      if (!entityGrid) return {ready:false};
      const meta = gridData(entityGrid);
      const nameIndex = meta.columns.findIndex(column => /^(Nome|Name)$/i.test(column));
      const entities = nameIndex < 0 ? [] : meta.rows.map(row => row[nameIndex]).filter(Boolean);
      const members = [];
      for (const entity of entities) {
        const grid = [...document.querySelectorAll('.dx-datagrid')].find(item => visible(item) && /Nome|Name/i.test(item.querySelector('.dx-header-row')?.innerText || ''));
        const row = [...(grid?.querySelectorAll('.dx-data-row') || [])].find(item => [...item.children].some(cell => cell.innerText.trim() === entity));
        if (!row) { members.push({entity, available:false}); continue; }
        row.click();
        const tabReady = await waitFor(() => [...document.querySelectorAll('[role="tab"]')].some(tab => /^(Contenuto|Content)$/i.test(tab.innerText.trim())));
        const contentTab = [...document.querySelectorAll('[role="tab"]')].find(tab => /^(Contenuto|Content)$/i.test(tab.innerText.trim()));
        if (!tabReady || !contentTab) { members.push({entity, available:false}); continue; }
        contentTab.click();
        const memberGridReady = await waitFor(() => [...document.querySelectorAll('.dx-datagrid')].some(item => visible(item) && /Codice|Code/i.test(item.querySelector('.dx-header-row')?.innerText || '') && /Descrizione|Description/i.test(item.querySelector('.dx-header-row')?.innerText || '')));
        const memberGrid = [...document.querySelectorAll('.dx-datagrid')].find(item => visible(item) && /Codice|Code/i.test(item.querySelector('.dx-header-row')?.innerText || '') && /Descrizione|Description/i.test(item.querySelector('.dx-header-row')?.innerText || ''));
        members.push({entity, available:memberGridReady && !!memberGrid, ...(memberGrid ? gridData(memberGrid) : {columns:[],rows:[],possibleMoreRows:null,filtered:null})});
      }
      return {ready:true, pageUrl:`${location.origin}${location.pathname}`, title:document.title, entityMetadata:meta, entities:members};
    }

    if (kind === 'relationships') {
      const tree = [...document.querySelectorAll('.brd-context-menu [role="row"][aria-level]')]
        .map(row => ({name:[...row.children].map(cell => cell.innerText.trim()).find(Boolean), level:Number(row.getAttribute('aria-level'))}))
        .filter(item => item.name);
      const button = [...document.querySelectorAll('button')].find(item => /^(ANALYZE|ANALIZZA)$/i.test(item.innerText.trim()));
      if (button) {
        button.click();
        await waitFor(() => [...document.querySelectorAll('button')].some(item => /^CLOSE|CHIUDI$/i.test(item.innerText.trim())));
      }
      const analysisTables = allTables();
      const close = [...document.querySelectorAll('button')].find(item => /^(CLOSE|CHIUDI)$/i.test(item.innerText.trim()));
      if (close) close.click();
      return {ready:true, pageUrl:`${location.origin}${location.pathname}`, title:document.title, tree, analysisTables};
    }

    return {ready:document.readyState === 'complete', pageUrl:`${location.origin}${location.pathname}`, title:document.title,
      headings:[...document.querySelectorAll('h1,h2,h3,[role="heading"]')].filter(visible).map(element=>element.innerText.trim()).filter(Boolean).slice(0,20),
      tables:allTables(), text:(document.querySelector('main,[role="main"]')?.innerText || document.body?.innerText || '').trim().slice(0,12000)};
  })();
}

function renderEntries(target, entries, type, checkedValues = []) {
  target.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-entry';
    empty.textContent = 'None detected on this page.';
    target.append(empty);
    return;
  }
  for (const [index, entry] of entries.entries()) {
    const label = document.createElement('label');
    label.className = 'entry';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.kind = type;
    input.dataset.index = String(index);
    input.checked = checkedValues.includes(entry.url);
    const text = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'entry-name';
    name.textContent = entry.name;
    text.append(name);
    if (entry.url) {
      const path = document.createElement('span');
      path.className = 'entry-path';
      try {
        const url = new URL(entry.url);
        path.textContent = `${url.pathname}${entry.label ? ` · ${entry.label}` : ''}`;
      } catch { path.textContent = entry.label || ''; }
      text.append(path);
    }
    label.append(input, text);
    target.append(label);
  }
}

function collectSelection() {
  lastScan.checkedModels = [...document.querySelectorAll('input[data-kind="model"]:checked')]
    .map(input => lastScan.models[Number(input.dataset.index)]?.url).filter(Boolean);
  lastScan.checkedCapsules = [...document.querySelectorAll('input[data-kind="capsule"]:checked')]
    .map(input => lastScan.capsules[Number(input.dataset.index)]?.url).filter(Boolean);
}

function updateSelectionSummary() {
  if (!lastScan) return;
  collectSelection();
  const models = lastScan.checkedModels.length;
  const capsules = lastScan.checkedCapsules.length;
  byId('selection-summary').textContent = `Selected: ${models} Data Model${models === 1 ? '' : 's'}, ${capsules} Capsule${capsules === 1 ? '' : 's'}.`;
  if (!byId('start-read').disabled) {
    byId('read-status').textContent = models || capsules
      ? 'Selection ready. Click Start agent read to inspect it.'
      : 'Select at least one item to begin a read.';
    byId('read-status').dataset.state = '';
  }
}

function setReadStatus(message, state = 'working') {
  const status = byId('read-status');
  status.textContent = message;
  status.dataset.state = state;
}

function addProgress(message) {
  const list = byId('read-progress');
  list.hidden = false;
  const item = document.createElement('li');
  item.textContent = message;
  list.append(item);
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function inspectTemporaryTab(url, inspector, args = []) {
  const tab = await browser.tabs.create({url, active:false});
  let lastResult = null;
  let lastSignature = '';
  let stable = 0;
  try {
    for (let attempt = 0; attempt < 32; attempt++) {
      await delay(inspector === inspectSelectedPage ? 900 : 400);
      try {
        const [execution] = await browser.scripting.executeScript({target:{tabId:tab.id}, func:inspector, args});
        const result = execution?.result;
        if (!result) continue;
        lastResult = result;
        if (inspector === inspectSelectedPage && result.ready) return result;
        if (result.ready && (result.items?.length || result.entityMetadata || result.tables || result.tree || result.text)) {
          const signature = JSON.stringify(result.items || result.entityMetadata || result.tables || result.tree || result.text);
          stable = signature === lastSignature ? stable + 1 : 0;
          lastSignature = signature;
          if (stable >= 2) return result;
        }
      } catch {}
    }
    return lastResult;
  } finally {
    try { await browser.tabs.remove(tab.id); } catch {}
  }
}

function uniqueEntries(entries) {
  return [...new Map(entries.map(item => [item.url, item])).values()].sort((a,b) => a.name.localeCompare(b.name));
}

async function readCatalog(url, kind) {
  return inspectTemporaryTab(url, inspectCatalogPage, [kind]);
}

function escapeCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replaceAll('\r', ' ').replaceAll('\n', ' ');
}

function markdownTable(columns, rows) {
  if (!columns?.length) return '_No table columns detected._';
  const header = `| ${columns.map(escapeCell).join(' | ')} |`;
  const rule = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = (rows || []).map(row => `| ${columns.map((_, index) => escapeCell(row[index])).join(' | ')} |`);
  return [header, rule, ...body].join('\n');
}

function renderDeepRead() {
  if (!lastScan?.deepRead) return '';
  return lastScan.deepRead.map(page => {
    let output = `\n\n## ${page.scopeLabel}\n\n- Page: ${page.title || 'Unavailable'}\n- URL: ${page.url || ''}\n`;
    if (page.error) return `${output}\nRead issue: ${page.error}\n`;
    if (page.entities) {
      output += `\n### Entity catalogue\n\n${markdownTable(page.entityMetadata.columns, page.entityMetadata.rows)}\n`;
      for (const entity of page.entities) {
        output += `\n### ${entity.entity} members\n\n`;
        output += entity.available ? markdownTable(entity.columns, entity.rows) : '_Member list was not available on the rendered page._';
        if (entity.possibleMoreRows || entity.filtered) output += '\n\n_Possible additional rows or filters detected._';
      }
      return output;
    }
    if (page.tree) {
      output += `\n### Hierarchy\n\n${page.tree.map(item => `${'  '.repeat(Math.max(0, item.level - 1))}- ${item.name}`).join('\n') || '- No hierarchy rows detected.'}\n`;
      output += '\n### Board Analyze report\n';
      for (const table of page.analysisTables || []) output += `\n${markdownTable(table.columns, table.rows)}\n`;
    }
    for (const [index, table] of (page.tables || []).entries()) {
      output += `\n### Rendered table ${index + 1}${table.label ? `: ${table.label}` : ''}\n\n${markdownTable(table.columns, table.rows)}\n`;
      if (table.possibleMoreRows || table.filtered) output += '\n_Possible additional rows or filters detected._\n';
    }
    if (page.headings?.length) output += `\n### Headings\n\n${page.headings.map(heading => `- ${heading}`).join('\n')}\n`;
    if (page.text) output += `\n### Visible page text\n\n${page.text}\n`;
    return output;
  }).join('\n');
}

function renderReport() {
  if (!lastScan) return '';
  collectSelection();
  const agent = selectedAgent();
  const list = (items, selected) => items.length
    ? items.map(item => `- [${selected.includes(item.url) ? 'x' : ' '}] ${item.name} - ${item.url}`).join('\n')
    : '- None detected.';
  const headings = lastScan.headings.length ? lastScan.headings.map(text => `- ${text}`).join('\n') : '- No visible headings detected.';
  const frameNote = lastScan.crossOriginFrameHosts.length
    ? `\n\nCross-origin frame hosts present in the page: ${lastScan.crossOriginFrameHosts.join(', ')}. Their contents were not inspected.`
    : '';
  const status = lastScan.catalogStatus || 'Catalog not scanned.';
  const readAt = lastScan.deepReadStartedAt ? `\n- Selected read started: ${lastScan.deepReadStartedAt}` : '';
  const scan = `# Board read report\n\n- Reviewing agent: ${agent}\n- Initial analysis: ${lastScan.scannedAt}${readAt}\n- Starting page: ${lastScan.title}\n- URL: ${lastScan.url}\n- Board interface clues: ${lastScan.boardDetected ? 'detected' : 'not detected'}\n- Sign-in prompt visible: ${lastScan.signInPrompt ? 'yes' : 'no'}\n- Initial catalog: ${status}\n- Scope: ${lastScan.scope}${frameNote}\n\n## Data Models\n\n${list(lastScan.models, lastScan.checkedModels)}\n\n## Capsules\n\n${list(lastScan.capsules, lastScan.checkedCapsules)}\n\n## Starting page headings\n\n${headings}\n\n## Selected for deeper read\n\n- Data Models: ${lastScan.checkedModels.length}\n- Capsules: ${lastScan.checkedCapsules.length}\n`;
  return scan + renderDeepRead() + '\n\nThe extension does not send this report to an agent. It is a local read-only snapshot of rendered Board pages and may be partial where Board pages paginate or virtualize rows.\n';
}

function renderScan(scan) {
  lastScan = scan;
  byId('results').hidden = false;
  byId('page-title').textContent = scan.title;
  byId('page-url').textContent = scan.url;
  byId('page-summary').textContent = scan.boardDetected
    ? (scan.signInPrompt ? 'Board cues found, and a sign-in prompt is visible.' : scan.catalogStatus || 'Board interface cues found in this page.')
    : 'No clear Board interface cues found. The scan used the current page only.';
  byId('model-count').textContent = String(scan.models.length);
  byId('capsule-count').textContent = String(scan.capsules.length);
  renderEntries(byId('models-list'), scan.models, 'model', scan.checkedModels);
  renderEntries(byId('capsules-list'), scan.capsules, 'capsule', scan.checkedCapsules);
  byId('status').textContent = 'Inventory ready. Select Data Models or Capsules, then start the agent read.';
  byId('read-progress').replaceChildren();
  byId('read-progress').hidden = true;
  updateSelectionSummary();
  renderReport();
}

let activeTab = null;

function hostPattern(urlText) {
  const url = new URL(urlText);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Open Board in a normal http or https tab.');
  return `${url.protocol}//${url.host}/*`;
}

async function runAnalysis() {
  const button = byId('analyze');
  button.disabled = true;
  byId('status').textContent = 'Checking the Board model and capsule lists…';
  try {
    const tab = activeTab;
    if (!tab?.id) throw new Error('Could not find the active tab.');
    const pattern = hostPattern(tab.url);
    const permissionPromise = browser.permissions.request({origins:[pattern]});
    const pagePromise = browser.scripting.executeScript({
      target: {tabId: tab.id},
      func: analyzePage
    });
    const [permissionGranted, executions] = await Promise.all([permissionPromise, pagePromise]);
    const scan = executions[0]?.result;
    if (!scan) throw new Error('The active page did not return a readable document.');
    if (!scan.boardDetected) {
      scan.catalogStatus = 'No Board interface clues detected. Open Board in this tab and analyze again.';
      renderScan(scan);
      return;
    }
    if (!permissionGranted) {
      scan.catalogStatus = 'Site permission declined; showing only the current page inventory.';
      renderScan(scan);
      return;
    }
    const catalogResults = await Promise.all([
      readCatalog(scan.modelListUrl, 'models'),
      readCatalog(scan.capsuleListUrl, 'capsules')
    ]);
    const modelCatalog = catalogResults[0];
    const capsuleCatalog = catalogResults[1];
    scan.models = uniqueEntries([...(scan.models || []), ...(modelCatalog?.items || [])]);
    scan.capsules = uniqueEntries([...(scan.capsules || []), ...(capsuleCatalog?.items || [])]);
    scan.catalogStatus = `Read ${modelCatalog?.items?.length || 0} Data Models and ${capsuleCatalog?.items?.length || 0} Capsules from this site's Board lists.`;
    scan.catalogPages = [modelCatalog, capsuleCatalog];
    renderScan(scan);
  } catch (error) {
    byId('status').textContent = `Could not read this page: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

function readRoute(baseUrl, suffix) {
  const url = new URL(baseUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/${suffix}`;
  url.search = '';
  url.hash = '';
  return url.href;
}

async function startAgentRead() {
  collectSelection();
  const selectedModels = lastScan?.models.filter(item => lastScan.checkedModels.includes(item.url)) || [];
  const selectedCapsules = lastScan?.capsules.filter(item => lastScan.checkedCapsules.includes(item.url)) || [];
  if (!selectedModels.length && !selectedCapsules.length) {
    byId('status').textContent = 'Select at least one Data Model or Capsule first.';
    setReadStatus('Nothing selected. Check at least one Data Model or Capsule first.', 'error');
    return;
  }
  const button = byId('start-read');
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = 'Reading…';
  lastScan.deepRead = [];
  lastScan.deepReadStartedAt = new Date().toISOString();
  byId('read-progress').replaceChildren();
  byId('read-progress').hidden = false;
  try {
    setReadStatus(`Starting read: ${selectedModels.length} Data Model${selectedModels.length === 1 ? '' : 's'} and ${selectedCapsules.length} Capsule${selectedCapsules.length === 1 ? '' : 's'} selected.`);
    const permission = await browser.permissions.contains({origins:[hostPattern(lastScan.url)]});
    if (!permission) throw new Error('Site access was removed. Click Analyze to grant access before starting a read.');
    const tasks = [];
    for (const model of selectedModels) {
      for (const page of ['entities', 'cubes', 'relationships']) {
        tasks.push({scopeLabel:`${model.name} / ${page}`, url:readRoute(model.url, page), kind:page});
      }
    }
    for (const capsule of selectedCapsules) tasks.push({scopeLabel:`Capsule ${capsule.name}`, url:capsule.url, kind:'capsule'});
    for (let index = 0; index < tasks.length; index++) {
      const task = tasks[index];
      const progress = `Reading ${task.scopeLabel} (${index + 1}/${tasks.length})…`;
      byId('status').textContent = progress;
      setReadStatus(progress);
      try {
        const result = await inspectTemporaryTab(task.url, inspectSelectedPage, [task.kind]);
        if (!result?.ready) throw new Error('Board did not render this page in the available time.');
        lastScan.deepRead.push({scopeLabel:task.scopeLabel, url:task.url, ...result});
        addProgress(`✓ ${task.scopeLabel}`);
      } catch (error) {
        lastScan.deepRead.push({scopeLabel:task.scopeLabel, url:task.url, error:error.message});
        addProgress(`Could not read ${task.scopeLabel}: ${error.message}`);
      }
      renderReport();
    }
    const issues = lastScan.deepRead.filter(page => page.error).length;
    const completion = `Read complete: ${tasks.length - issues} of ${tasks.length} page${tasks.length === 1 ? '' : 's'} read${issues ? `; ${issues} issue${issues === 1 ? '' : 's'}` : ''}. Markdown report is ready. Download it below for ${selectedAgent()}.`;
    byId('status').textContent = completion;
    setReadStatus(completion, issues ? 'error' : 'done');
  } catch (error) {
    const message = `Could not complete the read: ${error.message}`;
    byId('status').textContent = message;
    setReadStatus(message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function downloadReport() {
  const blob = new Blob([renderReport()], {type: 'text/markdown;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'board-agent-read.md';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  byId('status').textContent = 'Downloaded board-agent-read.md.';
}

byId('agent').addEventListener('change', () => { updateAgentField(); void saveAgent(); });
byId('custom-agent').addEventListener('input', () => { void saveAgent(); });
byId('analyze').addEventListener('click', () => { void runAnalysis(); });
byId('start-read').addEventListener('click', () => { void startAgentRead(); });
byId('download').addEventListener('click', downloadReport);
byId('results').addEventListener('change', event => {
  if (event.target.matches('input[type="checkbox"]')) {
    updateSelectionSummary();
    renderReport();
  }
});
async function initializePopup() {
  await restoreAgent();
  const [tab] = await browser.tabs.query({active:true, currentWindow:true});
  activeTab = tab || null;
  byId('analyze').disabled = !activeTab;
}
void initializePopup();
