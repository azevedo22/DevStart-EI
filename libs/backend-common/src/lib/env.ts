import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

/**
 * Cria a função `validate` do ConfigModule a partir de uma classe com decorators.
 * Uma configuração inválida impede o arranque, com uma mensagem que diz o que falta.
 */
export function createEnvValidator<T extends object>(
  EnvClass: new () => T,
  service: string,
) {
  return (raw: Record<string, unknown>): T => {
    const env = plainToInstance(EnvClass, raw, { exposeDefaultValues: true });
    const errors = validateSync(env);
    if (errors.length) {
      const detail = errors
        .flatMap((e) => Object.values(e.constraints ?? {}))
        .join('; ');
      throw new Error(`Configuração inválida do ${service}: ${detail}`);
    }
    return env;
  };
}
