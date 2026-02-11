import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { CreateArregloDto } from './create-arreglo.dto';
import { CreateArregloMediaSimpleDto } from './create-arreglo-media-simple.dto';

export class CreateArregloWithMediaDto extends CreateArregloDto {
  @ApiProperty({
    description: 'Lista de imágenes asociadas',
    type: [CreateArregloMediaSimpleDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateArregloMediaSimpleDto)
  imagenes?: CreateArregloMediaSimpleDto[];
}

export class CreateArregloWithMediaBatchDto {
  @ApiProperty({
    description: 'Lista de arreglos a crear en lote',
    type: [CreateArregloWithMediaDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateArregloWithMediaDto)
  arreglos: CreateArregloWithMediaDto[];
}
