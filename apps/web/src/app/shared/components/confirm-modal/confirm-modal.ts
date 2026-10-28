import { Component, inject } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

/** Modal de confirmação genérico, para ações que não se podem desfazer. */
@Component({
  selector: 'ds-confirm-modal',
  template: `
    <div class="modal-header">
      <h2 class="modal-title h5">{{ options.title }}</h2>
      <button
        type="button"
        class="btn-close"
        aria-label="Fechar"
        (click)="modal.dismiss()"
      ></button>
    </div>
    <div class="modal-body">
      <p class="mb-0">{{ options.message }}</p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-light" (click)="modal.dismiss()">
        Cancelar
      </button>
      <button
        type="button"
        class="btn"
        [class.btn-danger]="options.danger"
        [class.btn-primary]="!options.danger"
        (click)="modal.close(true)"
      >
        {{ options.confirmLabel ?? 'Confirmar' }}
      </button>
    </div>
  `,
})
export class ConfirmModal {
  protected readonly modal = inject(NgbActiveModal);
  options!: ConfirmOptions;
}

/** Abre o modal e resolve com true se o utilizador confirmar. */
export function confirmAction(
  modalService: NgbModal,
  options: ConfirmOptions,
): Promise<boolean> {
  const ref = modalService.open(ConfirmModal, { centered: true });
  ref.componentInstance.options = options;
  return ref.result.then(
    () => true,
    () => false,
  );
}
