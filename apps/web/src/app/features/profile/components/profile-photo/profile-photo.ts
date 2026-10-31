import { Component, computed, inject, signal } from '@angular/core';
import { finalize, from, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { ApiError } from '../../../../core/http/error.interceptor';
import {
  PhotoError,
  preparePhoto,
} from '../../../../core/profile/prepare-photo';
import { ProfileStore } from '../../../../core/profile/profile-store';
import { initialsOf } from '../../../../shared/ui/display';

/** Foto de perfil, com carregar, trocar e remover. Sem foto, as iniciais. */
@Component({
  selector: 'ds-profile-photo',
  template: `
    <input
      #fileInput
      type="file"
      class="d-none"
      accept="image/jpeg,image/png,image/webp"
      (change)="onFile($event)"
    />
    <div class="d-flex flex-column align-items-center gap-1">
      <button
        type="button"
        class="photo rounded-circle p-0 border-0 position-relative"
        [disabled]="busy()"
        [attr.aria-label]="
          store.photoUrl()
            ? 'Mudar a foto de perfil'
            : 'Carregar uma foto de perfil'
        "
        [title]="store.photoUrl() ? 'Mudar a foto' : 'Carregar uma foto'"
        (click)="fileInput.click()"
      >
        @if (store.photoUrl(); as url) {
          <img [src]="url" alt="Foto de perfil" class="rounded-circle" />
        } @else {
          <span
            class="initials rounded-circle bg-primary-subtle text-primary fw-semibold"
            >{{ initials() }}</span
          >
        }
        <span
          class="camera rounded-circle bg-body shadow-sm"
          aria-hidden="true"
        >
          @if (busy()) {
            <span class="spinner-border spinner-border-sm"></span>
          } @else {
            <i class="bi bi-camera"></i>
          }
        </span>
      </button>
      @if (store.photoUrl() && !busy()) {
        <button
          type="button"
          class="btn btn-link btn-sm p-0 small text-body-secondary"
          aria-label="Remover a foto de perfil"
          (click)="remove()"
        >
          Remover
        </button>
      }
    </div>
    @if (error(); as e) {
      <div class="small text-danger mt-1 text-center err" role="alert">
        {{ e }}
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .photo {
      width: 6rem;
      height: 6rem;
      background: none;
      cursor: pointer;
    }
    .photo img,
    .initials {
      width: 6rem;
      height: 6rem;
      object-fit: cover;
      display: grid;
      place-items: center;
      font-size: 2rem;
    }
    .camera {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 2rem;
      height: 2rem;
      display: grid;
      place-items: center;
      border: 1px solid var(--bs-border-color);
    }
    .photo:hover .camera,
    .photo:focus-visible .camera {
      background: var(--bs-primary) !important;
      color: #fff;
    }
    .err {
      max-width: 10rem;
    }
  `,
})
export class ProfilePhoto {
  protected readonly store = inject(ProfileStore);
  private readonly auth = inject(AuthService);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly initials = computed(() =>
    initialsOf(this.auth.user()?.fullName),
  );

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // escolher o mesmo ficheiro outra vez volta a disparar
    if (!file) return;
    this.error.set(null);
    this.busy.set(true);
    from(preparePhoto(file))
      .pipe(
        switchMap((photo) => this.store.uploadPhoto(photo)),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        error: (e: PhotoError | ApiError) =>
          this.error.set(e.message || 'Não foi possível guardar a foto.'),
      });
  }

  remove(): void {
    this.error.set(null);
    this.busy.set(true);
    this.store
      .removePhoto()
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({ error: (e: ApiError) => this.error.set(e.message) });
  }
}
