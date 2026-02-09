import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Empleado } from '../../empleado/entities/empleado.entity';
import { Cliente } from '../../cliente/entities/cliente.entity';
import { Direccion } from '../../direccion/entities/direccion.entity';
import { ContactoEntrega } from '../../contacto-entrega/entities/contacto-entrega.entity';
import { DetallePedido } from '../../detalle-pedido/entities/detalle-pedido.entity';
import { Pago } from '../../pago/entities/pago.entity';
import { Envio } from '../../envio/entities/envio.entity';
import { Factura } from '../../factura/entities/factura.entity';
import { PedidoHistorial } from '../../pedido-historial/entities/pedido-historial.entity';
import { RutaPedido } from '../../ruta/entities/ruta-pedido.entity';
import { PedidoCanal, PedidoEstado } from '../../common/enums';
import { Folio } from '../../folio/entities/folio.entity';

@Entity('pedido')
export class Pedido {
  @PrimaryGeneratedColumn({ name: 'id_pedido' })
  idPedido: number;

  @Column({ name: 'id_empleado', nullable: true })
  idEmpleado?: number;

  @Column({ name: 'id_cliente' })
  idCliente: number;

  @Column({ name: 'id_direccion', nullable: true })
  idDireccion: number | null;

  @Column({ name: 'id_contacto_entrega' })
  idContactoEntrega: number;

  @Column({ name: 'total_productos', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalProductos: number;

  @CreateDateColumn({
    name: 'fecha_creacion',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaCreacion: Date;

  @UpdateDateColumn({
    name: 'fecha_actualizacion',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaActualizacion: Date;

  @Column({ name: 'fecha_entrega_estimada', type: 'timestamp', nullable: true })
  fechaEntregaEstimada?: Date;

  @Column({ name: 'direccion_txt', type: 'text' })
  direccionTxt: string;

  @Column({
    name: 'mensaje_pedido',
    type: 'varchar',
    length: 256,
    default: '',
  })
  mensajePedido: string;

  @Column({
    name: 'total_pedido',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  totalPedido: number;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 50,
    enum: PedidoEstado,
    default: PedidoEstado.PENDIENTE,
  })
  estado: PedidoEstado;

  @Column({ name: 'id_pago', nullable: true })
  idPago?: number;

  @Column({
    name: 'canal',
    type: 'varchar',
    length: 50,
    default: PedidoCanal.WEB,
    enum: PedidoCanal,
  })
  canal: PedidoCanal;

  @Column({ name: 'numero_pedido', type: 'varchar', length: 50, nullable: true })
  numeroPedido: string;

  @Column({ name: 'id_folio', nullable: true })
  idFolio?: number;

  // Relaciones
  @ManyToOne(() => Empleado, (empleado) => empleado.pedidos)
  @JoinColumn({ name: 'id_empleado' })
  empleado: Empleado;

  @ManyToOne(() => Cliente, (cliente) => cliente.pedidos)
  @JoinColumn({ name: 'id_cliente' })
  cliente: Cliente;

  @ManyToOne(() => Direccion, (direccion) => direccion.pedidos, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'id_direccion' })
  direccion: Direccion | null;

  @ManyToOne(
    () => ContactoEntrega,
    (contactoEntrega) => contactoEntrega.pedidos,
  )
  @JoinColumn({ name: 'id_contacto_entrega' })
  contactoEntrega: ContactoEntrega;

  @OneToMany(() => DetallePedido, (detallePedido) => detallePedido.pedido)
  detallesPedido: DetallePedido[];

  @OneToOne(() => Pago)
  @JoinColumn({ name: 'id_pago' })
  pago: Pago;

  @OneToOne(() => Envio, (envio) => envio.pedido)
  envio: Envio;

  @OneToOne(() => Factura, (factura) => factura.pedido)
  factura: Factura;

  @OneToMany(() => PedidoHistorial, (pedidoHistorial) => pedidoHistorial.pedido)
  historial: PedidoHistorial[];

  @OneToMany(() => RutaPedido, (rutaPedido) => rutaPedido.pedido)
  rutaPedidos: RutaPedido[];

  @ManyToOne(() => Folio, (folio) => folio.pedidos)
  @JoinColumn({ name: 'id_folio' })
  folio: Folio;
}
