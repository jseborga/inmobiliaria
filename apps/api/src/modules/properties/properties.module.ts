import { Module } from '@nestjs/common';
import { AIModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { PublicPropertiesController } from './public-properties.controller';

@Module({
  imports: [StorageModule, AIModule],
  controllers: [PropertiesController, PublicPropertiesController],
  providers: [PropertiesService],
})
export class PropertiesModule {}
