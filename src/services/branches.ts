import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { query, withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import { nextId } from "../lib/ids.js";
import type { Branch } from "../types.js";

type BranchRow = RowDataPacket & {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string;
  activa: number;
  es_default: number;
};

function mapBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    direccion: row.direccion ?? "",
    activa: Boolean(row.activa),
    esDefault: Boolean(row.es_default),
  };
}

export async function listBranches(onlyActive = false): Promise<Branch[]> {
  const rows = await query<BranchRow[]>(
    onlyActive
      ? `SELECT * FROM branches WHERE activa = 1 ORDER BY es_default DESC, nombre ASC`
      : `SELECT * FROM branches ORDER BY es_default DESC, nombre ASC`
  );
  return rows.map(mapBranch);
}

export async function getDefaultBranchId(): Promise<string> {
  const rows = await query<BranchRow[]>(
    `SELECT * FROM branches WHERE es_default = 1 AND activa = 1 LIMIT 1`
  );
  if (rows[0]) return rows[0].id;
  const any = await query<BranchRow[]>(
    `SELECT * FROM branches WHERE activa = 1 ORDER BY nombre ASC LIMIT 1`
  );
  if (!any[0]) throw new HttpError(500, "No hay sucursales configuradas.");
  return any[0].id;
}

export async function upsertBranch(input: {
  id?: string;
  codigo: string;
  nombre: string;
  direccion?: string;
  activa?: boolean;
  esDefault?: boolean;
}): Promise<Branch> {
  const codigo = input.codigo.trim().toLowerCase().replace(/\s+/g, "-");
  const nombre = input.nombre.trim();
  if (!codigo || !nombre) {
    throw new HttpError(400, "Código y nombre son obligatorios.");
  }
  const id = input.id ?? nextId("br");

  await withTransaction(async (conn) => {
    if (input.esDefault) {
      await conn.execute(`UPDATE branches SET es_default = 0`);
    }

    if (input.id) {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE branches
         SET codigo = ?, nombre = ?, direccion = ?, activa = ?,
             es_default = COALESCE(?, es_default)
         WHERE id = ?`,
        [
          codigo,
          nombre,
          input.direccion?.trim() ?? "",
          input.activa === false ? 0 : 1,
          input.esDefault === undefined ? null : input.esDefault ? 1 : 0,
          id,
        ]
      );
      if (result.affectedRows === 0) {
        throw new HttpError(404, "Sucursal no encontrada.");
      }
    } else {
      await conn.execute(
        `INSERT INTO branches (id, codigo, nombre, direccion, activa, es_default)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          codigo,
          nombre,
          input.direccion?.trim() ?? "",
          input.activa === false ? 0 : 1,
          input.esDefault ? 1 : 0,
        ]
      );
    }
  });

  const rows = await query<BranchRow[]>(
    `SELECT * FROM branches WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!rows[0]) throw new HttpError(500, "No se pudo guardar la sucursal.");
  return mapBranch(rows[0]);
}

export async function setDefaultBranch(id: string): Promise<Branch> {
  await withTransaction(async (conn) => {
    const [found] = await conn.execute<BranchRow[]>(
      `SELECT * FROM branches WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!found[0]) throw new HttpError(404, "Sucursal no encontrada.");
    await conn.execute(`UPDATE branches SET es_default = 0`);
    await conn.execute(
      `UPDATE branches SET es_default = 1, activa = 1 WHERE id = ?`,
      [id]
    );
  });
  const rows = await query<BranchRow[]>(
    `SELECT * FROM branches WHERE id = ? LIMIT 1`,
    [id]
  );
  return mapBranch(rows[0]!);
}

export async function getProductStockByBranch(
  productId: string
): Promise<Record<string, number>> {
  const rows = await query<
    (RowDataPacket & { branch_id: string; stock: number })[]
  >(
    `SELECT branch_id, stock FROM product_branch_stock WHERE product_id = ?`,
    [productId]
  );
  const out: Record<string, number> = {};
  for (const row of rows) out[row.branch_id] = row.stock;
  return out;
}

export async function setProductBranchStock(
  productId: string,
  stocks: Record<string, number>
): Promise<void> {
  await withTransaction(async (conn) => {
    let total = 0;
    for (const [branchId, stock] of Object.entries(stocks)) {
      const qty = Math.max(0, Math.floor(Number(stock) || 0));
      total += qty;
      await conn.execute(
        `INSERT INTO product_branch_stock (product_id, branch_id, stock)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE stock = VALUES(stock)`,
        [productId, branchId, qty]
      );
    }
    await conn.execute(`UPDATE products SET stock = ? WHERE id = ?`, [
      total,
      productId,
    ]);
  });
}

export async function resolveChannelStock(
  productId: string,
  mode: "total" | "default_branch" | "branch",
  branchId: string | null
): Promise<number> {
  if (mode === "total") {
    const rows = await query<(RowDataPacket & { stock: number })[]>(
      `SELECT stock FROM products WHERE id = ? LIMIT 1`,
      [productId]
    );
    return rows[0]?.stock ?? 0;
  }
  const target =
    mode === "default_branch" ? await getDefaultBranchId() : branchId;
  if (!target) return 0;
  const rows = await query<(RowDataPacket & { stock: number })[]>(
    `SELECT stock FROM product_branch_stock
     WHERE product_id = ? AND branch_id = ? LIMIT 1`,
    [productId, target]
  );
  return rows[0]?.stock ?? 0;
}
