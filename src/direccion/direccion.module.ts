import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DireccionService } from './direccion.service';
import { DireccionController } from './direccion.controller';
import { Direccion } from './entities/direccion.entity';
import { GoogleMapsModule } from 'src/common/google-maps/google-maps.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Direccion]), GoogleMapsModule, AuthModule],
  controllers: [DireccionController],
  providers: [DireccionService],
  exports: [DireccionService],
})
export class DireccionModule {}
