import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pedido } from './entities/pedido.entity';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { handleDbException } from 'src/common/helpers/db-exception.helper';
import { Cliente } from 'src/cliente/entities/cliente.entity';
import { Empleado } from 'src/empleado/entities/empleado.entity';
import { ContactoEntrega } from 'src/contacto-entrega/entities/contacto-entrega.entity';
import { Direccion } from 'src/direccion/entities/direccion.entity';
import { findEntityOrFail } from 'src/common/helpers/find-entity.helper';
import { FindPedidosDto } from './dto/find-pedidos.dto';
import { Pago } from 'src/pago/entities/pago.entity';
import {
  PedidoCanal,
  PedidoEstado,
  PagoEstado,
  EstadoActivo,
} from 'src/common/enums';
import { PedidoHistorialService } from 'src/pedido-historial/pedido-historial.service';
import { FolioService } from 'src/folio/folio.service';
import { DetallePedido } from 'src/detalle-pedido/entities/detalle-pedido.entity';
import { Folio } from 'src/folio/entities/folio.entity';

@Injectable()
export class PedidoService {
  constructor(
    @InjectRepository(Pedido)
    private readonly pedidoRepository: Repository<Pedido>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
    @InjectRepository(Direccion)
    private readonly direccionRepository: Repository<Direccion>,
    @InjectRepository(ContactoEntrega)
    private readonly contactoEntregaRepository: Repository<ContactoEntrega>,
    @InjectRepository(Pago)
    private readonly pagoRepository: Repository<Pago>,
    @InjectRepository(DetallePedido)
    private readonly detallePedidoRepository: Repository<DetallePedido>,
    @InjectRepository(Folio)
    private readonly folioRepository: Repository<Folio>,
    private readonly pedidoHistorialService: PedidoHistorialService,
    private readonly folioService: FolioService,
  ) {}

  async create(createPedidoDto: CreatePedidoDto) {
    try {
      const {
        idEmpleado,
        idCliente,
        idDireccion,
        idContactoEntrega,
        idPago,
        idFolio,
        canal = PedidoCanal.WEB, // Por defecto es 'web' si no se especifica
        ...pedido
      } = createPedidoDto;

      // Validar canal
      const canalNormalizado = canal || PedidoCanal.WEB;

      let pago = null;
      let estadoInicial = PedidoEstado.PENDIENTE;

      // FLUJO CANAL WEB: Pago es obligatorio y debe estar completado
      if (canalNormalizado === PedidoCanal.WEB) {
        if (!idPago) {
          throw new BadRequestException(
            'El ID del pago es requerido para pedidos del canal web. El pago debe estar completado antes de crear el pedido.',
          );
        }

        pago = await this.pagoRepository.findOne({
          where: { idPago: idPago },
          relations: ['metodoPago'],
        });

        if (!pago) {
          throw new NotFoundException(
            `El pago con id ${idPago} no fue encontrado`,
          );
        }

        // Validar que el método de pago sea compatible con el canal WEB
        if (pago.metodoPago) {
          const canalesDisponibles = pago.metodoPago.canalesDisponibles || [
            PedidoCanal.WEB,
            PedidoCanal.INTERNO,
          ];

          if (!canalesDisponibles.includes(PedidoCanal.WEB)) {
            throw new BadRequestException(
              `El método de pago "${pago.metodoPago.descripcion}" no está disponible para pedidos del canal web. Solo está disponible en: ${canalesDisponibles.join(', ')}`,
            );
          }
        }

        // Validar que el pago esté completado (PAGADO)
        if (pago.estado !== PagoEstado.PAGADO) {
          throw new BadRequestException(
            `El pago con id ${idPago} no está completado. Estado actual: ${pago.estado}. En el canal web, el pedido solo puede crearse con un pago completado (${PagoEstado.PAGADO}).`,
          );
        }

        // Validar que el monto del pago coincida con el total del pedido
        // Nota: El totalPedido se calculará automáticamente cuando se agreguen las líneas de detalle
        // Por ahora, validamos que el pago tenga un monto válido
        const montoPago = Number(pago.monto || 0);

        if (montoPago <= 0) {
          throw new BadRequestException(
            `El monto del pago debe ser mayor a 0. Monto actual: ${montoPago}.`,
          );
        }

        // Validar que el pago no esté ya asociado a otro pedido
        const pedidoExistente = await this.pedidoRepository.findOne({
          where: { idPago: idPago },
        });

        if (pedidoExistente) {
          throw new BadRequestException(
            `El pago con id ${idPago} ya está asociado al pedido ${pedidoExistente.idPedido}.`,
          );
        }

        estadoInicial = PedidoEstado.PROCESANDO; // En canal web, el pedido se crea ya pagado y pasa a procesando
      }

      // FLUJO CANAL INTERNO: Pago es opcional
      // Si se proporciona idPago, validar que existe (pero puede estar pendiente)
      if (canalNormalizado === PedidoCanal.INTERNO && idPago) {
        pago = await this.pagoRepository.findOne({
          where: { idPago: idPago },
        });

        if (!pago) {
          throw new NotFoundException(
            `El pago con id ${idPago} no fue encontrado`,
          );
        }

        // Si el pago está completado, el pedido se crea como procesando
        if (pago.estado === PagoEstado.PAGADO) {
          estadoInicial = PedidoEstado.PROCESANDO;
        } else {
          estadoInicial = PedidoEstado.PENDIENTE;
        }

        // Validar que el pago no esté ya asociado a otro pedido
        const pedidoExistente = await this.pedidoRepository.findOne({
          where: { idPago: idPago },
        });

        if (pedidoExistente) {
          throw new BadRequestException(
            `El pago con id ${idPago} ya está asociado al pedido ${pedidoExistente.idPedido}.`,
          );
        }
      }

      const empleado = await findEntityOrFail(
        this.empleadoRepository,
        { idEmpleado: idEmpleado },
        `El empleado no fue encontrado o no existe`,
      );

      const cliente = await findEntityOrFail(
        this.clienteRepository,
        { idCliente: idCliente },
        `El cliente no fue encontrado o no existe`,
      );

      // SOLO si el cliente seleccionó en mapa (mandó idDireccion)
      const direccion = idDireccion
        ? await findEntityOrFail(
            this.direccionRepository,
            { idDireccion: idDireccion },
            `La dirección no fue encontrada o no existe`,
          )
        : null;

      const contactoEntrega = await findEntityOrFail(
        this.contactoEntregaRepository,
        { idContactoEntrega: idContactoEntrega },
        `El contacto de entrega no fue encontrado o no existe`,
      );

      // Validar y obtener el folio del DTO
      const folio = await findEntityOrFail(
        this.folioRepository,
        { idFolio: idFolio },
        `El folio con id ${idFolio} no fue encontrado o no existe`,
      );

      // Verificar que el folio esté activo
      if (folio.activo !== EstadoActivo.ACTIVO) {
        throw new BadRequestException(
          `El folio con id ${idFolio} no está activo`,
        );
      }

      // Generar número de folio para el pedido
      let numeroPedido: string | undefined;
      try {
        let siguiente = folio.ultimoValor + 1;

        if (siguiente > folio.valorFinal) {
          throw new BadRequestException(
            `Se alcanzó el valor máximo del folio (${folio.valorFinal}).`,
          );
        }

        // .padStart rellena con ceros a la izquierda hasta que alcanza la longitud establecida para ese folio
        const numeroFormateado = String(siguiente).padStart(folio.longitud, '0');

        if (folio.mascara) {
          numeroPedido = folio.mascara.replace(/\{0+\}/, numeroFormateado);
        } else {
          numeroPedido = numeroFormateado;
        }

        // Actualizar el último valor del folio
        folio.ultimoValor = siguiente;
        await this.folioRepository.save(folio);
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        // Si hay otro error, continuar sin número de pedido
        // No lanzar error para no bloquear la creación del pedido
      }

      // Convertir fechaEntregaEstimada de string a Date si está presente
      const pedidoData: any = {
        ...pedido,
        estado: estadoInicial,
        canal: canalNormalizado,
        idPago: pago?.idPago,
        totalProductos: 0,
        totalPedido: 0,
        numeroPedido,
        idFolio,
        empleado,
        cliente,
        //  si no hay map pin, no bloquee el pedido (direccionTxt ya viene)
        ...(direccion ? { direccion } : {}),
        contactoEntrega,
      };

      if (pedidoData.fechaEntregaEstimada !== undefined && pedidoData.fechaEntregaEstimada !== null) {
        pedidoData.fechaEntregaEstimada = this.parseDateString(pedidoData.fechaEntregaEstimada);
      }

      const newPedido = this.pedidoRepository.create(pedidoData);

      const savedPedido = await this.pedidoRepository.save(newPedido);

      // TypeORM save puede devolver Pedido | Pedido[], pero como pasamos un solo objeto, es Pedido
      const pedidoGuardado = Array.isArray(savedPedido) ? savedPedido[0] : savedPedido;

      return await this.pedidoRepository.findOne({
        where: { idPedido: pedidoGuardado.idPedido },
        relations: [
          'empleado',
          'cliente',
          'direccion',
          'contactoEntrega',
          'pago',
          'envio',
          'folio',
        ],
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      handleDbException(error);
    }
  }

  async findAll(filters: FindPedidosDto) {
    const { limit = 10, offset = 0, q } = filters;

    const qb = this.pedidoRepository
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.empleado', 'empleado')
      .leftJoinAndSelect('pedido.cliente', 'cliente')
      .leftJoinAndSelect('pedido.direccion', 'direccion')
      .leftJoinAndSelect('pedido.contactoEntrega', 'contactoEntrega')
      .leftJoinAndSelect('pedido.envio', 'envio')
      .leftJoinAndSelect('pedido.folio', 'folio');

    qb.take(limit).skip(offset);

    if (q) {
      const search = `%${q}%`;
      qb.andWhere(
        `(
          pedido.direccionTxt ILIKE :search OR
          CAST(pedido.idPedido AS TEXT) ILIKE :search OR
          cliente.primerNombre ILIKE :search OR
          cliente.primerApellido ILIKE :search OR
          empleado.primerNombre ILIKE :search OR
          empleado.primerApellido ILIKE :search OR
          contactoEntrega.nombre ILIKE :search OR
          contactoEntrega.apellido ILIKE :search OR
          contactoEntrega.telefono ILIKE :search
        )`,
        { search },
      );
    }

    qb.orderBy('pedido.fechaCreacion', 'DESC').addOrderBy(
      'pedido.idPedido',
      'DESC',
    );

    return qb.getMany();
  }

  async findOne(id: number) {
    const pedido = await this.pedidoRepository.findOne({
      where: { idPedido: id },
      relations: ['empleado', 'cliente', 'direccion', 'contactoEntrega', 'envio', 'folio'],
    });

    if (!pedido) {
      throw new NotFoundException(`El pedido con id ${id} no fue encontrado`);
    }

    // Obtener los detalles del pedido con la relación al arreglo
    const detalles = await this.detallePedidoRepository.find({
      where: { idPedido: id },
      relations: ['arreglo'],
      order: { idDetallePedido: 'ASC' },
    });

    // Agregar los detalles al objeto pedido
    return {
      ...pedido,
      detalles: detalles || [],
    };
  }

  async update(id: number, updatePedidoDto: UpdatePedidoDto) {
    try {
      const {
        idEmpleado,
        idCliente,
        idDireccion,
        idContactoEntrega,
        fechaEntregaEstimada,
        ...toUpdate
      } = updatePedidoDto;

      const empleado = await findEntityOrFail(
        this.empleadoRepository,
        { idEmpleado: idEmpleado },
        `El empleado no fue encontrado o no existe`,
      );

      const cliente = await findEntityOrFail(
        this.clienteRepository,
        { idCliente: idCliente },
        `El cliente no fue encontrado o no existe`,
      );

      const direccion = await findEntityOrFail(
        this.direccionRepository,
        { idDireccion: idDireccion },
        `La dirección no fue encontrada o no existe`,
      );

      const contactoEntrega = await findEntityOrFail(
        this.contactoEntregaRepository,
        { idContactoEntrega: idContactoEntrega },
        `El contacto de entrega no fue encontrado o no existe`,
      );

      // Convertir fechaEntregaEstimada de string a Date si está presente
      const updateData: any = {
        ...toUpdate,
        empleado,
        cliente,
        direccion,
        contactoEntrega,
      };

      if (fechaEntregaEstimada !== undefined) {
        updateData.fechaEntregaEstimada = fechaEntregaEstimada
          ? this.parseDateString(fechaEntregaEstimada)
          : null;
      }

      const pedido = await this.pedidoRepository.preload({
        idPedido: id,
        ...updateData,
      });

      if (!pedido) {
        throw new NotFoundException(`El pedido con id ${id} no fue encontrado`);
      }

      return this.pedidoRepository.save(pedido);
    } catch (error) {
      handleDbException(error);
    }
  }

  async remove(id: number) {
    const pedido = await this.findOne(id);
    await this.pedidoRepository.remove(pedido!);
  }

  /**
   * Asocia un pago a un pedido existente (útil para canal interno)
   * Permite que un empleado cree el pedido primero y luego procese el pago
   */
  async asociarPago(idPedido: number, idPago: number) {
    const pedido = await this.findOne(idPedido);
    const pago = await this.pagoRepository.findOne({
      where: { idPago: idPago },
      relations: ['metodoPago'],
    });

    if (!pago) {
      throw new NotFoundException(`El pago con id ${idPago} no fue encontrado`);
    }

    // Validar que el método de pago sea compatible con el canal del pedido
    if (pago.metodoPago) {
      const canalPedido = pedido.canal || PedidoCanal.WEB;
      const canalesDisponibles = pago.metodoPago.canalesDisponibles || [
        PedidoCanal.WEB,
        PedidoCanal.INTERNO,
      ];

      if (!canalesDisponibles.includes(canalPedido)) {
        throw new BadRequestException(
          `El método de pago "${pago.metodoPago.descripcion}" no está disponible para pedidos del canal "${canalPedido}". Canales disponibles: ${canalesDisponibles.join(', ')}`,
        );
      }
    }

    // Validar que el pago no esté ya asociado a otro pedido
    const pedidoExistente = await this.pedidoRepository.findOne({
      where: { idPago: idPago },
    });

    if (pedidoExistente) {
      throw new BadRequestException(
        `El pago con id ${idPago} ya está asociado al pedido ${pedidoExistente.idPedido}.`,
      );
    }

    // Validar que el pedido no tenga ya un pago asociado
    if (pedido.idPago !== null && pedido.idPago !== undefined) {
      throw new BadRequestException(
        `El pedido ${idPedido} ya tiene un pago asociado (id: ${pedido.idPago}).`,
      );
    }

    // Validar que el monto del pago coincida con el total del pedido
    const totalPedido = Number(pedido.totalPedido || 0);
    const montoPago = Number(pago.monto || 0);

    if (Math.abs(totalPedido - montoPago) > 0.01) {
      throw new BadRequestException(
        `El monto del pago (${montoPago}) no coincide con el total del pedido (${totalPedido}).`,
      );
    }

    // Asociar el pago al pedido
    pedido.idPago = pago.idPago;

    // Si el pago está completado, actualizar el estado del pedido
    if (pago.estado === PagoEstado.PAGADO) {
      pedido.estado = PedidoEstado.PROCESANDO;
    }

    await this.pedidoRepository.save(pedido);

    return await this.findOne(idPedido);
  }

  /**
   * Actualiza el estado de un pedido y registra el cambio en el historial
   */
  async updateEstado(
    idPedido: number,
    nuevoEstado: PedidoEstado,
    idEmpleado: number,
    nota?: string,
  ) {
    const pedido = await this.findOne(idPedido);
    const estadoAnterior = pedido.estado;

    // Validar que el estado nuevo sea diferente al actual
    if (estadoAnterior === nuevoEstado) {
      throw new BadRequestException(
        `El pedido ya está en el estado "${nuevoEstado}". No se puede cambiar al mismo estado.`,
      );
    }

    // Actualizar el estado del pedido
    pedido.estado = nuevoEstado;
    await this.pedidoRepository.save(pedido);

    // Registrar el cambio en el historial
    await this.pedidoHistorialService.create({
      idPedido,
      idEmpleado,
      estadoAnterior,
      estadoNuevo: nuevoEstado,
      nota,
    });

    return await this.findOne(idPedido);
  }

  // async findByCliente(idCliente: number) {}

  // async findByEmpleado(idEmpleado: number) {}

  // async findByDateRange(fechaInicio: Date, fechaFin: Date) {}

  /**
   * Convierte un string de fecha (YYYY-MM-DD o DD/MM/YYYY) a un objeto Date
   * @param dateString String de fecha en formato YYYY-MM-DD o DD/MM/YYYY
   * @returns Objeto Date o null si el formato no es válido
   */
  private parseDateString(dateString: string): Date {
    if (!dateString || typeof dateString !== 'string') {
      return null as any;
    }

    // Formato YYYY-MM-DD
    const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
    // Formato DD/MM/YYYY
    const ddmmyyyyPattern = /^\d{2}\/\d{2}\/\d{4}$/;

    let year: number, month: number, day: number;

    if (isoPattern.test(dateString)) {
      // Formato YYYY-MM-DD
      [year, month, day] = dateString.split('-').map(Number);
    } else if (ddmmyyyyPattern.test(dateString)) {
      // Formato DD/MM/YYYY
      const parts = dateString.split('/');
      day = Number(parts[0]);
      month = Number(parts[1]);
      year = Number(parts[2]);
    } else {
      // Si no coincide con ningún formato, intentar parsear directamente
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        throw new BadRequestException(
          `Formato de fecha inválido: ${dateString}. Use YYYY-MM-DD o DD/MM/YYYY`,
        );
      }
      return date;
    }

    // Crear fecha (month - 1 porque Date usa 0-11 para meses)
    const date = new Date(year, month - 1, day);
    
    // Validar que la fecha sea válida
    if (isNaN(date.getTime())) {
      throw new BadRequestException(
        `Fecha inválida: ${dateString}. Verifique que la fecha sea correcta.`,
      );
    }

    return date;
  }
}
