import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { FireCalculatorService, FireSettings } from '../core/services/fire-calculator.service';
import { PortfolioService, PortfolioAccount, ASSET_CLASSES } from '../core/services/portfolio.service';
import { AppHeaderComponent } from '../shared/components/app-header/app-header.component';
import { AppHeaderAction } from '../shared/components/app-header/app-header.models';

@Component({
  selector: 'vr-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    ProgressBarModule,
    ChartModule,
    TableModule,
    TagModule,
    TooltipModule,
    AppHeaderComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fireSvc = inject(FireCalculatorService);
  private readonly portfolioSvc = inject(PortfolioService);

  fireSettings = signal<FireSettings | null>(null);
  accounts = signal<PortfolioAccount[]>([]);
  loading = signal(true);

  readonly headerActions: AppHeaderAction[] = [
    {
      id: 'logout',
      label: 'Sign Out',
      icon: 'pi pi-sign-out',
      severity: 'secondary',
      outlined: true,
      size: 'small',
    },
  ];

  async ngOnInit(): Promise<void> {
    const [fire, accounts] = await Promise.all([
      firstValueFrom(this.fireSvc.load()),
      firstValueFrom(this.portfolioSvc.getAccounts()),
    ]);
    this.fireSettings.set(fire);
    this.accounts.set(accounts);
    this.loading.set(false);
  }

  onHeaderAction(actionId: string): void {
    if (actionId === 'logout') this.logout();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  // ── Portfolio computeds ───────────────────────────────────────────────────

  get totalPortfolioValue(): number {
    return this.accounts().reduce((sum, a) => sum + a.current_value, 0);
  }

  get fireNumber(): number {
    const s = this.fireSettings();
    if (!s) return 0;
    return s.retirement_spending / (s.withdrawal_rate / 100);
  }

  get fireProgressPercent(): number {
    if (this.fireNumber === 0) return 0;
    const pct = (this.totalPortfolioValue / this.fireNumber) * 100;
    return Math.min(Math.round(pct), 100);
  }

  get allocationChartData(): any {
    const accounts = this.accounts();
    if (accounts.length === 0) return null;

    const totals: Record<string, number> = {};
    for (const a of accounts) {
      totals[a.asset_class] = (totals[a.asset_class] ?? 0) + a.current_value;
    }

    const colors: Record<string, string> = {
      Stocks: '#22c55e',
      Bonds: '#3b82f6',
      Cash: '#94a3b8',
      'Real Estate': '#f59e0b',
      Crypto: '#ef4444',
      Commodities: '#f97316',
      Mixed: '#8b5cf6',
      Other: '#64748b',
    };

    const labels = Object.keys(totals);
    return {
      labels,
      datasets: [{
        data: labels.map(l => totals[l]),
        backgroundColor: labels.map(l => colors[l] ?? '#64748b'),
        borderWidth: 0,
      }],
    };
  }

  get allocationChartOptions(): any {
    return {
      plugins: {
        legend: {
          position: 'right',
          labels: { color: 'var(--p-text-color)', usePointStyle: true, padding: 16 },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const val = ctx.raw as number;
              const pct = this.totalPortfolioValue > 0 ? ((val / this.totalPortfolioValue) * 100).toFixed(1) : '0';
              return ` ${this.formatCurrency(val)}  (${pct}%)`;
            },
          },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
    };
  }

  assetClassSeverity(cls: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      Stocks: 'success', Bonds: 'info', Cash: 'secondary', 'Real Estate': 'warn',
      Crypto: 'danger', Commodities: 'warn', Mixed: 'info', Other: 'secondary',
    };
    return map[cls] ?? 'secondary';
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  }
}
