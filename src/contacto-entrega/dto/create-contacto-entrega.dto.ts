import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { AllowedCharacters } from '../../common/validators/allowed-characters.decorator';
import { InternationalPhone } from '../../common/validators/international-phone.decorator';
import { NoSqlInjection } from '../../common/validators/no-sql-injection.decorator';
import { NoRandomString } from '../../common/validators/no-random-string.decorator';
import { NoExcessiveRepetition } from '../../common/validators/no-excessive-repetition.decorator';

export class CreateContactoEntregaDto {
  @ApiProperty({
    description: 'Nombre del contacto de entrega',
    example: 'María',
    maxLength: 100
  })
  @IsString()
  @MaxLength(100)
  @AllowedCharacters()
  @NoSqlInjection()
  @NoRandomString()
  @NoExcessiveRepetition(3)
  nombre: string;

  @ApiProperty({
    description: 'Apellido del contacto de entrega',
    example: 'González',
    maxLength: 100
  })
  @IsString()
  @MaxLength(100)
  @AllowedCharacters()
  @NoSqlInjection()
  @NoRandomString()
  @NoExcessiveRepetition(3)
  apellido: string;

  @ApiProperty({
    description: 'Telefono del contacto en formato internacional (ejemplo: +50512345678). Tambien acepta 50512345678 por compatibilidad.',
    example: '+50512345678',
    maxLength: 20
  })
  @IsString()
  @MaxLength(20)
  @InternationalPhone()
  @NoSqlInjection()
  telefono: string;
}

