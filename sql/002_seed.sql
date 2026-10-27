-- Demo seed (idempotente por IDs fijos)

INSERT INTO price_lists (id, nombre, codigo, activa, es_default)
VALUES
  ('pl_minorista', 'Minorista', 'minorista', 1, 1),
  ('pl_mayorista', 'Mayorista', 'mayorista', 1, 0)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  activa = VALUES(activa),
  es_default = VALUES(es_default);

INSERT INTO products (id, sku, nombre, categoria, precio_default, costo, stock, activo, descripcion)
VALUES
  ('p1', 'BEB-001', 'Agua mineral 600ml', 'bebidas', 18, 8, 120, 1, 'Botella individual.'),
  ('p2', 'BEB-014', 'Refresco cola 355ml', 'bebidas', 22, 11, 80, 1, 'Lata.'),
  ('p3', 'ALI-210', 'Galletas surtidas 200g', 'alimentos', 45, 22, 40, 1, 'Caja familiar.'),
  ('p4', 'ALI-088', 'Café molido 250g', 'alimentos', 95, 48, 25, 1, 'Tueste medio.'),
  ('p5', 'LIM-003', 'Detergente 1L', 'limpieza', 68, 35, 18, 1, 'Lavanda.'),
  ('p6', 'OTR-901', 'Bolsa reutilizable', 'otros', 35, 12, 60, 1, 'Tela resistente.')
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  categoria = VALUES(categoria),
  precio_default = VALUES(precio_default),
  costo = VALUES(costo),
  descripcion = VALUES(descripcion);

INSERT INTO product_prices (product_id, price_list_id, precio)
VALUES
  ('p1', 'pl_minorista', 18), ('p1', 'pl_mayorista', 14),
  ('p2', 'pl_minorista', 22), ('p2', 'pl_mayorista', 17),
  ('p3', 'pl_minorista', 45), ('p3', 'pl_mayorista', 36),
  ('p4', 'pl_minorista', 95), ('p4', 'pl_mayorista', 78),
  ('p5', 'pl_minorista', 68), ('p5', 'pl_mayorista', 55),
  ('p6', 'pl_minorista', 35), ('p6', 'pl_mayorista', 28)
ON DUPLICATE KEY UPDATE precio = VALUES(precio);

INSERT INTO clients (id, nombre, email, telefono, direccion, rfc, notas, price_list_id)
VALUES
  ('c1', 'María López', 'maria@ejemplo.mx', '55 1234 5678', 'Av. Reforma 120, Col. Centro, CDMX', 'LOMA850101XXX', 'Cliente frecuente.', 'pl_minorista'),
  ('c2', 'Comercial del Valle SA', 'compras@valle.mx', '55 9876 5432', 'Calle Industrial 45, Parque Valle, NL', 'CVA920215ABC', 'Factura a mes vencido.', 'pl_mayorista'),
  ('c3', 'Juan Pérez', 'juan.perez@mail.com', '33 2222 1111', 'Calle Roble 8, Zapopan, Jal.', '', '', NULL)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  email = VALUES(email),
  telefono = VALUES(telefono),
  direccion = VALUES(direccion);

INSERT INTO counters (name, value) VALUES
  ('seq', 10),
  ('folio_pos', 204),
  ('folio_pedido', 1002),
  ('folio_mayorista', 2000)
ON DUPLICATE KEY UPDATE name = name;
