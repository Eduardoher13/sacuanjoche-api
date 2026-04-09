import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ClienteEstado } from '../../common/enums';
import { AllowedCharacters } from '../../common/validators/allowed-characters.decorator';
import { NoSqlInjection } from '../../common/validators/no-sql-injection.decorator';
import { NoRandomString } from '../../common/validators/no-random-string.decorator';
import { NoExcessiveRepetition } from '../../common/validators/no-excessive-repetition.decorator';
import { NicaraguanPhone } from '../../common/validators/nicaraguan-phone.decorator';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export class CreateClienteDto {
  @ApiProperty({
    description: 'Primer nombre del cliente',
    example: 'Juan',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @AllowedCharacters()
  @NoSqlInjection()
  @NoRandomString()
  @NoExcessiveRepetition(3)
  primerNombre: string;

  @ApiProperty({
    description: 'Segundo nombre del cliente',
    example: 'Carlos',
    required: false,
    maxLength: 100,
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @AllowedCharacters()
  @NoSqlInjection()
  @NoRandomString()
  @NoExcessiveRepetition(3)
  segundoNombre?: string;

  @ApiProperty({
    description: 'Primer apellido del cliente',
    example: 'Pérez',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @AllowedCharacters()
  @NoSqlInjection()
  @NoRandomString()
  @NoExcessiveRepetition(3)
  primerApellido: string;

  @ApiProperty({
    description: 'Segundo apellido del cliente',
    example: 'Lopez',
    required: false,
    maxLength: 100,
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @AllowedCharacters()
  @NoSqlInjection()
  @NoRandomString()
  @NoExcessiveRepetition(3)
  segundoApellido?: string;

  @ApiProperty({
    description:
      'Número de teléfono del cliente (formato: 505 seguido de 8 dígitos)',
    example: '50512345678',
    required: false,
    maxLength: 11,
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(11)
  @NicaraguanPhone()
  @NoSqlInjection()
  telefono?: string;

  @ApiProperty({
    description: 'Nombre de la empresa del cliente',
    example: 'Floristeria Centro',
    required: false,
    maxLength: 150,
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @AllowedCharacters()
  @NoSqlInjection()
  @NoRandomString()
  @NoExcessiveRepetition(3)
  nombreEmpresa?: string;

  @ApiProperty({
    description: 'Estado del cliente',
    example: ClienteEstado.ACTIVO,
    enum: ClienteEstado,
    default: ClienteEstado.ACTIVO,
    required: false,
  })
  @IsOptional()
  @IsEnum(ClienteEstado)
  estado?: ClienteEstado;
}
