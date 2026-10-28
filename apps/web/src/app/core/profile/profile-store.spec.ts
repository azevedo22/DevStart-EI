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
  },
});

const profile = (userId: string, competencyIds: string[] = []): Profile => ({
  userId,
  headline: null,
  university: null,
  graduationYear: null,
  bio: null,
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

  function signIn(userId: string) {
    auth.login({ email: 'x', password: 'y' }).subscribe();
    backend.expectOne('/api/v1/auth/login').flush(session(userId));
    TestBed.tick(); // corre os effects
  }

  function load(p: Profile, projects: Project[] = []) {
    store.load();
    backend.expectOne('/api/v1/profile').flush(p);
    backend.expectOne('/api/v1/projects').flush(projects);
  }

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
});
