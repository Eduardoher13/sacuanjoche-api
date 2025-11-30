import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Entidad para rastrear intentos de login fallidos por IP
 * Previene ataques de fuerza bruta desde la misma IP contra múltiples usuarios
 */
@Entity('login_attempt')
@Index(['ipAddress', 'blockedUntil']) // Índice para búsquedas rápidas
export class LoginAttempt {
  @PrimaryGeneratedColumn({ name: 'id_login_attempt' })
  idLoginAttempt: number;

  @Column({ name: 'ip_address', type: 'varchar', length: 45 })
  @Index()
  ipAddress: string; // Soporta IPv4 e IPv6

  @Column({ name: 'attempts', type: 'int', default: 0 })
  attempts: number;

  @Column({
    name: 'blocked_until',
    type: 'timestamptz',
    nullable: true,
  })
  blockedUntil: Date | null;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp' })
  fechaCreacion: Date;

  @Column({
    name: 'fecha_actualizacion',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  fechaActualizacion: Date;
}
