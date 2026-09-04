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
      <!-- Hero Card профиля -->
      <div class="profile-hero-card glass-panel">
        <div class="profile-header-content">
          <div class="avatar-section">
            <div class="profile-avatar-wrapper">
              <img [src]="getAvatarUrl(user.avatar_url)" 
                   alt="avatar" 
                   class="profile-avatar" 
                   *ngIf="user.avatar_url && !avatarError" 
                   (error)="avatarError = true" 
                   referrerpolicy="no-referrer">
              
              <!-- Монограмма с инициалами при отсутствии фото -->
              <div class="profile-monogram" *ngIf="!user.avatar_url || avatarError">
                {{ getUserInitials(user.name) }}
              </div>

              <div class="avatar-overlay" *ngIf="isOwnProfile" (click)="fileInput.click()" matTooltip="Загрузить фото">
                <mat-icon>photo_camera</mat-icon>
              </div>
            </div>
            <input type="file" #fileInput (change)="onFileSelected($event)" accept="image/*" style="display: none;">
            <mat-progress-bar mode="determinate" [value]="uploadProgress" *ngIf="uploading" class="upload-bar"></mat-progress-bar>
          </div>

          <div class="user-info-section">
            <div class="name-edit-wrapper" *ngIf="!isEditingName">
              <h1 class="profile-user-name">{{ user.name }}</h1>
              
              <!-- SuperAdmin Toggle Badge -->
              <span class="role-badge super-admin-badge" 
                    [class.clickable]="isOwnProfile"
                    *ngIf="user?.is_hidden_admin" 
                    (click)="isOwnProfile ? toggleRole() : null"
                    [matTooltip]="isOwnProfile ? 'Нажмите, чтобы переключить режим отображения (Админ/Студент)' : ''">
                Администратор
              </span>

              <!-- Regular Role Badge -->
              <span class="role-badge" 
                    [class.teacher]="user.role === 'teacher' || user.role === 'instructor' || user.role === 'admin'"
                    *ngIf="!user?.is_hidden_admin">
                {{ user.role === 'admin' ? 'Администратор' : (user.role === 'teacher' || user.role === 'instructor' ? 'Преподаватель' : 'Студент') }}
              </span>

              <button type="button" class="btn-icon-subtle" *ngIf="isOwnProfile" (click)="startEditName()" matTooltip="Изменить имя">
                <mat-icon>edit</mat-icon>
              </button>
            </div>

            <!-- Редактирование имени -->
            <div class="name-edit-form" *ngIf="isEditingName">
              <mat-form-field appearance="outline" class="edit-name-field">
                <mat-label>Имя профиля</mat-label>
                <input matInput [(ngModel)]="newName" (keyup.enter)="saveName()">
              </mat-form-field>
              <div class="edit-actions">
                <button type="button" class="btn-outline-pill" (click)="cancelEditName()">Отмена</button>
                <button type="button" class="btn-solid-pill" (click)="saveName()" [disabled]="!newName.trim() || newName === user.name">Сохранить</button>
              </div>
            </div>

            <!-- Индикатор симуляции роли -->
            <div class="simulation-hint" *ngIf="user?.is_hidden_admin && user.role === 'student'">
              <mat-icon>visibility</mat-icon>
              <span>Включен режим просмотра от лица студента</span>
            </div>
            
            <!-- Кнопки действий -->
            <div class="user-actions-row" *ngIf="isOwnProfile">
              <button type="button" class="btn-profile-pill" (click)="openFeedbackDialog()">
                <mat-icon>feedback</mat-icon>
                <span>Оставить отзыв</span>
              </button>

              <button type="button" class="btn-profile-pill" (click)="sendTestNotification()">
                <mat-icon>notifications_active</mat-icon>
                <span>Проверить уведомления</span>
              </button>

              <button type="button" *ngIf="user && (user.is_hidden_admin || user.role === 'admin')" 
                      class="btn-profile-pill"
                      (click)="toggleInvisibility()">
                <mat-icon>{{ user.is_hidden_admin ? 'visibility_off' : 'visibility' }}</mat-icon>
                <span>{{ user.is_hidden_admin ? 'Отключить невидимость' : 'Включить невидимость' }}</span>
              </button>
            </div>

            <!-- Бейджи групп -->
            <div class="user-badges" *ngIf="userGroups.length > 0">
              <span class="group-pill-badge" *ngFor="let group of userGroups">
                {{ group.name }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Карточка учебных групп -->
      <div class="student-group-card glass-panel" *ngIf="userGroups.length > 0">
        <div class="group-card-header">
          <div class="group-icon-circle">
            <mat-icon>groups</mat-icon>
          </div>
          <div>
            <h3 class="section-card-title">Учебные группы</h3>
            <p class="section-card-sub">Группы, в которых вы состоите</p>
          </div>
        </div>
        <div class="profile-group-list">
          <div *ngFor="let group of userGroups" class="profile-group-item">
            <div class="group-name-wrapper">
              <mat-icon>school</mat-icon>
              <span class="group-name-text">{{ group.name }}</span>
            </div>
            <span class="group-role-badge">Студент</span>
          </div>
        </div>
      </div>

      <!-- Сетка профиля -->
      <div class="profile-grid" *ngIf="isOwnProfile || user.role === 'student'">
        <!-- Основная колонка -->
        <div class="main-column">
          <!-- Секция: Мои сдачи -->
          <section class="submissions-section">
            <div class="section-title-bar">
              <mat-icon class="section-icon">assignment</mat-icon>
              <h2 class="section-heading">{{ isOwnProfile ? 'Мои сдачи' : 'Оценки студента' }}</h2>
            </div>
            
            <div *ngIf="submissions.length === 0" class="empty-state-card glass-panel">
              <mat-icon>assignment_late</mat-icon>
              <p>Пока нет сдач. Пройдите тест, чтобы увидеть результаты.</p>
            </div>

            <div class="submission-cards">
              <div *ngFor="let s of submissions" class="submission-card glass-panel">
                <div class="subm-header">
                  <h4 class="subm-title">{{ getTestName(s.test_id) || s.test_id }}</h4>
                  <span class="subm-date">Дата: {{ s.finished_at | date:'dd.MM.yyyy HH:mm' }}</span>
                </div>
                
                <div class="score-display">
                  <div class="score-circle" [class.excellent]="(s.total_score/s.total_max) >= 0.8" [class.good]="(s.total_score/s.total_max) >= 0.5">
                    <span class="score-value">{{ s.total_score }}</span>
                    <span class="score-max">/ {{ s.total_max }}</span>
                  </div>
                  <div class="score-label">Общий балл</div>
                </div>

                <div class="subm-actions" *ngIf="isOwnProfile || isTeacherOrAdmin">
                  <a class="btn-subm-details" [routerLink]="['/submissions', s.id, 'results']">
                    <span>ПОДРОБНЕЕ</span>
                    <mat-icon>arrow_forward</mat-icon>
                  </a>
                </div>
              </div>
            </div>
          </section>

          <!-- Секция: Мои оценки -->
          <section class="reviews-section" *ngIf="isOwnProfile || isTeacherOrAdmin">
            <div class="section-title-bar">
              <mat-icon class="section-icon">rate_review</mat-icon>
              <h2 class="section-heading">{{ isOwnProfile ? 'Мои оценки' : 'Отзывы о студенте' }}</h2>
            </div>
            
            <div class="filter-card glass-panel">
              <div class="filter-row">
                <mat-form-field appearance="outline" class="select-field">
                  <mat-label>Курс</mat-label>
                  <mat-select [(ngModel)]="selectedSubjectFilter" (selectionChange)="onFilterChange()">
                    <mat-option [value]="null">Все курсы</mat-option>
                    <mat-option *ngFor="let subject of subjects" [value]="subject.id">{{ subject.name }}</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="select-field">
                  <mat-label>Тест</mat-label>
                  <mat-select [(ngModel)]="selectedTestFilter" (selectionChange)="onFilterChange()" [disabled]="!selectedSubjectFilter">
                    <mat-option [value]="null">Все тесты</mat-option>
                    <mat-option *ngFor="let test of filteredTests" [value]="test.id">{{ test.title }}</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
            </div>

            <div *ngIf="filteredReviews.length === 0" class="empty-state-card glass-panel small">
              <p>У вас пока нет полученных отзывов</p>
            </div>
            
            <mat-expansion-panel *ngFor="let review of filteredReviews" class="review-panel glass-panel">
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

        <!-- Правая колонка: Статистика -->
        <div class="side-column">
          <div class="stats-card glass-panel">
            <h3 class="stats-heading">Статистика</h3>
            <div class="stat-row">
              <span class="stat-label">Всего сдач:</span>
              <span class="stat-value">{{ submissions.length }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Отзывов:</span>
              <span class="stat-value">{{ myReviews.length }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Групп:</span>
              <span class="stat-value">{{ userGroups.length }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ng-template #needLogin>
      <div class="login-required glass-panel">
        <mat-icon class="large-icon">lock</mat-icon>
        <h2>Доступ ограничен</h2>
        <p>Пожалуйста, войдите в систему, чтобы увидеть свой профиль.</p>
        <div class="login-actions">
          <button mat-raised-button color="primary" routerLink="/login">Войти</button>
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    .profile-container {
      max-width: 1160px;
      margin: 0 auto;
      padding: 16px 24px 48px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-sizing: border-box;
    }

    /* Glassmorphism панели */
    .glass-panel {
      background: rgba(255, 255, 255, 0.76);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 18px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.04);
      box-sizing: border-box;
    }

    /* Hero Card */
    .profile-hero-card {
      padding: 32px;
      margin-bottom: 28px;
    }

    .profile-header-content {
      display: flex;
      gap: 28px;
      align-items: center;
      flex-wrap: wrap;
    }

    .avatar-section {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .profile-avatar-wrapper {
      position: relative;
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: #f4f4f5;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 2px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    }

    .profile-avatar {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .profile-monogram {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', sans-serif;
      font-size: 32px;
      font-weight: 600;
      color: #18181b;
      background: #f4f4f5;
      letter-spacing: 0.02em;
    }

    .avatar-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s ease;
      border-radius: 50%;
    }

    .profile-avatar-wrapper:hover .avatar-overlay {
      opacity: 1;
    }

    .upload-bar {
      width: 96px;
      margin-top: 8px;
      border-radius: 4px;
    }

    .user-info-section {
      flex: 1;
      min-width: 280px;
    }

    .name-edit-wrapper {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .profile-user-name {
      margin: 0;
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 32px;
      font-weight: 400;
      color: #18181b;
      line-height: 1.15;
    }

    .role-badge {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 12px;
      background: #f4f4f5;
      border: 1px solid rgba(0, 0, 0, 0.06);
      color: #52525b;
    }

    .role-badge.teacher {
      background: rgba(34, 197, 94, 0.1);
      color: #15803d;
      border-color: rgba(34, 197, 94, 0.2);
    }

    .super-admin-badge {
      background: #18181b;
      color: #fff;
      border-color: #18181b;
    }

    .clickable {
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .clickable:hover {
      opacity: 0.85;
      transform: translateY(-1px);
    }

    .btn-icon-subtle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: #71717a;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-icon-subtle:hover {
      background: rgba(0, 0, 0, 0.06);
      color: #18181b;
    }

    .btn-icon-subtle mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .simulation-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      color: #ef4444;
      font-size: 12px;
      font-weight: 500;
    }

    .simulation-hint mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .user-actions-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 18px;
      flex-wrap: wrap;
    }

    .btn-profile-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 16px;
      border-radius: 20px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      background: #fff;
      color: #3f3f46;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-profile-pill:hover {
      background: #fafafa;
      border-color: rgba(0, 0, 0, 0.25);
    }

    .btn-profile-pill mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #52525b;
    }

    .name-edit-form {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 8px;
      flex-wrap: wrap;
    }

    .edit-name-field {
      min-width: 260px;
    }

    .btn-outline-pill {
      padding: 6px 16px;
      border-radius: 18px;
      border: 1px solid rgba(0, 0, 0, 0.15);
      background: #fff;
      color: #3f3f46;
      font-size: 13px;
      cursor: pointer;
    }

    .btn-solid-pill {
      padding: 6px 18px;
      border-radius: 18px;
      border: 1px solid #18181b;
      background: #18181b;
      color: #fff;
      font-size: 13px;
      cursor: pointer;
    }

    .user-badges {
      display: flex;
      gap: 8px;
      margin-top: 14px;
      flex-wrap: wrap;
    }

    .group-pill-badge {
      background: rgba(0, 0, 0, 0.04);
      color: #52525b;
      font-size: 12px;
      font-weight: 500;
      padding: 4px 12px;
      border-radius: 16px;
      border: 1px solid rgba(0, 0, 0, 0.06);
    }

    /* Учебные группы */
    .student-group-card {
      padding: 24px;
      margin-bottom: 28px;
    }

    .group-card-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 18px;
    }

    .group-icon-circle {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.04);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #18181b;
    }

    .section-card-title {
      margin: 0;
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 22px;
      font-weight: 400;
      color: #18181b;
    }

    .section-card-sub {
      margin: 2px 0 0;
      font-size: 12px;
      color: #71717a;
    }

    .profile-group-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .profile-group-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(0, 0, 0, 0.06);
    }

    .group-name-wrapper {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #18181b;
      font-weight: 500;
      font-size: 14px;
    }

    .group-name-wrapper mat-icon {
      color: #71717a;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .group-role-badge {
      font-size: 11px;
      font-weight: 600;
      color: #52525b;
      background: #f4f4f5;
      padding: 3px 8px;
      border-radius: 10px;
    }

    /* Двухколоночная сетка */
    .profile-grid {
      display: grid;
      grid-template-columns: 1fr 300px;
      gap: 28px;
      align-items: start;
    }

    .main-column {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .section-title-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }

    .section-icon {
      color: #18181b;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .section-heading {
      margin: 0;
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 24px;
      font-weight: 400;
      color: #18181b;
    }

    /* Карточки сдач */
    .submission-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    }

    .submission-card {
      padding: 20px;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .submission-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px -4px rgba(0, 0, 0, 0.08);
    }

    .subm-header {
      margin-bottom: 14px;
    }

    .subm-title {
      margin: 0 0 4px 0;
      font-size: 14px;
      font-weight: 600;
      color: #18181b;
      line-height: 1.3;
    }

    .subm-date {
      font-size: 11px;
      color: #71717a;
    }

    .score-display {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 0;
    }

    .score-circle {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      border: 3px solid rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #fff;
    }

    .score-circle.excellent {
      border-color: #18181b;
    }

    .score-circle.good {
      border-color: rgba(0, 0, 0, 0.3);
    }

    .score-value {
      font-size: 20px;
      font-weight: 700;
      color: #18181b;
      line-height: 1;
    }

    .score-max {
      font-size: 11px;
      color: #71717a;
      margin-top: 2px;
    }

    .score-label {
      font-size: 11px;
      font-weight: 500;
      color: #71717a;
      margin-top: 8px;
    }

    .subm-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
    }

    .btn-subm-details {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: #18181b;
      text-decoration: none;
      padding: 5px 12px;
      border-radius: 14px;
      border: 1px solid rgba(0, 0, 0, 0.1);
      background: #fff;
      transition: all 0.15s ease;
    }

    .btn-subm-details:hover {
      background: #18181b;
      color: #fff;
      border-color: #18181b;
    }

    .btn-subm-details mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    /* Мои оценки и фильтры */
    .filter-card {
      padding: 16px 20px;
      margin-bottom: 16px;
    }

    .filter-row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .select-field {
      flex: 1;
      min-width: 180px;
    }

    .empty-state-card {
      padding: 40px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      color: #71717a;
    }

    .empty-state-card.small {
      padding: 24px;
    }

    .empty-state-card mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      opacity: 0.5;
    }

    .empty-state-card p {
      margin: 0;
      font-size: 13px;
    }

    .review-panel {
      margin-bottom: 10px;
      border-radius: 14px !important;
      overflow: hidden;
    }

    .avg-score {
      font-size: 12px;
      color: #18181b;
      font-weight: 500;
    }

    .review-details {
      padding: 12px 0 6px;
    }

    .rating-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px;
      margin-bottom: 12px;
    }

    .rating-item {
      font-size: 12px;
      color: #52525b;
    }

    .rating-item span {
      font-weight: 600;
      color: #18181b;
      margin-left: 4px;
    }

    .comment-box {
      font-size: 13px;
      color: #3f3f46;
      background: rgba(0, 0, 0, 0.02);
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid rgba(0, 0, 0, 0.05);
    }

    /* Карточка статистики */
    .stats-card {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: sticky;
      top: 24px;
    }

    .stats-heading {
      margin: 0 0 6px 0;
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 24px;
      font-weight: 400;
      color: #18181b;
    }

    .stat-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    .stat-row:last-child {
      border-bottom: none;
    }

    .stat-label {
      font-size: 13px;
      color: #71717a;
    }

    .stat-value {
      font-size: 18px;
      font-weight: 600;
      color: #18181b;
    }

    /* Не авторизован */
    .login-required {
      padding: 80px 24px;
      text-align: center;
      max-width: 480px;
      margin: 60px auto;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .large-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #a1a1aa;
      margin-bottom: 16px;
    }

    .login-required h2 {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 28px;
      font-weight: 400;
      color: #18181b;
      margin: 0 0 8px 0;
    }

    .login-required p {
      font-size: 14px;
      color: #71717a;
      margin: 0 0 20px 0;
    }

    @media (max-width: 860px) {
      .profile-grid {
        grid-template-columns: 1fr;
      }
      .stats-card {
        position: static;
      }
    }
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
  avatarError = false;

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

  getUserInitials(name?: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

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
              this.avatarError = false;
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
          this.avatarError = false;
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
          this.avatarError = false;
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

  toggleInvisibility() {
    if (!this.user) return;
    const newInvisible = !this.user.is_hidden_admin;
    this.api.updateUser(this.user.id, { is_hidden_admin: newInvisible }).subscribe({
      next: (updatedUser) => {
        this.snackBar.open(
          updatedUser.is_hidden_admin ? 'Режим невидимости включен. Вас не видно в списках пользователей.' : 'Режим невидимости выключен. Теперь вас видно всем.',
          'OK',
          { duration: 3000 }
        );
        // Sync global state to reflect change across app
        this.auth.syncUserWithBackend().subscribe(() => {
          this.refreshAuthUser();
        });
      },
      error: (err) => {
        console.error(err);
        this.snackBar.open('Ошибка при переключении видимости: ' + (err.error?.detail || 'Неизвестная ошибка'), 'OK', { duration: 5000 });
      }
    });
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

