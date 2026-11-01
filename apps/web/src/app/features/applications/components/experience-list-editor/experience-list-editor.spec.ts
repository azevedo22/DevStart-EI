import { TestBed } from '@angular/core/testing';
import { ExperienceListEditor } from './experience-list-editor';

describe('ExperienceListEditor', () => {
  const render = (items: string[]) => {
    const fixture = TestBed.createComponent(ExperienceListEditor);
    fixture.componentRef.setInput('items', items);
    const emitted: string[][] = [];
    fixture.componentInstance.itemsChange.subscribe((v) => emitted.push(v));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('#experienceInput') as HTMLInputElement;
    const type = (text: string) => {
      input.value = text;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    };
    return { el, input, emitted, type };
  };

  it('Enter acrescenta a frase (espaços arrumados) e limpa o campo', () => {
    const { input, emitted, type } = render(['Scrum']);
    type('  1 ano   com APIs REST ');
    expect(emitted).toEqual([['Scrum', '1 ano com APIs REST']]);
    expect(input.value).toBe('');
  });

  it('não repete nem acrescenta vazio', () => {
    const { emitted, type } = render(['Scrum']);
    type('scrum');
    type('   ');
    expect(emitted).toEqual([['Scrum']]);
  });

  it('remover tira só essa', () => {
    const { el, emitted } = render(['Scrum', 'Git']);
    (el.querySelector('[aria-label="Remover Scrum"]') as HTMLElement).click();
    expect(emitted).toEqual([['Git']]);
  });
});
