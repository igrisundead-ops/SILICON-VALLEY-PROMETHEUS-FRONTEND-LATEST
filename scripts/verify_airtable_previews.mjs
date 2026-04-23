import fs from "node:fs";
import path from "node:path";

function loadDotEnvIfPresent(cwd) {
  const envPath = path.join(cwd, ".env");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (!key) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

function hasEnv(name) {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

function hostnameOnly(url) {
  if (typeof url !== "string" || url.length === 0) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, ms = 10_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function getJson(url) {
  const res = await fetchWithTimeout(url);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // ignore
  }
  return { res, text, json };
}

async function main() {
  console.log(`cwd: ${process.cwd()}`);

  loadDotEnvIfPresent(process.cwd());

  console.log(`env AIRTABLE_TOKEN: ${hasEnv("AIRTABLE_TOKEN")}`);
  console.log(`env AIRTABLE_BASE_ID: ${hasEnv("AIRTABLE_BASE_ID")}`);
  console.log(`env AIRTABLE_IMAGE_TABLE: ${hasEnv("AIRTABLE_IMAGE_TABLE")}`);

  const healthUrl = "http://localhost:3000/api/airtable/health";
  const imagesUrl = "http://localhost:3000/api/airtable/images?limit=5";

  let shouldFail = false;

  const health = await getJson(healthUrl);
  if (!health.res.ok) {
    console.error(`health status: HTTP ${health.res.status}`);
    console.error(health.text);
    shouldFail = true;
  }

  const ok = !!health.json?.ok;
  console.log(
    JSON.stringify(
      {
        ok,
        hasToken: !!health.json?.hasToken,
        baseId: health.json?.baseId ?? null,
        table: health.json?.table ?? null,
      },
      null,
      0
    )
  );
  if (!ok) shouldFail = true;

  const images = await getJson(imagesUrl);
  if (!images.res.ok) {
    console.error(`images status: HTTP ${images.res.status}`);
    console.error(images.text);
    shouldFail = true;
  }

  const items = Array.isArray(images.json?.items) ? images.json.items : [];
  console.log(`images.count=${images.json?.count ?? null} items_returned=${items.length}`);

  for (const item of items.slice(0, 3)) {
    console.log(
      JSON.stringify(
        {
          id: item?.id ?? null,
          styleKey: item?.styleKey ?? null,
          hasAttachment: !!item?.hasAttachment,
          thumbUrlHost: hostnameOnly(item?.thumbUrl ?? null),
          imageUrlHost: hostnameOnly(item?.imageUrl ?? null),
        },
        null,
        0
      )
    );
  }

  if (items.length === 0) {
    shouldFail = true;
  }

  process.exitCode = shouldFail ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
