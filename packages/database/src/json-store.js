const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createSeed, LEGACY_DEMO_IDS } = require('./seed');

const COLLECTIONS = new Set(['customers', 'jobs', 'messages', 'automations']);

class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = null;
  }

  initialize() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      this.state = createSeed();
      this.persist();
      return;
    }
    const saved = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    for (const collection of COLLECTIONS) {
      if (!Array.isArray(saved[collection])) throw new Error(`The local CRM data file is missing the ${collection} collection.`);
    }

    const seed = createSeed();
    if ((saved.version || 0) < seed.version) {
      for (const collection of COLLECTIONS) {
        const seedIds = new Set(seed[collection].map((record) => record.id));
        const preservedRecords = saved[collection].filter((record) => !seedIds.has(record.id) && !LEGACY_DEMO_IDS.has(record.id));
        saved[collection] = [...seed[collection], ...preservedRecords];
      }
      saved.version = seed.version;
      this.state = saved;
      this.persist();
      return;
    }
    this.state = saved;
  }

  list(collection) {
    this.assertCollection(collection);
    return this.state[collection].map((record) => ({ ...record }));
  }

  find(collection, id) {
    this.assertCollection(collection);
    const record = this.state[collection].find((item) => item.id === id);
    return record ? { ...record } : null;
  }

  insert(collection, values, prefix) {
    this.assertCollection(collection);
    const record = { id: `${prefix}_${randomUUID()}`, ...values, createdAt: new Date().toISOString() };
    this.state[collection].push(record);
    this.persist();
    return { ...record };
  }

  update(collection, id, updates) {
    this.assertCollection(collection);
    const record = this.state[collection].find((item) => item.id === id);
    if (!record) return null;
    Object.assign(record, updates, { updatedAt: new Date().toISOString() });
    this.persist();
    return { ...record };
  }

  persist() {
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, this.filePath);
  }

  assertCollection(collection) {
    if (!COLLECTIONS.has(collection)) throw new Error(`Unknown collection: ${collection}`);
    if (!this.state) throw new Error('The local data store has not been initialized.');
  }
}

module.exports = { JsonStore };