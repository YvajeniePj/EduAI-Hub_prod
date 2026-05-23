import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-test-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule
  ],
  template: `
    <div class="container" *ngIf="test">
      <h1>{{ test.title }}</h1>
      <p>{{ test.description }}</p>
      <p><strong>Тип теста:</strong> {{ getTestTypeLabel(test.test_type) }}</p>
      <p *ngIf="test.due_date"><strong>Дедлайн:</strong> {{ test.due_date | date }}</p>

      <!-- Reference Materials for PROJECT type -->
      <div class="assets-section" *ngIf="test.test_type === 'project' && testAssets.length > 0">
        <h3>Прикрепленные материалы к проекту</h3>
        <mat-card class="assets-card">
          <mat-list>
            <mat-list-item *ngFor="let asset of testAssets" class="asset-item">
              <mat-icon matListItemIcon>attachment</mat-icon>
              <div matListItemTitle class="asset-title text-primary">
                {{ asset.original_name }}
                <span class="file-size">({{ (asset.size / 1024).toFixed(1) }} KB)</span>
              </div>
              <div matListItemLine class="asset-actions">
                <a mat-stroked-button color="primary" [href]="'/api/tests/' + test.id + '/files/' + asset.id + '/download'" target="_blank" [download]="asset.original_name">
                  <mat-icon>download</mat-icon>
                  Скачать
                </a>
              </div>
            </mat-list-item>
          </mat-list>
        </mat-card>
      </div>

      <div class="test-buffer-info" *ngIf="!isTeacher">
        <div class="test-stats-row">
          <div class="stat-box">
            <span class="stat-label">Количество вопросов</span>
            <span class="stat-value">{{ test.questions?.length || 0 }}</span>
          </div>
          <div class="stat-box" *ngIf="test.time_limit_minutes">
            <span class="stat-label">Время на выполнение</span>
            <span class="stat-value">{{ test.time_limit_minutes }} мин.</span>
          </div>
        </div>
      </div>

      <div class="actions">
        <button mat-raised-button color="primary" [routerLink]="['/tests', test.id, 'take']" [queryParams]="{ source: source || 'tests' }" class="start-btn">
          Пройти тест
        </button>
        <button mat-button [routerLink]="source === 'courses' && test?.subject_id ? ['/courses', test.subject_id] : '/tests'" class="back-btn">Выйти</button>
      </div>

      <div *ngIf="isTeacher">
        <h2>Вопросы ({{ test.questions?.length || 0 }})</h2>
      <mat-card *ngFor="let question of test.questions" class="question-card">
        <mat-card-content>
          <h3>{{ question.title }}</h3>
          <p>Максимум баллов: {{ question.max_points }}</p>
          
          <div *ngIf="test.test_type === 'multiple_choice'">
            <h4>Варианты ответов:</h4>
            <ul>
              <li *ngFor="let option of question.options">{{ option }}</li>
            </ul>
            <p *ngIf="isTeacher"><strong>Правильный ответ:</strong> {{ question.correct_answer }}</p>
          </div>

          <div *ngIf="test.test_type === 'keyword_based' && isTeacher">
            <h4>Ключевые слова:</h4>
            <ul>
              <li *ngFor="let keyword of question.keywords">
                {{ keyword.word }} ({{ keyword.points }} баллов)
              </li>
            </ul>
          </div>
        </mat-card-content>
      </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }
    .actions {
      margin: 20px 0;
    }
    .question-card {
      margin-bottom: 20px;
    }
    .assets-section {
      margin-top: 24px;
      margin-bottom: 24px;
    }
    .assets-card {
      border: 1px solid #e0e0e0;
      box-shadow: none !important;
      background: #f8f9fa !important;
    }
    .warning-card {
      background: #fff5f5;
      border-left: 4px solid #f56565;
      margin-bottom: 24px;
    }
    .warning-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px !important;
    }
    .warning-card p {
      margin: 0;
      color: #c53030;
    }
    .test-stats-row {
      display: flex;
      gap: 24px;
      margin-bottom: 32px;
    }
    .stat-box {
      background: white;
      padding: 20px;
      border-radius: 12px;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .stat-label {
      font-size: 14px;
      color: #718096;
      margin-bottom: 8px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #2d3748;
    }
    .start-btn {
      height: 48px;
      padding: 0 32px;
      font-weight: 600;
    }
    .back-btn {
      height: 48px;
      margin-left: 16px;
    }
    .file-size {
      font-size: 12px;
      color: #757575;
      font-weight: 400;
      margin-left: 8px;
    }
    .asset-item {
      border-bottom: 1px solid #eee;
    }
    .asset-item:last-child {
      border-bottom: none;
    }
    .asset-actions {
      margin-top: 8px;
    }
    .text-primary {
      color: #1a237e;
      font-weight: 500;
    }
  `]
})
export class TestDetailComponent implements OnInit {
  test: any = null;
  testAssets: any[] = [];
  isTeacher = false;
  source: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.isTeacher = this.auth.getCurrentUser()?.role === 'teacher';
    this.route.queryParams.subscribe(params => {
      this.source = params['source'];
    });
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.apiService.getTest(id).subscribe({
        next: (test) => {
          this.test = test;
          if (test.test_type === 'project') {
            this.loadAssets(id);
          }
        },
        error: (err) => {
          console.error('Error loading test:', err);
          alert('Ошибка загрузки теста');
          this.router.navigate(['/tests']);
        }
      });
    }
  }

  loadAssets(testId: string) {
    this.apiService.getTestFiles(testId).subscribe({
      next: (assets) => this.testAssets = assets,
      error: (err) => console.error('Error loading test assets:', err)
    });
  }

  getTestTypeLabel(type: string): string {
    const labels: any = {
      'multiple_choice': 'С вариантами ответов',
      'keyword_based': 'Развернутый ответ',
      'project': 'Проект'
    };
    return labels[type] || type;
  }
}

