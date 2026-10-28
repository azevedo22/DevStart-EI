import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '../auth/refresh-token.entity';
import { User } from '../users/user.entity';
import { Env } from '../config/env';
import { CreateAuthTables1730140000000 } from './migrations/1730140000000-create-auth-tables';

/** Entidades e migrações listadas explicitamente: globs não funcionam com o bundle do webpack. */
export const ENTITIES = [User, RefreshToken];
export const MIGRATIONS = [CreateAuthTables1730140000000];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        type: 'postgres',
        url: config.get('AUTH_DATABASE_URL', { infer: true }),
        entities: ENTITIES,
        migrations: MIGRATIONS,
        migrationsRun: true,
        synchronize: false,
        logging: ['error'],
      }),
    }),
  ],
})
export class DatabaseModule {}
