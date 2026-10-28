import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ApplicationEntity,
  InterviewEntity,
  StatusHistoryEntity,
} from '../applications/application.entities';
import { Env } from '../config/env';
import { CreateTrackerTables1730160000000 } from './migrations/1730160000000-create-tracker-tables';

/** Entidades e migrações listadas explicitamente: globs não funcionam com o bundle do webpack. */
export const ENTITIES = [
  ApplicationEntity,
  StatusHistoryEntity,
  InterviewEntity,
];
export const MIGRATIONS = [CreateTrackerTables1730160000000];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        type: 'postgres',
        url: config.get('TRACKER_DATABASE_URL', { infer: true }),
        entities: ENTITIES,
        migrations: MIGRATIONS,
        // Nome próprio: nos testes, vários serviços partilham a mesma base de dados.
        migrationsTableName: 'tracker_migrations',
        migrationsRun: true,
        synchronize: false,
        logging: ['error'],
      }),
    }),
  ],
})
export class DatabaseModule {}
