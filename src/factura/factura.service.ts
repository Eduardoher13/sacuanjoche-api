import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Factura } from './entities/factura.entity';
import { CreateFacturaDto } from './dto/create-factura.dto';
import { UpdateFacturaDto } from './dto/update-factura.dto';
import { CrearFacturaManualDto } from './dto/crear-factura-manual.dto';
import { Pedido } from 'src/pedido/entities/pedido.entity';
import { Empleado } from 'src/empleado/entities/empleado.entity';
import { handleDbException } from 'src/common/helpers/db-exception.helper';
import { findEntityOrFail } from 'src/common/helpers/find-entity.helper';
import { FindFacturasDto } from './dto/find-facturas.dto';
import { DetallePedido } from 'src/detalle-pedido/entities/detalle-pedido.entity';
import { FacturaDetalle } from 'src/factura-detalle/entities/factura-detalle.entity';
import { PagoEstado, FacturaEstado, PedidoCanal, EstadoActivo } from 'src/common/enums';
import { FolioService } from 'src/folio/folio.service';

@Injectable()
export class FacturaService {
  constructor(
    @InjectRepository(Factura)
    private readonly facturaRepository: Repository<Factura>,
    @InjectRepository(Pedido)
    private readonly pedidoRepository: Repository<Pedido>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(DetallePedido)
    private readonly detallePedidoRepository: Repository<DetallePedido>,
    @InjectRepository(FacturaDetalle)
    private readonly facturaDetalleRepository: Repository<FacturaDetalle>,
    private readonly folioService: FolioService,
  ) {}

  async create(createFacturaDto: CreateFacturaDto) {
    try {
      const { idPedido, idEmpleado, ...facturaData } = createFacturaDto;

      const [pedido, empleado] = await Promise.all([
        findEntityOrFail(
          this.pedidoRepository,
          { idPedido },
          'El pedido no fue encontrado o no existe',
        ),
        findEntityOrFail(
          this.empleadoRepository,
          { idEmpleado },
          'El empleado no fue encontrado o no existe',
        ),
      ]);

      const newFactura = this.facturaRepository.create({
        idPedido: pedido.idPedido,
        idEmpleado: empleado.idEmpleado,
        numFactura: facturaData.numFactura,
        idFolio: facturaData.idFolio,
        montoTotal: facturaData.montoTotal,
        estado: facturaData.estado || FacturaEstado.PENDIENTE,
      });

      await this.facturaRepository.save(newFactura);

      return this.facturaRepository.findOne({
        where: { idFactura: newFactura.idFactura },
        relations: ['pedido', 'empleado'],
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      handleDbException(error);
    }
  }

  async crearFacturaManual(crearFacturaManualDto: CrearFacturaManualDto) {
    try {
      const { idEmpleado, montoTotal, estado } = crearFacturaManualDto;

      const empleado = await findEntityOrFail(
        this.empleadoRepository,
        { idEmpleado },
        'El empleado no fue encontrado o no existe',
      );

      const numFactura = await this.generarNumeroFactura();
      const idFolio = await this.obtenerFolioFactura();

      const nuevaFactura = this.facturaRepository.create({
        idPedido: null,
        idEmpleado: empleado.idEmpleado,
        numFactura,
        idFolio,
        montoTotal,
        estado: estado || FacturaEstado.PENDIENTE,
      });

      await this.facturaRepository.save(nuevaFactura);

      return this.facturaRepository.findOne({
        where: { idFactura: nuevaFactura.idFactura },
        relations: ['pedido', 'empleado'],
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      handleDbException(error);
    }
  }

  async findAll(filters: FindFacturasDto) {
    const { limit = 10, offset = 0, q } = filters;

    const qb = this.facturaRepository
      .createQueryBuilder('factura')
      .leftJoinAndSelect('factura.pedido', 'pedido')
      .leftJoinAndSelect('factura.empleado', 'empleado');

    qb.take(limit).skip(offset);

    if (q) {
      const search = `%${q}%`;
      qb.andWhere(
        '(factura.numFactura ILIKE :search OR factura.estado ILIKE :search OR CAST(pedido.idPedido AS TEXT) ILIKE :search OR empleado.primerNombre ILIKE :search OR empleado.primerApellido ILIKE :search)',
        { search },
      );
    }

    qb.orderBy('factura.fechaEmision', 'DESC').addOrderBy(
      'factura.idFactura',
      'DESC',
    );

    return qb.getMany();
  }

  async findOne(id: number) {
    const factura = await this.facturaRepository.findOne({
      where: { idFactura: id },
      relations: [
        'pedido',
        'pedido.cliente',
        'empleado',
        'detallesFactura',
        'detallesFactura.arreglo',
      ],
    });

    if (!factura) {
      throw new NotFoundException(`La factura con id ${id} no fue encontrada`);
    }

    return factura;
  }

  async update(id: number, updateFacturaDto: UpdateFacturaDto) {
    try {
      const { idPedido, idEmpleado, ...toUpdate } = updateFacturaDto;

      const pedido =
        idPedido !== undefined
          ? await findEntityOrFail(
              this.pedidoRepository,
              { idPedido },
              'El pedido no fue encontrado o no existe',
            )
          : undefined;

      const empleado =
        idEmpleado !== undefined
          ? await findEntityOrFail(
              this.empleadoRepository,
              { idEmpleado },
              'El empleado no fue encontrado o no existe',
            )
          : undefined;

      const factura = await this.facturaRepository.preload({
        idFactura: id,
        ...toUpdate,
        pedido,
        empleado,
      });

      if (!factura) {
        throw new NotFoundException(
          `La factura con id ${id} no fue encontrada`,
        );
      }

      return this.facturaRepository.save(factura);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      handleDbException(error);
    }
  }

  async remove(id: number) {
    const factura = await this.findOne(id);
    await this.facturaRepository.remove(factura);
  }

  /**
   * Convierte un pedido en una factura
   * Copia toda la información del pedido y sus detalles a la factura
   * 
   * Validaciones según el canal:
   * - Canal WEB: Requiere pago completado obligatoriamente
   * - Canal INTERNO: Puede facturarse sin pago o con pago pendiente
   * 
   * El estado de la factura se determina según el estado del pago:
   * - Si hay pago completado: FacturaEstado.PAGADO
   * - Si no hay pago o está pendiente: FacturaEstado.PENDIENTE
   */
  async crearFacturaDesdePedido(idPedido: number, idEmpleado: number) {
    try {
      // Obtener el pedido con todas sus relaciones
      const pedido = await this.pedidoRepository.findOne({
        where: { idPedido },
        relations: ['pago', 'factura', 'detallesPedido', 'detallesPedido.arreglo'],
      });

      if (!pedido) {
        throw new NotFoundException(
          `El pedido con id ${idPedido} no fue encontrado`,
        );
      }

      // Validación según el canal del pedido
      const canalPedido = pedido.canal || PedidoCanal.WEB;
      let estadoFactura = FacturaEstado.PENDIENTE;

      // CANAL WEB: Requiere pago completado obligatoriamente
      if (canalPedido === PedidoCanal.WEB) {
        if (!pedido.pago) {
          throw new BadRequestException(
            `El pedido ${idPedido} del canal web no tiene un pago asociado. Solo se pueden facturar pedidos web que han sido pagados.`,
          );
        }

        // Validar que el pago esté completado
        // Comparar como string para evitar problemas de tipo
        const estadoPago = String(pedido.pago.estado).toLowerCase();
        const estadoPagado = String(PagoEstado.PAGADO).toLowerCase();
        
        if (estadoPago !== estadoPagado) {
          throw new BadRequestException(
            `El pedido ${idPedido} no está pagado. Estado del pago: ${pedido.pago.estado}. Solo se pueden facturar pedidos web con pago completado (${PagoEstado.PAGADO}).`,
          );
        }

        estadoFactura = FacturaEstado.PAGADO;
      }

      // CANAL INTERNO: Puede facturarse sin pago o con pago pendiente
      // Si tiene pago y está completado, la factura se marca como pagada
      if (canalPedido === PedidoCanal.INTERNO && pedido.pago) {
        const estadoPago = String(pedido.pago.estado).toLowerCase();
        const estadoPagado = String(PagoEstado.PAGADO).toLowerCase();
        
        if (estadoPago === estadoPagado) {
          estadoFactura = FacturaEstado.PAGADO;
        }
      }

      // Validar que el pedido no tenga ya una factura
      if (pedido.factura) {
        throw new BadRequestException(
          `El pedido ${idPedido} ya tiene una factura asociada (ID: ${pedido.factura.idFactura}).`,
        );
      }

      // Validar que el pedido tenga detalles
      if (!pedido.detallesPedido || pedido.detallesPedido.length === 0) {
        throw new BadRequestException(
          `El pedido ${idPedido} no tiene detalles. No se puede crear una factura sin productos.`,
        );
      }

      // Validar empleado
      const empleado = await findEntityOrFail(
        this.empleadoRepository,
        { idEmpleado },
        'El empleado no fue encontrado o no existe',
      );

      // Generar número de factura único
      const numFactura = await this.generarNumeroFactura();

      // Generar número de folio para la factura
      const idFolio = await this.obtenerFolioFactura();

      // Crear la factura copiando información del pedido
      const nuevaFactura = this.facturaRepository.create({
        idPedido: pedido.idPedido,
        idEmpleado: empleado.idEmpleado,
        numFactura,
        idFolio,
        montoTotal: pedido.totalPedido,
        estado: estadoFactura, // PAGADO si hay pago completado, PENDIENTE si no
      });

      await this.facturaRepository.save(nuevaFactura);

      // Copiar los detalles del pedido a detalles de factura
      const detallesFactura = pedido.detallesPedido.map((detallePedido) => {
        return this.facturaDetalleRepository.create({
          idFactura: nuevaFactura.idFactura,
          idArreglo: detallePedido.idArreglo,
          cantidad: detallePedido.cantidad,
          precioUnitario: detallePedido.precioUnitario,
          subtotal: detallePedido.subtotal,
        });
      });

      await this.facturaDetalleRepository.save(detallesFactura);

      // Retornar la factura completa con sus detalles
      return this.facturaRepository.findOne({
        where: { idFactura: nuevaFactura.idFactura },
        relations: ['pedido', 'empleado', 'detallesFactura', 'detallesFactura.arreglo'],
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

  /**
   * Genera un número de factura único en formato FAC-YYYY-NNNN
   * Ejemplo: FAC-2024-0001
   */
  private async generarNumeroFactura(): Promise<string> {
    const año = new Date().getFullYear();
    const prefijo = `FAC-${año}-`;

    // Buscar la última factura del año
    const ultimaFactura = await this.facturaRepository
      .createQueryBuilder('factura')
      .where('factura.numFactura LIKE :prefijo', { prefijo: `${prefijo}%` })
      .orderBy('factura.numFactura', 'DESC')
      .getOne();

    let siguienteNumero = 1;

    if (ultimaFactura) {
      // Extraer el número de la última factura
      const ultimoNumero = parseInt(
        ultimaFactura.numFactura.replace(prefijo, ''),
        10,
      );
      siguienteNumero = ultimoNumero + 1;
    }

    // Formatear con ceros a la izquierda (4 dígitos)
    const numeroFormateado = siguienteNumero.toString().padStart(4, '0');

    return `${prefijo}${numeroFormateado}`;
  }

  private async obtenerFolioFactura(): Promise<number | undefined> {
    try {
      const folioFactura = await this.folioService.buscarFolioPorDocumento(
        'FACTURA',
      );

      if (!folioFactura) {
        return undefined;
      }

      await this.folioService.obtenerSiguienteFolio('FACTURA');
      return folioFactura.idFolio;
    } catch (error) {
      return undefined;
    }
  }
}
