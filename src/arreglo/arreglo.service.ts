import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
import { ArregloPublicResponseDto } from './dto/arreglo-public-response.dto';
import { ArregloMedia } from './entities/arreglo-media.entity';
import { SpacesService } from 'src/common/storage/spaces.service';
import { CreateLoteArregloItemDto } from './dto/create-lote-arreglos.dto';

@Injectable()
export class ArregloService {
  constructor(
    @InjectRepository(Arreglo)
    private readonly arregloRepository: Repository<Arreglo>,
    @InjectRepository(FormaArreglo)
    private readonly formaArregloRepository: Repository<FormaArreglo>,
    @InjectRepository(ArregloFlor)
    private readonly arregloFlorRepository: Repository<ArregloFlor>,
    @InjectRepository(ArregloMedia)
    private readonly mediaRepository: Repository<ArregloMedia>,
    private readonly spaces: SpacesService,
  ) {}

  async create(createArregloDto: CreateArregloDto, manager?: EntityManager) {
    try {
      const { idFormaArreglo, ...arregloData } = createArregloDto;
      const formaRepo = manager ? manager.getRepository(FormaArreglo) : this.formaArregloRepository;
      const arregloRepo = manager ? manager.getRepository(Arreglo) : this.arregloRepository;

      const formaArreglo = await findEntityOrFail(
        formaRepo,
        { idFormaArreglo },
        'La forma de arreglo no fue encontrada o no existe',
      );

      const newArreglo = arregloRepo.create({
        ...arregloData,
        formaArreglo,
      });

      await arregloRepo.save(newArreglo);

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
      const floresMap = new Map<number, { id: number; nombre: string; color: string }>();
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

  /** Crear arreglos por lote con index pairing y subida a Spaces */
  async createBatch(
    items: CreateLoteArregloItemDto[],
    files: { buffer: Buffer; mimetype: string; originalname: string }[],
  ) {
    if (!Array.isArray(items) || !Array.isArray(files)) {
      throw new BadRequestException('Items y archivos son requeridos.');
    }
    if (items.length !== files.length) {
      throw new BadRequestException('El número de items debe coincidir con los archivos.');
    }

    const uploadedKeys: string[] = [];
    try {
      return await this.arregloRepository.manager.transaction(async (manager) => {
        const arregloRepo = manager.getRepository(Arreglo);
        const mediaRepo = manager.getRepository(ArregloMedia);

        const results = await Promise.all(
          items.map(async (item, idx) => {
            const created = await this.create(item, manager);

            const file = files[idx];
            let publicUrl: string | undefined;
            let objectKey: string | undefined;
            let provider = 'spaces';

            if (item.imageUrl) {
              publicUrl = item.imageUrl;
              objectKey = item.imageUrl;
              provider = 'external';
            } else {
              const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
              if (!allowed.includes(file.mimetype)) {
                throw new BadRequestException(`Tipo de archivo no permitido: ${file.mimetype}`);
              }
              const keyPrefix = `arreglos/${created.idArreglo}`;
              const { objectKey: key, publicUrl: url } = await this.spaces.uploadObject({
                buffer: file.buffer,
                contentType: file.mimetype,
                keyPrefix,
                fileName: file.originalname,
                acl: 'public-read',
              });
              publicUrl = url;
              objectKey = key;
              uploadedKeys.push(key);
            }

            const ordenBase = item.media?.orden ?? 0;
            const isPrimary = item.media?.isPrimary ?? ordenBase === 0;

            const media = mediaRepo.create({
              idArreglo: created.idArreglo,
              url: publicUrl!,
              objectKey: objectKey!,
              provider,
              contentType: file.mimetype,
              orden: ordenBase,
              isPrimary,
              altText: item.media?.altText,
              activo: true,
            });

            const savedMedia = await mediaRepo.save(media);

            if (isPrimary) {
              await arregloRepo.update(created.idArreglo, { url: savedMedia.url });
            }

            const withMedia = await arregloRepo.findOne({
              where: { idArreglo: created.idArreglo },
              relations: ['formaArreglo', 'media'],
              order: { media: { orden: 'ASC', idArregloMedia: 'ASC' } },
            });
            return withMedia!;
          }),
        );

        return results;
      });
    } catch (error) {
      for (const key of uploadedKeys) {
        try {
          await this.spaces.deleteObject(key);
        } catch {/* ignore */}
      }
      throw error;
    }
  }
}
