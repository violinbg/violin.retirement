import { Component, EventEmitter, inject, Input, OnChanges, Output, signal, SimpleChanges } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { firstValueFrom } from 'rxjs';
import { PortfolioService, PortfolioAccount, PortfolioAccountHistory } from '../../core/services/portfolio.service';

@Component({
  selector: 'vr-account-history-dialog',
  standalone: true,
  imports: [ButtonModule, DialogModule, TableModule],
  templateUrl: './account-history-dialog.component.html',
  styleUrl: './account-history-dialog.component.scss',
})
export class AccountHistoryDialogComponent implements OnChanges {
  private readonly portfolioSvc = inject(PortfolioService);

  @Input() visible = false;
  @Input() account: PortfolioAccount | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();

  history = signal<PortfolioAccountHistory[]>([]);
  loading = signal(false);

  get header(): string {
    return `History — ${this.account?.name ?? ''}`;
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['visible']?.currentValue === true && this.account) {
      this.loading.set(true);
      const h = await firstValueFrom(this.portfolioSvc.getAccountHistory(this.account.id));
      this.history.set(h);
      this.loading.set(false);
    }
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
