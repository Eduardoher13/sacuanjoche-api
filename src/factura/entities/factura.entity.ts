import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Pedido } from '../../pedido/entities/pedido.entity';
import { Empleado } from '../../empleado/entities/empleado.entity';
import { FacturaEstado } from '../../common/enums';
import { FacturaDetalle } from '../../factura-detalle/entities/factura-detalle.entity';
import { Folio } from '../../folio/entities/folio.entity';

@Entity('factura')
export class Factura {
  @PrimaryGeneratedColumn({ name: 'id_factura' })
  idFactura: number;

  @Column({ name: 'id_pedido', nullable: true })
  idPedido?: number | null;

  @Column({ name: 'id_empleado' })
  idEmpleado: number;
 
  @Column({ name: 'num_factura', type: 'varchar', length: 50, unique: true })
  numFactura: string;

  @Column({ name: 'id_folio', nullable: true })
  idFolio?: number;

  @CreateDateColumn({ name: 'fecha_emision', type: 'timestamp' })
  fechaEmision: Date;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 50,
    enum: FacturaEstado,
    default: FacturaEstado.PENDIENTE,
  })
  estado: FacturaEstado;

  @Column({ name: 'monto_total', type: 'decimal', precision: 10, scale: 2 })
  montoTotal: number;

  // Relaciones
  @OneToOne(() => Pedido, pedido => pedido.factura, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'id_pedido' })
  pedido?: Pedido | null;

  @ManyToOne(() => Empleado, empleado => empleado.facturas)
  @JoinColumn({ name: 'id_empleado' })
  empleado: Empleado;

  @OneToMany(() => FacturaDetalle, (facturaDetalle) => facturaDetalle.factura)
  detallesFactura: FacturaDetalle[];

  @ManyToOne(() => Folio, (folio) => folio.facturas)
  @JoinColumn({ name: 'id_folio' })
  folio: Folio;
}

