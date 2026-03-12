import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Direccion } from './entities/direccion.entity';
import { CreateDireccionDto } from './dto/create-direccion.dto';
import { UpdateDireccionDto } from './dto/update-direccion.dto';
import { handleDbException } from 'src/common/helpers/db-exception.helper';
import { FindDireccionesDto } from './dto/find-direcciones.dto';
import { GoogleMapsService } from 'src/common/google-maps/google-maps.service';

@Injectable()
export class DireccionService {
  constructor(
    @InjectRepository(Direccion)
    private readonly direccionRepository: Repository<Direccion>,
    private readonly googleMapsService: GoogleMapsService,
  ) {}

  async create(createDireccionDto: CreateDireccionDto) {
    try {
      const direccionData = {
        ...createDireccionDto,
      } as CreateDireccionDto & { adminArea?: string };

      const hasCoordinates =
        Number.isFinite(direccionData.lat) &&
        Number.isFinite(direccionData.lng);

      // Verificar si ya existe una dirección con las mismas coordenadas
      // Si existe, retornar el registro existente
      if (hasCoordinates) {
        const existingDireccion = await this.direccionRepository.findOne({
          where: {
            lat: direccionData.lat,
            lng: direccionData.lng,
          },
        });

        if (existingDireccion) {
          return { ...existingDireccion };
        }
      }

      const fieldsToAutofill: Array<keyof CreateDireccionDto> = [
        'formattedAddress',
        'country',
        'stateProv',
        'city',
        'neighborhood',
        'street',
        'houseNumber',
        'postalCode',
        'placeId',
        'accuracy',
      ];

      const needsAutofill = fieldsToAutofill.some((field) => {
        const value = direccionData[field];
        return (
          value === undefined ||
          value === null ||
          (typeof value === 'string' && value.trim().length === 0)
        );
      });

      if (hasCoordinates && needsAutofill) {
        const reverseResult = await this.googleMapsService.reverseGeocode({
          lat: direccionData.lat,
          lng: direccionData.lng,
        });

        if (reverseResult) {
          direccionData.formattedAddress ??= reverseResult.formattedAddress;
          direccionData.country ??= reverseResult.country;
          direccionData.stateProv ??= reverseResult.adminArea;
          direccionData.city ??= reverseResult.city;
          direccionData.neighborhood ??= reverseResult.neighborhood;
          direccionData.street ??= reverseResult.street;
          direccionData.houseNumber ??= reverseResult.houseNumber;
          direccionData.postalCode ??= reverseResult.postalCode;
          direccionData.provider ??= reverseResult.provider;
          direccionData.placeId ??= reverseResult.placeId;
          direccionData.accuracy ??= reverseResult.accuracy;
          (direccionData as { adminArea?: string }).adminArea ??=
            reverseResult.adminArea;

          if (reverseResult.context && !direccionData.geolocation) {
            direccionData.geolocation = JSON.stringify(reverseResult.context);
          }
        }
      }

      if (
        hasCoordinates &&
        (!direccionData.provider || direccionData.provider.trim().length === 0)
      ) {
        direccionData.provider = 'google-maps';
      }

      if (
        !direccionData.formattedAddress ||
        !direccionData.country ||
        !direccionData.city
      ) {
        throw new BadRequestException(
          'No se pudo completar la dirección con Google Maps. Por favor envía los datos obligatorios manualmente.',
        );
      }

      const { stateProv, ...direccionToPersist } = direccionData;
      const adminArea =
        (direccionToPersist as { adminArea?: string }).adminArea ??
        stateProv ??
        null;

      const newDireccion = this.direccionRepository.create({
        ...direccionToPersist,
        adminArea,
      });

      await this.direccionRepository.save(newDireccion);

      return { ...newDireccion };
    } catch (error) {
      handleDbException(error);
    }
  }

  async findAll(filters: FindDireccionesDto) {
    const { limit = 10, offset = 0, q } = filters;

    const qb = this.direccionRepository.createQueryBuilder('direccion');

    qb.take(limit).skip(offset);

    if (q) {
      const search = `%${q}%`;
      qb.andWhere(
        '(direccion.formattedAddress ILIKE :search OR direccion.country ILIKE :search OR direccion.city ILIKE :search OR direccion.postalCode ILIKE :search)',
        { search },
      );
    }

    qb.orderBy('direccion.fechaCreacion', 'DESC').addOrderBy(
      'direccion.idDireccion',
      'DESC',
    );

    return qb.getMany();
  }

  async findOne(id: number) {
    const direccion = await this.direccionRepository.findOneBy({
      idDireccion: id,
    });

    if (!direccion) {
      throw new NotFoundException(`Direccion with ID ${id} not found`);
    }

    return direccion;
  }

  async update(id: number, updateDireccionDto: UpdateDireccionDto) {
    try {
      const { stateProv, ...toUpdate } = updateDireccionDto;

      // Validar coordenadas duplicadas si se están actualizando
      if (
        toUpdate.lat !== undefined &&
        toUpdate.lng !== undefined &&
        Number.isFinite(toUpdate.lat) &&
        Number.isFinite(toUpdate.lng)
      ) {
        const existingDireccion = await this.direccionRepository.findOne({
          where: {
            lat: toUpdate.lat,
            lng: toUpdate.lng,
          },
        });

        if (existingDireccion && existingDireccion.idDireccion !== id) {
          throw new BadRequestException(
            'Ya existe otra dirección con las mismas coordenadas (lat, lng)',
          );
        }
      }

      const direccion = await this.direccionRepository.preload({
        idDireccion: id,
        ...toUpdate,
        adminArea:
          (toUpdate as { adminArea?: string }).adminArea ??
          stateProv ??
          undefined,
      });

      if (!direccion) {
        throw new NotFoundException(`Direccion con id ${id} no encontrada`);
      }

      return this.direccionRepository.save(direccion);
    } catch (error) {
      handleDbException(error);
    }
  }

  async remove(id: number) {
    const direccion = await this.findOne(id);
    await this.direccionRepository.remove(direccion!);
  }
}
