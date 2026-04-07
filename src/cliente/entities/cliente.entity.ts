import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Pedido } from '../../pedido/entities/pedido.entity';
import { ClienteDireccion } from '../../cliente-direccion/entities/cliente-direccion.entity';
import { ClienteEstado } from '../../common/enums';

@Entity('cliente')
export class Cliente {
  @PrimaryGeneratedColumn({ name: 'id_cliente' })
  idCliente: number;

  @Column({ name: 'primer_nombre', type: 'varchar', length: 100 })
  primerNombre: string;

  @Column({
    name: 'segundo_nombre',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  segundoNombre: string | null;

  @Column({ name: 'primer_apellido', type: 'varchar', length: 100 })
  primerApellido: string;

  @Column({
    name: 'segundo_apellido',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  segundoApellido: string | null;

  @Column({ name: 'telefono', type: 'varchar', length: 20, nullable: true })
  telefono: string;

  @Column({
    name: 'nombre_empresa',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  nombreEmpresa: string | null;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 50,
    enum: ClienteEstado,
    default: ClienteEstado.ACTIVO,
  })
  estado: ClienteEstado;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' })
  fechaCreacion: Date;

  // Relaciones
  @OneToOne(() => User, (user) => user.cliente)
  user: User;

  @OneToMany(() => Pedido, (pedido) => pedido.cliente)
  pedidos: Pedido[];

  @OneToMany(
    () => ClienteDireccion,
    (clienteDireccion) => clienteDireccion.cliente,
  )
  direcciones: ClienteDireccion[];
}
