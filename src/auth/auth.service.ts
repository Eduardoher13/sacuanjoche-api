import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { LoginUserDto, CreateEmployeeUserDto } from './dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { JwtService } from '@nestjs/jwt';
import { Cliente } from 'src/cliente/entities/cliente.entity';
import { Empleado } from 'src/empleado/entities/empleado.entity';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { UserEstado, ClienteEstado } from 'src/common/enums';
import { EncryptionService } from './services/encryption.service';
import { LoginAttempt } from './entities/login-attempt.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxFailedLoginAttempts: number;
  private readonly loginBlockWindowMinutes: number; // Tiempo de bloqueo por usuario
  private readonly maxFailedLoginAttemptsPerIP: number;
  private readonly ipBlockWindowMinutes: number; // Tiempo de bloqueo por IP

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(LoginAttempt)
    private readonly loginAttemptRepository: Repository<LoginAttempt>,

    private readonly jwtService: JwtService,
    private readonly encryptionService: EncryptionService,
  ) {
    this.maxFailedLoginAttempts = this.resolveEnvInt(
      'AUTH_MAX_LOGIN_ATTEMPTS',
      3,
      1,
    );
    this.loginBlockWindowMinutes = this.resolveEnvInt(
      'AUTH_LOGIN_BLOCK_MINUTES',
      10,
      1,
    );
    // Intentos fallidos por IP: 5 intentos fallidos desde cualquier usuario
    this.maxFailedLoginAttemptsPerIP = this.resolveEnvInt(
      'AUTH_MAX_LOGIN_ATTEMPTS_PER_IP',
      5,
      3,
    );
    // Tiempo de bloqueo por IP (diferente al bloqueo por usuario)
    this.ipBlockWindowMinutes = this.resolveEnvInt(
      'AUTH_IP_BLOCK_MINUTES',
      10,
      1,
    );
  }

  async create(createUserDto: CreateUserDto) {
    try {
      const { password, clienteId, empleadoId, clienteData, ...userData } = createUserDto;

      if (clienteId && empleadoId) {
        throw new BadRequestException(
          'Solo puede asociar el usuario a un cliente o a un empleado, no a ambos.',
        );
      }

      if (clienteId && clienteData) {
        throw new BadRequestException(
          'No puede proporcionar clienteId y clienteData al mismo tiempo. Use clienteId para asociar un cliente existente o clienteData para crear uno nuevo.',
        );
      }

      const normalizedEmail = userData.email.toLowerCase().trim();

      const newUser = this.userRepository.create({
        ...userData,
        email: normalizedEmail,
        password: this.encryptionService.encrypt(password),
      });

      // Si se proporciona clienteData, crear un nuevo cliente
      if (clienteData) {
        // Normalizar el teléfono (eliminar espacios)
        const telefonoNormalizado = clienteData.telefono
          ? clienteData.telefono.trim().replace(/\s+/g, '')
          : undefined;

        const nuevoCliente = this.clienteRepository.create({
          primerNombre: clienteData.primerNombre,
          primerApellido: clienteData.primerApellido,
          telefono: telefonoNormalizado,
          estado: clienteData.estado || ClienteEstado.ACTIVO,
        });

        const clienteGuardado = await this.clienteRepository.save(nuevoCliente);
        newUser.cliente = clienteGuardado;
      } else if (clienteId !== undefined) {
        // Si se proporciona clienteId, asociar el cliente existente
        const cliente = await this.clienteRepository.findOne({
          where: { idCliente: clienteId },
        });

        if (!cliente) {
          throw new BadRequestException('El cliente indicado no existe.');
        }

        newUser.cliente = cliente;
      }

      if (empleadoId !== undefined) {
        const empleado = await this.empleadoRepository.findOne({
          where: { idEmpleado: empleadoId },
        });

        if (!empleado) {
          throw new BadRequestException('El empleado indicado no existe.');
        }

        newUser.empleado = empleado;
      }

      // Siempre asignar rol 'cliente' por defecto
      // Los roles se pueden modificar después desde el admin panel usando el endpoint de actualizar roles
      newUser.roles = ['cliente'];

      await this.userRepository.save(newUser);

      delete (newUser as any).password;

      const { password: _password, ...user } = newUser;

      return {
        ...user,
        token: this.getJwtToken({ id: user.id }),
      };
    } catch (error) {
      this.handleDbErrors(error);
    }
  }

  async login(loginUserDto: LoginUserDto, ipAddress: string) {
    const startTime = Date.now();
    const MIN_RESPONSE_TIME_MS = 200; // Tiempo mínimo de respuesta para evitar timing attacks

    try {
      // ========== VERIFICAR BLOQUEO POR IP (ANTES DE TODO) ==========
      const ipBlockInfo = await this.checkAndBlockIP(ipAddress);
      if (ipBlockInfo.isBlocked) {
        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_RESPONSE_TIME_MS) {
          await new Promise((resolve) =>
            setTimeout(resolve, MIN_RESPONSE_TIME_MS - elapsed),
          );
        }
        const minutesRemaining = Math.ceil(
          (ipBlockInfo.blockedUntil.getTime() - Date.now()) / (1000 * 60),
        );
        throw new UnauthorizedException(
          `Demasiados intentos fallidos. Por favor, intente nuevamente en ${minutesRemaining} minuto${minutesRemaining !== 1 ? 's' : ''}.`,
        );
      }

      const { password, email } = loginUserDto;
      const normalizedEmail = email.toLowerCase().trim();

      const user = await this.userRepository.findOne({
        where: { email: normalizedEmail },
        select: {
          id: true,
          email: true,
          password: true,
          roles: true,
          loginAttempts: true,
          blockedUntil: true,
          estado: true,
        },
        relations: ['cliente', 'empleado'],
      });

      // Usar un hash dummy si el usuario no existe para mantener tiempos consistentes
      const dummyHash =
        '$2a$10$dummyhashfordummycomparison1234567890123456789012';

      // Siempre ejecutar la comparación de contraseña para evitar timing attacks
      let passwordMatches = false;

      if (user) {
        // Detectar si la contraseña está en formato bcrypt (legacy) o AES-256
        const isBcryptHash =
          user.password.startsWith('$2a$') ||
          user.password.startsWith('$2b$') ||
          user.password.startsWith('$2y$');

        if (isBcryptHash) {
          passwordMatches = bcrypt.compareSync(password, user.password);

          // Si la contraseña coincide, migrar automáticamente a AES-256
          if (passwordMatches) {
            try {
              await this.userRepository.update(user.id, {
                password: this.encryptionService.encrypt(password),
              });
            } catch (migrationError) {
              this.logger.error(
                'Error al migrar contraseña a AES-256:',
                migrationError,
              );
            }
          }
        } else {
          passwordMatches = this.encryptionService.compare(
            password,
            user.password,
          );
        }
      } else {
        // Usuario no existe - comparar con hash dummy para mantener tiempo consistente
        // Esto asegura que el tiempo de respuesta sea similar independientemente de si el usuario existe
        bcrypt.compareSync(password, dummyHash);
      }

      // ========== MANEJAR INTENTOS FALLIDOS POR USUARIO ==========
      let userBlockedUntil: Date | null = null;
      if (user && !passwordMatches) {
        const now = new Date();
        const currentAttempts = user.loginAttempts ?? 0;
        const nextAttempts = currentAttempts + 1;

        if (nextAttempts >= this.maxFailedLoginAttempts) {
          const blockDurationMs = this.loginBlockWindowMinutes * 60 * 1000;
          const blockUntil = new Date(now.getTime() + blockDurationMs);
          userBlockedUntil = blockUntil;

          await this.userRepository.update(user.id, {
            loginAttempts: 0,
            blockedUntil: blockUntil,
          });
        } else {
          await this.userRepository.update(user.id, {
            loginAttempts: nextAttempts,
          });
        }
      }

      // ========== MANEJAR INTENTOS FALLIDOS POR IP ==========
      // Si el login falló (usuario no existe o contraseña incorrecta), registrar intento por IP
      if (!user || !passwordMatches) {
        const ipBlockInfo = await this.recordFailedLoginAttempt(ipAddress);
        
        // Asegurar tiempo mínimo de respuesta para evitar timing attacks
        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_RESPONSE_TIME_MS) {
          await new Promise((resolve) =>
            setTimeout(resolve, MIN_RESPONSE_TIME_MS - elapsed),
          );
        }

        // Si el usuario fue bloqueado, mostrar mensaje con minutos restantes
        if (userBlockedUntil) {
          const minutesRemaining = Math.ceil(
            (userBlockedUntil.getTime() - Date.now()) / (1000 * 60),
          );
          throw new UnauthorizedException(
            `Demasiados intentos fallidos. Por favor, intente nuevamente en ${minutesRemaining} minuto${minutesRemaining !== 1 ? 's' : ''}.`,
          );
        }

        // Si la IP fue bloqueada, mostrar mensaje con minutos restantes
        if (ipBlockInfo.isBlocked && ipBlockInfo.blockedUntil) {
          const minutesRemaining = Math.ceil(
            (ipBlockInfo.blockedUntil.getTime() - Date.now()) / (1000 * 60),
          );
          throw new UnauthorizedException(
            `Demasiados intentos fallidos desde esta dirección. Por favor, intente nuevamente en ${minutesRemaining} minuto${minutesRemaining !== 1 ? 's' : ''}.`,
          );
        }

        throw new UnauthorizedException('Credenciales inválidas');
      }

      // Si llegamos aquí, el usuario existe y la contraseña es correcta
      if (user.estado !== UserEstado.ACTIVO) {
        // Asegurar tiempo mínimo de respuesta
        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_RESPONSE_TIME_MS) {
          await new Promise((resolve) =>
            setTimeout(resolve, MIN_RESPONSE_TIME_MS - elapsed),
          );
        }
        throw new UnauthorizedException('Credenciales inválidas');
      }

      const now = new Date();
      const lockedUntil = user.blockedUntil
        ? new Date(user.blockedUntil)
        : null;

      if (lockedUntil && lockedUntil.getTime() > now.getTime()) {
        // Asegurar tiempo mínimo de respuesta
        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_RESPONSE_TIME_MS) {
          await new Promise((resolve) =>
            setTimeout(resolve, MIN_RESPONSE_TIME_MS - elapsed),
          );
        }
        // Mostrar minutos restantes de bloqueo
        const minutesRemaining = Math.ceil(
          (lockedUntil.getTime() - now.getTime()) / (1000 * 60),
        );
        throw new UnauthorizedException(
          `Demasiados intentos fallidos. Por favor, intente nuevamente en ${minutesRemaining} minuto${minutesRemaining !== 1 ? 's' : ''}.`,
        );
      }

      // Si llegamos aquí, el usuario existe, la contraseña es correcta, está activo y no está bloqueado
      // Limpiar intentos fallidos del usuario si existen
      const currentAttempts = user.loginAttempts ?? 0;
      if (currentAttempts !== 0 || user.blockedUntil) {
        await this.userRepository.update(user.id, {
          loginAttempts: 0,
          blockedUntil: null,
        });
      }

      // Limpiar intentos fallidos de la IP (login exitoso)
      await this.clearIPLoginAttempts(ipAddress);

      const empleadoInfo = user.empleado
        ? {
            id: user.empleado.idEmpleado,
            nombreCompleto: [
              user.empleado.primerNombre,
              user.empleado.primerApellido,
            ]
              .filter(
                (value) => typeof value === 'string' && value.trim().length > 0,
              )
              .join(' ')
              .trim(),
            estado: user.empleado.estado,
          }
        : null;

      const clienteInfo = user.cliente
        ? {
            id: user.cliente.idCliente,
            nombreCompleto: [
              user.cliente.primerNombre,
              user.cliente.primerApellido,
            ]
              .filter(
                (value) => typeof value === 'string' && value.trim().length > 0,
              )
              .join(' ')
              .trim(),
            estado: user.cliente.estado,
          }
        : null;

      return {
        id: user.id,
        email: user.email,
        roles: user.roles,
        empleado: empleadoInfo,
        cliente: clienteInfo,
        token: this.getJwtToken({ id: user.id }),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.handleDbErrors(error);
    }
  }

  async checkAuthStatus(user: User) {
    const dbUser = await this.userRepository.findOne({
      where: { id: user.id },
    });

    if (!dbUser) {
      throw new UnauthorizedException('Usuario no encontrado.');
    }

    const { password: _password, ...rest } = dbUser;

    return {
      ...rest,
      token: this.getJwtToken({ id: dbUser.id }),
    };
  }

  private getJwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }

  private resolveEnvInt(
    envVar: string,
    fallback: number,
    min: number,
  ): number {
    const rawValue = process.env[envVar];
    if (rawValue !== undefined) {
      const parsed = Number.parseInt(rawValue, 10);
      if (Number.isFinite(parsed) && parsed >= min) {
        return parsed;
      }
    }
    return fallback;
  }

  /**
   * Verifica si una IP está bloqueada y retorna información del bloqueo
   */
  private async checkAndBlockIP(ipAddress: string): Promise<{
    isBlocked: boolean;
    blockedUntil: Date | null;
  }> {
    if (ipAddress === 'unknown') {
      return { isBlocked: false, blockedUntil: null }; // No bloquear si no se puede determinar la IP
    }

    const now = new Date();
    const loginAttempt = await this.loginAttemptRepository.findOne({
      where: { ipAddress },
    });

    if (!loginAttempt) {
      return { isBlocked: false, blockedUntil: null }; // No hay intentos registrados
    }

    // Si está bloqueado y el bloqueo aún es válido
    if (loginAttempt.blockedUntil) {
      const blockedUntil = new Date(loginAttempt.blockedUntil);
      if (blockedUntil.getTime() > now.getTime()) {
        this.logger.warn(
          `Intento de login desde IP bloqueada: ${ipAddress} (bloqueada hasta ${blockedUntil.toISOString()})`,
        );
        return { isBlocked: true, blockedUntil }; // IP está bloqueada
      } else {
        // El bloqueo expiró, limpiar
        await this.loginAttemptRepository.update(
          { ipAddress },
          {
            attempts: 0,
            blockedUntil: null,
          },
        );
        return { isBlocked: false, blockedUntil: null };
      }
    }

    return { isBlocked: false, blockedUntil: null };
  }

  /**
   * Registra un intento fallido de login por IP
   * Retorna información sobre si la IP fue bloqueada
   */
  private async recordFailedLoginAttempt(ipAddress: string): Promise<{
    isBlocked: boolean;
    blockedUntil: Date | null;
  }> {
    if (ipAddress === 'unknown') {
      return { isBlocked: false, blockedUntil: null }; // No registrar si no se puede determinar la IP
    }

    const now = new Date();
    let loginAttempt = await this.loginAttemptRepository.findOne({
      where: { ipAddress },
    });

    if (!loginAttempt) {
      // Crear nuevo registro
      loginAttempt = this.loginAttemptRepository.create({
        ipAddress,
        attempts: 1,
        blockedUntil: null,
      });
    } else {
      // Incrementar intentos
      loginAttempt.attempts += 1;
    }

    // Si se alcanzó el límite, bloquear la IP
    if (loginAttempt.attempts >= this.maxFailedLoginAttemptsPerIP) {
      const blockDurationMs = this.ipBlockWindowMinutes * 60 * 1000;
      const blockUntil = new Date(now.getTime() + blockDurationMs);
      loginAttempt.blockedUntil = blockUntil;
      loginAttempt.attempts = 0; // Resetear contador después de bloquear

      this.logger.warn(
        `IP bloqueada por múltiples intentos fallidos: ${ipAddress} (bloqueada hasta ${blockUntil.toISOString()})`,
      );

      await this.loginAttemptRepository.save(loginAttempt);
      return { isBlocked: true, blockedUntil: blockUntil };
    }

    await this.loginAttemptRepository.save(loginAttempt);
    return { isBlocked: false, blockedUntil: null };
  }

  /**
   * Limpia los intentos fallidos de una IP cuando el login es exitoso
   */
  private async clearIPLoginAttempts(ipAddress: string): Promise<void> {
    if (ipAddress === 'unknown') {
      return;
    }

    const loginAttempt = await this.loginAttemptRepository.findOne({
      where: { ipAddress },
    });

    if (loginAttempt && loginAttempt.attempts > 0) {
      // Solo limpiar si no está bloqueada
      if (!loginAttempt.blockedUntil) {
        await this.loginAttemptRepository.update(
          { ipAddress },
          { attempts: 0 },
        );
      }
    }
  }

  /**
   * Limpia registros antiguos de intentos de login (más de 24 horas)
   * Debería ejecutarse periódicamente (ej: cada hora)
   */
  async cleanupOldLoginAttempts(): Promise<void> {
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    // Eliminar registros antiguos que no están bloqueados
    await this.loginAttemptRepository
      .createQueryBuilder()
      .delete()
      .where('fecha_actualizacion < :oneDayAgo', { oneDayAgo })
      .andWhere('blocked_until IS NULL')
      .execute();

    this.logger.log('Limpieza de registros antiguos de intentos de login completada');
  }

  private handleDbErrors(error: any): never {
    // Log del error
    this.logger.error('Database error in AuthService:', {
      code: error.code,
      detail: error.detail,
      message: error.message,
    });

    // Error de duplicado (email ya existe)
    // SIEMPRE usar mensaje genérico para evitar enumeración
    if (error.code === '23505') {
      throw new BadRequestException(
        'No se pudo completar la operación. Por favor, verifique los datos e intente nuevamente.',
      );
    }

    // Error de foreign key
    if (error.code === '23503') {
      throw new BadRequestException(
        'No se puede realizar esta operación porque hay registros relacionados.',
      );
    }

    // Error de campo requerido
    if (error.code === '23502') {
      throw new BadRequestException(
        'Faltan campos requeridos. Por favor, complete todos los campos obligatorios.',
      );
    }

    // Error desconocido - mensaje amigable pero genérico
    throw new InternalServerErrorException(
      'Ocurrió un error al procesar la solicitud. Por favor, intente nuevamente más tarde.',
    );
  }

  async createEmployeeUser(dto: CreateEmployeeUserDto) {
    const payload: CreateUserDto = {
      email: dto.email,
      password: dto.password,
      empleadoId: dto.empleadoId,
    };

    return this.create(payload);
  }

  async updateUserRoles(userId: string, { roles }: UpdateUserRolesDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException(`Usuario con id ${userId} no existe`);
    }

    // Ensure unique roles and preserve only valid ones
    user.roles = Array.from(new Set(roles));

    await this.userRepository.save(user);

    return {
      id: user.id,
      email: user.email,
      roles: user.roles,
      isActive: user.estado === UserEstado.ACTIVO,
    };
  }
}
