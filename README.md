# MLProcour CRM

A local-first CRM starter for MLProcour, a landscaping business serving Montréal's South Shore. It includes a bilingual English/French-Canadian dashboard, a small Node.js API, and a JSON-backed starter data store. No database or package install is required.

## Run it

Requires Node.js 18 or newer.

```sh
npm start
```

Open http://localhost:3000. The first run creates `data/crm.json` with sample landscaping clients, outdoor projects, conversations, and automation rules from Brossard, Longueuil, Saint-Lambert, and La Prairie. Existing starter records are migrated to those examples while unrelated records are preserved. That file is ignored by git. Set `PORT` or `CRM_DATA_FILE` in the environment to change the server port or data location.

Use `npm run dev` for automatic server restarts during development. Run the tests with `npm test` and syntax checks with `npm run check`.

## Use on iPhone

On the same Wi-Fi network as the computer running the CRM, open `http://<computer-LAN-IP>:3000` in Safari. Use Safari’s Share menu and choose **Add to Home Screen** for an app-like shortcut. The mobile layout has bottom navigation, touch-sized controls, call/text links, Apple Maps directions, and a focused conversation view. Use the `EN` / `FR` control in the top-right corner to switch languages; the selection is remembered on that device. iOS requires HTTPS for service-worker/offline support; the local HTTP address is for testing the live app while the server is running. Deploy behind HTTPS before relying on offline behavior or adding real client data.

## Starter workflows

- Add and search client records, including contact details, South Shore service address, referral source, status, and site notes.
- Create landscaping jobs, assign a client, record a schedule and estimated value in CAD, and change job status.
- Review the sample inbox and record replies in the local conversation history.
- Enable or disable the new-inquiry auto-reply. Inbound messages created through the API receive the configured reply when this rule is enabled.
- See today’s schedule, active jobs, open leads, and customer count on the dashboard.

## API

All endpoints are served from the same origin. Requests and responses use JSON.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/dashboard` | Dashboard counts and recent activity |
| `GET`, `POST` | `/api/customers` | List/search or create customers |
| `PATCH` | `/api/customers/:id` | Update a customer |
| `GET`, `POST` | `/api/jobs` | List/filter or create jobs |
| `PATCH` | `/api/jobs/:id` | Update a job |
| `GET`, `POST` | `/api/messages` | List or add conversation messages |
| `GET` | `/api/automations` | List automation rules |
| `PATCH` | `/api/automations/:id` | Enable or disable a rule |

Create a customer with `POST /api/customers` and a JSON body such as:

```json
{
  "name": "Jordan Lee",
  "phone": "503-555-0100",
  "serviceAddress": "10 Main St, Portland",
  "source": "Referral"
}
```

An inbound message uses `POST /api/messages` with `customerId`, `text`, and `direction: "inbound"`. If the auto-reply rule is enabled, the response includes the generated automatic reply.

## Project layout

```text
apps/
  api/src/              HTTP server and customer, job, messaging, automation services
  api/tests/            API and domain tests
  web/src/app/          Bilingual browser app, MLProcour logo, styles, and PWA assets
  web/src/features/     Reserved feature modules for future UI extraction
packages/
  database/src/         Seed data and local JSON store
  shared/src/           Shared validation
data/                   Created on first run; local data is git-ignored
```

## Production next steps

This is a starter, not a production deployment. The JSON store is intended for local development and a single process; use a transactional database before multi-user or concurrent production use. Outbound SMS, email, authentication, team permissions, background scheduling, backups, and compliance workflows are not connected. The inbox records messages locally and simulates a bilingual automatic reply; connect a provider such as Twilio before representing texts as delivered. Add tenant isolation and audit logging before storing real client information.
