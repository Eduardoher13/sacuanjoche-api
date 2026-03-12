import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateDireccionDto {
  @ApiProperty({
    description: 'Dirección formateada completa',
    example: '123 Main St, New York, NY 10001, USA',
    required: false,
  })
  @IsOptional()
  @IsString()
  // Sin validaciones personalizadas - se rellena automáticamente desde Google Maps
  formattedAddress: string;

  @ApiProperty({
    description: 'País',
    example: 'USA',
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  // Sin validaciones personalizadas - se rellena automáticamente desde Google Maps
  country: string;

  @ApiProperty({
    description: 'Estado o provincia',
    example: 'New York',
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  // Sin validaciones personalizadas - se rellena automáticamente desde Google Maps
  stateProv: string;

  @ApiProperty({
    description: 'Ciudad',
    example: 'New York',
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  // Sin validaciones personalizadas - se rellena automáticamente desde Google Maps
  city: string;

  @ApiProperty({
    description: 'Barrio o colonia',
    example: 'Manhattan',
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  // Sin validaciones personalizadas - se rellena automáticamente desde Google Maps
  neighborhood?: string;

  @ApiProperty({
    description: 'Calle',
    example: 'Main Street',
    maxLength: 200,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  // Sin validaciones personalizadas - se rellena automáticamente desde Google Maps
  street: string;

  @ApiProperty({
    description: 'Número de casa',
    example: '123',
    maxLength: 20,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  // Sin validaciones personalizadas - se rellena automáticamente desde Google Maps
  houseNumber: string;

  @ApiProperty({
    description: 'Código postal',
    example: '10001',
    maxLength: 20,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  // Sin validaciones personalizadas - se rellena automáticamente desde Google Maps
  postalCode: string;

  @ApiProperty({
    description: 'Referencia adicional',
    example: 'Cerca del parque central',
    required: false,
  })
  @IsOptional()
  @IsString()
  // Sin validaciones personalizadas - campo opcional de referencia
  referencia?: string;

  @ApiProperty({
    description: 'Latitud',
    example: 40.7128,
  })
  @Type(() => Number)
  @IsNumber()
  lat: number;

  @ApiProperty({
    description: 'Longitud',
    example: -74.006,
  })
  @Type(() => Number)
  @IsNumber()
  lng: number;

  @ApiProperty({
    description: 'Proveedor de geocodificación',
    example: 'Google Maps',
    maxLength: 50,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  // Sin validaciones personalizadas - se rellena automáticamente desde Google Maps
  provider: string;

  @ApiProperty({
    description: 'ID del lugar en el proveedor',
    example: 'ChIJd8BlQ2BZwokRAFUEcm_qrcA',
    maxLength: 200,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  // Sin validaciones personalizadas - se rellena automáticamente desde Google Maps
  placeId?: string;

  @ApiProperty({
    description: 'Precisión de la geocodificación',
    example: 'ROOFTOP',
    maxLength: 50,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  // Sin validaciones personalizadas - se rellena automáticamente desde Google Maps
  accuracy?: string;

  @ApiProperty({
    description: 'Datos de geolocalización adicionales',
    example: '{"accuracy": 10, "timestamp": 1640995200000}',
    required: false,
  })
  @IsOptional()
  @IsString()
  // Sin validaciones personalizadas - se rellena automáticamente desde Google Maps
  geolocation?: string;

  @ApiProperty({
    description: 'Estado activo de la dirección',
    example: true,
    default: true,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activo?: boolean;
}
