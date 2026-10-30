import pg from 'pg';
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
import { AddExperienceRequirements1730200000000 } from './migrations/1730200000000-add-experience-requirements';

/** Entidades e migrações listadas explicitamente: globs não funcionam com o bundle do webpack. */
export const ENTITIES = [
  ApplicationEntity,
  StatusHistoryEntity,
  InterviewEntity,
];
export const MIGRATIONS = [
  CreateTrackerTables1730160000000,
  AddExperienceRequirements1730200000000,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        type: 'postgres',
        // Driver explícito: sem isto o TypeORM carrega o 'pg' dinamicamente e o build
        // de produção não o inclui nas dependências da imagem Docker.
        driver: pg,
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
