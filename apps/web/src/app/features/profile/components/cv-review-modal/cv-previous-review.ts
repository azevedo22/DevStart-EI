import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CvReview } from './cv-review';

/**
 * O que veio do CV anterior: com a substituição ligada (por omissão), sai do
 * perfil e dá lugar ao CV novo. A pessoa vê exatamente o quê antes de importar.
 */
@Component({
  selector: 'ds-cv-previous-review',
  imports: [FormsModule],
  template: `
    @let r = review();
    <section class="border rounded-3 p-3 bg-body-tertiary small">
      <div class="form-check form-switch mb-1">
        <input
          id="replacePrevious"
          class="form-check-input"
          type="checkbox"
          role="switch"
          [ngModel]="r.replacePrevious"
          (ngModelChange)="r.replacePrevious = $event"
        />
        <label for="replacePrevious" class="form-check-label fw-medium"
          >Substituir o que veio do CV anterior</label
        >
      </div>
      <p class="mb-2 text-body-secondary">
        @if (r.replacePrevious) {
          Isto sai do perfil e dá lugar ao que escolheres abaixo:
        } @else {
          Fica tudo como está. O que for igual ao que já tens não se repete.
        }
      </p>
      <ul
        class="mb-2 ps-3"
        [class.text-decoration-line-through]="r.replacePrevious"
      >
        @for (e of r.previous.education; track e.id) {
          <li>Formação: {{ e.degree }} · {{ e.institution }}</li>
        }
        @for (e of r.previous.experience; track e.id) {
          <li>Experiência: {{ e.role }} · {{ e.organization }}</li>
        }
        @for (p of r.previous.projects; track p.id) {
          <li>Projeto: {{ p.title }}</li>
        }
      </ul>
      <p class="mb-0 text-body-secondary">
        <i class="bi bi-shield-check me-1"></i>O que criaste ou editaste à mão
        nunca é substituído.
      </p>
    </section>
  `,
})
export class CvPreviousReview {
  readonly review = input.required<CvReview>();
}
