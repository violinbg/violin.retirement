import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: string;
  active: boolean;
  created_at: string;
  last_login: string | null;
}

export interface CreateUserRequest {
  username: string;
  full_name: string;
  password: string;
  role: 'admin' | 'user';
}

export interface UpdateUserRequest {
  full_name?: string;
  role?: 'admin' | 'user';
  password?: string;
}

export interface UserStatusRequest {
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private get headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.getToken() ?? ''}` });
  }

  async listUsers(): Promise<User[]> {
    const res = await firstValueFrom(
      this.http.get<{ users: User[] }>('/api/v1/users', { headers: this.headers })
    );
    return res.users;
  }

  async createUser(req: CreateUserRequest): Promise<User> {
    const res = await firstValueFrom(
      this.http.post<User>('/api/v1/users', req, { headers: this.headers })
    );
    return res;
  }

  async updateUser(id: string, req: UpdateUserRequest): Promise<User> {
    const res = await firstValueFrom(
      this.http.put<User>(`/api/v1/users/${id}`, req, { headers: this.headers })
    );
    return res;
  }

  async deleteUser(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`/api/v1/users/${id}`, { headers: this.headers })
    );
  }

  async toggleUserStatus(id: string, active: boolean): Promise<User> {
    const res = await firstValueFrom(
      this.http.patch<User>(`/api/v1/users/${id}/status`, { active }, { headers: this.headers })
    );
    return res;
  }
}
