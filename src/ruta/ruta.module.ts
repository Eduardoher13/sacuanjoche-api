import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RutaService } from './ruta.service';
import { RutaController } from './ruta.controller';
import { Ruta } from './entities/ruta.entity';
import { RutaPedido } from './entities/ruta-pedido.entity';
import { Pedido } from '../pedido/entities/pedido.entity';
import { Empleado } from '../empleado/entities/empleado.entity';
import { Envio } from '../envio/entities/envio.entity';
import { User } from '../auth/entities/user.entity';
import { MapboxModule } from '../common/mapbox/mapbox.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ruta, RutaPedido, Pedido, Empleado, Envio, User]),
    MapboxModule,
    AuthModule,
  ],
  controllers: [RutaController],
  providers: [RutaService],
  exports: [RutaService],
})
export class RutaModule {}
