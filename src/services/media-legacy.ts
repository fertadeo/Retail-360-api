import type { RowDataPacket } from "mysql2/promise";
import { execute, query } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import { nextId } from "../lib/ids.js";
import { getDefaultComercioId } from "./comercios.js";
import {
  convertToWebp,
  fenecwebpConvertConfigured,
} from "./fenecwebp.client.js";

const CONVERTIBLE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/webp",
  "image/avif",
]);

function isConvertibleImage(mime: string, filename: string): boolean {
  const m = (mime || "").toLowerCase().split(";")[0].trim();
  if (m === "image/svg+xml") return false;
  if (CONVERTIBLE_MIMES.has(m)) return true;
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff", "webp", "avif"].includes(
    ext
  );
}

function alreadyWebp(mime: string, filename: string): boolean {
  const m = (mime || "").toLowerCase().split(";")[0].trim();
  if (m === "image/webp") return true;
  return (filename.split(".").pop()?.toLowerCase() || "") === "webp";
}

function parseDataUrl(
  dataUrl: string
): { mime: string; buffer: Buffer } | null {
  const m = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  try {
    return {
      mime: (m[1] || "application/octet-stream").trim(),
      buffer: Buffer.from(m[2], "base64"),
    };
  } catch {
    return null;
  }
}

async function maybeConvertFields(input: {
  filename: string;
  mime: string;
  sizeBytes: number;
  dataUrl: string | null;
}): Promise<{
  filename: string;
  mime: string;
  sizeBytes: number;
  dataUrl: string | null;
}> {
  if (!fenecwebpConvertConfigured()) return input;
  if (!input.dataUrl || !isConvertibleImage(input.mime, input.filename)) {
    return input;
  }
  const parsed = parseDataUrl(input.dataUrl);
  if (!parsed || parsed.buffer.length === 0) return input;
  try {
    const result = await convertToWebp({
      buffer: parsed.buffer,
      filename: input.filename,
      mime: parsed.mime || input.mime,
    });
    return {
      filename: result.filename,
      mime: result.contentType,
      sizeBytes: result.buffer.length,
      dataUrl: `data:${result.contentType};base64,${result.buffer.toString("base64")}`,
    };
  } catch (err) {
    console.error(
      "[media] fenecwebp convert",
      err instanceof Error ? err.message : err
    );
    return input;
  }
}

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
  totalBytes: number;
  imagesBytes: number;
  attachmentsBytes: number;
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
  let imagesBytes = 0;
  let attachmentsBytes = 0;
  let images = 0;
  let attachments = 0;
  for (const item of items) {
    const bytes = Math.max(0, Number(item.sizeBytes) || 0);
    if (item.kind === "image") {
      images += 1;
      imagesBytes += bytes;
    } else {
      attachments += 1;
      attachmentsBytes += bytes;
    }
  }
  const counts: MediaLibraryCounts = {
    images,
    attachments,
    total: items.length,
    totalBytes: imagesBytes + attachmentsBytes,
    imagesBytes,
    attachmentsBytes,
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
  const rawFilename = input.filename?.trim();
  if (!rawFilename) throw new HttpError(400, "El nombre de archivo es obligatorio.");
  const converted = await maybeConvertFields({
    filename: rawFilename,
    mime: input.mime?.trim() || "application/octet-stream",
    sizeBytes: Math.max(0, Number(input.sizeBytes) || 0),
    dataUrl: input.dataUrl ?? null,
  });
  const filename = converted.filename;
  const mime = converted.mime;
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
      converted.sizeBytes,
      converted.dataUrl,
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

export type OptimizeMediaPreview = {
  id: string;
  title: string;
  productId: string | null;
  sourceLabel: string;
  before: {
    filename: string;
    mime: string;
    sizeBytes: number;
    dataUrl: string;
  };
  after: {
    filename: string;
    mime: string;
    sizeBytes: number;
    dataUrl: string;
  };
  savedBytes: number;
};

export type OptimizeMediaResult = {
  dryRun: boolean;
  converted: number;
  skipped: number;
  errors: number;
  details: Array<{
    id: string;
    status: "converted" | "skipped" | "error" | "preview";
    detail?: string;
    beforeFilename?: string;
    afterFilename?: string;
    productId?: string | null;
  }>;
  previews: OptimizeMediaPreview[];
};

function nextTitleAfterRename(
  title: string,
  oldFilename: string,
  newFilename: string
): string {
  const t = (title || "").trim();
  if (!t || t === oldFilename) return newFilename;
  return t;
}

/** Backfill: preview (dryRun) o aplica raster → WebP; renombra y actualiza el asset (y lo que ve el producto). */
export async function optimizeExistingMedia(opts?: {
  comercioId?: string;
  limit?: number;
  dryRun?: boolean;
  ids?: string[];
}): Promise<OptimizeMediaResult> {
  if (!fenecwebpConvertConfigured()) {
    throw new HttpError(
      400,
      "FenecWebP no está configurado (FENECWEBP_ENABLED + FENECWEBP_API_KEY)."
    );
  }
  const dryRun = Boolean(opts?.dryRun);
  const idFilter = new Set(
    (opts?.ids ?? []).map((id) => String(id).trim()).filter(Boolean)
  );
  const limit = Math.min(50, Math.max(1, Number(opts?.limit) || 20));
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

  const details: OptimizeMediaResult["details"] = [];
  const previews: OptimizeMediaPreview[] = [];
  let converted = 0;
  let skipped = 0;
  let errors = 0;
  let processed = 0;

  for (const row of rows) {
    if (idFilter.size > 0 && !idFilter.has(row.id)) continue;
    if (processed >= limit) break;
    const asset = mapRow(row);
    if (!asset.dataUrl || !isConvertibleImage(asset.mime, asset.filename)) {
      skipped += 1;
      details.push({ id: asset.id, status: "skipped", detail: "no convertible" });
      continue;
    }
    if (alreadyWebp(asset.mime, asset.filename)) {
      skipped += 1;
      details.push({ id: asset.id, status: "skipped", detail: "ya webp" });
      continue;
    }
    processed += 1;
    const next = await maybeConvertFields({
      filename: asset.filename,
      mime: asset.mime,
      sizeBytes: asset.sizeBytes,
      dataUrl: asset.dataUrl,
    });
    if (
      !next.dataUrl ||
      (next.mime === asset.mime &&
        next.filename === asset.filename &&
        next.sizeBytes === asset.sizeBytes)
    ) {
      errors += 1;
      details.push({
        id: asset.id,
        status: "error",
        detail: "convert falló o sin cambios",
      });
      continue;
    }

    const preview: OptimizeMediaPreview = {
      id: asset.id,
      title: asset.title,
      productId: asset.productId,
      sourceLabel: asset.sourceLabel,
      before: {
        filename: asset.filename,
        mime: asset.mime,
        sizeBytes: asset.sizeBytes,
        dataUrl: asset.dataUrl,
      },
      after: {
        filename: next.filename,
        mime: next.mime,
        sizeBytes: next.sizeBytes,
        dataUrl: next.dataUrl,
      },
      savedBytes: Math.max(0, asset.sizeBytes - next.sizeBytes),
    };
    previews.push(preview);

    if (dryRun) {
      details.push({
        id: asset.id,
        status: "preview",
        beforeFilename: asset.filename,
        afterFilename: next.filename,
        productId: asset.productId,
      });
      continue;
    }

    const newTitle = nextTitleAfterRename(
      row.title || asset.title,
      asset.filename,
      next.filename
    );
    await execute(
      `UPDATE media_assets
       SET filename = ?, mime = ?, size_bytes = ?, data_url = ?, title = ?
       WHERE id = ?`,
      [
        next.filename,
        next.mime,
        next.sizeBytes,
        next.dataUrl,
        newTitle,
        asset.id,
      ]
    );
    converted += 1;
    details.push({
      id: asset.id,
      status: "converted",
      beforeFilename: asset.filename,
      afterFilename: next.filename,
      productId: asset.productId,
    });
  }

  return {
    dryRun,
    converted: dryRun ? 0 : converted,
    skipped,
    errors,
    details,
    previews,
  };
}
