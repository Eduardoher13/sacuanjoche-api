import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Empleado } from './entities/empleado.entity';
import { CreateEmpleadoDto } from './dto/create-empleado.dto';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto';
import { handleDbException } from 'src/common/helpers/db-exception.helper';
import { FindEmpleadosDto } from './dto/find-empleados.dto';

@Injectable()
export class EmpleadoService {
  constructor(
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
  ) {}

  async create(createEmpleadoDto: CreateEmpleadoDto) {
    try {
      const newEmpleado = this.empleadoRepository.create({
        ...createEmpleadoDto,
      });

      await this.empleadoRepository.save(newEmpleado);

      return newEmpleado;
    } catch (error) {
      handleDbException(error);
    }
  }

  async findAll(filters: FindEmpleadosDto) {
    const { limit = 10, offset = 0, q } = filters;

    const qb = this.empleadoRepository
      .createQueryBuilder('empleado')
      .leftJoinAndSelect('empleado.user', 'user');

    qb.take(limit).skip(offset);

    if (q) {
      const search = `%${q}%`;
      qb.andWhere(
        '(empleado.primerNombre ILIKE :search OR empleado.primerApellido ILIKE :search OR empleado.telefono ILIKE :search)',
        { search },
      );
    }

    qb.orderBy('empleado.fechaCreacion', 'DESC').addOrderBy(
      'empleado.idEmpleado',
      'DESC',
    );

    return qb.getMany();
  }

  async findOne(id: number) {
    const empleado = await this.empleadoRepository.findOneBy({
      idEmpleado: id,
    });

    if (!empleado) {
      throw new NotFoundException(`El empleado con id ${id} no fue encontrado`);
    }

    return empleado;
  }

  async update(id: number, updateEmpleadoDto: UpdateEmpleadoDto) {
    try {
      const empleado = await this.empleadoRepository.preload({
        idEmpleado: id,
        ...updateEmpleadoDto,
      });

      if (!empleado) {
        throw new NotFoundException(
          `El empleado con id ${id} no fue encontrado`,
        );
      }

      return this.empleadoRepository.save(empleado);
    } catch (error) {
      handleDbException(error);
    }
  }

  async remove(id: number) {
    const empleado = await this.findOne(id);
    await this.empleadoRepository.remove(empleado);
  }
}
