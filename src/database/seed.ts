import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as CryptoJS from 'crypto-js';
import dataSource from '../data-source';

dotenv.config();

const seedPassword = process.env.SEED_PASSWORD ?? 'Eduardo1234';
const encryptionKey = process.env.AES_SECRET_KEY;

if (!encryptionKey || encryptionKey.length !== 32) {
  throw new Error('AES_SECRET_KEY debe tener exactamente 32 caracteres.');
}

const encryptedPassword = CryptoJS.AES.encrypt(
  seedPassword,
  encryptionKey,
).toString();

const dates = Array.from({ length: 10 }, (_, index) =>
  `2026-08-${String(index + 1).padStart(2, '0')} 10:00:00`,
);

async function insertMany(
  table: string,
  columns: string[],
  rows: unknown[][],
): Promise<void> {
  const values: unknown[] = [];
  const placeholders = rows.map((row, rowIndex) => {
    const rowPlaceholders = row.map((value, columnIndex) => {
      values.push(value);
      return `$${rowIndex * columns.length + columnIndex + 1}`;
    });
    return `(${rowPlaceholders.join(', ')})`;
  });

  await dataSource.query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')}`,
    values,
  );
}

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === 'production' || process.env.STAGE === 'prod') {
    throw new Error('El seed está bloqueado en producción.');
  }

  await dataSource.initialize();

  try {
    await dataSource.query(`
      TRUNCATE TABLE
        users, login_attempt, carrito, carritos_arreglo,
        factura_detalle, factura, envio, pedido_historial,
        ruta_pedido, ruta, detalle_pedido, pedido, pago,
        metodo_pago, accesorios_arreglo, arreglo_media, arreglo_flor,
        arreglo, flor, accesorio, forma_arreglo, folio,
        cliente_direccion, direccion, contacto_entrega, cliente, empleado
      RESTART IDENTITY CASCADE
    `);

    const clientIds = Array.from({ length: 10 }, (_, index) => index + 1);
    const employeeIds = Array.from({ length: 10 }, (_, index) => index + 1);
    const userIds = [
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
      '00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000005',
      '00000000-0000-0000-0000-000000000006',
      '00000000-0000-0000-0000-000000000007',
      '00000000-0000-0000-0000-000000000008',
      '00000000-0000-0000-0000-000000000009',
      '00000000-0000-0000-0000-000000000010',
    ];

    await insertMany('cliente', [
      'id_cliente', 'primer_nombre', 'segundo_nombre', 'primer_apellido',
      'segundo_apellido', 'telefono', 'nombre_empresa', 'estado',
    ], clientIds.map((id) => [
      id, `Cliente${id}`, null, `Apellido${id}`, null,
      `8888${String(id).padStart(4, '0')}`, id === 10 ? 'Flores Demo' : null, 'activo',
    ]));

    await insertMany('empleado', [
      'id_empleado', 'primer_nombre', 'segundo_nombre', 'primer_apellido',
      'segundo_apellido', 'sexo', 'telefono', 'fecha_nac', 'estado',
    ], employeeIds.map((id) => [
      id, `Empleado${id}`, 'Demo', `Apellido${id}`, null,
      id % 2 ? 'M' : 'F', `7777${String(id).padStart(4, '0')}`,
      `199${id % 10}-01-15`, 'activo',
    ]));

    await insertMany('users', [
      'id', 'email', 'password', 'roles', 'estado', 'login_attempts', 'blocked_until',
      'empleado_id', 'cliente_id', 'carrito_id',
    ], userIds.map((id, index) => [
      id,
      index === 0 ? 'eduardoher13@gmail.com' : `usuario${index + 1}@example.com`,
      encryptedPassword,
      index === 0 ? ['admin', 'superuser'] : ['cliente'],
      'activo', 0, null,
      index === 0 ? 1 : null,
      index === 0 ? null : index,
      null,
    ]));

    await insertMany('forma_arreglo', ['id_forma_arreglo', 'descripcion', 'activo'],
      clientIds.map((id) => [id, `Forma de arreglo ${id}`, true]));

    await insertMany('flor', [
      'id_flor', 'nombre', 'color', 'precio_unitario', 'tipo', 'estado',
    ], clientIds.map((id) => [
      id, `Flor ${id}`, id % 2 ? 'rojo' : 'blanco', (5 + id).toFixed(2), 'ornamental', 'activo',
    ]));

    await insertMany('accesorio', [
      'id_accesorio', 'descripcion', 'precio_unitario', 'estado', 'categoria',
    ], clientIds.map((id) => [
      id, `Accesorio ${id}`, (2 + id).toFixed(2), 'activo', id % 2 ? 'envoltura' : 'decoracion',
    ]));

    await insertMany('arreglo', [
      'id_arreglo', 'id_forma_arreglo', 'nombre', 'descripcion', 'url',
      'precio_unitario', 'estado',
    ], clientIds.map((id) => [
      id, id, `Arreglo ${id}`, `Composicion floral de prueba ${id}`,
      `https://example.com/arreglo-${id}.jpg`, (25 + id * 3).toFixed(2), 'activo',
    ]));

    await insertMany('arreglo_flor', ['id_arreglo_flor', 'id_arreglo', 'id_flor', 'cantidad'],
      clientIds.map((id) => [id, id, id, 3]));
    await insertMany('accesorios_arreglo', ['id_accesorio_arreglo', 'id_accesorio', 'id_arreglo', 'cantidad'],
      clientIds.map((id) => [id, id, id, 1]));
    await insertMany('arreglo_media', [
      'id_arreglo_media', 'id_arreglo', 'url', 'provider', 'object_key',
      'content_type', 'orden', 'is_primary', 'alt_text', 'metadata', 'activo',
    ], clientIds.map((id) => [
      id, id, `https://picsum.photos/seed/arreglo-${id}/600/400`, 'local',
      `seed/arreglo-${id}.jpg`, 'image/jpeg', 0, true, `Imagen del arreglo ${id}`, '{}', true,
    ]));

    await insertMany('direccion', [
      'id_direccion', 'formatted_address', 'country', 'admin_area', 'city',
      'neighborhood', 'street', 'house_number', 'postal_code', 'referencia',
      'lat', 'lng', 'provider', 'place_id', 'accuracy', 'geolocation', 'activo',
    ], clientIds.map((id) => [
      id, `Direccion de prueba ${id}, Managua`, 'Nicaragua', 'Managua', 'Managua',
      `Barrio ${id}`, 'Calle Principal', String(id), '11001', 'Cerca del parque',
      (12.10 + id / 1000).toFixed(8), (-86.25 - id / 1000).toFixed(8),
      'seed', `seed-place-${id}`, 'rooftop', null, true,
    ]));

    await insertMany('cliente_direccion', [
      'id_cliente_direccion', 'id_cliente', 'id_direccion', 'etiqueta',
      'es_predeterminada', 'activo',
    ], clientIds.map((id) => [id, id, id, 'Casa', true, true]));

    await insertMany('contacto_entrega', ['id_contacto_entrega', 'nombre', 'apellido', 'telefono'],
      clientIds.map((id) => [id, `Contacto${id}`, `Entrega${id}`, `8888${String(id).padStart(4, '0')}`]));

    await insertMany('metodo_pago', [
      'id_metodo_pago', 'descripcion', 'tipo', 'canales_disponibles', 'estado',
    ], clientIds.map((id) => [
      id, `Metodo de pago ${id}`, id % 3 === 0 ? 'online' : id % 3 === 1 ? 'efectivo' : 'mixto',
      id % 3 === 0 ? ['web'] : ['web', 'interno'], 'activo',
    ]));

    await insertMany('pago', [
      'id_pago', 'id_metodo_pago', 'monto', 'estado', 'referencia', 'gateway',
      'id_gateway', 'payment_link_url', 'payment_url_ext', 'raw_payload',
    ], clientIds.map((id) => [
      id, id, (40 + id * 4).toFixed(2), id % 3 === 0 ? 'pagado' : 'pendiente',
      `REF-SEED-${id}`, id % 3 === 0 ? 'local' : null, id % 3 === 0 ? `GATEWAY-${id}` : null,
      null, null, null,
    ]));

    await insertMany('folio', [
      'id_folio', 'descripcion', 'activo', 'longitud', 'documento', 'mascara',
      'valor_inicial', 'valor_final', 'ultimo_valor',
    ], clientIds.map((id) => [
      id, `Folio ${id}`, 'activo', 8, `PED${id}`, '00000000',
      1, 99999999, id,
    ]));

    await insertMany('pedido', [
      'id_pedido', 'id_empleado', 'id_cliente', 'id_direccion',
      'id_contacto_entrega', 'total_productos', 'fecha_entrega_estimada',
      'direccion_txt', 'mensaje_pedido', 'total_pedido', 'estado', 'id_pago',
      'canal', 'numero_pedido', 'id_folio',
    ], clientIds.map((id) => [
      id, id, id, id, id, (25 + id * 3).toFixed(2), dates[id - 1],
      `Direccion de prueba ${id}, Managua`, `Mensaje para el pedido ${id}`,
      (40 + id * 4).toFixed(2), id % 4 === 0 ? 'entregado' : 'pendiente', id,
      id % 2 ? 'web' : 'interno', `PED-${String(id).padStart(5, '0')}`, id,
    ]));

    await insertMany('detalle_pedido', [
      'id_detalle_pedido', 'id_pedido', 'id_arreglo', 'cantidad',
      'precio_unitario', 'subtotal',
    ], clientIds.map((id) => [id, id, id, 1 + (id % 3),
      (25 + id * 3).toFixed(2), ((1 + (id % 3)) * (25 + id * 3)).toFixed(2)]));

    await insertMany('ruta', [
      'id_ruta', 'nombre', 'id_empleado', 'estado', 'fecha_programada',
      'distancia_km', 'duracion_min', 'geometry', 'mapbox_request_id',
      'profile', 'origen_lat', 'origen_lng',
    ], clientIds.map((id) => [
      id, `Ruta ${id}`, id, id % 2 ? 'pendiente' : 'en_progreso', dates[id - 1],
      (id * 2.5).toFixed(2), (id * 10).toFixed(2), null, `seed-route-${id}`,
      'driving', '12.14893701', '-86.28978829',
    ]));

    await insertMany('ruta_pedido', [
      'id_ruta_pedido', 'id_ruta', 'id_pedido', 'secuencia', 'distancia_km',
      'duracion_min', 'lat', 'lng', 'direccion_resumen', 'estado_entrega',
    ], clientIds.map((id) => [
      id, id, id, 1, (id * 2.5).toFixed(2), (id * 10).toFixed(2),
      (12.10 + id / 1000).toFixed(8), (-86.25 - id / 1000).toFixed(8),
      `Direccion de prueba ${id}`, id % 4 === 0 ? 'entregado' : 'pendiente',
    ]));

    await insertMany('envio', [
      'id_envio', 'id_pedido', 'id_empleado', 'estado_envio', 'fecha_programada',
      'fecha_salida', 'fecha_entrega', 'origen_lat', 'origen_lng', 'destino_lat',
      'destino_lng', 'costo_envio', 'distancia_km', 'observaciones', 'id_ruta',
    ], clientIds.map((id) => [
      id, id, id, id % 4 === 0 ? 'entregado' : 'pendiente', dates[id - 1],
      null, id % 4 === 0 ? dates[id - 1] : null, '12.14893701', '-86.28978829',
      (12.10 + id / 1000).toFixed(8), (-86.25 - id / 1000).toFixed(8),
      '3.50', (id * 2.5).toFixed(2), `Observacion de envio ${id}`, id,
    ]));

    await insertMany('factura', [
      'id_factura', 'id_pedido', 'id_empleado', 'num_factura', 'id_folio',
      'estado', 'monto_total',
    ], clientIds.map((id) => [
      id, id, id, `FAC-${String(id).padStart(6, '0')}`, id,
      id % 3 === 0 ? 'pagado' : 'pendiente', (40 + id * 4).toFixed(2),
    ]));

    await insertMany('factura_detalle', [
      'id_factura_detalle', 'id_factura', 'id_arreglo', 'cantidad',
      'precio_unitario', 'subtotal',
    ], clientIds.map((id) => [id, id, id, 1, (25 + id * 3).toFixed(2), (25 + id * 3).toFixed(2)]));

    await insertMany('pedido_historial', [
      'id_pedido_historial', 'id_pedido', 'id_empleado', 'estado_anterior',
      'estado_nuevo', 'nota',
    ], clientIds.map((id) => [
      id, id, id, null, id % 4 === 0 ? 'entregado' : 'pendiente', `Pedido seed ${id} creado`,
    ]));

    await insertMany('login_attempt', [
      'id_login_attempt', 'ip_address', 'attempts', 'blocked_until',
    ], clientIds.map((id) => [id, `192.168.10.${id}`, 0, null]));

    await insertMany('carrito', [
      'id_carrito', 'id_user', 'id_pago', 'estado',
    ], clientIds.map((id) => [id, userIds[id - 1], null, 'activo']));

    await dataSource.query(`
      UPDATE users
      SET carrito_id = id_carrito
      FROM carrito
      WHERE carrito.id_user = users.id
    `);

    await insertMany('carritos_arreglo', [
      'id_carrito_arreglo', 'id_arreglo', 'id_carrito', 'cantidad',
      'precio_unitario', 'total_linea',
    ], clientIds.map((id) => [id, id, id, 1, (25 + id * 3).toFixed(2), (25 + id * 3).toFixed(2)]));

    const counts = await dataSource.query(`
      SELECT table_name, (xpath('/row/count/text()',
        query_to_xml(format('SELECT count(*) AS count FROM %I', table_name), false, true, '')
      ))[1]::text::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.table(counts);
    console.log('Seed completado. Login: eduardoher13@gmail.com / password definida en SEED_PASSWORD.');
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error('Seed fallido:', error);
  process.exitCode = 1;
});
