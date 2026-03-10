import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { SetupComponent } from './setup/setup.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { FireCalculatorComponent } from './calculator/fire-calculator.component';
import { PortfolioComponent } from './portfolio/portfolio.component';
import { UsersComponent } from './users/users.component';
import { setupGuard, authGuard, initializedGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [initializedGuard] },
  { path: 'setup', component: SetupComponent, canActivate: [setupGuard] },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'calculator', component: FireCalculatorComponent },
  { path: 'portfolio', component: PortfolioComponent, canActivate: [authGuard] },
  { path: 'users', component: UsersComponent, canActivate: [adminGuard] },
  { path: '**', redirectTo: '' }
];
