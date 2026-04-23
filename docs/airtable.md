# Airtable (Image Archive)

This app can load style preview images from Airtable (server-side only) via:

- `GET /api/airtable/images`

## Environment variables

Create `v0-coding-dashboard/.env` (not committed) and set:

```
AIRTABLE_TOKEN=YOUR_AIRTABLE_PAT
AIRTABLE_BASE_ID=appjwoTTURxC8xGbM
AIRTABLE_IMAGE_TABLE=tblqpMDRFM9bshXwk
```

Notes:
- The token is never sent to the browser.
- If env vars are missing, the endpoint returns a clear error JSON with HTTP 500.

## Troubleshooting blank previews

If the “Templates and Styles” modal shows blank previews:

- Verify Airtable `styleKey` values match either `template.id` (e.g. `style_iman_clean`) or `template.name` (e.g. `Iman Clean`).
- Run `node scripts/verify_airtable_previews.mjs` for a single-command health + sample-items check.
- Run `node scripts/print_airtable_keys.js` to see distinct `styleKey` values and whether `thumbUrl`/`imageUrl` are present.

## Endpoint usage

- Optional query params:
  - `view` (Airtable view name)
  - `limit` (default `50`)

Example:

```
/api/airtable/images?view=Grid%20view&limit=100
```
