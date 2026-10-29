/** Contratos do Auth Service partilhados com o frontend e o gateway. */

export type UserRole = 'GRADUATE' | 'ADMIN';

/** Utilizador tal como sai da API (nunca inclui o hash da password). */
export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
  /**
   * Só nas contas de demonstração: quando a conta é apagada automaticamente.
   * null numa conta normal.
   */
  demoExpiresAt: string | null;
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

/**
 * Apagar a conta pede a password outra vez: um access token roubado não chega para isso.
 * Exceção: as contas de demonstração não têm password conhecida e apagam-se sem ela.
 */
export interface DeleteAccountRequest {
  password?: string;
}

/**
 * Resposta de register, login, refresh e demo.
 * O refresh token NÃO vem aqui: vai num cookie httpOnly que o JavaScript não lê,
 * o que o protege de ataques XSS. O access token fica só em memória no frontend.
 */
export interface AuthResponse {
  user: UserDto;
  accessToken: string;
  expiresIn: number; // segundos
}

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

/** Regras de password partilhadas entre a validação do frontend e do backend. */
export const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 72, // limite do bcrypt
  pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, // pelo menos uma letra e um número
  message:
    'A password precisa de 8 a 72 caracteres, com pelo menos uma letra e um número.',
} as const;

/** Cabeçalhos que o gateway injeta nos pedidos para os serviços internos. */
export const USER_ID_HEADER = 'x-user-id';
export const USER_ROLE_HEADER = 'x-user-role';
