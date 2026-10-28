import { TargetStack } from '../profile/profile.types';
import { calculateSkillGap } from './calculate-skill-gap';

const stack: TargetStack = {
  id: 'test-stack',
  title: 'Test',
  description: '',
  requirements: [
    { competencyId: 'typescript', minLevel: 'INTERMEDIATE', weight: 5 },
    { competencyId: 'angular', minLevel: 'INTERMEDIATE', weight: 4 },
    { competencyId: 'docker', minLevel: 'BASIC', weight: 1 },
  ],
};

describe('calculateSkillGap', () => {
  it('devolve 0% e tudo em falta para um perfil vazio', () => {
    const r = calculateSkillGap(stack, [], new Set());
    expect(r.matchPercentage).toBe(0);
    expect(r.missing.map((m) => m.competencyId)).toEqual([
      'typescript',
      'angular',
      'docker',
    ]);
  });

  it('devolve 100% quando todos os níveis são cumpridos', () => {
    const r = calculateSkillGap(
      stack,
      [
        { competencyId: 'typescript', level: 'ADVANCED' },
        { competencyId: 'angular', level: 'INTERMEDIATE' },
        { competencyId: 'docker', level: 'BASIC' },
      ],
      new Set(),
    );
    expect(r.matchPercentage).toBe(100);
    expect(r.missing).toHaveLength(0);
  });

  it('dá crédito proporcional abaixo do nível pedido', () => {
    // typescript BASIC num pedido INTERMEDIATE → 2.5 de 5; total 10 → 25%
    const r = calculateSkillGap(
      stack,
      [{ competencyId: 'typescript', level: 'BASIC' }],
      new Set(),
    );
    expect(r.matchPercentage).toBe(25);
    expect(r.belowLevel.map((b) => b.competencyId)).toEqual(['typescript']);
  });

  it('separa competências cobertas com e sem projeto, sem mudar a percentagem', () => {
    const user = [
      { competencyId: 'typescript', level: 'INTERMEDIATE' as const },
      { competencyId: 'angular', level: 'INTERMEDIATE' as const },
    ];
    const without = calculateSkillGap(stack, user, new Set());
    const withProj = calculateSkillGap(stack, user, new Set(['angular']));

    expect(withProj.matchPercentage).toBe(without.matchPercentage);
    expect(withProj.coveredWithProjects.map((c) => c.competencyId)).toEqual([
      'angular',
    ]);
    expect(withProj.coveredWithoutProjects.map((c) => c.competencyId)).toEqual([
      'typescript',
    ]);
  });

  it('ordena a checklist por peso', () => {
    const r = calculateSkillGap(
      stack,
      [{ competencyId: 'docker', level: 'BASIC' }],
      new Set(),
    );
    expect(r.missing.map((m) => m.weight)).toEqual([5, 4]);
  });
});
