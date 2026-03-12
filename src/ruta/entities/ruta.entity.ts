import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Empleado } from '../../empleado/entities/empleado.entity';
import { RutaPedido } from './ruta-pedido.entity';
import { Envio } from '../../envio/entities/envio.entity';

@Entity('ruta')
export class Ruta {
  @PrimaryGeneratedColumn({ name: 'id_ruta' })
  idRuta: number;

  @Column({ name: 'nombre', type: 'varchar', length: 120, nullable: true })
  nombre?: string;

  @Column({ name: 'id_empleado', type: 'int', nullable: true })
  idEmpleado?: number;

  @Column({ name: 'estado', type: 'varchar', length: 40, default: 'pendiente' })
  estado: string;

  @Column({ name: 'fecha_programada', type: 'timestamp', nullable: true })
  fechaProgramada?: Date;

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

  @Column({ name: 'geometry', type: 'text', nullable: true })
  geometry?: string;

  @Column({
    name: 'mapbox_request_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  providerRequestId?: string;

  @Column({ name: 'profile', type: 'varchar', length: 40, default: 'driving' })
  profile: string;

  @Column({ name: 'origen_lat', type: 'decimal', precision: 10, scale: 8 })
  origenLat: number;

  @Column({ name: 'origen_lng', type: 'decimal', precision: 11, scale: 8 })
  origenLng: number;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion', type: 'timestamp' })
  fechaActualizacion: Date;

  @ManyToOne(() => Empleado, (empleado) => empleado.rutas, { nullable: true })
  @JoinColumn({ name: 'id_empleado' })
  empleado?: Empleado;

  @OneToMany(() => RutaPedido, (rutaPedido) => rutaPedido.ruta, {
    cascade: ['insert'],
  })
  rutaPedidos: RutaPedido[];

  @OneToMany(() => Envio, (envio) => envio.ruta)
  envios: Envio[];
}
