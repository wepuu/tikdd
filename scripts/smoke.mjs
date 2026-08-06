const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";

const catalogResponse = await fetch(`${apiBaseUrl}/v1/platforms`);
if (!catalogResponse.ok) {
  throw new Error(`Platform catalog failed with HTTP ${catalogResponse.status}.`);
}
const catalog = await catalogResponse.json();

const createResponse = await fetch(`${apiBaseUrl}/v1/resolve-tasks`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url: "https://www.instagram.com/reel/TikDDSmokeTest/",
    confirmedRights: true
  })
});
if (!createResponse.ok) {
  throw new Error(`Task creation failed with HTTP ${createResponse.status}.`);
}

let task = await createResponse.json();
for (let attempt = 0; attempt < 30 && !["succeeded", "failed", "expired"].includes(task.status); attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const response = await fetch(`${apiBaseUrl}/v1/resolve-tasks/${task.id}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Task polling failed with HTTP ${response.status}.`);
  }
  task = await response.json();
}

if (task.status !== "succeeded" || task.platform !== "instagram") {
  throw new Error(`Smoke task did not succeed: ${JSON.stringify(task.error ?? task.status)}.`);
}

process.stdout.write(
  `${JSON.stringify(
    {
      catalogCount: catalog.platforms.length,
      taskId: task.id,
      platform: task.platform,
      provider: task.result.provenance.provider,
      formatCount: task.result.formats.length
    },
    null,
    2
  )}\n`
);

