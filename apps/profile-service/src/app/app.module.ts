import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackgroundController } from './background/background.controller';
import {
  EducationEntity,
  ExperienceEntity,
  LanguageEntity,
} from './background/background.entities';
import { BackgroundService } from './background/background.service';
import { CatalogModule } from './catalog/catalog.module';
import { CvController } from './cv/cv.controller';
import { CvService } from './cv/cv.service';
import { STRUCTURED_LLM } from './cv/llm';
import { OllamaClient } from './cv/ollama.client';
import { OpenAiCompatibleClient } from './cv/openai-compatible.client';
import type { Env } from './config/env';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { DemoProfileSeeder } from './demo/demo-profile.seeder';
import { UserEventsSubscriber } from './events/user-events.subscriber';
import { HealthController } from './health.controller';
import { ProfileController } from './profile/profile.controller';
import {
  ProfileCompetencyEntity,
  ProfileEntity,
} from './profile/profile.entities';
import { ProfileService } from './profile/profile.service';
import {
  ProjectCompetencyEntity,
  ProjectEntity,
} from './projects/project.entities';
import { ProjectsController } from './projects/projects.controller';
import { ProjectsService } from './projects/projects.service';
import { SkillGapController } from './skill-gap/skill-gap.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/profile-service/.env', '.env'],
      validate: validateEnv,
    }),
    DatabaseModule,
    TypeOrmModule.forFeature([
      ProfileEntity,
      ProfileCompetencyEntity,
      ProjectEntity,
      ProjectCompetencyEntity,
      EducationEntity,
      ExperienceEntity,
      LanguageEntity,
    ]),
    CatalogModule,
  ],
  controllers: [
    HealthController,
    ProfileController,
    BackgroundController,
    CvController,
    ProjectsController,
    SkillGapController,
  ],
  providers: [
    ProfileService,
    BackgroundService,
    CvService,
    OllamaClient,
    OpenAiCompatibleClient,
    // A IA que lê os CVs escolhe-se no .env (LLM_PROVIDER).
    {
      provide: STRUCTURED_LLM,
      inject: [ConfigService, OllamaClient, OpenAiCompatibleClient],
      useFactory: (
        config: ConfigService<Env, true>,
        ollama: OllamaClient,
        xai: OpenAiCompatibleClient,
      ) =>
        config.get('LLM_PROVIDER', { infer: true }) === 'xai' ? xai : ollama,
    },
    ProjectsService,
    DemoProfileSeeder,
    UserEventsSubscriber,
  ],
})
export class AppModule {}
