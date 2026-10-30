const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { JsonStore } = require('../../../packages/database/src/json-store');
const { ValidationError } = require('../../../packages/shared/src/validation');
const { createCustomerService } = require('./modules/customers/service');
const { createJobService } = require('./modules/jobs/service');
const { createMessagingService } = require('./modules/messaging/service');
const { createAutomationService } = require('./modules/automations/service');

const WEB_ROOT = path.resolve(__dirname, '../../../apps/web/src/app');
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > 1024 * 1024) {
      const error = new Error('Request body must be smaller than 1 MB.');
      error.statusCode = 413;
      throw error;
    }
  }
  if (!body) return {};
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    const error = new Error('Request body must contain valid JSON.');
    error.statusCode = 400;
    throw error;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const error = new Error('Request body must be a JSON object.');
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

function routeMatch(pathname, expression) {
  const match = pathname.match(expression);
  return match ? decodeURIComponent(match[1]) : null;
}

function createServer({ store, dataFile } = {}) {
  const localStore = store || new JsonStore(dataFile || process.env.CRM_DATA_FILE || path.resolve(__dirname, '../../../data/crm.json'));
  localStore.initialize();
  const customers = createCustomerService(localStore);
  const jobs = createJobService(localStore);
  const messaging = createMessagingService(localStore);
  const automations = createAutomationService(localStore);

  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, 'http://localhost');
    const { pathname, searchParams } = requestUrl;
    const method = request.method || 'GET';

    try {
      if (pathname.startsWith('/api/')) {
        if (method === 'GET' && pathname === '/api/health') {
          return sendJson(response, 200, { status: 'ok', storage: 'local-json' });
        }

        if (method === 'GET' && pathname === '/api/dashboard') {
          const allCustomers = localStore.list('customers');
          const allJobs = localStore.list('jobs');
          const allMessages = localStore.list('messages');
          const today = new Date().toISOString().slice(0, 10);
          const todayJobs = allJobs.filter((job) => job.scheduledFor && job.scheduledFor.slice(0, 10) === today);
          const activeJobs = allJobs.filter((job) => job.status === 'scheduled' || job.status === 'in_progress');
          return sendJson(response, 200, {
            counts: {
              customers: allCustomers.length,
              leads: allCustomers.filter((customer) => customer.status === 'lead').length,
              activeJobs: activeJobs.length,
              scheduledToday: todayJobs.length,
              unreadMessages: allMessages.filter((message) => message.direction === 'inbound' && !message.readAt).length,
            },
            jobsToday: todayJobs,
            recentMessages: allMessages.slice().sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 5),
          });
        }

        if (method === 'GET' && pathname === '/api/customers') {
          return sendJson(response, 200, { customers: customers.list(searchParams.get('search') || '') });
        }
        if (method === 'POST' && pathname === '/api/customers') {
          return sendJson(response, 201, { customer: customers.create(await readJson(request)) });
        }
        const customerId = routeMatch(pathname, /^\/api\/customers\/([^/]+)$/);
        if (method === 'PATCH' && customerId) {
          const customer = customers.update(customerId, await readJson(request));
          return customer ? sendJson(response, 200, { customer }) : sendJson(response, 404, { error: 'Customer not found.' });
        }

        if (method === 'GET' && pathname === '/api/jobs') {
          return sendJson(response, 200, { jobs: jobs.list(searchParams.get('status') || '') });
        }
        if (method === 'POST' && pathname === '/api/jobs') {
          const result = jobs.create(await readJson(request));
          return result.error ? sendJson(response, 400, result) : sendJson(response, 201, { job: result });
        }
        const jobId = routeMatch(pathname, /^\/api\/jobs\/([^/]+)$/);
        if (method === 'PATCH' && jobId) {
          const result = jobs.update(jobId, await readJson(request));
          if (!result) return sendJson(response, 404, { error: 'Job not found.' });
          return result.error ? sendJson(response, 400, result) : sendJson(response, 200, { job: result });
        }

        if (method === 'GET' && pathname === '/api/messages') {
          return sendJson(response, 200, { messages: messaging.list(searchParams.get('customerId') || '') });
        }
        if (method === 'POST' && pathname === '/api/messages') {
          const result = messaging.send(await readJson(request));
          return result.error ? sendJson(response, 400, result) : sendJson(response, 201, result);
        }

        if (method === 'GET' && pathname === '/api/automations') {
          return sendJson(response, 200, { automations: automations.list() });
        }
        const automationId = routeMatch(pathname, /^\/api\/automations\/([^/]+)$/);
        if (method === 'PATCH' && automationId) {
          const result = automations.update(automationId, await readJson(request));
          if (!result) return sendJson(response, 404, { error: 'Automation not found.' });
          return result.error ? sendJson(response, 400, result) : sendJson(response, 200, { automation: result });
        }

        return sendJson(response, 404, { error: 'API route not found.' });
      }

      const relativePath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
      const filePath = path.resolve(WEB_ROOT, `.${relativePath}`);
      if (filePath !== WEB_ROOT && !filePath.startsWith(`${WEB_ROOT}${path.sep}`)) {
        return sendJson(response, 400, { error: 'Invalid path.' });
      }
      fs.readFile(filePath, (error, content) => {
        if (error) {
          response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          return response.end('Not found');
        }
        response.writeHead(200, {
          'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
        });
        response.end(content);
      });
    } catch (error) {
      const statusCode = error instanceof ValidationError ? 400 : error.statusCode || 500;
      if (statusCode === 500) console.error(error);
      sendJson(response, statusCode, { error: error.message || 'An unexpected error occurred.' });
    }
  });
}

if (require.main === module) {
  const server = createServer();
  const port = Number(process.env.PORT || 3000);
  server.listen(port, () => {
    console.log(`Blue Collar CRM is running at http://localhost:${port}`);
  });
}

module.exports = { createServer };