import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { UserService, User, UpdateUserRequest } from '../../core/services/user.service';

@Component({
  selector: 'vr-edit-user-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonModule, DialogModule, InputTextModule, SelectModule],
  templateUrl: './edit-user-dialog.component.html',
  styleUrl: './edit-user-dialog.component.scss',
})
export class EditUserDialogComponent implements OnChanges {
  private readonly userSvc = inject(UserService);
  private readonly messageService = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  @Input() visible = false;
  @Input() user: User | null = null;
  @Input() currentUserId: string | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() updated = new EventEmitter<void>();

  form = this.fb.group({
    full_name: ['', Validators.required],
    role: ['user', Validators.required],
    password: ['', [Validators.minLength(8)]],
  });

  readonly roles = [
    { label: 'Admin', value: 'admin' },
    { label: 'User', value: 'user' },
  ];

  get isSelf(): boolean {
    return this.user?.id === this.currentUserId;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true && this.user) {
      this.form.patchValue({
        full_name: this.user.full_name,
        role: this.user.role,
        password: '',
      });
    }
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  async update(): Promise<void> {
    if (!this.form.valid || !this.user) return;

    const req: UpdateUserRequest = {
      full_name: this.form.get('full_name')?.value ?? '',
      role: (this.form.get('role')?.value as 'admin' | 'user') ?? 'user',
    };

    const password = this.form.get('password')?.value;
    if (password) req.password = password;

    try {
      await this.userSvc.updateUser(this.user.id, req);
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'User updated successfully',
      });
      this.close();
      this.updated.emit();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error?.error?.error || 'Failed to update user',
      });
    }
  }
}
