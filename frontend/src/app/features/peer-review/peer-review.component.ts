import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-peer-review',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatSelectModule,
    MatListModule,
    MatIconModule,
    MatTabsModule,
    MatSnackBarModule
  ],
  template: `
    <div class="peer-review-container">
      <div class="header-section">
        <div class="title-row">
          <h1 class="page-title">Кросс-проверка</h1>
          <span class="anonymity-badge">
            <mat-icon>security</mat-icon>
            Анонимный режим
          </span>
        </div>
        <p class="page-subtitle">
          Объективно оценивайте работы сокурсников по критериям. За каждую проверенную работу начисляется балл активности!
        </p>

        <!-- Stepper Navigation -->
        <div class="steps-nav">
          <div class="step-pill" [class.active]="step === 1" [class.completed]="step > 1" (click)="step > 1 ? goToStep(1) : null">
            <span class="step-num">1</span>
            <span class="step-title">Выбор курса</span>
          </div>
          <div class="step-divider"></div>
          <div class="step-pill" [class.active]="step === 2" [class.completed]="step > 2" (click)="step > 2 ? goToStep(2) : null">
            <span class="step-num">2</span>
            <span class="step-title">Выбор теста</span>
          </div>
          <div class="step-divider"></div>
          <div class="step-pill" [class.active]="step === 3" [class.completed]="step > 3" (click)="step > 3 ? goToStep(3) : null">
            <span class="step-num">3</span>
            <span class="step-title">Выбор работы</span>
          </div>
          <div class="step-divider"></div>
          <div class="step-pill" [class.active]="step === 4">
            <span class="step-num">4</span>
            <span class="step-title">Оценка</span>
          </div>
        </div>
      </div>

      <!-- Шаг 1: Выбор курса -->
      <div *ngIf="step === 1" class="glass-card selection-card">
        <h2 class="section-title">Шаг 1: Выберите курс для рецензирования</h2>
        <p class="section-desc">Выберите дисциплину, по заданиям которой хотите провести взаимную оценку</p>

        <div *ngIf="subjects.length === 0" class="empty-works-box" style="margin-top: 16px;">
          <mat-icon class="empty-icon">school</mat-icon>
          <h3>Нет доступных курсов</h3>
          <p>У вас пока нет курсов для взаимного оценивания. Доступ к курсам появляется после вступления в группу или принятия приглашения преподавателя.</p>
        </div>

        <mat-form-field appearance="outline" class="clean-field full-width" *ngIf="subjects.length > 0">
          <mat-label>Курс</mat-label>
          <mat-select [(ngModel)]="selectedSubjectId" (selectionChange)="onSubjectSelected()" placeholder="Выберите курс">
            <mat-option *ngFor="let subject of subjects" [value]="subject.id">
              {{ subject.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Шаг 2: Выбор теста -->
      <div *ngIf="step === 2" class="glass-card selection-card">
        <div class="card-header-bar">
          <button type="button" class="btn-icon-pill" (click)="goToStep(1)">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <h2 class="section-title">Шаг 2: Выберите тест</h2>
        </div>
        <p class="section-desc">Выберите работу или проект для проверки ответов сокурсников</p>
        <mat-form-field appearance="outline" class="clean-field full-width">
          <mat-label>Тест / Задание</mat-label>
          <mat-select [(ngModel)]="selectedTestId" (selectionChange)="onTestSelected()" placeholder="Выберите тест">
            <mat-option *ngFor="let test of tests" [value]="test.id">
              {{ test.title }}
            </mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Шаг 3: Дашборд рецензирования (Работы на проверку и Рецензии на мою работу) -->
      <div *ngIf="step === 3" class="glass-card selection-card">
        <div class="card-header-bar">
          <button type="button" class="btn-icon-pill" (click)="goToStep(2)">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="step-title-wrap">
            <h2 class="section-title">Шаг 3: Дашборд кросс-проверки</h2>
            <span class="anonymity-subtext">{{ getSelectedTestTitle() }}</span>
          </div>
        </div>

        <!-- Dashboard Sub-Tabs -->
        <div class="dashboard-tabs-bar">
          <button type="button" 
                  class="dash-tab-btn" 
                  [class.active]="activeTab === 'to_review'" 
                  (click)="activeTab = 'to_review'">
            <mat-icon>assignment_turned_in</mat-icon>
            <span>Работы на проверку</span>
            <span class="tab-badge" [class.badge-done]="getReviewedCount() >= submissionsForReview.length && submissionsForReview.length > 0">
              {{ getReviewedCount() }}/{{ submissionsForReview.length }}
            </span>
          </button>

          <button type="button" 
                  class="dash-tab-btn" 
                  [class.active]="activeTab === 'my_reviews'" 
                  (click)="activeTab = 'my_reviews'">
            <mat-icon>rate_review</mat-icon>
            <span>Рецензии на мою работу</span>
            <span class="tab-badge" *ngIf="myReviews.length > 0">
              {{ myReviews.length }}
            </span>
          </button>
        </div>

        <!-- TAB 1: РАБОТЫ НА ПРОВЕРКУ -->
        <div *ngIf="activeTab === 'to_review'" class="tab-panel-content">
          <div class="distribution-info-banner">
            <div class="info-banner-left">
              <div class="info-progress-title">
                Прогресс взаимной проверки: <strong>{{ getReviewedCount() }} из {{ submissionsForReview.length }} проверено</strong>
              </div>
              <div class="info-progress-bar">
                <div class="info-progress-fill" [style.width.%]="submissionsForReview.length > 0 ? (getReviewedCount() / submissionsForReview.length * 100) : 0"></div>
              </div>
            </div>
            <span class="info-banner-tag">
              <mat-icon>shuffle</mat-icon>
              K = 2 циклический сдвиг
            </span>
          </div>

          <div *ngIf="submissionsForReview.length === 0" class="empty-works-box">
            <mat-icon class="empty-icon">task_alt</mat-icon>
            <h3>Нет доступных работ для проверки</h3>
            <p>Либо другие студенты пока не отправили решения на этот тест, либо все сданные работы уже получили необходимое число рецензий.</p>
          </div>

          <div class="submissions-cards-grid" *ngIf="submissionsForReview.length > 0">
            <div *ngFor="let submission of submissionsForReview; let i = index" 
                 class="submission-review-card"
                 [class.card-reviewed]="submission.reviewed_by_me"
                 (click)="onSubmissionSelected(submission, i)">
              <div class="work-badge-row">
                <span class="anonymous-work-tag">
                  <mat-icon>person_outline</mat-icon>
                  {{ submission.anonymous_title || ('Работа на проверку #' + (i + 1)) }}
                </span>
                <span class="review-status-pill" [class.reviewed]="submission.reviewed_by_me">
                  <span *ngIf="submission.reviewed_by_me">✓ Проверено ({{ submission.my_review?.avg_score }} ★)</span>
                  <span *ngIf="!submission.reviewed_by_me">Ожидает проверки</span>
                </span>
              </div>

              <div class="work-assignment-text" *ngIf="submission.assignment">
                <strong>Задание:</strong> {{ submission.assignment }}
              </div>

              <div class="work-meta-row">
                <span class="meta-item">
                  <mat-icon>article</mat-icon>
                  {{ submission.answers?.length || 0 }} ответов
                </span>
                <span class="meta-item" *ngIf="submission.total_max">
                  <mat-icon>score</mat-icon>
                  {{ submission.total_score }} / {{ submission.total_max }} баллов
                </span>
              </div>

              <div class="card-bottom-action">
                <span class="action-prompt" *ngIf="!submission.reviewed_by_me">Оценить работу</span>
                <span class="action-prompt prompt-edit" *ngIf="submission.reviewed_by_me">Редактировать оценку</span>
                <mat-icon>arrow_forward</mat-icon>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 2: РЕЦЕНЗИИ НА МОЮ РАБОТУ -->
        <div *ngIf="activeTab === 'my_reviews'" class="tab-panel-content">
          <div *ngIf="myReviewsLoading" class="reviews-loading-box">
            <p>Загрузка рецензий...</p>
          </div>

          <div *ngIf="!myReviewsLoading && myReviews.length === 0" class="empty-works-box">
            <mat-icon class="empty-icon">hourglass_empty</mat-icon>
            <h3>Пока нет рецензий на вашу работу</h3>
            <p>Когда сокурсники проверят ваше решение, здесь появятся их оценки по критериям и комментарии.</p>
          </div>

          <div *ngIf="!myReviewsLoading && myReviews.length > 0" class="my-reviews-wrapper">
            <!-- Overall Score Banner -->
            <div class="score-summary-banner">
              <div class="summary-score-big">
                <span class="big-num">{{ getMyAveragePeerScore() }}</span>
                <div class="score-stars">
                  <mat-icon>star</mat-icon>
                  <span class="scale-text">из 5.0</span>
                </div>
              </div>
              <div class="summary-text-col">
                <span class="summary-title">Средняя оценка сокурсников</span>
                <span class="summary-sub">Получено {{ myReviews.length }} {{ myReviews.length === 1 ? 'рецензия' : 'рецензии' }} от анонимных проверяющих</span>
              </div>
            </div>

            <!-- List of Peer Reviews -->
            <div class="peer-reviews-list">
              <div *ngFor="let rev of myReviews; let idx = index" class="peer-review-item-card">
                <div class="rev-header">
                  <div class="rev-author-badge">
                    <mat-icon>shield</mat-icon>
                    <span>{{ rev.reviewer || ('Рецензент #' + (idx + 1)) }}</span>
                  </div>
                  <div class="rev-score-pill">
                    <mat-icon>star</mat-icon>
                    <span>{{ rev.avg_score }} / 5.0</span>
                  </div>
                </div>

                <div class="rev-criteria-chips">
                  <div class="crit-chip">
                    <span class="crit-lbl">Соответствие:</span>
                    <strong>{{ rev.relevance }}/5</strong>
                  </div>
                  <div class="crit-chip">
                    <span class="crit-lbl">Структура:</span>
                    <strong>{{ rev.structure }}/5</strong>
                  </div>
                  <div class="crit-chip">
                    <span class="crit-lbl">Аргументация:</span>
                    <strong>{{ rev.argument }}/5</strong>
                  </div>
                  <div class="crit-chip">
                    <span class="crit-lbl">Ясность:</span>
                    <strong>{{ rev.clarity }}/5</strong>
                  </div>
                </div>

                <div class="rev-comment-box" *ngIf="rev.comment">
                  <div class="comment-quote-icon">“</div>
                  <p class="comment-text">{{ rev.comment }}</p>
                </div>
                <div class="rev-no-comment" *ngIf="!rev.comment">
                  <em>Рецензент не оставил текстового комментария</em>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Шаг 4: Форма рецензирования и оценки -->
      <div *ngIf="step === 4" class="glass-card review-step-card">
        <div class="card-header-bar">
          <button type="button" class="btn-icon-pill" (click)="goToStep(3)">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="step-title-wrap">
            <h2 class="section-title">Шаг 4: Оценка работы #{{ selectedSubmissionIndex + 1 }}</h2>
            <span class="anonymity-subtext">Личность автора полностью скрыта для обеспечения объективности</span>
          </div>
        </div>

        <div *ngIf="selectedSubmission" class="submission-content-wrapper">
          <!-- Submission Meta -->
          <div class="submission-summary-box">
            <div class="summary-item">
              <span class="summary-label">Объект проверки:</span>
              <span class="summary-val">Анонимная работа #{{ selectedSubmissionIndex + 1 }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Баллы автора:</span>
              <span class="summary-val">{{ selectedSubmission.total_score }} / {{ selectedSubmission.total_max }}</span>
            </div>
            <div class="summary-item" *ngIf="selectedSubmission.assignment">
              <span class="summary-label">Задание:</span>
              <span class="summary-val">{{ selectedSubmission.assignment }}</span>
            </div>
          </div>

          <!-- Answers Section -->
          <div class="answers-container">
            <h3 class="answers-heading">
              <mat-icon>article</mat-icon>
              Ответы автора:
            </h3>
            <div *ngIf="selectedSubmission.answers && selectedSubmission.answers.length > 0" class="answers-list">
              <div *ngFor="let answer of selectedSubmission.answers; let idx = index" class="answer-item-card">
                <div class="answer-q-header">
                  <span class="q-badge">Вопрос {{ idx + 1 }}</span>
                  <span class="q-id-text">{{ answer.question_id }}</span>
                </div>
                <div class="answer-body-text">{{ answer.answer || '— (Ответ отсутствует)' }}</div>
              </div>
            </div>
            <div *ngIf="!selectedSubmission.answers || selectedSubmission.answers.length === 0" class="no-answers-box">
              <p>Текстовые ответы отсутствуют в данной работе.</p>
            </div>
          </div>

          <!-- Criteria Rating Form -->
          <form [formGroup]="reviewForm!" *ngIf="reviewForm" class="criteria-form">
            <h3 class="criteria-heading">
              <mat-icon>grade</mat-icon>
              Оценка по критериям (от 1 до 5)
            </h3>

            <div class="criteria-grid">
              <!-- Criterion 1 -->
              <div class="criterion-card">
                <div class="criterion-header">
                  <span class="criterion-name">Соответствие заданию</span>
                  <span class="criterion-score-badge">{{ getCriterionScore('relevance') }} / 5</span>
                </div>
                <p class="criterion-desc">Насколько полно и точно раскрыта суть поставленной задачи?</p>
                <div class="score-pills-row">
                  <button type="button" *ngFor="let n of [1, 2, 3, 4, 5]"
                          class="score-pill-btn"
                          [class.selected]="getCriterionScore('relevance') === n"
                          (click)="setCriterionScore('relevance', n)">
                    {{ n }}
                  </button>
                </div>
              </div>

              <!-- Criterion 2 -->
              <div class="criterion-card">
                <div class="criterion-header">
                  <span class="criterion-name">Структура и логика</span>
                  <span class="criterion-score-badge">{{ getCriterionScore('structure') }} / 5</span>
                </div>
                <p class="criterion-desc">Последовательность мыслей, связность и структурированность изложения</p>
                <div class="score-pills-row">
                  <button type="button" *ngFor="let n of [1, 2, 3, 4, 5]"
                          class="score-pill-btn"
                          [class.selected]="getCriterionScore('structure') === n"
                          (click)="setCriterionScore('structure', n)">
                    {{ n }}
                  </button>
                </div>
              </div>

              <!-- Criterion 3 -->
              <div class="criterion-card">
                <div class="criterion-header">
                  <span class="criterion-name">Аргументация / примеры</span>
                  <span class="criterion-score-badge">{{ getCriterionScore('argument') }} / 5</span>
                </div>
                <p class="criterion-desc">Наличие убедительных фактов, практических примеров и доказательств</p>
                <div class="score-pills-row">
                  <button type="button" *ngFor="let n of [1, 2, 3, 4, 5]"
                          class="score-pill-btn"
                          [class.selected]="getCriterionScore('argument') === n"
                          (click)="setCriterionScore('argument', n)">
                    {{ n }}
                  </button>
                </div>
              </div>

              <!-- Criterion 4 -->
              <div class="criterion-card">
                <div class="criterion-header">
                  <span class="criterion-name">Ясность изложения</span>
                  <span class="criterion-score-badge">{{ getCriterionScore('clarity') }} / 5</span>
                </div>
                <p class="criterion-desc">Грамотность, аккуратность оформления и понятность языка</p>
                <div class="score-pills-row">
                  <button type="button" *ngFor="let n of [1, 2, 3, 4, 5]"
                          class="score-pill-btn"
                          [class.selected]="getCriterionScore('clarity') === n"
                          (click)="setCriterionScore('clarity', n)">
                    {{ n }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Comment Area -->
            <div class="comment-field-wrapper">
              <mat-form-field appearance="outline" class="clean-field full-width">
                <mat-label>Конструктивный комментарий или совет (опционально)</mat-label>
                <textarea matInput formControlName="comment" rows="3" placeholder="Что сокурсник сделал отлично, а что можно улучшить?"></textarea>
              </mat-form-field>
            </div>

            <!-- Summary Average & Actions -->
            <div class="review-bottom-bar">
              <div class="average-score-tag">
                <mat-icon>star</mat-icon>
                <span>Средняя оценка: <strong>{{ getAverageScore() }}</strong> / 5.0</span>
              </div>
              <div class="actions-buttons">
                <button type="button" class="pill-btn pill-btn-outline" (click)="goToStep(3)">Отмена</button>
                <button type="button" class="pill-btn pill-btn-dark" (click)="submitReview()" [disabled]="!reviewForm.valid">
                  <mat-icon>send</mat-icon>
                  <span>Отправить отзыв (+1 очко)</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .peer-review-container {
      max-width: 1080px;
      margin: 0 auto;
      padding: 24px 20px 60px;
      font-family: 'Inter', sans-serif;
    }

    .header-section {
      margin-bottom: 28px;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .page-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 34px;
      font-weight: 400;
      color: #09090b;
      margin: 0;
      line-height: 1.1;
    }

    .anonymity-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
      font-size: 12.5px;
      font-weight: 600;
    }

    .anonymity-badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      line-height: 16px;
    }

    .page-subtitle {
      font-size: 14.5px;
      color: #52525b;
      line-height: 1.5;
      margin: 8px 0 24px 0;
    }

    /* Stepper */
    .steps-nav {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .step-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 16px;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(0, 0, 0, 0.08);
      font-size: 13px;
      color: #71717a;
      transition: all 0.2s ease;
      user-select: none;
    }

    .step-pill.active {
      background: #18181b;
      color: #ffffff;
      border-color: #18181b;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .step-pill.active .step-num {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }

    .step-pill.completed {
      cursor: pointer;
      color: #18181b;
      background: rgba(255, 255, 255, 0.95);
      border-color: rgba(0, 0, 0, 0.15);
    }

    .step-num {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
    }

    .step-divider {
      flex: 1;
      max-width: 24px;
      height: 1px;
      background: rgba(0, 0, 0, 0.12);
    }

    /* Glass card */
    .glass-card {
      background: rgba(255, 255, 255, 0.78);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 20px;
      padding: 28px;
      box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.04);
    }

    .card-header-bar {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
    }

    .btn-icon-pill {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
      color: #18181b;
    }

    .btn-icon-pill:hover {
      background: #18181b;
      color: #ffffff;
    }

    .section-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 24px;
      font-weight: 400;
      color: #09090b;
      margin: 0;
    }

    .section-desc {
      color: #71717a;
      font-size: 14px;
      margin: 0 0 20px 0;
    }

    .full-width {
      width: 100%;
    }

    /* Empty state */
    .empty-works-box {
      text-align: center;
      padding: 48px 24px;
      color: #71717a;
    }

    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #10b981;
      margin-bottom: 12px;
    }

    .empty-works-box h3 {
      font-size: 18px;
      font-weight: 600;
      color: #18181b;
      margin-bottom: 8px;
    }

    .empty-works-box p {
      font-size: 14px;
      max-width: 460px;
      margin: 0 auto;
      line-height: 1.5;
    }

    /* Cards grid */
    .submissions-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }

    .submission-review-card {
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 16px;
      padding: 18px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .submission-review-card:hover {
      transform: translateY(-2px);
      border-color: #18181b;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
    }

    .work-badge-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .anonymous-work-tag {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      font-size: 14.5px;
      color: #18181b;
    }

    .anonymous-work-tag mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #71717a;
    }

    .score-pill-tag {
      background: #f4f4f5;
      color: #3f3f46;
      font-size: 12px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 12px;
    }

    .work-assignment-text {
      font-size: 13.5px;
      color: #52525b;
      line-height: 1.4;
    }

    .card-bottom-action {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: auto;
      font-size: 13px;
      font-weight: 600;
      color: #18181b;
      padding-top: 10px;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
    }

    .card-bottom-action mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      transition: transform 0.15s ease;
    }

    .submission-review-card:hover .card-bottom-action mat-icon {
      transform: translateX(4px);
    }

    /* Dashboard Tabs */
    .dashboard-tabs-bar {
      display: flex;
      gap: 10px;
      margin-bottom: 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      padding-bottom: 14px;
      flex-wrap: wrap;
    }

    .dash-tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(0, 0, 0, 0.1);
      font-size: 13.5px;
      font-weight: 500;
      color: #52525b;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .dash-tab-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .dash-tab-btn:hover {
      background: #ffffff;
      color: #18181b;
    }

    .dash-tab-btn.active {
      background: #18181b;
      color: #ffffff;
      border-color: #18181b;
    }

    .tab-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.08);
      color: #18181b;
    }

    .dash-tab-btn.active .tab-badge {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }

    .tab-badge.badge-done {
      background: #10b981;
      color: #ffffff;
    }

    /* Distribution banner */
    .distribution-info-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 14px 18px;
      margin-bottom: 20px;
    }

    .info-banner-left {
      flex: 1;
      min-width: 200px;
    }

    .info-progress-title {
      font-size: 13.5px;
      color: #334155;
      margin-bottom: 6px;
    }

    .info-progress-bar {
      height: 6px;
      border-radius: 3px;
      background: #e2e8f0;
      overflow: hidden;
    }

    .info-progress-fill {
      height: 100%;
      background: #10b981;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .info-banner-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 4px 10px;
    }

    .info-banner-tag mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
    }

    /* Card reviewed states */
    .submission-review-card.card-reviewed {
      border-color: #bbf7d0;
      background: rgba(240, 253, 244, 0.6);
    }

    .review-status-pill {
      font-size: 11.5px;
      font-weight: 600;
      padding: 3px 9px;
      border-radius: 12px;
      background: #fef3c7;
      color: #92400e;
    }

    .review-status-pill.reviewed {
      background: #dcfce7;
      color: #15803d;
    }

    .prompt-edit {
      color: #15803d;
    }

    .work-meta-row {
      display: flex;
      gap: 14px;
      font-size: 12.5px;
      color: #71717a;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .meta-item mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
    }

    /* My reviews tab styles */
    .score-summary-banner {
      display: flex;
      align-items: center;
      gap: 20px;
      background: linear-gradient(135deg, #18181b 0%, #27272a 100%);
      color: #ffffff;
      border-radius: 16px;
      padding: 22px 26px;
      margin-bottom: 22px;
    }

    .summary-score-big {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .big-num {
      font-size: 38px;
      font-weight: 700;
      line-height: 1;
    }

    .score-stars {
      display: flex;
      align-items: center;
      gap: 2px;
      color: #f59e0b;
    }

    .scale-text {
      font-size: 13px;
      color: #a1a1aa;
      margin-left: 4px;
    }

    .summary-title {
      font-size: 16px;
      font-weight: 600;
      display: block;
      margin-bottom: 4px;
    }

    .summary-sub {
      font-size: 13px;
      color: #a1a1aa;
    }

    .peer-reviews-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .peer-review-item-card {
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.02);
    }

    .rev-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }

    .rev-author-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 600;
      color: #18181b;
    }

    .rev-author-badge mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #10b981;
    }

    .rev-score-pill {
      display: flex;
      align-items: center;
      gap: 4px;
      background: #fef3c7;
      color: #92400e;
      font-size: 13px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 12px;
    }

    .rev-score-pill mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      color: #f59e0b;
    }

    .rev-criteria-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
    }

    .crit-chip {
      background: #f4f4f5;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 12px;
      color: #3f3f46;
      display: flex;
      gap: 4px;
    }

    .crit-lbl {
      color: #71717a;
    }

    .rev-comment-box {
      background: #fafafa;
      border-left: 3px solid #18181b;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      position: relative;
    }

    .comment-quote-icon {
      font-size: 24px;
      line-height: 1;
      color: #d4d4d8;
      font-family: serif;
      margin-bottom: -6px;
    }

    .comment-text {
      font-size: 13.5px;
      color: #27272a;
      line-height: 1.5;
      margin: 0;
    }

    .rev-no-comment {
      font-size: 12.5px;
      color: #a1a1aa;
    }

    .reviews-loading-box {
      text-align: center;
      padding: 30px;
      color: #71717a;
    }

    /* Step 4 Review details */
    .step-title-wrap {
      display: flex;
      flex-direction: column;
    }

    .anonymity-subtext {
      font-size: 12px;
      color: #71717a;
      margin-top: 2px;
    }

    .submission-summary-box {
      background: rgba(255, 255, 255, 0.6);
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 14px;
      padding: 14px 18px;
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }

    .summary-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13.5px;
    }

    .summary-label {
      color: #71717a;
    }

    .summary-val {
      font-weight: 600;
      color: #18181b;
    }

    .answers-container {
      margin-bottom: 28px;
    }

    .answers-heading, .criteria-heading {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #18181b;
      margin: 0 0 14px 0;
    }

    .answers-heading mat-icon, .criteria-heading mat-icon {
      color: #71717a;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .answers-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .answer-item-card {
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(0, 0, 0, 0.07);
      border-radius: 12px;
      padding: 16px;
    }

    .answer-q-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .q-badge {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: #18181b;
      color: #ffffff;
      padding: 2px 8px;
      border-radius: 6px;
    }

    .q-id-text {
      font-size: 12.5px;
      color: #71717a;
    }

    .answer-body-text {
      font-size: 14.5px;
      line-height: 1.6;
      color: #27272a;
      white-space: pre-wrap;
    }

    .no-answers-box {
      padding: 20px;
      background: rgba(0, 0, 0, 0.02);
      border-radius: 10px;
      color: #71717a;
      font-size: 13.5px;
    }

    /* Criteria */
    .criteria-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }

    .criterion-card {
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 14px;
      padding: 16px;
    }

    .criterion-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .criterion-name {
      font-weight: 600;
      font-size: 14px;
      color: #18181b;
    }

    .criterion-score-badge {
      font-size: 12px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
      background: #f4f4f5;
      color: #18181b;
    }

    .criterion-desc {
      font-size: 12.5px;
      color: #71717a;
      margin: 0 0 12px 0;
      line-height: 1.4;
    }

    .score-pills-row {
      display: flex;
      gap: 8px;
    }

    .score-pill-btn {
      flex: 1;
      height: 36px;
      border-radius: 10px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      background: #ffffff;
      color: #3f3f46;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .score-pill-btn:hover {
      border-color: #18181b;
      background: #fafafa;
    }

    .score-pill-btn.selected {
      background: #18181b;
      color: #ffffff;
      border-color: #18181b;
    }

    .comment-field-wrapper {
      margin-top: 8px;
      margin-bottom: 20px;
    }

    .review-bottom-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      padding-top: 16px;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
    }

    .average-score-tag {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14.5px;
      color: #18181b;
    }

    .average-score-tag mat-icon {
      color: #f59e0b;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .actions-buttons {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .pill-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 22px;
      border-radius: 24px;
      font-size: 13.5px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      border: none;
    }

    .pill-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .pill-btn-dark {
      background: #18181b;
      color: #ffffff;
    }

    .pill-btn-dark:hover:not(:disabled) {
      background: #27272a;
      transform: translateY(-1px);
    }

    .pill-btn-dark:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .pill-btn-outline {
      background: #ffffff;
      color: #3f3f46;
      border: 1px solid rgba(0, 0, 0, 0.15);
    }

    .pill-btn-outline:hover {
      background: #f4f4f5;
    }

    @media (max-width: 768px) {
      .criteria-grid {
        grid-template-columns: 1fr;
      }
      .review-bottom-bar {
        flex-direction: column;
        align-items: stretch;
      }
      .actions-buttons {
        flex-direction: column;
      }
      .actions-buttons button {
        width: 100%;
      }
    }
  `]
})
export class PeerReviewComponent implements OnInit {
  subjects: any[] = [];
  tests: any[] = [];
  submissionsForReview: any[] = [];
  selectedSubjectId: string = '';
  selectedTestId: string = '';
  selectedSubmission: any = null;
  selectedSubmissionIndex: number = 0;
  reviewForm: FormGroup | null = null;
  currentUser: string = '';
  step: number = 1; // 1 - выбор курса, 2 - выбор теста, 3 - дашборд работ, 4 - форма оценки
  activeTab: 'to_review' | 'my_reviews' = 'to_review';
  myReviews: any[] = [];
  myReviewsLoading: boolean = false;

  constructor(
    private apiService: ApiService, 
    private auth: AuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar
  ) {
  }

  ngOnInit() {
    const user = this.auth.getCurrentUser();
    this.currentUser = user?.name || '';
    if (!this.currentUser) {
      this.snackBar.open('Войдите, чтобы проверять работы', 'Закрыть', { duration: 3000 });
      return;
    }
    this.loadSubjects();
  }

  goToStep(stepNumber: number) {
    this.step = stepNumber;
    if (stepNumber === 1) {
      this.selectedSubjectId = '';
      this.selectedTestId = '';
      this.selectedSubmission = null;
      this.tests = [];
      this.submissionsForReview = [];
      this.myReviews = [];
    } else if (stepNumber === 2) {
      this.selectedTestId = '';
      this.selectedSubmission = null;
      this.submissionsForReview = [];
      this.myReviews = [];
    } else if (stepNumber === 3) {
      this.selectedSubmission = null;
      this.reviewForm = null;
    }
  }

  loadSubjects() {
    this.apiService.getSubjects().subscribe({
      next: (subjects) => {
        this.subjects = subjects || [];
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading subjects:', err);
        this.subjects = [];
        this.cdr.markForCheck();
      }
    });
  }

  onSubjectSelected() {
    if (!this.selectedSubjectId) return;
    this.loadTests();
  }

  loadTests() {
    if (!this.selectedSubjectId) return;
    
    this.apiService.getTests(this.selectedSubjectId).subscribe({
      next: (tests) => {
        this.tests = tests;
        if (tests.length > 0) {
          this.step = 2;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading tests:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onTestSelected() {
    if (!this.selectedTestId) return;
    this.loadSubmissionsForReview();
  }

  loadSubmissionsForReview() {
    if (!this.selectedTestId) return;
    if (!this.currentUser) {
      this.snackBar.open('Войдите, чтобы проверять работы', 'Закрыть', { duration: 3000 });
      return;
    }

    this.apiService.getSubmissionsForReview(this.selectedTestId, this.currentUser).subscribe({
      next: (submissions) => {
        this.submissionsForReview = submissions || [];
        this.step = 3;
        this.loadMyReviews();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading submissions:', err);
        this.submissionsForReview = [];
        this.loadMyReviews();
        this.step = 3;
        this.cdr.markForCheck();
      }
    });
  }

  loadMyReviews() {
    if (!this.selectedTestId || !this.currentUser) return;
    this.myReviewsLoading = true;
    this.apiService.getMyReviews(this.currentUser, this.selectedTestId).subscribe({
      next: (reviews) => {
        this.myReviews = reviews || [];
        this.myReviewsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading my reviews:', err);
        this.myReviews = [];
        this.myReviewsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  getReviewedCount(): number {
    return this.submissionsForReview.filter(s => s.reviewed_by_me).length;
  }

  getMyAveragePeerScore(): number {
    if (!this.myReviews || this.myReviews.length === 0) return 0;
    const sum = this.myReviews.reduce((acc, r) => acc + (r.avg_score || 0), 0);
    return Math.round((sum / this.myReviews.length) * 10) / 10;
  }

  getSelectedTestTitle(): string {
    const t = this.tests.find(x => x.id === this.selectedTestId);
    return t ? t.title : 'Тест / Задание';
  }

  onSubmissionSelected(submission: any, index: number = 0) {
    this.selectedSubmission = submission;
    this.selectedSubmissionIndex = index;
    this.step = 4;
    
    // Создаем форму с начальными значениями (или ранее выставленными)
    this.initializeForm();
  }

  setCriterionScore(criterion: string, score: number) {
    if (this.reviewForm) {
      this.reviewForm.get(criterion)?.setValue(score);
    }
  }

  getCriterionScore(criterion: string): number {
    return this.reviewForm?.get(criterion)?.value || 1;
  }

  initializeForm() {
    const existing = this.selectedSubmission?.my_review;
    this.reviewForm = this.fb.group({
      relevance: [existing?.relevance || 1, [Validators.required, Validators.min(1), Validators.max(5)]],
      structure: [existing?.structure || 1, [Validators.required, Validators.min(1), Validators.max(5)]],
      argument: [existing?.argument || 1, [Validators.required, Validators.min(1), Validators.max(5)]],
      clarity: [existing?.clarity || 1, [Validators.required, Validators.min(1), Validators.max(5)]],
      comment: [existing?.comment || '']
    });
    
    // Подписываемся на изменения значений для автоматического обновления отображения
    this.reviewForm.valueChanges.subscribe(() => {
      this.cdr.detectChanges();
    });
  }

  validateScore(controlName: string) {
    // Валидация и корректировка значения при потере фокуса
    if (this.reviewForm) {
      const control = this.reviewForm.get(controlName);
      if (control) {
        let value = control.value;
        if (value === null || value === undefined || value === '') {
          value = 1;
        } else {
          value = Number(value);
          if (isNaN(value) || value < 1) {
            value = 1;
          } else if (value > 5) {
            value = 5;
          }
        }
        control.setValue(value, { emitEvent: true });
      }
    }
  }

  getAverageScore(): number {
    if (!this.reviewForm) return 0;
    
    const relevance = this.reviewForm.get('relevance')?.value || 1;
    const structure = this.reviewForm.get('structure')?.value || 1;
    const argument = this.reviewForm.get('argument')?.value || 1;
    const clarity = this.reviewForm.get('clarity')?.value || 1;
    
    return Math.round(((relevance + structure + argument + clarity) / 4) * 100) / 100;
  }

  submitReview() {
    if (!this.currentUser) {
      this.snackBar.open('Войдите, чтобы отправить отзыв', 'Закрыть', { duration: 3000 });
      return;
    }
    
    if (!this.reviewForm || !this.reviewForm.valid) {
      this.snackBar.open('Пожалуйста, заполните все поля оценки', 'Закрыть', { duration: 3000 });
      return;
    }

    if (!this.selectedSubmission) {
      this.snackBar.open('Работа не выбрана', 'Закрыть', { duration: 3000 });
      return;
    }

    const review = {
      submission_id: this.selectedSubmission.id,
      assignment_id: this.selectedTestId,
      reviewer: this.currentUser,
      relevance: this.reviewForm.get('relevance')?.value,
      structure: this.reviewForm.get('structure')?.value,
      argument: this.reviewForm.get('argument')?.value,
      clarity: this.reviewForm.get('clarity')?.value,
      comment: this.reviewForm.get('comment')?.value || ''
    };

    this.apiService.createReview(review).subscribe({
      next: () => {
        this.snackBar.open('Отзыв сохранен! Вам начислено +1 очко за кросс-проверку.', 'Отлично', { duration: 4000 });
        // Возвращаемся к дашборду
        this.goToStep(3);
        // Перезагружаем список
        this.loadSubmissionsForReview();
      },
      error: (err) => {
        console.error('Error creating review:', err);
        this.snackBar.open('Ошибка при сохранении отзыва: ' + (err.error?.detail || err.message), 'Закрыть', { duration: 5000 });
      }
    });
  }
}
