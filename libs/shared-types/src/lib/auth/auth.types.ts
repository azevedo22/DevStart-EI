/** Contratos do Auth Service partilhados com o frontend e o gateway. */

export type UserRole = 'STUDENT' | 'GRADUATE' | 'ADMIN';

/** Utilizador tal como sai da API (nunca inclui o hash da password). */
export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // segundos
}

export interface JwtPayload {
  sub: string; // userId
  role: UserRole;
  iat?: number;
  exp?: number;
}
