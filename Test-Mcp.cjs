const { spawn } = require('node:child_process');
const readline = require('node:readline');
const assert = require('node:assert/strict');
const child = spawn(process.execPath, [require('node:path').join(__dirname, 'server.js')], {windowsHide:true});
const pending = new Map();
let nextId = 0;
readline.createInterface({input:child.stdout}).on('line', line => {
  const reply = JSON.parse(line); const p = pending.get(reply.id);
  if (p) {clearTimeout(p.timer); pending.delete(reply.id); p.resolve(reply);}
});
child.stderr.pipe(process.stderr);
function request(method, params) {
  return new Promise((resolve,reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 90000);
    pending.set(id,{resolve,reject,timer});
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
  });
}
(async () => {
  try {
    assert.equal((await request('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'board-smoke',version:'1'}})).result.serverInfo.version,'1.2.0');
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
    assert.equal((await request('tools/list',{})).result.tools.length,6);
    for (const name of ['list_models','list_entities','list_cubes']) {
      const reply = await request('tools/call',{name,arguments:name==='list_models'?{}:{model:'Leonardo'}});
      assert.equal(reply.result.isError,false,reply.result.content[0].text);
      const data = JSON.parse(reply.result.content[0].text);
      assert.ok(data.count > 0);
      if (name==='list_models') assert.ok(data.models.includes('Leonardo'));
      else assert.ok(data.columns.length > 0);
      console.log(JSON.stringify({tool:name,count:data.count,allRowsRead:data.allRowsRead,names:data.models || data.rows.map(r=>Object.values(r)[0])}));
    }
    const invalid = await request('tools/call',{name:'list_entities',arguments:{model:'../identity'}});
    assert.equal(invalid.result.isError,true);
    console.log('PASS: MCP initialize, tools/list, three live reads, invalid model rejection.');
  } finally { child.stdin.end(); child.kill(); for (const p of pending.values()) clearTimeout(p.timer); }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
