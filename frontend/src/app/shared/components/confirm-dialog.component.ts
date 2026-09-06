import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  icon?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  template: `
    <div class="confirm-dialog-wrap">
      <div class="dialog-icon-badge" [class.destructive]="data.isDestructive !== false">
        <mat-icon>{{ data.icon || (data.isDestructive !== false ? 'warning' : 'help_outline') }}</mat-icon>
      </div>

      <h2 class="dialog-title">{{ data.title }}</h2>
      <p class="dialog-message">{{ data.message }}</p>

      <div class="dialog-actions">
        <button type="button" class="btn-dialog btn-cancel" (click)="onCancel()">
          {{ data.cancelText || 'Отмена' }}
        </button>
        <button type="button" class="btn-dialog btn-confirm" [class.btn-destructive]="data.isDestructive !== false" (click)="onConfirm()">
          {{ data.confirmText || 'Подтвердить' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-dialog-wrap {
      padding: 28px 24px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      background: #ffffff;
      border-radius: 20px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .dialog-icon-badge {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #f4f4f5;
      color: #71717a;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }

    .dialog-icon-badge.destructive {
      background: #fef2f2;
      color: #ef4444;
    }

    .dialog-icon-badge mat-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
    }

    .dialog-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 24px;
      font-weight: 500;
      color: #09090b;
      margin: 0 0 8px 0;
      line-height: 1.25;
    }

    .dialog-message {
      font-size: 14px;
      color: #71717a;
      line-height: 1.5;
      margin: 0 0 24px 0;
      max-width: 380px;
    }

    .dialog-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      justify-content: center;
    }

    .btn-dialog {
      height: 42px;
      padding: 0 22px;
      border-radius: 9999px;
      font-size: 13.5px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid transparent;
      outline: none;
    }

    .btn-cancel {
      background: #f4f4f5;
      color: #27272a;
      border-color: #e4e4e7;
    }

    .btn-cancel:hover {
      background: #e4e4e7;
    }

    .btn-confirm {
      background: #09090b;
      color: #ffffff;
    }

    .btn-confirm:hover {
      background: #27272a;
      transform: translateY(-1px);
    }

    .btn-confirm.btn-destructive {
      background: #dc2626;
      color: #ffffff;
    }

    .btn-confirm.btn-destructive:hover {
      background: #b91c1c;
      transform: translateY(-1px);
    }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  onCancel() {
    this.dialogRef.close(false);
  }

  onConfirm() {
    this.dialogRef.close(true);
  }
}
