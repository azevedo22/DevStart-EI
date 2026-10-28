import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { FieldError } from './field-error';

@Component({
  imports: [ReactiveFormsModule, FieldError],
  template: `<input [formControl]="email" /><ds-field-error
      [control]="email"
    />`,
})
class Host {
  email = new FormControl('', [Validators.required, Validators.email]);
}

describe('FieldError', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const text = async () => {
      await fixture.whenStable();
      return (
        fixture.nativeElement
          .querySelector('.invalid-feedback')
          ?.textContent?.trim() ?? null
      );
    };
    return { host: fixture.componentInstance, text };
  }

  it('não mostra erros antes de o utilizador tocar no campo', async () => {
    const { text } = await render();
    expect(await text()).toBeNull();
  });

  it('mostra o erro quando o formulário é submetido (markAsTouched)', async () => {
    const { host, text } = await render();
    host.email.markAsTouched();
    expect(await text()).toBe('Campo obrigatório.');
  });

  it('atualiza a mensagem à medida que o valor muda', async () => {
    const { host, text } = await render();
    host.email.markAsTouched();
    host.email.setValue('nao-e-email');
    expect(await text()).toBe('Email inválido.');
    host.email.setValue('ana@example.com');
    expect(await text()).toBeNull();
  });

  it('mostra erros vindos do servidor', async () => {
    const { host, text } = await render();
    host.email.setValue('ana@example.com');
    host.email.markAsDirty();
    host.email.setErrors({ server: 'Já existe uma conta com este email.' });
    expect(await text()).toBe('Já existe uma conta com este email.');
  });
});
