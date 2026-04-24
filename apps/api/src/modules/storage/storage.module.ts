import { Module } from '@nestjs/common';
import { MockStorageController } from './mock-storage.controller';
import { StorageService } from './storage.service';

/**
 * Módulo de storage. Exporta StorageService para ser inyectado en Properties.
 * El controlador mock se monta siempre pero solo responde si el driver está en
 * modo mock (verificado en cada handler).
 */
@Module({
  controllers: [MockStorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
