import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright');
import fs from 'fs'; import path from 'path';
const root = process.argv[2], out = process.argv[3];
const files = fs.readFileSync(0,'utf8').trim().split('\n');
const b = await chromium.launch();
const res = {};
for (const f of files) {
  const ctx = await b.newContext({ viewport:{width:1100,height:720} });
  const p = await ctx.newPage(); const errs=[]; let net=0;
  await ctx.route(/^https?:/, r => { net++; r.abort(); });
  p.on('pageerror', e=>errs.push(String(e.message).slice(0,160)));
  p.on('console', m=>{ if(m.type()==='error') errs.push(m.text().slice(0,160)); });
  p.on('dialog', d=>d.dismiss());
  try { await p.goto('file://'+path.resolve(root,f), {timeout:15000}); await p.waitForTimeout(1500);
    await p.screenshot({path: path.join(out, f.replace(/[\/ ]/g,'__')+'.png')}); }
  catch(e){ errs.push('LOAD: '+e.message.slice(0,120)); }
  res[f] = { errs: [...new Set(errs)].slice(0,6), blockedRequests: net };
  await ctx.close();
}
await b.close();
fs.writeFileSync(path.join(out,'results.json'), JSON.stringify(res,null,1));
