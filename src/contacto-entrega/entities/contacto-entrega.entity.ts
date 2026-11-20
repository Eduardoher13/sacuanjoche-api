import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Pedido } from '../../pedido/entities/pedido.entity';

@Entity('contacto_entrega')
export class ContactoEntrega {
  @PrimaryGeneratedColumn({ name: 'id_contacto_entrega' })
  idContactoEntrega: number;

  @Column({ name: 'nombre', type: 'varchar', length: 100 })
  nombre: string;

  @Column({ name: 'apellido', type: 'varchar', length: 100 })
  apellido: string;

  @Column({ name: 'telefono', type: 'varchar', length: 20, nullable: true })
  telefono: string | null;

  // Relaciones
  @OneToMany(() => Pedido, pedido => pedido.contactoEntrega)
  pedidos: Pedido[];
}

