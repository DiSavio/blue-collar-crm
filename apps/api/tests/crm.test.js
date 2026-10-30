const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { JsonStore } = require('../../../packages/database/src/json-store');
const { ValidationError, validateCustomer, validateJob } = require('../../../packages/shared/src/validation');
const { createMessagingService } = require('../src/modules/messaging/service');
const { createServer } = require('../src/server');

function makeStore() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-collar-crm-'));
  const store = new JsonStore(path.join(directory, 'crm.json'));
  store.initialize();
  return { store, directory };
}

test('legacy starter data migrates to South Shore samples and keeps non-seed records', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-collar-crm-migration-'));
  const filePath = path.join(directory, 'crm.json');
  fs.writeFileSync(filePath, JSON.stringify({
    version: 1,
    customers: [
      { id: 'cus_1001', name: 'Morgan Ellis' },
      { id: 'cus_custom', name: 'My saved client' },
      { id: 'cus_5297b25b-1946-4375-aec0-75a482b5f992', name: 'Demo: Summit Plumbing' },
    ],
    jobs: [{ id: 'job_custom', title: 'Saved job' }],
    messages: [],
    automations: [],
  }));
  try {
    const store = new JsonStore(filePath);
    store.initialize();
    assert.equal(store.find('customers', 'cus_1001').name, 'Mélanie Roy');
    assert.equal(store.find('customers', 'cus_custom').name, 'My saved client');
    assert.equal(store.find('customers', 'cus_5297b25b-1946-4375-aec0-75a482b5f992'), null);
    assert.equal(store.find('jobs', 'job_custom').title, 'Saved job');
    assert.equal(store.state.version, 2);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('customer validation requires a name and a contact method', () => {
  assert.throws(() => validateCustomer({ name: '   ', phone: '' }), ValidationError);
  assert.throws(() => validateCustomer({ name: 'Jordan Lee' }), /phone number or email/);
  assert.equal(validateCustomer({ name: ' Jordan Lee ', phone: ' 555-0100 ' }).name, 'Jordan Lee');
});

test('job validation rejects invalid amounts', () => {
  assert.throws(() => validateJob({ title: 'Repair', customerId: 'cus_1', amount: -1 }), /non-negative/);
});

test('inbound messages get a reply only while the automation is enabled', () => {
  const { store, directory } = makeStore();
  try {
    const messaging = createMessagingService(store);
    const first = messaging.send({ customerId: 'cus_1005', text: 'Can you help?', direction: 'inbound' });
    assert.ok(first.autoReply);
    assert.equal(first.autoReply.direction, 'outbound');
    store.update('automations', 'instant-reply', { enabled: false });
    const second = messaging.send({ customerId: 'cus_1005', text: 'Are you open?', direction: 'inbound' });
    assert.equal(second.autoReply, null);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('API serves the dashboard and validates customer creation', async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blue-collar-crm-api-'));
  const server = createServer({ dataFile: path.join(directory, 'crm.json') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => { server.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const root = await fetch(baseUrl);
  assert.equal(root.status, 200);
  const html = await root.text();
  assert.match(html, /MLProcour/);
  assert.match(html, /id="view-calendar"/);
  assert.match(html, /data-calendar-mode="month"/);
  assert.equal((await fetch(`${baseUrl}/locales.js`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/mlprocour-logo.svg`)).status, 200);
  const manifest = await fetch(`${baseUrl}/manifest.webmanifest`);
  assert.equal(manifest.status, 200);
  assert.match(manifest.headers.get('content-type'), /application\/manifest\+json/);
  assert.equal((await fetch(`${baseUrl}/sw.js`)).status, 200);
  assert.match((await fetch(`${baseUrl}/mlprocour-icon.png`)).headers.get('content-type'), /image\/png/);
  const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
  assert.equal(health.status, 'ok');

  const created = await fetch(`${baseUrl}/api/customers`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Casey Rivera', phone: '503-555-0101', serviceAddress: '10 Main St' }),
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).customer.name, 'Casey Rivera');
  const invalid = await fetch(`${baseUrl}/api/customers`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'No contact details' }),
  });
  assert.equal(invalid.status, 400);
});