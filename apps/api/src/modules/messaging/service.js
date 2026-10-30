const { validateMessage } = require('../../../../../packages/shared/src/validation');

function createMessagingService(store) {
  return {
    list(customerId = '') {
      return store.list('messages')
        .filter((message) => !customerId || message.customerId === customerId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    },
    send(input) {
      const message = validateMessage(input);
      if (!store.find('customers', message.customerId)) return { error: 'Choose an existing customer.' };
      const savedMessage = store.insert('messages', message, 'msg');
      let autoReply = null;
      if (message.direction === 'inbound') {
        const rule = store.list('automations').find((automation) => automation.id === 'instant-reply' && automation.enabled);
        if (rule) {
          autoReply = store.insert('messages', {
            customerId: message.customerId,
            text: rule.response,
            direction: 'outbound',
            channel: message.channel,
            automated: true,
          }, 'msg');
        }
      }
      return { message: savedMessage, autoReply };
    },
  };
}

module.exports = { createMessagingService };