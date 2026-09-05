import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

@Component({
  selector: 'app-submission-results',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatListModule,
    MatChipsModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormsModule,
    MatIconModule
  ],
  template: `
    <div class="results-container" *ngIf="results">
      <div class="results-content">
        <div class="results-header">
          <div class="header-main">
            <h1 class="results-title">Результаты теста</h1>
            <div class="status-badge" [ngClass]="results.submission.status" *ngIf="results.submission.status">
              {{ getStatusLabel(results.submission.status) }}
            </div>
          </div>
          
          <div class="version-info" *ngIf="results.submission.version">
            <span class="version-label">Версия {{ results.submission.version }}</span>
            <div class="version-selector" *ngIf="allVersions.length > 1">
              <mat-form-field appearance="outline" class="version-field">
                <mat-label>Другие версии</mat-label>
                <mat-select [ngModel]="results.submission.id" (selectionChange)="switchVersion($event.value)">
                  <mat-option *ngFor="let v of allVersions" [value]="v.id">
                    Версия {{ v.version }} ({{ v.finished_at | date:'dd.MM.yyyy HH:mm' }})
                  </mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </div>
        </div>
        
        <mat-card class="summary-card" [ngClass]="results.submission.status">
          <mat-card-content class="summary-content">
            <div class="summary-info">
              <h2 class="summary-label">Итоговая оценка</h2>
              <div class="score-display" *ngIf="(testType.toLowerCase() !== 'project' && testType.toLowerCase() !== 'keyword_based') || results.submission.status !== 'pending'">
                <span class="score-value">{{ results.submission.total_score }}</span>
                <span class="score-separator">/</span>
                <span class="score-max">{{ results.submission.total_max }}</span>
              </div>
              <div class="score-display" *ngIf="(testType.toLowerCase() === 'project' || testType.toLowerCase() === 'keyword_based') && results.submission.status === 'pending'">
                <span class="score-value-pending">Ожидает проверки</span>
              </div>
              <div class="points-info" *ngIf="testType.toLowerCase() !== 'project' || results.submission.status !== 'pending'">
                <span class="points-label">Начислено очков:</span>
                <span class="points-value">{{ results.submission.points_awarded }}</span>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Teacher Review Panel -->
        <mat-card class="review-panel" *ngIf="isTeacher && results.submission.status === 'pending'">
          <mat-card-header>
            <mat-card-title>Проверка работы</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="project-score-input" *ngIf="testType.toLowerCase() === 'project' || testType.toLowerCase() === 'keyword_based'" style="margin-bottom: 20px;">
              <mat-form-field appearance="outline" class="score-field">
                <mat-label>Итоговый балл (0-{{ results.submission.total_max }})</mat-label>
                <input matInput type="number" [(ngModel)]="projectScore" min="0" [max]="results.submission.total_max">
                <span matSuffix>/ {{ results.submission.total_max }}</span>
                <mat-hint *ngIf="testType.toLowerCase() === 'keyword_based' && results.submission.total_score > 0">
                  Рекомендация ИИ: {{ results.submission.total_score }} баллов
                </mat-hint>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Комментарий преподавателя</mat-label>
              <textarea matInput [(ngModel)]="teacherFeedback" placeholder="Оставьте отзыв или укажите на ошибки..."></textarea>
            </mat-form-field>
          </mat-card-content>
          <mat-card-actions align="end">
            <button mat-stroked-button color="warn" (click)="rejectSubmission()">
              <mat-icon>cancel</mat-icon> Отклонить
            </button>
            <button mat-raised-button color="primary" (click)="approveSubmission()">
              <mat-icon>check_circle</mat-icon> Одобрить
            </button>
          </mat-card-actions>
        </mat-card>

        <!-- Feedback for Student -->
        <mat-card class="feedback-card" *ngIf="results.submission.teacher_feedback">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>comment</mat-icon> Комментарий преподавателя
            </mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p class="feedback-text">{{ results.submission.teacher_feedback }}</p>
          </mat-card-content>
        </mat-card>

        <!-- Peer Reviews Comparison Panel (only for teachers/admins) -->
        <mat-card class="peer-reviews-card" *ngIf="isTeacher && peerReviews && peerReviews.length > 0">
          <mat-card-header>
            <mat-card-title>
              <mat-icon style="margin-right: 8px;">rate_review</mat-icon> Результаты кросс-проверки (оценки одноклассников)
            </mat-card-title>
            <mat-card-subtitle>Всего проверок: {{ peerReviews.length }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="comparison-layout">
              <!-- Column 1: AI Recommendation -->
              <div class="comp-column ai-column">
                <h3>Оценка ИИ</h3>
                <div class="comp-score-display">
                  <span class="comp-score-val">{{ results.submission.total_score }}</span>
                  <span class="comp-score-max">/ {{ results.submission.total_max }}</span>
                </div>
                <p class="comp-hint">Рекомендация на основе ключевых слов/критериев</p>
              </div>

              <!-- Column 2: Peer Review Averages -->
              <div class="comp-column peer-column" *ngIf="averagePeerScores">
                <h3>Средняя оценка одноклассников</h3>
                <div class="comp-score-display">
                  <span class="comp-score-val">{{ averagePeerScores.total }}</span>
                  <span class="comp-score-max">/ 5.00</span>
                </div>
                
                <div class="rubrics-breakdown">
                  <div class="rubric-item">
                    <span class="rubric-label">Соответствие теме:</span>
                    <span class="rubric-val">{{ averagePeerScores.relevance }} / 5</span>
                  </div>
                  <div class="rubric-item">
                    <span class="rubric-label">Структура и логика:</span>
                    <span class="rubric-val">{{ averagePeerScores.structure }} / 5</span>
                  </div>
                  <div class="rubric-item">
                    <span class="rubric-label">Аргументация:</span>
                    <span class="rubric-val">{{ averagePeerScores.argument }} / 5</span>
                  </div>
                  <div class="rubric-item">
                    <span class="rubric-label">Ясность изложения:</span>
                    <span class="rubric-val">{{ averagePeerScores.clarity }} / 5</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- List of Peer Reviews -->
            <div class="peer-comments-section">
              <h3>Отзывы рецензентов</h3>
              <mat-list>
                <mat-list-item *ngFor="let rev of peerReviews" class="peer-review-item">
                  <div matListItemTitle class="reviewer-title">
                    <strong>Рецензент: {{ rev.reviewer || 'Аноним' }}</strong>
                  </div>
                  <div matListItemLine class="reviewer-scores">
                    <span>Соответствие: {{ rev.relevance }}/5</span> | 
                    <span>Структура: {{ rev.structure }}/5</span> | 
                    <span>Аргументы: {{ rev.argument }}/5</span> | 
                    <span>Ясность: {{ rev.clarity }}/5</span>
                  </div>
                  <div matListItemLine class="reviewer-comment" *ngIf="rev.comment">
                    <em>Комментарий:</em> {{ rev.comment }}
                  </div>
                </mat-list-item>
              </mat-list>
            </div>
          </mat-card-content>
        </mat-card>

        <div class="questions-section">
          <h2 class="section-title">Детали по вопросам</h2>
          <mat-card *ngFor="let result of results.per_question_results; let i = index" class="result-card">
            <mat-card-header class="result-header">
              <div class="question-number">Вопрос {{ i + 1 }} из {{ results.per_question_results.length }}</div>
              <div class="question-score" [class.score-full]="result.score === result.max_points" 
                   [class.score-partial]="result.score > 0 && result.score < result.max_points"
                   [class.score-zero]="result.score === 0">
                {{ result.score }} / {{ result.max_points }}
              </div>
            </mat-card-header>
            <mat-card-content class="result-content">
              <h3 class="question-title">{{ result.title }}</h3>
              <div class="test-assets-info" *ngIf="result.test_assets && result.test_assets.length > 0">
                <p class="assets-hint">Ниже приведены файлы задания. Скачайте их для работы:</p>
                <mat-list class="test-assets-list">
                  <mat-list-item *ngFor="let asset of result.test_assets" class="asset-item">
                    <mat-icon matListItemIcon>insert_drive_file</mat-icon>
                    <div matListItemTitle class="asset-title">
                      {{ asset.original_name }}
                      <span class="asset-size">({{ (asset.size / 1024).toFixed(1) }} KB)</span>
                    </div>
                    <div matListItemLine class="asset-actions">
                      <a mat-stroked-button color="primary" [href]="'/api/tests/' + result.test_id + '/assets/' + asset.id + '/download'" target="_blank">
                        <mat-icon>download</mat-icon>
                        Скачать
                      </a>
                    </div>
                  </mat-list-item>
                </mat-list>
              </div>
              
              <div class="answer-section">
                <div class="answer-label">Ваш ответ:</div>
                
                <!-- If JSON structure -->
                <div *ngIf="isJsonAnswer(result.answer)" style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                  <div *ngIf="parseJsonAnswer(result.answer).text" class="answer-text" style="white-space: pre-wrap;">
                    {{ parseJsonAnswer(result.answer).text }}
                  </div>
                  <div *ngIf="parseJsonAnswer(result.answer).external_link" style="margin-top: 4px;">
                    <strong>🔗 Ссылка на проект:</strong>
                    <a [href]="parseJsonAnswer(result.answer).external_link" target="_blank" style="color: #1a73e8; margin-left: 8px; font-weight: 500;">
                      {{ parseJsonAnswer(result.answer).external_link }}
                    </a>
                  </div>
                  <div *ngIf="parseJsonAnswer(result.answer).video_link" style="margin-top: 8px;">
                    <strong>🎥 Видео-презентация:</strong>
                    <div class="video-container" style="margin-top: 4px; max-width: 500px;">
                      <iframe 
                        [src]="getSafeUrl(parseJsonAnswer(result.answer).video_link)" 
                        frameborder="0" 
                        allowfullscreen 
                        style="width: 100%; height: 280px; border-radius: 8px;">
                      </iframe>
                    </div>
                  </div>
                </div>
                
                <!-- If regular text -->
                <div *ngIf="!isJsonAnswer(result.answer)" class="answer-text" style="white-space: pre-wrap;">
                  {{ result.answer || 'Ответ не предоставлен' }}
                </div>
              </div>
              
              <div *ngIf="result.details && result.details.length > 0" class="details-section">
                <div class="section-label">Детали оценки:</div>
                <ul class="details-list">
                  <li *ngFor="let detail of result.details" class="detail-item">{{ detail }}</li>
                </ul>
              </div>

              <!-- AI Feedback for keyword-based / open-ended tests -->
              <div *ngIf="(testType?.toLowerCase() === 'keyword_based' || testType?.toLowerCase() === 'open_ended') && result.ai_feedback" class="ai-feedback-section">
                <div class="section-label">AI-оценка:</div>
                <div class="ai-feedback-content">
                  <div *ngIf="result.ai_feedback.recommended_score !== undefined" class="feedback-item">
                    <span class="feedback-label">Рекомендованный балл:</span>
                    <span class="feedback-value">{{ result.ai_feedback.recommended_score }} / {{ result.max_points }}</span>
                  </div>
                  <div *ngIf="result.ai_feedback.found_keywords && result.ai_feedback.found_keywords.length > 0" class="feedback-item">
                    <div class="feedback-label">Найденные ключевые слова:</div>
                    <div class="chips-container">
                      <mat-chip *ngFor="let kw of result.ai_feedback.found_keywords" class="keyword-chip found">{{ kw }}</mat-chip>
                    </div>
                  </div>
                  <div *ngIf="result.ai_feedback.missing_keywords && result.ai_feedback.missing_keywords.length > 0" class="feedback-item">
                    <div class="feedback-label">Отсутствующие ключевые слова:</div>
                    <div class="chips-container">
                      <mat-chip *ngFor="let kw of result.ai_feedback.missing_keywords" class="keyword-chip missing">{{ kw }}</mat-chip>
                    </div>
                  </div>
                  <div *ngIf="result.ai_feedback.evaluation" class="feedback-item">
                    <span class="feedback-label">Оценка:</span>
                    <span class="feedback-value">{{ result.ai_feedback.evaluation }}</span>
                  </div>
                  <div *ngIf="result.ai_feedback.feedback" class="feedback-item">
                    <div class="feedback-label">Обратная связь:</div>
                    <div class="feedback-text">{{ result.ai_feedback.feedback }}</div>
                  </div>
                </div>
              </div>

              <!-- AI Feedback for multiple choice AI-generated tests -->
              <div *ngIf="testType === 'multiple_choice' && isAiGenerated && result.score < result.max_points" class="ai-materials-section">
                <mat-expansion-panel *ngIf="result.aiFeedback" class="materials-panel">
                  <mat-expansion-panel-header class="materials-panel-header">
                    <mat-panel-title class="materials-panel-title">
                      Показать ответ из материалов
                    </mat-panel-title>
                  </mat-expansion-panel-header>
                  <div class="materials-content">
                    <div *ngIf="result.aiFeedback.materials_info && result.aiFeedback.materials_info.length > 0" class="materials-list-section">
                      <div class="section-label">Материалы, по которым был создан тест:</div>
                      <ul class="materials-list">
                        <li *ngFor="let material of result.aiFeedback.materials_info" class="material-item">
                          {{ material.original_name || material.name }}
                        </li>
                      </ul>
                    </div>
                    <div *ngIf="result.aiFeedback.material_answers && result.aiFeedback.material_answers.length > 0" class="materials-answers-section">
                      <div class="section-label">Ответы из материалов:</div>
                      <div *ngFor="let materialAnswer of result.aiFeedback.material_answers" class="material-answer-item">
                        <div class="material-name">{{ materialAnswer.material_name }}:</div>
                        <div class="material-answer-text">{{ materialAnswer.answer }}</div>
                      </div>
                    </div>
                    <div *ngIf="!result.aiFeedback.material_answers || result.aiFeedback.material_answers.length === 0" class="no-materials">
                      Информация из материалов недоступна
                    </div>
                  </div>
                </mat-expansion-panel>
                <div *ngIf="!result.aiFeedback && !loadingFeedback[i]" class="load-feedback-button">
                  <button mat-stroked-button (click)="loadAiFeedback(i, result)" [disabled]="loadingFeedback[i]">
                    Загрузить ответ из материалов
                  </button>
                </div>
                <div *ngIf="loadingFeedback[i]" class="loading-feedback">
                  <mat-spinner diameter="30"></mat-spinner>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <div class="project-files-section" *ngIf="results.submission.files && results.submission.files.length > 0">
          <h2 class="section-title">Прикрепленные файлы проекта</h2>
          <mat-card class="files-card">
            <mat-list>
              <mat-list-item *ngFor="let file of results.submission.files" class="file-item">
                <mat-icon matListItemIcon>insert_drive_file</mat-icon>
                <div matListItemTitle class="file-title">
                  {{ file.original_name }}
                  <span class="file-size">({{ (file.size / 1024).toFixed(1) }} KB)</span>
                </div>
                <div matListItemLine class="file-actions">
                  <a mat-stroked-button color="primary" [href]="'/api/submissions/' + results.submission.id + '/files/' + file.id + '/download'" target="_blank">
                    <mat-icon>download</mat-icon>
                    Скачать
                  </a>
                </div>
              </mat-list-item>
            </mat-list>
          </mat-card>
        </div>

        <div class="actions">
          <button type="button" (click)="goBack()" class="pill-btn pill-btn-dark back-button">
            <mat-icon>arrow_back</mat-icon>
            <span>{{ getBackButtonLabel() }}</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .results-container {
      min-height: 100%;
    }

    .results-content {
      max-width: 1000px;
      margin: 0 auto;
    }

    .results-header {
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }

    .header-main {
      flex: 1;
    }

    .version-info {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }

    .version-label {
      font-size: 14px;
      font-weight: 600;
      color: #764ba2;
      background: rgba(118, 75, 162, 0.1);
      padding: 4px 12px;
      border-radius: 12px;
      text-transform: uppercase;
    }

    .version-field {
      width: 200px;
    }

    ::ng-deep .version-field .mat-mdc-text-field-wrapper {
      background-color: white !important;
    }

    .results-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 34px;
      font-weight: 400;
      color: #09090b;
      margin: 0;
    }

    .summary-card {
      background: rgba(255, 255, 255, 0.78) !important;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.08) !important;
      border-radius: 20px !important;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.04) !important;
      margin-bottom: 24px;
    }

    .summary-content {
      padding: 32px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12.5px;
      font-weight: 600;
      text-transform: uppercase;
      margin-top: 8px;
    }
    .status-badge.approved { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .status-badge.rejected { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .status-badge.pending { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }

    .review-panel, .feedback-card {
      margin-bottom: 32px;
      border-radius: 16px;
    }
    .full-width { width: 100%; }
    .feedback-text { font-style: italic; color: #4a5568; line-height: 1.6; }
    .feedback-card mat-icon { margin-right: 8px; color: #18181b; }

    .summary-info {
      text-align: center;
      color: #09090b;
    }

    .summary-label {
      font-size: 13px;
      font-weight: 600;
      margin: 0 0 16px 0;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .score-display {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 8px;
      margin-bottom: 16px;
    }

    .score-value {
      font-size: 56px;
      font-weight: 700;
      line-height: 1;
      color: #09090b;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    .score-value-pending {
      font-size: 28px;
      font-weight: 600;
      line-height: 1;
      color: #d97706;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    .score-separator {
      font-size: 32px;
      font-weight: 400;
      color: #a1a1aa;
    }

    .score-max {
      font-size: 32px;
      font-weight: 500;
      color: #71717a;
    }

    .points-info {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 14px;
      background: rgba(0, 0, 0, 0.04);
      padding: 6px 16px;
      border-radius: 20px;
      color: #27272a;
    }

    .points-label {
      font-weight: 400;
    }

    .points-value {
      font-weight: 600;
      font-size: 18px;
    }

    .questions-section {
      margin-bottom: 32px;
    }

    .section-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 24px;
      font-weight: 400;
      color: #09090b;
      margin: 0 0 20px 0;
    }

    .result-card {
      border-radius: 16px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
      margin-bottom: 24px;
      overflow: hidden;
      transition: box-shadow 0.3s ease;
      background: rgba(255, 255, 255, 0.95);
    }

    .result-card:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    }

    .result-header {
      background: #18181b;
      color: white;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 16px 16px 0 0;
    }

    .question-number {
      font-size: 13px;
      font-weight: 600;
      opacity: 0.9;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .question-score {
      font-size: 14px;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.16);
      padding: 4px 14px;
      border-radius: 12px;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }

    .question-score.score-full {
      background: rgba(16, 185, 129, 0.25);
      color: #10b981;
    }

    .question-score.score-partial {
      background: rgba(245, 158, 11, 0.25);
      color: #f59e0b;
    }

    .question-score.score-zero {
      background: rgba(239, 68, 68, 0.25);
      color: #ef4444;
    }

    .result-content {
      padding: 24px;
    }

    .question-title {
      font-size: 18px;
      font-weight: 600;
      color: #18181b;
      margin: 0 0 20px 0;
      line-height: 1.5;
    }

    .answer-section {
      margin-bottom: 24px;
      padding: 16px;
      background: rgba(0, 0, 0, 0.02);
      border-radius: 10px;
      border-left: 3px solid #18181b;
    }

    .answer-label {
      font-size: 14px;
      font-weight: 600;
      color: #616161;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .answer-text {
      font-size: 16px;
      color: #212121;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .details-section,
    .ai-feedback-section,
    .ai-materials-section {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #e0e0e0;
    }

    .section-label {
      font-size: 16px;
      font-weight: 600;
      color: #424242;
      margin-bottom: 12px;
    }

    .details-list {
      margin: 0;
      padding-left: 24px;
      list-style-type: disc;
    }

    .detail-item {
      font-size: 16px;
      color: #424242;
      line-height: 1.8;
      margin-bottom: 8px;
    }

    .ai-feedback-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .feedback-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .feedback-label {
      font-size: 14px;
      font-weight: 600;
      color: #616161;
    }

    .feedback-value {
      font-size: 16px;
      color: #212121;
      font-weight: 500;
    }

    .feedback-text {
      font-size: 16px;
      color: #424242;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .chips-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .keyword-chip {
      font-size: 14px;
    }

    .keyword-chip.found {
      background: #4caf50;
      color: white;
    }

    .keyword-chip.missing {
      background: #f44336;
      color: white;
    }

    .review-panel {
      margin-top: 24px;
      border-radius: 16px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: rgba(255, 255, 255, 0.85);
    }
    .score-field {
      width: 100%;
      max-width: 250px;
    }
    .full-width {
      width: 100%;
    }
    .project-score-input {
      background: white;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid rgba(0, 0, 0, 0.08);
    }

    .materials-panel {
      margin-top: 16px;
    }

    .materials-panel-header {
      background: #f8f9fa;
    }

    .materials-panel-title {
      font-size: 15px;
      font-weight: 600;
      color: #18181b;
    }

    .materials-content {
      padding: 16px 0;
    }

    .materials-list-section {
      margin-bottom: 24px;
    }

    .materials-list {
      margin: 12px 0 0 0;
      padding-left: 24px;
      list-style-type: disc;
    }

    .material-item {
      font-size: 16px;
      color: #424242;
      line-height: 1.8;
      margin-bottom: 8px;
    }

    .materials-answers-section {
      margin-top: 24px;
    }

    .material-answer-item {
      margin-bottom: 20px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #4caf50;
    }

    .material-name {
      font-size: 14px;
      font-weight: 600;
      color: #616161;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .material-answer-text {
      font-size: 16px;
      color: #212121;
      line-height: 1.6;
      font-style: italic;
      white-space: pre-wrap;
    }

    .no-materials {
      font-size: 16px;
      color: #616161;
      font-style: italic;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
      text-align: center;
    }

    .load-feedback-button {
      margin-top: 16px;
    }

    .loading-feedback {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 24px;
    }

    .project-files-section {
      margin-bottom: 32px;
    }

    .files-card {
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e0e0e0;
    }

    .file-item {
      border-bottom: 1px solid #f0f0f0;
    }

    .file-item:last-child {
      border-bottom: none;
    }

    .file-title {
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .file-size {
      font-size: 12px;
      color: #9e9e9e;
      font-weight: 400;
    }

    .file-actions {
      margin-top: 4px;
    }

    .actions {
      display: flex;
      justify-content: center;
      margin-top: 32px;
      padding-top: 24px;
    }

    .pill-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 28px;
      border-radius: 24px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      border: none;
    }

    .pill-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .pill-btn-dark {
      background: #18181b;
      color: #ffffff;
    }

    .pill-btn-dark:hover {
      background: #27272a;
      transform: translateY(-1px);
    }

    .back-button {
      min-width: 200px;
    }

    @media (max-width: 768px) {
      .results-container {
        padding: 16px;
      }

      .results-title {
        font-size: 24px;
      }

      .score-value {
        font-size: 42px;
      }

      .score-max {
        font-size: 24px;
      }

      .summary-content {
        padding: 24px;
      }

      .result-content {
        padding: 20px;
      }
    }

    .peer-reviews-card {
      margin-bottom: 32px;
      border-radius: 12px;
      border: 1px solid #e0e0e0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .peer-reviews-card mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #3f51b5;
    }
    .comparison-layout {
      display: flex;
      gap: 24px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    .comp-column {
      flex: 1;
      min-width: 250px;
      padding: 16px;
      border-radius: 8px;
      background-color: #f8f9fa;
      border: 1px solid #e0e0e0;
    }
    .ai-column {
      border-left: 5px solid #667eea;
    }
    .peer-column {
      border-left: 5px solid #4caf50;
    }
    .comp-score-display {
      margin: 12px 0;
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    .comp-score-val {
      font-size: 36px;
      font-weight: 700;
      color: #212121;
    }
    .comp-score-max {
      font-size: 20px;
      color: #757575;
    }
    .comp-hint {
      font-size: 12px;
      color: #757575;
      margin: 0;
    }
    .rubrics-breakdown {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
    }
    .rubric-item {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
    }
    .rubric-label {
      color: #616161;
    }
    .rubric-val {
      font-weight: 500;
      color: #212121;
    }
    .peer-comments-section {
      margin-top: 24px;
      border-top: 1px solid #e0e0e0;
      padding-top: 16px;
    }
    .peer-review-item {
      border-bottom: 1px solid #f5f5f5;
      padding: 12px 0;
      height: auto !important;
      display: block !important;
    }
    .peer-review-item:last-child {
      border-bottom: none;
    }
    .reviewer-title {
      font-size: 14px;
      margin-bottom: 4px;
    }
    .reviewer-scores {
      font-size: 13px;
      color: #616161;
      margin-bottom: 4px;
    }
    .reviewer-comment {
      font-size: 14px;
      color: #212121;
      line-height: 1.4;
    }
  `]
})
export class SubmissionResultsComponent implements OnInit {
  results: any = null;
  testType: string = '';
  isAiGenerated: boolean = false;
  materialIds: string[] = [];
  loadingFeedback: boolean[] = [];
  isTeacher: boolean = false;
  teacherFeedback: string = '';
  projectScore: number = 0;
  allVersions: any[] = [];
  source: string | null = null;
  subjectId: string | null = null;
  peerReviews: any[] = [];
  averagePeerScores: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private auth: AuthService,
    private sanitizer: DomSanitizer
  ) {}

  isJsonAnswer(answer: string): boolean {
    if (!answer) return false;
    try {
      const parsed = JSON.parse(answer);
      return typeof parsed === 'object' && parsed !== null;
    } catch {
      return false;
    }
  }

  parseJsonAnswer(answer: string): any {
    try {
      return JSON.parse(answer);
    } catch {
      return {};
    }
  }

  getSafeUrl(url: string): SafeResourceUrl {
    let embedUrl = '';
    if (url.includes('youtube.com/watch') || url.includes('youtube.com/embed/')) {
      const videoId = url.includes('v=') ? url.split('v=')[1]?.split('&')[0] : url.split('embed/')[1]?.split('?')[0];
      embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
    } else if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
    } else if (url.includes('rutube.ru/video/')) {
      const videoId = url.split('rutube.ru/video/')[1]?.split('/')[0];
      embedUrl = `https://rutube.ru/play/embed/${videoId}`;
    } else {
      embedUrl = url;
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  ngOnInit() {
    const u = this.auth.getCurrentUser();
    const role = u?.role;
    this.isTeacher = role === 'teacher' || role === 'instructor' || role === 'admin' || u?.is_hidden_admin === true;
    this.auth.currentUser$.subscribe(user => {
      const r = user?.role;
      this.isTeacher = r === 'teacher' || r === 'instructor' || r === 'admin' || user?.is_hidden_admin === true;
    });
    this.source = this.route.snapshot.queryParamMap.get('source');
    const submissionId = this.route.snapshot.paramMap.get('id');
    if (submissionId) {
      this.loadResults(submissionId);
    }
  }

  loadPeerReviews(submissionId: string) {
    this.apiService.getSubmissionReviews(submissionId).subscribe({
      next: (reviews) => {
        this.peerReviews = reviews || [];
        if (this.peerReviews.length > 0) {
          const count = this.peerReviews.length;
          const sumRel = this.peerReviews.reduce((sum, r) => sum + (r.relevance || 0), 0);
          const sumStr = this.peerReviews.reduce((sum, r) => sum + (r.structure || 0), 0);
          const sumArg = this.peerReviews.reduce((sum, r) => sum + (r.argument || 0), 0);
          const sumCla = this.peerReviews.reduce((sum, r) => sum + (r.clarity || 0), 0);
          this.averagePeerScores = {
            relevance: (sumRel / count).toFixed(2),
            structure: (sumStr / count).toFixed(2),
            argument: (sumArg / count).toFixed(2),
            clarity: (sumCla / count).toFixed(2),
            total: ((sumRel + sumStr + sumArg + sumCla) / (count * 4)).toFixed(2)
          };
        } else {
          this.averagePeerScores = null;
        }
      },
      error: (err) => console.error('Error loading peer reviews:', err)
    });
  }

  getStatusLabel(status: string): string {
    const labels: any = {
      'pending': 'Ожидает проверки',
      'approved': 'Одобрено',
      'rejected': 'Отклонено'
    };
    return labels[status] || status;
  }

  approveSubmission() {
    this.updateStatus('approved');
  }

  rejectSubmission() {
    if (!this.teacherFeedback) {
      alert('Пожалуйста, укажите причину отклонения в поле комментария.');
      return;
    }
    this.updateStatus('rejected');
  }

  updateStatus(status: string) {
    const submissionId = this.results.submission.id;
    const isManualGraded = this.testType.toLowerCase() === 'project' || this.testType.toLowerCase() === 'keyword_based';
    const score = isManualGraded ? this.projectScore : undefined;
    
    this.apiService.updateSubmissionStatus(submissionId, status, this.teacherFeedback, score).subscribe({
      next: () => {
        this.loadResults(submissionId);
        alert(status === 'approved' ? 'Работа одобрена' : 'Работа отклонена');
      },
      error: (err) => console.error('Error updating status', err)
    });
  }

  loadResults(submissionId: string) {
    this.loadPeerReviews(submissionId);
    this.apiService.getSubmissionResults(submissionId).subscribe({
      next: (results) => {
        this.results = results;
        // Initialize project score from existing value
        if (results.submission) {
          const currentUser = this.auth.getCurrentUser();
          const isAuthorEgor = results.submission.user === 'Егор Жигачёв' || results.submission.user === 'isu_508982';
          const isCurrentUserEgor = !!(currentUser && (
            currentUser.is_hidden_admin || 
            currentUser.name === 'Егор Жигачёв' || 
            currentUser.name === 'isu_508982'
          ));
          
          if (isAuthorEgor && !isCurrentUserEgor) {
            alert('Доступ запрещен');
            this.router.navigate(['/submissions-management']);
            return;
          }

          this.projectScore = results.submission.total_score || 0;
          this.loadVersionHistory(results.submission.test_id, results.submission.user);
        }
        // Extract test info
        if (results.submission && results.submission.test_id) {
          this.apiService.getTest(results.submission.test_id).subscribe({
            next: (test) => {
              this.testType = test.test_type || '';
              this.subjectId = test.subject_id || null;
              this.isAiGenerated = test.ai_generated === 'true' || test.ai_generated === true;
              
              // Extract material IDs from description
              if (test.description) {
                const match = test.description.match(/\[AI_MATERIALS:(.+?)\]/);
                if (match) {
                  this.materialIds = match[1].split(',').map((id: string) => id.trim());
                }
              }
              
              // Initialize loadingFeedback array
              this.loadingFeedback = new Array(results.per_question_results.length).fill(false);
            },
            error: (err) => console.error('Error loading test:', err)
          });
        }
      },
      error: (err) => {
        console.error('Error loading results:', err);
        alert('Ошибка загрузки результатов');
      }
    });
  }

  loadVersionHistory(testId: string, user: string) {
    this.apiService.getSubmissions(testId, user).subscribe({
      next: (submissions) => {
        // Sort by version descending
        this.allVersions = submissions.sort((a: any, b: any) => b.version - a.version);
      },
      error: (err) => console.error('Error loading version history', err)
    });
  }

  switchVersion(submissionId: string) {
    this.router.navigate(['/submissions', submissionId]);
    this.loadResults(submissionId);
  }

  loadAiFeedback(index: number, result: any) {
    if (!this.materialIds || this.materialIds.length === 0) {
      alert('Материалы для этого теста недоступны');
      return;
    }

    this.loadingFeedback[index] = true;
    
    // Get test to find correct answer
    if (this.results.submission && this.results.submission.test_id) {
      this.apiService.getTest(this.results.submission.test_id).subscribe({
        next: (test) => {
          const question = test.questions.find((q: any) => q.question_id === result.question_id);
          const correctAnswer = question?.correct_answer || '';
          
          this.apiService.getTestFeedback({
            test_id: this.results.submission.test_id,
            test_type: this.testType,
            question_id: result.question_id,
            question_title: result.title,
            student_answer: result.answer,
            correct_answer: correctAnswer,
            material_ids: this.materialIds,
            max_points: result.max_points
          }).subscribe({
            next: (feedback) => {
              if (!this.results.per_question_results[index].aiFeedback) {
                this.results.per_question_results[index].aiFeedback = feedback.feedback;
              }
              this.loadingFeedback[index] = false;
            },
            error: (err) => {
              console.error('Error loading AI feedback:', err);
              alert('Ошибка загрузки обратной связи');
              this.loadingFeedback[index] = false;
            }
          });
        },
        error: (err) => {
          console.error('Error loading test:', err);
          this.loadingFeedback[index] = false;
        }
      });
    }
  }

  getBackButtonLabel(): string {
    return this.source === 'courses' ? 'Вернуться к курсу' : 'Вернуться к тестам';
  }

  goBack() {
    const courseId = this.subjectId || this.route.snapshot.queryParams['courseId'];
    const tab = this.route.snapshot.queryParams['tab'];
    const lessonId = this.route.snapshot.queryParams['lessonId'];
    if (this.source === 'courses' && courseId) {
      const qParams: any = {};
      if (tab !== undefined && tab !== null) {
        qParams.tab = tab;
      }
      if (lessonId) {
        qParams.lessonId = lessonId;
      }
      this.router.navigate(['/courses', courseId], { queryParams: qParams });
    } else {
      this.router.navigate(['/tests']);
    }
  }
}

