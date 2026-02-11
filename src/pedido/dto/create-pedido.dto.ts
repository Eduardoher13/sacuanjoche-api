import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsDecimal,
  Min,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PedidoCanal } from '../../common/enums';
import { AllowedCharacters } from '../../common/validators/allowed-characters.decorator';
import { NoSqlInjection } from '../../common/validators/no-sql-injection.decorator';
import { NoRandomAddress } from '../../common/validators/no-random-address.decorator';
import { NoExcessiveRepetition } from '../../common/validators/no-excessive-repetition.decorator';
import { IsDateOnly } from '../../common/validators/is-date-only.decorator';

export class CreatePedidoDto {
  @ApiProperty({
    description:
      'Canal de venta: "web" (landing page) o "interno" (tienda física). Por defecto: "web"',
    example: PedidoCanal.WEB,
    enum: PedidoCanal,
    default: PedidoCanal.WEB,
    required: false,
  })
  @IsOptional()
  @IsEnum(PedidoCanal, { message: 'El canal debe ser "web" o "interno"' })
  canal?: PedidoCanal;

  @ApiProperty({
    description:
      'ID del pago completado (requerido para canal "web", opcional para "interno")',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID del pago debe ser un número' })
  idPago?: number;

  @ApiProperty({
    description: 'ID del empleado que maneja el pedido',
    example: 1,
  })
  @IsNotEmpty({ message: 'El ID del empleado es requerido' })
  @IsNumber({}, { message: 'El ID del empleado debe ser un número' })
  idEmpleado: number;

  @ApiProperty({
    description: 'ID del cliente que realiza el pedido',
    example: 1,
  })
  @IsNotEmpty({ message: 'El ID del cliente es requerido' })
  @IsNumber({}, { message: 'El ID del cliente debe ser un número' })
  idCliente: number;

  @ApiProperty({
    description: 'ID de la dirección de entrega',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID de la dirección debe ser un número' })
  idDireccion?: number | null; // Permitir null para casos sin mapa

  @ApiProperty({
    description: 'ID del folio',
    example: 1,
  })
  @IsNotEmpty({ message: 'El ID del folio es requerido' })
  @IsNumber({}, { message: 'El ID del folio debe ser un número' })
  idFolio: number;

  @ApiProperty({
    description: 'ID del contacto de entrega',
    example: 1,
  })
  @IsNotEmpty({ message: 'El ID del contacto de entrega es requerido' })
  @IsNumber({}, { message: 'El ID del contacto de entrega debe ser un número' })
  idContactoEntrega: number;

  // @ApiProperty({
  //   description: 'Total de productos en el pedido',
  //   example: 150.50,
  // })
  // @IsNotEmpty({ message: 'El total de productos es requerido' })
  // @IsNumber({}, { message: 'El total de productos debe ser un número' })
  // @Min(0, { message: 'El total de productos debe ser mayor o igual a 0' })
  // totalProductos: number;

  @ApiProperty({
    description:
      'Fecha estimada de entrega (formato: YYYY-MM-DD o ISO con hora)',
    example: '2024-12-25T14:30:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        'La fecha de entrega estimada debe ser una fecha válida (formato ISO 8601)',
    },
  )
  fechaEntregaEstimada?: string;

  @ApiProperty({
    description: 'Dirección de entrega en texto',
    example: 'Calle 123 #45-67, Barrio Centro, Ciudad',
  })
  @IsNotEmpty({ message: 'La dirección de entrega es requerida' })
  @IsString({ message: 'La dirección de entrega debe ser un texto' })
  @AllowedCharacters()
  @NoSqlInjection()
  @NoRandomAddress()
  @NoExcessiveRepetition(4)
  direccionTxt: string;

  @ApiProperty({
    description: 'Mensaje/carta para el arreglo (opcional, máx 256 caracteres)',
    example: 'Feliz cumpleaños, con mucho cariño. Te queremos.',
    maxLength: 256,
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El mensaje del pedido debe ser un texto' })
  @MaxLength(256, {
    message: 'El mensaje del pedido no puede exceder 256 caracteres',
  })
  @NoExcessiveRepetition(6)
  mensajePedido?: string;

  // @ApiProperty({
  //   description: 'Costo de envío del pedido',
  //   example: 25.00,
  // })
  // @IsNotEmpty({ message: 'El costo de envío es requerido' })
  // @IsNumber({}, { message: 'El costo de envío debe ser un número' })
  // @Min(0, { message: 'El costo de envío debe ser mayor o igual a 0' })
  // costoEnvio: number;

  // @ApiProperty({
  //   description: 'Total del pedido (productos + envío)',
  //   example: 175.50,
  // })
  // @IsNotEmpty({ message: 'El total del pedido es requerido' })
  // @IsNumber({}, { message: 'El total del pedido debe ser un número' })
  // @Min(0, { message: 'El total del pedido debe ser mayor o igual a 0' })
  // totalPedido: number;
}
