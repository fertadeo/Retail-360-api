# Retail 360 API

API Express + MySQL (single-tenant) para **Retail 360**: misma línea que el gold Aurix Retail, con **sucursales** y sync de productos hacia **WooCommerce** y **Mercado Libre**.

Base: `fertadeo/template-retail-api`. Destino de provision: este repo.

## Requisitos

- Node ≥ 20
- MySQL 8+

## Setup local

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

API en `http://127.0.0.1:3852` · prefijo `/api`.

## Endpoints nuevos (Retail 360)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET/POST | `/api/branches` | Sucursales |
| PATCH | `/api/branches/:id` | Actualizar sucursal |
| POST | `/api/branches/:id/set-default` | Sucursal default |
| GET | `/api/channels` | Estado WooCommerce + ML |
| PUT | `/api/channels/:channel` | Guardar credenciales (`woocommerce` \| `mercadolibre`) |
| PUT | `/api/products/:id/channels/:channel` | Vincular ID externo |
| POST | `/api/channels/woocommerce/products/:id/push` | Empujar producto (crea o actualiza) |
| POST | `/api/channels/woocommerce/link-by-sku` | Vincular por SKU |
| POST | `/api/channels/woocommerce/push-all` | Sync masivo WC |
| POST | `/api/channels/mercadolibre/products/:id/push` | Empujar stock/precio a ítem ML |
| POST | `/api/channels/mercadolibre/push-all` | Sync masivo ML |

Stock de canal: `stock_mode` = `total` \| `default_branch` \| `branch` (+ `stockBranchId`).

## Deploy (provisioner Fenec)

```
PORT, NODE_ENV=production
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
CORS_ORIGIN=https://{slug}.aurixerp.com
```

Scripts: `npm run build` · `npm start` (aplica `sql/` al arrancar).

## Gold en Fenec Admin

- `repoTemplate`: `fertadeo/Retail-360-api`
- `repoTemplateFront`: `fertadeo/Retail-360-nextjs`
