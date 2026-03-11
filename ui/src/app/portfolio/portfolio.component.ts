import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { PortfolioService, PortfolioAccount } from '../core/services/portfolio.service';
import { AuthService } from '../core/services/auth.service';
import { AppHeaderComponent } from '../shared/components/app-header/app-header.component';
import { AppHeaderAction } from '../shared/components/app-header/app-header.models';
import { AccountDialogComponent } from './account-dialog/account-dialog.component';
import { AccountHistoryDialogComponent } from './account-history-dialog/account-history-dialog.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'vr-portfolio',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    TableModule,
    ButtonModule,
    ToastModule,
    TagModule,
    TooltipModule,
    ConfirmDialogModule,
    AppHeaderComponent,
    AccountDialogComponent,
    AccountHistoryDialogComponent,
    TranslatePipe,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.scss',
})
export class PortfolioComponent implements OnInit {
  private readonly portfolioSvc = inject(PortfolioService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);

  accounts = signal<PortfolioAccount[]>([]);
  loading = signal(true);

  showAccountDialog = signal(false);
  editingAccount = signal<PortfolioAccount | null>(null);

  showHistoryDialog = signal(false);
  historyAccount = signal<PortfolioAccount | null>(null);

  readonly headerLeftAction: AppHeaderAction = {
    id: 'back',
    labelKey: 'HEADER.BACK',
    icon: 'pi pi-arrow-left',
    severity: 'secondary',
    outlined: true,
    size: 'small',
  };

  readonly headerActions: AppHeaderAction[] = [
    {
      id: 'logout',
      labelKey: 'HEADER.SIGN_OUT',
      icon: 'pi pi-sign-out',
      severity: 'secondary',
      outlined: true,
      size: 'small',
    },
  ];

  async ngOnInit(): Promise<void> {
    await this.loadAccounts();
  }

  async loadAccounts(): Promise<void> {
    this.loading.set(true);
    const accounts = await firstValueFrom(this.portfolioSvc.getAccounts());
    this.accounts.set(accounts);
    this.loading.set(false);
  }

  onHeaderAction(actionId: string): void {
    if (actionId === 'back') this.router.navigate(['/dashboard']);
    if (actionId === 'logout') {
      this.auth.logout();
      this.router.navigate(['/']);
    }
  }

  get totalValue(): number {
    return this.accounts().reduce((sum, a) => sum + a.current_value, 0);
  }

  openAddDialog(): void {
    this.editingAccount.set(null);
    this.showAccountDialog.set(true);
  }

  openEditDialog(account: PortfolioAccount): void {
    this.editingAccount.set(account);
    this.showAccountDialog.set(true);
  }

  openHistory(account: PortfolioAccount): void {
    this.historyAccount.set(account);
    this.showHistoryDialog.set(true);
  }

  deleteAccount(account: PortfolioAccount): void {
    this.confirmationService.confirm({
      header: this.translate.instant('PORTFOLIO.CONFIRM_DELETE_HEADER'),
      message: this.translate.instant('PORTFOLIO.CONFIRM_DELETE_MESSAGE', { name: account.name }),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('PORTFOLIO.CONFIRM_DELETE_ACCEPT'),
      rejectLabel: this.translate.instant('PORTFOLIO.CONFIRM_DELETE_REJECT'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary p-button-outlined',
      accept: async () => {
        const ok = await firstValueFrom(this.portfolioSvc.deleteAccount(account.id));
        if (ok) {
          await this.loadAccounts();
        }
      },
    });
  }

  assetClassSeverity(cls: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      Stocks: 'success',
      Bonds: 'info',
      Cash: 'secondary',
      'Real Estate': 'warn',
      Crypto: 'danger',
      Commodities: 'warn',
      Mixed: 'info',
      Other: 'secondary',
    };
    return map[cls] ?? 'secondary';
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
