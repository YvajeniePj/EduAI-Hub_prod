import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-user-profile-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="user-dialog-wrap">
      <button class="close-icon-btn" mat-dialog-close matTooltip="Закрыть">
        <mat-icon>close</mat-icon>
      </button>

      <div class="profile-dialog-header">
        <div class="avatar-container">
          <img *ngIf="data.user.avatar_url" [src]="getAvatarUrl(data.user.avatar_url)" alt="avatar" class="avatar" (error)="data.user.avatar_url = undefined">
          <div *ngIf="!data.user.avatar_url" class="monogram-avatar" [style.background]="getMonogramGradient(data.user.name)">
            {{ getUserInitials(data.user.full_name || data.user.name) }}
          </div>
        </div>
        <h2 class="user-display-name">{{ data.user.full_name || data.user.name }}</h2>
        <span class="user-username-tag" *ngIf="data.user.full_name">&#64;{{ data.user.name }}</span>
        <span class="role-pill" 
              [class.admin]="data.user.role === 'admin' || data.user.role === 'hidden_admin'"
              [class.teacher]="data.user.role === 'teacher' || data.user.role === 'instructor'"
              [class.student]="data.user.role === 'student'">
          <span class="role-dot"></span>
          {{ getRoleLabel(data.user.role) }}
        </span>
      </div>
      
      <div class="dialog-body-content">
        <div class="info-section">
          <div class="section-title-row">
            <mat-icon class="section-icon">groups</mat-icon>
            <span class="section-title">Группы</span>
          </div>
          <div class="groups-list" *ngIf="data.user.groups && data.user.groups.length > 0; else noGroups">
            <div class="group-pill" *ngFor="let group of data.user.groups">
              {{ group.name }}
            </div>
          </div>
          <ng-template #noGroups>
            <div class="empty-state-box">
              <mat-icon>group_off</mat-icon>
              <span>Пользователь не состоит в группах</span>
            </div>
          </ng-template>
        </div>
      </div>

      <div class="dialog-actions-row">
        <button type="button" class="pill-btn pill-btn-outline" (click)="viewFullProfile()">
          <mat-icon>person</mat-icon> Профиль
        </button>
        <button type="button" class="pill-btn pill-btn-dark" (click)="startChatWith(data.user.name)" *ngIf="currentUser && data.user.name !== currentUser.name">
          <mat-icon>chat</mat-icon> Начать чат
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .user-dialog-wrap {
      position: relative;
      padding: 32px 28px 24px;
      min-width: 320px;
      max-width: 420px;
      background: #ffffff;
      border-radius: 24px;
      box-sizing: border-box;
    }

    .close-icon-btn {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: rgba(0, 0, 0, 0.04);
      color: #71717a;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .close-icon-btn:hover {
      background: rgba(0, 0, 0, 0.08);
      color: #09090b;
    }

    .close-icon-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .profile-dialog-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .avatar-container {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      overflow: hidden;
      margin-bottom: 14px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
      border: 3px solid #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f4f4f5;
    }

    .avatar {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .monogram-avatar {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .user-display-name {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #09090b;
      letter-spacing: -0.01em;
    }

    .user-username-tag {
      font-size: 13px;
      color: #71717a;
      margin-top: 2px;
    }

    .role-pill {
      margin-top: 10px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      background: #f4f4f5;
      color: #71717a;
      border: 1px solid rgba(0, 0, 0, 0.06);
    }

    .role-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .role-pill.teacher {
      background: rgba(16, 185, 129, 0.1);
      color: #059669;
      border-color: rgba(16, 185, 129, 0.2);
    }

    .role-pill.admin {
      background: rgba(139, 92, 246, 0.1);
      color: #7c3aed;
      border-color: rgba(139, 92, 246, 0.2);
    }

    .role-pill.student {
      background: rgba(37, 99, 235, 0.1);
      color: #2563eb;
      border-color: rgba(37, 99, 235, 0.2);
    }

    .dialog-body-content {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
    }

    .section-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .section-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #71717a;
    }

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .groups-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .group-pill {
      padding: 6px 12px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid rgba(0, 0, 0, 0.08);
      font-size: 13px;
      font-weight: 500;
      color: #1e293b;
    }

    .empty-state-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #fafafa;
      border-radius: 12px;
      color: #a1a1aa;
      font-size: 13px;
    }

    .empty-state-box mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .dialog-actions-row {
      margin-top: 28px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
    }

    .pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      border-radius: 9999px;
      font-size: 13.5px;
      font-weight: 500;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
    }

    .pill-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .pill-btn-dark {
      background: #09090b;
      color: #ffffff;
    }

    .pill-btn-dark:hover {
      background: #27272a;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .pill-btn-outline {
      background: transparent;
      color: #09090b;
      border: 1px solid rgba(0, 0, 0, 0.12);
    }

    .pill-btn-outline:hover {
      background: rgba(0, 0, 0, 0.04);
      border-color: rgba(0, 0, 0, 0.24);
    }
  `]
})
export class UserProfileDialogComponent {
  currentUser: any = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { user: any },
    private dialogRef: MatDialogRef<UserProfileDialogComponent>,
    private router: Router,
    private auth: AuthService
  ) { 
    this.currentUser = this.auth.getCurrentUser();
  }

  getUserInitials(name?: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  getMonogramGradient(name?: string): string {
    if (!name) return 'linear-gradient(135deg, #3b82f6, #6366f1)';
    const colors = [
      'linear-gradient(135deg, #3b82f6, #6366f1)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #8b5cf6, #ec4899)',
      'linear-gradient(135deg, #f59e0b, #d97706)',
      'linear-gradient(135deg, #06b6d4, #0284c7)',
      'linear-gradient(135deg, #ec4899, #f43f5e)'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'admin':
      case 'hidden_admin': return 'Администратор';
      case 'teacher':
      case 'instructor': return 'Преподаватель';
      case 'student': return 'Студент';
      default: return role;
    }
  }

  getAvatarUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/static')) return `/api${url}`;
    if (url.startsWith('/api/')) return url;
    return `/api/${url}`;
  }

  viewFullProfile() {
    this.dialogRef.close();
    this.router.navigate(['/profile', this.data.user.name]);
  }

  startChatWith(username: string) {
    this.dialogRef.close();
    this.router.navigate(['/messages'], { queryParams: { chatWith: username } });
  }
}

