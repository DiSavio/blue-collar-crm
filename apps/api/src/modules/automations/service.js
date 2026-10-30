function createAutomationService(store) {
  return {
    list() {
      return store.list('automations');
    },
    update(id, input) {
      if (!input || typeof input.enabled !== 'boolean') return { error: 'Enabled must be true or false.' };
      return store.update('automations', id, { enabled: input.enabled });
    },
  };
}

module.exports = { createAutomationService };