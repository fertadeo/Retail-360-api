import { Router } from "express";
import { z } from "zod";
import { sendError } from "../lib/http.js";
import * as branchesSvc from "../services/branches.js";
import * as channelsSvc from "../services/channels.js";
import * as clientsSvc from "../services/clients.js";
import * as ordersSvc from "../services/orders.js";
import * as priceListsSvc from "../services/price-lists.js";
import * as productsSvc from "../services/products.js";
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
    res.json(await ordersSvc.dashboardStats(day));
  } catch (err) {
    sendError(res, err);
  }
});

/* —— Price lists —— */
apiRouter.get("/price-lists", async (req, res) => {
  try {
    const onlyActive = req.query.active === "1" || req.query.active === "true";
    res.json(await priceListsSvc.listPriceLists(onlyActive));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/price-lists", async (req, res) => {
  try {
    const body = z
      .object({
        nombre: z.string(),
        codigo: z.string().optional(),
        activa: z.boolean().optional(),
        esDefault: z.boolean().optional(),
      })
      .parse(req.body);
    res.status(201).json(await priceListsSvc.createPriceList(body));
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
apiRouter.get("/products", async (_req, res) => {
  try {
    res.json(await productsSvc.listProducts());
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
    const body = productBody.parse(req.body);
    res.status(201).json(await productsSvc.upsertProduct(body));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.patch("/products/:id", async (req, res) => {
  try {
    const body = productBody.parse({ ...req.body, id: req.params.id });
    res.json(await productsSvc.upsertProduct(body));
  } catch (err) {
    sendError(res, err);
  }
});

/* —— Clients —— */
apiRouter.get("/clients", async (_req, res) => {
  try {
    res.json(await clientsSvc.listClients());
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
    const body = clientBody.parse(req.body);
    res.status(201).json(await clientsSvc.upsertClient(body));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.patch("/clients/:id", async (req, res) => {
  try {
    const body = clientBody.parse({ ...req.body, id: req.params.id });
    res.json(await clientsSvc.upsertClient(body));
  } catch (err) {
    sendError(res, err);
  }
});

/* —— Orders —— */
apiRouter.get("/orders", async (req, res) => {
  try {
    const canal = z
      .enum(["pos", "pedido", "mayorista"])
      .optional()
      .parse(
        typeof req.query.canal === "string" ? req.query.canal : undefined
      );
    res.json(await ordersSvc.listOrders(canal));
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
    const body = z
      .object({
        clientId: z.string(),
        lines: z.array(lineSchema).min(1),
      })
      .parse(req.body);
    res.status(201).json(await ordersSvc.createPedido(body));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/pos/checkout", async (req, res) => {
  try {
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
    res.status(201).json(await ordersSvc.createPosSale(body));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.post("/wholesale/orders", async (req, res) => {
  try {
    const body = z
      .object({
        clientId: z.string(),
        lines: z.array(lineSchema).min(1),
      })
      .parse(req.body);
    res.status(201).json(await ordersSvc.createMayoristaPedido(body));
  } catch (err) {
    sendError(res, err);
  }
});

apiRouter.get("/wholesale/orders", async (_req, res) => {
  try {
    res.json(await ordersSvc.listOrders("mayorista"));
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
