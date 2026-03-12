import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Envio } from './entities/envio.entity';
import { CreateEnvioDto } from './dto/create-envio.dto';
import { UpdateEnvioDto } from './dto/update-envio.dto';
import { Pedido } from 'src/pedido/entities/pedido.entity';
import { Empleado } from 'src/empleado/entities/empleado.entity';
import { handleDbException } from 'src/common/helpers/db-exception.helper';
import { findEntityOrFail } from 'src/common/helpers/find-entity.helper';
import { FindEnviosDto } from './dto/find-envios.dto';
import { ConfigService } from '@nestjs/config';
import { GoogleMapsService } from 'src/common/google-maps/google-maps.service';

@Injectable()
export class EnvioService {
  constructor(
    @InjectRepository(Envio)
    private readonly envioRepository: Repository<Envio>,
    @InjectRepository(Pedido)
    private readonly pedidoRepository: Repository<Pedido>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    private readonly configService: ConfigService,
    private readonly googleMapsService: GoogleMapsService,
  ) {}

  async create(createEnvioDto: CreateEnvioDto) {
    try {
      const {
        idPedido,
        idEmpleado,
        fechaProgramada,
        fechaSalida,
        fechaEntrega,
        ...envioData
      } = createEnvioDto;

      const pedido = await this.loadPedidoWithDireccion(idPedido);

      const empleado =
        idEmpleado !== undefined
          ? await findEntityOrFail(
              this.empleadoRepository,
              { idEmpleado },
              'El empleado no fue encontrado o no existe',
            )
          : undefined;

      const normalizedEnvio = this.envioRepository.create({
        ...envioData,
        fechaProgramada: this.castToDate(fechaProgramada),
        fechaSalida: this.castToDate(fechaSalida),
        fechaEntrega: this.castToDate(fechaEntrega),
        pedido,
        empleado,
      });

      if (!normalizedEnvio.estadoEnvio) {
        normalizedEnvio.estadoEnvio = 'pendiente';
      }

      normalizedEnvio.idEmpleado = empleado?.idEmpleado ?? idEmpleado;

      await this.enrichWithCoordinatesAndDistance(normalizedEnvio, pedido);

      await this.envioRepository.save(normalizedEnvio);

      return this.envioRepository.findOne({
        where: { idEnvio: normalizedEnvio.idEnvio },
        relations: ['pedido', 'empleado', 'ruta'],
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      handleDbException(error);
    }
  }

  async findAll(filters: FindEnviosDto) {
    const { limit = 10, offset = 0, q } = filters;

    const qb = this.envioRepository
      .createQueryBuilder('envio')
      .leftJoinAndSelect('envio.pedido', 'pedido')
      .leftJoinAndSelect('envio.empleado', 'empleado')
      .leftJoinAndSelect('envio.ruta', 'ruta');

    qb.take(limit).skip(offset);

    if (q) {
      const search = `%${q}%`;
      qb.andWhere(
        '(envio.estadoEnvio ILIKE :search OR CAST(pedido.idPedido AS TEXT) ILIKE :search OR empleado.primerNombre ILIKE :search OR empleado.primerApellido ILIKE :search)',
        { search },
      );
    }

    qb.orderBy('envio.fechaProgramada', 'DESC').addOrderBy(
      'envio.idEnvio',
      'DESC',
    );

    return qb.getMany();
  }

  async findOne(id: number) {
    const envio = await this.envioRepository.findOne({
      where: { idEnvio: id },
      relations: ['pedido', 'empleado', 'ruta'],
    });

    if (!envio) {
      throw new NotFoundException(`El envío con id ${id} no fue encontrado`);
    }

    return envio;
  }

  async update(id: number, updateEnvioDto: UpdateEnvioDto) {
    try {
      const {
        idPedido,
        idEmpleado,
        fechaProgramada,
        fechaSalida,
        fechaEntrega,
        costoEnvio,
        ...toUpdate
      } = updateEnvioDto;

      const envio = await this.envioRepository.findOne({
        where: { idEnvio: id },
        relations: ['pedido', 'empleado', 'ruta'],
      });

      if (!envio) {
        throw new NotFoundException(`El envío con id ${id} no fue encontrado`);
      }

      const pedido =
        idPedido !== undefined && idPedido !== envio.idPedido
          ? await this.loadPedidoWithDireccion(idPedido)
          : await this.loadPedidoWithDireccion(envio.idPedido);

      envio.pedido = pedido;
      envio.idPedido = pedido.idPedido;

      if (idEmpleado !== undefined) {
        const empleado = await findEntityOrFail(
          this.empleadoRepository,
          { idEmpleado },
          'El empleado no fue encontrado o no existe',
        );
        envio.empleado = empleado;
        envio.idEmpleado = empleado.idEmpleado;
      }

      Object.assign(envio, {
        ...toUpdate,
        fechaProgramada:
          this.castToDate(fechaProgramada) ?? envio.fechaProgramada,
        fechaSalida: this.castToDate(fechaSalida) ?? envio.fechaSalida,
        fechaEntrega: this.castToDate(fechaEntrega) ?? envio.fechaEntrega,
      });

      if (costoEnvio !== undefined) {
        envio.costoEnvio = costoEnvio;
      }

      if (!envio.estadoEnvio) {
        envio.estadoEnvio = 'pendiente';
      }

      await this.enrichWithCoordinatesAndDistance(
        envio,
        pedido,
        envio.ruta?.profile,
      );

      await this.envioRepository.save(envio);

      return this.findOne(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      handleDbException(error);
    }
  }

  async remove(id: number) {
    const envio = await this.findOne(id);
    await this.envioRepository.remove(envio);
  }

  private async loadPedidoWithDireccion(idPedido: number): Promise<Pedido> {
    const pedido = await this.pedidoRepository.findOne({
      where: { idPedido },
      relations: ['direccion'],
    });

    if (!pedido) {
      throw new NotFoundException('El pedido no fue encontrado o no existe');
    }

    if (!pedido.direccion) {
      throw new BadRequestException(
        `El pedido ${pedido.idPedido} no tiene una dirección asociada.`,
      );
    }

    return pedido;
  }

  private async enrichWithCoordinatesAndDistance(
    envio: Envio,
    pedido: Pedido,
    profile?: string,
  ): Promise<void> {
    const origin = this.resolveOriginCoordinates();
    const destination = this.extractDestinationCoordinates(pedido);

    envio.origenLat = origin.lat;
    envio.origenLng = origin.lng;
    envio.destinoLat = destination.lat;
    envio.destinoLng = destination.lng;

    const metrics = await this.googleMapsService.getDistanceBetween(
      origin,
      destination,
      profile,
    );

    envio.distanciaKm = Number(metrics.distanceKm.toFixed(2));
  }

  private resolveOriginCoordinates(): { lat: number; lng: number } {
    const lat = this.toNumberOrUndefined(
      this.configService.get('ROUTING_ORIGIN_LAT') ??
        this.configService.get('DELIVERY_ORIGIN_LAT'),
    );
    const lng = this.toNumberOrUndefined(
      this.configService.get('ROUTING_ORIGIN_LNG') ??
        this.configService.get('DELIVERY_ORIGIN_LNG'),
    );

    if (lat === undefined || lng === undefined) {
      throw new BadRequestException(
        'Faltan ROUTING_ORIGIN_LAT/ROUTING_ORIGIN_LNG (o DELIVERY_ORIGIN_LAT/DELIVERY_ORIGIN_LNG) en la configuración.',
      );
    }

    return { lat, lng };
  }

  private extractDestinationCoordinates(pedido: Pedido): {
    lat: number;
    lng: number;
  } {
    const { direccion } = pedido;

    const lat = this.toCoordinateNumber(
      direccion?.lat,
      'latitud de la dirección del pedido',
    );
    const lng = this.toCoordinateNumber(
      direccion?.lng,
      'longitud de la dirección del pedido',
    );

    return { lat, lng };
  }

  private toCoordinateNumber(value: unknown, label: string): number {
    if (value === null || value === undefined) {
      throw new BadRequestException(`No se definió la ${label}.`);
    }
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      throw new BadRequestException(`Valor inválido para ${label}.`);
    }
    return numeric;
  }

  private toNumberOrUndefined(value: unknown): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    const numeric = Number(value);
    return Number.isNaN(numeric) ? undefined : numeric;
  }

  private castToDate(value?: string | Date): Date | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new BadRequestException('Fecha inválida proporcionada.');
      }
      return value;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Fecha inválida proporcionada.');
    }
    return date;
  }
}
