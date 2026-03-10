import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface FireSettings {
  current_age: number;
  current_portfolio: number;
  annual_income: number;
  annual_expenses: number;
  expected_return: number;
  withdrawal_rate: number;
  retirement_spending: number;
}

@Injectable({ providedIn: 'root' })
export class FireCalculatorService {
  private readonly http = inject(HttpClient);

  load(): Observable<FireSettings | null> {
    return this.http
      .get<FireSettings>('/api/v1/calculator/fire')
      .pipe(catchError(() => of(null)));
  }

  save(settings: FireSettings): Observable<boolean> {
    return this.http
      .put<{ message: string }>('/api/v1/calculator/fire', settings)
      .pipe(
        map(() => true),
        catchError(() => of(false)),
      );
  }
}
