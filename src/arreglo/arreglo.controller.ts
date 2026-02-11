import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  BadRequestException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ArregloService } from './arreglo.service';
import { CreateArregloDto } from './dto/create-arreglo.dto';
import { UpdateArregloDto } from './dto/update-arreglo.dto';
import { Arreglo } from './entities/arreglo.entity';
import { FindArreglosDto } from './dto/find-arreglos.dto';
import { FindArreglosPublicDto } from './dto/find-arreglos-public.dto';
import { ArregloPublicResponseDto } from './dto/arreglo-public-response.dto';
import { Auth } from 'src/auth/decorators';
import { ValidRoles } from 'src/auth/interfaces';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreateLoteArreglosDto } from './dto/create-lote-arreglos.dto';
import { CreateArregloWithMediaBatchDto } from './dto/create-arreglo-batch.dto';

@ApiTags('Arreglos')
@ApiBearerAuth('JWT-auth')
@Controller('arreglos')
export class ArregloController {
  constructor(private readonly arregloService: ArregloService) {}

  @Post()
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({ summary: 'Crear un nuevo arreglo floral' })
  @ApiResponse({
    status: 201,
    description: 'Arreglo creado exitosamente',
    type: Arreglo,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  create(@Body() createArregloDto: CreateArregloDto) {
    return this.arregloService.create(createArregloDto);
  }

  @Post('batch')
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({
    summary:
      'Crear arreglos por lote (incluyendo flores, accesorios e imágenes)',
  })
  @ApiBody({
    type: CreateArregloWithMediaBatchDto,
    examples: {
      ejemploCompleto: {
        summary: 'Lote con 2 arreglos completos',
        description:
          'Ejemplo de creación de múltiples arreglos con sus flores, accesorios e imágenes externas.',
        value: {
          arreglos: [
            {
              idFormaArreglo: 1,
              nombre: 'Ramo de Rosas Clásico',
              descripcion:
                'Un hermoso ramo de 12 rosas rojas ideal para San Valentín.',
              precioUnitario: 550.0,
              estado: 'activo',
              flores: [
                { idFlor: 1, cantidad: 12 },
                { idFlor: 3, cantidad: 5 },
              ],
              accesorios: [{ idAccesorio: 1, cantidad: 1 }],
              imagenes: [
                {
                  url: 'https://midominio.supabase.co/storage/v1/object/public/bucket/rosas-principal.jpg',
                  isPrimary: true,
                  orden: 1,
                  altText: 'Vista frontal del ramo',
                },
                {
                  url: 'https://midominio.supabase.co/storage/v1/object/public/bucket/rosas-detalle.jpg',
                  isPrimary: false,
                  orden: 2,
                },
              ],
            },
            {
              idFormaArreglo: 2,
              nombre: 'Centro de Mesa Girasoles',
              descripcion: 'Centro de mesa brillante con girasoles frescos.',
              precioUnitario: 320.5,
              flores: [{ idFlor: 5, cantidad: 6 }],
              imagenes: [
                {
                  url: 'https://midominio.supabase.co/storage/v1/object/public/bucket/girasoles.jpg',
                  isPrimary: true,
                },
              ],
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Lote creado exitosamente' })
  @ApiBadRequestResponse({
    description: 'Datos inválidos en alguno de los arreglos',
  })
  async createBatch(@Body() batchDto: CreateArregloWithMediaBatchDto) {
    return this.arregloService.createBatch(batchDto.arreglos);
  }

  @Get()
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({ summary: 'Listar arreglos (admin) con filtros' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Número de elementos por página',
    example: 10,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Número de elementos a omitir',
    example: 0,
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Texto a buscar en el nombre, descripción o forma del arreglo',
    example: 'Bouquet',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de arreglos obtenida exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/Arreglo' },
        },
        total: { type: 'number', description: 'Total de registros' },
      },
    },
  })
  findAll(@Query() filters: FindArreglosDto) {
    return this.arregloService.findAll(filters);
  }

  @Get('public')
  @ApiOperation({
    summary: 'Catálogo público con filtros avanzados (sin autenticación)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Número de elementos por página',
    example: 10,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Número de elementos a omitir',
    example: 0,
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Texto a buscar',
    example: 'Bouquet',
  })
  @ApiQuery({
    name: 'idFormaArreglo',
    required: false,
    description: 'Filtrar por forma de arreglo',
    example: 1,
  })
  @ApiQuery({
    name: 'precioMin',
    required: false,
    description: 'Precio mínimo',
    example: 50.0,
  })
  @ApiQuery({
    name: 'precioMax',
    required: false,
    description: 'Precio máximo',
    example: 200.0,
  })
  @ApiQuery({
    name: 'flores',
    required: false,
    description: 'IDs de flores (separados por coma)',
    example: '1,2,3',
  })
  @ApiQuery({
    name: 'ordenarPor',
    required: false,
    description: 'Campo para ordenar',
    enum: ['nombre', 'precio', 'fechaCreacion'],
  })
  @ApiQuery({
    name: 'orden',
    required: false,
    description: 'Dirección del orden',
    enum: ['ASC', 'DESC'],
  })
  @ApiResponse({
    status: 200,
    description: 'Catálogo público obtenido exitosamente',
    type: [ArregloPublicResponseDto],
  })
  findPublic(@Query() filters: any) {
    // Transformar flores de string a array si viene como string
    // Los query params pueden venir como string aunque el DTO espere number[]
    if (filters.flores) {
      if (typeof filters.flores === 'string') {
        filters.flores = filters.flores
          .split(',')
          .map((id: string) => parseInt(id, 10))
          .filter((id) => !isNaN(id) && id > 0);
      } else if (Array.isArray(filters.flores)) {
        // Asegurar que todos los valores sean números válidos
        filters.flores = filters.flores
          .map((id: any) => (typeof id === 'string' ? parseInt(id, 10) : id))
          .filter((id: any) => typeof id === 'number' && !isNaN(id) && id > 0);
      }
    }
    // Validar y convertir el objeto a FindArreglosPublicDto
    // Usar 'as' para indicar que ya transformamos los tipos
    return this.arregloService.findPublic(filters as FindArreglosPublicDto);
  }

  @Get(':id')
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({ summary: 'Obtener un arreglo por ID' })
  @ApiParam({ name: 'id', description: 'ID del arreglo', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Arreglo encontrado exitosamente',
    type: Arreglo,
  })
  @ApiResponse({
    status: 404,
    description: 'Arreglo no encontrado',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.arregloService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({ summary: 'Actualizar un arreglo' })
  @ApiParam({ name: 'id', description: 'ID del arreglo', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Arreglo actualizado exitosamente',
    type: Arreglo,
  })
  @ApiResponse({
    status: 404,
    description: 'Arreglo no encontrado',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateArregloDto: UpdateArregloDto,
  ) {
    return this.arregloService.update(id, updateArregloDto);
  }

  @Delete(':id')
  @Auth(ValidRoles.admin)
  @ApiOperation({ summary: 'Eliminar un arreglo' })
  @ApiParam({ name: 'id', description: 'ID del arreglo', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Arreglo eliminado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Arreglo no encontrado',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.arregloService.remove(id);
  }
}
