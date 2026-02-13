# Wholesale Inquiry Data Bridge

Embedded Shopify app (React Router + Prisma) for reviewing wholesale inquiries and converting them into Shopify customers.

## What this app does

- Loads `WholesaleInquiry` records from SQLite via Prisma.
- Shows inquiry rows in the embedded admin page (`/app`).
- Lets an admin approve only `PENDING` inquiries.
- On approve:
  - Finds Shopify customer by inquiry email.
  - Updates existing customer if found.
  - Creates a new customer if not found.
  - Maps inquiry details into customer fields and note.
  - Marks inquiry status as `APPROVED` after successful Shopify mutation.

## Tech stack

- React Router 7
- Shopify App Bridge + `@shopify/shopify-app-react-router`
- Prisma ORM
- SQLite (local default)
- TypeScript

## Data model

Current `WholesaleInquiry` model (`prisma/schema.prisma`):

- Required:
  - `firstName`
  - `lastName`
  - `email` (unique)
  - `phoneNumber`
  - `companyName`
- Optional:
  - `address1`, `address2`, `city`, `province`, `postalCode`, `country`
  - `website`, `instagramUrl`, `facebookUrl`, `amazonShopUrl`, `etsyShopUrl`
- System:
  - `status` (`PENDING` default)
  - `createdAt`

## Project scripts

- `npm run dev`: Start Shopify app dev server.
- `npm run build`: Build app.
- `npm run start`: Run built server.
- `npm run deploy`: Deploy app config/version with Shopify CLI.
- `npm run config:link`: Link local project to Shopify app.
- `npm run setup`: `prisma generate && prisma migrate deploy`.
- `npm run typecheck`: React Router typegen + TypeScript check.

## Testing (Playwright)

This project includes E2E approval-flow tests in `tests/approval.spec.ts`.

### What the approval test validates

- Creates a `PENDING` wholesale inquiry row in the test DB.
- Opens `/app`.
- Clicks the row's `Approve` button.
- Verifies status changes to `APPROVED`.
- Verifies the approve button is removed for that row.

### Run tests

Run the approval spec:

```bash
E2E_TEST_MODE=true npx playwright test tests/approval.spec.ts
```

Run in headed mode:

```bash
E2E_TEST_MODE=true npx playwright test tests/approval.spec.ts --headed --project=chromium
```

Open interactive Playwright UI:

```bash
E2E_TEST_MODE=true npx playwright test --ui
```

Open last HTML report:

```bash
npx playwright show-report
```

### E2E mode behavior

For tests, `E2E_TEST_MODE=true` bypasses Shopify admin authentication and external customer GraphQL calls in approval routes, so tests run fully local against Prisma/SQLite.

## Local development

1. Install dependencies:

```bash
npm install
```

2. Link app config (first time):

```bash
npm run config:link
```

3. Apply migrations / generate Prisma client:

```bash
npm run setup
```

4. Run app:

```bash
npm run dev
```

## Prisma workflows

### After schema changes

```bash
npx prisma migrate dev -n "your_migration_name"
npx prisma generate
```

### Open DB UI

```bash
npx prisma studio
```

### Reset local database (destructive)

```bash
npx prisma migrate reset
```

Use only for local development.

## Shopify permissions required

The approve flow uses Shopify Customer API access. Configure:

- Scopes in `shopify.app.toml`:
  - `read_customers`
  - `write_customers`
- Protected customer data access in Partner Dashboard:
  - Select protected customer data usage and required fields (at least Name/Email for this app).

Without protected customer data approval, customer GraphQL operations fail with:

- `This app is not approved to access the Customer object`

After permission changes:

1. Release/update app version in Partner Dashboard.
2. Run `npm run deploy`.
3. Re-open/re-authorize app in the dev store.

## Approval behavior

In `app/routes/app._index.tsx`:

- Server validates inquiry by `id`.
- Rejects approval if status is already `APPROVED`.
- Uses email lookup to decide update vs create.
- Writes optional inquiry info into `note` and address fields when available.
- Updates local inquiry status to `APPROVED` only when Shopify mutation succeeds.

## Troubleshooting

### `This app is not approved to access the Customer object`

- Complete Protected Customer Data setup in Partner Dashboard.
- Ensure `read_customers`/`write_customers` scopes are included.
- Re-deploy and re-authorize app.

### `attempt to write a readonly database`

Usually stale/locked SQLite state.

```bash
# stop dev server first
rm -f prisma/dev.sqlite prisma/dev.sqlite-wal prisma/dev.sqlite-shm prisma/dev.sqlite-journal
npx prisma migrate dev
npx prisma generate
npm run dev
```

### Prisma column mismatch errors

Example: `column ... contactEmail does not exist`.

- Regenerate client and restart dev server:

```bash
npx prisma generate
npm run dev
```

- Ensure app code references current schema fields (`email`, `firstName`, `lastName`, etc.).

### Playwright `webServer` startup fails

If Playwright shows `Process from config.webServer was not able to start`, run the server command from `playwright.config.ts` manually to inspect the real error:

```bash
SHOPIFY_API_KEY=test SHOPIFY_API_SECRET=test SHOPIFY_APP_URL=http://127.0.0.1:3000 SCOPES=read_customers,write_customers E2E_TEST_MODE=true npm run build && SHOPIFY_API_KEY=test SHOPIFY_API_SECRET=test SHOPIFY_APP_URL=http://127.0.0.1:3000 SCOPES=read_customers,write_customers E2E_TEST_MODE=true PORT=3000 npm run start
```

## Notes

- This repository currently contains the embedded admin approval flow. If you use a separate public form/service to insert `WholesaleInquiry` rows, keep its payload aligned with the Prisma model above.
