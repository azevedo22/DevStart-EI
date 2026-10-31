import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './error.interceptor';

const error = (status: number, body: unknown) =>
  toApiError(new HttpErrorResponse({ status, error: body }));

describe('toApiError', () => {
  it('429 com explicação do servidor: mostra-a (diz quanto esperar)', () => {
    expect(
      error(429, {
        message: 'Chegaste ao limite de 20 leituras com IA por hora.',
      }).message,
    ).toBe('Chegaste ao limite de 20 leituras com IA por hora.');
  });

  it('429 sem explicação: mensagem genérica', () => {
    expect(error(429, null).message).toMatch(/Demasiadas tentativas/);
  });

  it('validação: a primeira mensagem, e todas em details', () => {
    const e = error(400, { message: ['Nome em falta', 'Email inválido'] });
    expect(e.message).toBe('Nome em falta');
    expect(e.details).toEqual(['Nome em falta', 'Email inválido']);
  });

  it('sem ligação ao servidor', () => {
    expect(error(0, null).message).toMatch(/Não foi possível contactar/);
  });
});
