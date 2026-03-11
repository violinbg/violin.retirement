import { Component, EventEmitter, inject, Input, OnChanges, Output, signal, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import {
  PortfolioService,
  PortfolioAccount,
  ACCOUNT_TYPES,
  ASSET_CLASSES,
} from '../../core/services/portfolio.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'vr-account-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    TextareaModule,
    TooltipModule,
    TranslatePipe,
  ],
  templateUrl: './account-dialog.component.html',
  styleUrl: './account-dialog.component.scss',
})
export class AccountDialogComponent implements OnChanges {
  private readonly portfolioSvc = inject(PortfolioService);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);

  @Input() visible = false;
  @Input() account: PortfolioAccount | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  saving = signal(false);

  formName = '';
  formAccountType = '';
  formAssetClass = '';
  formValue = 0;
  formReturnRate: number | null = null;
  formNote: string | null = null;

  readonly accountTypes = ACCOUNT_TYPES.map(t => ({ label: t, value: t }));
  readonly assetClasses = ASSET_CLASSES.map(c => ({ label: c, value: c }));

  get isEditMode(): boolean {
    return this.account !== null;
  }

  get header(): string {
    return this.isEditMode
      ? this.translate.instant('ACCOUNT_DIALOG.HEADER_EDIT')
      : this.translate.instant('ACCOUNT_DIALOG.HEADER_ADD');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.resetForm();
    }
  }

  private resetForm(): void {
    if (this.account) {
      this.formName = this.account.name;
      this.formAccountType = this.account.account_type;
      this.formAssetClass = this.account.asset_class;
      this.formValue = this.account.current_value;
      this.formReturnRate = this.account.annual_return_rate;
    } else {
      this.formName = '';
      this.formAccountType = '401k';
      this.formAssetClass = 'Stocks';
      this.formValue = 0;
      this.formReturnRate = null;
    }
    this.formNote = null;
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  async save(): Promise<void> {
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

    const result = this.account
      ? await firstValueFrom(this.portfolioSvc.updateAccount(this.account.id, payload))
      : await firstValueFrom(this.portfolioSvc.createAccount(payload));

    this.saving.set(false);

    if (result) {
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant(this.isEditMode ? 'ACCOUNT_DIALOG.TOAST_UPDATED_TITLE' : 'ACCOUNT_DIALOG.TOAST_ADDED_TITLE'),
        detail: this.translate.instant(this.isEditMode ? 'ACCOUNT_DIALOG.TOAST_UPDATED_DETAIL' : 'ACCOUNT_DIALOG.TOAST_ADDED_DETAIL', { name: payload.name }),
        life: 3000,
      });
      this.close();
      this.saved.emit();
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: this.translate.instant('ACCOUNT_DIALOG.TOAST_ERROR_DETAIL'),
        life: 4000,
      });
    }
  }
}
