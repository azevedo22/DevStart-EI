import { Component, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { map, startWith, switchMap } from 'rxjs';

/**
 * Mensagem de erro de um campo de formulário, só depois de o utilizador lhe tocar.
 * Centraliza os textos para todos os formulários falarem da mesma maneira.
 *
 * Reage a `control.events` (valor, estado e "touched"): sem isto, um componente
 * OnPush não saberia que o campo mudou, porque a referência do controlo é sempre a mesma.
 */
@Component({
  selector: 'ds-field-error',
  template: `
    @if (message(); as m) {
      <div class="invalid-feedback d-block">{{ m }}</div>
    }
  `,
})
export class FieldError {
  readonly control = input.required<AbstractControl>();
  /** Textos específicos do campo, por chave de erro (ex.: { pattern: '...' }). */
  readonly messages = input<Record<string, string>>({});

  protected readonly message = toSignal(
    toObservable(this.control).pipe(
      switchMap((c) =>
        c.events.pipe(
          startWith(null),
          map(() => this.describe(c)),
        ),
      ),
    ),
    { initialValue: null },
  );

  private describe(c: AbstractControl): string | null {
    if (!c.errors || !(c.touched || c.dirty)) return null;
    const key = Object.keys(c.errors)[0];
    const custom = this.messages()[key];
    if (custom) return custom;
    switch (key) {
      case 'required':
        return 'Campo obrigatório.';
      case 'email':
        return 'Email inválido.';
      case 'minlength':
        return `Mínimo de ${c.errors['minlength'].requiredLength} caracteres.`;
      case 'maxlength':
        return `Máximo de ${c.errors['maxlength'].requiredLength} caracteres.`;
      case 'server':
        return c.errors['server'];
      default:
        return 'Valor inválido.';
    }
  }
}
