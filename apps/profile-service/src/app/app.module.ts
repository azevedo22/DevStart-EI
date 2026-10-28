import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CatalogModule } from './catalog/catalog.module';

@Module({
  imports: [CatalogModule],
  controllers: [HealthController],
})
export class AppModule {}
