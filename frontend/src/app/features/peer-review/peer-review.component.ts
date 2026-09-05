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
    MatTabsModule
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
        <mat-form-field appearance="outline" class="clean-field full-width">
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

      <!-- Шаг 3: Список анонимных работ -->
      <div *ngIf="step === 3" class="glass-card selection-card">
        <div class="card-header-bar">
          <button type="button" class="btn-icon-pill" (click)="goToStep(2)">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <h2 class="section-title">Шаг 3: Выберите работу для рецензии</h2>
        </div>
        
        <div *ngIf="submissionsForReview.length === 0" class="empty-works-box">
          <mat-icon class="empty-icon">task_alt</mat-icon>
          <h3>Нет доступных работ для проверки</h3>
          <p>Либо все сданные работы уже оценены, либо другие студенты пока не отправили свои решения на этот тест.</p>
        </div>

        <div class="submissions-cards-grid" *ngIf="submissionsForReview.length > 0">
          <div *ngFor="let submission of submissionsForReview; let i = index" 
               class="submission-review-card"
               (click)="onSubmissionSelected(submission, i)">
            <div class="work-badge-row">
              <span class="anonymous-work-tag">
                <mat-icon>person_outline</mat-icon>
                Работа сокурсника #{{ i + 1 }}
              </span>
              <span class="score-pill-tag">
                {{ submission.total_score }} / {{ submission.total_max }} баллов
              </span>
            </div>
            <div class="work-assignment-text" *ngIf="submission.assignment">
              <strong>Задание:</strong> {{ submission.assignment }}
            </div>
            <div class="card-bottom-action">
              <span class="action-prompt">Оценить работу</span>
              <mat-icon>arrow_forward</mat-icon>
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
  step: number = 1; // 1 - выбор курса, 2 - выбор теста, 3 - выбор пользователя, 4 - форма оценки

  constructor(
    private apiService: ApiService, 
    private auth: AuthService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    // Не создаем форму в конструкторе, создадим позже
  }

  ngOnInit() {
    const user = this.auth.getCurrentUser();
    this.currentUser = user?.name || '';
    if (!this.currentUser) {
      alert('Войдите, чтобы проверять работы');
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
    } else if (stepNumber === 2) {
      this.selectedTestId = '';
      this.selectedSubmission = null;
      this.submissionsForReview = [];
    } else if (stepNumber === 3) {
      this.selectedSubmission = null;
      this.reviewForm = null;
    }
  }

  loadSubjects() {
    this.apiService.getSubjects().subscribe({
      next: (subjects) => {
        this.subjects = subjects;
      },
      error: (err) => console.error('Error loading subjects:', err)
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
      },
      error: (err) => console.error('Error loading tests:', err)
    });
  }

  onTestSelected() {
    if (!this.selectedTestId) return;
    this.loadSubmissionsForReview();
  }

  loadSubmissionsForReview() {
    if (!this.selectedTestId) return;
    if (!this.currentUser) {
      alert('Войдите, чтобы проверять работы');
      return;
    }

    this.apiService.getSubmissionsForReview(this.selectedTestId, this.currentUser).subscribe({
      next: (submissions) => {
        // Фильтруем только завершенные работы
        this.submissionsForReview = submissions.filter(s => s.is_finished === 'true');
        this.step = 3;
      },
      error: (err) => {
        console.error('Error loading submissions:', err);
        this.submissionsForReview = [];
      }
    });
  }

  onSubmissionSelected(submission: any, index: number = 0) {
    this.selectedSubmission = submission;
    this.selectedSubmissionIndex = index;
    this.step = 4;
    
    // Создаем форму сразу с начальными значениями
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
    // Создаем форму с начальными значениями 1
    this.reviewForm = this.fb.group({
      relevance: [1, [Validators.required, Validators.min(1), Validators.max(5)]],
      structure: [1, [Validators.required, Validators.min(1), Validators.max(5)]],
      argument: [1, [Validators.required, Validators.min(1), Validators.max(5)]],
      clarity: [1, [Validators.required, Validators.min(1), Validators.max(5)]],
      comment: ['']
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
      alert('Войдите, чтобы отправить отзыв');
      return;
    }
    
    if (!this.reviewForm || !this.reviewForm.valid) {
      alert('Пожалуйста, заполните все поля оценки');
      return;
    }

    if (!this.selectedSubmission) {
      alert('Работа не выбрана');
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
        alert('Отзыв сохранен! Вам начислено +1 очко за кросс-проверку.');
        // Возвращаемся к списку пользователей
        this.goToStep(3);
        // Перезагружаем список, чтобы исключить проверенную работу (если нужно)
        this.loadSubmissionsForReview();
      },
      error: (err) => {
        console.error('Error creating review:', err);
        alert('Ошибка при сохранении отзыва: ' + (err.error?.detail || err.message));
      }
    });
  }
}
