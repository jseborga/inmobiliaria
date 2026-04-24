import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { PublicPropertiesController } from './public-properties.controller';

@Module({
  imports: [StorageModule],
  controllers: [PropertiesController, PublicPropertiesController],
  providers: [PropertiesService],
})
export class PropertiesModule {}
