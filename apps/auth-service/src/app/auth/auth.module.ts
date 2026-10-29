import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Env } from '../config/env';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshToken } from './refresh-token.entity';
import { OutboxRelay } from '../outbox/outbox-relay';
import { AccountRemovalService } from '../users/account-removal.service';
import { DemoAccountsService } from './demo-accounts.service';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([RefreshToken]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256', issuer: 'devstart-auth' },
        verifyOptions: { algorithms: ['HS256'], issuer: 'devstart-auth' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    DemoAccountsService,
    AccountRemovalService,
    JwtAuthGuard,
    OutboxRelay,
  ],
  exports: [OutboxRelay, DemoAccountsService],
})
export class AuthModule {}
