import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService, CurrentUser } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpEventType } from '@angular/common/http';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatExpansionModule,
    MatDialogModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTooltipModule,
    FormsModule,
    ReactiveFormsModule
  ],
  template: `
    <div class="profile-container" *ngIf="user; else needLogin">
      <div class="profile-header-card">
        <div class="profile-header-content">
          <div class="avatar-section">
            <div class="profile-avatar-wrapper">
              <img [src]="getAvatarUrl(user.avatar_url)" alt="avatar" class="profile-avatar" *ngIf="user.avatar_url" (error)="user.avatar_url = undefined">
              <mat-icon class="profile-avatar-placeholder" *ngIf="!user.avatar_url">person</mat-icon>
              <div class="avatar-overlay" *ngIf="isOwnProfile" (click)="fileInput.click()">
                <mat-icon>photo_camera</mat-icon>
              </div>
            </div>
            <input type="file" #fileInput (change)="onFileSelected($event)" accept="image/*" style="display: none;">
            <mat-progress-bar mode="determinate" [value]="uploadProgress" *ngIf="uploading" style="margin-top: 8px;"></mat-progress-bar>
          </div>

            <div class="user-info-section">
            <div class="name-edit-wrapper" *ngIf="!isEditingName">
              <h1>{{ user.name }}</h1>
              
              <!-- SuperAdmin Toggle Badge -->
              <span class="role-badge super-admin-badge" 
                    [class.clickable]="isOwnProfile"
                    *ngIf="user?.is_hidden_admin" 
                    (click)="isOwnProfile ? toggleRole() : null"
                    [matTooltip]="isOwnProfile ? 'Нажмите, чтобы переключить режим отображения (Админ/Студент)' : ''">
                Администратор
              </span>

              <!-- Regular Role Badge (hidden for SuperAdmin to avoid confusion) -->
              <span class="role-badge" 
                    [class.teacher]="user.role === 'teacher' || user.role === 'instructor' || user.role === 'admin'"
                    *ngIf="!user?.is_hidden_admin">
                {{ user.role === 'admin' ? 'Администратор' : (user.role === 'teacher' || user.role === 'instructor' ? 'Преподаватель' : 'Студент') }}
              </span>

              <button mat-icon-button *ngIf="isOwnProfile" (click)="startEditName()" matTooltip="Изменить имя">
                <mat-icon>edit</mat-icon>
              </button>
            </div>

            <!-- Simulation Indicator -->
            <div class="simulation-hint" *ngIf="user?.is_hidden_admin && user.role === 'student'">
              <mat-icon>visibility</mat-icon>
              <span>Включен режим просмотра от лица студента</span>
            </div>
            
            <button mat-stroked-button *ngIf="isOwnProfile" color="primary" class="feedback-button" (click)="openFeedbackDialog()">
              <mat-icon>feedback</mat-icon>
              Оставить отзыв
            </button>

            <button mat-raised-button *ngIf="isOwnProfile" color="accent" class="notification-trigger-button" (click)="sendTestNotification()" style="margin-left: 8px;">
              <mat-icon>notifications_active</mat-icon>
              Проверить уведомления
            </button>

            
            <div class="name-edit-form" *ngIf="isEditingName">
              <mat-form-field appearance="outline">
                <mat-label>Имя профиля</mat-label>
                <input matInput [(ngModel)]="newName" (keyup.enter)="saveName()">
              </mat-form-field>
              <div class="edit-actions">
                <button mat-button (click)="cancelEditName()">Отмена</button>
                <button mat-raised-button color="primary" (click)="saveName()" [disabled]="!newName.trim() || newName === user.name">Сохранить</button>
              </div>
            </div>

            <div class="user-badges" *ngIf="userGroups.length > 0">
              <span class="group-badge" *ngFor="let group of userGroups">
                {{ group.name }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="profile-grid" *ngIf="isOwnProfile || user.role === 'student'">
        <div class="main-column">
          <section class="submissions-section">
            <div class="section-header">
              <mat-icon>assignment</mat-icon>
              <h2>{{ isOwnProfile ? 'Мои сдачи' : 'Оценки студента' }}</h2>
            </div>
            
            <div *ngIf="submissions.length === 0" class="empty-state">
              <mat-icon>assignment_late</mat-icon>
              <p>Пока нет сдач. Пройдите тест, чтобы увидеть результаты.</p>
            </div>

            <div class="submission-cards">
              <mat-card *ngFor="let s of submissions" class="submission-card">
                <mat-card-header>
                  <mat-card-title>{{ getTestName(s.test_id) || s.test_id }}</mat-card-title>
                  <mat-card-subtitle>Дата: {{ s.finished_at | date:'dd.MM.yyyy HH:mm' }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="score-display">
                    <div class="score-circle" [class.excellent]="(s.total_score/s.total_max) >= 0.8" [class.good]="(s.total_score/s.total_max) >= 0.5">
                      <span class="score-value">{{ s.total_score }}</span>
                      <span class="score-max">/ {{ s.total_max }}</span>
                    </div>
                    <div class="score-label">Общий балл</div>
                  </div>
                </mat-card-content>
                <mat-card-actions align="end" *ngIf="isOwnProfile || isTeacherOrAdmin">
                  <button mat-button color="primary" [routerLink]="['/submissions', s.id, 'results']">
                    ПОДРОБНЕЕ
                  </button>
                </mat-card-actions>
              </mat-card>
            </div>
          </section>

          <section class="reviews-section" *ngIf="isOwnProfile || isTeacherOrAdmin">
            <div class="section-header">
              <mat-icon>rate_review</mat-icon>
              <h2>{{ isOwnProfile ? 'Мои оценки' : 'Отзывы о студенте' }}</h2>
            </div>
            
            <mat-card class="filter-card">
              <mat-card-content>
                <div class="filter-row">
                  <mat-form-field appearance="outline">
                    <mat-label>Курс</mat-label>
                    <mat-select [(ngModel)]="selectedSubjectFilter" (selectionChange)="onFilterChange()">
                      <mat-option [value]="null">Все курсы</mat-option>
                      <mat-option *ngFor="let subject of subjects" [value]="subject.id">{{ subject.name }}</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Тест</mat-label>
                    <mat-select [(ngModel)]="selectedTestFilter" (selectionChange)="onFilterChange()" [disabled]="!selectedSubjectFilter">
                      <mat-option [value]="null">Все тесты</mat-option>
                      <mat-option *ngFor="let test of filteredTests" [value]="test.id">{{ test.title }}</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
              </mat-card-content>
            </mat-card>

            <div *ngIf="filteredReviews.length === 0" class="empty-state small">
              <p>У вас пока нет полученных отзывов</p>
            </div>
            
            <mat-expansion-panel *ngFor="let review of filteredReviews" class="review-panel">
              <mat-expansion-panel-header>
                <mat-panel-title>Отзыв от {{ review.reviewer }}</mat-panel-title>
                <mat-panel-description>
                  <span class="avg-score">Средняя оценка: {{ review.avg_score }} / 5</span>
                </mat-panel-description>
              </mat-expansion-panel-header>
              <div class="review-details">
                <div class="rating-grid">
                  <div class="rating-item"><label>Соответствие:</label> <span>{{ review.relevance }} / 5</span></div>
                  <div class="rating-item"><label>Логика:</label> <span>{{ review.structure }} / 5</span></div>
                  <div class="rating-item"><label>Аргументация:</label> <span>{{ review.argument }} / 5</span></div>
                  <div class="rating-item"><label>Ясность:</label> <span>{{ review.clarity }} / 5</span></div>
                </div>
                <div class="comment-box" *ngIf="review.comment">
                  <strong>Комментарий:</strong> {{ review.comment }}
                </div>
              </div>
            </mat-expansion-panel>
          </section>
        </div>

        <div class="side-column">
          <mat-card class="actions-card" *ngIf="false">
            <!-- Premium functions removed -->
          </mat-card>

          <mat-card class="stats-summary-card">
            <mat-card-header>
              <mat-card-title>Статистика</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="stat-item">
                <span class="stat-label">Всего сдач:</span>
                <span class="stat-value">{{ submissions.length }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Отзывов:</span>
                <span class="stat-value">{{ myReviews.length }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Групп:</span>
                <span class="stat-value">{{ userGroups.length }}</span>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </div>
    </div>

    <ng-template #needLogin>
      <div class="login-required">
        <mat-icon class="large-icon">lock</mat-icon>
        <h2>Доступ ограничен</h2>
        <p>Пожалуйста, войдите в систему, чтобы увидеть свой профиль.</p>
        <div class="login-actions">
          <button mat-raised-button color="primary" routerLink="/login">Войти</button>
          <button mat-button color="accent" routerLink="/register">Регистрация</button>
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    .profile-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0;
    }
    .profile-header-card {
      background: white;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 32px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    }
    .profile-header-content {
      display: flex;
      gap: 32px;
      align-items: center;
    }
    .profile-avatar-wrapper {
      position: relative;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: #f0f2f5;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 4px solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .profile-avatar {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .profile-avatar-placeholder {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #adb5bd;
    }
    .avatar-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 40%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .profile-avatar-wrapper:hover .avatar-overlay {
      opacity: 1;
    }
    .user-info-section h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 600;
      color: #2D3436;
    }
    .name-edit-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .name-edit-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .edit-actions {
      display: flex;
      gap: 8px;
    }
    .user-badges {
      margin-top: 12px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .group-badge {
      background: #E3F2FD;
      color: #1976D2;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
    }
    .role-badge {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 12px;
      background: #eee;
      color: #666;
      margin-left: 8px;
      text-transform: uppercase;
      font-weight: bold;
    }
    .role-badge.teacher {
      background: #e8f5e9;
      color: #2e7d32;
    }
    
    .super-admin-badge {
      background: #ffebee;
      color: #d32f2f;
      border: 1px solid rgba(211, 47, 47, 0.2);
    }

    .clickable {
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .clickable:hover {
      background: #ffcdd2;
      transform: translateY(-1px);
      box-shadow: 0 2px 5px rgba(211, 47, 47, 0.2);
    }

    .simulation-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      color: #d32f2f;
      font-size: 13px;
      font-weight: 500;
    }

    .simulation-hint mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    
    .name-edit-wrapper h1 {
      margin: 0;
    }
    .profile-grid {
      display: flex;
      gap: 32px;
    }
    .main-column {
      flex: 1;
    }
    .side-column {
      width: 300px;
    }
    .section-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .section-header mat-icon {
      color: #3f51b5;
    }
    .section-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
    }
    .submission-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .submission-card {
      border-radius: 12px;
      transition: transform 0.3s, box-shadow 0.3s;
    }
    .submission-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    }
    .score-display {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 0;
    }
    .score-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      border: 4px solid #eee;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }
    .score-circle.excellent { border-color: #4CAF50; color: #4CAF50; }
    .score-circle.good { border-color: #FFC107; color: #FFC107; }
    .score-value { font-size: 24px; font-weight: 700; }
    .score-max { font-size: 12px; opacity: 0.7; }
    .score-label { font-size: 13px; color: #666; }
    
    .filter-card {
      margin-bottom: 20px;
      border-radius: 12px;
    }
    .filter-row {
      display: flex;
      gap: 16px;
    }
    .review-panel {
      margin-bottom: 12px;
      border-radius: 12px !important;
      overflow: hidden;
      box-shadow: none !important;
      border: 1px solid #eee;
    }
    .rating-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .rating-item {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
    }
    .rating-item label { color: #666; }
    .rating-item span { font-weight: 500; }
    .comment-box {
      padding: 12px;
      background: #f8f9fa;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.5;
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #999;
      background: white;
      border-radius: 16px;
      border: 2px dashed #eee;
    }
    .empty-state.small { padding: 30px 20px; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5; }
    
    .actions-card, .stats-summary-card {
      margin-bottom: 24px;
      border-radius: 16px;
    }
    .full-width { width: 100%; }
    .stat-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .stat-label { color: #666; }
    .stat-value { font-weight: 600; color: #3f51b5; }
    .login-required {
      text-align: center;
      padding: 100px 20px;
    }
    .large-icon { font-size: 80px; width: 80px; height: 80px; color: #3f51b5; margin-bottom: 24px; }
  `]
})
export class ProfileComponent implements OnInit {
  user: CurrentUser | null = null;
  submissions: any[] = [];
  myReviews: any[] = [];
  filteredReviews: any[] = [];
  subjects: any[] = [];
  tests: any[] = [];
  filteredTests: any[] = [];
  selectedSubjectFilter: string | null = null;
  selectedTestFilter: string | null = null;
  userGroups: any[] = [];
  isOwnProfile = true;

  // Edit states
  isEditingName = false;
  newName = '';
  uploading = false;
  uploadProgress = 0;

  constructor(
    private auth: AuthService,
    private api: ApiService,
    private dialog: MatDialog,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  getAvatarUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/static')) return `/api${url}`;
    if (url.startsWith('/api/')) return url;
    return `/api/${url}`;
  }

  get isTeacherOrAdmin(): boolean {
    const role = this.auth.getCurrentUser()?.role;
    return role === 'teacher' || role === 'admin';
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const usernameParam = params['username'];
      this.refreshUser();
      
      this.auth.currentUser$.subscribe(currentUser => {
        if (!currentUser) return;
        
        if (usernameParam && usernameParam !== currentUser.name) {
          this.isOwnProfile = false;
          this.api.getUserByName(usernameParam).subscribe({
            next: (userData) => {
              const role = userData.role === 'instructor' ? 'teacher' : userData.role;
              this.user = {
                id: userData.id,
                name: userData.name,
                avatar_url: userData.avatar_url,
                role: role
              };
              
              if (role === 'student') {
                this.loadSubmissions(usernameParam);
                this.loadUserGroups(usernameParam);
                this.loadMyReviews(usernameParam);
                this.loadSubjects();
                this.loadAllTests();
              } else {
                this.submissions = [];
                this.userGroups = [];
                this.myReviews = [];
                this.filteredReviews = [];
              }
            },
            error: (err) => {
              console.error('Error loading user profile:', err);
              this.snackBar.open('Пользователь не найден', 'OK', { duration: 3000 });
              this.router.navigate(['/']);
            }
          });
        } else {
          this.isOwnProfile = true;
          this.user = currentUser;
          
          // Для собственного профиля загружаем все данные независимо от роли
          this.loadSubmissions(currentUser.name);
          this.loadUserGroups(currentUser.name);
          this.loadMyReviews(currentUser.name);
          this.loadSubjects();
          this.loadAllTests();
        }
      });
    });
  }

  refreshUser(): void {
    const currentUser = this.auth.getCurrentUser();
    if (currentUser) {
      // Use central sync instead of manual assignment to avoid conflicts with role simulation
      this.auth.syncUserWithBackend().subscribe({
        next: (userData) => {
          // Update local storage if different (name/avatar)
          const stored = localStorage.getItem('eduai-current-user');
          if (stored) {
            const storedUser = JSON.parse(stored);
            if (storedUser.name !== userData.username || storedUser.avatar_url !== userData.avatar_url) {
              this.refreshAuthUser();
            }
          }
        }
      });
    }
  }

  startEditName(): void {
    if (this.user) {
      this.newName = this.user.name;
      this.isEditingName = true;
    }
  }

  cancelEditName(): void {
    this.isEditingName = false;
  }

  saveName(): void {
    if (!this.user || !this.newName.trim() || this.newName === this.user.name) {
      this.isEditingName = false;
      return;
    }

    this.api.updateUser(this.user.id, { name: this.newName.trim() }).subscribe({
      next: (updatedUser) => {
        this.isEditingName = false;
        this.snackBar.open('Имя успешно обновлено', 'OK', { duration: 3000 });
        // Sync global state to reflect change across app
        this.auth.syncUserWithBackend().subscribe(() => {
          this.refreshAuthUser();
        });
      },
      error: (err) => {
        this.snackBar.open('Ошибка при обновлении имени: ' + (err.error?.detail || 'Неизвестная ошибка'), 'OK', { duration: 5000 });
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);

      this.uploading = true;
      this.uploadProgress = 0;
      this.api.uploadAvatar(this.user!.id, formData).subscribe({
        next: (response: any) => {
          this.uploading = false;
          this.snackBar.open('Аватар успешно обновлен', 'OK', { duration: 3000 });
          // Sync global state to reflect change
          this.auth.syncUserWithBackend().subscribe(() => {
            this.refreshAuthUser();
          });
        },
        error: (err) => {
          this.uploading = false;
          this.snackBar.open('Ошибка при загрузке аватара', 'OK', { duration: 5000 });
        }
      });
    }
  }

  toggleRole() {
    this.auth.toggleSimulationRole();
  }

  get isSimulationActive(): boolean {
    return this.auth.getSimulationRole() === 'student';
  }

  private refreshAuthUser(): void {
    if (this.user) {
      localStorage.setItem('eduai-current-user', JSON.stringify(this.user));
      // Trigger update in all components observing currentUser
      (this.auth as any).currentUserSubject.next(this.user);
    }
  }

  loadUserGroups(username?: string) {
    const targetUser = username || this.user?.name;
    if (!targetUser) return;
    this.api.getGroups(undefined, targetUser).subscribe({
      next: (groups) => {
        this.userGroups = groups;
      },
      error: (err) => console.error('Error loading user groups:', err)
    });
  }

  getSubjectName(subjectId: string): string {
    const subject = this.subjects.find(s => s.id === subjectId);
    return subject ? subject.name : 'Неизвестный курс';
  }

  loadSubmissions(username?: string) {
    const targetUser = username || this.user?.name;
    if (!targetUser) return;
    this.api.getSubmissions(undefined, targetUser).subscribe({
      next: (subs) => (this.submissions = subs),
      error: (err) => console.error('Error loading submissions', err)
    });
  }

  loadSubjects() {
    this.api.getSubjects().subscribe({
      next: (subjects) => {
        this.subjects = subjects;
      },
      error: (err) => console.error('Error loading subjects:', err)
    });
  }

  loadAllTests() {
    // Загружаем все тесты для фильтрации отзывов
    this.api.getTests().subscribe({
      next: (tests) => {
        this.tests = tests;
        this.updateFilteredTests();
      },
      error: (err) => console.error('Error loading tests:', err)
    });
  }

  updateFilteredTests() {
    if (this.selectedSubjectFilter) {
      this.filteredTests = this.tests.filter(t => t.subject_id === this.selectedSubjectFilter);
    } else {
      this.filteredTests = this.tests;
    }
  }

  loadMyReviews(username?: string) {
    const targetUser = username || this.user?.name;
    if (!targetUser) return;

    // Загружаем все отзывы для пользователя (без фильтра по тесту)
    this.api.getMyReviews(targetUser).subscribe({
      next: (reviews) => {
        this.myReviews = reviews;
        this.applyFilters();
      },
      error: (err) => {
        console.error('Error loading my reviews:', err);
        this.myReviews = [];
        this.filteredReviews = [];
      }
    });
  }

  onFilterChange() {
    this.updateFilteredTests();
    // Сбрасываем фильтр по тесту если он не относится к выбранному предмету
    if (this.selectedSubjectFilter && this.selectedTestFilter) {
      const test = this.tests.find(t => t.id === this.selectedTestFilter);
      if (!test || test.subject_id !== this.selectedSubjectFilter) {
        this.selectedTestFilter = null;
      }
    }
    this.applyFilters();
  }

  applyFilters() {
    this.filteredReviews = this.myReviews.filter(review => {
      // Фильтр по тесту
      if (this.selectedTestFilter && review.assignment_id !== this.selectedTestFilter) {
        return false;
      }

      // Фильтр по курсу (через тест)
      if (this.selectedSubjectFilter) {
        const test = this.tests.find(t => t.id === review.assignment_id);
        if (!test || test.subject_id !== this.selectedSubjectFilter) {
          return false;
        }
      }

      return true;
    });
  }

  getTestName(testId: string): string {
    const test = this.tests.find(t => t.id === testId);
    return test ? test.title : '';
  }

  openFeedbackDialog() {
    const dialogRef = this.dialog.open(FeedbackDialogComponent, {
      width: '600px',
      data: { user: this.user }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.api.createFeedback(result).subscribe({
          next: () => {
            alert('Спасибо за ваш отзыв!');
          },
          error: (err) => {
            console.error('Error submitting feedback:', err);
            alert('Ошибка при отправке отзыва');
          }
        });
      }
    });
  }

  sendTestNotification() {
    if (!this.user) return;
    const testNotification = {
      user_name: this.user.name,
      title: 'Тестовое уведомление',
      message: 'Система уведомлений работает корректно! Это сообщение отправлено для проверки.',
      type: 'info'
    };
    this.api.createNotification(testNotification).subscribe({
      next: () => {
        this.snackBar.open('Тестовое уведомление успешно отправлено! Проверьте колокольчик в шапке.', 'OK', { duration: 5000 });
      },
      error: (err) => {
        console.error('Error sending test notification:', err);
        this.snackBar.open('Ошибка при отправке тестового уведомления: ' + (err.error?.detail || 'Неизвестная ошибка'), 'OK', { duration: 5000 });
      }
    });
  }
}

@Component({
  selector: 'app-feedback-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>Обратная связь</h2>
    <mat-dialog-content>
      <form [formGroup]="feedbackForm">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Курс (опционально)</mat-label>
          <mat-select formControlName="subject_id">
            <mat-option [value]="null">Не выбран</mat-option>
            <mat-option *ngFor="let subject of subjects" [value]="subject.id">
              {{ subject.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Оценка качества обучения (1-5)</mat-label>
          <mat-select formControlName="quality_rating" required>
            <mat-option [value]="1">1 - Плохо</mat-option>
            <mat-option [value]="2">2 - Ниже среднего</mat-option>
            <mat-option [value]="3">3 - Средне</mat-option>
            <mat-option [value]="4">4 - Хорошо</mat-option>
            <mat-option [value]="5">5 - Отлично</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Оценка содержания курса (1-5)</mat-label>
          <mat-select formControlName="content_rating" required>
            <mat-option [value]="1">1 - Плохо</mat-option>
            <mat-option [value]="2">2 - Ниже среднего</mat-option>
            <mat-option [value]="3">3 - Средне</mat-option>
            <mat-option [value]="4">4 - Хорошо</mat-option>
            <mat-option [value]="5">5 - Отлично</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Оценка материалов (1-5)</mat-label>
          <mat-select formControlName="materials_rating" required>
            <mat-option [value]="1">1 - Плохо</mat-option>
            <mat-option [value]="2">2 - Ниже среднего</mat-option>
            <mat-option [value]="3">3 - Средне</mat-option>
            <mat-option [value]="4">4 - Хорошо</mat-option>
            <mat-option [value]="5">5 - Отлично</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Оценка поддержки (1-5)</mat-label>
          <mat-select formControlName="support_rating" required>
            <mat-option [value]="1">1 - Плохо</mat-option>
            <mat-option [value]="2">2 - Ниже среднего</mat-option>
            <mat-option [value]="3">3 - Средне</mat-option>
            <mat-option [value]="4">4 - Хорошо</mat-option>
            <mat-option [value]="5">5 - Отлично</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Комментарии (опционально)</mat-label>
          <textarea matInput formControlName="comment" rows="4"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Предложения по улучшению (опционально)</mat-label>
          <textarea matInput formControlName="suggestions" rows="4"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Отмена</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="!feedbackForm.valid">
        Отправить
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }
    mat-dialog-content {
      min-width: 500px;
      padding-top: 16px;
    }
    mat-dialog-actions {
      padding: 16px 24px;
    }
  `]
})
export class FeedbackDialogComponent {
  feedbackForm: FormGroup;
  subjects: any[] = [];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<FeedbackDialogComponent>,
    private apiService: ApiService,
    @Inject(MAT_DIALOG_DATA) public dialogData: any
  ) {
    this.feedbackForm = this.fb.group({
      subject_id: [null],
      quality_rating: [null, Validators.required],
      content_rating: [null, Validators.required],
      materials_rating: [null, Validators.required],
      support_rating: [null, Validators.required],
      comment: [''],
      suggestions: ['']
    });

    this.loadSubjects();
  }

  loadSubjects() {
    this.apiService.getSubjects().subscribe({
      next: (subjects) => {
        this.subjects = subjects;
      },
      error: (err) => console.error('Error loading subjects:', err)
    });
  }

  save() {
    if (this.feedbackForm.valid) {
      const formValue = this.feedbackForm.value;
      const feedback = {
        user_name: this.dialogData.user.name,
        subject_id: formValue.subject_id || null,
        group_id: null,
        quality_rating: formValue.quality_rating,
        content_rating: formValue.content_rating,
        materials_rating: formValue.materials_rating,
        support_rating: formValue.support_rating,
        comment: formValue.comment || null,
        suggestions: formValue.suggestions || null
      };
      this.dialogRef.close(feedback);
    }
  }

  cancel() {
    this.dialogRef.close();
  }
}

