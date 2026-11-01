import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Silence } from '@devstart/shared-types';
import { AuthService } from '../../../../core/auth/auth.service';
import { SilenceNotice } from './silence-notice';

const APP = {
  companyName: 'Ribeira Tech',
  jobTitle: 'Junior Backend Developer',
  appliedAt: '2026-10-15',
};

describe('SilenceNotice', () => {
  const render = (silence: Silence) => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { user: signal({ fullName: 'Ana Exemplo' }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(SilenceNotice);
    fixture.componentRef.setInput('application', APP);
    fixture.componentRef.setInput('silence', silence);
    const giveUp = jest.fn();
    fixture.componentInstance.giveUp.subscribe(giveUp);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = () => el.textContent!.replace(/\s+/g, ' ');
    const button = (label: string) =>
      [...el.querySelectorAll('button')].find((b) =>
        b.textContent!.includes(label),
      );
    return { fixture, el, text, button, giveUp };
  };

  it('aos 14 dias: rascunho de follow-up assinado, sem arquivar', () => {
    const { text, button } = render({ days: 17, stage: 'FOLLOW_UP' });
    expect(text()).toContain('Sem resposta há 17 dias');
    expect(text()).toContain('Candidatura a Junior Backend Developer');
    expect(text()).toContain('Ana Exemplo');
    expect(button('Marcar como sem resposta')).toBeUndefined();
  });

  it('em inglês com um clique', () => {
    const { fixture, text, button } = render({ days: 17, stage: 'FOLLOW_UP' });
    button('EN')!.click();
    fixture.detectChanges();
    expect(text()).toContain('Following up on my application');
  });

  it('aos 30 dias: propõe arquivar, e a decisão é da pessoa', () => {
    const { button, giveUp } = render({ days: 31, stage: 'GIVE_UP' });
    button('Marcar como sem resposta')!.click();
    expect(giveUp).toHaveBeenCalledTimes(1);
  });
});
