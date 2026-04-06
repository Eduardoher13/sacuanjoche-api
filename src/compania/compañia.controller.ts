import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Auth } from 'src/auth/decorators';
import { ValidRoles } from 'src/auth/interfaces';
import { CompaniaService } from './compañia.service';
import { CreateCompaniaDto } from './dto/create-compañia.dto';
import { FindCompañiasDto } from './dto/find-compañias.dto';
import { UpdateCompaniaDto } from './dto/update-compañia.dto';
import { Compania } from './entities/compañia.entity';

@ApiTags('Compañias')
@ApiBearerAuth('JWT-auth')
@Controller('compania')
export class CompaniaController {
  constructor(private readonly companiaService: CompaniaService) {}

  @Post()
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({ summary: 'Crear una nueva compania' })
  @ApiResponse({
    status: 201,
    description: 'Compania creada exitosamente',
    type: Compania,
  })
  create(@Body() createCompaniaDto: CreateCompaniaDto) {
    return this.companiaService.create(createCompaniaDto);
  }

  @Get()
  @Auth(ValidRoles.admin, ValidRoles.vendedor, ValidRoles.cliente)
  @ApiOperation({ summary: 'Obtener compañias con paginacion' })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Texto a buscar en nombre, nombre comercial o RUC',
    example: 'El Sol',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de compañias obtenida exitosamente',
    type: [Compania],
  })
  findAll(@Query() filters: FindCompañiasDto) {
    return this.companiaService.findAll(filters);
  }

  @Get(':id')
  @Auth(ValidRoles.admin, ValidRoles.vendedor, ValidRoles.cliente)
  @ApiOperation({ summary: 'Obtener una compania por ID' })
  @ApiParam({ name: 'id', description: 'ID de la compania', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Compania encontrada exitosamente',
    type: Compania,
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companiaService.findOne(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({ summary: 'Actualizar una compania' })
  @ApiParam({ name: 'id', description: 'ID de la compania', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Compania actualizada exitosamente',
    type: Compania,
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCompaniaDto: UpdateCompaniaDto,
  ) {
    return this.companiaService.update(id, updateCompaniaDto);
  }

  @Delete(':id')
  @Auth(ValidRoles.admin)
  @ApiOperation({ summary: 'Eliminar una compania' })
  @ApiParam({ name: 'id', description: 'ID de la compania', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Compania eliminada exitosamente',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.companiaService.remove(id);
  }
}
