# Documentación API - Rutas (Frontend)

## Base URL
```
http://localhost:3000/api/rutas
```

## Autenticación
Todos los endpoints requieren autenticación JWT:
```
Authorization: Bearer <token>
```

---

## Endpoints

### 1. Listar Rutas (con filtro opcional por empleado)

**GET** `/api/rutas`

**Query Parameters:**
- `idEmpleado` (opcional): Filtrar rutas por ID de empleado

**Roles permitidos:**
- `admin`
- `vendedor`
- `conductor`

**Comportamiento:**
- Sin `idEmpleado`: Devuelve todas las rutas (admin/vendedor) o solo las del conductor autenticado
- Con `idEmpleado`: Filtra por ese empleado específico (con validaciones de permisos)

**Ejemplos de petición:**

```javascript
// Obtener todas las rutas (o solo las del conductor autenticado)
const response = await fetch('http://localhost:3000/api/rutas', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Filtrar por empleado específico
const response = await fetch('http://localhost:3000/api/rutas?idEmpleado=3', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

**Respuesta exitosa (200 OK):**
```json
[
  {
    "idRuta": 1,
    "nombre": "Ruta matutina",
    "idEmpleado": 3,
    "estado": "pendiente",
    "fechaProgramada": "2025-11-12T14:00:00.000Z",
    "distanciaKm": 12.4,
    "duracionMin": 38.5,
    "profile": "driving",
    "origenLat": 12.136389,
    "origenLng": -86.251389,
    "geometry": "{...}", // GeoJSON string
    "fechaCreacion": "2025-11-10T08:00:00.000Z",
    "fechaActualizacion": "2025-11-10T08:00:00.000Z",
    "empleado": {
      "idEmpleado": 3,
      "primerNombre": "Juan",
      "primerApellido": "Pérez"
    },
    "rutaPedidos": [
      {
        "idRutaPedido": 5,
        "idRuta": 1,
        "idPedido": 12,
        "secuencia": 1,
        "distanciaKm": 4.1,
        "duracionMin": 10.2,
        "lat": 12.1301,
        "lng": -86.251,
        "direccionResumen": "Pedido 12 - Las Flores 123",
        "estadoEntrega": "pendiente"
      }
    ]
  }
]
```

**Errores posibles:**

| Código | Descripción | Mensaje |
|--------|-------------|---------|
| `404` | Empleado no encontrado (al filtrar) | `"Empleado con ID {id} no encontrado."` |
| `403` | Conductor intenta ver rutas de otro empleado | `"No tiene permiso para ver las rutas de otros empleados. Solo puede ver sus propias rutas asignadas."` |

**Ejemplo de error 404:**
```json
{
  "statusCode": 404,
  "message": "Empleado con ID 999 no encontrado.",
  "error": "Not Found"
}
```

**Ejemplo de error 403:**
```json
{
  "statusCode": 403,
  "message": "No tiene permiso para ver las rutas de otros empleados. Solo puede ver sus propias rutas asignadas.",
  "error": "Forbidden"
}
```

---

### 2. Crear Ruta (con validación de pedidos duplicados)

**POST** `/api/rutas`

**Roles permitidos:**
- `admin`
- `vendedor`

**Body (JSON):**
```typescript
{
  pedidoIds: number[];        // REQUERIDO - Array de IDs de pedidos (mínimo 1)
  nombre?: string;             // Opcional - Nombre de la ruta
  idEmpleado?: number;        // Opcional - ID del empleado asignado
  fechaProgramada?: string;   // Opcional - ISO 8601 date-time
  profile?: string;           // Opcional - 'driving', 'driving-traffic', 'walking', 'cycling'
  origenLat?: number;         // Opcional - Latitud de origen
  origenLng?: number;          // Opcional - Longitud de origen
  roundTrip?: boolean;        // Opcional - Si la ruta debe regresar al origen
}
```

**Ejemplo de petición:**
```javascript
const response = await fetch('http://localhost:3000/api/rutas', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    nombre: 'Ruta matutina',
    idEmpleado: 3,
    pedidoIds: [12, 15, 18],
    fechaProgramada: '2025-11-12T14:00:00.000Z',
    profile: 'driving',
    roundTrip: false
  })
});
```

**Respuesta exitosa (201 Created):**
```json
{
  "idRuta": 1,
  "nombre": "Ruta matutina",
  "idEmpleado": 3,
  "estado": "pendiente",
  "fechaProgramada": "2025-11-12T14:00:00.000Z",
  "distanciaKm": 12.4,
  "duracionMin": 38.5,
  "profile": "driving",
  "origenLat": 12.136389,
  "origenLng": -86.251389,
  "geometry": "{...}",
  "rutaPedidos": [
    {
      "idRutaPedido": 5,
      "idRuta": 1,
      "idPedido": 12,
      "secuencia": 1,
      "distanciaKm": 4.1,
      "duracionMin": 10.2,
      "lat": 12.1301,
      "lng": -86.251,
      "direccionResumen": "Pedido 12 - Las Flores 123",
      "estadoEntrega": "pendiente"
    }
  ]
}
```

**Errores posibles:**

| Código | Descripción | Mensaje |
|--------|-------------|---------|
| `400` | Pedidos duplicados | Mensaje detallado con cada pedido duplicado |
| `400` | Pedidos sin coordenadas | `"Los pedidos {ids} no tienen coordenadas válidas registradas."` |
| `400` | Parámetros inválidos | Varios mensajes según el caso |
| `404` | Empleado no encontrado | `"Empleado {id} no encontrado para asignar a la ruta."` |
| `404` | Pedidos no encontrados | `"Pedidos no encontrados: {ids}"` |

**Ejemplo de error 400 - Pedidos duplicados:**
```json
{
  "statusCode": 400,
  "message": "Los siguientes pedidos ya están asignados a otras rutas: Pedido 12 ya está asignado a la Ruta matutina (ID: 1); Pedido 15 ya está asignado a la Ruta #2 (ID: 2). Un pedido no puede estar asignado a múltiples rutas.",
  "error": "Bad Request"
}
```

**Ejemplo de error 400 - Sin coordenadas:**
```json
{
  "statusCode": 400,
  "message": "Los pedidos 20, 21 no tienen coordenadas válidas registradas.",
  "error": "Bad Request"
}
```

**Ejemplo de error 404 - Empleado no encontrado:**
```json
{
  "statusCode": 404,
  "message": "Empleado 999 no encontrado para asignar a la ruta.",
  "error": "Not Found"
}
```

**Ejemplo de error 404 - Pedidos no encontrados:**
```json
{
  "statusCode": 404,
  "message": "Pedidos no encontrados: 100, 101",
  "error": "Not Found"
}
```

---

### 3. Obtener Detalle de Ruta

**GET** `/api/rutas/:idRuta`

**Roles permitidos:**
- `admin`
- `vendedor`
- `conductor`

**Ejemplo de petición:**
```javascript
const response = await fetch('http://localhost:3000/api/rutas/1', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

**Errores posibles:**

| Código | Descripción |
|--------|-------------|
| `403` | Conductor intenta ver ruta de otro empleado |
| `404` | Ruta no encontrada |

---

## Estructura de Datos

### Ruta
```typescript
interface Ruta {
  idRuta: number;
  nombre?: string;
  idEmpleado?: number;
  estado: string;                    // 'pendiente', 'en_proceso', 'completada', etc.
  fechaProgramada?: string;          // ISO 8601
  distanciaKm?: number;
  duracionMin?: number;
  profile: string;                   // 'driving', 'driving-traffic', 'walking', 'cycling'
  origenLat: number;
  origenLng: number;
  geometry?: string;                  // GeoJSON string para dibujar en mapas
  mapboxRequestId?: string;
  fechaCreacion: string;             // ISO 8601
  fechaActualizacion: string;        // ISO 8601
  empleado?: Empleado;
  rutaPedidos: RutaPedido[];
}
```

### RutaPedido
```typescript
interface RutaPedido {
  idRutaPedido: number;
  idRuta: number;
  idPedido: number;
  secuencia: number;                  // Orden de entrega (1, 2, 3...)
  distanciaKm?: number;               // Distancia desde el punto anterior
  duracionMin?: number;               // Tiempo desde el punto anterior
  lat: number;
  lng: number;
  direccionResumen?: string;
  estadoEntrega: string;            // 'pendiente', 'en_camino', 'entregado', etc.
  fechaCreacion: string;
  fechaActualizacion: string;
}
```

### Empleado
```typescript
interface Empleado {
  idEmpleado: number;
  primerNombre: string;
  segundoNombre?: string;
  primerApellido: string;
  segundoApellido?: string;
  // ... otros campos
}
```

---

## Manejo de Errores en el Frontend

### Ejemplo de función con manejo de errores

```typescript
// types.ts
interface Ruta {
  idRuta: number;
  nombre?: string;
  idEmpleado?: number;
  estado: string;
  fechaProgramada?: string;
  distanciaKm?: number;
  duracionMin?: number;
  origenLat: number;
  origenLng: number;
  geometry?: string;
  rutaPedidos: RutaPedido[];
}

interface RutaPedido {
  idRutaPedido: number;
  idPedido: number;
  secuencia: number;
  lat: number;
  lng: number;
  direccionResumen?: string;
  estadoEntrega: string;
  distanciaKm?: number;
  duracionMin?: number;
}

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
}

// api/rutas.ts
const API_URL = 'http://localhost:3000/api';

export const getRutas = async (
  token: string,
  idEmpleado?: number
): Promise<Ruta[]> => {
  const url = idEmpleado 
    ? `${API_URL}/rutas?idEmpleado=${idEmpleado}`
    : `${API_URL}/rutas`;
    
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    
    if (response.status === 404) {
      throw new Error(`Empleado no encontrado: ${error.message}`);
    }
    
    if (response.status === 403) {
      throw new Error('No tiene permiso para ver estas rutas');
    }
    
    throw new Error(`Error al obtener rutas: ${error.message}`);
  }

  return response.json();
};

export const createRuta = async (
  token: string,
  data: {
    pedidoIds: number[];
    nombre?: string;
    idEmpleado?: number;
    fechaProgramada?: string;
    profile?: string;
    origenLat?: number;
    origenLng?: number;
    roundTrip?: boolean;
  }
): Promise<Ruta> => {
  const response = await fetch(`${API_URL}/rutas`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    
    if (response.status === 400) {
      // Verificar si es error de pedidos duplicados
      if (error.message.includes('ya está asignado')) {
        throw new Error(`Pedidos duplicados: ${error.message}`);
      }
      
      // Otros errores 400
      throw new Error(`Error de validación: ${error.message}`);
    }
    
    if (response.status === 404) {
      throw new Error(`Recurso no encontrado: ${error.message}`);
    }
    
    throw new Error(`Error al crear ruta: ${error.message}`);
  }

  return response.json();
};

export const getRutaById = async (
  idRuta: number,
  token: string
): Promise<Ruta> => {
  const response = await fetch(`${API_URL}/rutas/${idRuta}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    
    if (response.status === 403) {
      throw new Error('No tiene permiso para ver esta ruta');
    }
    
    if (response.status === 404) {
      throw new Error('Ruta no encontrada');
    }
    
    throw new Error(`Error al obtener la ruta: ${error.message}`);
  }

  return response.json();
};
```

### Ejemplo de componente React

```typescript
import React, { useState, useEffect } from 'react';
import { getRutas, createRuta } from './api/rutas';

const RutasPage: React.FC = () => {
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idEmpleadoFilter, setIdEmpleadoFilter] = useState<number | undefined>();
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchRutas = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getRutas(token!, idEmpleadoFilter);
        setRutas(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchRutas();
  }, [token, idEmpleadoFilter]);

  const handleCreateRuta = async (data: any) => {
    try {
      setError(null);
      const nuevaRuta = await createRuta(token!, data);
      // Actualizar lista o redirigir
      alert('Ruta creada exitosamente');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      
      // Mostrar error específico para pedidos duplicados
      if (errorMessage.includes('Pedidos duplicados')) {
        alert(`⚠️ ${errorMessage}\n\nPor favor, seleccione pedidos que no estén asignados a otras rutas.`);
      } else {
        alert(`Error: ${errorMessage}`);
      }
    }
  };

  if (loading) return <div>Cargando rutas...</div>;

  return (
    <div>
      <h1>Rutas</h1>
      
      {/* Filtro por empleado */}
      <div>
        <label>
          Filtrar por empleado:
          <input
            type="number"
            value={idEmpleadoFilter || ''}
            onChange={(e) => {
              const value = e.target.value;
              setIdEmpleadoFilter(value ? Number(value) : undefined);
            }}
            placeholder="ID de empleado"
          />
        </label>
      </div>

      {error && (
        <div style={{ color: 'red', padding: '10px', background: '#ffe6e6' }}>
          ⚠️ {error}
        </div>
      )}

      {rutas.length === 0 ? (
        <p>No hay rutas disponibles</p>
      ) : (
        <ul>
          {rutas.map(ruta => (
            <li key={ruta.idRuta}>
              <h3>{ruta.nombre || `Ruta #${ruta.idRuta}`}</h3>
              <p>Estado: {ruta.estado}</p>
              <p>Distancia: {ruta.distanciaKm} km</p>
              <p>Duración: {ruta.duracionMin} min</p>
              <p>Pedidos: {ruta.rutaPedidos.length}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RutasPage;
```

---

## Validaciones Importantes

1. **Pedidos Duplicados**: Un pedido NO puede estar asignado a múltiples rutas. El backend valida esto automáticamente antes de crear la ruta.

2. **Permisos de Conductor**: Los conductores solo pueden ver sus propias rutas asignadas. Si intentan filtrar por otro empleado, recibirán un error 403.

3. **Filtro por Empleado**: 
   - Admin y vendedor pueden filtrar por cualquier empleado
   - Conductores solo pueden filtrar por su propio ID

4. **Validación de Coordenadas**: Todos los pedidos deben tener coordenadas válidas antes de crear la ruta.

---

## Notas Adicionales

- El filtro `idEmpleado` es opcional. Si no se envía, se aplica el comportamiento por defecto según el rol del usuario.
- Los pedidos duplicados se detectan ANTES de crear la ruta, evitando inconsistencias en la base de datos.
- Los mensajes de error incluyen detalles específicos para facilitar la corrección en el frontend.
- La respuesta incluye `geometry` (GeoJSON) que puede usarse para dibujar la ruta en mapas.
- Los `rutaPedidos` vienen ordenados por `secuencia` (orden de entrega).

---

## Flujo Recomendado para Crear Ruta

1. **Validar en frontend** (opcional pero recomendado):
   - Verificar que los pedidos seleccionados no estén ya en otra ruta
   - Verificar que todos los pedidos tengan direcciones válidas

2. **Enviar petición al backend**:
   - El backend validará todo nuevamente
   - Si hay pedidos duplicados, retornará error 400 con detalles

3. **Manejar respuesta**:
   - Si es exitosa (201), mostrar la ruta creada
   - Si hay error 400 (duplicados), mostrar mensaje claro al usuario
   - Si hay error 404, verificar que el empleado/pedidos existan

---

## Ejemplo de Validación en Frontend (Opcional)

```typescript
// Verificar pedidos antes de crear ruta (opcional)
const verificarPedidosDisponibles = async (
  pedidoIds: number[],
  token: string
): Promise<{ disponibles: number[], duplicados: number[] }> => {
  // Obtener todas las rutas
  const rutas = await getRutas(token);
  
  // Extraer todos los pedidos ya asignados
  const pedidosAsignados = new Set<number>();
  rutas.forEach(ruta => {
    ruta.rutaPedidos.forEach(rp => {
      pedidosAsignados.add(rp.idPedido);
    });
  });
  
  // Separar disponibles de duplicados
  const disponibles: number[] = [];
  const duplicados: number[] = [];
  
  pedidoIds.forEach(id => {
    if (pedidosAsignados.has(id)) {
      duplicados.push(id);
    } else {
      disponibles.push(id);
    }
  });
  
  return { disponibles, duplicados };
};

// Uso
const { disponibles, duplicados } = await verificarPedidosDisponibles(
  [12, 15, 18],
  token
);

if (duplicados.length > 0) {
  alert(`Los pedidos ${duplicados.join(', ')} ya están asignados a otras rutas.`);
} else {
  // Proceder a crear la ruta
  await createRuta(token, { pedidoIds: disponibles, ...otrosDatos });
}
```

---

## Changelog

- **2025-01-XX**: Agregado filtro por `idEmpleado` en GET `/rutas`
- **2025-01-XX**: Agregada validación de pedidos duplicados en POST `/rutas`
- **2025-01-XX**: Mejorados mensajes de error con detalles específicos

