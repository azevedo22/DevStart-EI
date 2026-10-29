import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from './catalog/catalog.module';
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
    ]),
    CatalogModule,
  ],
  controllers: [
    HealthController,
    ProfileController,
    ProjectsController,
    SkillGapController,
  ],
  providers: [
    ProfileService,
    ProjectsService,
    DemoProfileSeeder,
    UserEventsSubscriber,
  ],
})
export class AppModule {}
