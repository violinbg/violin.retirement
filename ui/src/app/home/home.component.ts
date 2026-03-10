import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../core/services/auth.service';
import { LoginDialogComponent } from '../auth/login-dialog/login-dialog.component';
import { AppHeaderComponent } from '../shared/components/app-header/app-header.component';
import { AppHeaderAction } from '../shared/components/app-header/app-header.models';

@Component({
  selector: 'vr-home',
  standalone: true,
  imports: [CardModule, ButtonModule, TagModule, LoginDialogComponent, AppHeaderComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  showLoginDialog = signal(false);

  readonly features = [
    {
      icon: 'pi pi-chart-line',
      title: 'Portfolio Tracking',
      description: 'Monitor your investment portfolio across accounts and asset classes in real time.',
      route: '/portfolio' as string | null,
    },
    {
      icon: 'pi pi-calculator',
      title: 'FIRE Calculator',
      description: 'Project your path to financial independence with dynamic retirement calculators.',
      route: '/calculator',
    },
    {
      icon: 'pi pi-wallet',
      title: 'Savings Goals',
      description: 'Set and track savings milestones on your journey to early retirement.',
      route: null as string | null,
    },
    {
      icon: 'pi pi-shield',
      title: 'Safe Withdrawal',
      description: 'Model sustainable withdrawal rates and stress-test your retirement plan.',
      route: null as string | null,
    }
  ];

  get headerUsername(): string | null {
    return this.auth.isLoggedIn() ? (this.auth.currentUser()?.full_name ?? null) : null;
  }

  get headerActions(): AppHeaderAction[] {
    if (this.auth.isLoggedIn()) {
      return [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: 'pi pi-th-large',
          size: 'small',
        },
        {
          id: 'logout',
          label: 'Sign Out',
          icon: 'pi pi-sign-out',
          severity: 'secondary',
          outlined: true,
          size: 'small',
        },
      ];
    }

    return [
      {
        id: 'signin',
        label: 'Sign In',
        icon: 'pi pi-sign-in',
        severity: 'secondary',
        outlined: true,
        size: 'small',
      },
    ];
  }

  onHeaderAction(actionId: string): void {
    if (actionId === 'dashboard') {
      this.goToDashboard();
      return;
    }

    if (actionId === 'logout') {
      this.logout();
      return;
    }

    if (actionId === 'signin') {
      this.showLoginDialog.set(true);
    }
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.auth.logout();
  }

  onFeatureClick(route: string | null): void {
    if (!route) return;

    if (route === '/portfolio' && !this.auth.isLoggedIn()) {
      this.showLoginDialog.set(true);
      return;
    }

    this.router.navigate([route]);
  }

  onFeatureKeydown(event: KeyboardEvent, route: string | null): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.onFeatureClick(route);
  }
}
