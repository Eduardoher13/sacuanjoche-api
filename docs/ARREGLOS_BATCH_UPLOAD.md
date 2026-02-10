# Subida por Lotes de Arreglos e Imágenes (Frontend Guide)

Esta guía describe los endpoints y el formato esperado para que el Frontend implemente:
- Creación de arreglos por lote con imágenes (`multipart/form-data`).
- Guardado de imágenes por lote (URLs) para arreglos existentes.
- Guardado de una sola imagen (URL) y listado de imágenes.

## Requisitos
- Autenticación: Admin (`ValidRoles.admin`) para creación por lote; Admin/Vendedor para media.
- Emparejamiento por índice: `images[i]` corresponde a `items[i]` en el JSON `data`.
- Tipos de imagen permitidos: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif`.
- Máximo de imágenes por lote: 50.
- Límite de tamaño por archivo: `DO_SPACES_MAX_UPLOAD_BYTES` (por defecto 5MB si no está definido).

## Variables de entorno relevantes
```
DO_SPACES_BUCKET=
DO_SPACES_REGION=
DO_SPACES_ENDPOINT=
DO_SPACES_KEY=
DO_SPACES_SECRET=
DO_SPACES_CDN_URL=
DO_SPACES_PUBLIC_BASE_URL=
DO_SPACES_MAX_UPLOAD_BYTES=5242880
```

## 1) Crear arreglos por lote con imágenes
- Método: `POST`
- Ruta: `/arreglos/batch`
- Auth: Admin
- Content-Type: `multipart/form-data`

### Campos del formulario
- `images`: array de archivos (uno por cada item).
- `data`: string JSON con formato:
```json
{
  "items": [
    {
      "idFormaArreglo": 1,
      "nombre": "Ramo clásico",
      "descripcion": "Ideal para regalo",
      "precioUnitario": 49.99,
      "estado": "activo",
      "flores": [
        { "idFlor": 10, "cantidad": 12 },
        { "idFlor": 5, "cantidad": 3 }
      ],
      "accesorios": [
        { "idAccesorio": 2, "cantidad": 1 }
      ],
      "imageUrl": "https://...opcional...",
      "media": { "altText": "Ramo clásico", "isPrimary": true, "orden": 0 }
    },
    {
      "idFormaArreglo": 2,
      "nombre": "Centro de mesa",
      "precioUnitario": 59.90,
      "flores": [ { "idFlor": 1, "cantidad": 5 } ],
      "accesorios": [],
      "media": { "orden": 0 }
    }
  ]
}
```

Notas:
- **Importante**: `flores` y `accesorios` son listas opcionales en estructura pero fundamentales para la lógica de negocio y cálculo de costos. Se recomienda enviarlas siempre.
- `items[i].imageUrl`: Si está presente, se usa esa URL y NO se sube `images[i]`.
- `media.isPrimary`: marca portada y actualiza `arreglo.url`.
- Límite de tamaño por archivo lee `DO_SPACES_MAX_UPLOAD_BYTES`.

### Ejemplo con `curl`
```bash
curl -X POST "https://api.tu-dominio.com/arreglos/batch" \
  -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H "Accept: application/json" \
  -F "images=@/path/a/imagen1.jpg" \
  -F "images=@/path/a/imagen2.png" \
  -F "data={\"items\":[{\"idFormaArreglo\":1,\"nombre\":\"Ramo clásico\",\"precioUnitario\":49.99,\"media\":{\"altText\":\"Ramo clásico\",\"isPrimary\":true,\"orden\":0}},{\"idFormaArreglo\":2,\"nombre\":\"Centro de mesa\",\"precioUnitario\":59.90,\"media\":{\"orden\":0}}]}"
```

### Ejemplo con `axios` (Browser)
```ts
const form = new FormData();
items.forEach((item, i) => form.append('images', files[i]));
form.append('data', JSON.stringify({ items }));
const res = await axios.post('/arreglos/batch', form, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### Respuesta (201)
Array de arreglos creados con `formaArreglo` y `media` ordenadas.

### Errores (400)
- `data` faltante o JSON inválido.
- `items` vacío o no array.
- `images.length !== items.length`.
- MIME no permitido.

## 2) Guardar múltiples imágenes (URLs) para un arreglo existente
- Método: `POST`
- Ruta: `/arreglos/:id/media/batch`
- Auth: Admin o Vendedor
- Content-Type: `application/json`

### Body
```json
{ "imagenes": [
  { "url": "https://.../imagen1.jpg", "orden": 0, "isPrimary": true, "altText": "Ramo rojo" },
  { "url": "https://.../imagen2.jpg", "orden": 1 }
]}
```

### Respuesta
Array de `ArregloMedia` creados y sincronización de portada si aplica.

## 3) Guardar una sola imagen (URL) para un arreglo existente
- Método: `POST`
- Ruta: `/arreglos/:id/media`
- Auth: Admin o Vendedor
- Content-Type: `application/json`

### Body
```json
{ "url": "https://.../imagen.jpg", "orden": 0, "isPrimary": true, "altText": "Texto alternativo" }
```

### Respuesta
Objeto `ArregloMedia` creado.

## 4) Listar imágenes de un arreglo
- Método: `GET`
- Ruta: `/arreglos/:id/media`
- Auth: Admin, Vendedor, Cliente
- Respuesta: Array de `ArregloMedia` activos ordenados.

## Referencias del Backend
- Batch DTO: `src/arreglo/dto/create-lote-arreglos.dto.ts`
- Batch endpoint: `src/arreglo/arreglo.controller.ts` → `POST /arreglos/batch`
- Media batch (URLs): `src/arreglo/controllers/arreglos-media.controller.ts` → `POST /arreglos/:id/media/batch`
- Media simple (URL): `POST /arreglos/:id/media`
- Spaces service (upload y delete): `src/common/storage/spaces.service.ts`

## Buenas prácticas Frontend
- Asegura `items.length === files.length` y orden estable.
- `FormData`: agrega `images` en orden y `data` como string JSON.
- Usa `isPrimary` en el primer item si quieres portada inmediata.
- Valida tamaño de archivos antes de enviar (< `DO_SPACES_MAX_UPLOAD_BYTES`).
