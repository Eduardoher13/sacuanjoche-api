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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxFailedLoginAttempts: number;
  private readonly loginBlockWindowMinutes: number;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,

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
      15,
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

  async login(loginUserDto: LoginUserDto) {
    const startTime = Date.now();
    const MIN_RESPONSE_TIME_MS = 200; // Tiempo mínimo de respuesta para evitar timing attacks

    try {
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

      // Manejar intentos fallidos solo si el usuario existe
      if (user && !passwordMatches) {
        const now = new Date();
        const currentAttempts = user.loginAttempts ?? 0;
        const nextAttempts = currentAttempts + 1;

        if (nextAttempts >= this.maxFailedLoginAttempts) {
          const blockDurationMs = this.loginBlockWindowMinutes * 60 * 1000;
          const blockUntil = new Date(now.getTime() + blockDurationMs);

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

      // Si no hay usuario o la contraseña no coincide, usar mensaje genérico
      if (!user || !passwordMatches) {
        // Asegurar tiempo mínimo de respuesta para evitar timing attacks
        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_RESPONSE_TIME_MS) {
          await new Promise((resolve) =>
            setTimeout(resolve, MIN_RESPONSE_TIME_MS - elapsed),
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
        // Mensaje genérico que no revele información específica
        throw new UnauthorizedException('Credenciales inválidas');
      }

      // Si llegamos aquí, el usuario existe, la contraseña es correcta, está activo y no está bloqueado
      // Limpiar intentos fallidos si existen
      const currentAttempts = user.loginAttempts ?? 0;
      if (currentAttempts !== 0 || user.blockedUntil) {
        await this.userRepository.update(user.id, {
          loginAttempts: 0,
          blockedUntil: null,
        });
      }

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
