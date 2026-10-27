export type ProductCategory =
  | "bebidas"
  | "alimentos"
  | "limpieza"
  | "otros";

export type PriceList = {
  id: string;
  nombre: string;
  codigo: string;
  activa: boolean;
  esDefault: boolean;
};

export type Product = {
  id: string;
  sku: string;
  nombre: string;
  categoria: ProductCategory;
  precio: number;
  precios: Record<string, number>;
  costo: number;
  stock: number;
  activo: boolean;
  descripcion: string;
};

export type PaymentMethod = "efectivo" | "transferencia";

export type Client = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  rfc: string;
  notas: string;
  priceListId: string | null;
};

export type OrderStatus =
  | "borrador"
  | "confirmado"
  | "preparando"
  | "entregado"
  | "cancelado";

export type OrderCanal = "pos" | "pedido" | "mayorista";

export type OrderLine = {
  productId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
};

export type Order = {
  id: string;
  folio: string;
  clientId: string | null;
  clienteNombre: string;
  status: OrderStatus;
  lines: OrderLine[];
  createdAt: string;
  canal: OrderCanal;
  priceListId: string | null;
  conEnvio: boolean;
  envioCosto: number;
  direccionEnvio: string | null;
  telefonoContacto: string | null;
  metodoPago: PaymentMethod | null;
};

export const PRICE_LIST_MINORISTA = "pl_minorista";
export const PRICE_LIST_MAYORISTA = "pl_mayorista";

export function productPrice(
  product: Product,
  priceListId: string | null | undefined
): number {
  if (priceListId && product.precios[priceListId] != null) {
    return product.precios[priceListId];
  }
  return product.precio;
}

export function orderSubtotal(order: Pick<Order, "lines">): number {
  return order.lines.reduce(
    (acc, l) => acc + l.cantidad * l.precioUnitario,
    0
  );
}

export function orderTotal(
  order: Pick<Order, "lines" | "conEnvio" | "envioCosto">
): number {
  return orderSubtotal(order) + (order.conEnvio ? order.envioCosto : 0);
}
