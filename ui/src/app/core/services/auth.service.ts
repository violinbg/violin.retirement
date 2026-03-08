import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface CurrentUser {
  id: string;
  username: string;
  full_name: string;
  role: string;
}

const TOKEN_KEY = 'vr_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly isInitialized = signal(false);
  readonly isLoggedIn = signal(false);
  readonly currentUser = signal<CurrentUser | null>(null);

  /** Called once at app boot via APP_INITIALIZER. */
  async init(): Promise<void> {
    const status = await firstValueFrom(
      this.http.get<{ initialized: boolean }>('/api/v1/setup/status')
    ).catch(() => ({ initialized: false }));

    this.isInitialized.set(status.initialized);

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const user = await firstValueFrom(
      this.http.get<CurrentUser>('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
    ).catch(() => null);

    if (user) {
      this.isLoggedIn.set(true);
      this.currentUser.set(user);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  async login(username: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{ token: string; user: CurrentUser }>('/api/v1/auth/login', {
        username,
        password
      })
    );
    localStorage.setItem(TOKEN_KEY, res.token);
    this.isLoggedIn.set(true);
    this.currentUser.set(res.user);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.isLoggedIn.set(false);
    this.currentUser.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }
}
