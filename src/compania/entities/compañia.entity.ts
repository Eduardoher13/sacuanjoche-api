import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Cliente } from 'src/cliente/entities/cliente.entity';

@Entity('compania')
export class Compania {
  @PrimaryGeneratedColumn({ name: 'id_compania' })
  idCompania: number;

  @Column({ name: 'nombre', type: 'varchar', length: 150, unique: true })
  nombre: string;

  @Column({
    name: 'nombre_comercial',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  nombreComercial?: string;

  @Column({ name: 'ruc', type: 'varchar', length: 30, nullable: true })
  ruc?: string;

  @Column({ name: 'correo', type: 'varchar', length: 150, nullable: true })
  correo?: string;

  @Column({ name: 'telefono', type: 'varchar', length: 20, nullable: true })
  telefono?: string;

  @Column({ name: 'direccion', type: 'varchar', length: 255, nullable: true })
  direccion?: string;

  @Column({ name: 'sitio_web', type: 'varchar', length: 200, nullable: true })
  sitioWeb?: string;

  @Column({ name: 'observaciones', type: 'text', nullable: true })
  observaciones?: string;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' })
  fechaCreacion: Date;

  @OneToMany(() => Cliente, (cliente) => cliente.compania)
  clientes: Cliente[];
}
