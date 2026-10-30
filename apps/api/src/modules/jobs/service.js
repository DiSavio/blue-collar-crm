const { validateJob } = require('../../../../../packages/shared/src/validation');

function createJobService(store) {
  function validateCustomer(job) {
    return store.find('customers', job.customerId) ? job : { error: 'Choose an existing customer.' };
  }
  return {
    list(status = '') {
      return store.list('jobs')
        .filter((job) => !status || job.status === status)
        .sort((left, right) => (left.scheduledFor || left.createdAt).localeCompare(right.scheduledFor || right.createdAt));
    },
    create(input) {
      const job = validateCustomer(validateJob(input));
      return job.error ? job : store.insert('jobs', job, 'job');
    },
    update(id, input) {
      const existing = store.find('jobs', id);
      if (!existing) return null;
      const job = validateCustomer(validateJob({ ...existing, ...input }));
      return job.error ? job : store.update('jobs', id, job);
    },
  };
}

module.exports = { createJobService };