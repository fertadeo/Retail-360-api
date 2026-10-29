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
  comercioId?: string | null;
};

export type Channel = "woocommerce" | "mercadolibre";

export type StockMode = "total" | "default_branch" | "branch";

export type StockShareMode = "shared" | "rotate";

export type Comercio = {
  id: string;
  codigo: string;
  nombre: string;
  rubro: string;
  direccion: string;
  activa: boolean;
  esDefault: boolean;
};

export type StockShareGroup = {
  id: string;
  nombre: string;
  modo: StockShareMode;
  activa: boolean;
  comercioIds: string[];
};

export type Branch = {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string;
  activa: boolean;
  esDefault: boolean;
  comercioId?: string | null;
};

export type ChannelLink = {
  productId: string;
  channel: Channel;
  externalId: string;
  externalSku: string;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type ChannelConfigPublic = {
  channel: Channel;
  enabled: boolean;
  storeUrl: string | null;
  consumerKey: string | null;
  consumerSecretSet: boolean;
  consumerSecretMasked: string | null;
  accessTokenSet: boolean;
  accessTokenMasked: string | null;
  sellerId: string | null;
  siteId: string;
  priceListId: string | null;
  stockMode: StockMode;
  stockBranchId: string | null;
  lastSyncAt: string | null;
  configured: boolean;
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
  /** Stock por sucursal (branchId → qty). */
  stockByBranch?: Record<string, number>;
  activo: boolean;
  descripcion: string;
  comercioId?: string | null;
  stockShared?: boolean;
  channelLinks?: ChannelLink[];
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
  comercioId?: string | null;
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
  comercioId?: string | null;
};

export type DiscountBasis = "amount" | "qty";
export type DiscountMode = "none" | "rule" | "manual";

export type DiscountTier = {
  /** Umbral (subtotal $ o cantidad total según basis). */
  desde: number;
  /** % de descuento al alcanzar el umbral. */
  porcentaje: number;
};

export type DiscountRule = {
  id: string;
  comercioId?: string | null;
  nombre: string;
  descripcion: string;
  basis: DiscountBasis;
  priceListId: string | null;
  activa: boolean;
  tiers: DiscountTier[];
};

export type QuoteStatus =
  | "borrador"
  | "enviado"
  | "aceptado"
  | "rechazado"
  | "vencido"
  | "convertido";

export type QuoteLine = {
  productId: string | null;
  sku: string;
  nombre: string;
  cantidad: number;
  precioLista: number;
  precioUnitario: number;
  lineDescuentoPct: number;
  importe: number;
};

export type Quote = {
  id: string;
  comercioId?: string | null;
  folio: string;
  clientId: string | null;
  clienteNombre: string;
  clienteEmail: string;
  clienteTelefono: string;
  priceListId: string | null;
  discountRuleId: string | null;
  discountMode: DiscountMode;
  discountBasis: DiscountBasis;
  tiers: DiscountTier[];
  descuentoManualPct: number;
  status: QuoteStatus;
  validezDias: number;
  validezHasta: string | null;
  notas: string;
  subtotal: number;
  descuentoMonto: number;
  descuentoPctAplicado: number;
  total: number;
  lines: QuoteLine[];
  createdAt: string;
  updatedAt: string;
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
