import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Compania } from './entities/compañia.entity';
import { CreateCompaniaDto } from './dto/create-compañia.dto';
import { UpdateCompaniaDto } from './dto/update-compañia.dto';
import { FindCompañiasDto } from './dto/find-compañias.dto';
import { handleDbException } from 'src/common/helpers/db-exception.helper';

@Injectable()
export class CompaniaService {
  constructor(
    @InjectRepository(Compania)
    private readonly companiaRepository: Repository<Compania>,
  ) {}

  async create(createCompaniaDto: CreateCompaniaDto) {
    try {
      const compania = this.companiaRepository.create(createCompaniaDto);
      return await this.companiaRepository.save(compania);
    } catch (error) {
      handleDbException(error);
    }
  }

  async findAll(filters: FindCompañiasDto) {
    const { limit = 10, offset = 0, q } = filters;

    const qb = this.companiaRepository.createQueryBuilder('compania');

    qb.take(limit).skip(offset);

    if (q) {
      const search = `%${q}%`;
      qb.andWhere(
        `(compania.nombre ILIKE :search OR compania.nombreComercial ILIKE :search OR compania.ruc ILIKE :search)`,
        { search },
      );
    }

    qb.orderBy('compania.nombre', 'ASC').addOrderBy(
      'compania.idCompania',
      'ASC',
    );

    return qb.getMany();
  }

  async findOne(id: number) {
    const compania = await this.companiaRepository.findOneBy({
      idCompania: id,
    });

    if (!compania) {
      throw new NotFoundException(`La compania con id ${id} no fue encontrada`);
    }

    return compania;
  }

  async update(id: number, updateCompaniaDto: UpdateCompaniaDto) {
    try {
      const compania = await this.companiaRepository.preload({
        idCompania: id,
        ...updateCompaniaDto,
      });

      if (!compania) {
        throw new NotFoundException(
          `La compania con id ${id} no fue encontrada`,
        );
      }

      return await this.companiaRepository.save(compania);
    } catch (error) {
      handleDbException(error);
    }
  }

  async remove(id: number) {
    const compania = await this.findOne(id);
    await this.companiaRepository.remove(compania);
  }
}
