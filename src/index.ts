import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { migrateOnBoot } from "./db/migrate-boot.js";
import { testConnection } from "./db/pool.js";

async function main() {
  try {
    await migrateOnBoot();
  } catch (err) {
    console.error("[template-retail-api] migrate falló:", err);
    if (env.nodeEnv === "production") process.exit(1);
  }

  const app = createApp();
  app.listen(env.port, async () => {
    const dbOk = await testConnection();
    console.log(
      `[template-retail-api] listening on http://127.0.0.1:${env.port} (CORS ${env.corsOrigin}) db=${dbOk ? "ok" : "off"}`
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
