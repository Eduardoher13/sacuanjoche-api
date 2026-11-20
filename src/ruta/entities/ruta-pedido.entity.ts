import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Ruta } from './ruta.entity';
import { Pedido } from '../../pedido/entities/pedido.entity';

@Entity('ruta_pedido')
export class RutaPedido {
  @PrimaryGeneratedColumn({ name: 'id_ruta_pedido' })
  idRutaPedido: number;

  @Column({ name: 'id_ruta', type: 'int' })
  idRuta: number;

  @Column({ name: 'id_pedido', type: 'int' })
  idPedido: number;

  @Column({ name: 'secuencia', type: 'int' })
  secuencia: number;

  @Column({
    name: 'distancia_km',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  distanciaKm?: number;

  @Column({
    name: 'duracion_min',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  duracionMin?: number;

  @Column({ name: 'lat', type: 'decimal', precision: 10, scale: 8 })
  lat: number;

  @Column({ name: 'lng', type: 'decimal', precision: 11, scale: 8 })
  lng: number;

  @Column({
    name: 'direccion_resumen',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  direccionResumen?: string;

  @Column({
    name: 'estado_entrega',
    type: 'varchar',
    length: 40,
    default: 'pendiente',
  })
  estadoEntrega: string;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'timestamp' })
  fechaActualizacion: Date;

  @ManyToOne(() => Ruta, (ruta) => ruta.rutaPedidos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_ruta' })
  ruta: Ruta;

  @ManyToOne(() => Pedido, (pedido) => pedido.rutaPedidos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_pedido' })
  pedido: Pedido;
}
