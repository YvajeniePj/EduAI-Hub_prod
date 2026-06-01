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
    <div class="invite-container">
      <mat-card class="invite-card" *ngIf="subject && group">
        <mat-card-header>
          <mat-icon mat-card-avatar class="invite-icon">mail_outline</mat-icon>
          <mat-card-title>Приглашение на курс</mat-card-title>
          <mat-card-subtitle>Вас пригласили присоединиться к обучению</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content class="invite-content">
          <p class="invite-text">
            Вы приглашены на курс <strong class="highlight">{{ subject.name }}</strong> в группу <strong class="highlight">{{ group.name }}</strong>.
          </p>
        </mat-card-content>
        <mat-card-actions align="end">
          <button mat-button (click)="decline()">Отклонить</button>
          <button mat-raised-button color="primary" (click)="acceptInvite()">Принять приглашение</button>
        </mat-card-actions>
      </mat-card>

      <mat-card class="invite-card loading-card" *ngIf="loading">
        <mat-card-content>
          <p>Загрузка деталей приглашения...</p>
        </mat-card-content>
      </mat-card>

      <mat-card class="invite-card error-card" *ngIf="!loading && (!subject || !group)">
        <mat-card-content>
          <p>Не удалось загрузить данные приглашения. Ссылка может быть недействительной.</p>
        </mat-card-content>
        <mat-card-actions align="end">
          <button mat-raised-button color="primary" routerLink="/">На главную</button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .invite-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 120px);
      padding: 24px;
    }
    .invite-card {
      max-width: 500px;
      width: 100%;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      border: 1px solid #e0e0e0;
      padding: 16px;
    }
    .invite-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #3f51b5;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .invite-content {
      margin: 24px 0;
    }
    .invite-text {
      font-size: 16px;
      line-height: 1.6;
      color: #37474f;
    }
    .highlight {
      color: #3f51b5;
      font-weight: 600;
    }
    .loading-card, .error-card {
      text-align: center;
    }
  `]
})
export class InviteComponent implements OnInit {
  subjectId: string = '';
  groupId: string = '';
  subject: any = null;
  group: any = null;
  loading: boolean = true;

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
      this.groupId = params['groupId'];
      this.loadDetails();
    });
  }

  loadDetails(): void {
    this.loading = true;
    this.apiService.getGroup(this.groupId).subscribe({
      next: (group) => {
        this.group = group;
        this.apiService.getSubjects().subscribe({
          next: (subjects) => {
            this.subject = subjects.find(s => s.id === this.subjectId);
            this.loading = false;
          },
          error: (err) => {
            console.error(err);
            this.loading = false;
          }
        });
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
  }

  decline(): void {
    this.router.navigate(['/']);
  }
}
