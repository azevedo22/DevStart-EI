import { AuthResponse, JwtPayload, UserDto } from '@devstart/shared-types';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Env } from '../config/env';
import { AccountRemovalService } from '../users/account-removal.service';
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
    @InjectDataSource() private readonly db: DataSource,
    private readonly removal: AccountRemovalService,
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
      return this.startSession(user);
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
    return this.startSession(user);
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

  /**
   * Apaga a conta (direito ao apagamento, RGPD). Confirma a password, apaga o
   * utilizador e regista o evento user.deleted no outbox, na mesma transação.
   * Os outros serviços apagam os seus dados quando o evento lhes chega.
   *
   * As contas de demonstração não têm password conhecida: apagam-se sem ela.
   */
  async deleteAccount(userId: string, password?: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException(INVALID_SESSION);
    if (!user.demoExpiresAt) {
      if (!password) throw new BadRequestException('Indica a password.');
      // 403 e não 401: a sessão é válida, a confirmação é que falhou. Com 401, o
      // frontend tentaria renovar a sessão e repetir o pedido.
      if (!(await bcrypt.compare(password, user.passwordHash))) {
        throw new ForbiddenException('Password incorreta.');
      }
    }

    await this.db.transaction((em) => this.removal.removeWithin(em, [userId]));
    await this.removal.afterCommit([userId]);
    this.logger.log(`Conta ${userId} apagada; evento user.deleted no outbox.`);
  }

  /**
   * Abre uma sessão para o utilizador: access token (JWT) e um refresh token novo.
   * Numa conta de demonstração, o refresh token não dura mais do que a conta.
   */
  async startSession(
    user: User,
    familyId: string = randomUUID(),
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
      Math.min(
        Date.now() + ttlDays * 24 * 60 * 60 * 1000,
        user.demoExpiresAt?.getTime() ?? Infinity,
      ),
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
