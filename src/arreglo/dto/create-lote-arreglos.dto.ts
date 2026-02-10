import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ValidateNested,
  IsOptional,
  IsString,
  MaxLength,
  IsBoolean,
  IsInt,
  Min,
  IsUrl,
} from 'class-validator';
import { CreateArregloDto } from './create-arreglo.dto';

export class CreateLoteArregloMediaDto {
  @ApiProperty({ description: 'Texto alternativo', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  altText?: string;

  @ApiProperty({ description: 'Marcar como principal', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiProperty({ description: 'Orden dentro de la galería', required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}

export class CreateLoteArregloItemDto extends CreateArregloDto {
  @ApiProperty({ description: 'URL externa opcional de la imagen', required: false })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty({ description: 'Metadatos de la imagen asociada', required: false, type: CreateLoteArregloMediaDto })
  @IsOptional()
  @Type(() => CreateLoteArregloMediaDto)
  @ValidateNested()
  media?: CreateLoteArregloMediaDto;
}

export class CreateLoteArreglosDto {
  @ApiProperty({ description: 'Array de arreglos a crear (emparejado por índice con images[])', type: [CreateLoteArregloItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLoteArregloItemDto)
  items: CreateLoteArregloItemDto[];
}
