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
      if (!knownModelSections.has(name.toLocaleLowerCase())) addModel(name, safeUrl(link.url), link.label);
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
    if (!knownModelSections.has(name.toLocaleLowerCase())) addModel(name, safeUrl(current), document.title);
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

  return {
    title: document.title || '(untitled page)',
    url: safeUrl(current),
    host: current.hostname,
    boardDetected,
    signInPrompt,
    headings,
    models: unique(models).sort((a,b) => a.name.localeCompare(b.name)),
    capsules: unique(capsules).sort((a,b) => a.name.localeCompare(b.name)),
    crossOriginFrameHosts: [...new Set(crossOriginFrameHosts)],
    checkedModels: [],
    checkedCapsules: [],
    scannedAt: new Date().toISOString(),
    scope: 'Visible links, headings, and the current URL in the active top-level page. The extension did not navigate or request page data from a server.'
  };
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

function renderReport() {
  if (!lastScan) return '';
  collectSelection();
  const agent = selectedAgent();
  const list = (items, selected) => items.length
    ? items.map(item => `- [${selected.includes(item.url) ? 'x' : ' '}] ${item.name} — ${item.url}`).join('\n')
    : '- None detected on the active page.';
  const headings = lastScan.headings.length ? lastScan.headings.map(text => `- ${text}`).join('\n') : '- No visible headings detected.';
  const frameNote = lastScan.crossOriginFrameHosts.length
    ? `\n\nCross-origin frame hosts present in the page: ${lastScan.crossOriginFrameHosts.join(', ')}. Their contents were not inspected.`
    : '';
  return `# Board initial analysis\n\n- Reviewing agent: ${agent}\n- Scanned at: ${lastScan.scannedAt}\n- Page: ${lastScan.title}\n- URL: ${lastScan.url}\n- Board interface clues: ${lastScan.boardDetected ? 'detected' : 'not detected'}\n- Sign-in prompt visible: ${lastScan.signInPrompt ? 'yes' : 'no'}\n- Scan scope: ${lastScan.scope}${frameNote}\n\n## Data Models\n\n${list(lastScan.models, lastScan.checkedModels)}\n\n## Capsules\n\n${list(lastScan.capsules, lastScan.checkedCapsules)}\n\n## Visible headings\n\n${headings}\n\n## Selected for a future deep scan\n\n- Data Models: ${lastScan.checkedModels.length}\n- Capsules: ${lastScan.checkedCapsules.length}\n\nThe selected deep scan is not available in this extension version. This report lists only items discoverable from the current page's visible links and URL; it is not a complete Board inventory. No page data was sent to an agent or remote service.\n`;
}

function renderScan(scan) {
  lastScan = scan;
  byId('results').hidden = false;
  byId('page-title').textContent = scan.title;
  byId('page-url').textContent = scan.url;
  byId('page-summary').textContent = scan.boardDetected
    ? (scan.signInPrompt ? 'Board cues found, and a sign-in prompt is visible.' : 'Board interface cues found in this page.')
    : 'No clear Board interface cues found. The scan used the current page only.';
  byId('model-count').textContent = String(scan.models.length);
  byId('capsule-count').textContent = String(scan.capsules.length);
  renderEntries(byId('models-list'), scan.models, 'model', scan.checkedModels);
  renderEntries(byId('capsules-list'), scan.capsules, 'capsule', scan.checkedCapsules);
  byId('status').textContent = 'Initial inventory ready. Check items to mark a future deep-scan scope.';
  renderReport();
}

async function runAnalysis() {
  const button = byId('analyze');
  button.disabled = true;
  byId('status').textContent = 'Reading visible page structure…';
  try {
    const [tab] = await browser.tabs.query({active: true, currentWindow: true});
    if (!tab?.id) throw new Error('Could not find the active tab.');
    const [{result}] = await browser.scripting.executeScript({
      target: {tabId: tab.id},
      func: analyzePage
    });
    if (!result) throw new Error('The active page did not return a readable document.');
    renderScan(result);
  } catch (error) {
    byId('status').textContent = `Could not read this page: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

async function copyReport() {
  try {
    await navigator.clipboard.writeText(renderReport());
    byId('status').textContent = `Report copied for ${selectedAgent()}. Paste it into that agent when ready.`;
  } catch (error) {
    byId('status').textContent = `Could not copy report: ${error.message}`;
  }
}

function downloadReport() {
  const blob = new Blob([renderReport()], {type: 'text/markdown;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'board-initial-analysis.md';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  byId('status').textContent = 'Downloaded board-initial-analysis.md.';
}

byId('agent').addEventListener('change', () => { updateAgentField(); void saveAgent(); });
byId('custom-agent').addEventListener('input', () => { void saveAgent(); });
byId('analyze').addEventListener('click', () => { void runAnalysis(); });
byId('copy').addEventListener('click', () => { void copyReport(); });
byId('download').addEventListener('click', downloadReport);
byId('results').addEventListener('change', event => {
  if (event.target.matches('input[type="checkbox"]')) renderReport();
});
void restoreAgent();
