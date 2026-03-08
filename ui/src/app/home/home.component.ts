import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { AuthService } from '../core/services/auth.service';
import { LoginDialogComponent } from '../auth/login-dialog/login-dialog.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'vr-home',
  standalone: true,
  imports: [CardModule, ButtonModule, TagModule, LoginDialogComponent, RouterModule],
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
      route: null as string | null,
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

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.auth.logout();
  }
}
