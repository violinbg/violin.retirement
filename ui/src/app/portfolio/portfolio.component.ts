import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import {
  PortfolioService,
  PortfolioAccount,
  PortfolioAccountHistory,
  ACCOUNT_TYPES,
  ASSET_CLASSES,
} from '../core/services/portfolio.service';
import { AuthService } from '../core/services/auth.service';
import { AppHeaderComponent } from '../shared/components/app-header/app-header.component';
import { AppHeaderAction } from '../shared/components/app-header/app-header.models';

@Component({
  selector: 'vr-portfolio',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    TextareaModule,
    ToastModule,
    TagModule,
    TooltipModule,
    AppHeaderComponent,
  ],
  providers: [MessageService],
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.scss',
})
export class PortfolioComponent implements OnInit {
  private readonly portfolioSvc = inject(PortfolioService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  accounts = signal<PortfolioAccount[]>([]);
  loading = signal(true);

  showAccountDialog = signal(false);
  editingAccount = signal<PortfolioAccount | null>(null);
  saving = signal(false);

  showHistoryDialog = signal(false);
  historyAccount = signal<PortfolioAccount | null>(null);
  history = signal<PortfolioAccountHistory[]>([]);
  historyLoading = signal(false);

  // Form fields
  formName = '';
  formAccountType = '';
  formAssetClass = '';
  formValue = 0;
  formReturnRate: number | null = null;
  formNote: string | null = null;

  readonly accountTypes = ACCOUNT_TYPES.map(t => ({ label: t, value: t }));
  readonly assetClasses = ASSET_CLASSES.map(c => ({ label: c, value: c }));

  readonly headerLeftAction: AppHeaderAction = {
    id: 'back',
    label: 'Back',
    icon: 'pi pi-arrow-left',
    severity: 'secondary',
    outlined: true,
    size: 'small',
  };

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
    this.formName = '';
    this.formAccountType = '401k';
    this.formAssetClass = 'Stocks';
    this.formValue = 0;
    this.formReturnRate = null;
    this.formNote = null;
    this.showAccountDialog.set(true);
  }

  openEditDialog(account: PortfolioAccount): void {
    this.editingAccount.set(account);
    this.formName = account.name;
    this.formAccountType = account.account_type;
    this.formAssetClass = account.asset_class;
    this.formValue = account.current_value;
    this.formReturnRate = account.annual_return_rate;
    this.formNote = null;
    this.showAccountDialog.set(true);
  }

  async saveAccount(): Promise<void> {
    if (!this.formName.trim() || !this.formAccountType || !this.formAssetClass) return;
    this.saving.set(true);

    const payload = {
      name: this.formName.trim(),
      account_type: this.formAccountType,
      asset_class: this.formAssetClass,
      current_value: this.formValue,
      annual_return_rate: this.formReturnRate,
      note: this.formNote?.trim() || null,
    };

    const editing = this.editingAccount();
    const result = editing
      ? await firstValueFrom(this.portfolioSvc.updateAccount(editing.id, payload))
      : await firstValueFrom(this.portfolioSvc.createAccount(payload));

    this.saving.set(false);

    if (result) {
      this.showAccountDialog.set(false);
      await this.loadAccounts();
      this.messageService.add({
        severity: 'success',
        summary: editing ? 'Account Updated' : 'Account Added',
        detail: editing ? `${payload.name} has been updated.` : `${payload.name} has been added.`,
        life: 3000,
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to save account. Please try again.',
        life: 4000,
      });
    }
  }

  async deleteAccount(account: PortfolioAccount): Promise<void> {
    const ok = await firstValueFrom(this.portfolioSvc.deleteAccount(account.id));
    if (ok) {
      await this.loadAccounts();
      this.messageService.add({
        severity: 'success',
        summary: 'Account Removed',
        detail: `${account.name} has been deleted.`,
        life: 3000,
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to delete account.',
        life: 4000,
      });
    }
  }

  async openHistory(account: PortfolioAccount): Promise<void> {
    this.historyAccount.set(account);
    this.showHistoryDialog.set(true);
    this.historyLoading.set(true);
    const h = await firstValueFrom(this.portfolioSvc.getAccountHistory(account.id));
    this.history.set(h);
    this.historyLoading.set(false);
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
