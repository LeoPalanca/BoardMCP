const { FirefoxClient } = require('./firefox-client.cjs');
(async () => {
  const client = new FirefoxClient();
  try {
    await client.connect();
    const context = await client.boardContext();
    console.log(await client.evaluate(context, `JSON.stringify({url:location.href,text:document.body.innerText.slice(0,14000),links:[...document.querySelectorAll('a[href]')].map(a=>({text:a.innerText,href:a.getAttribute('href')}))})`));
  } finally { await client.close(); }
})().catch(e => { console.error(e.message); process.exitCode=1; });
