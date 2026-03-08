import { Component, EventEmitter, inject, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'vr-login-dialog',
  standalone: true,
  imports: [FormsModule, DialogModule, InputTextModule, PasswordModule, ButtonModule, MessageModule],
  templateUrl: './login-dialog.component.html',
  styleUrl: './login-dialog.component.scss'
})
export class LoginDialogComponent {
  private readonly auth = inject(AuthService);

  @Output() closed = new EventEmitter<void>();

  visible = true;
  username = '';
  password = '';
  loading = signal(false);
  error = signal('');

  async submit(): Promise<void> {
    if (!this.username || !this.password) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.username, this.password);
      this.close();
    } catch {
      this.error.set('Invalid username or password.');
    } finally {
      this.loading.set(false);
    }
  }

  close(): void {
    this.visible = false;
    this.closed.emit();
  }
}
