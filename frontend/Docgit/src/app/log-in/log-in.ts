import { Component, output, signal, computed, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { DocApiService } from '../services/doc-api.service';

@Component({
  selector: 'app-log-in',
  imports: [],
  templateUrl: './log-in.html',
  styleUrl: './log-in.css',
})
export class LogIn {
  private readonly api = inject(DocApiService);

  loginSuccess = output<{ name: string; email: string }>();

  mode = signal<'signin' | 'signup'>('signin');

  userName = signal('');
  email = signal('');
  password = signal('');
  name = signal('');
  confirmPassword = signal('');
  showPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal('');

  emailValid = computed(() => {
    const e = this.email();
    if (!e) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  });

  passwordStrength = computed(() => {
    const p = this.password();
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  });

  strengthLabel = computed(() => {
    const s = this.passwordStrength();
    if (s === 0) return '';
    if (s === 1) return 'Weak';
    if (s === 2) return 'Fair';
    if (s === 3) return 'Good';
    return 'Strong';
  });

  strengthColor = computed(() => {
    const s = this.passwordStrength();
    if (s <= 1) return 'var(--color-danger)';
    if (s === 2) return 'var(--color-warning)';
    if (s === 3) return '#4285f4';
    return 'var(--color-success)';
  });

  canSubmitSignIn = computed(
    () => this.userName().trim() !== '' && this.password().trim() !== '',
  );

  canSubmitSignUp = computed(
    () =>
      this.userName().trim() !== '' &&
      this.name().trim() !== '' &&
      this.email().trim() !== '' &&
      this.password().length >= 8 &&
      this.password() === this.confirmPassword() &&
      this.emailValid(),
  );

  switchMode(mode: 'signin' | 'signup'): void {
    this.mode.set(mode);
    this.errorMessage.set('');
  }

  onUserNameInput(event: Event): void {
    this.userName.set((event.target as HTMLInputElement).value);
    this.errorMessage.set('');
  }

  onEmailInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
    this.errorMessage.set('');
  }

  onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
    this.errorMessage.set('');
  }

  onNameInput(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  onConfirmPasswordInput(event: Event): void {
    this.confirmPassword.set((event.target as HTMLInputElement).value);
  }

  toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  onSubmit(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    if (this.mode() === 'signup') {
      this.api
        .register({
          userName: this.userName().trim(),
          password: this.password(),
          email: this.email().trim(),
          name: this.name().trim(),
        })
        .pipe(finalize(() => this.isLoading.set(false)))
        .subscribe({
          next: () => {
            this.switchMode('signin');
            this.errorMessage.set('');
          },
          error: (err: HttpErrorResponse) => {
            this.errorMessage.set(this.readApiError(err) ?? 'Registration failed.');
          },
        });
      return;
    }

    this.api
      .login(this.userName().trim(), this.password())
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (token) => {
          this.api.setAuthToken(token);
          const u = this.userName().trim();
          const displayName = u;
          const mail = this.email().trim() || `${u}@local`;
          this.api.setStoredProfile(displayName, mail);
          this.loginSuccess.emit({ name: displayName, email: mail });
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(this.readApiError(err) ?? 'Invalid username or password.');
        },
      });
  }

  private readApiError(err: HttpErrorResponse): string | null {
    const body = err.error;
    if (body && typeof body === 'object') {
      if ('message' in body && typeof (body as { message: unknown }).message === 'string') {
        return (body as { message: string }).message;
      }
    }
    return null;
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      if (this.mode() === 'signin' && this.canSubmitSignIn()) {
        this.onSubmit();
      } else if (this.mode() === 'signup' && this.canSubmitSignUp()) {
        this.onSubmit();
      }
    }
  }
}
