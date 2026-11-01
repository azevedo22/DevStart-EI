import { TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { CatalogApiService } from '../../../../core/catalog/catalog-api.service';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { CvReviewModal } from './cv-review-modal';
import { DRAFT, PROFILE } from './cv-review.fixtures';

/** O modal pelo ecrã: o que se vê marcado, editar um valor e importar. */
describe('CvReviewModal', () => {
  const importCv = jest.fn();
  const close = jest.fn();

  const render = async () => {
    importCv.mockReset().mockReturnValue(of(PROFILE));
    close.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: NgbActiveModal, useValue: { close, dismiss: jest.fn() } },
        { provide: ProfileStore, useValue: { importCv } },
        {
          provide: CatalogApiService,
          useValue: { nameOf: (id: string) => id },
        },
      ],
    });
    const fixture = TestBed.createComponent(CvReviewModal);
    fixture.componentInstance.init(DRAFT, PROFILE, []);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      [...el.querySelectorAll('button')].find((b) =>
        b.textContent!.includes(label),
      )!;
    return { fixture, el, button };
  };

  it('mostra o que vai ser substituído e conta só o que está marcado', async () => {
    const { el, button } = await render();
    const text = el.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('No perfil: O meu título');
    expect(text).toContain('já no perfil');
    expect(button('Importar').textContent!.replace(/\s+/g, ' ')).toContain(
      'Importar 4 itens',
    );
  });

  it('importa o valor editado no ecrã e fecha com o número de itens', async () => {
    const { fixture, el, button } = await render();
    const location = el.querySelector('#v-location') as HTMLInputElement;
    location.value = '  Porto ';
    location.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button('Importar').click();

    expect(importCv).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: { location: 'Porto', graduationYear: 2025 },
      }),
    );
    expect(close).toHaveBeenCalledWith(4);
  });

  it('desmarcar uma competência tira-a da contagem', async () => {
    const { fixture, el, button } = await render();
    (el.querySelector('[aria-label="java"]') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(button('Importar').textContent!.replace(/\s+/g, ' ')).toContain(
      'Importar 3 itens',
    );
  });
});
