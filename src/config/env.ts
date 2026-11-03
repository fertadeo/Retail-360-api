import "dotenv/config";

function bool(v: string | undefined): boolean {
  if (!v) return false;
  const t = v.trim().toLowerCase();
  return t === "1" || t === "true" || t === "yes" || t === "on";
}

export const env = {
  port: Number(process.env.PORT ?? 3852),
  nodeEnv: process.env.NODE_ENV ?? "development",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://127.0.0.1:3851",
  dbHost: process.env.DB_HOST?.trim() || "",
  dbPort: Number(process.env.DB_PORT ?? 3306),
  dbUser: process.env.DB_USER?.trim() || "",
  dbPassword: process.env.DB_PASSWORD ?? "",
  dbName: process.env.DB_NAME?.trim() || "aurix_retail_dev",
  dbPoolSize: Number(process.env.DB_POOL_SIZE ?? 5),
  get dbEnabled(): boolean {
    return Boolean(this.dbHost && this.dbUser && this.dbName);
  },
  /** FenecWebP — conversión remota de imágenes (inyectado por Fenec Admin). */
  fenecwebpEnabled: bool(process.env.FENECWEBP_ENABLED),
  fenecwebpBaseUrl:
    process.env.FENECWEBP_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://webp.fenecstudio.com",
  fenecwebpApiKey: process.env.FENECWEBP_API_KEY?.trim() || "",

  /** Presencia → Fenec Admin (inyectado al provisionar). */
  fenecPresenceEnabled: bool(process.env.FENEC_PRESENCE_ENABLED),
  fenecPresenceIngestUrl:
    process.env.FENEC_PRESENCE_INGEST_URL?.trim() || "",
  fenecPresenceSecret: process.env.FENEC_PRESENCE_SECRET?.trim() || "",
  fenecInstanceSlug: process.env.FENEC_INSTANCE_SLUG?.trim() || "",
};
