import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Subject, takeUntil } from 'rxjs';
import { RussianDatePipe } from '../../core/pipes/russian-date.pipe';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatBadgeModule } from '@angular/material/badge';

@Component({
  selector: 'app-tests',
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
    <div class="tests-container">
      <div class="tests-content">
        <div class="page-header">
          <h1 class="page-title">Тесты</h1>
          <p class="page-subtitle">Доступные учебные тесты и задания</p>
        </div>

        <div class="controls-row" *ngIf="isTeacher">
          <button mat-raised-button color="primary" (click)="createTest()">
            <mat-icon>add</mat-icon> Создать тест
          </button>
        </div>

        <div *ngIf="tests.length === 0" class="empty-state">
          <mat-icon>quiz</mat-icon>
          <p>Нет доступных тестов</p>
        </div>

        <div class="tests-grid" *ngIf="tests.length > 0">
          <mat-card *ngFor="let test of tests" class="test-card" [class.completed]="isCompleted(test.id)">
            <mat-card-header>
              <div class="test-type-badge" [ngClass]="test.test_type">
                {{ getTestTypeLabel(test.test_type) }}
              </div>
              <mat-card-title>{{ test.title }}</mat-card-title>
              <mat-card-subtitle>Курс: {{ getSubjectName(test.subject_id) }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <p class="test-description">{{ test.description }}</p>
              <div class="test-info centered">
                <div class="info-item" *ngIf="test.due_date">
                  <mat-icon>schedule</mat-icon>
                  <span>Дедлайн: {{ test.due_date | russianDate:'datetime' }}</span>
                </div>
              </div>

              <!-- Student Submission Status Badge -->
              <div class="student-status-badge centered" *ngIf="getSubmissionForTest(test.id) as sub">
                <div *ngIf="sub.is_finished === 'false'" class="status-box draft" [class.active-timer]="test.test_type.toLowerCase() !== 'project'">
                  <mat-icon>{{ test.test_type.toLowerCase() === 'project' ? 'edit_note' : 'timer' }}</mat-icon>
                  <span>
                    {{ test.test_type.toLowerCase() === 'project' ? 'В процессе (Черновик)' : 
                       (test.time_limit_minutes ? 'Осталось: ' + (remainingTimes[test.id] || '--:--') : 'Тест в процессе') }}
                  </span>
                </div>
                <ng-container *ngIf="sub.is_finished === 'true'" [ngSwitch]="sub.status">
                  <div *ngSwitchCase="'pending'" class="status-box pending">
                    <mat-icon>hourglass_empty</mat-icon>
                    <span>На проверке <ng-container *ngIf="test.test_type === 'multiple_choice'">({{ sub.total_score }} / {{ sub.total_max }})</ng-container></span>
                  </div>
                  <div *ngSwitchCase="'approved'" class="status-box approved">
                    <mat-icon>check_circle</mat-icon>
                    <span>Завершено: {{ sub.total_score }} / {{ sub.total_max }}</span>
                  </div>
                  <div *ngSwitchCase="'rejected'" class="status-box rejected">
                    <mat-icon>error</mat-icon>
                    <span>Отклонено: {{ sub.teacher_feedback || 'Нужно доработать' }}</span>
                  </div>
                </ng-container>
              </div>
            </mat-card-content>
            <mat-card-actions class="test-actions">
              <!-- Actions for everyone -->
              <ng-container *ngIf="getSubmissionForTest(test.id) as sub; else noSub">
                <button 
                  *ngIf="sub.is_finished === 'false' || sub.is_finished === false"
                  mat-button 
                  [routerLink]="['/tests', test.id]" 
                  [queryParams]="{source: 'tests'}"
                  [disabled]="isTestExpired(test)"
                  class="action-btn main-action">
                  <mat-icon>{{ isTestExpired(test) ? 'timer_off' : 'play_arrow' }}</mat-icon>
                  {{ isTestExpired(test) ? 'Дедлайн прошел' : 'Пройти тест' }}
                </button>

                <button 
                  *ngIf="(sub.is_finished === 'true' || sub.is_finished === true) && sub.status === 'rejected'"
                  mat-button 
                  [routerLink]="['/tests', test.id]" 
                  [queryParams]="{source: 'tests'}"
                  [disabled]="isTestExpired(test)"
                  class="action-btn main-action">
                  <mat-icon>refresh</mat-icon>
                  Исправить
                </button>

                <button 
                  *ngIf="(sub.is_finished === 'true' || sub.is_finished === true) && sub.status !== 'rejected'"
                  mat-stroked-button 
                  [routerLink]="['/submissions', sub.id, 'results']" 
                  class="action-btn secondary-action">
                  <mat-icon>visibility</mat-icon>
                  Просмотреть
                </button>
              </ng-container>

              <ng-template #noSub>
                <button 
                  mat-button 
                  [routerLink]="['/tests', test.id]" 
                  [queryParams]="{source: 'tests'}"
                  [disabled]="isTestExpired(test)"
                  class="action-btn main-action">
                  <mat-icon>{{ isTestExpired(test) ? 'timer_off' : 'play_arrow' }}</mat-icon>
                  {{ isTestExpired(test) ? 'Дедлайн прошел' : 'Пройти тест' }}
                </button>
              </ng-template>

              <!-- Additional actions for teachers -->
              <div class="teacher-actions" *ngIf="isTeacher">
                <button mat-icon-button color="primary" (click)="editTest(test.id)" matTooltip="Редактировать">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deleteTest(test.id)" matTooltip="Удалить">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </mat-card-actions>
          </mat-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tests-container {
      min-height: 100%;
    }
    .filters-panel {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      background: white;
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .filters-panel mat-form-field {
      flex: 1;
      min-width: 200px;
    }
    .submissions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }
    .submission-card {
      border-radius: 16px;
      transition: all 0.2s ease;
      border: 1px solid rgba(0,0,0,0.05);
      background: white;
    }
    .submission-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    }
    .submission-card.rejected { border-left: 5px solid #ff5252; }
    .submission-card.approved { border-left: 5px solid #48bb78; }
    .submission-card.pending { border-left: 5px solid #ecc94b; }

    .dashboard-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      background: white;
      padding: 12px 20px;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    .archive-toggle-container {
      margin-bottom: 20px;
    }

    .badge {
      background: #ff5252;
      color: white;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
      margin-left: 8px;
    }

    .management-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }

    .test-management-card {
      border-radius: 16px;
      border: 1px solid rgba(0,0,0,0.05);
      transition: all 0.2s ease;
    }

    .test-management-card:hover {
      box-shadow: 0 8px 20px rgba(0,0,0,0.08);
    }

    .type-badge {
      position: absolute;
      top: 16px;
      right: 16px;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 10px;
      text-transform: uppercase;
    }
    .type-badge.multiple_choice { background: #ebf8ff; color: #3182ce; }
    .type-badge.keyword_based { background: #faf5ff; color: #805ad5; }
    .type-badge.project { background: #f0fff4; color: #38a169; }

    .test-stats {
      display: flex;
      gap: 24px;
      margin: 16px 0;
    }
    .stat {
      display: flex;
      flex-direction: column;
    }
    .stat-value {
      font-size: 18px;
      font-weight: 600;
      color: #2d3748;
    }
    .stat-label {
      font-size: 12px;
      color: #718096;
    }

    .management-actions {
      border-top: 1px solid #edf2f7;
      padding: 8px 16px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .student-avatar {
      background: #3f51b5;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      border-radius: 50%;
    }
    .submission-details {
      margin: 12px 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .detail-row {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #666;
      font-size: 14px;
    }
    .detail-row mat-icon { font-size: 18px; width: 18px; height: 18px; color: #999; }
    
    .version-badge {
      font-size: 11px;
      background: #e3f2fd;
      color: #1976d2;
      padding: 2px 8px;
      border-radius: 10px;
      width: fit-content;
    }
    .card-actions {
      justify-content: space-between;
      padding: 8px 16px;
    }
    .status-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-label.pending { color: #ff9800; }
    .status-label.approved { color: #4caf50; }
    .status-label.rejected { color: #f44336; }

    /* Keep old styles for student view */
    .tests-content { max-width: 1200px; margin: 0 auto; }
    .page-header { margin-bottom: 32px; }
    .page-title { font-size: 32px; font-weight: 600; color: #1a237e; text-align: center; }
    .page-subtitle { text-align: center; color: #666; margin-top: -8px; }
    .tests-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 24px; }
    .test-card { 
      border-radius: 20px; 
      box-shadow: 0 10px 30px rgba(0,0,0,0.05); 
      overflow: hidden;
      border: 1px solid rgba(0,0,0,0.05);
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    .test-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 15px 35px rgba(0,0,0,0.1);
    }
    .test-card.completed {
      background: #fdfdfd;
    }
    .test-type-badge {
      position: absolute;
      top: 16px;
      right: 16px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .test-type-badge.multiple_choice { background: #e3f2fd; color: #1976d2; }
    .test-type-badge.keyword_based { background: #f3e5f5; color: #7b1fa2; }
    .test-type-badge.project { background: #e8f5e9; color: #2e7d32; }

    .student-status-badge {
      margin-top: 16px;
    }
    .status-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
    }
    .status-box mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .status-box.pending { background: #fff3e0; color: #ef6c00; }
    .status-box.approved { background: #e8f5e9; color: #2e7d32; }
    .status-box.rejected { background: #ffebee; color: #c62828; }
    .status-box.draft { background: #e3f2fd; color: #1976d2; border: 1px dashed #1976d2; }

    .test-actions {
      padding: 16px;
      border-top: 1px solid #f0f0f0;
      display: flex;
      gap: 12px;
    }
    .action-btn.main-action {
      flex: 1;
      border-radius: 12px;
      height: 48px;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      color: white;
      font-weight: 600;
      letter-spacing: 0.5px;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
      border: none;
    }
    .action-btn.secondary-action {
      flex: 1;
      border-radius: 12px;
      height: 48px;
      border: 2px solid #6366f1;
      color: #6366f1;
      font-weight: 600;
      background: transparent;
      transition: all 0.3s ease;
    }
    .action-btn.secondary-action:hover {
      background: rgba(99, 102, 241, 0.05);
    }
    .test-card { 
      border-radius: 28px; 
      box-shadow: 0 10px 40px rgba(0,0,0,0.03); 
      overflow: hidden;
      border: 1px solid rgba(0,0,0,0.05);
      background: white;
      transition: all 0.5s cubic-bezier(0.2, 1, 0.3, 1);
    }
    .test-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 50px rgba(0,0,0,0.08);
      border-color: rgba(99, 102, 241, 0.2);
    }
    .test-card mat-card-header {
      padding: 24px 24px 16px;
    }
    .test-card mat-card-title {
      font-size: 20px;
      font-weight: 700;
      color: #1a202c;
      margin-bottom: 4px;
    }
    .test-card mat-card-subtitle {
      font-size: 14px;
      color: #718096;
      font-weight: 500;
    }
    .test-info.centered {
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    .student-status-badge.centered {
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    .test-card mat-card-content {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 120px;
    }
    .test-description {
      color: #4a5568;
      font-size: 15px;
      line-height: 1.6;
      margin: 0 24px 12px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-align: center;
    }
    .test-info {
      background: #f8fafc;
      padding: 16px;
      border-radius: 20px;
      margin: 0 16px 16px;
      display: flex;
      gap: 12px;
    }
    .info-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #64748b;
      font-size: 13px;
      font-weight: 500;
    }
    .info-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .test-type-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 100px;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
    }
    .test-actions {
      padding: 16px 24px 24px !important;
    }
    .student-status-badge {
       margin: 0 24px 16px;
    }
    .status-box {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 16px;
      font-weight: 600;
      font-size: 14px;
    }
    .status-box.approved { background: #ecfdf5; color: #059669; }
    .status-box.pending { background: #fffbeb; color: #d97706; }
    .status-box.rejected { background: #fef2f2; color: #dc2626; }
    .status-box.draft { background: #f1f5f9; color: #475569; }
    .status-box.active-timer {
      background: #eff6ff;
      color: #2563eb;
      border: 1px dashed #bfdbfe;
    }
    @media (max-width: 768px) {
      .tests-container {
        padding: 16px;
      }
      .tests-grid {
        grid-template-columns: 1fr;
      }
      .page-title {
        font-size: 24px;
      }
    }
  `]
})
export class TestsComponent implements OnInit, OnDestroy {
  tests: any[] = [];
  completedByUser: Set<string> = new Set();
  userSubmissions: any[] = [];
  submissions: any[] = [];
  filteredSubmissions: any[] = [];
  subjects: any[] = [];
  isTeacher = false;
  viewMode: 'submissions' | 'management' = 'submissions';
  submissionFilter: 'pending' | 'archive' = 'pending';
  remainingTimes: { [testId: string]: string } = {};
  private timerInterval: any;
  
  filter = {
    subjectId: undefined,
    type: undefined,
    studentName: '',
    status: 'all' as string
  };

  constructor(
    private apiService: ApiService,
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.isTeacher = this.authService.isTeacherOrAdmin(user?.role);
      if (this.isTeacher) {
        this.loadAllSubmissions();
      }
      this.cdr.markForCheck();
    });

    this.loadTests();
    this.loadSubjects(); // Load subjects for everyone to see course names
    this.startCardsTimer();
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTests() {
    this.apiService.getTests().subscribe({
      next: (tests) => {
        this.tests = tests;
        if (!this.isTeacher) {
          this.loadUserSubmissions();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading tests:', err);
        this.cdr.markForCheck();
      }
    });
  }

  loadSubjects() {
    this.apiService.getSubjects().subscribe(s => this.subjects = s);
  }

  loadAllSubmissions() {
    this.apiService.getSubmissions().subscribe({
      next: (subs) => {
        this.submissions = subs.sort((a, b) => new Date(b.finished_at).getTime() - new Date(a.finished_at).getTime());
        this.applyFilters();
      },
      error: (err) => console.error('Error loading all submissions', err)
    });
  }

  applyFilters() {
    this.filteredSubmissions = this.submissions.filter(sub => {
      const matchesSubject = !this.filter.subjectId || this.getTestSubjectId(sub.test_id) === this.filter.subjectId;
      const matchesType = !this.filter.type || this.getTestType(sub.test_id) === this.filter.type;
      const matchesStudent = !this.filter.studentName || sub.user.toLowerCase().includes(this.filter.studentName.toLowerCase());
      
      // Automatic status mapping based on submissionFilter toggle
      let matchesArchive = true;
      if (this.submissionFilter === 'pending') {
        matchesArchive = sub.status === 'pending';
      } else {
        matchesArchive = sub.status === 'approved' || sub.status === 'rejected';
      }
      
      const matchesStatus = this.filter.status === 'all' || sub.status === this.filter.status;
      
      // Hide unfinished drafts from teachers
      const isFinished = sub.is_finished === 'true' || sub.is_finished === true;
      
      return matchesSubject && matchesType && matchesStudent && matchesArchive && matchesStatus && isFinished;
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

  getSubmissionCount(testId: string): number {
    return this.submissions.filter(s => s.test_id === testId).length;
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

  viewSubmission(id: string) {
    this.router.navigate(['/submissions', id]);
  }

  approveSubmission(id: string) {
    if (confirm('Одобрить эту работу?')) {
      this.apiService.updateSubmissionStatus(id, 'approved').subscribe(() => this.loadAllSubmissions());
    }
  }

  rejectSubmission(id: string) {
    const feedback = prompt('Введите причину отклонения:');
    if (feedback !== null) {
      this.apiService.updateSubmissionStatus(id, 'rejected', feedback).subscribe(() => this.loadAllSubmissions());
    }
  }

  loadUserSubmissions() {
    const user = this.auth.getCurrentUser();
    if (!user) return;
    this.apiService.getSubmissions(undefined, user.name).subscribe({
      next: (subs) => {
        // Sort by version descending to always have the latest one first
        this.userSubmissions = subs.sort((a: any, b: any) => (b.version || 0) - (a.version || 0));
        
        // completedByUser should only include tests where the LATEST version is finished and not rejected
        // If the latest is a draft or rejected, it's not "completed" in terms of hiding the take button
        this.completedByUser = new Set();
        const processedTests = new Set();
        this.userSubmissions.forEach(s => {
          if (!processedTests.has(s.test_id)) {
            processedTests.add(s.test_id);
            if ((s.is_finished === 'true' || s.is_finished === true) && s.status !== 'rejected') {
              this.completedByUser.add(s.test_id);
            }
          }
        });

        this.updateRemainingTimes();
      },
      error: (err) => console.error('Error loading user submissions', err)
    });
  }

  private startCardsTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.updateRemainingTimes();
    }, 1000);
  }

  private updateRemainingTimes() {
    const now = new Date().getTime();
    this.userSubmissions.forEach(sub => {
      const test = this.tests.find(t => t.id === sub.test_id);
      if (test && (sub.is_finished === 'false' || sub.is_finished === false) && test.test_type.toLowerCase() !== 'project' && test.time_limit_minutes) {
        // Ensure UTC parsing by adding Z if missing
        const startedAtStr = sub.started_at.endsWith('Z') ? sub.started_at : sub.started_at + 'Z';
        const startedAt = new Date(startedAtStr).getTime();
        const endTime = startedAt + test.time_limit_minutes * 60 * 1000;
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        
        if (remaining > 0) {
          const minutes = Math.floor(remaining / 60);
          const seconds = remaining % 60;
          this.remainingTimes[test.id] = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
          this.remainingTimes[test.id] = '00:00';
        }
      }
    });
  }

  isDraft(testId: string): boolean {
    const sub = this.getSubmissionForTest(testId);
    // Any unfinished submission is effectively in progress
    return !!(sub && (sub.is_finished === 'false' || sub.is_finished === false));
  }

  getSubmissionForTest(testId: string): any {
    return this.userSubmissions.find(s => s.test_id === testId);
  }

  createTest() {
    this.router.navigate(['/tests/create'], { queryParams: { source: 'tests' } });
  }

  editTest(id: string) {
    this.router.navigate(['/tests/edit', id], { queryParams: { source: 'tests' } });
  }

  deleteTest(id: string) {
    if (confirm('Удалить тест?')) {
      this.apiService.deleteTest(id).subscribe({
        next: () => this.loadTests(),
        error: (err) => {
          console.error('Error deleting test:', err);
          alert('Ошибка при удалении теста');
        }
      });
    }
  }

  getTestTypeLabel(type: string): string {
    const t = type?.toLowerCase();
    const labels: any = {
      'multiple_choice': 'Тест',
      'keyword_based': 'Развернутый ответ',
      'project': 'Проект'
    };
    return labels[t] || type;
  }

  isCompleted(testId: string): boolean {
    return this.completedByUser.has(testId);
  }

  isTestExpired(test: any): boolean {
    if (!test.due_date) {
      return false; // Если дедлайн не установлен, тест доступен
    }
    try {
      // Дата хранится в московском времени (формат +03:00)
      // Просто сравниваем напрямую
      const dueDate = new Date(test.due_date);
      const now = new Date();
      
      // Тест недоступен только если дедлайн уже прошел
      return dueDate.getTime() < now.getTime();
    } catch (e) {
      console.error('Error checking test expiration:', e, test);
      return false; // В случае ошибки считаем тест доступным
    }
  }
}

