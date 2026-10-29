import { DemoApplicationsSeeder } from './demo/demo-applications.seeder';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ApplicationEntity,
  InterviewEntity,
  StatusHistoryEntity,
} from './applications/application.entities';
import { ApplicationsController } from './applications/applications.controller';
import { ApplicationsService } from './applications/applications.service';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { UserEventsSubscriber } from './events/user-events.subscriber';
import { HealthController } from './health.controller';
import { InterviewsController } from './interviews/interviews.controller';
import { InterviewsService } from './interviews/interviews.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/tracker-service/.env', '.env'],
      validate: validateEnv,
    }),
    DatabaseModule,
    TypeOrmModule.forFeature([
      ApplicationEntity,
      StatusHistoryEntity,
      InterviewEntity,
    ]),
  ],
  controllers: [HealthController, ApplicationsController, InterviewsController],
  providers: [
    ApplicationsService,
    InterviewsService,
    DemoApplicationsSeeder,
    UserEventsSubscriber,
  ],
})
export class AppModule {}
