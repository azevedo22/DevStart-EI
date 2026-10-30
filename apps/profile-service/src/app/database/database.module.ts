import { AddBackground1730190000000 } from './migrations/1730190000000-add-background';
import {
  EducationEntity,
  ExperienceEntity,
  LanguageEntity,
} from '../background/background.entities';
import pg from 'pg';
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
  EducationEntity,
  ExperienceEntity,
  LanguageEntity,
];
export const MIGRATIONS = [
  CreateProfileTables1730150000000,
  AddBackground1730190000000,
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
