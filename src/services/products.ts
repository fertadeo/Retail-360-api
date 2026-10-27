import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { query, withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import { nextId } from "../lib/ids.js";
import type { Product, ProductCategory } from "../types.js";
import { getDefaultPriceListId } from "./price-lists.js";

type ProdRow = RowDataPacket & {
  id: string;
  sku: string;
  nombre: string;
  categoria: ProductCategory;
  precio_default: string | number;
  costo: string | number;
  stock: number;
  activo: number;
  descripcion: string;
};

type PriceRow = RowDataPacket & {
  product_id: string;
  price_list_id: string;
  precio: string | number;
};

function num(v: string | number): number {
  return typeof v === "number" ? v : Number(v);
}

async function loadPrecios(
  productIds: string[]
): Promise<Map<string, Record<string, number>>> {
  const map = new Map<string, Record<string, number>>();
  if (!productIds.length) return map;
  const placeholders = productIds.map(() => "?").join(",");
  const rows = await query<PriceRow[]>(
    `SELECT product_id, price_list_id, precio
     FROM product_prices WHERE product_id IN (${placeholders})`,
    productIds
  );
  for (const row of rows) {
    const bag = map.get(row.product_id) ?? {};
    bag[row.price_list_id] = num(row.precio);
    map.set(row.product_id, bag);
  }
  return map;
}

function mapProduct(
  row: ProdRow,
  precios: Record<string, number>
): Product {
  return {
    id: row.id,
    sku: row.sku,
    nombre: row.nombre,
    categoria: row.categoria,
    precio: num(row.precio_default),
    precios,
    costo: num(row.costo),
    stock: row.stock,
    activo: Boolean(row.activo),
    descripcion: row.descripcion,
  };
}

export async function listProducts(): Promise<Product[]> {
  const rows = await query<ProdRow[]>(
    `SELECT * FROM products ORDER BY nombre ASC`
  );
  const precios = await loadPrecios(rows.map((r) => r.id));
  return rows.map((r) => mapProduct(r, precios.get(r.id) ?? {}));
}

export async function getProduct(id: string): Promise<Product | null> {
  const rows = await query<ProdRow[]>(
    `SELECT * FROM products WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!rows[0]) return null;
  const precios = await loadPrecios([id]);
  return mapProduct(rows[0], precios.get(id) ?? {});
}

export async function upsertProduct(input: {
  id?: string;
  sku: string;
  nombre: string;
  categoria: ProductCategory;
  costo: number;
  stock: number;
  activo?: boolean;
  descripcion?: string;
  precios: Record<string, number>;
}): Promise<Product> {
  const sku = input.sku.trim().toUpperCase();
  const nombre = input.nombre.trim();
  if (!sku || !nombre) {
    throw new HttpError(400, "SKU y nombre son obligatorios.");
  }
  const defaultListId = await getDefaultPriceListId();
  const precioDefault =
    input.precios[defaultListId] ??
    Object.values(input.precios)[0] ??
    0;

  const id = input.id ?? nextId("p");

  await withTransaction(async (conn) => {
    if (input.id) {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE products
         SET sku = ?, nombre = ?, categoria = ?, precio_default = ?,
             costo = ?, stock = ?, activo = ?, descripcion = ?
         WHERE id = ?`,
        [
          sku,
          nombre,
          input.categoria,
          precioDefault,
          input.costo,
          input.stock,
          input.activo === false ? 0 : 1,
          input.descripcion?.trim() ?? "",
          id,
        ]
      );
      if (result.affectedRows === 0) {
        throw new HttpError(404, "Producto no encontrado.");
      }
      await conn.execute(`DELETE FROM product_prices WHERE product_id = ?`, [
        id,
      ]);
    } else {
      await conn.execute(
        `INSERT INTO products
         (id, sku, nombre, categoria, precio_default, costo, stock, activo, descripcion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          sku,
          nombre,
          input.categoria,
          precioDefault,
          input.costo,
          input.stock,
          input.activo === false ? 0 : 1,
          input.descripcion?.trim() ?? "",
        ]
      );
    }

    for (const [listId, precio] of Object.entries(input.precios)) {
      await conn.execute(
        `INSERT INTO product_prices (product_id, price_list_id, precio)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE precio = VALUES(precio)`,
        [id, listId, precio]
      );
    }
  });

  const product = await getProduct(id);
  if (!product) throw new HttpError(500, "No se pudo guardar el producto.");
  return product;
}
