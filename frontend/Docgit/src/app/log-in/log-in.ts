import { Component, output, signal, computed } from '@angular/core';

@Component({
  selector: 'app-log-in',
  imports: [],
  templateUrl: './log-in.html',
  styleUrl: './log-in.css',
})
export class LogIn {
  loginSuccess = output<{ name: string; email: string }>();

  mode = signal<'signin' | 'signup' | 'forgot'>('signin');

  email = signal('');
  password = signal('');
  name = signal('');
  confirmPassword = signal('');
  rememberMe = signal(false);
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

  canSubmitSignIn = computed(() =>
    this.email().trim() !== '' && this.password().trim() !== '' && this.emailValid()
  );

  canSubmitSignUp = computed(() =>
    this.name().trim() !== '' &&
    this.email().trim() !== '' &&
    this.password().length >= 8 &&
    this.password() === this.confirmPassword() &&
    this.emailValid()
  );

  switchMode(mode: 'signin' | 'signup' | 'forgot'): void {
    this.mode.set(mode);
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

  toggleRememberMe(): void {
    this.rememberMe.update(v => !v);
  }

  toggleShowPassword(): void {
    this.showPassword.update(v => !v);
  }

  onSubmit(): void {
    if (this.mode() === 'forgot') {
      this.handleForgotPassword();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    setTimeout(() => {
      this.isLoading.set(false);

      const displayName = this.mode() === 'signup'
        ? this.name()
        : this.email().split('@')[0];

      this.loginSuccess.emit({
        name: displayName,
        email: this.email()
      });
    }, 800);
  }

  onSocialLogin(provider: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    setTimeout(() => {
      this.isLoading.set(false);
      this.loginSuccess.emit({
        name: provider === 'github' ? 'GitHub User' : 'Google User',
        email: `user@${provider}.com`
      });
    }, 800);
  }

  private handleForgotPassword(): void {
    if (!this.email().trim() || !this.emailValid()) {
      this.errorMessage.set('Please enter a valid email address.');
      return;
    }
    this.isLoading.set(true);
    setTimeout(() => {
      this.isLoading.set(false);
      this.errorMessage.set('');
      this.switchMode('signin');
    }, 1000);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      if (this.mode() === 'signin' && this.canSubmitSignIn()) {
        this.onSubmit();
      } else if (this.mode() === 'signup' && this.canSubmitSignUp()) {
        this.onSubmit();
      } else if (this.mode() === 'forgot') {
        this.onSubmit();
      }
    }
  }
}
