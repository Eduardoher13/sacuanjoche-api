import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RutaService } from './ruta.service';
import { CreateRutaDto } from './dto/create-ruta.dto';
import { Ruta } from './entities/ruta.entity';
import { Auth, GetUser } from 'src/auth/decorators';
import { ValidRoles } from 'src/auth/interfaces';
import { User } from 'src/auth/entities/user.entity';

@ApiTags('Rutas')
@ApiBearerAuth('JWT-auth')
@Controller('rutas')
export class RutaController {
  constructor(private readonly rutaService: RutaService) {}

  @Post()
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({ summary: 'Generar una ruta optimizada con Mapbox' })
  @ApiBody({
    description:
      'Lista de pedidos que se optimizarán junto al empleado y parámetros opcionales.',
    schema: {
      type: 'object',
      properties: {
        nombre: {
          type: 'string',
          example: 'Ruta matutina',
          description: 'Alias amigable para identificar la ruta.',
        },
        idEmpleado: {
          type: 'number',
          example: 3,
          description: 'Identificador del repartidor asignado.',
        },
        pedidoIds: {
          type: 'array',
          description:
            'Pedidos que se incluirán en la optimización (mínimo 1).',
          items: { type: 'number', example: 12 },
          example: [12, 15, 18],
        },
        fechaProgramada: {
          type: 'string',
          format: 'date-time',
          nullable: true,
          example: '2025-11-12T14:00:00.000Z',
          description: 'Fecha y hora programada para iniciar la ruta.',
        },
        profile: {
          type: 'string',
          nullable: true,
          example: 'driving',
          description:
            'Perfil de viaje Mapbox (driving, driving-traffic, walking, cycling).',
        },
        origenLat: {
          type: 'number',
          nullable: true,
          example: 12.136389,
          description:
            'Latitud de origen si se desea sobrescribir la configurada por defecto.',
        },
        origenLng: {
          type: 'number',
          nullable: true,
          example: -86.251389,
          description:
            'Longitud de origen si se desea sobrescribir la configurada por defecto.',
        },
        roundTrip: {
          type: 'boolean',
          nullable: true,
          example: false,
          description: 'Indica si la ruta debe regresar al punto de origen.',
        },
      },
      required: ['pedidoIds'],
    },
  })
  @ApiResponse({ status: 201, description: 'Ruta creada', type: Ruta })
  @ApiResponse({
    status: 400,
    description: 'Parámetros inválidos o pedidos sin coordenadas',
  })
  create(@Body() createRutaDto: CreateRutaDto) {
    return this.rutaService.create(createRutaDto);
  }

  @Get()
  @Auth(ValidRoles.admin, ValidRoles.vendedor, ValidRoles.conductor)
  @ApiOperation({ summary: 'Listar rutas optimizadas' })
  @ApiResponse({
    status: 200,
    description: 'Listado de rutas',
    schema: {
      type: 'array',
      items: { $ref: '#/components/schemas/Ruta' },
      example: [
        {
          idRuta: 1,
          nombre: 'Ruta matutina',
          estado: 'pendiente',
          distanciaKm: 12.4,
          duracionMin: 38.5,
          profile: 'driving',
          origenLat: 12.136389,
          origenLng: -86.251389,
          rutaPedidos: [
            {
              idRutaPedido: 5,
              idPedido: 12,
              secuencia: 1,
              distanciaKm: 4.1,
              duracionMin: 10.2,
              lat: 12.1301,
              lng: -86.251,
              direccionResumen: 'Pedido 12 - Las Flores 123',
            },
          ],
        },
      ],
    },
  })
  findAll(@GetUser() user: User) {
    return this.rutaService.findAll(user);
  }

  @Get(':idRuta')
  @Auth(ValidRoles.admin, ValidRoles.vendedor, ValidRoles.conductor)
  @ApiOperation({ summary: 'Obtener detalle de una ruta' })
  @ApiParam({
    name: 'idRuta',
    type: Number,
    description: 'Identificador de la ruta',
    example: 1,
  })
  @ApiResponse({ status: 200, description: 'Ruta encontrada', type: Ruta })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  @ApiResponse({ status: 403, description: 'No tiene permiso para ver esta ruta' })
  findOne(
    @Param('idRuta', ParseIntPipe) idRuta: number,
    @GetUser() user: User,
  ) {
    return this.rutaService.findOne(idRuta, user);
  }
}
