import { AuthResponse, UserDto } from '@devstart/shared-types';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { Env } from '../config/env';
import { AuthService, AuthSession } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { AuthenticatedRequest, JwtAuthGuard } from './guards/jwt-auth.guard';

export const REFRESH_COOKIE = 'ds_refresh';

/** Limite mais apertado nos endpoints que aceitam passwords (por IP, por minuto). */
const CREDENTIALS_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post('register')
  @Throttle(CREDENTIALS_LIMIT)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.withCookie(res, await this.auth.register(dto));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(CREDENTIALS_LIMIT)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.withCookie(res, await this.auth.login(dto));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    try {
      return this.withCookie(
        res,
        await this.auth.refresh(req.cookies?.[REFRESH_COOKIE]),
      );
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthenticatedRequest): Promise<UserDto> {
    return this.auth.me(req.user.sub);
  }

  private withCookie(res: Response, session: AuthSession): AuthResponse {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      ...this.cookieOptions(),
      expires: session.refreshExpiresAt,
    });
    return session.response;
  }

  /**
   * httpOnly: o JavaScript não o lê (protege de XSS).
   * sameSite strict: o browser não o envia a partir de outros sites (protege de CSRF).
   * path: só viaja para /api/v1/auth, não em todos os pedidos.
   */
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      sameSite: 'strict',
      path: this.config.get('REFRESH_COOKIE_PATH', { infer: true }),
    };
  }
}
