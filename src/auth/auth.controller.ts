import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Headers,
  SetMetadata,
  Ip,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginUserDto, UpdateUserRolesDto, CreateEmployeeUserDto } from './dto';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from './decorators/get-user.decorator';
import { User } from './entities/user.entity';
import { RawHeaders } from './decorators/raw-header.decorator';
import { IncomingHttpHeaders } from 'http';
import { UserRoleGuard } from './guards/user-role/user-role.guard';
import { RoleProtected } from './decorators/role-protected.decorator';
import { ValidRoles } from './interfaces';
import { Auth } from './decorators';
import { ApiOperation, ApiParam, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 registros por hora por IP
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o usuario ya existe' })
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.authService.create(createUserDto);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto por IP
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  loginUser(@Body() loginUserDto: LoginUserDto, @Req() req: Request) {
    // Obtener IP del cliente (considera proxies y load balancers)
    const ipAddress =
      req.ip ||
      (req.connection as any)?.remoteAddress ||
      (req.socket as any)?.remoteAddress ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      'unknown';

    return this.authService.login(loginUserDto, ipAddress);
  }

  @Post('register/employee')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Registrar un usuario interno para un empleado' })
  @ApiResponse({ status: 201, description: 'Usuario creado correctamente' })
  @ApiResponse({ status: 400, description: 'Solicitud inválida' })
  createEmployeeUser(@Body() dto: CreateEmployeeUserDto) {
    return this.authService.createEmployeeUser(dto);
  }

  @Get('check-status')
  @Auth(ValidRoles.admin, ValidRoles.vendedor, ValidRoles.conductor, ValidRoles.cliente)
  @ApiBearerAuth('JWT-auth')
  checkAuthStatus(@GetUser() user: User) {
    return this.authService.checkAuthStatus(user);
  }

  @Get('private')
  @UseGuards(AuthGuard())
  @ApiBearerAuth('JWT-auth')
  testingPrivateRoute(
    //@Req() request: Express.Request
    @GetUser() user: User,
    @GetUser('email') userEmail: string,
    @RawHeaders() rawHeaders: string[],
    @Headers() headers: IncomingHttpHeaders,
  ) {
    return {
      ok: true,
      message: 'This is a private route',
      user,
      userEmail,
      rawHeaders,
      headers,
    };
  }
  //@SetMetadata('roles', ['admin','super-user'])

  // @Get('private2')
  // @RoleProtected(ValidRoles.superUser)
  // @UseGuards(AuthGuard(), UserRoleGuard)
  // privateRoute2(@GetUser() user: User){
  //   return{
  //     ok: true,
  //     user
  //   }
  // }

  //  @Get('private3')
  // @Auth(ValidRoles.superUser, ValidRoles.admin)
  // privateRoute3(@GetUser() user: User){
  //   return{
  //     ok: true,
  //     user
  //   }
  // }

  @Patch('users/:id/roles')
  @Auth(ValidRoles.admin)
  @ApiBearerAuth('JWT-auth')
  @ApiTags('Users')
  @ApiOperation({ summary: 'Actualizar roles de un usuario' })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario (UUID)',
    example: 'a3f0f1c2-1234-4b5a-9c0d-ef1234567890',
  })
  @ApiResponse({ status: 200, description: 'Roles actualizados correctamente' })
  @ApiResponse({
    status: 400,
    description: 'Solicitud inválida o usuario no existe',
  })
  updateUserRoles(@Param('id') id: string, @Body() dto: UpdateUserRolesDto) {
    return this.authService.updateUserRoles(id, dto);
  }
}
