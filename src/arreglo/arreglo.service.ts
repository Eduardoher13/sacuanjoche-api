import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Arreglo } from './entities/arreglo.entity';
import { CreateArregloDto } from './dto/create-arreglo.dto';
import { UpdateArregloDto } from './dto/update-arreglo.dto';
import { FormaArreglo } from 'src/forma-arreglo/entities/forma-arreglo.entity';
import { findEntityOrFail } from 'src/common/helpers/find-entity.helper';
import { handleDbException } from 'src/common/helpers/db-exception.helper';
import { FindArreglosDto } from './dto/find-arreglos.dto';
import { FindArreglosPublicDto } from './dto/find-arreglos-public.dto';
import { ArregloFlor } from 'src/arreglo-flor/entities/arreglo-flor.entity';
import { AccesoriosArreglo } from 'src/accesorios-arreglo/entities/accesorios-arreglo.entity';
import { ArregloPublicResponseDto } from './dto/arreglo-public-response.dto';
import { ArregloMedia } from './entities/arreglo-media.entity';
import { SpacesService } from 'src/common/storage/spaces.service';
import { CreateLoteArregloItemDto } from './dto/create-lote-arreglos.dto';
import { CreateArregloWithMediaDto } from './dto/create-arreglo-batch.dto';
import { extractObjectKey } from 'src/common/helpers/storage.helper';
import { Flor } from 'src/flor/entities/flor.entity';
import { Accesorio } from 'src/accesorio/entities/accesorio.entity';
import { In } from 'typeorm';

@Injectable()
export class ArregloService {
  constructor(
    @InjectRepository(Arreglo)
    private readonly arregloRepository: Repository<Arreglo>,
    @InjectRepository(FormaArreglo)
    private readonly formaArregloRepository: Repository<FormaArreglo>,
    @InjectRepository(ArregloFlor)
    private readonly arregloFlorRepository: Repository<ArregloFlor>,
    @InjectRepository(AccesoriosArreglo)
    private readonly accesoriosArregloRepository: Repository<AccesoriosArreglo>,
    @InjectRepository(ArregloMedia)
    private readonly mediaRepository: Repository<ArregloMedia>,
    @InjectRepository(Flor)
    private readonly florRepository: Repository<Flor>,
    @InjectRepository(Accesorio)
    private readonly accesorioRepository: Repository<Accesorio>,
    private readonly spaces: SpacesService,
  ) {}

  async create(createArregloDto: CreateArregloDto, manager?: EntityManager) {
    try {
      const { idFormaArreglo, flores, accesorios, ...arregloData } =
        createArregloDto;
      const formaRepo = manager
        ? manager.getRepository(FormaArreglo)
        : this.formaArregloRepository;
      const arregloRepo = manager
        ? manager.getRepository(Arreglo)
        : this.arregloRepository;
      const florRepo = manager
        ? manager.getRepository(ArregloFlor)
        : this.arregloFlorRepository;
      const accesorioRepo = manager
        ? manager.getRepository(AccesoriosArreglo)
        : this.accesoriosArregloRepository;

      const formaArreglo = await findEntityOrFail(
        formaRepo,
        { idFormaArreglo },
        'La forma de arreglo no fue encontrada o no existe',
      );

      const newArreglo = arregloRepo.create({
        ...arregloData,
        formaArreglo,
      });

      const savedArreglo = await arregloRepo.save(newArreglo);

      if (flores && flores.length > 0) {
        const arregloFlores = flores.map((f) =>
          florRepo.create({
            idArreglo: savedArreglo.idArreglo,
            idFlor: f.idFlor,
            cantidad: f.cantidad,
          }),
        );
        await florRepo.save(arregloFlores);
      }

      if (accesorios && accesorios.length > 0) {
        const arregloAccesorios = accesorios.map((a) =>
          accesorioRepo.create({
            idArreglo: savedArreglo.idArreglo,
            idAccesorio: a.idAccesorio,
            cantidad: a.cantidad,
          }),
        );
        await accesorioRepo.save(arregloAccesorios);
      }

      return arregloRepo.findOne({
        where: { idArreglo: newArreglo.idArreglo },
        relations: ['formaArreglo', 'media'],
        order: {
          media: {
            orden: 'ASC',
            idArregloMedia: 'ASC',
          },
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      handleDbException(error);
    }
  }

  async findAll(filters: FindArreglosDto) {
    const { limit = 10, offset = 0, q } = filters;

    const qb = this.arregloRepository
      .createQueryBuilder('arreglo')
      .leftJoinAndSelect('arreglo.formaArreglo', 'formaArreglo')
      .leftJoinAndSelect('arreglo.media', 'media', 'media.activo = true');

    qb.distinct(true);

    qb.take(limit).skip(offset);

    if (q) {
      const search = `%${q}%`;
      qb.andWhere(
        `(arreglo.nombre ILIKE :search OR arreglo.descripcion ILIKE :search OR formaArreglo.descripcion ILIKE :search)`,
        { search },
      );
    }

    qb.orderBy('arreglo.fechaCreacion', 'DESC')
      .addOrderBy('arreglo.idArreglo', 'DESC')
      .addOrderBy('media.orden', 'ASC')
      .addOrderBy('media.idArregloMedia', 'ASC');

    return qb.getMany();
  }

  async findOne(id: number) {
    const arreglo = await this.arregloRepository
      .createQueryBuilder('arreglo')
      .leftJoinAndSelect('arreglo.formaArreglo', 'formaArreglo')
      .leftJoinAndSelect('arreglo.media', 'media', 'media.activo = true')
      .where('arreglo.idArreglo = :id', { id })
      .orderBy('media.orden', 'ASC')
      .addOrderBy('media.idArregloMedia', 'ASC')
      .getOne();

    if (!arreglo) {
      throw new NotFoundException(`El arreglo con id ${id} no fue encontrado`);
    }

    return arreglo;
  }

  async update(id: number, updateArregloDto: UpdateArregloDto) {
    try {
      const { idFormaArreglo, ...toUpdate } = updateArregloDto;

      const formaArreglo =
        idFormaArreglo !== undefined
          ? await findEntityOrFail(
              this.formaArregloRepository,
              { idFormaArreglo },
              'La forma de arreglo no fue encontrada o no existe',
            )
          : undefined;

      const arreglo = await this.arregloRepository.preload({
        idArreglo: id,
        ...toUpdate,
        formaArreglo,
      });

      if (!arreglo) {
        throw new NotFoundException(
          `El arreglo con id ${id} no fue encontrado`,
        );
      }

      return this.arregloRepository.save(arreglo);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      handleDbException(error);
    }
  }

  async remove(id: number) {
    const arreglo = await this.findOne(id);
    await this.arregloRepository.remove(arreglo);
  }

  /**
   * Catálogo público con filtros avanzados
   */
  async findPublic(filters: FindArreglosPublicDto) {
    const {
      limit = 10,
      offset = 0,
      q,
      idFormaArreglo,
      precioMin,
      precioMax,
      flores,
      ordenarPor = 'fechaCreacion',
      orden = 'DESC',
    } = filters;

    // Validar y normalizar el orden para prevenir errores SQL
    const ordenNormalizado =
      orden === 'ASC' || orden === 'DESC' ? orden : 'DESC';

    // Validar y normalizar ordenarPor para prevenir errores
    const ordenarPorValidos = ['nombre', 'precio', 'fechaCreacion'];
    const ordenarPorNormalizado = ordenarPorValidos.includes(ordenarPor)
      ? ordenarPor
      : 'fechaCreacion';

    const qb = this.arregloRepository
      .createQueryBuilder('arreglo')
      .leftJoinAndSelect('arreglo.formaArreglo', 'formaArreglo')
      .leftJoinAndSelect('arreglo.media', 'media', 'media.activo = true')
      .where('arreglo.estado = :estado', { estado: 'activo' });

    qb.distinct(true);

    // Búsqueda por texto
    if (q) {
      const search = `%${q}%`;
      qb.andWhere(
        `(arreglo.nombre ILIKE :search OR arreglo.descripcion ILIKE :search OR formaArreglo.descripcion ILIKE :search)`,
        { search },
      );
    }

    // Filtro por forma de arreglo
    if (idFormaArreglo) {
      qb.andWhere('arreglo.idFormaArreglo = :idFormaArreglo', {
        idFormaArreglo,
      });
    }

    // Filtro por precio
    if (precioMin !== undefined) {
      qb.andWhere('arreglo.precioUnitario >= :precioMin', { precioMin });
    }
    if (precioMax !== undefined) {
      qb.andWhere('arreglo.precioUnitario <= :precioMax', { precioMax });
    }

    // Filtro por flores - validar que sea un array válido
    if (flores && Array.isArray(flores) && flores.length > 0) {
      const floresValidos = flores.filter(
        (id) => typeof id === 'number' && id > 0 && !isNaN(id),
      );
      if (floresValidos.length > 0) {
        qb.leftJoin('arreglo.arreglosFlor', 'arregloFlor')
          .leftJoin('arregloFlor.flor', 'flor')
          .andWhere('flor.idFlor IN (:...flores)', { flores: floresValidos });
      }
    }

    // Ordenamiento con valores validados
    if (ordenarPorNormalizado === 'nombre') {
      qb.orderBy('arreglo.nombre', ordenNormalizado);
    } else if (ordenarPorNormalizado === 'precio') {
      qb.orderBy('arreglo.precioUnitario', ordenNormalizado);
    } else {
      qb.orderBy('arreglo.fechaCreacion', ordenNormalizado);
    }

    qb.addOrderBy('arreglo.idArreglo', 'DESC')
      .addOrderBy('media.orden', 'ASC')
      .addOrderBy('media.idArregloMedia', 'ASC');

    qb.take(limit).skip(offset);

    const arreglos = await qb.getMany();

    // Mapear a respuesta pública con solo los campos necesarios
    return arreglos.map((arreglo) => ({
      idArreglo: arreglo.idArreglo,
      nombre: arreglo.nombre,
      descripcion: arreglo.descripcion,
      precioUnitario: arreglo.precioUnitario,
      url: arreglo.url,
      formaArreglo: arreglo.formaArreglo
        ? {
            idFormaArreglo: arreglo.formaArreglo.idFormaArreglo,
            descripcion: arreglo.formaArreglo.descripcion,
          }
        : null,
      media: (arreglo.media || [])
        .filter((m) => m.activo)
        .map((m) => ({
          idArregloMedia: m.idArregloMedia,
          url: m.url,
          orden: m.orden,
          isPrimary: m.isPrimary,
          altText: m.altText,
        }))
        .sort((a, b) => a.orden - b.orden),
    })) as ArregloPublicResponseDto[];
  }

  /**
   * Obtener opciones de filtros disponibles para el catálogo
   */
  async getFiltrosDisponibles() {
    try {
      const [formasArreglo, precios, arreglosFlor] = await Promise.all([
        // Formas de arreglo activas
        this.formaArregloRepository.find({
          where: { activo: true },
          select: ['idFormaArreglo', 'descripcion'],
          order: { descripcion: 'ASC' },
        }),

        // Rango de precios
        this.arregloRepository
          .createQueryBuilder('arreglo')
          .select('MIN(arreglo.precioUnitario)', 'min')
          .addSelect('MAX(arreglo.precioUnitario)', 'max')
          .where('arreglo.estado = :estado', { estado: 'activo' })
          .getRawOne(),

        // Flores disponibles en arreglos activos
        this.arregloFlorRepository
          .createQueryBuilder('af')
          .innerJoinAndSelect('af.flor', 'flor')
          .innerJoin('af.arreglo', 'arreglo')
          .where('arreglo.estado = :estado', { estado: 'activo' })
          .andWhere('flor.estado = :florEstado', { florEstado: 'activo' })
          .getMany(),
      ]);

      // Obtener flores únicas y ordenadas
      const floresMap = new Map<
        number,
        { id: number; nombre: string; color: string }
      >();
      arreglosFlor.forEach((af) => {
        if (af.flor && !floresMap.has(af.flor.idFlor)) {
          floresMap.set(af.flor.idFlor, {
            id: af.flor.idFlor,
            nombre: af.flor.nombre,
            color: af.flor.color,
          });
        }
      });
      const flores = Array.from(floresMap.values()).sort((a, b) =>
        a.nombre.localeCompare(b.nombre),
      );

      return {
        formasArreglo: formasArreglo.map((f) => ({
          id: f.idFormaArreglo,
          descripcion: f.descripcion,
        })),
        precios: {
          min: parseFloat(precios?.min || '0'),
          max: parseFloat(precios?.max || '0'),
        },
        flores: flores,
      };
    } catch (error) {
      console.error('Error en getFiltrosDisponibles:', error);
      throw error;
    }
  }

  /** Crear arreglos por lote (JSON) incluyendo flores, accesorios e imágenes */
  async createBatch(items: CreateArregloWithMediaDto[]) {
    // 1. Pre-Validación Masiva de IDs (Flores y Accesorios)
    const florIds = new Set<number>();
    const accesorioIds = new Set<number>();

    items.forEach((item) => {
      item.flores?.forEach((f) => florIds.add(f.idFlor));
      item.accesorios?.forEach((a) => accesorioIds.add(a.idAccesorio));
    });

    // Validar Flores
    if (florIds.size > 0) {
      const dbFlores = await this.florRepository.find({
        where: { idFlor: In([...florIds]) },
        select: ['idFlor'],
      });
      const foundFlorIds = new Set(dbFlores.map((f) => f.idFlor));
      const missingFlores = [...florIds].filter((id) => !foundFlorIds.has(id));

      if (missingFlores.length > 0) {
        throw new BadRequestException(
          `Los siguientes IDs de flores no existen: [${missingFlores.join(', ')}]`,
        );
      }
    }

    // Validar Accesorios
    if (accesorioIds.size > 0) {
      const dbAccesorios = await this.accesorioRepository.find({
        where: { idAccesorio: In([...accesorioIds]) },
        select: ['idAccesorio'],
      });
      const foundAccesorioIds = new Set(dbAccesorios.map((a) => a.idAccesorio));
      const missingAccesorios = [...accesorioIds].filter(
        (id) => !foundAccesorioIds.has(id),
      );

      if (missingAccesorios.length > 0) {
        throw new BadRequestException(
          `Los siguientes IDs de accesorios no existen: [${missingAccesorios.join(
            ', ',
          )}]`,
        );
      }
    }

    // 2. Transacción TypeORM para asegurar atomicidad del lote completo
    return await this.arregloRepository.manager.transaction(async (manager) => {
      const arregloRepo = manager.getRepository(Arreglo);
      const mediaRepo = manager.getRepository(ArregloMedia);

      // Usamos Promise.all para procesar paralelamente, pero cualquier error abortará la transacción
      const results = await Promise.all(
        items.map(async (item) => {
          // Extraemos 'imagenes' para procesarlas separadamente
          // 'flores' y 'accesorios' se mantienen en createDto y son procesados por this.create()
          const { imagenes, ...createDto } = item;

          // 1. Crear Arreglo y relaciones (Flores, Accesorios)
          const created = await this.create(createDto, manager);

          // 2. Procesar Imágenes (ArregloMedia)
          if (imagenes && imagenes.length > 0) {
            let hasPrimary = false;

            for (const imgDto of imagenes) {
              const objectKey = extractObjectKey(imgDto.url);

              const media = mediaRepo.create({
                idArreglo: created.idArreglo,
                url: imgDto.url,
                objectKey: objectKey,
                provider: 'external',
                contentType: 'application/octet-stream', // Desconocido al venir via JSON
                orden: imgDto.orden ?? 0,
                isPrimary: imgDto.isPrimary ?? false,
                altText: imgDto.altText,
                activo: true,
              });

              const savedMedia = await mediaRepo.save(media);

              // 3. Actualizar imagen principal en Arreglo si corresponde
              if (savedMedia.isPrimary) {
                // Si hay múltiples marcadas como primary/true, la última ganará o podríamos forzar solo la primera.
                // Aquí actualizamos cada vez que encontramos una primary.
                await arregloRepo.update(created.idArreglo, {
                  url: savedMedia.url,
                });
                hasPrimary = true;
              }
            }
          }

          // Retornar entidad completa con relaciones actualizadas
          const withRelations = await arregloRepo.findOne({
            where: { idArreglo: created.idArreglo },
            relations: [
              'formaArreglo',
              'media',
              // 'arreglosFlor', // Si existieran en la entidad y se quisieran devolver
              // 'accesoriosArreglo'
            ],
            order: { media: { orden: 'ASC', idArregloMedia: 'ASC' } },
          });
          return withRelations!;
        }),
      );

      return results;
    });
  }
}
