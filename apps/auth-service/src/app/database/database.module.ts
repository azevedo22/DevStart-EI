import pg from 'pg';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '../auth/refresh-token.entity';
import { User } from '../users/user.entity';
import { Env } from '../config/env';
import { CreateAuthTables1730140000000 } from './migrations/1730140000000-create-auth-tables';
import { CreateOutbox1730170000000 } from './migrations/1730170000000-create-outbox';
import { AddDemoAccounts1730180000000 } from './migrations/1730180000000-add-demo-accounts';
import { OutboxEvent } from '../outbox/outbox-event.entity';

/** Entidades e migrações listadas explicitamente: globs não funcionam com o bundle do webpack. */
export const ENTITIES = [User, RefreshToken, OutboxEvent];
export const MIGRATIONS = [
  CreateAuthTables1730140000000,
  CreateOutbox1730170000000,
  AddDemoAccounts1730180000000,
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
        url: config.get('AUTH_DATABASE_URL', { infer: true }),
        entities: ENTITIES,
        migrations: MIGRATIONS,
        // Nome próprio: nos testes, vários serviços podem partilhar a mesma base de dados.
        migrationsTableName: 'auth_migrations',
        migrationsRun: true,
        synchronize: false,
        logging: ['error'],
      }),
    }),
  ],
})
export class DatabaseModule {}
