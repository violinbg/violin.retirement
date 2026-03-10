import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SliderModule } from 'primeng/slider';
import { InputNumberModule } from 'primeng/inputnumber';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { ChartModule } from 'primeng/chart';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { FireCalculatorService } from '../core/services/fire-calculator.service';
import { AppHeaderComponent } from '../shared/components/app-header/app-header.component';
import { AppHeaderAction } from '../shared/components/app-header/app-header.models';

const DEFAULTS = {
  currentAge: 30,
  currentPortfolio: 50_000,
  annualIncome: 80_000,
  annualExpenses: 50_000,
  expectedReturn: 7,
  withdrawalRate: 4,
  retirementSpending: 50_000,
};

const headerLeftAction = {
  id: 'back',
  label: 'Back',
  icon: 'pi pi-arrow-left',
  severity: 'secondary',
  outlined: true,
  size: 'small',
  tooltip: 'Back',
} as AppHeaderAction;

@Component({
  selector: 'vr-fire-calculator',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    SliderModule,
    InputNumberModule,
    CardModule,
    DividerModule,
    ChartModule,
    TooltipModule,
    ToastModule,
    AppHeaderComponent,
  ],
  providers: [MessageService],
  templateUrl: './fire-calculator.component.html',
  styleUrl: './fire-calculator.component.scss',
})
export class FireCalculatorComponent implements OnInit {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly fireService = inject(FireCalculatorService);
  private readonly messageService = inject(MessageService);
  readonly headerLeftAction = headerLeftAction;

  // ── Inputs ──────────────────────────────────────────────────────────────
  currentAge = signal(DEFAULTS.currentAge);
  currentPortfolio = signal(DEFAULTS.currentPortfolio);
  annualIncome = signal(DEFAULTS.annualIncome);
  annualExpenses = signal(DEFAULTS.annualExpenses);
  expectedReturn = signal(DEFAULTS.expectedReturn);
  withdrawalRate = signal(DEFAULTS.withdrawalRate);
  retirementSpending = signal(DEFAULTS.retirementSpending);

  isSaving = signal(false);

  // ── Derived results ──────────────────────────────────────────────────────
  readonly savingsRate = computed(() => {
    const income = this.annualIncome();
    if (income <= 0) return 0;
    const savings = income - this.annualExpenses();
    return Math.max(0, Math.min(100, (savings / income) * 100));
  });

  readonly annualSavings = computed(() =>
    Math.max(0, this.annualIncome() - this.annualExpenses())
  );

  readonly fireNumber = computed(() => {
    const swr = this.withdrawalRate();
    if (swr <= 0) return 0;
    return this.retirementSpending() / (swr / 100);
  });

  readonly yearsToFire = computed(() => {
    const target = this.fireNumber();
    const portfolio = this.currentPortfolio();
    const savings = this.annualSavings();
    const r = this.expectedReturn() / 100;

    if (portfolio >= target) return 0;
    if (r === 0) {
      return savings > 0 ? (target - portfolio) / savings : Infinity;
    }

    // FV of lump sum + FV of annuity = target
    // P*(1+r)^n + savings*((1+r)^n - 1)/r = target
    // Solve numerically — iterate up to 100 years
    let pv = portfolio;
    for (let n = 0; n <= 100; n++) {
      if (pv >= target) return n;
      pv = pv * (1 + r) + savings;
    }
    return Infinity;
  });

  readonly fiAge = computed(() => {
    const yrs = this.yearsToFire();
    return isFinite(yrs) ? Math.round(this.currentAge() + yrs) : null;
  });

  readonly fiYear = computed(() => {
    const yrs = this.yearsToFire();
    return isFinite(yrs)
      ? new Date().getFullYear() + Math.round(yrs)
      : null;
  });

  // ── Chart data ───────────────────────────────────────────────────────────
  chartData: any = null;
  chartOptions: any = null;

  get headerActions(): AppHeaderAction[] {
    if (!this.auth.isLoggedIn()) return [];

    return [
      {
        id: 'defaults',
        label: 'Defaults',
        icon: 'pi pi-refresh',
        severity: 'secondary',
        outlined: true,
        size: 'small',
        tooltip: 'Reset to default values',
      } as AppHeaderAction,
      {
        id: 'save',
        label: 'Save',
        icon: 'pi pi-save',
        size: 'small',
        loading: this.isSaving(),
        tooltip: 'Save your settings',
      } as AppHeaderAction,
    ];
  }

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      firstValueFrom(this.fireService.load()).then(s => {
        if (s) {
          this.currentAge.set(s.current_age);
          this.currentPortfolio.set(s.current_portfolio);
          this.annualIncome.set(s.annual_income);
          this.annualExpenses.set(s.annual_expenses);
          this.expectedReturn.set(s.expected_return);
          this.withdrawalRate.set(s.withdrawal_rate);
          this.retirementSpending.set(s.retirement_spending);
        }
        this.buildChart();
      });
    } else {
      this.buildChart();
    }
  }

  recalculate(): void {
    this.buildChart();
  }

  private buildChart(): void {
    const portfolio = this.currentPortfolio();
    const savings = this.annualSavings();
    const r = this.expectedReturn() / 100;
    const target = this.fireNumber();
    const age0 = this.currentAge();
    const years = isFinite(this.yearsToFire()) ? Math.ceil(this.yearsToFire()) + 5 : 40;
    const displayYears = Math.min(years, 50);

    const labels: string[] = [];
    const portfolioValues: number[] = [];
    const fireTargetValues: number[] = [];

    let pv = portfolio;
    for (let n = 0; n <= displayYears; n++) {
      labels.push(`Age ${age0 + n}`);
      portfolioValues.push(Math.round(pv));
      fireTargetValues.push(Math.round(target));
      pv = pv * (1 + r) + savings;
    }

    const docStyle = getComputedStyle(document.documentElement);
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const textColor = isDarkMode 
      ? '#e2e8f0'  // Light gray for dark mode
      : docStyle.getPropertyValue('--p-text-color').trim() || '#666';
    const gridColor = docStyle.getPropertyValue('--p-content-border-color').trim() || '#e0e0e0';
    const primaryColor = docStyle.getPropertyValue('--p-primary-color').trim() || '#000';
    const successColor = docStyle.getPropertyValue('--p-green-500').trim() || '#22c55e';

    this.chartData = {
      labels,
      datasets: [
        {
          label: 'Portfolio Value',
          data: portfolioValues,
          fill: true,
          backgroundColor: primaryColor + '22',
          borderColor: primaryColor,
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'FIRE Target',
          data: fireTargetValues,
          fill: false,
          borderColor: successColor,
          borderWidth: 2,
          borderDash: [8, 4],
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 0,
        },
      ],
    };

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: textColor },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) =>
              ` ${ctx.dataset.label}: ${this.formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: textColor,
            maxTicksLimit: 10,
          },
          grid: { color: gridColor },
        },
        y: {
          ticks: {
            color: textColor,
            callback: (value: number) => this.formatCurrencyShort(value),
          },
          grid: { color: gridColor },
        },
      },
    };
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  formatCurrencyShort(value: number): string {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value}`;
  }

  goBack(): void {
    this.router.navigate([this.auth.isLoggedIn() ? '/dashboard' : '/']);
  }

  async saveSettings(): Promise<void> {
    this.isSaving.set(true);
    const ok = await firstValueFrom(this.fireService.save({
      current_age: this.currentAge(),
      current_portfolio: this.currentPortfolio(),
      annual_income: this.annualIncome(),
      annual_expenses: this.annualExpenses(),
      expected_return: this.expectedReturn(),
      withdrawal_rate: this.withdrawalRate(),
      retirement_spending: this.retirementSpending(),
    }));
    this.isSaving.set(false);
    if (ok) {
      this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Your FIRE settings have been saved.' });
    } else {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not save settings. Please try again.' });
    }
  }

  resetToDefaults(): void {
    this.currentAge.set(DEFAULTS.currentAge);
    this.currentPortfolio.set(DEFAULTS.currentPortfolio);
    this.annualIncome.set(DEFAULTS.annualIncome);
    this.annualExpenses.set(DEFAULTS.annualExpenses);
    this.expectedReturn.set(DEFAULTS.expectedReturn);
    this.withdrawalRate.set(DEFAULTS.withdrawalRate);
    this.retirementSpending.set(DEFAULTS.retirementSpending);
    this.buildChart();
    this.messageService.add({ severity: 'info', summary: 'Reset', detail: 'Calculator reset to defaults.' });
  }

  onHeaderAction(actionId: string): void {
    switch (actionId) {
      case 'back':
        this.goBack();
        break;
      case 'defaults':
        this.resetToDefaults();
        break;
      case 'save':
        void this.saveSettings();
        break;
    }
  }

  isFinite(n: number): boolean {
    return Number.isFinite(n);
  }
}
