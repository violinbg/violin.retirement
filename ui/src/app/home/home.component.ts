import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

@Component({
  selector: 'vr-home',
  standalone: true,
  imports: [CardModule, ButtonModule, TagModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  readonly features = [
    {
      icon: 'pi pi-chart-line',
      title: 'Portfolio Tracking',
      description: 'Monitor your investment portfolio across accounts and asset classes in real time.'
    },
    {
      icon: 'pi pi-calculator',
      title: 'FIRE Calculator',
      description: 'Project your path to financial independence with dynamic retirement calculators.'
    },
    {
      icon: 'pi pi-wallet',
      title: 'Savings Goals',
      description: 'Set and track savings milestones on your journey to early retirement.'
    },
    {
      icon: 'pi pi-shield',
      title: 'Safe Withdrawal',
      description: 'Model sustainable withdrawal rates and stress-test your retirement plan.'
    }
  ];
}
