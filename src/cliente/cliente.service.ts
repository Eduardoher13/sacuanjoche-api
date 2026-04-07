import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { handleDbException } from 'src/common/helpers/db-exception.helper';
import { FindClientesDto } from './dto/find-clientes.dto';

@Injectable()
export class ClienteService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
  ) {}

  async create(createClienteDto: CreateClienteDto) {
    try {
      const newCliente = this.clienteRepository.create(createClienteDto);

      await this.clienteRepository.save(newCliente);

      return newCliente;
    } catch (error) {
      handleDbException(error);
    }
  }

  async findAll(filters: FindClientesDto) {
    const { limit = 10, offset = 0, q } = filters;

    const qb = this.clienteRepository.createQueryBuilder('cliente');

    qb.take(limit).skip(offset);

    if (q) {
      const search = `%${q}%`;
      qb.andWhere(
        '(cliente.primerNombre ILIKE :search OR cliente.segundoNombre ILIKE :search OR cliente.primerApellido ILIKE :search OR cliente.segundoApellido ILIKE :search OR cliente.telefono ILIKE :search OR cliente.nombreEmpresa ILIKE :search)',
        { search },
      );
    }

    qb.orderBy('cliente.fechaCreacion', 'DESC').addOrderBy(
      'cliente.idCliente',
      'DESC',
    );

    return qb.getMany();
  }

  async findOne(id: number) {
    const cliente = await this.clienteRepository.findOne({
      where: { idCliente: id },
    });

    if (!cliente) {
      throw new NotFoundException(`El cliente con id ${id} no fue encontrado`);
    }

    return cliente;
  }

  async update(id: number, updateClienteDto: UpdateClienteDto) {
    try {
      const cliente = await this.clienteRepository.preload({
        idCliente: id,
        ...updateClienteDto,
      });

      if (!cliente) {
        throw new NotFoundException(
          `El cliente con id ${id} no fue encontrado`,
        );
      }

      return this.clienteRepository.save(cliente);
    } catch (error) {
      handleDbException(error);
    }
  }

  async remove(id: number) {
    const cliente = await this.findOne(id);
    await this.clienteRepository.remove(cliente);
  }
}
