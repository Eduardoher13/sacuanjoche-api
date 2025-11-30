import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';
import { AccesorioModule } from './accesorio/accesorio.module';
import { AccesoriosArregloModule } from './accesorios-arreglo/accesorios-arreglo.module';
import { ArregloModule } from './arreglo/arreglo.module';
import { ArregloFlorModule } from './arreglo-flor/arreglo-flor.module';
import { AuthModule } from './auth/auth.module';
import { CarritoModule } from './carrito/carrito.module';
import { CarritosArregloModule } from './carritos-arreglo/carritos-arreglo.module';
import { ClienteModule } from './cliente/cliente.module';
import { ClienteDireccionModule } from './cliente-direccion/cliente-direccion.module';
import { ContactoEntregaModule } from './contacto-entrega/contacto-entrega.module';
import { DetallePedidoModule } from './detalle-pedido/detalle-pedido.module';
import { DireccionModule } from './direccion/direccion.module';
import { EmpleadoModule } from './empleado/empleado.module';
import { EnvioModule } from './envio/envio.module';
import { FacturaModule } from './factura/factura.module';
import { FacturaDetalleModule } from './factura-detalle/factura-detalle.module';
import { FlorModule } from './flor/flor.module';
import { FolioModule } from './folio/folio.module';
import { FormaArregloModule } from './forma-arreglo/forma-arreglo.module';
import { MetodoPagoModule } from './metodo-pago/metodo-pago.module';
import { PagoModule } from './pago/pago.module';
import { PedidoModule } from './pedido/pedido.module';
import { PedidoHistorialModule } from './pedido-historial/pedido-historial.module';
import { RutaModule } from './ruta/ruta.module';
import { MapboxModule } from './common/mapbox/mapbox.module';
import { PrinterModule } from './printer/printer.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ========== Rate Limiting (Throttler) ==========
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000, // 1 minuto
        limit: 20, // 20 peticiones por minuto
      },
      {
        name: 'medium',
        ttl: 600000, // 10 minutos
        limit: 100, // 100 peticiones por 10 minutos
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hora
        limit: 1000, // 1000 peticiones por hora
      },
    ]),

    TypeOrmModule.forRoot({
      ssl: process.env.STAGE === 'prod',
      extra: {
        ssl:
          process.env.STAGE === 'prod' ? { rejectUnauthorized: false } : null,
      },
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT!,
      database: process.env.DB_NAME,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      autoLoadEntities: true,

      // IMPORTANT: Never synchronize schema automatically in production
      // Control with env var to allow sync only in local development
      synchronize: process.env.TYPEORM_SYNC === 'true',
    }),

    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    AccesorioModule,
    AccesoriosArregloModule,
    ArregloModule,
    ArregloFlorModule,
    AuthModule,
    CarritoModule,
    CarritosArregloModule,
    ClienteModule,
    ClienteDireccionModule,
    ContactoEntregaModule,
    DetallePedidoModule,
    DireccionModule,
    EmpleadoModule,
    EnvioModule,
    FacturaModule,
    FacturaDetalleModule,
    FlorModule,
    FolioModule,
    FormaArregloModule,
    MetodoPagoModule,
    PagoModule,
    PedidoModule,
    PedidoHistorialModule,
    RutaModule,
    MapboxModule,
    PrinterModule,
    ReportsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Aplicar ThrottlerGuard globalmente
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
