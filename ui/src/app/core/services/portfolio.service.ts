import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface PortfolioAccount {
  id: string;
  name: string;
  account_type: string;
  asset_class: string;
  current_value: number;
  annual_return_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioAccountHistory {
  id: number;
  value: number;
  note: string | null;
  recorded_at: string;
}

export interface CreateAccountRequest {
  name: string;
  account_type: string;
  asset_class: string;
  current_value: number;
  annual_return_rate: number | null;
  note: string | null;
}

export interface UpdateAccountRequest extends CreateAccountRequest {}

export const ACCOUNT_TYPES = ['401k', 'IRA', 'Roth IRA', 'Brokerage', 'Savings', 'HSA', 'Other'] as const;
export const ASSET_CLASSES = ['Stocks', 'Bonds', 'Cash', 'Real Estate', 'Crypto', 'Commodities', 'Mixed', 'Other'] as const;

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private readonly http = inject(HttpClient);

  getAccounts(): Observable<PortfolioAccount[]> {
    return this.http
      .get<PortfolioAccount[]>('/api/v1/portfolio/accounts')
      .pipe(catchError(() => of([])));
  }

  createAccount(req: CreateAccountRequest): Observable<PortfolioAccount | null> {
    return this.http
      .post<PortfolioAccount>('/api/v1/portfolio/accounts', req)
      .pipe(catchError(() => of(null)));
  }

  updateAccount(id: string, req: UpdateAccountRequest): Observable<PortfolioAccount | null> {
    return this.http
      .put<PortfolioAccount>(`/api/v1/portfolio/accounts/${id}`, req)
      .pipe(catchError(() => of(null)));
  }

  deleteAccount(id: string): Observable<boolean> {
    return this.http
      .delete(`/api/v1/portfolio/accounts/${id}`)
      .pipe(
        map(() => true),
        catchError(() => of(false)),
      );
  }

  getAccountHistory(id: string): Observable<PortfolioAccountHistory[]> {
    return this.http
      .get<PortfolioAccountHistory[]>(`/api/v1/portfolio/accounts/${id}/history`)
      .pipe(catchError(() => of([])));
  }
}
