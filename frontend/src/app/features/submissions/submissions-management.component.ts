import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatBadgeModule } from '@angular/material/badge';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { RussianDatePipe } from '../../core/pipes/russian-date.pipe';

@Component({
  selector: 'app-submissions-management',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatButtonToggleModule,
    MatBadgeModule,
    FormsModule,
    RussianDatePipe
  ],
  template: `
    <div class="submissions-management-container">
      <div class="page-header">
        <h1 class="page-title">Работы студентов</h1>
        <p class="page-subtitle">Проверка и управление сданными тестами</p>
      </div>

      <div class="dashboard-controls">
        <mat-button-toggle-group [(ngModel)]="submissionFilter" (change)="applyFilters()" color="primary">
          <mat-button-toggle value="pending">
            Ожидают проверки
            <span class="badge" *ngIf="getPendingCount() > 0">{{ getPendingCount() }}</span>
          </mat-button-toggle>
          <mat-button-toggle value="archive">Архив (Проверено)</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      <!-- Filters -->
      <mat-card class="filters-card">
        <mat-card-content>
          <div class="filters-panel">
            <mat-form-field appearance="outline">
              <mat-label>Курс</mat-label>
              <mat-select [(ngModel)]="filter.subjectId" (selectionChange)="applyFilters()">
                <mat-option [value]="undefined">Все курсы</mat-option>
                <mat-option *ngFor="let s of subjects" [value]="s.id">{{ s.name }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Тип теста</mat-label>
              <mat-select [(ngModel)]="filter.type" (selectionChange)="applyFilters()">
                <mat-option [value]="undefined">Любой тип</mat-option>
                <mat-option value="multiple_choice">Тест</mat-option>
                <mat-option value="keyword_based">Развернутый ответ</mat-option>
                <mat-option value="project">Проект</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Поиск студента</mat-label>
              <input matInput [(ngModel)]="filter.studentName" (input)="applyFilters()" placeholder="Имя или фамилия...">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <div *ngIf="loading" class="loading-state">
        <mat-icon class="spin">sync</mat-icon>
        <p>Загрузка работ...</p>
      </div>

      <div *ngIf="!loading && filteredSubmissions.length === 0" class="empty-state">
        <mat-icon>inbox</mat-icon>
        <p>Работы не найдены</p>
      </div>

      <div class="submissions-grid" *ngIf="!loading && filteredSubmissions.length > 0">
        <mat-card *ngFor="let sub of filteredSubmissions" class="submission-card" [class]="sub.status">
          <mat-card-header>
            <div class="student-avatar" mat-card-avatar>
              {{ sub.user[0]?.toUpperCase() || '?' }}
            </div>
            <mat-card-title>{{ sub.user }}</mat-card-title>
            <mat-card-subtitle>{{ getSubjectName(getTestSubjectId(sub.test_id)!) }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="submission-details">
              <div class="detail-row">
                <mat-icon>quiz</mat-icon>
                <strong>{{ getTestTitle(sub.test_id) }}</strong>
              </div>
              <div class="detail-row">
                <mat-icon>event</mat-icon>
                <span>{{ sub.finished_at | russianDate:'datetime' }}</span>
              </div>
              <div class="version-badge" *ngIf="sub.version > 1">Версия {{ sub.version }}</div>
            </div>
            
            <div class="tag-row">
              <div class="test-type-badge small" [ngClass]="getTestType(sub.test_id)">
                {{ getTestTypeLabel(getTestType(sub.test_id)) }}
              </div>
              <div class="status-badge" [class]="sub.status">
                {{ getStatusLabel(sub.status) }}
              </div>
            </div>
          </mat-card-content>
          <mat-card-actions class="card-actions">
            <button mat-raised-button color="primary" (click)="viewSubmission(sub.id)">
              <mat-icon>visibility</mat-icon> Проверить
            </button>
            <div class="quick-status-actions" *ngIf="sub.status === 'pending'">
              <button mat-icon-button color="primary" matTooltip="Одобрить" (click)="approveSubmission(sub.id)" *ngIf="getTestType(sub.test_id) !== 'project'">
                <mat-icon>check</mat-icon>
              </button>
              <button mat-icon-button color="warn" matTooltip="Отклонить" (click)="rejectSubmission(sub.id)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </mat-card-actions>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .submissions-management-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .page-header { margin-bottom: 32px; text-align: center; }
    .page-title { font-size: 32px; font-weight: 700; color: #1a237e; margin-bottom: 8px; }
    .page-subtitle { color: #666; font-size: 16px; }

    .dashboard-controls {
      display: flex;
      justify-content: center;
      margin-bottom: 24px;
    }

    .badge {
      background: #f44336;
      color: white;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      margin-left: 8px;
      font-weight: 600;
    }

    .filters-card {
      margin-bottom: 32px;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    }
    .filters-panel {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .filters-panel mat-form-field {
      flex: 1;
      min-width: 250px;
    }

    .submissions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 24px;
    }

    .submission-card {
      border-radius: 20px;
      transition: all 0.3s ease;
      border: 1px solid rgba(0,0,0,0.05);
      overflow: hidden;
    }
    .submission-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 12px 30px rgba(0,0,0,0.1);
    }
    
    .student-avatar {
      background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }

    .submission-details {
      margin: 16px 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .detail-row {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #444;
    }
    .detail-row mat-icon { color: #3f51b5; font-size: 20px; width: 20px; height: 20px; }

    .tag-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 16px;
    }

    .test-type-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .test-type-badge.multiple_choice { background: #e3f2fd; color: #1976d2; }
    .test-type-badge.keyword_based { background: #f3e5f5; color: #7b1fa2; }
    .test-type-badge.project { background: #e8f5e9; color: #2e7d32; }

    .status-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-badge.pending { background: #fff3e0; color: #ef6c00; }
    .status-badge.approved { background: #e8f5e9; color: #2e7d32; }
    .status-badge.rejected { background: #ffebee; color: #c62828; }

    .card-actions {
      padding: 16px;
      border-top: 1px solid #eee;
      display: flex;
      justify-content: space-between;
    }

    .loading-state, .empty-state {
      text-align: center;
      padding: 64px;
      color: #777;
    }
    .spin { animation: rotation 2s infinite linear; }
    @keyframes rotation { from { transform: rotate(0deg); } to { transform: rotate(359deg); } }
  `]
})
export class SubmissionsManagementComponent implements OnInit {
  submissions: any[] = [];
  filteredSubmissions: any[] = [];
  tests: any[] = [];
  subjects: any[] = [];
  loading = true;
  submissionFilter: 'pending' | 'archive' = 'pending';
  
  filter = {
    subjectId: undefined,
    type: undefined,
    studentName: ''
  };

  constructor(
    private apiService: ApiService,
    private router: Router,
    private auth: AuthService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    Promise.all([
      this.apiService.getTests().toPromise(),
      this.apiService.getSubjects().toPromise(),
      this.apiService.getSubmissions().toPromise()
    ]).then(([tests, subjects, subs]) => {
      this.tests = tests || [];
      this.subjects = subjects || [];
      this.submissions = (subs || []).sort((a, b) => 
        new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime()
      );
      this.applyFilters();
      this.loading = false;
    }).catch(err => {
      console.error('Error loading submissions data:', err);
      this.loading = false;
    });
  }

  applyFilters() {
    this.filteredSubmissions = this.submissions.filter(sub => {
      const matchesSubject = !this.filter.subjectId || this.getTestSubjectId(sub.test_id) === this.filter.subjectId;
      const matchesType = !this.filter.type || this.getTestType(sub.test_id) === this.filter.type;
      const matchesStudent = !this.filter.studentName || sub.user.toLowerCase().includes(this.filter.studentName.toLowerCase());
      
      let matchesArchive = true;
      if (this.submissionFilter === 'pending') {
        matchesArchive = sub.status === 'pending';
      } else {
        matchesArchive = sub.status === 'approved' || sub.status === 'rejected';
      }
      
      const isFinished = sub.is_finished === 'true' || sub.is_finished === true;
      
      return matchesSubject && matchesType && matchesStudent && matchesArchive && isFinished;
    });
  }

  getTestSubjectId(testId: string): string | undefined {
    return this.tests.find(t => t.id === testId)?.subject_id;
  }

  getTestTitle(testId: string): string {
    return this.tests.find(t => t.id === testId)?.title || 'Неизвестный тест';
  }

  getTestType(testId: string): string {
    return this.tests.find(t => t.id === testId)?.test_type || 'multiple_choice';
  }

  getSubjectName(subjectId: string): string {
    if (!subjectId) return 'Общий';
    const subj = this.subjects.find(s => s.id === subjectId);
    return subj ? subj.name : '...';
  }

  getPendingCount(): number {
    return this.submissions.filter(s => s.status === 'pending').length;
  }

  getStatusLabel(status: string): string {
    const labels: any = {
      'pending': 'Ожидает',
      'approved': 'Одобрено',
      'rejected': 'Отклонено'
    };
    return labels[status] || status;
  }

  getTestTypeLabel(type: string): string {
    const labels: any = {
      'multiple_choice': 'Тест',
      'keyword_based': 'Развернутый ответ',
      'project': 'Проект'
    };
    return labels[type?.toLowerCase()] || type;
  }

  viewSubmission(id: string) {
    this.router.navigate(['/submissions', id]);
  }

  approveSubmission(id: string) {
    if (confirm('Одобрить эту работу?')) {
      this.apiService.updateSubmissionStatus(id, 'approved').subscribe(() => this.loadData());
    }
  }

  rejectSubmission(id: string) {
    const feedback = prompt('Введите причину отклонения:');
    if (feedback !== null) {
      this.apiService.updateSubmissionStatus(id, 'rejected', feedback).subscribe(() => this.loadData());
    }
  }
}
