import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthResponse } from '@devstart/shared-types';
import { errorInterceptor } from '../http/error.interceptor';
import { safeReturnUrl } from './auth.guards';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

const session = (token: string): AuthResponse => ({
  accessToken: token,
  expiresIn: 900,
  user: {
    id: 'u1',
    email: 'ana@example.com',
    fullName: 'Ana Silva',
    role: 'GRADUATE',
    createdAt: '2026-01-01T00:00:00Z',
    demoExpiresAt: null,
  },
});

describe('autenticação no frontend', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(
          withInterceptors([authInterceptor, errorInterceptor]),
        ),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => backend.verify());

  describe('AuthService', () => {
    it('começa com estado desconhecido até restaurar a sessão', () => {
      expect(auth.status()).toBe('unknown');
      auth.restoreSession().subscribe();
      backend.expectOne('/api/v1/auth/refresh').flush(session('t1'));
      expect(auth.status()).toBe('authenticated');
      expect(auth.user()?.fullName).toBe('Ana Silva');
    });

    it('fica anónimo se não houver sessão para restaurar', () => {
      auth.restoreSession().subscribe();
      backend
        .expectOne('/api/v1/auth/refresh')
        .flush({ message: 'x' }, { status: 401, statusText: 'Unauthorized' });
      expect(auth.status()).toBe('anonymous');
    });

    it('partilha um único pedido de refresh entre chamadas simultâneas', () => {
      const tokens: string[] = [];
      auth.refresh().subscribe((r) => tokens.push(r.accessToken));
      auth.refresh().subscribe((r) => tokens.push(r.accessToken));
      auth.refresh().subscribe((r) => tokens.push(r.accessToken));

      backend.expectOne('/api/v1/auth/refresh').flush(session('t1')); // expectOne falha se houver mais de um
      expect(tokens).toEqual(['t1', 't1', 't1']);
    });

    it('termina a sessão local mesmo que o logout falhe no servidor', () => {
      auth
        .login({ email: 'ana@example.com', password: 'segura123' })
        .subscribe();
      backend.expectOne('/api/v1/auth/login').flush(session('t1'));

      auth.logout().subscribe();
      backend
        .expectOne('/api/v1/auth/logout')
        .flush(null, { status: 500, statusText: 'Erro' });
      expect(auth.status()).toBe('anonymous');
      expect(auth.getAccessToken()).toBeNull();
    });
  });

  describe('authInterceptor', () => {
    beforeEach(() => {
      auth
        .login({ email: 'ana@example.com', password: 'segura123' })
        .subscribe();
      backend.expectOne('/api/v1/auth/login').flush(session('antigo'));
    });

    it('junta o token aos pedidos para a API', () => {
      http.get('/api/v1/profile').subscribe();
      expect(
        backend
          .expectOne('/api/v1/profile')
          .request.headers.get('Authorization'),
      ).toBe('Bearer antigo');
    });

    it('não envia o token para outros domínios', () => {
      http.get('https://exemplo.com/dados').subscribe();
      expect(
        backend
          .expectOne('https://exemplo.com/dados')
          .request.headers.has('Authorization'),
      ).toBe(false);
    });

    it('com 401, faz refresh e repete o pedido com o token novo', () => {
      let body: unknown;
      http.get('/api/v1/profile').subscribe((b) => (body = b));

      backend
        .expectOne('/api/v1/profile')
        .flush(null, { status: 401, statusText: 'Unauthorized' });
      backend.expectOne('/api/v1/auth/refresh').flush(session('novo'));

      const retry = backend.expectOne('/api/v1/profile');
      expect(retry.request.headers.get('Authorization')).toBe('Bearer novo');
      retry.flush({ ok: true });
      expect(body).toEqual({ ok: true });
    });

    it('vários 401 ao mesmo tempo disparam um só refresh', () => {
      http.get('/api/v1/profile').subscribe();
      http.get('/api/v1/applications').subscribe();
      backend
        .expectOne('/api/v1/profile')
        .flush(null, { status: 401, statusText: 'Unauthorized' });
      backend
        .expectOne('/api/v1/applications')
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      backend.expectOne('/api/v1/auth/refresh').flush(session('novo'));
      backend.expectOne('/api/v1/profile').flush({});
      backend.expectOne('/api/v1/applications').flush({});
    });

    it('se o refresh falhar, manda para o login com o caminho de volta', () => {
      const navigate = jest
        .spyOn(TestBed.inject(Router), 'navigate')
        .mockResolvedValue(true);
      http.get('/api/v1/profile').subscribe({ error: () => undefined });

      backend
        .expectOne('/api/v1/profile')
        .flush(null, { status: 401, statusText: 'Unauthorized' });
      backend
        .expectOne('/api/v1/auth/refresh')
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(navigate).toHaveBeenCalledWith(
        ['/login'],
        expect.objectContaining({ queryParams: expect.any(Object) }),
      );
      expect(auth.status()).toBe('anonymous');
    });
  });

  describe('apagar conta', () => {
    beforeEach(() => {
      auth
        .login({ email: 'ana@example.com', password: 'segura123' })
        .subscribe();
      backend.expectOne('/api/v1/auth/login').flush(session('t1'));
    });

    it('envia a password no corpo e termina a sessão local', () => {
      auth.deleteAccount('segura123').subscribe();
      const req = backend.expectOne({
        method: 'DELETE',
        url: '/api/v1/auth/me',
      });
      expect(req.request.body).toEqual({ password: 'segura123' });
      expect(req.request.headers.get('Authorization')).toBe('Bearer t1');
      req.flush(null, { status: 204, statusText: 'No Content' });
      expect(auth.status()).toBe('anonymous');
    });

    it('password errada (403) não tenta renovar a sessão nem a termina', () => {
      let message = '';
      auth
        .deleteAccount('errada')
        .subscribe({ error: (e) => (message = e.message) });
      backend
        .expectOne('/api/v1/auth/me')
        .flush(
          { message: 'Password incorreta.' },
          { status: 403, statusText: 'Forbidden' },
        );
      backend.expectNone('/api/v1/auth/refresh');
      expect(message).toBe('Password incorreta.');
      expect(auth.status()).toBe('authenticated');
    });

    it('numa demonstração apaga sem password (corpo vazio)', () => {
      auth.deleteAccount().subscribe();
      const req = backend.expectOne({
        method: 'DELETE',
        url: '/api/v1/auth/me',
      });
      expect(req.request.body).toEqual({});
      req.flush(null, { status: 204, statusText: 'No Content' });
      expect(auth.status()).toBe('anonymous');
    });
  });

  describe('demonstração', () => {
    it('startDemo abre a sessão e isDemo fica verdadeiro', () => {
      auth.startDemo().subscribe();
      const res = session('demo-token');
      res.user.demoExpiresAt = '2026-12-01T00:00:00Z';
      backend
        .expectOne({ method: 'POST', url: '/api/v1/auth/demo' })
        .flush(res);
      expect(auth.status()).toBe('authenticated');
      expect(auth.isDemo()).toBe(true);
      expect(auth.getAccessToken()).toBe('demo-token');
    });

    it('uma conta normal não é demonstração', () => {
      auth
        .login({ email: 'ana@example.com', password: 'segura123' })
        .subscribe();
      backend.expectOne('/api/v1/auth/login').flush(session('t1'));
      expect(auth.isDemo()).toBe(false);
    });
  });

  describe('safeReturnUrl', () => {
    it.each([
      ['/applications', '/applications'],
      ['/skill-gap?x=1', '/skill-gap?x=1'],
      ['https://site-malicioso.com', '/'],
      ['//site-malicioso.com', '/'],
      [undefined, '/'],
    ])('%p → %p', (input, expected) =>
      expect(safeReturnUrl(input)).toBe(expected),
    );
  });
});
