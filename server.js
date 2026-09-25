const readline = require('node:readline');
const { callBoard } = require('./browser-board.cjs');
const definitions = [
  { name: 'list_models', description: 'List local Board Data Models. Read-only metadata via the dedicated signed-in Firefox window. Navigates that window; returns rendered UI rows and completeness indicators.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true } },
  { name: 'list_entities', description: 'List Entities in a Board Data Model. Read-only metadata via the dedicated signed-in Firefox window. Navigates that window; returns rendered UI rows and completeness indicators.', inputSchema: { type: 'object', properties: { model: { type: 'string' } }, required: ['model'], additionalProperties: false }, annotations: { readOnlyHint: true } },
  { name: 'list_cubes', description: 'List Cubes in a Board Data Model. Read-only metadata via the dedicated signed-in Firefox window. Navigates that window; returns rendered UI rows and completeness indicators.', inputSchema: { type: 'object', properties: { model: { type: 'string' } }, required: ['model'], additionalProperties: false }, annotations: { readOnlyHint: true } },
  { name: 'list_entity_members', description: 'Read member codes, descriptions, and other rendered member fields for Entities in a Board Data Model. Omit entity to read every Entity. Read-only via the dedicated signed-in Firefox window.', inputSchema: { type: 'object', properties: { model: { type: 'string' }, entity: { type: 'string' } }, required: ['model'], additionalProperties: false }, annotations: { readOnlyHint: true } },
  { name: 'list_relationships', description: 'Read Entity hierarchy relationships from the Board Data Model Relationships tree. Read-only via the dedicated signed-in Firefox window.', inputSchema: { type: 'object', properties: { model: { type: 'string' } }, required: ['model'], additionalProperties: false }, annotations: { readOnlyHint: true } },
  { name: 'read_cube_data', description: 'Read matching Cube cell values from existing authenticated Board capsule DataView screens. Results may be filtered or aggregated by their screen layouts and are not guaranteed to include every stored cell.', inputSchema: { type: 'object', properties: { model: { type: 'string' }, cube: { type: 'string' } }, required: ['model', 'cube'], additionalProperties: false }, annotations: { readOnlyHint: true } },
];
const send = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);

async function handle(message) {
  if (!message || message.id === undefined || !message.method) return;
  const { id, method, params = {} } = message;
  if (method === 'initialize') {
    send({ jsonrpc: '2.0', id, result: { protocolVersion: params.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'board-local', version: '1.2.0' } } });
    return;
  }
  if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
  if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: definitions } });
  if (method !== 'tools/call') return send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
  try {
    const name = params.name;
    if (!definitions.some((tool) => tool.name === name)) throw new Error('Unknown Board tool');
    const model = params.arguments?.model;
    if (name !== 'list_models' && (typeof model !== 'string' || !model.trim())) throw new Error('A Data Model name is required');
    const args = params.arguments || {};
    if (name === 'read_cube_data' && (typeof args.cube !== 'string' || !args.cube.trim())) throw new Error('A Cube name is required');
    const data = await callBoard(name, model, args);
    send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(data) }], isError: Boolean(data.error) } });
  } catch (error) {
    send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: error.message || 'Board request failed' }], isError: true } });
  }
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on('line', (line) => { try { void handle(JSON.parse(line)); } catch { /* Ignore malformed input. */ } });
