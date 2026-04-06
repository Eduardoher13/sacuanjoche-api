import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AllowedCharacters } from '../../common/validators/allowed-characters.decorator';
import { NoSqlInjection } from '../../common/validators/no-sql-injection.decorator';
import { NoRandomString } from '../../common/validators/no-random-string.decorator';
import { NoExcessiveRepetition } from '../../common/validators/no-excessive-repetition.decorator';

export class CreateCompaniaDto {
  @ApiProperty({
    description: 'Nombre legal de la compania',
    example: 'Distribuidora El Sol S.A.',
    maxLength: 150,
  })
  @IsString()
  @MaxLength(150)
  @AllowedCharacters()
  @NoSqlInjection()
  @NoRandomString()
  @NoExcessiveRepetition(4)
  nombre: string;

  @ApiProperty({
    description: 'Nombre comercial de la compania',
    example: 'El Sol',
    required: false,
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @AllowedCharacters()
  @NoSqlInjection()
  @NoRandomString()
  @NoExcessiveRepetition(4)
  nombreComercial?: string;

  @ApiProperty({
    description: 'RUC o identificacion fiscal',
    example: 'J0310000000001',
    required: false,
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @NoSqlInjection()
  ruc?: string;

  @ApiProperty({
    description: 'Correo principal de contacto',
    example: 'contacto@elsol.com',
    required: false,
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @NoSqlInjection()
  correo?: string;

  @ApiProperty({
    description: 'Telefono principal de la compania',
    example: '50512345678',
    required: false,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @NoSqlInjection()
  telefono?: string;

  @ApiProperty({
    description: 'Direccion de la compania',
    example: 'Managua, Nicaragua',
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @AllowedCharacters()
  @NoSqlInjection()
  @NoExcessiveRepetition(4)
  direccion?: string;

  @ApiProperty({
    description: 'Sitio web de la compania',
    example: 'https://www.elsol.com',
    required: false,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @NoSqlInjection()
  sitioWeb?: string;

  @ApiProperty({
    description: 'Observaciones adicionales',
    example: 'Cliente corporativo con compras frecuentes',
    required: false,
  })
  @IsOptional()
  @IsString()
  @NoSqlInjection()
  @NoExcessiveRepetition(6)
  observaciones?: string;
}
