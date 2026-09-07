import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-invite',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  template: `
    <div class="invite-page-container">
      <!-- Normal Invite Card -->
      <div class="invite-glass-card" *ngIf="subject && !isTeacherOfCourse">
        <div class="card-glow-icon">
          <div class="icon-circle">
            <mat-icon>mark_email_unread</mat-icon>
          </div>
        </div>

        <div class="invite-header">
          <span class="invite-badge">Приглашение на курс</span>
          <h1 class="invite-course-title">{{ subject.name }}</h1>
          <p class="invite-subtitle" *ngIf="group">
            Вас приглашают присоединиться к академической группе
          </p>
          <p class="invite-subtitle" *ngIf="!group">
            Вас приглашают присоединиться к обучению
          </p>
        </div>

        <div class="invite-details-box" *ngIf="group">
          <div class="detail-row">
            <mat-icon class="detail-icon">groups</mat-icon>
            <div class="detail-text">
              <span class="detail-label">Учебная группа</span>
              <span class="detail-value">{{ group.name }}</span>
            </div>
          </div>
        </div>

        <div class="invite-actions">
          <button type="button" class="pill-btn pill-btn-outline" (click)="decline()">
            Отклонить
          </button>
          <button type="button" class="pill-btn pill-btn-dark" (click)="acceptInvite()">
            <mat-icon>check</mat-icon>
            Принять приглашение
          </button>
        </div>
      </div>

      <!-- Teacher View Card -->
      <div class="invite-glass-card" *ngIf="subject && isTeacherOfCourse">
        <div class="card-glow-icon teacher-glow">
          <div class="icon-circle teacher-circle">
            <mat-icon>school</mat-icon>
          </div>
        </div>

        <div class="invite-header">
          <span class="invite-badge teacher-badge">Преподаватель курса</span>
          <h1 class="invite-course-title">{{ subject.name }}</h1>
          <p class="invite-subtitle">
            Вы являетесь преподавателем на данном курсе
          </p>
        </div>

        <div class="teacher-info-banner">
          <p *ngIf="group">
            Эта ссылка сформирована для приглашения учащихся в группу <strong>{{ group.name }}</strong>.
          </p>
          <p *ngIf="!group">
            Эта ссылка предназначена для прямого приглашения учащихся на курс.
          </p>
        </div>

        <div class="invite-actions single-action">
          <button type="button" class="pill-btn pill-btn-dark" [routerLink]="['/courses', subjectId]">
            <mat-icon>arrow_forward</mat-icon>
            Перейти к курсу
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div class="invite-glass-card status-card" *ngIf="loading">
        <div class="spinner-wrap">
          <div class="custom-spinner"></div>
        </div>
        <h3>Загрузка приглашения...</h3>
        <p>Пожалуйста, подождите, проверяем параметры ссылки</p>
      </div>

      <!-- Error State -->
      <div class="invite-glass-card status-card error" *ngIf="!loading && !subject">
        <div class="card-glow-icon error-glow">
          <div class="icon-circle error-circle">
            <mat-icon>error_outline</mat-icon>
          </div>
        </div>
        <h3>Приглашение не найдено</h3>
        <p>Ссылка может быть устаревшей или указан неверный идентификатор курса</p>
        <div class="invite-actions single-action" style="margin-top: 24px;">
          <button type="button" class="pill-btn pill-btn-dark" routerLink="/">
            На главную
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .invite-page-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 120px);
      padding: 32px 20px;
      position: relative;
      z-index: 1;
    }

    .invite-glass-card {
      max-width: 480px;
      width: 100%;
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 28px;
      border: 1px solid rgba(255, 255, 255, 0.6);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.02);
      padding: 36px 32px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      box-sizing: border-box;
      animation: cardAppear 0.35s ease-out;
    }

    @keyframes cardAppear {
      from {
        opacity: 0;
        transform: translateY(16px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .card-glow-icon {
      margin-bottom: 20px;
    }

    .icon-circle {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
    }

    .icon-circle mat-icon {
      font-size: 30px;
      width: 30px;
      height: 30px;
    }

    .teacher-glow .teacher-circle {
      background: linear-gradient(135deg, #10b981, #059669);
      box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
    }

    .error-glow .error-circle {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      box-shadow: 0 8px 24px rgba(239, 68, 68, 0.3);
    }

    .invite-header {
      margin-bottom: 24px;
    }

    .invite-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      background: rgba(59, 130, 246, 0.1);
      color: #2563eb;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .teacher-badge {
      background: rgba(16, 185, 129, 0.1);
      color: #059669;
    }

    .invite-course-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 32px;
      font-weight: 400;
      color: #09090b;
      margin: 0 0 8px;
      line-height: 1.25;
      letter-spacing: -0.01em;
    }

    .invite-subtitle {
      font-size: 14.5px;
      color: #71717a;
      margin: 0;
      line-height: 1.5;
    }

    .invite-details-box {
      width: 100%;
      background: #f8fafc;
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 16px;
      padding: 14px 18px;
      margin-bottom: 28px;
      box-sizing: border-box;
    }

    .detail-row {
      display: flex;
      align-items: center;
      gap: 12px;
      text-align: left;
    }

    .detail-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      color: #2563eb;
    }

    .detail-text {
      display: flex;
      flex-direction: column;
    }

    .detail-label {
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #71717a;
      font-weight: 600;
    }

    .detail-value {
      font-size: 15px;
      font-weight: 600;
      color: #09090b;
    }

    .teacher-info-banner {
      width: 100%;
      background: #f0fdf4;
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 16px;
      padding: 14px 18px;
      margin-bottom: 28px;
      box-sizing: border-box;
      font-size: 13.5px;
      color: #065f46;
      line-height: 1.5;
      text-align: left;
    }

    .invite-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
    }

    .invite-actions.single-action {
      justify-content: center;
    }

    .invite-actions .pill-btn {
      flex: 1;
      justify-content: center;
    }

    .pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 22px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 500;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
      box-sizing: border-box;
    }

    .pill-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .pill-btn-dark {
      background: #09090b;
      color: #ffffff;
    }

    .pill-btn-dark:hover {
      background: #27272a;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      transform: translateY(-1px);
    }

    .pill-btn-outline {
      background: transparent;
      color: #09090b;
      border: 1px solid rgba(0, 0, 0, 0.16);
    }

    .pill-btn-outline:hover {
      background: rgba(0, 0, 0, 0.04);
      border-color: rgba(0, 0, 0, 0.3);
    }

    .status-card {
      padding: 48px 32px;
    }

    .status-card h3 {
      font-size: 18px;
      font-weight: 600;
      color: #09090b;
      margin: 16px 0 6px;
    }

    .status-card p {
      font-size: 14px;
      color: #71717a;
      margin: 0;
    }

    .spinner-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .custom-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(0, 0, 0, 0.1);
      border-top-color: #09090b;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class InviteComponent implements OnInit {
  subjectId: string = '';
  groupId: string = '';
  subject: any = null;
  group: any = null;
  loading: boolean = true;
  isTeacherOfCourse: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.subjectId = params['subjectId'];
      this.groupId = params['groupId'] || '';
      this.loadDetails();
    });
  }

  loadDetails(): void {
    this.loading = true;
    const currentUser = this.authService.getCurrentUser();
    
    if (this.groupId) {
      this.apiService.getGroup(this.groupId).subscribe({
        next: (group) => {
          this.group = group;
          this.loadSubject(currentUser);
        },
        error: (err) => {
          console.error(err);
          this.loading = false;
        }
      });
    } else {
      this.loadSubject(currentUser);
    }
  }

  loadSubject(currentUser: any): void {
    this.apiService.getSubject(this.subjectId).subscribe({
      next: (subject) => {
        this.subject = subject;
        
        if (currentUser) {
          this.apiService.getSubjectTeachers(this.subjectId).subscribe({
            next: (teachers) => {
              const teachersList = teachers || [];
              this.isTeacherOfCourse = teachersList.some((t: any) => t.user_name === currentUser.name);
              this.loading = false;
            },
            error: (err) => {
              console.error(err);
              this.loading = false;
            }
          });
        } else {
          this.loading = false;
        }
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  acceptInvite(): void {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.snackBar.open('Вы должны быть авторизованы', 'OK', { duration: 3000 });
      this.router.navigate(['/login']);
      return;
    }

    if (this.groupId) {
      this.apiService.addGroupMember(this.groupId, { user_name: user.name }).subscribe({
        next: () => {
          this.snackBar.open('Вы успешно присоединились к группе!', 'OK', { duration: 3000 });
          this.router.navigate(['/courses', this.subjectId]);
        },
        error: (err) => {
          console.error(err);
          this.snackBar.open('Не удалось принять приглашение. Возможно, вы уже состоите в группе.', 'OK', { duration: 5000 });
        }
      });
    } else {
      this.apiService.enrollInSubject(this.subjectId, { user_name: user.name }).subscribe({
        next: () => {
          this.snackBar.open('Вы успешно присоединились к курсу!', 'OK', { duration: 3000 });
          this.router.navigate(['/courses', this.subjectId]);
        },
        error: (err) => {
          console.error(err);
          this.snackBar.open('Не удалось принять приглашение. Возможно, вы уже записаны на этот курс.', 'OK', { duration: 5000 });
        }
      });
    }
  }

  decline(): void {
    this.router.navigate(['/']);
  }
}
