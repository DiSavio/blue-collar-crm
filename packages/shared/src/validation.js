class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

function text(value, field, { required = false, max = 500 } = {}) {
  if (typeof value !== 'string') {
    if (required) throw new ValidationError(`${field} is required.`);
    return '';
  }
  const result = value.trim();
  if (required && !result) throw new ValidationError(`${field} is required.`);
  if (result.length > max) throw new ValidationError(`${field} must be ${max} characters or fewer.`);
  return result;
}

function oneOf(value, field, choices, fallback) {
  const result = value === undefined ? fallback : value;
  if (!choices.includes(result)) throw new ValidationError(`${field} must be one of: ${choices.join(', ')}.`);
  return result;
}

function validateCustomer(input) {
  const customer = {
    name: text(input.name, 'Name', { required: true, max: 100 }),
    phone: text(input.phone, 'Phone', { max: 40 }),
    email: text(input.email, 'Email', { max: 120 }),
    serviceAddress: text(input.serviceAddress, 'Service address', { max: 180 }),
    source: text(input.source, 'Lead source', { max: 80 }) || 'Other',
    notes: text(input.notes, 'Notes', { max: 1000 }),
    status: oneOf(input.status, 'Status', ['lead', 'active', 'inactive'], 'lead'),
  };
  if (!customer.phone && !customer.email) throw new ValidationError('Add a phone number or email address.');
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    throw new ValidationError('Enter a valid email address.');
  }
  return customer;
}

function validateJob(input) {
  const job = {
    title: text(input.title, 'Job title', { required: true, max: 120 }),
    customerId: text(input.customerId, 'Customer', { required: true, max: 80 }),
    address: text(input.address, 'Job address', { max: 180 }),
    scheduledFor: text(input.scheduledFor, 'Scheduled date', { max: 40 }),
    status: oneOf(input.status, 'Status', ['estimate', 'scheduled', 'in_progress', 'complete'], 'estimate'),
    amount: input.amount === '' || input.amount === undefined ? null : Number(input.amount),
    notes: text(input.notes, 'Notes', { max: 1000 }),
  };
  if (job.amount !== null && (!Number.isFinite(job.amount) || job.amount < 0)) {
    throw new ValidationError('Amount must be a non-negative number.');
  }
  return job;
}

function validateMessage(input) {
  return {
    customerId: text(input.customerId, 'Customer', { required: true, max: 80 }),
    text: text(input.text, 'Message', { required: true, max: 2000 }),
    direction: oneOf(input.direction, 'Direction', ['inbound', 'outbound'], 'outbound'),
    channel: oneOf(input.channel, 'Channel', ['sms', 'email'], 'sms'),
  };
}

module.exports = { ValidationError, validateCustomer, validateJob, validateMessage };