import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { RussianDatePipe } from '../../core/pipes/russian-date.pipe';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';

export interface ScoreBucket {
  label: string;
  count: number;
  percent: number;
  color: string;
  gradient: string;
}

export interface DayActivity {
  dateStr: string;
  label: string;
  count: number;
  heightPercent: number;
}

export interface CoursePerf {
  id: string;
  name: string;
  testsCount: number;
  submissionsCount: number;
  avgScore: number;
}

export interface StudentRank {
  name: string;
  completedTests: number;
  avgScore: number;
  rank: number;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
    RussianDatePipe
  ],
  template: `
    <div class="hub-container">
      <div class="hub-content">
        <!-- Page Header -->
        <div class="hub-header">
          <div class="header-titles">
            <div class="badge-live-row">
              <span class="pulse-badge">
                <span class="pulse-dot"></span>
                LIVE SYNC
              </span>
              <span class="last-sync-text" *ngIf="lastSyncTime">Обновлено: {{ lastSyncTime | date:'HH:mm:ss' }}</span>
            </div>
            <h1 class="page-title">Аналитика и База данных</h1>
            <p class="page-subtitle">Единый центр мониторинга, сводной успеваемости и управления системой</p>
          </div>

          <div class="header-actions">
            <button class="btn-refresh" (click)="loadAllData()" [disabled]="loading" matTooltip="Обновить все данные">
              <mat-icon [class.spinning]="loading">refresh</mat-icon>
              <span>Синхронизировать</span>
            </button>
          </div>
        </div>

        <!-- Segmented Tab Navigation -->
        <div class="tabs-segmented-wrap">
          <div class="tabs-segmented">
            <button class="tab-segment-btn" [class.active]="activeTab === 'overview'" (click)="setTab('overview')">
              <mat-icon>insights</mat-icon>
              <span>Обзор и аналитика</span>
            </button>
            <button class="tab-segment-btn" [class.active]="activeTab === 'activity'" (click)="setTab('activity')">
              <mat-icon>visibility</mat-icon>
              <span>Мониторинг активности</span>
              <span class="counter-pill" *ngIf="activities.length">{{ activities.length }}</span>
            </button>
            <button class="tab-segment-btn" [class.active]="activeTab === 'database'" (click)="setTab('database')">
              <mat-icon>database</mat-icon>
              <span>База данных</span>
            </button>
          </div>
        </div>

        <!-- Global Loader -->
        <div *ngIf="loading" class="loading-state">
          <mat-spinner diameter="46"></mat-spinner>
          <p>Сбор и агрегация данных платформы...</p>
        </div>

        <!-- TAB 1: OVERVIEW & ANALYTICS -->
        <div *ngIf="!loading && activeTab === 'overview'" class="tab-panel animate-fade">
          <!-- Course Filter Bar -->
          <div class="filter-strip">
            <div class="filter-group">
              <label class="filter-label">Фильтр по курсу:</label>
              <select class="custom-select" [(ngModel)]="selectedSubjectId" (change)="onSubjectFilterChange()">
                <option [value]="null">Все курсы платформы</option>
                <option *ngFor="let s of subjects" [value]="s.id">{{ s.name }}</option>
              </select>
            </div>
            <div class="filter-summary-note">
              Показаны сводные показатели по {{ filteredSubmissions.length }} решениям тестов
            </div>
          </div>

          <!-- KPI Metric Cards Grid -->
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-icon-wrap" style="background: rgba(99, 102, 241, 0.1); color: #6366f1;">
                <mat-icon>people</mat-icon>
              </div>
              <div class="kpi-content">
                <span class="kpi-label">Студенты и пользователи</span>
                <span class="kpi-value">{{ users.length }}</span>
                <span class="kpi-hint">{{ activeStudentsCount }} активных студентов</span>
              </div>
            </div>

            <div class="kpi-card">
              <div class="kpi-icon-wrap" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">
                <mat-icon>menu_book</mat-icon>
              </div>
              <div class="kpi-content">
                <span class="kpi-label">Курсы и программы</span>
                <span class="kpi-value">{{ subjects.length }}</span>
                <span class="kpi-hint">{{ tests.length }} тестов в каталоге</span>
              </div>
            </div>

            <div class="kpi-card">
              <div class="kpi-icon-wrap" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">
                <mat-icon>fact_check</mat-icon>
              </div>
              <div class="kpi-content">
                <span class="kpi-label">Всего сдач тестов</span>
                <span class="kpi-value">{{ filteredSubmissions.length }}</span>
                <span class="kpi-hint">{{ finishedSubmissionsCount }} завершено успешно</span>
              </div>
            </div>

            <div class="kpi-card highlight-card">
              <div class="kpi-icon-wrap" style="background: rgba(255, 255, 255, 0.2); color: #ffffff;">
                <mat-icon>grade</mat-icon>
              </div>
              <div class="kpi-content">
                <span class="kpi-label">Средний балл платформы</span>
                <span class="kpi-value">{{ avgPlatformScore.toFixed(1) }}%</span>
                <span class="kpi-hint">Качественная успеваемость</span>
              </div>
            </div>

            <div class="kpi-card">
              <div class="kpi-icon-wrap" style="background: rgba(139, 92, 246, 0.1); color: #8b5cf6;">
                <mat-icon>verified</mat-icon>
              </div>
              <div class="kpi-content">
                <span class="kpi-label">Pass Rate (Сдача &ge;60%)</span>
                <span class="kpi-value">{{ passRatePercent.toFixed(1) }}%</span>
                <span class="kpi-hint">Процент успешных попыток</span>
              </div>
            </div>

            <div class="kpi-card">
              <div class="kpi-icon-wrap" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">
                <mat-icon>sensors</mat-icon>
              </div>
              <div class="kpi-content">
                <span class="kpi-label">Прямые эфиры</span>
                <span class="kpi-value">{{ activeStreamsCount }}</span>
                <span class="kpi-hint">{{ activeStreamsCount > 0 ? 'Идут трансляции' : 'Нет активных комнат' }}</span>
              </div>
            </div>

            <div class="kpi-card">
              <div class="kpi-icon-wrap" style="background: rgba(14, 165, 233, 0.1); color: #0ea5e9;">
                <mat-icon>folder_open</mat-icon>
              </div>
              <div class="kpi-content">
                <span class="kpi-label">Обучающие материалы</span>
                <span class="kpi-value">{{ materials.length + videos.length }}</span>
                <span class="kpi-hint">{{ materials.length }} документов, {{ videos.length }} видео</span>
              </div>
            </div>
          </div>

          <!-- Charts Row -->
          <div class="charts-two-col">
            <!-- Grade Distribution Breakdown -->
            <div class="glass-section-card">
              <div class="card-title-row">
                <div class="title-with-icon">
                  <mat-icon>pie_chart</mat-icon>
                  <h2>Распределение оценок</h2>
                </div>
                <span class="pill-note">{{ finishedSubmissionsCount }} оценок</span>
              </div>

              <div class="buckets-list" *ngIf="finishedSubmissionsCount > 0; else noScores">
                <div class="bucket-row" *ngFor="let b of scoreBuckets">
                  <div class="bucket-info">
                    <span class="bucket-label">{{ b.label }}</span>
                    <span class="bucket-stats">{{ b.count }} ({{ b.percent.toFixed(1) }}%)</span>
                  </div>
                  <div class="progress-track">
                    <div class="progress-fill" [style.width.%]="b.percent" [style.background]="b.gradient"></div>
                  </div>
                </div>
              </div>
              <ng-template #noScores>
                <div class="empty-inline-state">
                  <mat-icon>sentiment_neutral</mat-icon>
                  <p>Пока нет завершенных сдач тестов</p>
                </div>
              </ng-template>
            </div>

            <!-- Activity Timeline (SVG Bar Chart) -->
            <div class="glass-section-card">
              <div class="card-title-row">
                <div class="title-with-icon">
                  <mat-icon>bar_chart</mat-icon>
                  <h2>Динамика активности (14 дней)</h2>
                </div>
                <span class="pill-note">{{ totalActivityInPeriod }} событий</span>
              </div>

              <div class="timeline-chart-wrap" *ngIf="activityTimeline.length > 0">
                <div class="svg-bar-chart">
                  <div class="chart-column" *ngFor="let day of activityTimeline" [matTooltip]="day.dateStr + ': ' + day.count + ' событий'">
                    <div class="column-bar-wrap">
                      <div class="column-bar" [style.height.%]="day.heightPercent"></div>
                    </div>
                    <span class="column-label">{{ day.label }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Two Column: Course Breakdown & Top Students -->
          <div class="charts-two-col">
            <!-- Courses Performance Breakdown -->
            <div class="glass-section-card">
              <div class="card-title-row">
                <div class="title-with-icon">
                  <mat-icon>school</mat-icon>
                  <h2>Успеваемость по курсам</h2>
                </div>
                <span class="pill-note">{{ coursePerformances.length }} курсов</span>
              </div>

              <div class="course-perf-list" *ngIf="coursePerformances.length > 0; else noCourses">
                <div class="course-perf-item" *ngFor="let c of coursePerformances">
                  <div class="course-perf-top">
                    <span class="course-name">{{ c.name }}</span>
                    <span class="course-score-badge" [class.badge-high]="c.avgScore >= 75" [class.badge-mid]="c.avgScore >= 60 && c.avgScore < 75" [class.badge-low]="c.avgScore < 60 && c.submissionsCount > 0">
                      {{ c.submissionsCount > 0 ? c.avgScore.toFixed(1) + '%' : 'Нет сдач' }}
                    </span>
                  </div>
                  <div class="course-metrics-line">
                    <span>{{ c.testsCount }} тестов</span>
                    <span>•</span>
                    <span>{{ c.submissionsCount }} решений</span>
                  </div>
                  <div class="progress-track" style="height: 6px; margin-top: 8px;">
                    <div class="progress-fill" [style.width.%]="c.submissionsCount > 0 ? c.avgScore : 0" style="background: linear-gradient(90deg, #6366f1, #10b981);"></div>
                  </div>
                </div>
              </div>
              <ng-template #noCourses>
                <div class="empty-inline-state">
                  <mat-icon>inbox</mat-icon>
                  <p>Курсы еще не добавлены</p>
                </div>
              </ng-template>
            </div>

            <!-- Top Students Podium / Leaderboard Snippet -->
            <div class="glass-section-card">
              <div class="card-title-row">
                <div class="title-with-icon">
                  <mat-icon>emoji_events</mat-icon>
                  <h2>Лидеры по результатам</h2>
                </div>
                <a routerLink="/leaderboard" class="view-all-link">Все лидеры &rarr;</a>
              </div>

              <div class="top-students-list" *ngIf="topStudents.length > 0; else noStudents">
                <div class="student-rank-item" *ngFor="let st of topStudents">
                  <div class="rank-badge" [class.rank-1]="st.rank === 1" [class.rank-2]="st.rank === 2" [class.rank-3]="st.rank === 3">
                    {{ st.rank }}
                  </div>
                  <div class="student-info">
                    <span class="student-name">{{ st.name }}</span>
                    <span class="student-meta">{{ st.completedTests }} тестов сдано</span>
                  </div>
                  <div class="student-score-pill">
                    {{ st.avgScore.toFixed(1) }}%
                  </div>
                </div>
              </div>
              <ng-template #noStudents>
                <div class="empty-inline-state">
                  <mat-icon>sports_score</mat-icon>
                  <p>Пока нет данных о решениях студентов</p>
                </div>
              </ng-template>
            </div>
          </div>
        </div>

        <!-- TAB 2: ACTIVITY MONITOR -->
        <div *ngIf="!loading && activeTab === 'activity'" class="tab-panel animate-fade">
          <!-- Monitor Filter Card -->
          <div class="glass-section-card filter-card-activity">
            <div class="activity-filters-row">
              <div class="filter-control">
                <label>Пользователь:</label>
                <select class="custom-select" [(ngModel)]="selectedActivityUser" (change)="filterActivities()">
                  <option [value]="null">Все пользователи</option>
                  <option *ngFor="let u of users" [value]="u.name">{{ u.name }}</option>
                </select>
              </div>

              <div class="filter-control">
                <label>Тип действия:</label>
                <select class="custom-select" [(ngModel)]="selectedActionType" (change)="filterActivities()">
                  <option [value]="null">Все действия</option>
                  <option value="login">Авторизация (Вход)</option>
                  <option value="test_start">Начало теста</option>
                  <option value="test_finish">Завершение теста</option>
                  <option value="material_view">Просмотр материала</option>
                  <option value="video_view">Просмотр видео</option>
                </select>
              </div>

              <div class="filter-control">
                <label>Поиск:</label>
                <input type="text" class="custom-input" placeholder="Поиск по имени или ресурсу..." [(ngModel)]="activitySearch" (input)="filterActivities()" />
              </div>
            </div>

            <!-- Activity Summary Bar -->
            <div class="activity-summary-bar">
              <div class="summary-pill">
                <mat-icon style="color: #6366f1;">login</mat-icon>
                <span><strong>{{ countActivitiesByType('login') }}</strong> входов</span>
              </div>
              <div class="summary-pill">
                <mat-icon style="color: #8b5cf6;">quiz</mat-icon>
                <span><strong>{{ countActivitiesByType('test_finish') + countActivitiesByType('test_start') }}</strong> тестов</span>
              </div>
              <div class="summary-pill">
                <mat-icon style="color: #10b981;">description</mat-icon>
                <span><strong>{{ countActivitiesByType('material_view') }}</strong> материалов</span>
              </div>
              <div class="summary-pill">
                <mat-icon style="color: #f59e0b;">play_circle</mat-icon>
                <span><strong>{{ countActivitiesByType('video_view') }}</strong> видео</span>
              </div>
            </div>
          </div>

          <!-- Activity Stream Table -->
          <div class="glass-section-card" style="padding: 0; overflow: hidden;">
            <div class="card-title-row" style="padding: 20px 24px;">
              <div class="title-with-icon">
                <mat-icon>history</mat-icon>
                <h2>Лента событий системы</h2>
              </div>
              <span class="pill-note">Найдено: {{ filteredActivities.length }}</span>
            </div>

            <div class="table-responsive" *ngIf="filteredActivities.length > 0; else noActivities">
              <table class="modern-hub-table">
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Пользователь</th>
                    <th>Действие</th>
                    <th>Тип ресурса</th>
                    <th>Длительность</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let act of filteredActivities">
                    <td class="date-cell">
                      {{ act.created_at | russianDate:'datetime' }}
                    </td>
                    <td>
                      <div class="user-chip">
                        <div class="user-avatar-mini">{{ getInitials(act.user_name) }}</div>
                        <span class="user-name-text">{{ act.user_name }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="action-tag" [ngClass]="getActionClass(act.action_type)">
                        <mat-icon class="mini-tag-icon">{{ getActionIcon(act.action_type) }}</mat-icon>
                        {{ getActionTitle(act.action_type) }}
                      </span>
                    </td>
                    <td class="resource-cell">
                      <span class="resource-badge">{{ act.resource_type || 'система' }}</span>
                      <span class="resource-id" *ngIf="act.resource_id" [matTooltip]="act.resource_id">{{ truncateId(act.resource_id) }}</span>
                    </td>
                    <td class="time-cell">
                      {{ formatDuration(act.session_duration) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ng-template #noActivities>
              <div class="empty-inline-state" style="padding: 60px 20px;">
                <mat-icon>manage_search</mat-icon>
                <p>События не найдены</p>
                <span style="font-size: 13px; color: #a1a1aa;">Попробуйте сбросить фильтры поиска</span>
              </div>
            </ng-template>
          </div>
        </div>

        <!-- TAB 3: DATABASE MANAGEMENT -->
        <div *ngIf="!loading && activeTab === 'database'" class="tab-panel animate-fade">
          <!-- DB Sub-Navigation Pills -->
          <div class="db-nav-row">
            <div class="db-entity-pills">
              <button class="entity-pill" [class.active]="currentEntity === 'users'" (click)="setEntity('users')">
                <mat-icon>people</mat-icon>
                <span>Пользователи ({{ users.length }})</span>
              </button>
              <button class="entity-pill" [class.active]="currentEntity === 'subjects'" (click)="setEntity('subjects')">
                <mat-icon>menu_book</mat-icon>
                <span>Курсы ({{ subjects.length }})</span>
              </button>
              <button class="entity-pill" [class.active]="currentEntity === 'tests'" (click)="setEntity('tests')">
                <mat-icon>quiz</mat-icon>
                <span>Тесты ({{ tests.length }})</span>
              </button>
              <button class="entity-pill" [class.active]="currentEntity === 'submissions'" (click)="setEntity('submissions')">
                <mat-icon>fact_check</mat-icon>
                <span>Сдачи ({{ submissions.length }})</span>
              </button>
              <button class="entity-pill" [class.active]="currentEntity === 'materials'" (click)="setEntity('materials')">
                <mat-icon>description</mat-icon>
                <span>Материалы ({{ materials.length }})</span>
              </button>
              <button class="entity-pill" [class.active]="currentEntity === 'videos'" (click)="setEntity('videos')">
                <mat-icon>smart_display</mat-icon>
                <span>Видео ({{ videos.length }})</span>
              </button>
              <button class="entity-pill" [class.active]="currentEntity === 'reviews'" (click)="setEntity('reviews')">
                <mat-icon>rate_review</mat-icon>
                <span>Рецензии ({{ reviews.length }})</span>
              </button>
            </div>
          </div>

          <!-- DB Action & Search Toolbar -->
          <div class="glass-section-card db-toolbar-card">
            <div class="db-toolbar">
              <div class="db-search-box">
                <mat-icon>search</mat-icon>
                <input type="text" placeholder="Поиск в таблице..." [(ngModel)]="dbSearchQuery" />
                <button *ngIf="dbSearchQuery" (click)="dbSearchQuery = ''" class="clear-search-btn">
                  <mat-icon>close</mat-icon>
                </button>
              </div>

              <!-- Inline User Creator (Only visible on users tab) -->
              <div *ngIf="currentEntity === 'users'" class="inline-user-creator">
                <input type="text" placeholder="Имя нового пользователя..." [(ngModel)]="newUserName" (keyup.enter)="createUser()" />
                <button class="btn-create-pill" (click)="createUser()" [disabled]="!newUserName.trim()">
                  <mat-icon>person_add</mat-icon>
                  <span>Создать</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Entity Tables -->
          <div class="glass-section-card" style="padding: 0; overflow: hidden;">
            <!-- USERS TABLE -->
            <div *ngIf="currentEntity === 'users'" class="table-responsive">
              <table class="modern-hub-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Имя пользователя</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let u of filteredUsers">
                    <td class="code-cell">{{ truncateId(u.id) }}</td>
                    <td class="font-medium">
                      <div class="user-chip">
                        <div class="user-avatar-mini">{{ getInitials(u.name) }}</div>
                        <span>{{ u.name }}</span>
                      </div>
                    </td>
                    <td>
                      <button class="btn-action-del" (click)="deleteUser(u)" matTooltip="Удалить аккаунт">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div *ngIf="filteredUsers.length === 0" class="empty-inline-state">
                <mat-icon>people_outline</mat-icon>
                <p>Пользователи не найдены</p>
              </div>
            </div>

            <!-- SUBJECTS TABLE -->
            <div *ngIf="currentEntity === 'subjects'" class="table-responsive">
              <table class="modern-hub-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Название курса</th>
                    <th>Описание</th>
                    <th>Дата создания</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let s of filteredSubjectsList">
                    <td class="code-cell">{{ truncateId(s.id) }}</td>
                    <td class="font-medium">{{ s.name }}</td>
                    <td class="desc-cell">{{ s.description || '—' }}</td>
                    <td class="date-cell">{{ s.created_at | russianDate:'datetime' }}</td>
                    <td>
                      <button class="btn-action-del" (click)="deleteSubject(s)" matTooltip="Удалить курс">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div *ngIf="filteredSubjectsList.length === 0" class="empty-inline-state">
                <mat-icon>menu_book</mat-icon>
                <p>Курсы не найдены</p>
              </div>
            </div>

            <!-- TESTS TABLE -->
            <div *ngIf="currentEntity === 'tests'" class="table-responsive">
              <table class="modern-hub-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Название</th>
                    <th>Тип</th>
                    <th>Вопросов</th>
                    <th>Дедлайн</th>
                    <th>Лимит времени</th>
                    <th>Создан</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let t of filteredTestsList">
                    <td class="code-cell">{{ truncateId(t.id) }}</td>
                    <td class="font-medium">{{ t.title }}</td>
                    <td>
                      <span class="type-pill" [class.type-mc]="t.test_type === 'multiple_choice'">
                        {{ t.test_type === 'multiple_choice' ? 'С вариантами' : 'Ключевые слова' }}
                      </span>
                    </td>
                    <td>{{ t.questions?.length || 0 }}</td>
                    <td class="date-cell">{{ t.due_date ? (t.due_date | russianDate:'datetime') : '—' }}</td>
                    <td>{{ t.time_limit_minutes ? t.time_limit_minutes + ' мин' : '—' }}</td>
                    <td class="date-cell">{{ t.created_at | russianDate:'datetime' }}</td>
                    <td>
                      <button class="btn-action-del" (click)="deleteTest(t)" matTooltip="Удалить тест">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div *ngIf="filteredTestsList.length === 0" class="empty-inline-state">
                <mat-icon>quiz</mat-icon>
                <p>Тесты не найдены</p>
              </div>
            </div>

            <!-- SUBMISSIONS TABLE -->
            <div *ngIf="currentEntity === 'submissions'" class="table-responsive">
              <table class="modern-hub-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Студент</th>
                    <th>ID Теста</th>
                    <th>Балл</th>
                    <th>Очки</th>
                    <th>Статус</th>
                    <th>Завершено</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let sub of filteredSubmissionsList">
                    <td class="code-cell">{{ truncateId(sub.id) }}</td>
                    <td class="font-medium">{{ sub.user }}</td>
                    <td class="code-cell">{{ truncateId(sub.test_id) }}</td>
                    <td>
                      <span class="score-badge" [class.badge-high]="sub.total_score === sub.total_max && sub.total_max > 0" [class.badge-mid]="sub.total_score > 0 && sub.total_score < sub.total_max" [class.badge-low]="sub.total_score === 0">
                        {{ sub.total_score }} / {{ sub.total_max }}
                      </span>
                    </td>
                    <td>+{{ sub.points_awarded || 0 }}</td>
                    <td>
                      <span class="status-pill" [class.status-done]="sub.is_finished === 'true'">
                        {{ sub.is_finished === 'true' ? 'Завершена' : 'В процессе' }}
                      </span>
                    </td>
                    <td class="date-cell">{{ sub.finished_at ? (sub.finished_at | russianDate:'datetime') : '—' }}</td>
                    <td>
                      <button class="btn-action-del" (click)="deleteSubmission(sub)" matTooltip="Удалить сдачу">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div *ngIf="filteredSubmissionsList.length === 0" class="empty-inline-state">
                <mat-icon>fact_check</mat-icon>
                <p>Сдачи не найдены</p>
              </div>
            </div>

            <!-- MATERIALS TABLE -->
            <div *ngIf="currentEntity === 'materials'" class="table-responsive">
              <table class="modern-hub-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Имя файла</th>
                    <th>Размер</th>
                    <th>MIME-тип</th>
                    <th>Загрузил</th>
                    <th>Дата</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let m of filteredMaterialsList">
                    <td class="code-cell">{{ truncateId(m.id) }}</td>
                    <td class="font-medium">{{ m.original_name || m.name }}</td>
                    <td>{{ formatFileSize(m.size) }}</td>
                    <td><span class="resource-badge">{{ m.mime_type }}</span></td>
                    <td>{{ m.uploader }}</td>
                    <td class="date-cell">{{ m.created_at | russianDate:'datetime' }}</td>
                    <td>
                      <button class="btn-action-del" (click)="deleteMaterial(m)" matTooltip="Удалить материал">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div *ngIf="filteredMaterialsList.length === 0" class="empty-inline-state">
                <mat-icon>description</mat-icon>
                <p>Материалы не найдены</p>
              </div>
            </div>

            <!-- VIDEOS TABLE -->
            <div *ngIf="currentEntity === 'videos'" class="table-responsive">
              <table class="modern-hub-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Название видео</th>
                    <th>URL ссылка</th>
                    <th>Загрузил</th>
                    <th>Дата</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let v of filteredVideosList">
                    <td class="code-cell">{{ truncateId(v.id) }}</td>
                    <td class="font-medium">{{ v.title }}</td>
                    <td>
                      <a [href]="v.url" target="_blank" class="table-ext-link">{{ truncateUrl(v.url) }}</a>
                    </td>
                    <td>{{ v.uploader }}</td>
                    <td class="date-cell">{{ v.created_at | russianDate:'datetime' }}</td>
                    <td>
                      <button class="btn-action-del" (click)="deleteVideo(v)" matTooltip="Удалить видео">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div *ngIf="filteredVideosList.length === 0" class="empty-inline-state">
                <mat-icon>smart_display</mat-icon>
                <p>Видео не найдены</p>
              </div>
            </div>

            <!-- REVIEWS TABLE -->
            <div *ngIf="currentEntity === 'reviews'" class="table-responsive">
              <table class="modern-hub-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>ID Сдачи</th>
                    <th>Рецензент</th>
                    <th>Средний балл</th>
                    <th>Дата</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let r of filteredReviewsList">
                    <td class="code-cell">{{ truncateId(r.id) }}</td>
                    <td class="code-cell">{{ truncateId(r.submission_id) }}</td>
                    <td class="font-medium">{{ r.reviewer }}</td>
                    <td>
                      <span class="score-badge badge-high">{{ r.avg_score ? r.avg_score.toFixed(2) : '—' }}</span>
                    </td>
                    <td class="date-cell">{{ r.created_at | russianDate:'datetime' }}</td>
                    <td>
                      <button class="btn-action-del" (click)="deleteReview(r)" matTooltip="Удалить рецензию">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div *ngIf="filteredReviewsList.length === 0" class="empty-inline-state">
                <mat-icon>rate_review</mat-icon>
                <p>Рецензии не найдены</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .hub-container {
      min-height: 100%;
      padding: 32px 24px 64px;
      background: #fcfcfd;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #09090b;
    }

    .hub-content {
      max-width: 1400px;
      margin: 0 auto;
    }

    /* Header */
    .hub-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 28px;
      gap: 20px;
    }

    .badge-live-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .pulse-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      color: #059669;
      letter-spacing: 0.05em;
    }

    .pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
      animation: pulse-green 2s infinite;
    }

    @keyframes pulse-green {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    .last-sync-text {
      font-size: 12px;
      color: #71717a;
    }

    .page-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 38px;
      font-weight: 400;
      margin: 0 0 6px 0;
      color: #09090b;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }

    .page-subtitle {
      font-size: 15px;
      color: #71717a;
      margin: 0;
    }

    .btn-refresh {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: #09090b;
      color: #ffffff;
      border: none;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .btn-refresh:hover:not(:disabled) {
      background: #27272a;
      transform: translateY(-1px);
    }

    .btn-refresh:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    /* Segmented Navigation */
    .tabs-segmented-wrap {
      margin-bottom: 28px;
    }

    .tabs-segmented {
      display: inline-flex;
      padding: 5px;
      background: rgba(0, 0, 0, 0.04);
      border-radius: 16px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      gap: 4px;
    }

    .tab-segment-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 20px;
      border-radius: 12px;
      border: none;
      background: transparent;
      font-size: 14px;
      font-weight: 500;
      color: #52525b;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .tab-segment-btn:hover {
      color: #09090b;
    }

    .tab-segment-btn.active {
      background: #ffffff;
      color: #09090b;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .counter-pill {
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      background: rgba(0, 0, 0, 0.07);
      color: #3f3f46;
    }

    /* Loading State */
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 100px 20px;
      gap: 16px;
      color: #71717a;
    }

    /* Filter Strip */
    .filter-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding: 14px 20px;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid rgba(0, 0, 0, 0.07);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .filter-label {
      font-size: 13px;
      font-weight: 600;
      color: #52525b;
    }

    .custom-select {
      padding: 8px 16px;
      border-radius: 10px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      background: #ffffff;
      font-size: 14px;
      color: #09090b;
      outline: none;
      cursor: pointer;
      transition: border-color 0.2s;
    }

    .custom-select:focus {
      border-color: #09090b;
    }

    .filter-summary-note {
      font-size: 13px;
      color: #71717a;
    }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .kpi-card {
      padding: 20px;
      background: #ffffff;
      border-radius: 20px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: relative;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04);
    }

    .kpi-card.highlight-card {
      background: linear-gradient(135deg, #09090b 0%, #18181b 100%);
      color: #ffffff;
      border: none;
    }

    .kpi-icon-wrap {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .kpi-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .kpi-label {
      font-size: 13px;
      font-weight: 500;
      color: #71717a;
    }

    .highlight-card .kpi-label {
      color: #a1a1aa;
    }

    .kpi-value {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .kpi-hint {
      font-size: 12px;
      color: #a1a1aa;
    }

    .highlight-card .kpi-hint {
      color: #d4d4d8;
    }

    /* Charts Section */
    .charts-two-col {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(440px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }

    .glass-section-card {
      background: #ffffff;
      border-radius: 20px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
      padding: 24px;
    }

    .card-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .title-with-icon {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .title-with-icon mat-icon {
      color: #6366f1;
    }

    .title-with-icon h2 {
      font-size: 17px;
      font-weight: 600;
      margin: 0;
      color: #09090b;
    }

    .pill-note {
      font-size: 12px;
      font-weight: 600;
      padding: 3px 10px;
      background: rgba(0, 0, 0, 0.04);
      border-radius: 9999px;
      color: #71717a;
    }

    /* Grade Buckets */
    .buckets-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .bucket-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .bucket-info {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
    }

    .bucket-label {
      font-weight: 500;
      color: #3f3f46;
    }

    .bucket-stats {
      font-weight: 600;
      color: #09090b;
    }

    .progress-track {
      width: 100%;
      height: 8px;
      background: #f4f4f5;
      border-radius: 9999px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 9999px;
      transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* SVG Timeline Chart */
    .timeline-chart-wrap {
      padding-top: 10px;
    }

    .svg-bar-chart {
      display: flex;
      align-items: flex-end;
      height: 180px;
      gap: 8px;
      padding-bottom: 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    }

    .chart-column {
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      position: relative;
    }

    .column-bar-wrap {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }

    .column-bar {
      width: 80%;
      max-width: 28px;
      min-height: 4px;
      background: linear-gradient(180deg, #6366f1 0%, #a5b4fc 100%);
      border-radius: 6px 6px 0 0;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .column-bar:hover {
      background: linear-gradient(180deg, #4f46e5 0%, #818cf8 100%);
      transform: scaleY(1.05);
      transform-origin: bottom;
    }

    .column-label {
      position: absolute;
      bottom: -20px;
      font-size: 10px;
      color: #a1a1aa;
      white-space: nowrap;
    }

    /* Course Performances */
    .course-perf-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .course-perf-item {
      padding: 12px 16px;
      background: #fafafa;
      border-radius: 14px;
      border: 1px solid rgba(0, 0, 0, 0.04);
    }

    .course-perf-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .course-name {
      font-size: 14px;
      font-weight: 600;
      color: #09090b;
    }

    .course-score-badge {
      font-size: 12px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 8px;
      background: #f4f4f5;
      color: #52525b;
    }

    .badge-high {
      background: rgba(16, 185, 129, 0.12);
      color: #059669;
    }

    .badge-mid {
      background: rgba(245, 158, 11, 0.12);
      color: #d97706;
    }

    .badge-low {
      background: rgba(239, 68, 68, 0.12);
      color: #dc2626;
    }

    .course-metrics-line {
      font-size: 12px;
      color: #71717a;
      display: flex;
      gap: 6px;
    }

    /* Top Students */
    .view-all-link {
      font-size: 13px;
      font-weight: 600;
      color: #6366f1;
      text-decoration: none;
    }

    .view-all-link:hover {
      text-decoration: underline;
    }

    .top-students-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .student-rank-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 14px;
      border-radius: 14px;
      background: #fafafa;
      border: 1px solid rgba(0, 0, 0, 0.04);
    }

    .rank-badge {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #e4e4e7;
      color: #52525b;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
    }

    .rank-1 { background: linear-gradient(135deg, #ffd700, #ffae00); color: #000; box-shadow: 0 2px 8px rgba(255, 174, 0, 0.3); }
    .rank-2 { background: linear-gradient(135deg, #e0e0e0, #bdbdbd); color: #000; }
    .rank-3 { background: linear-gradient(135deg, #cd7f32, #a0522d); color: #fff; }

    .student-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .student-name {
      font-size: 14px;
      font-weight: 600;
      color: #09090b;
    }

    .student-meta {
      font-size: 12px;
      color: #71717a;
    }

    .student-score-pill {
      font-size: 13px;
      font-weight: 700;
      color: #059669;
      background: rgba(16, 185, 129, 0.1);
      padding: 4px 10px;
      border-radius: 9999px;
    }

    /* Activity Tab Styling */
    .filter-card-activity {
      margin-bottom: 20px;
    }

    .activity-filters-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }

    .filter-control {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .filter-control label {
      font-size: 12px;
      font-weight: 600;
      color: #71717a;
    }

    .custom-input {
      padding: 9px 14px;
      border-radius: 10px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }

    .custom-input:focus {
      border-color: #09090b;
    }

    .activity-summary-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      padding-top: 14px;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
    }

    .summary-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: #f4f4f5;
      border-radius: 9999px;
      font-size: 13px;
      color: #3f3f46;
    }

    .summary-pill mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* Database Tab Styling */
    .db-nav-row {
      margin-bottom: 16px;
    }

    .db-entity-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .entity-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 500;
      color: #52525b;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .entity-pill:hover {
      background: #f4f4f5;
      color: #09090b;
    }

    .entity-pill.active {
      background: #09090b;
      color: #ffffff;
      border-color: #09090b;
      font-weight: 600;
    }

    .entity-pill mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .db-toolbar-card {
      margin-bottom: 20px;
      padding: 16px 20px;
    }

    .db-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .db-search-box {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f4f4f5;
      border-radius: 12px;
      padding: 6px 14px;
      flex: 1;
      max-width: 420px;
    }

    .db-search-box mat-icon {
      color: #a1a1aa;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .db-search-box input {
      border: none;
      background: transparent;
      outline: none;
      font-size: 14px;
      width: 100%;
      color: #09090b;
    }

    .clear-search-btn {
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      color: #71717a;
    }

    .inline-user-creator {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .inline-user-creator input {
      padding: 9px 14px;
      border-radius: 10px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      font-size: 14px;
      outline: none;
      width: 220px;
    }

    .btn-create-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      background: #09090b;
      color: #ffffff;
      border: none;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-create-pill:hover:not(:disabled) {
      background: #27272a;
    }

    .btn-create-pill:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-create-pill mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* Modern Data Table */
    .table-responsive {
      width: 100%;
      overflow-x: auto;
    }

    .modern-hub-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      text-align: left;
    }

    .modern-hub-table th {
      padding: 12px 18px;
      background: #fafafa;
      color: #71717a;
      font-weight: 600;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      white-space: nowrap;
    }

    .modern-hub-table td {
      padding: 14px 18px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.04);
      color: #27272a;
      vertical-align: middle;
    }

    .modern-hub-table tr:hover td {
      background: #fbfbfb;
    }

    .code-cell {
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 12px;
      color: #71717a;
    }

    .font-medium {
      font-weight: 600;
      color: #09090b;
    }

    .desc-cell {
      color: #71717a;
      max-width: 280px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .date-cell {
      color: #71717a;
      white-space: nowrap;
      font-size: 12px;
    }

    .user-chip {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }

    .user-avatar-mini {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #f4f4f5;
      border: 1px solid rgba(0, 0, 0, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      color: #09090b;
    }

    .action-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
    }

    .mini-tag-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .tag-login { background: rgba(99, 102, 241, 0.1); color: #6366f1; }
    .tag-test { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
    .tag-material { background: rgba(16, 185, 129, 0.1); color: #059669; }
    .tag-video { background: rgba(245, 158, 11, 0.1); color: #d97706; }
    .tag-default { background: #f4f4f5; color: #52525b; }

    .resource-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      background: #f4f4f5;
      font-size: 11px;
      font-weight: 600;
      color: #52525b;
      margin-right: 6px;
    }

    .resource-id {
      font-family: monospace;
      font-size: 11px;
      color: #a1a1aa;
    }

    .type-pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      background: #f4f4f5;
      color: #52525b;
    }

    .type-pill.type-mc {
      background: rgba(99, 102, 241, 0.1);
      color: #6366f1;
    }

    .score-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 12px;
      background: #f4f4f5;
    }

    .status-pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      background: #fef3c7;
      color: #b45309;
    }

    .status-pill.status-done {
      background: #d1fae5;
      color: #065f46;
    }

    .table-ext-link {
      color: #6366f1;
      text-decoration: none;
      font-size: 12px;
    }

    .table-ext-link:hover {
      text-decoration: underline;
    }

    .btn-action-del {
      border: none;
      background: transparent;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #a1a1aa;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-action-del:hover {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }

    .btn-action-del mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .empty-inline-state {
      padding: 40px 20px;
      text-align: center;
      color: #a1a1aa;
    }

    .empty-inline-state mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      margin-bottom: 6px;
      opacity: 0.5;
    }

    .empty-inline-state p {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
    }

    .animate-fade {
      animation: fadeIn 0.25s ease-in-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 768px) {
      .hub-header {
        flex-direction: column;
        align-items: stretch;
      }
      .charts-two-col {
        grid-template-columns: 1fr;
      }
      .tabs-segmented {
        width: 100%;
        overflow-x: auto;
      }
    }
  `]
})
export class AnalyticsComponent implements OnInit {
  // Navigation State
  activeTab: 'overview' | 'activity' | 'database' = 'overview';
  currentEntity: 'users' | 'subjects' | 'tests' | 'submissions' | 'materials' | 'videos' | 'reviews' = 'users';

  // Raw Database Data
  users: any[] = [];
  subjects: any[] = [];
  tests: any[] = [];
  submissions: any[] = [];
  materials: any[] = [];
  videos: any[] = [];
  reviews: any[] = [];
  activities: any[] = [];
  activeStreamsCount: number = 0;

  // Processed Analytics Metrics
  avgPlatformScore: number = 0;
  passRatePercent: number = 0;
  activeStudentsCount: number = 0;
  finishedSubmissionsCount: number = 0;
  scoreBuckets: ScoreBucket[] = [];
  activityTimeline: DayActivity[] = [];
  totalActivityInPeriod: number = 0;
  coursePerformances: CoursePerf[] = [];
  topStudents: StudentRank[] = [];

  // Filter States
  selectedSubjectId: string | null = null;
  selectedActivityUser: string | null = null;
  selectedActionType: string | null = null;
  activitySearch: string = '';
  dbSearchQuery: string = '';
  newUserName: string = '';

  // UI States
  loading: boolean = true;
  lastSyncTime: Date | null = null;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Detect route path
    const path = window.location.pathname;
    if (path.includes('activity-monitor')) {
      this.activeTab = 'activity';
    } else if (path.includes('admin/db')) {
      this.activeTab = 'database';
    }

    // Read active tab from query params if specified
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        const tab = params['tab'];
        if (tab === 'activity' || tab === 'database' || tab === 'overview') {
          this.activeTab = tab;
        }
      }
      if (params['entity']) {
        this.currentEntity = params['entity'];
      }
    });

    this.loadAllData();
  }

  setTab(tab: 'overview' | 'activity' | 'database'): void {
    this.activeTab = tab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }

  setEntity(entity: any): void {
    this.currentEntity = entity;
    this.dbSearchQuery = '';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { entity },
      queryParamsHandling: 'merge'
    });
  }

  loadAllData(): void {
    this.loading = true;
    this.cdr.markForCheck();

    forkJoin({
      users: this.apiService.getUsers().pipe(catchError(() => of([]))),
      subjects: this.apiService.getSubjects().pipe(catchError(() => of([]))),
      tests: this.apiService.getTests().pipe(catchError(() => of([]))),
      submissions: this.apiService.getSubmissions().pipe(catchError(() => of([]))),
      materials: this.apiService.getMaterials().pipe(catchError(() => of([]))),
      videos: this.apiService.getVideos().pipe(catchError(() => of([]))),
      reviews: this.apiService.getReviews().pipe(catchError(() => of([]))),
      activities: this.apiService.getActivities().pipe(catchError(() => of([]))),
      activeRooms: this.apiService.getActiveStreamingRooms().pipe(catchError(() => of([])))
    }).subscribe({
      next: (res) => {
        this.users = res.users || [];
        this.subjects = res.subjects || [];
        this.tests = res.tests || [];
        this.submissions = res.submissions || [];
        this.materials = res.materials || [];
        this.videos = res.videos || [];
        this.reviews = res.reviews || [];
        this.activities = res.activities || [];
        this.activeStreamsCount = (res.activeRooms || []).length;

        this.lastSyncTime = new Date();
        this.computeAnalytics();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error syncing analytics data:', err);
        this.snackBar.open('Ошибка при синхронизации данных', 'Закрыть', { duration: 3000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  computeAnalytics(): void {
    const subs = this.filteredSubmissions;
    const finished = subs.filter(s => s.is_finished === 'true' && s.total_max > 0);
    this.finishedSubmissionsCount = finished.length;

    // 1. Average platform score & pass rate
    if (finished.length > 0) {
      let sumPct = 0;
      let passCount = 0;
      finished.forEach(s => {
        const pct = (s.total_score / s.total_max) * 100;
        sumPct += pct;
        if (pct >= 60) passCount++;
      });
      this.avgPlatformScore = sumPct / finished.length;
      this.passRatePercent = (passCount / finished.length) * 100;
    } else {
      this.avgPlatformScore = 0;
      this.passRatePercent = 0;
    }

    // 2. Active students count (students who have taken at least 1 test or have activity)
    const activeStudentNames = new Set<string>();
    subs.forEach(s => { if (s.user) activeStudentNames.add(s.user); });
    this.activities.forEach(a => { if (a.user_name) activeStudentNames.add(a.user_name); });
    this.activeStudentsCount = activeStudentNames.size;

    // 3. Score distribution buckets
    let b90 = 0, b75 = 0, b60 = 0, b0 = 0;
    finished.forEach(s => {
      const pct = (s.total_score / s.total_max) * 100;
      if (pct >= 90) b90++;
      else if (pct >= 75) b75++;
      else if (pct >= 60) b60++;
      else b0++;
    });

    const totalF = finished.length || 1;
    this.scoreBuckets = [
      { label: 'Отлично (90–100%)', count: b90, percent: (b90 / totalF) * 100, color: '#10b981', gradient: 'linear-gradient(90deg, #10b981, #34d399)' },
      { label: 'Хорошо (75–89%)', count: b75, percent: (b75 / totalF) * 100, color: '#6366f1', gradient: 'linear-gradient(90deg, #6366f1, #818cf8)' },
      { label: 'Удовлетворительно (60–74%)', count: b60, percent: (b60 / totalF) * 100, color: '#f59e0b', gradient: 'linear-gradient(90deg, #f59e0b, #fbbf24)' },
      { label: 'Требует внимания (<60%)', count: b0, percent: (b0 / totalF) * 100, color: '#ef4444', gradient: 'linear-gradient(90deg, #ef4444, #f87171)' }
    ];

    // 4. Daily activity timeline (past 14 days)
    const daysMap = new Map<string, number>();
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      daysMap.set(key, 0);
    }

    this.activities.forEach(a => {
      if (a.created_at) {
        const dStr = a.created_at.substring(0, 10);
        if (daysMap.has(dStr)) {
          daysMap.set(dStr, (daysMap.get(dStr) || 0) + 1);
        }
      }
    });

    subs.forEach(s => {
      if (s.started_at) {
        const dStr = s.started_at.substring(0, 10);
        if (daysMap.has(dStr)) {
          daysMap.set(dStr, (daysMap.get(dStr) || 0) + 1);
        }
      }
    });

    let maxCount = 1;
    let totalAct = 0;
    daysMap.forEach(count => {
      totalAct += count;
      if (count > maxCount) maxCount = count;
    });
    this.totalActivityInPeriod = totalAct;

    this.activityTimeline = Array.from(daysMap.entries()).map(([key, count]) => {
      const parts = key.split('-');
      const label = `${parts[2]}.${parts[1]}`;
      const heightPercent = Math.max(8, Math.round((count / maxCount) * 100));
      return {
        dateStr: key,
        label,
        count,
        heightPercent
      };
    });

    // 5. Course performance breakdown
    this.coursePerformances = this.subjects.map(sub => {
      // Find tests belonging to this subject
      const subjectTests = this.tests.filter(t => t.subject_id === sub.id);
      const testIds = new Set(subjectTests.map(t => t.id));
      const subjectSubs = this.submissions.filter(s => testIds.has(s.test_id) && s.is_finished === 'true' && s.total_max > 0);

      let avg = 0;
      if (subjectSubs.length > 0) {
        const sum = subjectSubs.reduce((acc, s) => acc + (s.total_score / s.total_max) * 100, 0);
        avg = sum / subjectSubs.length;
      }

      return {
        id: sub.id,
        name: sub.name,
        testsCount: subjectTests.length,
        submissionsCount: subjectSubs.length,
        avgScore: avg
      };
    });

    // 6. Top Students Leaderboard
    const studentStats = new Map<string, { totalPct: number; count: number }>();
    finished.forEach(s => {
      if (!s.user) return;
      const pct = (s.total_score / s.total_max) * 100;
      if (!studentStats.has(s.user)) {
        studentStats.set(s.user, { totalPct: 0, count: 0 });
      }
      const st = studentStats.get(s.user)!;
      st.totalPct += pct;
      st.count += 1;
    });

    const ranked: StudentRank[] = [];
    studentStats.forEach((val, name) => {
      ranked.push({
        name,
        completedTests: val.count,
        avgScore: val.totalPct / val.count,
        rank: 0
      });
    });

    ranked.sort((a, b) => b.avgScore - a.avgScore || b.completedTests - a.completedTests);
    ranked.forEach((r, idx) => r.rank = idx + 1);
    this.topStudents = ranked.slice(0, 5);
  }

  onSubjectFilterChange(): void {
    this.computeAnalytics();
  }

  get filteredSubmissions(): any[] {
    if (!this.selectedSubjectId) return this.submissions;
    const subTests = this.tests.filter(t => t.subject_id === this.selectedSubjectId);
    const testIds = new Set(subTests.map(t => t.id));
    return this.submissions.filter(s => testIds.has(s.test_id));
  }

  // Activity Feed Filters & Helpers
  get filteredActivities(): any[] {
    return this.activities.filter(act => {
      if (this.selectedActivityUser && act.user_name !== this.selectedActivityUser) return false;
      if (this.selectedActionType && act.action_type !== this.selectedActionType) return false;
      if (this.activitySearch.trim()) {
        const q = this.activitySearch.toLowerCase();
        const matchesUser = act.user_name?.toLowerCase().includes(q);
        const matchesResource = act.resource_type?.toLowerCase().includes(q);
        const matchesAction = act.action_type?.toLowerCase().includes(q);
        if (!matchesUser && !matchesResource && !matchesAction) return false;
      }
      return true;
    });
  }

  filterActivities(): void {
    this.cdr.markForCheck();
  }

  countActivitiesByType(type: string): number {
    return this.activities.filter(a => a.action_type === type).length;
  }

  getActionTitle(type: string): string {
    switch (type) {
      case 'login': return 'Вход в систему';
      case 'test_start': return 'Начало теста';
      case 'test_finish': return 'Сдача теста';
      case 'material_view': return 'Просмотр материала';
      case 'video_view': return 'Просмотр видео';
      default: return type || 'Событие';
    }
  }

  getActionClass(type: string): string {
    switch (type) {
      case 'login': return 'tag-login';
      case 'test_start':
      case 'test_finish': return 'tag-test';
      case 'material_view': return 'tag-material';
      case 'video_view': return 'tag-video';
      default: return 'tag-default';
    }
  }

  getActionIcon(type: string): string {
    switch (type) {
      case 'login': return 'login';
      case 'test_start':
      case 'test_finish': return 'quiz';
      case 'material_view': return 'description';
      case 'video_view': return 'play_circle';
      default: return 'radio_button_checked';
    }
  }

  formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '—';
    if (seconds < 60) return `${seconds} сек`;
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m} мин`;
    const h = Math.floor(m / 60);
    return `${h} ч ${m % 60} мин`;
  }

  // Database Tab Filtering
  get filteredUsers(): any[] {
    if (!this.dbSearchQuery.trim()) return this.users;
    const q = this.dbSearchQuery.toLowerCase();
    return this.users.filter(u => u.name?.toLowerCase().includes(q) || u.id?.toString().includes(q));
  }

  get filteredSubjectsList(): any[] {
    if (!this.dbSearchQuery.trim()) return this.subjects;
    const q = this.dbSearchQuery.toLowerCase();
    return this.subjects.filter(s => s.name?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q));
  }

  get filteredTestsList(): any[] {
    if (!this.dbSearchQuery.trim()) return this.tests;
    const q = this.dbSearchQuery.toLowerCase();
    return this.tests.filter(t => t.title?.toLowerCase().includes(q));
  }

  get filteredSubmissionsList(): any[] {
    if (!this.dbSearchQuery.trim()) return this.submissions;
    const q = this.dbSearchQuery.toLowerCase();
    return this.submissions.filter(s => s.user?.toLowerCase().includes(q) || s.test_id?.toString().includes(q));
  }

  get filteredMaterialsList(): any[] {
    if (!this.dbSearchQuery.trim()) return this.materials;
    const q = this.dbSearchQuery.toLowerCase();
    return this.materials.filter(m => (m.original_name || m.name)?.toLowerCase().includes(q) || m.uploader?.toLowerCase().includes(q));
  }

  get filteredVideosList(): any[] {
    if (!this.dbSearchQuery.trim()) return this.videos;
    const q = this.dbSearchQuery.toLowerCase();
    return this.videos.filter(v => v.title?.toLowerCase().includes(q) || v.url?.toLowerCase().includes(q));
  }

  get filteredReviewsList(): any[] {
    if (!this.dbSearchQuery.trim()) return this.reviews;
    const q = this.dbSearchQuery.toLowerCase();
    return this.reviews.filter(r => r.reviewer?.toLowerCase().includes(q) || r.submission_id?.toString().includes(q));
  }

  // Database Actions (Creation & Deletion via ConfirmDialogComponent)
  createUser(): void {
    const name = this.newUserName.trim();
    if (!name) return;

    this.apiService.createUser(name).subscribe({
      next: (created) => {
        this.users = [...this.users, created];
        this.newUserName = '';
        this.snackBar.open(`Пользователь «${name}» успешно создан`, 'ОК', { duration: 3000 });
        this.computeAnalytics();
      },
      error: (err) => {
        this.snackBar.open(err.error?.detail || 'Не удалось создать пользователя', 'Закрыть', { duration: 3000 });
      }
    });
  }

  deleteUser(user: any): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Удалить пользователя?',
        message: `Вы уверены, что хотите удалить аккаунт «${user.name}»? Это действие нельзя отменить.`,
        confirmText: 'Удалить',
        cancelText: 'Отмена',
        isDestructive: true
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.apiService.deleteUser(user.id).subscribe({
          next: () => {
            this.users = this.users.filter(u => u.id !== user.id);
            this.snackBar.open(`Пользователь «${user.name}» удален`, 'ОК', { duration: 2500 });
            this.computeAnalytics();
          },
          error: (err) => this.snackBar.open(err.error?.detail || 'Ошибка при удалении', 'Закрыть', { duration: 3000 })
        });
      }
    });
  }

  deleteSubject(subject: any): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Удалить курс?',
        message: `Удалить курс «${subject.name}»? Все связанные модули, уроки и материалы также будут удалены.`,
        confirmText: 'Удалить курс',
        cancelText: 'Отмена',
        isDestructive: true
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.apiService.deleteSubject(subject.id).subscribe({
          next: () => {
            this.subjects = this.subjects.filter(s => s.id !== subject.id);
            this.snackBar.open(`Курс «${subject.name}» удален`, 'ОК', { duration: 2500 });
            this.computeAnalytics();
          },
          error: (err) => this.snackBar.open(err.error?.detail || 'Ошибка при удалении курса', 'Закрыть', { duration: 3000 })
        });
      }
    });
  }

  deleteTest(test: any): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Удалить тест?',
        message: `Удалить тест «${test.title}» и связанные сдачи?`,
        confirmText: 'Удалить тест',
        cancelText: 'Отмена',
        isDestructive: true
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.apiService.deleteTest(test.id).subscribe({
          next: () => {
            this.tests = this.tests.filter(t => t.id !== test.id);
            this.snackBar.open(`Тест «${test.title}» удален`, 'ОК', { duration: 2500 });
            this.computeAnalytics();
          },
          error: (err) => this.snackBar.open(err.error?.detail || 'Ошибка при удалении теста', 'Закрыть', { duration: 3000 })
        });
      }
    });
  }

  deleteSubmission(sub: any): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Удалить сдачу теста?',
        message: `Удалить работу студента ${sub.user}?`,
        confirmText: 'Удалить',
        cancelText: 'Отмена',
        isDestructive: true
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.apiService.deleteSubmission(sub.id).subscribe({
          next: () => {
            this.submissions = this.submissions.filter(s => s.id !== sub.id);
            this.snackBar.open('Сдача теста успешно удалена', 'ОК', { duration: 2500 });
            this.computeAnalytics();
          },
          error: (err) => this.snackBar.open(err.error?.detail || 'Ошибка при удалении сдачи', 'Закрыть', { duration: 3000 })
        });
      }
    });
  }

  deleteMaterial(m: any): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Удалить материал?',
        message: `Удалить файл «${m.original_name || m.name}»?`,
        confirmText: 'Удалить',
        cancelText: 'Отмена',
        isDestructive: true
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.apiService.deleteMaterial(m.id).subscribe({
          next: () => {
            this.materials = this.materials.filter(item => item.id !== m.id);
            this.snackBar.open('Материал удален', 'ОК', { duration: 2500 });
            this.computeAnalytics();
          },
          error: (err) => this.snackBar.open(err.error?.detail || 'Ошибка при удалении', 'Закрыть', { duration: 3000 })
        });
      }
    });
  }

  deleteVideo(v: any): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Удалить видео?',
        message: `Удалить видео «${v.title}»?`,
        confirmText: 'Удалить',
        cancelText: 'Отмена',
        isDestructive: true
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.apiService.deleteVideo(v.id).subscribe({
          next: () => {
            this.videos = this.videos.filter(item => item.id !== v.id);
            this.snackBar.open('Видео удалено', 'ОК', { duration: 2500 });
            this.computeAnalytics();
          },
          error: (err) => this.snackBar.open(err.error?.detail || 'Ошибка при удалении', 'Закрыть', { duration: 3000 })
        });
      }
    });
  }

  deleteReview(r: any): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Удалить рецензию?',
        message: `Удалить отзыв от пользователя ${r.reviewer}?`,
        confirmText: 'Удалить',
        cancelText: 'Отмена',
        isDestructive: true
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.apiService.deleteReview(r.id).subscribe({
          next: () => {
            this.reviews = this.reviews.filter(item => item.id !== r.id);
            this.snackBar.open('Рецензия удалена', 'ОК', { duration: 2500 });
            this.computeAnalytics();
          },
          error: (err) => this.snackBar.open(err.error?.detail || 'Ошибка при удалении', 'Закрыть', { duration: 3000 })
        });
      }
    });
  }

  // Formatting helpers
  truncateId(id: any): string {
    if (!id) return '';
    const str = id.toString();
    return str.substring(0, 8) + '...';
  }

  truncateUrl(url: string): string {
    if (!url) return '';
    if (url.length > 40) return url.substring(0, 40) + '...';
    return url;
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
}
