-- Aurix Retail gold — schema single-tenant

CREATE TABLE IF NOT EXISTS price_lists (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  codigo VARCHAR(64) NOT NULL,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  es_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_price_lists_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  sku VARCHAR(64) NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  categoria ENUM('bebidas','alimentos','limpieza','otros') NOT NULL DEFAULT 'otros',
  precio_default DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  descripcion TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_products_sku (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_prices (
  product_id VARCHAR(36) NOT NULL,
  price_list_id VARCHAR(36) NOT NULL,
  precio DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (product_id, price_list_id),
  CONSTRAINT fk_pp_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_pp_list FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  email VARCHAR(200) NOT NULL DEFAULT '',
  telefono VARCHAR(64) NOT NULL DEFAULT '',
  direccion VARCHAR(400) NOT NULL DEFAULT '',
  rfc VARCHAR(32) NOT NULL DEFAULT '',
  notas TEXT NOT NULL,
  price_list_id VARCHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_clients_list FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  folio VARCHAR(32) NOT NULL,
  client_id VARCHAR(36) NULL,
  cliente_nombre VARCHAR(200) NOT NULL,
  status ENUM('borrador','confirmado','preparando','entregado','cancelado') NOT NULL,
  canal ENUM('pos','pedido','mayorista') NOT NULL,
  price_list_id VARCHAR(36) NULL,
  con_envio TINYINT(1) NOT NULL DEFAULT 0,
  envio_costo DECIMAL(12,2) NOT NULL DEFAULT 0,
  direccion_envio VARCHAR(400) NULL,
  telefono_contacto VARCHAR(64) NULL,
  metodo_pago ENUM('efectivo','transferencia') NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_orders_folio (folio),
  KEY idx_orders_canal (canal),
  KEY idx_orders_created (created_at),
  CONSTRAINT fk_orders_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_list FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  KEY idx_ol_order (order_id),
  CONSTRAINT fk_ol_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS counters (
  name VARCHAR(64) NOT NULL PRIMARY KEY,
  value INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
