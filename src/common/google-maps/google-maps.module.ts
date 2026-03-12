import { Module } from '@nestjs/common';
import { GoogleMapsService } from './google-maps.service';
import { GoogleMapsController } from './google-maps.controller';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [GoogleMapsService],
  controllers: [GoogleMapsController],
  exports: [GoogleMapsService],
})
export class GoogleMapsModule {}