import { Component, EventEmitter, Output } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'vr-about-dialog',
  standalone: true,
  imports: [DialogModule, ButtonModule],
  templateUrl: './about-dialog.component.html',
  styleUrl: './about-dialog.component.scss'
})
export class AboutDialogComponent {
  @Output() closed = new EventEmitter<void>();

  visible = true;

  close(): void {
    this.visible = false;
    this.closed.emit();
  }
}
