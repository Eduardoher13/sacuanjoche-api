import {
  AddressType,
  Client,
  DistanceMatrixRow,
  GeocodeResult,
  Language,
  TrafficModel,
  TravelMode,
} from '@googlemaps/google-maps-services-js';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Coordinates,
  ForwardGeocodeOptions,
  ForwardGeocodeResponse,
  ForwardGeocodeResult,
  GoogleMapsLeg,
  GoogleMapsWaypoint,
  OptimizeRouteInput,
  OptimizeRouteResult,
  PointToPointMetrics,
  ReverseGeocodeResult,
} from './google-maps.interfaces';

type RouteStop = OptimizeRouteInput['stops'][number] & { originalIndex: number };

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);
  private readonly client = new Client({});

  constructor(private readonly configService: ConfigService) {}

  async optimizeRoute(input: OptimizeRouteInput): Promise<OptimizeRouteResult> {
    const apiKey = this.getApiKey();

    if (!input.stops.length) {
      throw new InternalServerErrorException(
        'Se requiere al menos un punto de entrega para optimizar la ruta.',
      );
    }

    if (input.stops.length > 23) {
      throw new BadRequestException(
        'Google Maps Directions admite hasta 23 paradas intermedias por ruta optimizada.',
      );
    }

    const origin = this.validateCoordinate(input.origin, 'origen');
    const stops: RouteStop[] = input.stops.map((stop, index) => ({
      ...this.validateCoordinate(stop, `parada ${index + 1}`),
      externalId: stop.externalId,
      label: stop.label,
      originalIndex: index,
    }));

    const mode = this.resolveTravelMode(input.profile);
    const optimizedIndexes = await this.calculateOptimizedOrder(
      origin,
      stops,
      mode,
      apiKey,
    );
    const orderedStops = optimizedIndexes.map((index) => stops[index]);

    const directionsData = await this.fetchRouteDirections(
      origin,
      orderedStops,
      mode,
      apiKey,
      input.useRoundTrip ?? false,
    );

    const route = directionsData.routes?.[0];

    if (!route?.legs?.length) {
      this.logger.error('Respuesta no válida de Google Maps Directions', {
        status: directionsData.status,
        routes: directionsData.routes?.length ?? 0,
      });
      throw new InternalServerErrorException(
        'Google Maps no devolvió una ruta optimizada.',
      );
    }

    const legs: GoogleMapsLeg[] = route.legs.map((leg) => ({
      distance: leg.distance?.value ?? 0,
      duration:
        leg.duration_in_traffic?.value ??
        leg.duration?.value ??
        0,
    }));

    const totalDistanceMeters = legs.reduce(
      (sum, leg) => sum + leg.distance,
      0,
    );
    const totalDurationSeconds = legs.reduce(
      (sum, leg) => sum + leg.duration,
      0,
    );

    const waypoints: GoogleMapsWaypoint[] = orderedStops.map((stop, index) => ({
      name: stop.label || `Pedido ${stop.externalId}`,
      location: [stop.lng, stop.lat],
      waypoint_index: index,
      original_index: stop.originalIndex + 1,
    }));

    return {
      distanceKm: Number((totalDistanceMeters / 1000).toFixed(2)),
      durationMin: Number((totalDurationSeconds / 60).toFixed(2)),
      geometry: route.overview_polyline?.points ?? null,
      waypoints,
      legs,
    };
  }

  async forwardGeocode(
    query: string,
    options: ForwardGeocodeOptions = {},
  ): Promise<ForwardGeocodeResponse> {
    const apiKey = this.getApiKey();
    const sanitizedQuery = query.trim();

    if (!sanitizedQuery) {
      return { results: [], primary: null };
    }

    const limit = Math.max(1, Math.min(options.limit ?? 5, 10));
    const language = ((options.language ?? 'es').trim() || 'es').toLowerCase();
    const country = ((options.country ?? 'ni').trim() || 'ni').toLowerCase();
    const countryCodes = country
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length);

    const strictParams = this.buildGeocodeParams(
      sanitizedQuery,
      apiKey,
      language,
      countryCodes,
      options.bbox,
    );

    let results = await this.fetchGeocodeResults(strictParams, sanitizedQuery);

    if (!results.length && !options.skipRelaxed) {
      results = await this.fetchGeocodeResults(
        {
          address: sanitizedQuery,
          key: apiKey,
          language,
          region: countryCodes[0] || 'ni',
        },
        sanitizedQuery,
      );
    }

    let mappedResults = results.map((result) =>
      this.mapGeocodeResultToForward(result),
    );

    if (options.types?.length) {
      const expectedTypes = new Set(
        options.types.map((value) => value.trim().toLowerCase()),
      );
      mappedResults = mappedResults.filter((result) => {
        const googleResult = results.find((item) => item.place_id === result.id);
        return googleResult?.types?.some((type) => expectedTypes.has(type));
      });
    }

    if (options.proximity) {
      mappedResults = mappedResults.sort((a, b) => {
        const distanceA = this.calculateHaversineDistance(options.proximity!, a);
        const distanceB = this.calculateHaversineDistance(options.proximity!, b);
        return distanceA - distanceB;
      });
    }

    mappedResults = mappedResults.slice(0, limit);

    return {
      results: mappedResults,
      primary: mappedResults[0] ?? null,
    };
  }

  async reverseGeocode(
    coordinates: Coordinates,
    options?: {
      limit?: number;
      types?: string[];
    },
  ): Promise<ReverseGeocodeResult | null> {
    const apiKey = this.getApiKey();
    const sanitizedCoordinates = this.validateCoordinate(
      coordinates,
      'reverse geocoding',
    );

    try {
      const response = await this.client.reverseGeocode({
        params: {
          latlng: sanitizedCoordinates,
          key: apiKey,
          language: Language.es,
          result_type: this.mapReverseResultTypes(options?.types),
        },
      });

      if (response.data.status === 'ZERO_RESULTS') {
        this.logger.warn(
          `Google Maps no devolvió resultados para las coordenadas ${sanitizedCoordinates.lat}, ${sanitizedCoordinates.lng}.`,
        );
        return null;
      }

      this.ensureGoogleStatus(
        response.data.status,
        'No se pudo obtener la dirección desde Google Maps.',
      );

      const result = response.data.results?.[0];
      return result ? this.mapGeocodeResultToReverse(result) : null;
    } catch (error) {
      this.handleGoogleError(
        error,
        'No se pudo obtener la dirección desde Google Maps.',
      );
    }
  }

  async getDistanceBetween(
    origin: Coordinates,
    destination: Coordinates,
    profile?: string,
  ): Promise<PointToPointMetrics> {
    const apiKey = this.getApiKey();
    const sanitizedOrigin = this.validateCoordinate(origin, 'origen');
    const sanitizedDestination = this.validateCoordinate(destination, 'destino');
    const mode = this.resolveTravelMode(profile);

    try {
      const elementCount = 1;
      const response = await this.client.distancematrix({
        params: {
          origins: [sanitizedOrigin],
          destinations: [sanitizedDestination],
          key: apiKey,
          mode,
          language: 'es',
          region: 'ni',
          departure_time:
            mode === TravelMode.driving && elementCount <= 100
              ? new Date()
              : undefined,
          traffic_model:
            mode === TravelMode.driving && elementCount <= 100
              ? TrafficModel.best_guess
              : undefined,
        },
      });

      this.ensureGoogleStatus(
        response.data.status,
        'No se pudo calcular la distancia con Google Maps.',
      );

      const element = response.data.rows?.[0]?.elements?.[0];
      if (element?.status === 'OK' && element.distance) {
        return {
          distanceKm: Number((element.distance.value / 1000).toFixed(2)),
          durationMin:
            typeof element.duration?.value === 'number'
              ? Number(
                  (
                    (element.duration_in_traffic?.value ?? element.duration.value) /
                    60
                  ).toFixed(2),
                )
              : null,
          geometry: null,
          source: 'google-maps',
        };
      }

      if (element?.status && element.status !== 'OK') {
        this.logger.warn(
          `Google Maps Distance Matrix devolvió ${element.status} para ${sanitizedOrigin.lat},${sanitizedOrigin.lng} -> ${sanitizedDestination.lat},${sanitizedDestination.lng}.`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Fallo al obtener la distancia con Google Maps (${mode}). Se usará un cálculo aproximado.`,
      );
    }

    const fallbackDistance = this.calculateHaversineDistance(
      sanitizedOrigin,
      sanitizedDestination,
    );

    return {
      distanceKm: Number(fallbackDistance.toFixed(2)),
      durationMin: null,
      geometry: null,
      source: 'haversine',
    };
  }

  private async calculateOptimizedOrder(
    origin: Coordinates,
    stops: RouteStop[],
    mode: TravelMode,
    apiKey: string,
  ): Promise<number[]> {
    if (stops.length === 1) {
      return [0];
    }

    const matrixOrigins = [origin, ...stops].map(({ lat, lng }) => ({ lat, lng }));
    const matrixDestinations = stops.map(({ lat, lng }) => ({ lat, lng }));
    const elementCount = matrixOrigins.length * matrixDestinations.length;

    try {
      const response = await this.client.distancematrix({
        params: {
          origins: matrixOrigins,
          destinations: matrixDestinations,
          key: apiKey,
          mode,
          language: 'es',
          region: 'ni',
          departure_time:
            mode === TravelMode.driving && elementCount <= 100
              ? new Date()
              : undefined,
          traffic_model:
            mode === TravelMode.driving && elementCount <= 100
              ? TrafficModel.best_guess
              : undefined,
        },
      });

      this.ensureGoogleStatus(
        response.data.status,
        'No se pudo optimizar la ruta con Google Maps.',
      );

      return this.resolveOrderFromMatrix(origin, stops, response.data.rows ?? []);
    } catch (error) {
      this.logger.warn(
        'Google Maps Distance Matrix falló durante la optimización. Se usará un cálculo aproximado.',
      );
      return this.resolveOrderByHaversine(origin, stops);
    }
  }

  private resolveOrderFromMatrix(
    origin: Coordinates,
    stops: RouteStop[],
    rows: DistanceMatrixRow[],
  ): number[] {
    const pending = new Set(stops.map((_, index) => index));
    const order: number[] = [];
    let currentRowIndex = 0;
    let currentCoordinate: Coordinates = origin;

    while (pending.size) {
      const row = rows[currentRowIndex];
      const candidates = Array.from(pending)
        .map((index) => {
          const element = row?.elements?.[index];
          if (!element || element.status !== 'OK') {
            return null;
          }

          return {
            index,
            duration:
              element.duration_in_traffic?.value ?? element.duration?.value ?? Number.MAX_SAFE_INTEGER,
            distance: element.distance?.value ?? Number.MAX_SAFE_INTEGER,
          };
        })
        .filter((value): value is { index: number; duration: number; distance: number } => value !== null)
        .sort((a, b) => a.duration - b.duration || a.distance - b.distance);

      if (candidates.length) {
        const next = candidates[0];
        order.push(next.index);
        pending.delete(next.index);
        currentRowIndex = next.index + 1;
        currentCoordinate = stops[next.index];
        continue;
      }

      const fallbackIndex = this.findClosestPendingStop(currentCoordinate, stops, pending);
      order.push(fallbackIndex);
      pending.delete(fallbackIndex);
      currentRowIndex = fallbackIndex + 1;
      currentCoordinate = stops[fallbackIndex];
    }

    return order;
  }

  private resolveOrderByHaversine(origin: Coordinates, stops: RouteStop[]): number[] {
    const pending = new Set(stops.map((_, index) => index));
    const order: number[] = [];
    let current = origin;

    while (pending.size) {
      const nextIndex = this.findClosestPendingStop(current, stops, pending);
      order.push(nextIndex);
      pending.delete(nextIndex);
      current = stops[nextIndex];
    }

    return order;
  }

  private findClosestPendingStop(
    current: Coordinates,
    stops: RouteStop[],
    pending: Set<number>,
  ): number {
    let selectedIndex: number | null = null;
    let selectedDistance = Number.POSITIVE_INFINITY;

    pending.forEach((index) => {
      const distance = this.calculateHaversineDistance(current, stops[index]);
      if (distance < selectedDistance) {
        selectedDistance = distance;
        selectedIndex = index;
      }
    });

    if (selectedIndex === null) {
      throw new InternalServerErrorException(
        'No se pudo determinar el siguiente punto para la optimización de la ruta.',
      );
    }

    return selectedIndex;
  }

  private async fetchRouteDirections(
    origin: Coordinates,
    stops: RouteStop[],
    mode: TravelMode,
    apiKey: string,
    useRoundTrip: boolean,
  ) {
    const destination = useRoundTrip
      ? { lat: origin.lat, lng: origin.lng }
      : { lat: stops[stops.length - 1].lat, lng: stops[stops.length - 1].lng };

    const waypoints = useRoundTrip ? stops : stops.slice(0, -1);

    try {
      const response = await this.client.directions({
        params: {
          origin,
          destination,
          key: apiKey,
          mode,
          language: Language.es,
          region: 'ni',
          alternatives: false,
          waypoints: waypoints.length
            ? waypoints.map(({ lat, lng }) => ({ lat, lng }))
            : undefined,
          departure_time: mode === TravelMode.driving ? 'now' : undefined,
          traffic_model:
            mode === TravelMode.driving ? TrafficModel.best_guess : undefined,
        },
      });

      this.ensureGoogleStatus(
        response.data.status,
        'No se pudo optimizar la ruta con Google Maps.',
      );

      return response.data;
    } catch (error) {
      this.handleGoogleError(error, 'No se pudo optimizar la ruta con Google Maps.');
    }
  }

  private buildGeocodeParams(
    query: string,
    apiKey: string,
    language: string,
    countryCodes: string[],
    bbox?: string | null,
  ) {
    const params: {
      address: string;
      key: string;
      language: Language | string;
      region: string;
      components?: string;
      bounds?: {
        southwest: { lat: number; lng: number };
        northeast: { lat: number; lng: number };
      };
    } = {
      address: query,
      key: apiKey,
      language: language as Language,
      region: countryCodes[0] || 'ni',
    };

    if (countryCodes.length === 1) {
      params.components = `country:${countryCodes[0]}`;
    }

    if (bbox !== null && bbox !== undefined) {
      const parsedBounds = this.parseBounds(bbox);
      if (parsedBounds) {
        params.bounds = parsedBounds;
      }
    }

    return params;
  }

  private async fetchGeocodeResults(
    params: {
      address: string;
      key: string;
      language: Language | string;
      region: string;
      components?: string;
      bounds?: {
        southwest: { lat: number; lng: number };
        northeast: { lat: number; lng: number };
      };
    },
    query: string,
  ): Promise<GeocodeResult[]> {
    try {
      const response = await this.client.geocode({ params });

      if (response.data.status === 'ZERO_RESULTS') {
        return [];
      }

      this.ensureGoogleStatus(
        response.data.status,
        'No se pudo buscar la dirección en Google Maps.',
        response.data.error_message,
      );

      return response.data.results ?? [];
    } catch (error) {
      this.logger.error('Google Maps geocoding failed', {
        query,
        params: {
          ...params,
          key: params.key ? `${params.key.slice(0, 6)}...` : undefined,
        },
        error: error instanceof Error ? error.message : error,
      });
      this.handleGoogleError(error, 'No se pudo buscar la dirección en Google Maps.');
    }
  }

  private mapGeocodeResultToForward(result: GeocodeResult): ForwardGeocodeResult {
    const components = this.buildAddressComponentMap(result);

    return {
      id: result.place_id,
      label: result.formatted_address,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      country: components.get('country')?.long_name,
      region:
        components.get('administrative_area_level_1')?.long_name ??
        components.get('administrative_area_level_2')?.long_name,
      city:
        components.get('locality')?.long_name ??
        components.get('administrative_area_level_2')?.long_name ??
        components.get('postal_town')?.long_name,
      neighborhood:
        components.get('neighborhood')?.long_name ??
        components.get('sublocality')?.long_name,
      street: components.get('route')?.long_name,
      postalCode: components.get('postal_code')?.long_name,
      accuracy: result.geometry.location_type,
    };
  }

  private mapGeocodeResultToReverse(result: GeocodeResult): ReverseGeocodeResult {
    const components = this.buildAddressComponentMap(result);

    return {
      formattedAddress: result.formatted_address,
      country: components.get('country')?.long_name,
      adminArea:
        components.get('administrative_area_level_1')?.long_name ??
        components.get('administrative_area_level_2')?.long_name,
      city:
        components.get('locality')?.long_name ??
        components.get('administrative_area_level_2')?.long_name ??
        components.get('postal_town')?.long_name,
      neighborhood:
        components.get('neighborhood')?.long_name ??
        components.get('sublocality')?.long_name,
      street: components.get('route')?.long_name,
      houseNumber: components.get('street_number')?.long_name,
      postalCode: components.get('postal_code')?.long_name,
      placeId: result.place_id,
      accuracy: result.geometry.location_type,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      provider: 'google-maps',
      context: Object.fromEntries(
        Array.from(components.entries()).map(([key, value]) => [key, value.long_name]),
      ),
    };
  }

  private buildAddressComponentMap(result: GeocodeResult) {
    return new Map<string, GeocodeResult['address_components'][number]>(
      result.address_components.flatMap((component) =>
        component.types.map((type) => [type, component] as const),
      ),
    );
  }

  private mapReverseResultTypes(types?: string[]): AddressType[] | undefined {
    if (!types?.length) {
      return undefined;
    }

    return types
      .map((type) => this.mapTypeAlias(type))
      .filter((type, index, values) => Boolean(type) && values.indexOf(type) === index);
  }

  private mapTypeAlias(type: string): AddressType {
    switch (type.trim().toLowerCase()) {
      case 'address':
        return AddressType.street_address;
      case 'poi':
        return AddressType.point_of_interest;
      case 'place':
        return AddressType.premise;
      case 'neighborhood':
        return AddressType.neighborhood;
      default:
        return type.trim().toLowerCase() as AddressType;
    }
  }

  private parseBounds(bbox: string) {
    const values = bbox
      .split(',')
      .map((value) => Number(value.trim()));

    if (values.length !== 4 || values.some((value) => Number.isNaN(value))) {
      return null;
    }

    const [minLng, minLat, maxLng, maxLat] = values;

    return {
      southwest: { lat: minLat, lng: minLng },
      northeast: { lat: maxLat, lng: maxLng },
    };
  }

  private resolveTravelMode(profile?: string): TravelMode {
    const normalizedProfile = (
      profile ?? this.configService.get<string>('GOOGLE_MAPS_TRAVEL_MODE') ?? 'driving'
    )
      .trim()
      .toLowerCase();

    switch (normalizedProfile) {
      case 'driving':
      case 'driving-traffic':
        return TravelMode.driving;
      case 'walking':
        return TravelMode.walking;
      case 'cycling':
      case 'bicycling':
        return TravelMode.bicycling;
      case 'transit':
        return TravelMode.transit;
      default:
        throw new BadRequestException(
          `Perfil de viaje no soportado por Google Maps: ${normalizedProfile}.`,
        );
    }
  }

  private ensureGoogleStatus(
    status: string,
    defaultMessage: string,
    providerMessage?: string,
  ): void {
    switch (status) {
      case 'OK':
        return;
      case 'ZERO_RESULTS':
        throw new BadRequestException(
          providerMessage || 'Google Maps no devolvió resultados.',
        );
      case 'OVER_QUERY_LIMIT':
      case 'OVER_DAILY_LIMIT':
        throw new HttpException(
          providerMessage ||
            'Se excedió el límite de Google Maps para esta operación.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      case 'REQUEST_DENIED':
        throw new ForbiddenException(
          providerMessage ||
            'Google Maps rechazó la solicitud. Verifica la configuración de la API.',
        );
      case 'INVALID_REQUEST':
      case 'MAX_WAYPOINTS_EXCEEDED':
      case 'MAX_ROUTE_LENGTH_EXCEEDED':
        throw new BadRequestException(providerMessage || defaultMessage);
      case 'UNKNOWN_ERROR':
      default:
        throw new ServiceUnavailableException(providerMessage || defaultMessage);
    }
  }

  private handleGoogleError(error: unknown, defaultMessage: string): never {
    const responseData =
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof (error as {
        response?: { data?: { status?: string; error_message?: string } };
      }).response?.data === 'object'
        ? (error as {
            response: { data: { status?: string; error_message?: string } };
          }).response.data
        : undefined;

    const responseStatus = responseData?.status;
    const providerMessage = responseData?.error_message;

    if (responseStatus) {
      this.ensureGoogleStatus(responseStatus, defaultMessage, providerMessage);
    }

    throw new ServiceUnavailableException(providerMessage || defaultMessage);
  }

  private getApiKey(): string {
    const apiKey = this.configService.get<string>('MAPS_API_KEY')?.trim();

    if (!apiKey) {
      throw new InternalServerErrorException(
        'MAPS_API_KEY no está configurado en las variables de entorno.',
      );
    }

    return apiKey;
  }

  private validateCoordinate(value: Coordinates, kind: string): Coordinates {
    const lat = Number(value.lat);
    const lng = Number(value.lng);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new InternalServerErrorException(
        `Coordenadas inválidas para ${kind}.`,
      );
    }

    return { lat, lng, label: value.label };
  }

  private calculateHaversineDistance(a: Coordinates, b: Coordinates): number {
    const toRad = (degrees: number) => (degrees * Math.PI) / 180;
    const earthRadiusKm = 6371;

    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const originLatRad = toRad(a.lat);
    const destLatRad = toRad(b.lat);

    const haversine =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) *
        Math.sin(dLng / 2) *
        Math.cos(originLatRad) *
        Math.cos(destLatRad);

    const angularDistance =
      2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    return earthRadiusKm * angularDistance;
  }
}