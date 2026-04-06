import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { CompaniaController } from './compañia.controller';
import { CompaniaService } from './compañia.service';
import { Compania } from './entities/compañia.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Compania]), AuthModule],
  controllers: [CompaniaController],
  providers: [CompaniaService],
  exports: [CompaniaService],
})
export class CompaniaModule {}
