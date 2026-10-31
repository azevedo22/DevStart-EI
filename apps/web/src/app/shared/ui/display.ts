import { GoalTier } from '@devstart/shared-types';

/**
 * Pequenas regras de apresentação usadas em vários ecrãs. Ficam aqui para
 * que o mesmo valor tenha sempre o mesmo aspeto (a mesma cor para "Bom", o
 * mesmo limiar para uma compatibilidade "verde").
 */

/** Cor (Bootstrap) de cada patamar do objetivo diário. */
export const GOAL_TIER_COLOR: Record<GoalTier, string> = {
  SUFFICIENT: 'info',
  GOOD: 'primary',
  EXCELLENT: 'success',
};

/** Cor da percentagem de compatibilidade com o perfil: ≥70 boa, ≥40 média. */
export function matchClass(percentage: number | null): string {
  const p = percentage ?? 0;
  return p >= 70
    ? 'text-success'
    : p >= 40
      ? 'text-warning-emphasis'
      : 'text-danger';
}

/** "Cláudio Azevedo" → "CA"; um só nome → uma letra. */
export function initialsOf(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}
