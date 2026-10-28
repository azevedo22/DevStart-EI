import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Env } from '../config/env';
import {
  ProfileCompetencyEntity,
  ProfileEntity,
} from '../profile/profile.entities';
import {
  ProjectCompetencyEntity,
  ProjectEntity,
} from '../projects/project.entities';
import { CreateProfileTables1730150000000 } from './migrations/1730150000000-create-profile-tables';

/** Entidades e migrações listadas explicitamente: globs não funcionam com o bundle do webpack. */
export const ENTITIES = [
  ProfileEntity,
  ProfileCompetencyEntity,
  ProjectEntity,
  ProjectCompetencyEntity,
];
export const MIGRATIONS = [CreateProfileTables1730150000000];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        type: 'postgres',
        url: config.get('PROFILE_DATABASE_URL', { infer: true }),
        entities: ENTITIES,
        migrations: MIGRATIONS,
        // Nome próprio: nos testes, vários serviços podem partilhar a mesma base de dados.
        migrationsTableName: 'profile_migrations',
        migrationsRun: true,
        synchronize: false,
        logging: ['error'],
      }),
    }),
  ],
})
export class DatabaseModule {}
