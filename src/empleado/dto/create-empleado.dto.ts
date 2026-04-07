import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDateString, IsEnum, MaxLength, IsOptional } from 'class-validator';
import { EmpleadoEstado } from '../../common/enums';
import { AllowedCharacters } from '../../common/validators/allowed-characters.decorator';
import { InternationalPhone } from '../../common/validators/international-phone.decorator';
import { NoSqlInjection } from '../../common/validators/no-sql-injection.decorator';
import { NoRandomString } from '../../common/validators/no-random-string.decorator';
import { NoExcessiveRepetition } from '../../common/validators/no-excessive-repetition.decorator';

export class CreateEmpleadoDto {
  @ApiProperty({
    description: 'Primer nombre del empleado',
    example: 'Juan',
    maxLength: 100
  })
  @IsString()
  @MaxLength(100)
  @AllowedCharacters()
  @NoSqlInjection()
  @NoRandomString()
  @NoExcessiveRepetition(3)
  primerNombre: string;

  @ApiProperty({
    description: 'Segundo nombre del empleado',
    example: 'Pedro',
    maxLength: 100
  })
  @IsString()
  @MaxLength(100)
  @AllowedCharacters()
  @NoSqlInjection()
  @NoRandomString()
  @NoExcessiveRepetition(3)
  segundoNombre: string;

  @ApiProperty({
    description: 'Primer apellido del empleado',
    example: 'Pérez',
    maxLength: 100
  })
  @IsString()
  @MaxLength(100)
  @AllowedCharacters()
  @NoSqlInjection()
  @NoRandomString()
  @NoExcessiveRepetition(3)
  primerApellido: string;

  @ApiProperty({
    description: 'Segundo apellido del empleado',
    example: 'González',
    maxLength: 100,
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @AllowedCharacters()
  @NoSqlInjection()
  @NoRandomString()
  @NoExcessiveRepetition(3)
  segundoApellido?: string;

  @ApiProperty({
    description: 'Sexo del empleado',
    example: 'M',
    maxLength: 10
  })
  @IsString()
  @MaxLength(10)
  @AllowedCharacters()
  @NoSqlInjection()
  sexo: string;

  @ApiProperty({
    description: 'Telefono del empleado en formato internacional (ejemplo: +50512345678). Tambien acepta 50512345678 por compatibilidad.',
    example: '+50512345678',
    maxLength: 20
  })
  @IsString()
  @MaxLength(20)
  @InternationalPhone()
  @NoSqlInjection()
  telefono: string;

  @ApiProperty({
    description: 'Fecha de nacimiento del empleado',
    example: '1990-01-15'
  })
  @IsDateString()
  fechaNac: string;

  @ApiProperty({
    description: 'Estado del empleado',
    example: EmpleadoEstado.ACTIVO,
    enum: EmpleadoEstado,
    default: EmpleadoEstado.ACTIVO,
    required: false
  })
  @IsOptional()
  @IsEnum(EmpleadoEstado)
  estado?: EmpleadoEstado;
}


