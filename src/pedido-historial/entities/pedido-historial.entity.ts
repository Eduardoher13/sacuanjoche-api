import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Pedido } from '../../pedido/entities/pedido.entity';
import { Empleado } from '../../empleado/entities/empleado.entity';
import { PedidoEstado } from '../../common/enums';

@Entity('pedido_historial')
export class PedidoHistorial {
  @PrimaryGeneratedColumn({ name: 'id_pedido_historial' })
  idPedidoHistorial: number;

  @Column({ name: 'id_pedido' })
  idPedido: number;

  @Column({ name: 'id_empleado' })
  idEmpleado: number;

  @Column({
    name: 'estado_anterior',
    type: 'varchar',
    length: 50,
    enum: PedidoEstado,
    nullable: true,
  })
  estadoAnterior: PedidoEstado | null;

  @Column({
    name: 'estado_nuevo',
    type: 'varchar',
    length: 50,
    enum: PedidoEstado,
  })
  estadoNuevo: PedidoEstado;

  @CreateDateColumn({ name: 'fecha_cambio', type: 'timestamp' })
  fechaCambio: Date;

  @Column({ name: 'nota', type: 'text', nullable: true })
  nota: string;

  // Relaciones
  @ManyToOne(() => Pedido, (pedido) => pedido.historial, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_pedido' })
  pedido: Pedido;

  @ManyToOne(() => Empleado, (empleado) => empleado.pedidosHistorial)
  @JoinColumn({ name: 'id_empleado' })
  empleado: Empleado;
}
