import type { RowDataPacket } from "mysql2/promise";
import { execute, query } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import { nextId } from "../lib/ids.js";
import { getDefaultComercioId } from "./comercios.js";

export type MediaKind = "image" | "attachment";

export type MediaAsset = {
  id: string;
  kind: MediaKind;
  source: "product_image" | "product_attachment" | "library";
  sourceLabel: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  dataUrl: string | null;
  uploadedAt: string;
  title: string;
  subtitle: string;
  entityHref: string;
  productId: string | null;
  comercioId: string | null;
};

export type MediaLibraryCounts = {
  images: number;
  attachments: number;
  total: number;
};

type MediaRow = RowDataPacket & {
  id: string;
  comercio_id: string | null;
  product_id: string | null;
  kind: MediaKind;
  filename: string;
  mime: string;
  size_bytes: number;
  data_url: string | null;
  title: string;
  uploaded_at: string | Date;
  product_nombre: string | null;
  product_sku: string | null;
};

function dateStr(v: string | Date): string {
  if (typeof v === "string") return v.slice(0, 10);
  return v.toISOString().slice(0, 10);
}

function kindFromMime(mime: string, forced?: MediaKind): MediaKind {
  if (forced) return forced;
  return mime.trim().toLowerCase().startsWith("image/")
    ? "image"
    : "attachment";
}

function mapRow(row: MediaRow): MediaAsset {
  const kind = row.kind;
  const productName = row.product_nombre?.trim() || null;
  const sku = row.product_sku?.trim() || null;
  const source =
    kind === "image"
      ? productName
        ? "product_image"
        : "library"
      : productName
        ? "product_attachment"
        : "library";
  const sourceLabel =
    source === "product_image"
      ? "Imagen de producto"
      : source === "product_attachment"
        ? "Adjunto de producto"
        : kind === "image"
          ? "Imagen de biblioteca"
          : "Archivo de biblioteca";

  return {
    id: row.id,
    kind,
    source,
    sourceLabel,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: Number(row.size_bytes) || 0,
    dataUrl: row.data_url,
    uploadedAt: dateStr(row.uploaded_at),
    title: row.title?.trim() || productName || row.filename,
    subtitle: [sku ? `SKU ${sku}` : "", productName || ""]
      .filter(Boolean)
      .join(" · "),
    entityHref: row.product_id ? "/productos" : "/biblioteca",
    productId: row.product_id,
    comercioId: row.comercio_id,
  };
}

export async function listMedia(opts?: {
  comercioId?: string;
  kind?: MediaKind | "all";
  q?: string;
}): Promise<{ items: MediaAsset[]; counts: MediaLibraryCounts }> {
  const comercioId =
    opts?.comercioId || (await getDefaultComercioId());
  const rows = await query<MediaRow[]>(
    `SELECT m.*, p.nombre AS product_nombre, p.sku AS product_sku
     FROM media_assets m
     LEFT JOIN products p ON p.id = m.product_id
     WHERE (m.comercio_id = ? OR m.comercio_id IS NULL)
     ORDER BY m.uploaded_at DESC, m.filename ASC`,
    [comercioId]
  );

  let items = rows.map(mapRow);
  const counts: MediaLibraryCounts = {
    images: items.filter((i) => i.kind === "image").length,
    attachments: items.filter((i) => i.kind === "attachment").length,
    total: items.length,
  };

  const kind = opts?.kind ?? "all";
  if (kind !== "all") {
    items = items.filter((i) => i.kind === kind);
  }
  const q = (opts?.q ?? "").trim().toLowerCase();
  if (q) {
    items = items.filter((i) =>
      [i.filename, i.title, i.subtitle, i.sourceLabel, i.mime]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  return { items, counts };
}

export async function createMedia(input: {
  comercioId?: string;
  productId?: string | null;
  kind?: MediaKind;
  filename: string;
  mime: string;
  sizeBytes: number;
  dataUrl: string | null;
  title?: string;
}): Promise<MediaAsset> {
  const filename = input.filename?.trim();
  if (!filename) throw new HttpError(400, "El nombre de archivo es obligatorio.");
  const mime = input.mime?.trim() || "application/octet-stream";
  const kind = kindFromMime(mime, input.kind);
  const comercioId =
    input.comercioId || (await getDefaultComercioId());
  const id = nextId("media");
  const uploadedAt = new Date().toISOString().slice(0, 10);
  const title = input.title?.trim() || filename;
  const productId = input.productId?.trim() || null;

  if (productId) {
    const exists = await query<RowDataPacket[]>(
      `SELECT id FROM products WHERE id = ? LIMIT 1`,
      [productId]
    );
    if (!exists[0]) throw new HttpError(400, "Producto no encontrado.");
  }

  await execute(
    `INSERT INTO media_assets (
      id, comercio_id, product_id, kind, filename, mime, size_bytes,
      data_url, title, uploaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      comercioId,
      productId,
      kind,
      filename,
      mime,
      Math.max(0, Number(input.sizeBytes) || 0),
      input.dataUrl ?? null,
      title,
      uploadedAt,
    ]
  );

  const listed = await listMedia({ comercioId, kind: "all" });
  const created = listed.items.find((i) => i.id === id);
  if (!created) throw new HttpError(500, "No se pudo crear el medio.");
  return created;
}

export async function deleteMedia(id: string): Promise<void> {
  const result = await execute(`DELETE FROM media_assets WHERE id = ?`, [id]);
  if (result.affectedRows === 0) {
    throw new HttpError(404, "Medio no encontrado.");
  }
}
