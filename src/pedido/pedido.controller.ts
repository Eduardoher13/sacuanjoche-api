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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PedidoService } from './pedido.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { Pedido } from './entities/pedido.entity';
import { FindPedidosDto } from './dto/find-pedidos.dto';
import { Auth } from 'src/auth/decorators';
import { ValidRoles } from 'src/auth/interfaces';

@ApiTags('Pedidos')
@ApiBearerAuth('JWT-auth')
@Controller('pedido')
export class PedidoController {
  constructor(private readonly pedidoService: PedidoService) {}

  @Post()
  @Auth(ValidRoles.admin, ValidRoles.vendedor, ValidRoles.cliente)
  @ApiOperation({ summary: 'Crear un nuevo pedido' })
  @ApiResponse({
    status: 201,
    description: 'Pedido creado exitosamente',
    type: Pedido,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  create(@Body() createPedidoDto: CreatePedidoDto) {
    return this.pedidoService.create(createPedidoDto);
  }

  @Get()
  @Auth(
    ValidRoles.admin,
    ValidRoles.vendedor,
    ValidRoles.conductor,
    ValidRoles.cliente,
  )
  @ApiOperation({ summary: 'Obtener todos los pedidos con paginación' })
  @ApiQuery({
    name: 'q',
    required: false,
    description:
      'Texto a buscar en dirección, cliente, empleado o contacto de entrega',
    example: 'Juan',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de pedidos obtenida exitosamente',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/Pedido' },
        },
        total: { type: 'number', description: 'Total de registros' },
      },
    },
  })
  findAll(@Query() filters: FindPedidosDto) {
    return this.pedidoService.findAll(filters);
  }

  @Get(':id')
  @Auth(
    ValidRoles.admin,
    ValidRoles.vendedor,
    ValidRoles.conductor,
    ValidRoles.cliente,
  )
  @ApiOperation({ summary: 'Obtener un pedido por ID' })
  @ApiParam({ name: 'id', description: 'ID del pedido', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Pedido encontrado exitosamente',
    type: Pedido,
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido no encontrado',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pedidoService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({ summary: 'Actualizar un pedido' })
  @ApiParam({ name: 'id', description: 'ID del pedido', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Pedido actualizado exitosamente',
    type: Pedido,
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido no encontrado',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePedidoDto: UpdatePedidoDto,
  ) {
    return this.pedidoService.update(id, updatePedidoDto);
  }

  @Delete(':id')
  @Auth(ValidRoles.admin, ValidRoles.superuser)
  @ApiOperation({ summary: 'Eliminar un pedido' })
  @ApiParam({ name: 'id', description: 'ID del pedido', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Pedido eliminado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido no encontrado',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pedidoService.remove(id);
  }

  @Post(':id/asociar-pago')
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({
    summary: 'Asociar un pago a un pedido existente (útil para canal interno)',
    description:
      'Permite asociar un pago a un pedido que fue creado sin pago. Útil cuando el empleado crea el pedido primero y luego procesa el pago.',
  })
  @ApiParam({ name: 'id', description: 'ID del pedido', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Pago asociado exitosamente al pedido',
    type: Pedido,
  })
  @ApiResponse({
    status: 400,
    description: 'El pago o pedido ya está asociado, o los montos no coinciden',
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido o pago no encontrado',
  })
  asociarPago(
    @Param('id', ParseIntPipe) id: number,
    @Body('idPago', ParseIntPipe) idPago: number,
  ) {
    return this.pedidoService.asociarPago(id, idPago);
  }
}
