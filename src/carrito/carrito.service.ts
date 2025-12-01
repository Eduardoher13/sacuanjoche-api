import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Carrito } from './entities/carrito.entity';
import { CreateCarritoDto } from './dto/create-carrito.dto';
import { UpdateCarritoDto } from './dto/update-carrito.dto';
import { handleDbException } from 'src/common/helpers/db-exception.helper';
import { findEntityOrFail } from 'src/common/helpers/find-entity.helper';
import { User } from 'src/auth/entities/user.entity';
import { FindCarritosDto } from './dto/find-carritos.dto';
import { Pago } from 'src/pago/entities/pago.entity';
import { PagoEstado, PedidoCanal, PedidoEstado } from 'src/common/enums';
import { CrearPedidoDesdeCarritoDto } from './dto/crear-pedido-desde-carrito.dto';
import { Pedido } from 'src/pedido/entities/pedido.entity';
import { Empleado } from 'src/empleado/entities/empleado.entity';
import { Cliente } from 'src/cliente/entities/cliente.entity';
import { Direccion } from 'src/direccion/entities/direccion.entity';
import { ContactoEntrega } from 'src/contacto-entrega/entities/contacto-entrega.entity';
import { DetallePedido } from 'src/detalle-pedido/entities/detalle-pedido.entity';
import { CarritosArreglo } from 'src/carritos-arreglo/entities/carritos-arreglo.entity';
import { Folio } from 'src/folio/entities/folio.entity';
import { EstadoActivo } from 'src/common/enums';
import { NotificationsService } from 'src/notifications/notifications.service';
import { DetallePedidoService } from 'src/detalle-pedido/detalle-pedido.service';

@Injectable()
export class CarritoService {
  constructor(
    @InjectRepository(Carrito)
    private readonly carritoRepository: Repository<Carrito>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Pago)
    private readonly pagoRepository: Repository<Pago>,
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
    @InjectRepository(DetallePedido)
    private readonly detallePedidoRepository: Repository<DetallePedido>,
    @InjectRepository(CarritosArreglo)
    private readonly carritosArregloRepository: Repository<CarritosArreglo>,
    @InjectRepository(Folio)
    private readonly folioRepository: Repository<Folio>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createCarritoDto: CreateCarritoDto) {
    try {
      const { idUser, ...carritoData } = createCarritoDto;

      const user = await findEntityOrFail(
        this.userRepository,
        { id: idUser },
        'El usuario no fue encontrado o no existe',
      );

      const newCarrito = this.carritoRepository.create({
        ...carritoData,
        user,
      });

      await this.carritoRepository.save(newCarrito);

      return this.carritoRepository.findOne({
        where: { idCarrito: newCarrito.idCarrito },
        relations: ['user', 'carritosArreglo'],
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      handleDbException(error);
    }
  }

  async findAll(filters: FindCarritosDto) {
    const { limit = 10, offset = 0, q } = filters;

    const qb = this.carritoRepository
      .createQueryBuilder('carrito')
      .leftJoinAndSelect('carrito.user', 'user')
      .leftJoinAndSelect('carrito.carritosArreglo', 'carritosArreglo');

    qb.take(limit).skip(offset);

    if (q) {
      const search = `%${q}%`;
      qb.andWhere('(user.email ILIKE :search)', { search });
    }

    qb.orderBy('carrito.fechaUltAct', 'DESC').addOrderBy(
      'carrito.idCarrito',
      'DESC',
    );

    return qb.getMany();
  }

  async findOne(id: number) {
    const carrito = await this.carritoRepository.findOne({
      where: { idCarrito: id },
      relations: ['user', 'carritosArreglo', 'pago'],
    });

    if (!carrito) {
      throw new NotFoundException(`El carrito con id ${id} no fue encontrado`);
    }

    return carrito;
  }

  async update(id: number, updateCarritoDto: UpdateCarritoDto) {
    try {
      const { idUser, ...toUpdate } = updateCarritoDto;

      const user =
        idUser !== undefined
          ? await findEntityOrFail(
              this.userRepository,
              { id: idUser },
              'El usuario no fue encontrado o no existe',
            )
          : undefined;

      const carrito = await this.carritoRepository.preload({
        idCarrito: id,
        ...toUpdate,
        user,
      });

      if (!carrito) {
        throw new NotFoundException(
          `El carrito con id ${id} no fue encontrado`,
        );
      }

      return this.carritoRepository.save(carrito);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      handleDbException(error);
    }
  }

  async remove(id: number) {
    const carrito = await this.findOne(id);
    await this.carritoRepository.remove(carrito);
  }

  async asociarPago(idCarrito: number, idPago: number) {
    try {
      // Validar que el carrito existe
      const carrito = await this.carritoRepository.findOne({
        where: { idCarrito },
        relations: ['pago'],
      });

      if (!carrito) {
        throw new NotFoundException(
          `El carrito con id ${idCarrito} no fue encontrado`,
        );
      }

      // Validar que el pago existe
      const pago = await this.pagoRepository.findOne({
        where: { idPago },
      });

      if (!pago) {
        throw new NotFoundException(
          `El pago con id ${idPago} no fue encontrado`,
        );
      }

      // Validar que el pago esté completado (PAGADO)
      // Normalizar la comparación porque TypeORM puede devolver el enum como string desde la base de datos
      const estadoPago = String(pago.estado).toLowerCase().trim();
      const estadoPagadoEsperado = String(PagoEstado.PAGADO).toLowerCase().trim();
      
      if (estadoPago !== estadoPagadoEsperado) {
        throw new BadRequestException(
          `El pago con id ${idPago} no está completado. Estado actual: ${pago.estado}. Solo se pueden asociar pagos completados (${PagoEstado.PAGADO}).`,
        );
      }

      // Validar que el pago no esté ya asociado a otro carrito
      const carritoConPago = await this.carritoRepository.findOne({
        where: { idPago },
      });

      if (carritoConPago && carritoConPago.idCarrito !== idCarrito) {
        throw new BadRequestException(
          `El pago con id ${idPago} ya está asociado al carrito ${carritoConPago.idCarrito}.`,
        );
      }

      // Asociar el pago al carrito
      carrito.idPago = idPago;
      carrito.pago = pago;

      await this.carritoRepository.save(carrito);

      return this.carritoRepository.findOne({
        where: { idCarrito },
        relations: ['user', 'carritosArreglo', 'pago'],
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

  async crearPedidoDesdeCarrito(
    idCarrito: number,
    crearPedidoDto: CrearPedidoDesdeCarritoDto,
  ) {
    try {
      // Obtener el carrito con todas sus relaciones
      const carrito = await this.carritoRepository.findOne({
        where: { idCarrito },
        relations: ['user', 'user.cliente', 'carritosArreglo', 'carritosArreglo.arreglo', 'pago'],
      });

      if (!carrito) {
        throw new NotFoundException(
          `El carrito con id ${idCarrito} no fue encontrado`,
        );
      }

      // Validar que el carrito tenga productos
      if (!carrito.carritosArreglo || carrito.carritosArreglo.length === 0) {
        throw new BadRequestException(
          `El carrito con id ${idCarrito} no tiene productos. No se puede crear un pedido sin productos.`,
        );
      }

      // Validar que el carrito tenga un pago asociado
      if (!carrito.idPago || !carrito.pago) {
        throw new BadRequestException(
          `El carrito con id ${idCarrito} no tiene un pago asociado. Debe asociar un pago antes de crear el pedido.`,
        );
      }

      // Validar que el pago esté completado (PAGADO)
      // Normalizar la comparación porque TypeORM puede devolver el enum como string desde la relación
      const estadoPago = String(carrito.pago.estado).toLowerCase().trim();
      const estadoPagadoEsperado = String(PagoEstado.PAGADO).toLowerCase().trim();
      
      if (estadoPago !== estadoPagadoEsperado) {
        throw new BadRequestException(
          `El pago asociado al carrito no está completado. Estado actual: ${carrito.pago.estado}. Solo se pueden crear pedidos con pagos completados (${PagoEstado.PAGADO}).`,
        );
      }

      // Validar que el pago no esté ya asociado a otro pedido
      const pedidoExistente = await this.pedidoRepository.findOne({
        where: { idPago: carrito.idPago },
      });

      if (pedidoExistente) {
        throw new BadRequestException(
          `El pago con id ${carrito.idPago} ya está asociado al pedido ${pedidoExistente.idPedido}.`,
        );
      }

      // Validar que el usuario tenga un cliente asociado
      if (!carrito.user.cliente) {
        throw new BadRequestException(
          `El usuario del carrito no tiene un cliente asociado.`,
        );
      }

      const {
        idEmpleado,
        idDireccion,
        idContactoEntrega,
        idFolio,
        fechaEntregaEstimada,
        direccionTxt,
      } = crearPedidoDto;

      // Validar y obtener las entidades necesarias
      // Si idEmpleado está presente, validar que exista; si no, será null
      const empleadoPromise = idEmpleado
        ? findEntityOrFail(
            this.empleadoRepository,
            { idEmpleado },
            'El empleado no fue encontrado o no existe',
          )
        : Promise.resolve(null);

      const [empleado, direccion, contactoEntrega, folio] = await Promise.all([
        empleadoPromise,
        findEntityOrFail(
          this.direccionRepository,
          { idDireccion },
          'La dirección no fue encontrada o no existe',
        ),
        findEntityOrFail(
          this.contactoEntregaRepository,
          { idContactoEntrega },
          'El contacto de entrega no fue encontrado o no existe',
        ),
        findEntityOrFail(
          this.folioRepository,
          { idFolio },
          `El folio con id ${idFolio} no fue encontrado o no existe`,
        ),
      ]);

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
      }

      // Crear el pedido
      const pedidoData: Partial<Pedido> = {
        idCliente: carrito.user.cliente.idCliente,
        idDireccion,
        idContactoEntrega,
        idPago: carrito.idPago,
        idFolio,
        canal: PedidoCanal.WEB,
        estado: PedidoEstado.PROCESANDO, // El pedido se crea ya pagado, pasa a procesando
        direccionTxt,
        numeroPedido,
        totalProductos: 0, // Se calculará automáticamente cuando se agreguen las líneas
        totalPedido: 0, // Se calculará automáticamente cuando se agreguen las líneas
        cliente: carrito.user.cliente,
        direccion,
        contactoEntrega,
        pago: carrito.pago,
        folio,
      };

      // Solo incluir idEmpleado y empleado si están definidos
      if (idEmpleado !== undefined && empleado !== null) {
        pedidoData.idEmpleado = idEmpleado;
        pedidoData.empleado = empleado;
      }

      // Solo incluir fechaEntregaEstimada si está definida
      // Convertir string de fecha (YYYY-MM-DD o DD/MM/YYYY) a Date
      if (fechaEntregaEstimada !== undefined && fechaEntregaEstimada !== null) {
        pedidoData.fechaEntregaEstimada = this.parseDateString(fechaEntregaEstimada);
      }

      const newPedido = this.pedidoRepository.create(pedidoData);

      await this.pedidoRepository.save(newPedido);

      // Copiar los productos del carrito al detalle del pedido
      for (const carritoArreglo of carrito.carritosArreglo) {
        const detallePedido = this.detallePedidoRepository.create({
          idPedido: newPedido.idPedido,
          idArreglo: carritoArreglo.idArreglo,
          cantidad: carritoArreglo.cantidad,
          precioUnitario: carritoArreglo.precioUnitario,
          // subtotal se calculará automáticamente con el hook
          pedido: newPedido,
          arreglo: carritoArreglo.arreglo,
        });

        await this.detallePedidoRepository.save(detallePedido);
      }

      // Recalcular los totales del pedido
      const aggregate = await this.detallePedidoRepository
        .createQueryBuilder('detalle')
        .select('COALESCE(SUM(detalle.subtotal), 0)', 'total')
        .where('detalle.idPedido = :idPedido', { idPedido: newPedido.idPedido })
        .getRawOne<{ total: string }>();

      const totalProductos = Number(aggregate?.total ?? 0);
      const roundedProductos = Number(totalProductos.toFixed(2));

      // Obtener el pedido con la relación de envío para acceder al costo de envío
      const pedidoConEnvio = await this.pedidoRepository.findOne({
        where: { idPedido: newPedido.idPedido },
        relations: ['envio'],
      });

      // Obtener el costo de envío de la tabla envio
      const costoEnvio = pedidoConEnvio?.envio?.costoEnvio
        ? Number(pedidoConEnvio.envio.costoEnvio)
        : 0;

      // Calcular el total del pedido: productos + costo de envío
      const totalPedido = roundedProductos + costoEnvio;
      const roundedTotal = Number(totalPedido.toFixed(2));

      await this.pedidoRepository.update(newPedido.idPedido, {
        totalProductos: roundedProductos,
        totalPedido: roundedTotal,
      });

      // Obtener el pedido completo con todas sus relaciones
      const pedidoCompleto = await this.pedidoRepository.findOne({
        where: { idPedido: newPedido.idPedido },
        relations: [
          'empleado',
          'cliente',
          'direccion',
          'contactoEntrega',
          'pago',
          'envio',
          'folio',
          'detallesPedido',
          'detallesPedido.arreglo',
        ],
      });

      // Emitir notificación a los administradores sobre el nuevo pedido web
      if (pedidoCompleto) {
        this.notificationsService.emitAdminNotification({
          tipo: 'nuevo_pedido_web',
          id_registro: pedidoCompleto.idPedido,
          nombre_cliente: pedidoCompleto.cliente
            ? `${pedidoCompleto.cliente.primerNombre} ${pedidoCompleto.cliente.primerApellido}`
            : undefined,
          timestamp: new Date().toISOString(),
          data: {
            numeroPedido: pedidoCompleto.numeroPedido,
            totalPedido: pedidoCompleto.totalPedido,
            estado: pedidoCompleto.estado,
            canal: pedidoCompleto.canal,
            fechaEntregaEstimada: pedidoCompleto.fechaEntregaEstimada,
            cantidadProductos: pedidoCompleto.detallesPedido?.length || 0,
          },
        });
      }

      return pedidoCompleto;
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
