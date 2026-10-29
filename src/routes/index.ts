import { Router } from "express";
import { z } from "zod";
import { readComercioId } from "../lib/comercio-req.js";
import { sendError } from "../lib/http.js";
import * as branchesSvc from "../services/branches.js";
import * as channelsSvc from "../services/channels.js";
import * as clientsSvc from "../services/clients.js";
import * as comerciosSvc from "../services/comercios.js";
import * as discountRulesSvc from "../services/discount-rules.js";
import * as mediaSvc from "../services/media.js";
import * as ordersSvc from "../services/orders.js";
import * as priceListsSvc from "../services/price-lists.js";
import * as productsSvc from "../services/products.js";
import * as quotesSvc from "../services/quotes.js";
import { testConnection } from "../db/pool.js";

export const apiRouter = Router();

apiRouter.get("/health", async (_req, res) => {
  const db = await testConnection();
  res.json({
    ok: true,
    service: "retail-360-api",
    db,
  });
});

apiRouter.get("/dashboard/stats", async (req, res) => {
  try {
    const day =
      typeof req.query.day === "string" ? req.query.day : undefined;
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    res.json(await ordersSvc.dashboardStats(day, comercioId));
  } catch (err) {
    sendError(res, err);
  }
});

/* —— Price lists —— */
apiRouter.get("/price-lists", async (req, res) => {
  try {
    const onlyActive = req.query.active === "1" || req.query.active === "true";
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    res.json(await priceListsSvc.listPriceLists(onlyActive, comercioId));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/price-lists", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    const body = z
      .object({
        nombre: z.string(),
        codigo: z.string().optional(),
        activa: z.boolean().optional(),
        esDefault: z.boolean().optional(),
      })
      .parse(req.body);
    res.status(201).json(
      await priceListsSvc.createPriceList({ ...body, comercioId })
    );
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.patch("/price-lists/:id", async (req, res) => {
  try {
    const body = z
      .object({
        nombre: z.string().optional(),
        codigo: z.string().optional(),
        activa: z.boolean().optional(),
        esDefault: z.boolean().optional(),
      })
      .parse(req.body);
    res.json(await priceListsSvc.updatePriceList(req.params.id, body));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/price-lists/:id/set-default", async (req, res) => {
  try {
    res.json(await priceListsSvc.setDefaultPriceList(req.params.id));
  } catch (err) {
    sendError(res, err);
  }
});

/* —— Products —— */
apiRouter.get("/products", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    res.json(await productsSvc.listProducts(comercioId));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.get("/products/:id", async (req, res) => {
  try {
    const product = await productsSvc.getProduct(req.params.id);
    if (!product) {
      res.status(404).json({ error: "Producto no encontrado." });
      return;
    }
    res.json(product);
  } catch (err) {
    sendError(res, err);
  }
});

const productBody = z.object({
  id: z.string().optional(),
  comercioId: z.string().optional(),
  sku: z.string(),
  nombre: z.string(),
  categoria: z.enum(["bebidas", "alimentos", "limpieza", "otros"]),
  costo: z.number(),
  stock: z.number(),
  stockByBranch: z.record(z.string(), z.number()).optional(),
  activo: z.boolean().optional(),
  descripcion: z.string().optional(),
  precios: z.record(z.string(), z.number()),
});

apiRouter.post("/products", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(
      readComercioId(req) ?? req.body?.comercioId
    );
    const body = productBody.parse({ ...req.body, comercioId });
    res.status(201).json(await productsSvc.upsertProduct(body));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.patch("/products/:id", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(
      readComercioId(req) ?? req.body?.comercioId
    );
    const body = productBody.parse({
      ...req.body,
      id: req.params.id,
      comercioId,
    });
    res.json(await productsSvc.upsertProduct(body));
  } catch (err) {
    sendError(res, err);
  }
});

/* —— Clients —— */
apiRouter.get("/clients", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    res.json(await clientsSvc.listClients(comercioId));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.get("/clients/:id", async (req, res) => {
  try {
    const client = await clientsSvc.getClient(req.params.id);
    if (!client) {
      res.status(404).json({ error: "Cliente no encontrado." });
      return;
    }
    res.json(client);
  } catch (err) {
    sendError(res, err);
  }
});

const clientBody = z.object({
  id: z.string().optional(),
  comercioId: z.string().optional(),
  nombre: z.string(),
  email: z.string().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  rfc: z.string().optional(),
  notas: z.string().optional(),
  priceListId: z.string().nullable().optional(),
});

apiRouter.post("/clients", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(
      readComercioId(req) ?? req.body?.comercioId
    );
    const body = clientBody.parse({ ...req.body, comercioId });
    res.status(201).json(await clientsSvc.upsertClient(body));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.patch("/clients/:id", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(
      readComercioId(req) ?? req.body?.comercioId
    );
    const body = clientBody.parse({
      ...req.body,
      id: req.params.id,
      comercioId,
    });
    res.json(await clientsSvc.upsertClient(body));
  } catch (err) {
    sendError(res, err);
  }
});

/* —— Orders —— */
apiRouter.get("/orders", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    const canal = z
      .enum(["pos", "pedido", "mayorista"])
      .optional()
      .parse(
        typeof req.query.canal === "string" ? req.query.canal : undefined
      );
    res.json(await ordersSvc.listOrders(canal, comercioId));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.get("/orders/:id", async (req, res) => {
  try {
    const order = await ordersSvc.getOrder(req.params.id);
    if (!order) {
      res.status(404).json({ error: "Pedido no encontrado." });
      return;
    }
    res.json(order);
  } catch (err) {
    sendError(res, err);
  }
});

const lineSchema = z.object({
  productId: z.string(),
  nombre: z.string().optional().default(""),
  cantidad: z.number(),
  precioUnitario: z.number().optional().default(0),
});

apiRouter.post("/orders", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    const body = z
      .object({
        clientId: z.string(),
        lines: z.array(lineSchema).min(1),
      })
      .parse(req.body);
    res.status(201).json(
      await ordersSvc.createPedido({ ...body, comercioId })
    );
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/pos/checkout", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    const body = z
      .object({
        lines: z.array(lineSchema).min(1),
        clientId: z.string().nullable().optional(),
        priceListId: z.string().nullable().optional(),
        conEnvio: z.boolean().optional(),
        envioCosto: z.number().optional(),
        direccionEnvio: z.string().optional(),
        telefonoContacto: z.string().optional(),
        metodoPago: z.enum(["efectivo", "transferencia"]),
      })
      .parse(req.body);
    res.status(201).json(
      await ordersSvc.createPosSale({ ...body, comercioId })
    );
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/wholesale/orders", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    const body = z
      .object({
        clientId: z.string(),
        lines: z.array(lineSchema).min(1),
      })
      .parse(req.body);
    res.status(201).json(
      await ordersSvc.createMayoristaPedido({ ...body, comercioId })
    );
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.get("/wholesale/orders", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    res.json(await ordersSvc.listOrders("mayorista", comercioId));
  } catch (err) {
    sendError(res, err);
  }
});

/* —— Comercios + stock share / rotación —— */
apiRouter.get("/comercios", async (req, res) => {
  try {
    const onlyActive = req.query.active === "1" || req.query.active === "true";
    res.json(await comerciosSvc.listComercios(onlyActive));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/comercios", async (req, res) => {
  try {
    const body = z
      .object({
        codigo: z.string(),
        nombre: z.string(),
        rubro: z.string().optional(),
        direccion: z.string().optional(),
        activa: z.boolean().optional(),
        esDefault: z.boolean().optional(),
      })
      .parse(req.body);
    res.status(201).json(await comerciosSvc.upsertComercio(body));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.patch("/comercios/:id", async (req, res) => {
  try {
    const body = z
      .object({
        codigo: z.string(),
        nombre: z.string(),
        rubro: z.string().optional(),
        direccion: z.string().optional(),
        activa: z.boolean().optional(),
        esDefault: z.boolean().optional(),
      })
      .parse(req.body);
    res.json(
      await comerciosSvc.upsertComercio({ ...body, id: req.params.id })
    );
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/comercios/:id/set-default", async (req, res) => {
  try {
    res.json(await comerciosSvc.setDefaultComercio(req.params.id));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.get("/stock-share-groups", async (_req, res) => {
  try {
    res.json(await comerciosSvc.listStockShareGroups());
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/stock-share-groups", async (req, res) => {
  try {
    const body = z
      .object({
        nombre: z.string(),
        modo: z.enum(["shared", "rotate"]),
        activa: z.boolean().optional(),
        comercioIds: z.array(z.string()).min(1),
      })
      .parse(req.body);
    res.status(201).json(await comerciosSvc.upsertStockShareGroup(body));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.patch("/stock-share-groups/:id", async (req, res) => {
  try {
    const body = z
      .object({
        nombre: z.string(),
        modo: z.enum(["shared", "rotate"]),
        activa: z.boolean().optional(),
        comercioIds: z.array(z.string()).min(1),
      })
      .parse(req.body);
    res.json(
      await comerciosSvc.upsertStockShareGroup({
        ...body,
        id: req.params.id,
      })
    );
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.delete("/stock-share-groups/:id", async (req, res) => {
  try {
    await comerciosSvc.deleteStockShareGroup(req.params.id);
    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/stock/transfer", async (req, res) => {
  try {
    const body = z
      .object({
        fromComercioId: z.string(),
        toComercioId: z.string(),
        sku: z.string(),
        quantity: z.number(),
      })
      .parse(req.body);
    res.json(await comerciosSvc.transferStock(body));
  } catch (err) {
    sendError(res, err);
  }
});

/* —— Branches (sucursales) —— */
apiRouter.get("/branches", async (req, res) => {
  try {
    const onlyActive = req.query.active === "1" || req.query.active === "true";
    res.json(await branchesSvc.listBranches(onlyActive));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/branches", async (req, res) => {
  try {
    const body = z
      .object({
        codigo: z.string(),
        nombre: z.string(),
        direccion: z.string().optional(),
        activa: z.boolean().optional(),
        esDefault: z.boolean().optional(),
      })
      .parse(req.body);
    res.status(201).json(await branchesSvc.upsertBranch(body));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.patch("/branches/:id", async (req, res) => {
  try {
    const body = z
      .object({
        codigo: z.string(),
        nombre: z.string(),
        direccion: z.string().optional(),
        activa: z.boolean().optional(),
        esDefault: z.boolean().optional(),
      })
      .parse(req.body);
    res.json(
      await branchesSvc.upsertBranch({ ...body, id: req.params.id })
    );
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/branches/:id/set-default", async (req, res) => {
  try {
    res.json(await branchesSvc.setDefaultBranch(req.params.id));
  } catch (err) {
    sendError(res, err);
  }
});

/* —— Channels (WooCommerce / Mercado Libre) —— */
apiRouter.get("/channels", async (_req, res) => {
  try {
    res.json(await channelsSvc.listChannelConfigs());
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.get("/channels/:channel", async (req, res) => {
  try {
    const channel = z.enum(["woocommerce", "mercadolibre"]).parse(req.params.channel);
    res.json(await channelsSvc.getChannelConfig(channel));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.put("/channels/:channel", async (req, res) => {
  try {
    const channel = z.enum(["woocommerce", "mercadolibre"]).parse(req.params.channel);
    const body = z
      .object({
        enabled: z.boolean().optional(),
        storeUrl: z.string().nullable().optional(),
        consumerKey: z.string().nullable().optional(),
        consumerSecret: z.string().nullable().optional(),
        accessToken: z.string().nullable().optional(),
        refreshToken: z.string().nullable().optional(),
        sellerId: z.string().nullable().optional(),
        siteId: z.string().nullable().optional(),
        priceListId: z.string().nullable().optional(),
        stockMode: z.enum(["total", "default_branch", "branch"]).optional(),
        stockBranchId: z.string().nullable().optional(),
      })
      .parse(req.body);
    res.json(await channelsSvc.saveChannelConfig(channel, body));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.get("/products/:id/channels", async (req, res) => {
  try {
    res.json(await channelsSvc.listProductLinks(req.params.id));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.put("/products/:id/channels/:channel", async (req, res) => {
  try {
    const channel = z.enum(["woocommerce", "mercadolibre"]).parse(req.params.channel);
    const body = z
      .object({
        externalId: z.string(),
        externalSku: z.string().optional(),
        syncEnabled: z.boolean().optional(),
      })
      .parse(req.body);
    res.json(
      await channelsSvc.upsertProductLink({
        productId: req.params.id,
        channel,
        ...body,
      })
    );
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.delete("/products/:id/channels/:channel", async (req, res) => {
  try {
    const channel = z.enum(["woocommerce", "mercadolibre"]).parse(req.params.channel);
    await channelsSvc.deleteProductLink(req.params.id, channel);
    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/channels/woocommerce/products/:id/push", async (req, res) => {
  try {
    const mode = z
      .enum(["stock", "price", "both", "full"])
      .optional()
      .default("both")
      .parse(req.body?.mode ?? req.query.mode);
    res.json(await channelsSvc.pushProductToWooCommerce(req.params.id, mode));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/channels/woocommerce/push-all", async (req, res) => {
  try {
    const mode = z
      .enum(["stock", "price", "both", "full"])
      .optional()
      .default("both")
      .parse(req.body?.mode ?? "both");
    res.json({ results: await channelsSvc.pushAllWooCommerce(mode) });
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/channels/woocommerce/link-by-sku", async (_req, res) => {
  try {
    res.json(await channelsSvc.linkWooCommerceBySku());
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/channels/mercadolibre/products/:id/push", async (req, res) => {
  try {
    const mode = z
      .enum(["stock", "price", "both"])
      .optional()
      .default("both")
      .parse(req.body?.mode ?? req.query.mode);
    res.json(await channelsSvc.pushProductToMercadoLibre(req.params.id, mode));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/channels/mercadolibre/push-all", async (req, res) => {
  try {
    const mode = z
      .enum(["stock", "price", "both"])
      .optional()
      .default("both")
      .parse(req.body?.mode ?? "both");
    res.json({ results: await channelsSvc.pushAllMercadoLibre(mode) });
  } catch (err) {
    sendError(res, err);
  }
});

/* —— Descuentos escalonados —— */
const tierSchema = z.object({
  desde: z.number(),
  porcentaje: z.number(),
});

apiRouter.get("/discount-rules", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    const onlyActive = req.query.active === "1" || req.query.active === "true";
    res.json(await discountRulesSvc.listDiscountRules(comercioId, onlyActive));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.get("/discount-rules/:id", async (req, res) => {
  try {
    const rule = await discountRulesSvc.getDiscountRule(req.params.id);
    if (!rule) {
      res.status(404).json({ error: "Regla no encontrada." });
      return;
    }
    res.json(rule);
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/discount-rules", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    const body = z
      .object({
        nombre: z.string(),
        descripcion: z.string().optional(),
        basis: z.enum(["amount", "qty"]).optional(),
        priceListId: z.string().nullable().optional(),
        activa: z.boolean().optional(),
        tiers: z.array(tierSchema).min(1),
      })
      .parse(req.body);
    res.status(201).json(
      await discountRulesSvc.upsertDiscountRule({ ...body, comercioId })
    );
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.patch("/discount-rules/:id", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    const body = z
      .object({
        nombre: z.string(),
        descripcion: z.string().optional(),
        basis: z.enum(["amount", "qty"]).optional(),
        priceListId: z.string().nullable().optional(),
        activa: z.boolean().optional(),
        tiers: z.array(tierSchema).min(1),
      })
      .parse(req.body);
    res.json(
      await discountRulesSvc.upsertDiscountRule({
        ...body,
        id: req.params.id,
        comercioId,
      })
    );
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.delete("/discount-rules/:id", async (req, res) => {
  try {
    await discountRulesSvc.deleteDiscountRule(req.params.id);
    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
});

/* —— Presupuestos —— */
const quoteLineSchema = z.object({
  productId: z.string().nullable().optional(),
  sku: z.string().optional(),
  nombre: z.string().optional(),
  cantidad: z.number(),
  precioUnitario: z.number().optional(),
  lineDescuentoPct: z.number().optional(),
});

const quoteBodySchema = z.object({
  clientId: z.string().nullable().optional(),
  clienteNombre: z.string().optional(),
  clienteEmail: z.string().optional(),
  clienteTelefono: z.string().optional(),
  priceListId: z.string().nullable().optional(),
  discountRuleId: z.string().nullable().optional(),
  discountMode: z.enum(["none", "rule", "manual"]).optional(),
  discountBasis: z.enum(["amount", "qty"]).optional(),
  tiers: z.array(tierSchema).optional(),
  descuentoManualPct: z.number().optional(),
  status: z
    .enum([
      "borrador",
      "enviado",
      "aceptado",
      "rechazado",
      "vencido",
      "convertido",
    ])
    .optional(),
  validezDias: z.number().optional(),
  notas: z.string().optional(),
  lines: z.array(quoteLineSchema).min(1),
});

apiRouter.get("/quotes", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    const status = z
      .enum([
        "borrador",
        "enviado",
        "aceptado",
        "rechazado",
        "vencido",
        "convertido",
      ])
      .optional()
      .parse(
        typeof req.query.status === "string" ? req.query.status : undefined
      );
    res.json(await quotesSvc.listQuotes(comercioId, status));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.get("/quotes/:id", async (req, res) => {
  try {
    const quote = await quotesSvc.getQuote(req.params.id);
    if (!quote) {
      res.status(404).json({ error: "Presupuesto no encontrado." });
      return;
    }
    res.json(quote);
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/quotes/preview", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    const body = quoteBodySchema.parse(req.body);
    res.json(await quotesSvc.previewQuote({ ...body, comercioId }));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/quotes", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    const body = quoteBodySchema.parse(req.body);
    res.status(201).json(await quotesSvc.upsertQuote({ ...body, comercioId }));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.patch("/quotes/:id", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    const body = quoteBodySchema.parse(req.body);
    res.json(
      await quotesSvc.upsertQuote({
        ...body,
        id: req.params.id,
        comercioId,
      })
    );
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/quotes/:id/status", async (req, res) => {
  try {
    const body = z
      .object({
        status: z.enum([
          "borrador",
          "enviado",
          "aceptado",
          "rechazado",
          "vencido",
          "convertido",
        ]),
      })
      .parse(req.body);
    res.json(await quotesSvc.updateQuoteStatus(req.params.id, body.status));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.delete("/quotes/:id", async (req, res) => {
  try {
    await quotesSvc.deleteQuote(req.params.id);
    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
});

/* —— Media library —— */
apiRouter.get("/media", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    const kindRaw = String(req.query.kind ?? "all").toLowerCase();
    const kind =
      kindRaw === "image" || kindRaw === "images"
        ? "image"
        : kindRaw === "attachment" ||
            kindRaw === "attachments" ||
            kindRaw === "file" ||
            kindRaw === "files"
          ? "attachment"
          : "all";
    const q = typeof req.query.q === "string" ? req.query.q : "";
    res.json(await mediaSvc.listMedia({ comercioId, kind, q }));
  } catch (err) {
    sendError(res, err);
  }
});

const mediaBody = z.object({
  productId: z.string().nullable().optional(),
  kind: z.enum(["image", "attachment"]).optional(),
  filename: z.string().min(1),
  mime: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  dataUrl: z.string().nullable().optional(),
  title: z.string().optional(),
});

apiRouter.post("/media", async (req, res) => {
  try {
    const comercioId = await comerciosSvc.resolveComercioId(readComercioId(req));
    const body = mediaBody.parse(req.body);
    res.status(201).json(
      await mediaSvc.createMedia({
        comercioId,
        productId: body.productId ?? null,
        kind: body.kind,
        filename: body.filename,
        mime: body.mime,
        sizeBytes: body.sizeBytes,
        dataUrl: body.dataUrl ?? null,
        title: body.title,
      })
    );
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.delete("/media/:id", async (req, res) => {
  try {
    await mediaSvc.deleteMedia(req.params.id);
    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
});
