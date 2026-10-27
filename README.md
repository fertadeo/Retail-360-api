# template-retail-api

Gold **Aurix Retail** (API Express + MySQL). Single-tenant: cada instancia de cliente recibe su propia DB y deploy PM2.

Contrato alineado al store del front `template-retail`.

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

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Salud + ping DB |
| GET | `/api/dashboard/stats` | KPIs |
| GET/POST | `/api/price-lists` | Listas de precios |
| PATCH | `/api/price-lists/:id` | Actualizar lista |
| POST | `/api/price-lists/:id/set-default` | Marcar default |
| GET/POST | `/api/products` | Productos |
| PATCH | `/api/products/:id` | Actualizar producto |
| GET/POST | `/api/clients` | Clientes |
| PATCH | `/api/clients/:id` | Actualizar cliente |
| GET | `/api/orders` | Pedidos (`?canal=pos\|pedido\|mayorista`) |
| POST | `/api/orders` | Pedido canal `pedido` |
| POST | `/api/pos/checkout` | Venta POS (+ envío / pago) |
| GET/POST | `/api/wholesale/orders` | Pedidos mayorista |

## Deploy (provisioner Fenec)

El alta de instancia clona este template como `aurix-api-{slug}`, crea DB `aurix_{slug}` e inyecta:

```
PORT, NODE_ENV=production
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
CORS_ORIGIN=https://{slug}.aurixerp.com
```

Scripts usados: `npm run build` · `npm start`.

## Gold en Fenec Admin

Registrar con:

- `repoTemplate`: `fertadeo/template-retail-api`
- `repoTemplateFront`: `fertadeo/template-retail`
