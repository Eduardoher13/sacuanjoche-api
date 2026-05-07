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
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { FacturaService } from './factura.service';
import { CreateFacturaDto } from './dto/create-factura.dto';
import { UpdateFacturaDto } from './dto/update-factura.dto';
import { Factura } from './entities/factura.entity';
import { FindFacturasDto } from './dto/find-facturas.dto';
import { CrearFacturaDesdePedidoDto } from './dto/crear-factura-desde-pedido.dto';
import { CrearFacturaManualDto } from './dto/crear-factura-manual.dto';
import { Auth } from 'src/auth/decorators';
import { ValidRoles } from 'src/auth/interfaces';

@ApiTags('Facturas')
@ApiBearerAuth('JWT-auth')
@Controller('factura')
export class FacturaController {
  constructor(
    private readonly facturaService: FacturaService,
  ) {}

  @Post()
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({ summary: 'Crear una nueva factura' })
  @ApiResponse({
    status: 201,
    description: 'Factura creada exitosamente',
    type: Factura,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  create(@Body() createFacturaDto: CreateFacturaDto) {
    return this.facturaService.create(createFacturaDto);
  }

  @Post('manual')
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({ summary: 'Crear una factura manual sin pedido' })
  @ApiResponse({
    status: 201,
    description: 'Factura manual creada exitosamente',
    type: Factura,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  crearFacturaManual(@Body() crearFacturaManualDto: CrearFacturaManualDto) {
    return this.facturaService.crearFacturaManual(crearFacturaManualDto);
  }

  @Post('desde-pedido/:idPedido')
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({
    summary: 'Convertir un pedido pagado en factura',
    description:
      'Crea una factura automáticamente desde un pedido que esté pagado. Copia todos los montos y detalles del pedido a la factura.',
  })
  @ApiParam({ name: 'idPedido', description: 'ID del pedido a facturar', example: 1 })
  @ApiBody({
    type: CrearFacturaDesdePedidoDto,
    description: 'Datos del empleado que emite la factura',
  })
  @ApiResponse({
    status: 201,
    description: 'Factura creada exitosamente desde el pedido',
    type: Factura,
  })
  @ApiResponse({
    status: 400,
    description:
      'El pedido no está pagado, ya tiene factura, o no tiene detalles',
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido no encontrado',
  })
  crearFacturaDesdePedido(
    @Param('idPedido', ParseIntPipe) idPedido: number,
    @Body() crearFacturaDto: CrearFacturaDesdePedidoDto,
  ) {
    return this.facturaService.crearFacturaDesdePedido(
      idPedido,
      crearFacturaDto.idEmpleado,
    );
  }

  @Get()
  @Auth(ValidRoles.admin, ValidRoles.vendedor, ValidRoles.cliente)
  @ApiOperation({ summary: 'Obtener todas las facturas con paginación' })
  @ApiResponse({
    status: 200,
    description: 'Lista de facturas obtenida exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/Factura' },
        },
        total: { type: 'number', description: 'Total de registros' },
      },
    },
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description:
      'Texto a buscar en número, estado, pedido o nombre del empleado',
    example: 'FAC-2025-001',
  })
  findAll(@Query() filters: FindFacturasDto) {
    return this.facturaService.findAll(filters);
  }

  @Get(':id')
  @Auth(ValidRoles.admin, ValidRoles.vendedor, ValidRoles.cliente)
  @ApiOperation({ summary: 'Obtener una factura por ID' })
  @ApiParam({ name: 'id', description: 'ID de la factura', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Factura encontrada exitosamente',
    type: Factura,
  })
  @ApiResponse({
    status: 404,
    description: 'Factura no encontrada',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.facturaService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({ summary: 'Actualizar una factura' })
  @ApiParam({ name: 'id', description: 'ID de la factura', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Factura actualizada exitosamente',
    type: Factura,
  })
  @ApiResponse({
    status: 404,
    description: 'Factura no encontrada',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFacturaDto: UpdateFacturaDto,
  ) {
    return this.facturaService.update(id, updateFacturaDto);
  }

  @Delete(':id')
  @Auth(ValidRoles.admin)
  @ApiOperation({ summary: 'Eliminar una factura' })
  @ApiParam({ name: 'id', description: 'ID de la factura', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Factura eliminada exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Factura no encontrada',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.facturaService.remove(id);
  }
}
