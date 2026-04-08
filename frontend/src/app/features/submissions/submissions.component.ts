import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-submissions',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, RouterModule],
  template: `
    <div class="page-container">
      <div class="header">
        <h1>Мои сдачи</h1>
      </div>

      <div class="submissions-list" *ngIf="submissions.length > 0; else emptyState">
        <mat-card *ngFor="let submission of submissions" class="submission-card">
          <mat-card-header>
            <mat-card-title>
              Сдача теста #{{ submission.id | slice:0:8 }}
              <mat-chip-set class="version-chip">
                <mat-chip>Версия {{ submission.version || 1 }}</mat-chip>
              </mat-chip-set>
            </mat-card-title>
            <mat-card-subtitle>Тест ID: {{ submission.test_id }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Оценка:</span>
                <span class="value">{{ submission.total_score }}/{{ submission.total_max }}</span>
              </div>
              <div class="info-item" *ngIf="submission.finished_at">
                <span class="label">Дата:</span>
                <span class="value">{{ submission.finished_at | date:'dd.MM.yyyy HH:mm' }}</span>
              </div>
              <div class="info-item" *ngIf="submission.files?.length > 0">
                <span class="label">Файлов:</span>
                <span class="value">{{ submission.files.length }}</span>
              </div>
            </div>
          </mat-card-content>
          <mat-card-actions align="end">
            <button mat-button color="accent" (click)="createNewVersion(submission)" title="Создать новую версию на основе этой">
              <mat-icon>autorenew</mat-icon>
              Новая версия
            </button>
            <button mat-raised-button color="primary" [routerLink]="['/submissions', submission.id, 'results']">
              Посмотреть результаты
            </button>
          </mat-card-actions>
        </mat-card>
      </div>

      <ng-template #emptyState>
        <div class="empty-state">
          <p>Вы еще ничего не сдавали</p>
          <button mat-raised-button color="primary" routerLink="/tests">Перейти к тестам</button>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 32px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      margin-bottom: 32px;
    }
    .submission-card {
      margin-bottom: 24px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .version-chip {
      display: inline-block;
      margin-left: 12px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .label {
      font-size: 12px;
      color: #757575;
      text-transform: uppercase;
    }
    .value {
      font-size: 16px;
      font-weight: 500;
    }
    .empty-state {
      text-align: center;
      margin-top: 64px;
    }
  `]
})
export class SubmissionsComponent implements OnInit {
  submissions: any[] = [];

  constructor(
    private apiService: ApiService, 
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadSubmissions();
  }

  loadSubmissions() {
    const user = this.auth.getCurrentUser();
    const username = user?.name;
    this.apiService.getSubmissions(undefined, username || undefined).subscribe({
      next: (submissions) => {
        // Sort by version descending to show latest first within same test
        this.submissions = submissions.sort((a, b) => {
          if (a.test_id === b.test_id) {
            return (b.version || 1) - (a.version || 1);
          }
          return b.finished_at ? new Date(b.finished_at).getTime() - new Date(a.finished_at || 0).getTime() : 0;
        });
      },
      error: (err) => console.error('Error loading submissions:', err)
    });
  }

  createNewVersion(submission: any) {
    if (confirm('Создать новую версию этой работы? Текущие ответы будут скопированы в новый черновик.')) {
      this.apiService.createSubmissionVersion(submission.id).subscribe({
        next: (newSub) => {
          this.router.navigate(['/tests', submission.test_id, 'take']); // Navigate back to test taking
        },
        error: (err) => {
          console.error('Error creating new version:', err);
          alert('Ошибка при создании версии: ' + (err.error?.detail || err.message));
        }
      });
    }
  }
}

