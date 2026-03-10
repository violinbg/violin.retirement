import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { AuthService } from '../core/services/auth.service';
import { UserService, User, CreateUserRequest, UpdateUserRequest } from '../core/services/user.service';
import { AppHeaderComponent } from '../shared/components/app-header/app-header.component';
import { AppHeaderAction } from '../shared/components/app-header/app-header.models';

@Component({
  selector: 'vr-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    TableModule,
    InputTextModule,
    InputGroupModule,
    SelectModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    ProgressSpinnerModule,
    TagModule,
    TooltipModule,
    AppHeaderComponent,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
  providers: [MessageService, ConfirmationService],
})
export class UsersComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly userSvc = inject(UserService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  users = signal<User[]>([]);
  loading = signal(true);
  showCreateDialog = signal(false);
  showEditDialog = signal(false);
  editingUser = signal<User | null>(null);

  createForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    full_name: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['user', Validators.required],
  });

  editForm = this.fb.group({
    full_name: ['', Validators.required],
    role: ['user', Validators.required],
    password: ['', [Validators.minLength(8), Validators.nullValidator]],
  });

  roles = [
    { label: 'Admin', value: 'admin' },
    { label: 'User', value: 'user' },
  ];

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

  ngOnInit(): void {
    this.loadUsers();
  }

  onHeaderAction(actionId: string): void {
    if (actionId === 'logout') this.logout();
    if (actionId === 'back') this.navigateBack();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  navigateBack(): void {
    this.router.navigate(['/dashboard']);
  }

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    try {
      const users = await this.userSvc.listUsers();
      this.users.set(users);
    } catch (error: any) {
      const detail = error?.error?.error
        || error?.message
        || 'Failed to load users';
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail,
      });
    } finally {
      this.loading.set(false);
    }
  }

  openCreateDialog(): void {
    this.createForm.reset({ role: 'user' });
    this.showCreateDialog.set(true);
  }

  async createUser(): Promise<void> {
    if (!this.createForm.valid) return;

    const req: CreateUserRequest = {
      username: this.createForm.get('username')?.value || '',
      full_name: this.createForm.get('full_name')?.value || '',
      password: this.createForm.get('password')?.value || '',
      role: (this.createForm.get('role')?.value as 'admin' | 'user') || 'user',
    };

    try {
      await this.userSvc.createUser(req);
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: `User "${req.username}" created successfully`,
      });
      this.showCreateDialog.set(false);
      await this.loadUsers();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error?.error?.error || 'Failed to create user',
      });
    }
  }

  openEditDialog(user: User): void {
    this.editingUser.set(user);
    this.editForm.patchValue({
      full_name: user.full_name,
      role: user.role,
      password: '',
    });
    this.showEditDialog.set(true);
  }

  async updateUser(): Promise<void> {
    if (!this.editForm.valid) return;
    const user = this.editingUser();
    if (!user) return;

    const req: UpdateUserRequest = {
      full_name: this.editForm.get('full_name')?.value || '',
      role: (this.editForm.get('role')?.value as 'admin' | 'user') || 'user',
    };

    const password = this.editForm.get('password')?.value;
    if (password) {
      req.password = password;
    }

    try {
      await this.userSvc.updateUser(user.id, req);
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'User updated successfully',
      });
      this.showEditDialog.set(false);
      await this.loadUsers();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error?.error?.error || 'Failed to update user',
      });
    }
  }

  confirmToggleStatus(user: User): void {
    const action = user.active ? 'deactivate' : 'reactivate';
    this.confirmService.confirm({
      message: `Are you sure you want to ${action} user "${user.username}"?`,
      header: `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        await this.toggleUserStatus(user);
      },
    });
  }

  async toggleUserStatus(user: User): Promise<void> {
    try {
      await this.userSvc.toggleUserStatus(user.id, !user.active);
      const action = user.active ? 'deactivated' : 'reactivated';
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: `User "${user.username}" ${action}`,
      });
      await this.loadUsers();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error?.error?.error || 'Failed to toggle user status',
      });
    }
  }

  confirmDelete(user: User): void {
    if (user.id === this.auth.currentUser()?.id) {
      this.messageService.add({
        severity: 'error',
        summary: 'Cannot Delete',
        detail: 'You cannot delete your own account',
      });
      return;
    }

    this.confirmService.confirm({
      message: `Are you sure you want to permanently delete user "${user.username}"? This action cannot be undone.`,
      header: 'Delete User',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        await this.deleteUser(user);
      },
    });
  }

  async deleteUser(user: User): Promise<void> {
    try {
      await this.userSvc.deleteUser(user.id);
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: `User "${user.username}" deleted successfully`,
      });
      await this.loadUsers();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: error?.error?.error || 'Failed to delete user',
      });
    }
  }

  getRoleTag(role: string): { label: string; severity: 'danger' | 'info' } {
    return role === 'admin'
      ? { label: 'Admin', severity: 'danger' }
      : { label: 'User', severity: 'info' };
  }

  getStatusTag(active: boolean): { label: string; severity: 'success' | 'warn' } {
    return active
      ? { label: 'Active', severity: 'success' }
      : { label: 'Inactive', severity: 'warn' };
  }

  formatDate(date: string | null): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
