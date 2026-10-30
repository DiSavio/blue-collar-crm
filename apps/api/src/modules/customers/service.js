const { validateCustomer } = require('../../../../../packages/shared/src/validation');

function createCustomerService(store) {
  return {
    list(search = '') {
      const query = search.trim().toLowerCase();
      return store.list('customers')
        .filter((customer) => !query || [customer.name, customer.phone, customer.email, customer.serviceAddress]
          .some((value) => value.toLowerCase().includes(query)))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    create(input) {
      return store.insert('customers', validateCustomer(input), 'cus');
    },
    update(id, input) {
      const existing = store.find('customers', id);
      return existing ? store.update('customers', id, validateCustomer({ ...existing, ...input })) : null;
    },
  };
}

module.exports = { createCustomerService };