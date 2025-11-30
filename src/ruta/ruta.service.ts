import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Ruta } from './entities/ruta.entity';
import { RutaPedido } from './entities/ruta-pedido.entity';
import { CreateRutaDto } from './dto/create-ruta.dto';
import { Pedido } from '../pedido/entities/pedido.entity';
import { MapboxService } from '../common/mapbox/mapbox.service';
import { ConfigService } from '@nestjs/config';
import { Empleado } from '../empleado/entities/empleado.entity';
import { Envio } from '../envio/entities/envio.entity';
import { User } from '../auth/entities/user.entity';
import { ValidRoles } from '../auth/interfaces';

interface RutaStopInfo {
  pedido: Pedido;
  lat: number;
  lng: number;
  label: string;
}

@Injectable()
export class RutaService {
  private readonly logger = new Logger(RutaService.name);

  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepository: Repository<Ruta>,
    @InjectRepository(RutaPedido)
    private readonly rutaPedidoRepository: Repository<RutaPedido>,
    @InjectRepository(Pedido)
    private readonly pedidoRepository: Repository<Pedido>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(Envio)
    private readonly envioRepository: Repository<Envio>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mapboxService: MapboxService,
    private readonly configService: ConfigService,
  ) {}

  async create(createRutaDto: CreateRutaDto): Promise<Ruta> {
    const pedidoIds = createRutaDto.pedidoIds;
    const pedidos = await this.pedidoRepository.find({
      where: { idPedido: In(pedidoIds) },
      relations: ['direccion'],
    });

    let empleado: Empleado | null = null;
    if (
      createRutaDto.idEmpleado !== undefined &&
      createRutaDto.idEmpleado !== null
    ) {
      empleado = await this.empleadoRepository.findOne({
        where: { idEmpleado: createRutaDto.idEmpleado },
      });

      if (!empleado) {
        throw new NotFoundException(
          `Empleado ${createRutaDto.idEmpleado} no encontrado para asignar a la ruta.`,
        );
      }
    }

    if (pedidos.length !== pedidoIds.length) {
      const foundIds = pedidos.map((pedido) => pedido.idPedido);
      const missing = pedidoIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Pedidos no encontrados: ${missing.join(', ')}`,
      );
    }

    const pedidosInvalidos = pedidos.filter(
      (pedido) =>
        !pedido.direccion ||
        pedido.direccion.lat === null ||
        pedido.direccion.lng === null,
    );

    if (pedidosInvalidos.length) {
      const ids = pedidosInvalidos.map((pedido) => pedido.idPedido).join(', ');
      throw new BadRequestException(
        `Los pedidos ${ids} no tienen coordenadas válidas registradas.`,
      );
    }

    const origin = this.resolveOriginCoordinates(createRutaDto);

    const pedidosById = new Map(
      pedidos.map((pedido) => [pedido.idPedido, pedido] as const),
    );

    const orderedStops: RutaStopInfo[] = pedidoIds.map((pedidoId) => {
      const pedido = pedidosById.get(pedidoId);
      if (!pedido) {
        throw new NotFoundException(
          `Pedido ${pedidoId} no encontrado tras la consulta.`,
        );
      }

      return {
        pedido,
        lat: Number(pedido.direccion.lat),
        lng: Number(pedido.direccion.lng),
        label: pedido.direccion.formattedAddress || `Pedido ${pedido.idPedido}`,
      };
    });

    const optimization = await this.mapboxService.optimizeRoute({
      origin,
      stops: orderedStops.map((stop) => ({
        lat: stop.lat,
        lng: stop.lng,
        label: stop.label,
        externalId: stop.pedido.idPedido.toString(),
      })),
      profile: createRutaDto.profile,
      useRoundTrip: createRutaDto.roundTrip,
    });

    const waypointsExcludingOrigin = optimization.waypoints
      .filter((waypoint) => {
        if (waypoint.original_index !== undefined) {
          return waypoint.original_index > 0;
        }

        const [lng, lat] = waypoint.location;
        return !this.isSameCoordinate({ lat, lng }, origin);
      })
      .sort((a, b) => (a.waypoint_index ?? 0) - (b.waypoint_index ?? 0));

    if (!waypointsExcludingOrigin.length) {
      throw new BadRequestException(
        'Mapbox no devolvió puntos de entrega en la ruta calculada.',
      );
    }

    const relevantWaypoints = waypointsExcludingOrigin.slice(
      0,
      orderedStops.length,
    );

    if (relevantWaypoints.length < orderedStops.length) {
      throw new BadRequestException(
        'Mapbox devolvió menos puntos de los esperados para los pedidos solicitados.',
      );
    }

    if (waypointsExcludingOrigin.length > orderedStops.length) {
      this.logger.warn(
        `Se recibieron ${waypointsExcludingOrigin.length} waypoints para ${orderedStops.length} pedidos. Se utilizarán los primeros en orden optimizado.`,
      );
    }

    const usedStopIndexes = new Set<number>();

    const rutaPedidos = relevantWaypoints.map((waypoint) => {
      const requestIndex = this.resolveStopIndex(
        waypoint,
        orderedStops,
        usedStopIndexes,
      );
      const stop = orderedStops[requestIndex];
      const legIndex = waypoint.waypoint_index ?? requestIndex;
      const leg = optimization.legs[legIndex] ?? null;

      return this.rutaPedidoRepository.create({
        idPedido: stop.pedido.idPedido,
        secuencia: (waypoint.waypoint_index ?? 0) + 1,
        distanciaKm: leg ? Number((leg.distance / 1000).toFixed(2)) : undefined,
        duracionMin: leg ? Number((leg.duration / 60).toFixed(2)) : undefined,
        lat: stop.lat,
        lng: stop.lng,
        direccionResumen: stop.label,
      });
    });

    if (!rutaPedidos.length) {
      throw new BadRequestException(
        'No se pudo construir la lista de paradas para la ruta.',
      );
    }

    const ruta = this.rutaRepository.create({
      nombre: createRutaDto.nombre,
      idEmpleado: empleado?.idEmpleado,
      empleado: empleado ?? undefined,
      estado: 'pendiente',
      fechaProgramada: createRutaDto.fechaProgramada
        ? new Date(createRutaDto.fechaProgramada)
        : undefined,
      distanciaKm: optimization.distanceKm,
      duracionMin: optimization.durationMin,
      geometry: optimization.geometry,
      mapboxRequestId: optimization.requestId,
      profile: createRutaDto.profile ?? 'driving',
      origenLat: origin.lat,
      origenLng: origin.lng,
      rutaPedidos,
    });

    const savedRuta = await this.rutaRepository.save(ruta);

    await this.syncEnviosForRuta(savedRuta, orderedStops, origin, empleado);

    return this.findOne(savedRuta.idRuta);
  }

  async findAll(user: User): Promise<Ruta[]> {
    // Cargar la relación empleado si no está cargada
    let userWithEmpleado = user;
    if (!user.empleado && user.roles?.includes(ValidRoles.conductor)) {
      userWithEmpleado = await this.userRepository.findOne({
        where: { id: user.id },
        relations: ['empleado'],
      });
    }

    // Si es conductor, filtrar solo sus rutas
    const isConductor = userWithEmpleado?.roles?.includes(ValidRoles.conductor);
    const idEmpleado = userWithEmpleado?.empleado?.idEmpleado;

    if (isConductor && idEmpleado) {
      return this.rutaRepository.find({
        where: { idEmpleado },
        relations: ['rutaPedidos', 'empleado'],
        order: { fechaCreacion: 'DESC' },
      });
    }

    // Admin y vendedor ven todas las rutas
    return this.rutaRepository.find({
      relations: ['rutaPedidos', 'empleado'],
      order: { fechaCreacion: 'DESC' },
    });
  }

  async findOne(idRuta: number, user?: User): Promise<Ruta> {
    const ruta = await this.rutaRepository.findOne({
      where: { idRuta },
      relations: ['rutaPedidos', 'empleado'],
    });

    if (!ruta) {
      throw new NotFoundException(`Ruta ${idRuta} no encontrada.`);
    }

    // Si se proporciona un usuario y es conductor, verificar que la ruta le pertenece
    if (user) {
      const isConductor = user.roles?.includes(ValidRoles.conductor);
      if (isConductor) {
        // Cargar la relación empleado si no está cargada
        let userWithEmpleado = user;
        if (!user.empleado) {
          userWithEmpleado = await this.userRepository.findOne({
            where: { id: user.id },
            relations: ['empleado'],
          });
        }

        const idEmpleado = userWithEmpleado?.empleado?.idEmpleado;
        if (ruta.idEmpleado !== idEmpleado) {
          throw new ForbiddenException(
            'No tiene permiso para ver esta ruta. Solo puede ver las rutas asignadas a usted.',
          );
        }
      }
    }

    ruta.rutaPedidos.sort((a, b) => a.secuencia - b.secuencia);
    return ruta;
  }

  private resolveOriginCoordinates(dto: CreateRutaDto) {
    const lat =
      dto.origenLat ?? Number(this.configService.get('ROUTING_ORIGIN_LAT'));
    const lng =
      dto.origenLng ?? Number(this.configService.get('ROUTING_ORIGIN_LNG'));

    if ([lat, lng].some((value) => Number.isNaN(value))) {
      throw new BadRequestException(
        'No se encontró coordenada de origen. Define ROUTING_ORIGIN_LAT y ROUTING_ORIGIN_LNG o envíalos en la petición.',
      );
    }

    return { lat, lng } as const;
  }

  private resolveStopIndex(
    waypoint: {
      original_index?: number;
      location: [number, number];
      waypoint_index?: number;
    },
    orderedStops: RutaStopInfo[],
    usedIndexes: Set<number>,
  ): number {
    if (waypoint.original_index !== undefined && waypoint.original_index > 0) {
      const candidate = waypoint.original_index - 1;
      if (!usedIndexes.has(candidate)) {
        usedIndexes.add(candidate);
        return candidate;
      }
    }

    const fallbackIndex = orderedStops.findIndex((stop) =>
      this.isSameCoordinate(
        { lat: stop.lat, lng: stop.lng },
        { lat: waypoint.location[1], lng: waypoint.location[0] },
      ),
    );

    if (fallbackIndex !== -1 && !usedIndexes.has(fallbackIndex)) {
      usedIndexes.add(fallbackIndex);
      return fallbackIndex;
    }

    const closest = this.findClosestStopIndex(
      waypoint.location,
      orderedStops,
      usedIndexes,
    );

    if (closest !== null) {
      if (!closest.withinTolerance) {
        this.logger.warn(
          `Waypoint fuera de tolerancia (${closest.distance.toFixed(6)}). Asignando pedido ${orderedStops[closest.index].pedido.idPedido} por proximidad.`,
        );
      }
      usedIndexes.add(closest.index);
      return closest.index;
    }

    const remainingIndex = this.findFirstUnusedIndex(
      orderedStops.length,
      usedIndexes,
    );

    if (remainingIndex !== null) {
      this.logger.warn(
        `Waypoint sin coincidencia precisa; asignando pedido ${orderedStops[remainingIndex].pedido.idPedido} por descarte.`,
      );
      usedIndexes.add(remainingIndex);
      return remainingIndex;
    }

    throw new BadRequestException(
      'No se pudo determinar el pedido asociado a un waypoint devuelto por Mapbox.',
    );
  }

  private isSameCoordinate(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
    tolerance = 1e-4,
  ) {
    return (
      Math.abs(a.lat - b.lat) < tolerance && Math.abs(a.lng - b.lng) < tolerance
    );
  }

  private findClosestStopIndex(
    waypointLocation: [number, number],
    stops: RutaStopInfo[],
    usedIndexes: Set<number>,
    tolerance = 5e-3,
  ): { index: number; distance: number; withinTolerance: boolean } | null {
    let bestIndex: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    stops.forEach((stop, index) => {
      if (usedIndexes.has(index)) {
        return;
      }

      const distance = this.coordinateDistance(stop, {
        lat: waypointLocation[1],
        lng: waypointLocation[0],
      });

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    if (bestIndex !== null) {
      return {
        index: bestIndex,
        distance: bestDistance,
        withinTolerance: bestDistance < tolerance,
      };
    }

    return null;
  }

  private coordinateDistance(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ) {
    const dLat = a.lat - b.lat;
    const dLng = a.lng - b.lng;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  private findFirstUnusedIndex(
    totalStops: number,
    usedIndexes: Set<number>,
  ): number | null {
    for (let i = 0; i < totalStops; i++) {
      if (!usedIndexes.has(i)) {
        return i;
      }
    }
    return null;
  }

  private async syncEnviosForRuta(
    ruta: Ruta,
    stops: RutaStopInfo[],
    origin: { lat: number; lng: number },
    empleado: Empleado | null,
  ): Promise<void> {
    if (!stops.length) {
      return;
    }

    const programDate = ruta.fechaProgramada ?? new Date();
    const originLat = Number(origin.lat);
    const originLng = Number(origin.lng);
    const assignedEmployeeId = ruta.idEmpleado ?? empleado?.idEmpleado ?? null;

    await Promise.all(
      stops.map(async (stop) => {
        const pedidoId = stop.pedido.idPedido;
        const destinoLat = Number(stop.lat);
        const destinoLng = Number(stop.lng);
        const envio = await this.envioRepository.findOne({
          where: { idPedido: pedidoId },
        });

        if (envio) {
          if (envio.estadoEnvio?.toLowerCase() === 'entregado') {
            if (envio.idRuta !== ruta.idRuta) {
              envio.idRuta = ruta.idRuta;
              await this.envioRepository.save(envio);
            }
            return;
          }

          const metrics = await this.mapboxService.getDistanceBetween(
            { lat: originLat, lng: originLng },
            { lat: destinoLat, lng: destinoLng },
            ruta.profile,
          );

          const distanceKm = Number(metrics.distanceKm.toFixed(2));

          envio.estadoEnvio = 'programado';
          envio.fechaProgramada = programDate;
          if (assignedEmployeeId !== null) {
            envio.idEmpleado = assignedEmployeeId;
          }
          envio.origenLat = originLat;
          envio.origenLng = originLng;
          envio.destinoLat = destinoLat;
          envio.destinoLng = destinoLng;
          envio.idRuta = ruta.idRuta;
          envio.distanciaKm = distanceKm;

          await this.envioRepository.save(envio);
          return;
        }

        const metrics = await this.mapboxService.getDistanceBetween(
          { lat: originLat, lng: originLng },
          { lat: destinoLat, lng: destinoLng },
          ruta.profile,
        );

        const distanceKm = Number(metrics.distanceKm.toFixed(2));

        const nuevoEnvio = this.envioRepository.create({
          idPedido: pedidoId,
          idEmpleado: assignedEmployeeId ?? stop.pedido.idEmpleado ?? undefined,
          estadoEnvio: 'programado',
          fechaProgramada: programDate,
          origenLat: originLat,
          origenLng: originLng,
          destinoLat,
          destinoLng,
          idRuta: ruta.idRuta,
          distanciaKm: distanceKm,
        });

        await this.envioRepository.save(nuevoEnvio);
      }),
    );
  }
}
