import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { AppHeaderAction } from './app-header.models';

@Component({
  selector: 'vr-app-header',
  standalone: true,
  imports: [ButtonModule, TooltipModule],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
})
export class AppHeaderComponent {
  @Input() title = 'Violin Retirement';
  @Input() logoIcon = 'pi pi-chart-line';
  @Input() username: string | null = null;
  @Input() showUsername = true;
  @Input() leftAction: AppHeaderAction | null = null;
  @Input() actions: AppHeaderAction[] = [];
  @Input() sticky = true;

  @Output() actionClick = new EventEmitter<string>();

  get visibleActions(): AppHeaderAction[] {
    return this.actions.filter(action => !action.hidden);
  }

  onAction(action: AppHeaderAction): void {
    if (action.disabled || action.loading) {
      return;
    }
    this.actionClick.emit(action.id);
  }
}