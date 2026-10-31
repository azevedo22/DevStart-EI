import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthResponse, Profile, Project } from '@devstart/shared-types';
import { AuthService } from '../auth/auth.service';
import { ProfileStore } from './profile-store';

const session = (id: string): AuthResponse => ({
  accessToken: 't',
  expiresIn: 900,
  user: {
    id,
    email: `${id}@example.com`,
    fullName: 'Teste',
    role: 'GRADUATE',
    createdAt: '2026-01-01T00:00:00Z',
    demoExpiresAt: null,
  },
});

const profile = (userId: string, competencyIds: string[] = []): Profile => ({
  userId,
  headline: null,
  location: null,
  university: null,
  graduationYear: null,
  bio: null,
  linkedinUrl: null,
  githubUrl: null,
  portfolioUrl: null,
  education: [],
  experience: [],
  languages: [],
  updatedAt: '2026-01-01T00:00:00Z',
  competencies: competencyIds.map((competencyId) => ({
    competencyId,
    level: 'BASIC',
    declaredAt: '2026-01-01T00:00:00Z',
  })),
});

const project = (id: string, competencyIds: string[]): Project => ({
  id,
  title: id,
  description: 'Descrição do projeto',
  repositoryUrl: null,
  liveUrl: null,
  origin: 'PERSONAL',
  academicContext: null,
  competencyIds,
  practices: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

describe('ProfileStore', () => {
  let store: ProfileStore;
  let auth: AuthService;
  let backend: HttpTestingController;

  /** Ao entrar, o store pede a foto (para o menu); por omissão, ainda não há. */
  function signIn(userId: string, photo: Blob | null = null) {
    auth.login({ email: 'x', password: 'y' }).subscribe();
    backend.expectOne('/api/v1/auth/login').flush(session(userId));
    TestBed.tick(); // corre os effects
    const req = backend.expectOne('/api/v1/profile/photo');
    if (photo) req.flush(photo);
    else req.flush(new Blob(), { status: 404, statusText: 'Not Found' });
  }

  function load(p: Profile, projects: Project[] = []) {
    store.load();
    backend.expectOne('/api/v1/profile').flush(p);
    backend.expectOne('/api/v1/projects').flush(projects);
  }

  let urls = 0;
  beforeAll(() => {
    // O jsdom não tem URL.createObjectURL.
    Object.assign(URL, {
      createObjectURL: jest.fn(() => `blob:foto-${++urls}`),
      revokeObjectURL: jest.fn(),
    });
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(ProfileStore);
    auth = TestBed.inject(AuthService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('não pede nada sem sessão', () => {
    store.load();
    backend.expectNone('/api/v1/profile');
  });

  it('carrega perfil e projetos uma só vez', () => {
    signIn('ana');
    load(profile('ana', ['angular']));
    store.load();
    backend.expectNone('/api/v1/profile');
    expect(store.competencies()).toHaveLength(1);
  });

  it('conta quantos projetos demonstram cada competência', () => {
    signIn('ana');
    load(profile('ana', ['angular', 'docker']), [
      project('a', ['angular', 'docker']),
      project('b', ['angular']),
    ]);
    expect(store.projectCountByCompetency().get('angular')).toBe(2);
    expect(store.projectCountByCompetency().get('docker')).toBe(1);
    expect(store.competenciesWithProjects()).toEqual(
      new Set(['angular', 'docker']),
    );
  });

  it('esquece os dados ao terminar sessão', () => {
    signIn('ana');
    load(profile('ana', ['angular']), [project('a', ['angular'])]);

    auth.clearSession();
    TestBed.tick();

    expect(store.loaded()).toBe(false);
    expect(store.projects()).toEqual([]);
  });

  it('outro utilizador no mesmo browser nunca vê os dados do anterior', () => {
    signIn('ana');
    load(profile('ana', ['angular']));

    signIn('rui');
    expect(store.competencies()).toEqual([]);
    load(profile('rui'));
    expect(store.profile()?.userId).toBe('rui');
  });

  it('ao guardar um projeto, atualiza a lista com a resposta do servidor', () => {
    signIn('ana');
    load(profile('ana'), [project('a', [])]);

    store
      .saveProject({
        title: 'b',
        description: 'x',
        origin: 'PERSONAL',
        competencyIds: ['react'],
        practices: [],
      })
      .subscribe();
    backend
      .expectOne({ method: 'POST', url: '/api/v1/projects' })
      .flush(project('b', ['react']));

    expect(store.projects().map((p) => p.id)).toEqual(['b', 'a']);
  });

  describe('importação do CV', () => {
    it('envia o ficheiro como multipart no campo "file"', () => {
      signIn('ana');
      const file = new File(['%PDF-1.4'], 'cv.pdf', {
        type: 'application/pdf',
      });
      store.analyzeCv(file).subscribe();
      const req = backend.expectOne({
        method: 'POST',
        url: '/api/v1/profile/cv/analyze',
      });
      const body = req.request.body as FormData;
      expect(body).toBeInstanceOf(FormData);
      expect((body.get('file') as File).name).toBe('cv.pdf');
      req.flush({});
    });

    it('depois de importar, usa o perfil devolvido e recarrega os projetos', () => {
      signIn('ana');
      load(profile('ana'));
      store
        .importCv({ competencies: [{ competencyId: 'java', level: 'BASIC' }] })
        .subscribe();
      backend
        .expectOne({ method: 'POST', url: '/api/v1/profile/cv/import' })
        .flush(profile('ana', ['java']));
      backend.expectOne('/api/v1/projects').flush([project('novo', ['java'])]);

      expect(store.competencies().map((c) => c.competencyId)).toEqual(['java']);
      expect(store.projects().map((p) => p.id)).toEqual(['novo']);
    });
  });

  describe('foto de perfil', () => {
    it('ao entrar, carrega a foto para o menu', () => {
      signIn('ana', new Blob(['jpg'], { type: 'image/jpeg' }));
      expect(store.photoUrl()).toMatch(/^blob:/);
    });

    it('sem foto, fica sem URL (404 não é erro)', () => {
      signIn('ana');
      expect(store.photoUrl()).toBeNull();
    });

    it('enviar: multipart no campo "file", e a foto aparece logo', () => {
      signIn('ana');
      const photo = new Blob(['jpg'], { type: 'image/jpeg' });
      store.uploadPhoto(photo).subscribe();
      const req = backend.expectOne('/api/v1/profile/photo');
      expect(req.request.method).toBe('PUT');
      expect((req.request.body as FormData).get('file')).toBeInstanceOf(Blob);
      req.flush(null, { status: 204, statusText: 'No Content' });
      expect(store.photoUrl()).toMatch(/^blob:/);
    });

    it('remover apaga a foto e liberta o URL antigo', () => {
      signIn('ana', new Blob(['jpg']));
      const old = store.photoUrl();
      store.removePhoto().subscribe();
      backend
        .expectOne(
          (r) => r.method === 'DELETE' && r.url === '/api/v1/profile/photo',
        )
        .flush(null, { status: 204, statusText: 'No Content' });
      expect(store.photoUrl()).toBeNull();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(old);
    });

    it('outro utilizador no mesmo browser não vê a foto do anterior', () => {
      signIn('ana', new Blob(['jpg']));
      auth.logout().subscribe();
      backend.expectOne('/api/v1/auth/logout').flush(null);
      TestBed.tick();
      expect(store.photoUrl()).toBeNull();
      signIn('rui');
      expect(store.photoUrl()).toBeNull();
    });
  });
});
