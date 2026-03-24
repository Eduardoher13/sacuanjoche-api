import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flor } from './entities/flor.entity';
import { CreateFlorDto } from './dto/create-flor.dto';
import { UpdateFlorDto } from './dto/update-flor.dto';
import { handleDbException } from 'src/common/helpers/db-exception.helper';
import { FindFloresDto } from './dto/find-flores.dto';
import { ArticuloEstado } from 'src/common/enums';

@Injectable()
export class FlorService {
  constructor(
    @InjectRepository(Flor)
    private readonly florRepository: Repository<Flor>,
  ) {}

  async create(createFlorDto: CreateFlorDto) {
    try {
      const newFlor = this.florRepository.create({
        ...createFlorDto,
      });

      await this.florRepository.save(newFlor);

      return newFlor;
    } catch (error) {
      handleDbException(error);
    }
  }

  async findAll(filters: FindFloresDto) {
    const { limit = 10, offset = 0, q } = filters;

    const qb = this.florRepository.createQueryBuilder('flor');

    qb.take(limit).skip(offset);

    if (q) {
      const search = `%${q}%`;
      qb.andWhere(
        '(flor.nombre ILIKE :search OR flor.color ILIKE :search OR flor.tipo ILIKE :search)',
        { search },
      );
    } 

    qb.orderBy('flor.nombre', 'ASC').addOrderBy('flor.idFlor', 'ASC');

    return qb.getMany();
  }

  async findOne(id: number) {
    const flor = await this.florRepository.findOneBy({ idFlor: id });

    if (!flor) {
      throw new NotFoundException(`La flor con id ${id} no fue encontrada`);
    }

    return flor;
  }

  async update(id: number, updateFlorDto: UpdateFlorDto) {
    try {
      const flor = await this.florRepository.preload({
        idFlor: id,
        ...updateFlorDto,
      });

      if (!flor) {
        throw new NotFoundException(`La flor con id ${id} no fue encontrada`);
      }

      return this.florRepository.save(flor);
    } catch (error) {
      handleDbException(error);
    }
  }

  async remove(id: number) {
    const flor = await this.findOne(id);
    await this.florRepository.remove(flor);
  }

  /**
   * Obtener flores activas para catálogo público
   * Solo retorna id, nombre y color
   */
  async findPublic() {
    const flores = await this.florRepository.find({
      where: { estado: ArticuloEstado.ACTIVO },
      select: ['idFlor', 'nombre', 'color'],
      order: { nombre: 'ASC' },
    });

    return flores;
  }
}
