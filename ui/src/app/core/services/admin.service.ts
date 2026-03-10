import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AdminSettings {
  registration_enabled: boolean;
  max_users: number;
  user_count: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  async getSettings(): Promise<AdminSettings> {
    return firstValueFrom(this.http.get<AdminSettings>('/api/v1/admin/settings'));
  }

  async updateSettings(patch: Partial<Pick<AdminSettings, 'registration_enabled' | 'max_users'>>): Promise<void> {
    await firstValueFrom(this.http.patch('/api/v1/admin/settings', patch));
  }
}
