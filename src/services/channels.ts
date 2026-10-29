import type { RowDataPacket } from "mysql2/promise";
import { execute, query } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import type {
  Channel,
  ChannelConfigPublic,
  ChannelLink,
  Product,
  StockMode,
} from "../types.js";
import { resolveChannelStock } from "./branches.js";
import { getDefaultPriceListId } from "./price-lists.js";

/** Evita import circular con products.ts */
async function loadProductForPush(productId: string): Promise<Product | null> {
  const { getProduct } = await import("./products.js");
  return getProduct(productId);
}

type ConfigRow = RowDataPacket & {
  channel: Channel;
  enabled: number;
  store_url: string | null;
  consumer_key: string | null;
  consumer_secret: string | null;
  access_token: string | null;
  refresh_token: string | null;
  seller_id: string | null;
  site_id: string | null;
  price_list_id: string | null;
  stock_mode: StockMode;
  stock_branch_id: string | null;
  last_sync_at: Date | string | null;
};

type LinkRow = RowDataPacket & {
  product_id: string;
  channel: Channel;
  external_id: string;
  external_sku: string;
  sync_enabled: number;
  last_synced_at: Date | string | null;
  last_error: string | null;
};

function iso(v: Date | string | null): string | null {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return "****";
  return `${"*".repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
}

function mapConfigPublic(row: ConfigRow): ChannelConfigPublic {
  return {
    channel: row.channel,
    enabled: Boolean(row.enabled),
    storeUrl: row.store_url,
    consumerKey: row.consumer_key,
    consumerSecretSet: Boolean(row.consumer_secret),
    consumerSecretMasked: maskSecret(row.consumer_secret),
    accessTokenSet: Boolean(row.access_token),
    accessTokenMasked: maskSecret(row.access_token),
    sellerId: row.seller_id,
    siteId: row.site_id ?? "MLA",
    priceListId: row.price_list_id,
    stockMode: row.stock_mode,
    stockBranchId: row.stock_branch_id,
    lastSyncAt: iso(row.last_sync_at),
    configured:
      row.channel === "woocommerce"
        ? Boolean(row.store_url && row.consumer_key && row.consumer_secret)
        : Boolean(row.access_token),
  };
}

function mapLink(row: LinkRow): ChannelLink {
  return {
    productId: row.product_id,
    channel: row.channel,
    externalId: row.external_id,
    externalSku: row.external_sku ?? "",
    syncEnabled: Boolean(row.sync_enabled),
    lastSyncedAt: iso(row.last_synced_at),
    lastError: row.last_error,
  };
}

async function getConfigRow(channel: Channel): Promise<ConfigRow | null> {
  const rows = await query<ConfigRow[]>(
    `SELECT * FROM channel_configs WHERE channel = ? LIMIT 1`,
    [channel]
  );
  return rows[0] ?? null;
}

export async function getChannelConfig(
  channel: Channel
): Promise<ChannelConfigPublic> {
  const row = await getConfigRow(channel);
  if (!row) {
    return {
      channel,
      enabled: false,
      storeUrl: null,
      consumerKey: null,
      consumerSecretSet: false,
      consumerSecretMasked: null,
      accessTokenSet: false,
      accessTokenMasked: null,
      sellerId: null,
      siteId: "MLA",
      priceListId: null,
      stockMode: "total",
      stockBranchId: null,
      lastSyncAt: null,
      configured: false,
    };
  }
  return mapConfigPublic(row);
}

export async function listChannelConfigs(): Promise<ChannelConfigPublic[]> {
  return Promise.all([
    getChannelConfig("woocommerce"),
    getChannelConfig("mercadolibre"),
  ]);
}

export async function saveChannelConfig(
  channel: Channel,
  input: {
    enabled?: boolean;
    storeUrl?: string | null;
    consumerKey?: string | null;
    consumerSecret?: string | null;
    accessToken?: string | null;
    refreshToken?: string | null;
    sellerId?: string | null;
    siteId?: string | null;
    priceListId?: string | null;
    stockMode?: StockMode;
    stockBranchId?: string | null;
  }
): Promise<ChannelConfigPublic> {
  const prev = await getConfigRow(channel);
  await query(
    `INSERT INTO channel_configs (
       channel, enabled, store_url, consumer_key, consumer_secret,
       access_token, refresh_token, seller_id, site_id,
       price_list_id, stock_mode, stock_branch_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       enabled = VALUES(enabled),
       store_url = VALUES(store_url),
       consumer_key = VALUES(consumer_key),
       consumer_secret = COALESCE(VALUES(consumer_secret), consumer_secret),
       access_token = COALESCE(VALUES(access_token), access_token),
       refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
       seller_id = VALUES(seller_id),
       site_id = VALUES(site_id),
       price_list_id = VALUES(price_list_id),
       stock_mode = VALUES(stock_mode),
       stock_branch_id = VALUES(stock_branch_id)`,
    [
      channel,
      input.enabled === undefined
        ? prev?.enabled ?? 0
        : input.enabled
          ? 1
          : 0,
      input.storeUrl !== undefined
        ? input.storeUrl?.replace(/\/$/, "") || null
        : prev?.store_url ?? null,
      input.consumerKey !== undefined
        ? input.consumerKey || null
        : prev?.consumer_key ?? null,
      input.consumerSecret !== undefined && input.consumerSecret !== ""
        ? input.consumerSecret
        : null,
      input.accessToken !== undefined && input.accessToken !== ""
        ? input.accessToken
        : null,
      input.refreshToken !== undefined && input.refreshToken !== ""
        ? input.refreshToken
        : null,
      input.sellerId !== undefined
        ? input.sellerId || null
        : prev?.seller_id ?? null,
      input.siteId !== undefined
        ? input.siteId || "MLA"
        : prev?.site_id ?? "MLA",
      input.priceListId !== undefined
        ? input.priceListId || null
        : prev?.price_list_id ?? null,
      input.stockMode ?? prev?.stock_mode ?? "total",
      input.stockBranchId !== undefined
        ? input.stockBranchId || null
        : prev?.stock_branch_id ?? null,
    ]
  );
  return getChannelConfig(channel);
}

export async function listProductLinks(
  productId?: string
): Promise<ChannelLink[]> {
  const rows = productId
    ? await query<LinkRow[]>(
        `SELECT * FROM product_channel_links WHERE product_id = ?`,
        [productId]
      )
    : await query<LinkRow[]>(`SELECT * FROM product_channel_links`);
  return rows.map(mapLink);
}

export async function upsertProductLink(input: {
  productId: string;
  channel: Channel;
  externalId: string;
  externalSku?: string;
  syncEnabled?: boolean;
}): Promise<ChannelLink> {
  const exists = await query<(RowDataPacket & { id: string; sku: string })[]>(
    `SELECT id, sku FROM products WHERE id = ? LIMIT 1`,
    [input.productId]
  );
  if (!exists[0]) throw new HttpError(404, "Producto no encontrado.");
  const externalId = input.externalId.trim();
  if (!externalId) throw new HttpError(400, "externalId es obligatorio.");

  await query(
    `INSERT INTO product_channel_links
       (product_id, channel, external_id, external_sku, sync_enabled, last_error)
     VALUES (?, ?, ?, ?, ?, NULL)
     ON DUPLICATE KEY UPDATE
       external_id = VALUES(external_id),
       external_sku = VALUES(external_sku),
       sync_enabled = VALUES(sync_enabled),
       last_error = NULL`,
    [
      input.productId,
      input.channel,
      externalId,
      input.externalSku?.trim() ?? exists[0].sku,
      input.syncEnabled === false ? 0 : 1,
    ]
  );
  const rows = await query<LinkRow[]>(
    `SELECT * FROM product_channel_links WHERE product_id = ? AND channel = ?`,
    [input.productId, input.channel]
  );
  return mapLink(rows[0]!);
}

export async function deleteProductLink(
  productId: string,
  channel: Channel
): Promise<void> {
  const result = await execute(
    `DELETE FROM product_channel_links WHERE product_id = ? AND channel = ?`,
    [productId, channel]
  );
  if (result.affectedRows === 0) {
    throw new HttpError(404, "Vínculo no encontrado.");
  }
}

async function touchLink(
  productId: string,
  channel: Channel,
  error: string | null
): Promise<void> {
  await query(
    `UPDATE product_channel_links
     SET last_synced_at = CASE WHEN ? IS NULL THEN CURRENT_TIMESTAMP(3) ELSE last_synced_at END,
         last_error = ?
     WHERE product_id = ? AND channel = ?`,
    [error, error, productId, channel]
  );
  if (!error) {
    await query(
      `UPDATE channel_configs SET last_sync_at = CURRENT_TIMESTAMP(3) WHERE channel = ?`,
      [channel]
    );
  }
}

async function resolvePushPrice(
  product: Product,
  priceListId: string | null
): Promise<number> {
  const listId = priceListId || (await getDefaultPriceListId());
  return product.precios[listId] ?? product.precio;
}

/* —— WooCommerce —— */

async function wooRequest<T>(
  cfg: ConfigRow,
  method: string,
  endpoint: string,
  body?: unknown
): Promise<T> {
  if (!cfg.store_url || !cfg.consumer_key || !cfg.consumer_secret) {
    throw new HttpError(400, "WooCommerce no está configurado.");
  }
  const url = `${cfg.store_url.replace(/\/$/, "")}/wp-json/wc/v3${endpoint}`;
  const auth = Buffer.from(
    `${cfg.consumer_key}:${cfg.consumer_secret}`,
    "utf8"
  ).toString("base64");
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new HttpError(502, `Respuesta inválida de WooCommerce: ${text.slice(0, 180)}`);
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : `HTTP ${res.status}`;
    throw new HttpError(502, `WooCommerce: ${msg}`);
  }
  return data as T;
}

export async function pushProductToWooCommerce(
  productId: string,
  mode: "stock" | "price" | "both" | "full" = "both"
): Promise<{ externalId: string; stock: number; price: number }> {
  const cfg = await getConfigRow("woocommerce");
  if (!cfg || !cfg.enabled) {
    throw new HttpError(400, "Canal WooCommerce deshabilitado.");
  }
  const product = await loadProductForPush(productId);
  if (!product) throw new HttpError(404, "Producto no encontrado.");

  const links = await query<LinkRow[]>(
    `SELECT * FROM product_channel_links
     WHERE product_id = ? AND channel = 'woocommerce' LIMIT 1`,
    [productId]
  );
  let link = links[0];
  const stock = await resolveChannelStock(
    productId,
    cfg.stock_mode,
    cfg.stock_branch_id
  );
  const price = await resolvePushPrice(product, cfg.price_list_id);

  const payload: Record<string, unknown> = {
    name: product.nombre,
    sku: product.sku,
    status: product.activo ? "publish" : "draft",
    type: "simple",
    description: product.descripcion || undefined,
  };
  if (mode === "stock" || mode === "both" || mode === "full") {
    payload.manage_stock = true;
    payload.stock_quantity = stock;
    payload.stock_status = stock > 0 ? "instock" : "outofstock";
  }
  if (mode === "price" || mode === "both" || mode === "full") {
    payload.regular_price = String(price);
  }

  try {
    let externalId = link?.external_id;
    if (externalId) {
      await wooRequest(cfg, "PUT", `/products/${externalId}`, payload);
    } else {
      const created = await wooRequest<{ id: number }>(
        cfg,
        "POST",
        "/products",
        payload
      );
      externalId = String(created.id);
      link = {
        product_id: productId,
        channel: "woocommerce",
        external_id: externalId,
        external_sku: product.sku,
        sync_enabled: 1,
        last_synced_at: null,
        last_error: null,
      } as LinkRow;
      await upsertProductLink({
        productId,
        channel: "woocommerce",
        externalId,
        externalSku: product.sku,
      });
    }
    await touchLink(productId, "woocommerce", null);
    return { externalId: externalId!, stock, price };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de sync";
    await touchLink(productId, "woocommerce", msg.slice(0, 500));
    throw err;
  }
}

export async function linkWooCommerceBySku(): Promise<{
  linked: number;
  skipped: number;
}> {
  const cfg = await getConfigRow("woocommerce");
  if (!cfg || !cfg.enabled) {
    throw new HttpError(400, "Canal WooCommerce deshabilitado.");
  }
  const remote = await wooRequest<
    Array<{ id: number; sku: string }>
  >(cfg, "GET", "/products?per_page=100&page=1&context=edit");

  const products = await query<(RowDataPacket & { id: string; sku: string })[]>(
    `SELECT id, sku FROM products`
  );
  const bySku = new Map(products.map((p) => [p.sku.toUpperCase(), p.id]));
  let linked = 0;
  let skipped = 0;

  for (const item of remote) {
    const sku = String(item.sku ?? "").trim().toUpperCase();
    if (!sku) {
      skipped += 1;
      continue;
    }
    const productId = bySku.get(sku);
    if (!productId) {
      skipped += 1;
      continue;
    }
    await upsertProductLink({
      productId,
      channel: "woocommerce",
      externalId: String(item.id),
      externalSku: sku,
    });
    linked += 1;
  }
  return { linked, skipped };
}

export async function pushAllWooCommerce(
  mode: "stock" | "price" | "both" | "full" = "both"
): Promise<Array<{ productId: string; ok: boolean; error?: string }>> {
  const links = await query<LinkRow[]>(
    `SELECT * FROM product_channel_links
     WHERE channel = 'woocommerce' AND sync_enabled = 1`
  );
  const results: Array<{ productId: string; ok: boolean; error?: string }> = [];
  for (const link of links) {
    try {
      await pushProductToWooCommerce(link.product_id, mode);
      results.push({ productId: link.product_id, ok: true });
    } catch (err) {
      results.push({
        productId: link.product_id,
        ok: false,
        error: err instanceof Error ? err.message : "Error",
      });
    }
  }
  return results;
}

/* —— Mercado Libre —— */

async function meliRequest<T>(
  cfg: ConfigRow,
  method: string,
  endpoint: string,
  body?: unknown
): Promise<T> {
  if (!cfg.access_token) {
    throw new HttpError(400, "Mercado Libre no está configurado (access token).");
  }
  const url = endpoint.startsWith("http")
    ? endpoint
    : `https://api.mercadolibre.com${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new HttpError(502, `Respuesta inválida de ML: ${text.slice(0, 180)}`);
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : `HTTP ${res.status}`;
    throw new HttpError(502, `Mercado Libre: ${msg}`);
  }
  return data as T;
}

export async function pushProductToMercadoLibre(
  productId: string,
  mode: "stock" | "price" | "both" = "both"
): Promise<{ externalId: string; stock: number; price: number }> {
  const cfg = await getConfigRow("mercadolibre");
  if (!cfg || !cfg.enabled) {
    throw new HttpError(400, "Canal Mercado Libre deshabilitado.");
  }
  const product = await loadProductForPush(productId);
  if (!product) throw new HttpError(404, "Producto no encontrado.");

  const links = await query<LinkRow[]>(
    `SELECT * FROM product_channel_links
     WHERE product_id = ? AND channel = 'mercadolibre' LIMIT 1`,
    [productId]
  );
  const link = links[0];
  if (!link?.external_id) {
    throw new HttpError(
      400,
      "Producto sin ítem de Mercado Libre vinculado. Pegá el MLA… en el vínculo."
    );
  }

  const stock = await resolveChannelStock(
    productId,
    cfg.stock_mode,
    cfg.stock_branch_id
  );
  const price = await resolvePushPrice(product, cfg.price_list_id);
  const patch: Record<string, unknown> = {};
  if (mode === "stock" || mode === "both") {
    patch.available_quantity = Math.max(0, Math.floor(stock));
  }
  if (mode === "price" || mode === "both") {
    patch.price = price;
  }

  try {
    await meliRequest(cfg, "PUT", `/items/${link.external_id}`, patch);
    await touchLink(productId, "mercadolibre", null);
    return { externalId: link.external_id, stock, price };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de sync";
    await touchLink(productId, "mercadolibre", msg.slice(0, 500));
    throw err;
  }
}

export async function pushAllMercadoLibre(
  mode: "stock" | "price" | "both" = "both"
): Promise<Array<{ productId: string; ok: boolean; error?: string }>> {
  const links = await query<LinkRow[]>(
    `SELECT * FROM product_channel_links
     WHERE channel = 'mercadolibre' AND sync_enabled = 1`
  );
  const results: Array<{ productId: string; ok: boolean; error?: string }> = [];
  for (const link of links) {
    try {
      await pushProductToMercadoLibre(link.product_id, mode);
      results.push({ productId: link.product_id, ok: true });
    } catch (err) {
      results.push({
        productId: link.product_id,
        ok: false,
        error: err instanceof Error ? err.message : "Error",
      });
    }
  }
  return results;
}

export async function enrichProductsWithLinks(
  products: Product[]
): Promise<Product[]> {
  if (!products.length) return products;
  const ids = products.map((p) => p.id);
  const placeholders = ids.map(() => "?").join(",");
  const rows = await query<LinkRow[]>(
    `SELECT * FROM product_channel_links WHERE product_id IN (${placeholders})`,
    ids
  );
  const byProduct = new Map<string, ChannelLink[]>();
  for (const row of rows) {
    const bag = byProduct.get(row.product_id) ?? [];
    bag.push(mapLink(row));
    byProduct.set(row.product_id, bag);
  }
  return products.map((p) => ({
    ...p,
    channelLinks: byProduct.get(p.id) ?? [],
  }));
}
