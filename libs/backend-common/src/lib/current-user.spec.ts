import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { RequireUserGuard } from './current-user';

const ctx = (headers: Record<string, string>) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

describe('RequireUserGuard', () => {
  const guard = new RequireUserGuard();

  it('aceita um x-user-id em formato uuid', () => {
    expect(
      guard.canActivate(
        ctx({ 'x-user-id': '11111111-1111-4111-8111-111111111111' }),
      ),
    ).toBe(true);
  });

  it.each([
    {},
    { 'x-user-id': '' },
    { 'x-user-id': 'admin' },
    { 'x-user-id': "1' OR '1'='1" },
  ])('recusa %p', (headers) => {
    expect(() =>
      guard.canActivate(ctx(headers as Record<string, string>)),
    ).toThrow(UnauthorizedException);
  });
});
