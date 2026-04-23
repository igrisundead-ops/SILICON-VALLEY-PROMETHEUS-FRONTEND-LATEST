async function main() {
  const url = "http://localhost:3000/api/airtable/images?limit=50";
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  if (!res.ok) {
    console.error(`HTTP ${res.status}`);
    console.error(text);
    process.exitCode = 1;
    return;
  }

  const data = JSON.parse(text);
  const items = Array.isArray(data.items) ? data.items : [];

  const keys = new Map();
  for (const item of items) {
    const styleKey = item?.styleKey ?? null;
    const hasImage = !!(item?.thumbUrl || item?.imageUrl);
    const hasAttachment = !!item?.hasAttachment;
    if (!keys.has(styleKey)) {
      keys.set(styleKey, { hasImage, hasAttachment });
    }
  }

  console.log(`items=${items.length} distinct_styleKeys=${keys.size}`);
  for (const [styleKey, info] of keys.entries()) {
    console.log(
      JSON.stringify(
        {
          styleKey,
          hasImage: info.hasImage,
          hasAttachment: info.hasAttachment,
        },
        null,
        0
      )
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

