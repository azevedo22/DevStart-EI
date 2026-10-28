import { COMPETENCIES } from './competencies.seed';
import { TARGET_STACKS } from './target-stacks.seed';

/** Protege os seeds contra erros de escrita: ids duplicados ou referências partidas. */
describe('seed integrity', () => {
  const competencyIds = new Set(COMPETENCIES.map((c) => c.id));

  it('não tem ids de competência duplicados', () => {
    expect(competencyIds.size).toBe(COMPETENCIES.length);
  });

  it('usa slugs em minúsculas e aliases em minúsculas', () => {
    for (const c of COMPETENCIES) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/);
      for (const alias of c.aliases) expect(alias).toBe(alias.toLowerCase());
    }
  });

  it.each(TARGET_STACKS.map((s) => [s.id, s] as const))(
    'stack %s só referencia competências existentes',
    (_id, stack) => {
      for (const req of stack.requirements) {
        expect(competencyIds.has(req.competencyId)).toBe(true);
      }
      const reqIds = stack.requirements.map((r) => r.competencyId);
      expect(new Set(reqIds).size).toBe(reqIds.length);
    },
  );
});
