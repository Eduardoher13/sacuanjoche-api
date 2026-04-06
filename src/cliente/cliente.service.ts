import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { handleDbException } from 'src/common/helpers/db-exception.helper';
import { FindClientesDto } from './dto/find-clientes.dto';
import { Compania } from 'src/compania/entities/compañia.entity';

@Injectable()
export class ClienteService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
    @InjectRepository(Compania)
    private readonly companiaRepository: Repository<Compania>,
  ) {}

  async create(createClienteDto: CreateClienteDto) {
    try {
      const { idCompania, ...clienteData } = createClienteDto;

      let compania: Compania | null = null;
      if (idCompania) {
        compania = await this.companiaRepository.findOneBy({
          idCompania,
        });

        if (!compania) {
          throw new NotFoundException(
            `La compania con id ${idCompania} no fue encontrada`,
          );
        }
      }

      const newCliente = this.clienteRepository.create({
        ...clienteData,
        compania,
      });

      await this.clienteRepository.save(newCliente);

      return newCliente;
    } catch (error) {
      handleDbException(error);
    }
  }

  async findAll(filters: FindClientesDto) {
    const { limit = 10, offset = 0, q, idCompania } = filters;

    const qb = this.clienteRepository
      .createQueryBuilder('cliente')
      .leftJoinAndSelect('cliente.compania', 'compania');

    qb.take(limit).skip(offset);

    if (idCompania !== undefined) {
      qb.andWhere('compania.idCompania = :idCompania', { idCompania });
    }

    if (q) {
      const search = `%${q}%`;
      qb.andWhere(
        '(cliente.primerNombre ILIKE :search OR cliente.segundoNombre ILIKE :search OR cliente.primerApellido ILIKE :search OR cliente.segundoApellido ILIKE :search OR cliente.telefono ILIKE :search OR compania.nombre ILIKE :search)',
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
      relations: ['compania'],
    });

    if (!cliente) {
      throw new NotFoundException(`El cliente con id ${id} no fue encontrado`);
    }

    return cliente;
  }

  async update(id: number, updateClienteDto: UpdateClienteDto) {
    try {
      const { idCompania, ...clienteData } = updateClienteDto;

      const preloadData: Partial<Cliente> = {
        idCliente: id,
        ...clienteData,
      };

      if (idCompania !== undefined) {
        if (idCompania === null) {
          preloadData.compania = null;
        } else {
          const compania = await this.companiaRepository.findOneBy({
            idCompania,
          });

          if (!compania) {
            throw new NotFoundException(
              `La compania con id ${idCompania} no fue encontrada`,
            );
          }

          preloadData.compania = compania;
        }
      }

      const cliente = await this.clienteRepository.preload({
        ...preloadData,
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
