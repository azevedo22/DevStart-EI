import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  APPLICATION_STATUSES,
  ApplicationBoard,
  ApplicationStats,
  AuthResponse,
  JobApplication,
} from '@devstart/shared-types';
import { AuthService } from '../../../core/auth/auth.service';
import { ApplicationsStore, applyMove } from './applications-store';

const card = (
  id: string,
  status: JobApplication['status'],
  position: number,
): JobApplication => ({
  id,
  companyName: id,
  jobTitle: 'Dev',
  jobUrl: null,
  location: null,
  workMode: 'REMOTE',
  status,
  position,
  requiredCompetencyIds: [],
  yearsRequired: null,
  experienceRequirements: [],
  seniority: 'JUNIOR',
  accessibility: 'ENTRY_FRIENDLY',
  mislabeledJunior: false,
  appliedAt: '2026-10-20',
  notes: null,
  interviewCount: 0,
  createdAt: '2026-10-20T00:00:00Z',
  updatedAt: '2026-10-20T00:00:00Z',
});

function boardOf(
  columns: Partial<Record<JobApplication['status'], string[]>>,
): ApplicationBoard {
  return Object.fromEntries(
    APPLICATION_STATUSES.map((s) => [
      s,
      (columns[s] ?? []).map((id, i) => card(id, s, i)),
    ]),
  ) as ApplicationBoard;
}

const ids = (board: ApplicationBoard, s: JobApplication['status']) =>
  board[s].map((c) => c.id);
const positions = (board: ApplicationBoard) =>
  APPLICATION_STATUSES.every((s) =>
    board[s].every((c, i) => c.position === i && c.status === s),
  );

describe('applyMove (o mesmo algoritmo do servidor)', () => {
  const start = boardOf({ APPLIED: ['a', 'b', 'c'], HR_INTERVIEW: ['x'] });

  it('move entre colunas e renumera as duas', () => {
    const b = applyMove(start, start.APPLIED[1], 'HR_INTERVIEW', 0);
    expect(ids(b, 'APPLIED')).toEqual(['a', 'c']);
    expect(ids(b, 'HR_INTERVIEW')).toEqual(['b', 'x']);
    expect(positions(b)).toBe(true);
  });

  it('reordena dentro da coluna', () => {
    const b = applyMove(start, start.APPLIED[0], 'APPLIED', 2);
    expect(ids(b, 'APPLIED')).toEqual(['b', 'c', 'a']);
    expect(positions(b)).toBe(true);
  });

  it('limita a posição ao tamanho da coluna', () => {
    const b = applyMove(start, start.APPLIED[0], 'OFFER', 99);
    expect(ids(b, 'OFFER')).toEqual(['a']);
  });

  it('não altera o quadro original (imutável)', () => {
    applyMove(start, start.APPLIED[0], 'OFFER', 0);
    expect(ids(start, 'APPLIED')).toEqual(['a', 'b', 'c']);
  });
});

describe('ApplicationsStore', () => {
  let store: ApplicationsStore;
  let backend: HttpTestingController;

  const stats = { total: 0 } as ApplicationStats;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(ApplicationsStore);
    backend = TestBed.inject(HttpTestingController);

    const auth = TestBed.inject(AuthService);
    auth.login({ email: 'x', password: 'y' }).subscribe();
    backend.expectOne('/api/v1/auth/login').flush({
      accessToken: 't',
      expiresIn: 900,
      user: {
        id: 'ana',
        email: 'a@b.pt',
        fullName: 'Ana',
        role: 'GRADUATE',
        createdAt: '',
        demoExpiresAt: null,
      },
    } satisfies AuthResponse);
    TestBed.tick();

    store.load();
    backend
      .expectOne('/api/v1/applications/board')
      .flush(boardOf({ APPLIED: ['a', 'b'] }));
    backend.expectOne('/api/v1/applications/stats').flush(stats);
  });

  afterEach(() => backend.verify());

  it('move de imediato, antes da resposta do servidor', () => {
    store.move('b', 'HR_INTERVIEW', 0);
    expect(ids(store.board()!, 'HR_INTERVIEW')).toEqual(['b']);

    backend
      .expectOne('/api/v1/applications/b/move')
      .flush(card('b', 'HR_INTERVIEW', 0));
    backend.expectOne('/api/v1/applications/stats').flush(stats);
  });

  it('se o servidor recusar, volta exatamente ao estado anterior e avisa', async () => {
    const before = store.board();
    const result = store.move('b', 'OFFER', 0);
    backend
      .expectOne('/api/v1/applications/b/move')
      .flush({ message: 'x' }, { status: 500, statusText: 'Erro' });

    await expect(result).rejects.toBeDefined();
    expect(store.board()).toBe(before);
    expect(store.error()).toMatch(/Não foi possível mover/);
  });

  it('filtra sem pedir nada ao servidor', () => {
    store.search.set('b');
    expect(ids(store.visibleBoard(), 'APPLIED')).toEqual(['b']);
    expect(store.filtersActive()).toBe(true);
  });

  it('uma candidatura nova entra no topo da coluna', () => {
    store.create({} as never).subscribe();
    backend
      .expectOne({ method: 'POST', url: '/api/v1/applications' })
      .flush(card('n', 'APPLIED', 0));
    backend.expectOne('/api/v1/applications/stats').flush(stats);
    expect(ids(store.board()!, 'APPLIED')).toEqual(['n', 'a', 'b']);
    expect(positions(store.board()!)).toBe(true);
  });

  it('esquece o quadro ao terminar sessão', () => {
    TestBed.inject(AuthService).clearSession();
    TestBed.tick();
    expect(store.loaded()).toBe(false);
  });
});
