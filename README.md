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
| GET/POST | `/api/comercios` | Comercios / unidades de negocio |
| GET/POST | `/api/stock-share-groups` | Compartir o rotar stock entre comercios |
| POST | `/api/stock/transfer` | Transferencia de stock (rotación) |
| GET/POST | `/api/branches` | Sucursales físicas |
| GET/POST | `/api/discount-rules` | Reglas de descuento escalonado |
| GET/POST | `/api/quotes` | Presupuestos (lista de precios + escalones editables) |
| POST | `/api/quotes/preview` | Preview de totales sin guardar |
| GET | `/api/channels` | Estado WooCommerce + ML |
| PUT | `/api/channels/:channel` | Guardar credenciales |
| POST | `/api/channels/*/products/:id/push` | Empujar stock/precio |

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
