import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisitorCounter } from '../src/scripts/visits-client.js';
import { onRequestGet } from '../functions/api/visits.js';

function setup(hostname = 'y-m-apps-site.pages.dev', request) {
  let element = { textContent: '······', title: '' };
  const calls = [];
  const update = createVisitorCounter({hostname, getElement: () => element, request: async url => {
    calls.push(url);
    return request ? request(url) : {ok: true, json: async () => ({count: 613})};
  }});
  return {update, calls, get element() {return element;}, navigate() {element = {textContent:'······',title:''};}};
}

test('initial load increments once; navigation reads without incrementing', async () => {
  const s = setup();
  await s.update(); await s.update();
  assert.equal(s.element.textContent, '000613');
  assert.deepEqual(s.calls, ['/api/visits']);
  s.navigate(); await s.update();
  assert.equal(s.element.textContent, '000613');
  assert.deepEqual(s.calls, ['/api/visits', '/api/visits?peek=1']);
});

test('in-flight reply updates the new header, without a second request', async () => {
  let resolve;
  const gate = new Promise(r => {resolve = r;});
  const s = setup(undefined, () => gate);
  const pending = s.update();
  s.navigate(); s.update();
  resolve({ok:true,json:async()=>({count:20})});
  await pending;
  assert.equal(s.element.textContent,'000020');
  assert.equal(s.calls.length,1);
});

test('errors are distinct from loading and navigation retries read-only', async () => {
  const s = setup(undefined, () => {throw Error('offline');});
  await s.update();
  assert.equal(s.element.textContent,'—');
  s.navigate(); await s.update();
  assert.deepEqual(s.calls,['/api/visits','/api/visits?peek=1']);
});

test('local and deployment previews never increment production counts', async () => {
  for (const host of ['localhost','127.0.0.1','preview.y-m-apps-site.pages.dev']) {
    const s = setup(host); await s.update();
    assert.equal(s.element.textContent,'DEV'); assert.equal(s.calls.length,0);
  }
});

test('API reports asynchronous storage write failures without inventing a count', async () => {
  const response = await onRequestGet({request:new Request('https://example.com/api/visits'),env:{VISITS:{get:async()=> '613',put:async()=>{throw Error('write failed');}}}});
  assert.deepEqual(await response.json(),{count:613,warning:'kv_write_failed'});
});

test('peek reads existing count without writing', async () => {
  let writes = 0;
  const response = await onRequestGet({request:new Request('https://example.com/api/visits?peek=1'),env:{VISITS:{get:async()=> '613',put:async()=>{writes++;}}}});
  assert.deepEqual(await response.json(),{count:613}); assert.equal(writes,0);
});
