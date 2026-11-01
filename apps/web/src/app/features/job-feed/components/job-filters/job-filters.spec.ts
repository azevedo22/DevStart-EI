import { TestBed } from '@angular/core/testing';
import { JobFeedQuery } from '@devstart/shared-types';
import { JobFilters } from './job-filters';

describe('JobFilters', () => {
  const render = (query: JobFeedQuery) => {
    const fixture = TestBed.createComponent(JobFilters);
    fixture.componentRef.setInput('query', query);
    const emitted: JobFeedQuery[] = [];
    fixture.componentInstance.queryChange.subscribe((q) => emitted.push(q));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { el, emitted };
  };

  it('resume os locais e o contrato escolhidos nos botões', () => {
    const { el } = render({ remote: true, locations: [18], contracts: [1] });
    const text = el.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Remoto ou Porto');
    expect(text).toContain('Limpar filtros');
  });

  it('marcar um local junta-o aos que já estavam, sem perder os outros filtros', () => {
    const { el, emitted } = render({ locations: [18], stackId: 'x' });
    (el.querySelector('#loc-14') as HTMLInputElement).click();
    expect(emitted).toEqual([{ locations: [18, 14], stackId: 'x' }]);
  });

  it('desmarcar tira-o; "Limpar filtros" devolve a query vazia', () => {
    const { el, emitted } = render({ locations: [18, 14] });
    (el.querySelector('#loc-18') as HTMLInputElement).click();
    [...el.querySelectorAll('button')]
      .find((b) => b.textContent!.includes('Limpar filtros'))!
      .click();
    expect(emitted).toEqual([{ locations: [14] }, {}]);
  });

  it('sem filtros não mostra "Limpar filtros"', () => {
    const { el } = render({});
    expect(el.textContent).not.toContain('Limpar filtros');
    expect(el.textContent).toContain('Todo o país');
  });
});
