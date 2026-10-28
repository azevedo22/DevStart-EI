import { AuthResponse, JwtPayload, UserDto } from '@devstart/shared-types';
import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import { Env } from '../config/env';
import { User, toUserDto } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { RefreshToken } from './refresh-token.entity';
import {
  formatToken,
  generateSecret,
  hashSecret,
  parseToken,
  secretMatches,
} from './refresh-token.util';

/** Resultado interno: a resposta pública + o refresh token, que o controller põe no cookie. */
export interface AuthSession {
  response: AuthResponse;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const INVALID_CREDENTIALS = 'Email ou password incorretos.';
const INVALID_SESSION = 'Sessão inválida ou expirada. Inicia sessão novamente.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Hash de referência para manter o tempo de resposta igual quando o email não existe. */
  private readonly dummyHash: string;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
  ) {
    this.dummyHash = bcrypt.hashSync('dummy-password-for-timing', this.rounds);
  }

  async register(dto: RegisterDto): Promise<AuthSession> {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('Já existe uma conta com este email.');
    }
    const passwordHash = await bcrypt.hash(dto.password, this.rounds);
    try {
      const user = await this.users.create({ ...dto, passwordHash });
      return this.startSession(user, randomUUID());
    } catch (err) {
      // Dois registos simultâneos com o mesmo email: o índice único decide.
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException('Já existe uma conta com este email.');
      }
      throw err;
    }
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const user = await this.users.findByEmail(dto.email);
    // Compara sempre, mesmo sem utilizador, para não revelar que emails existem pelo tempo de resposta.
    const ok = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? this.dummyHash,
    );
    if (!user || !ok) throw new UnauthorizedException(INVALID_CREDENTIALS);
    return this.startSession(user, randomUUID());
  }

  /**
   * Rotação: cada refresh revoga o token usado e emite um novo da mesma família.
   * Se aparecer um token já revogado, alguém o copiou: revoga-se a família toda.
   */
  async refresh(rawToken: string | undefined): Promise<AuthSession> {
    const parsed = parseToken(rawToken);
    if (!parsed) throw new UnauthorizedException(INVALID_SESSION);

    const stored = await this.tokens.findOneBy({ id: parsed.id });
    if (!stored || !secretMatches(parsed.secret, stored.tokenHash)) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    if (stored.revokedAt) {
      this.logger.warn(
        `Reutilização de refresh token detetada (família ${stored.familyId}); a revogar a família.`,
      );
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException(INVALID_SESSION);
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    const user = await this.users.findById(stored.userId);
    if (!user) throw new UnauthorizedException(INVALID_SESSION);

    // Revogação condicional: se dois pedidos rodarem o mesmo token ao mesmo tempo, só um ganha.
    const result = await this.tokens.update(
      { id: stored.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (!result.affected) throw new UnauthorizedException(INVALID_SESSION);

    return this.startSession(user, stored.familyId);
  }

  /** Logout é idempotente: um token inválido ou ausente não é erro. */
  async logout(rawToken: string | undefined): Promise<void> {
    const parsed = parseToken(rawToken);
    if (!parsed) return;
    const stored = await this.tokens.findOneBy({ id: parsed.id });
    if (stored && secretMatches(parsed.secret, stored.tokenHash)) {
      await this.revokeFamily(stored.familyId);
    }
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException(INVALID_SESSION);
    return toUserDto(user);
  }

  private async startSession(
    user: User,
    familyId: string,
  ): Promise<AuthSession> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const expiresIn = this.config.get('JWT_ACCESS_TTL', { infer: true });
    const accessToken = await this.jwt.signAsync(payload, { expiresIn });

    const secret = generateSecret();
    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    const refreshExpiresAt = new Date(
      Date.now() + ttlDays * 24 * 60 * 60 * 1000,
    );
    const saved = await this.tokens.save(
      this.tokens.create({
        userId: user.id,
        familyId,
        tokenHash: hashSecret(secret),
        expiresAt: refreshExpiresAt,
        revokedAt: null,
      }),
    );

    return {
      response: { user: toUserDto(user), accessToken, expiresIn },
      refreshToken: formatToken(saved.id, secret),
      refreshExpiresAt,
    };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.tokens.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private get rounds(): number {
    return this.config.get('BCRYPT_ROUNDS', { infer: true });
  }
}
