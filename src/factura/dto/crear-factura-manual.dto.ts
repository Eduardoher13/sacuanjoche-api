import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { FacturaEstado } from '../../common/enums';

export class CrearFacturaManualDto {
  @ApiProperty({
    description: 'ID del empleado que emite la factura',
    example: 1,
    type: Number,
  })
  @IsNumber({}, { message: 'El idEmpleado debe ser un número' })
  @Type(() => Number)
  idEmpleado: number;

  @ApiProperty({
    description: 'Monto total de la factura manual',
    example: 150.0,
    type: Number,
  })
  @IsNumber({}, { message: 'El montoTotal debe ser un número' })
  @Type(() => Number)
  montoTotal: number;

  @ApiPropertyOptional({
    description: 'Estado inicial de la factura',
    example: FacturaEstado.PENDIENTE,
    enum: FacturaEstado,
    default: FacturaEstado.PENDIENTE,
  })
  @IsOptional()
  @IsEnum(FacturaEstado, {
    message: 'El estado debe ser un estado válido de factura',
  })
  estado?: FacturaEstado;
}