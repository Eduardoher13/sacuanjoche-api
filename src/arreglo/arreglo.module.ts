import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArregloService } from './arreglo.service';
import { ArregloController } from './arreglo.controller';
import { Arreglo } from './entities/arreglo.entity';
import { FormaArreglo } from 'src/forma-arreglo/entities/forma-arreglo.entity';
import { ArregloMedia } from './entities/arreglo-media.entity';
import { ArregloMediaService } from './services/arreglo-media.service';
import { ArreglosMediaController } from './controllers/arreglos-media.controller';
import { ArregloFlor } from 'src/arreglo-flor/entities/arreglo-flor.entity';
import { AccesoriosArreglo } from 'src/accesorios-arreglo/entities/accesorios-arreglo.entity';
import { Flor } from 'src/flor/entities/flor.entity';
import { Accesorio } from 'src/accesorio/entities/accesorio.entity';
import { CatalogoController } from './controllers/catalogo.controller';
import { AuthModule } from 'src/auth/auth.module';
import { StorageModule } from 'src/common/storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Arreglo,
      FormaArreglo,
      ArregloMedia,
      ArregloFlor,
      AccesoriosArreglo,
      Flor,
      Accesorio,
    ]),
    AuthModule,
    StorageModule,
  ],
  controllers: [ArregloController, ArreglosMediaController, CatalogoController],
  providers: [ArregloService, ArregloMediaService],
  exports: [ArregloService, ArregloMediaService],
})
export class ArregloModule {}
