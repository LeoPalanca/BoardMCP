class FirefoxClient {
  constructor() { this.nextId = 0; this.pending = new Map(); }
  async connect() {
    this.socket = new WebSocket('ws://127.0.0.1:9228/session');
    this.socket.addEventListener('close', () => {
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('Board Firefox disconnected')); }
      this.pending.clear();
    });
    this.socket.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id); clearTimeout(pending.timer);
      if (msg.type === 'error') pending.reject(new Error(`${msg.error}: ${msg.message}`));
      else pending.resolve(msg.result);
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Board Firefox is unavailable. Run Open-BoardFirefox.ps1.')), 5000);
      this.socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Board Firefox is unavailable. Run Open-BoardFirefox.ps1.')); }, { once: true });
    });
    await this.send('session.new', { capabilities: {} });
    this.hasSession = true;
    return this;
  }
  send(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timed out`)); }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async boardContext() {
    const { contexts } = await this.send('browsingContext.getTree', {});
    const page = contexts.find(c => { try { return new URL(c.url).origin === 'http://localhost'; } catch { return false; } });
    if (!page) throw new Error('Open http://localhost/en/ in the dedicated Board Firefox window and sign in.');
    return page.context;
  }
  async evaluate(context, expression) {
    const result = await this.send('script.evaluate', {
      expression: `(() => { if (location.origin !== 'http://localhost') throw new Error('Not on local Board'); return (${expression}); })()`,
      target: { context }, awaitPromise: true, resultOwnership: 'none',
    });
    if (result.type === 'exception') throw new Error(result.exceptionDetails?.text || 'Board page evaluation failed');
    return result.result?.value;
  }
  async close() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      if (this.hasSession) { try { await this.send('session.end', {}); } catch {} }
      this.hasSession = false;
      this.socket.close();
    }
  }
}
module.exports = { FirefoxClient };
