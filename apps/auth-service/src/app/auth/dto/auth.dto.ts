import {
  DeleteAccountRequest,
  LoginRequest,
  PASSWORD_RULES,
  RegisterRequest,
} from '@devstart/shared-types';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDto implements RegisterRequest {
  @Transform(trim)
  @IsEmail({}, { message: 'Email inválido.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(PASSWORD_RULES.minLength, PASSWORD_RULES.maxLength, {
    message: PASSWORD_RULES.message,
  })
  @Matches(PASSWORD_RULES.pattern, { message: PASSWORD_RULES.message })
  password!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 120, { message: 'O nome precisa de 2 a 120 caracteres.' })
  fullName!: string;
}

/** No login não se validam as regras da password: só se confirma se coincide. */
export class LoginDto implements LoginRequest {
  @Transform(trim)
  @IsEmail({}, { message: 'Email inválido.' })
  email!: string;

  @IsString()
  @MaxLength(PASSWORD_RULES.maxLength)
  password!: string;
}

export class DeleteAccountDto implements DeleteAccountRequest {
  /** Obrigatória exceto nas contas de demonstração (verificado no serviço). */
  @IsOptional()
  @IsString()
  @MaxLength(PASSWORD_RULES.maxLength)
  password?: string;
}
