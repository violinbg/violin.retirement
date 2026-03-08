import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { SetupComponent } from './setup/setup.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { FireCalculatorComponent } from './calculator/fire-calculator.component';
import { setupGuard, authGuard, initializedGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [initializedGuard] },
  { path: 'setup', component: SetupComponent, canActivate: [setupGuard] },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'calculator', component: FireCalculatorComponent },
  { path: '**', redirectTo: '' }
];
