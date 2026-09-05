import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule, FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { RussianDatePipe } from '../../core/pipes/russian-date.pipe';
import { interval, Subscription, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-test-take',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatCheckboxModule,
    MatProgressBarModule,
    MatIconModule,
    MatListModule,
    RussianDatePipe
  ],
  template: `
    <div class="test-container" *ngIf="test">
      <div *ngIf="isTestExpired" class="error-container">
        <div class="error-content glass-panel">
          <mat-icon class="error-icon">schedule</mat-icon>
          <h2>Тест недоступен</h2>
          <p>Срок прохождения этого теста истек. Дедлайн: {{ test.due_date | russianDate:'datetime' }}</p>
          <button type="button" class="pill-btn pill-btn-dark back-button" (click)="navigateBack()">
            <mat-icon style="font-size: 18px; width: 18px; height: 18px;">arrow_back</mat-icon>
            <span>{{ source === 'courses' ? 'Вернуться к курсу' : 'Вернуться к тестам' }}</span>
          </button>
        </div>
      </div>

      <div *ngIf="!isTestExpired" class="test-content">
        <div class="test-header">
          <div class="header-info">
            <h1 class="test-title">{{ test.title }}</h1>
            <p class="test-description" *ngIf="test.description">{{ test.description }}</p>
            
            <!-- Reference Materials Section -->
            <div class="test-assets-wrapper" *ngIf="testAssets.length > 0">
              <h3 class="assets-header"><mat-icon>attachment</mat-icon> Материалы к тесту:</h3>
              <mat-list class="test-assets-list">
                <mat-list-item *ngFor="let asset of testAssets" class="test-asset-item">
                  <div matListItemTitle class="asset-link-container">
                    <a [href]="'/api/tests/' + test.id + '/files/' + asset.id + '/download'" target="_blank" [download]="asset.original_name" class="asset-download-link">
                      <mat-icon>download</mat-icon>
                      {{ asset.original_name }}
                    </a>
                    <span class="asset-size-badge">{{ (asset.size / 1024).toFixed(1) }} KB</span>
                  </div>
                </mat-list-item>
              </mat-list>
            </div>
          </div>
          <div class="timer-container" *ngIf="hasTimeLimit">
            <div class="timer" [class.timer-warning]="timeRemaining <= 300" [class.timer-critical]="timeRemaining <= 60">
              <mat-icon class="timer-icon">schedule</mat-icon>
              <div class="timer-display">
                <span class="timer-value">{{ formatTime(timeRemaining) }}</span>
                <span class="timer-label">Осталось времени</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Buffer / Consent Screen -->
        <div *ngIf="isPreStart" class="pre-start-container">
          <div class="buffer-card glass-panel">
            <div class="buffer-header">
              <h2 class="buffer-title">Перед началом тестирования</h2>
            </div>
            <div class="buffer-content">
              <div class="warning-box">
                <mat-icon>info</mat-icon>
                <p>После начала теста выполнение отменить нельзя. Убедитесь, что у вас стабильное подключение к сети.</p>
              </div>
              
              <div class="test-pre-info">
                <div class="pre-info-item">
                  <mat-icon>help_outline</mat-icon>
                  <div>
                    <span class="label">Вопросов</span>
                    <span class="value">{{ test.questions.length }}</span>
                  </div>
                </div>
                <div class="pre-info-item" *ngIf="hasTimeLimit">
                  <mat-icon>schedule</mat-icon>
                  <div>
                    <span class="label">Ограничение времени</span>
                    <span class="value">{{ timeLimitMinutes }} мин.</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="buffer-actions">
              <button type="button" (click)="onCancel()" class="pill-btn pill-btn-outline exit-btn">
                <mat-icon>arrow_back</mat-icon>
                <span>Выйти</span>
              </button>
              <button type="button" (click)="startTest()" class="pill-btn pill-btn-dark start-btn">
                <mat-icon>play_arrow</mat-icon>
                <span>Начать тест</span>
              </button>
            </div>
          </div>
        </div>

        <div class="test-main-layout" *ngIf="!isPreStart">
          <form [formGroup]="answerForm" (ngSubmit)="onSubmit()" class="test-form">
            <div formArrayName="answers" class="questions-carousel">
              <div class="carousel-wrapper">
                <div class="carousel-track" [style.transform]="'translateX(-' + (currentQuestionIndex * 100) + '%)'">
                  <mat-card *ngFor="let question of test.questions; let i = index" 
                            class="question-card" 
                            [class.active]="i === currentQuestionIndex">
                    <mat-card-header class="question-header">
                      <div class="question-number">Вопрос {{ i + 1 }} из {{ test.questions.length }}</div>
                      <div class="question-points">{{ question.max_points }} баллов</div>
                    </mat-card-header>
                    <mat-card-content class="question-content">
                      <h3 class="question-title">{{ question.title }}</h3>

                      <!-- Multiple Choice -->
                      <div *ngIf="test.test_type === 'multiple_choice'" class="answer-section">
                        <mat-radio-group [formControlName]="i" 
                                          class="radio-group"
                                          (change)="onAnswerChange(i)">
                          <mat-radio-button *ngFor="let option of question.options; let j = index" 
                                            [value]="option" 
                                            class="radio-option">
                            <span class="option-label">{{ option }}</span>
                          </mat-radio-button>
                        </mat-radio-group>
                      </div>

                      <!-- Keyword Based -->
                      <div *ngIf="test.test_type === 'keyword_based'" class="answer-section">
                        <mat-form-field appearance="outline" class="answer-field">
                          <textarea matInput 
                                    [formControlName]="i" 
                                    rows="6" 
                                    placeholder="Введите ваш развернутый ответ здесь..."
                                    class="answer-textarea"
                                    (input)="onAnswerChange(i)"></textarea>
                        </mat-form-field>
                      </div>

                      <!-- Project / File Upload -->
                      <div *ngIf="test.test_type === 'PROJECT' || test.test_type === 'project'" class="answer-section">
                        <div class="project-info">
                          <mat-icon>info</mat-icon>
                          <span>Этот тест является заданием/проектом. Вы можете загрузить несколько файлов, указать ссылку на проект (например, на GitHub) или на видеопрезентацию, а также оставить текстовое описание решения.</span>
                        </div>
                        
                        <div class="project-text-answer" style="margin-bottom: 16px;">
                          <mat-form-field appearance="outline" class="answer-field">
                            <mat-label>Описание проекта / Текстовый ответ</mat-label>
                            <textarea matInput 
                                      [value]="getProjectAnswer(i, 'text')"
                                      (input)="updateProjectAnswer(i, 'text', $any($event.target).value)"
                                      rows="6" 
                                      placeholder="Введите описание вашего решения или текстовый ответ..."
                                      class="answer-textarea"></textarea>
                          </mat-form-field>
                        </div>

                        <div class="project-links" style="display: flex; gap: 16px; margin-bottom: 24px;">
                          <mat-form-field appearance="outline" style="flex: 1;">
                            <mat-label>🔗 Ссылка на проект (GitHub, Google Drive и др.)</mat-label>
                            <input matInput 
                                   [value]="getProjectAnswer(i, 'external_link')"
                                   (input)="updateProjectAnswer(i, 'external_link', $any($event.target).value)"
                                   placeholder="https://github.com/username/project">
                          </mat-form-field>

                          <mat-form-field appearance="outline" style="flex: 1;">
                            <mat-label>🎥 Ссылка на видео-презентацию (YouTube, Rutube, Vimeo)</mat-label>
                            <input matInput 
                                   [value]="getProjectAnswer(i, 'video_link')"
                                   (input)="updateProjectAnswer(i, 'video_link', $any($event.target).value)"
                                   placeholder="https://www.youtube.com/watch?v=...">
                          </mat-form-field>
                        </div>
                        
                        <div class="file-upload-zone">
                          <input type="file" #fileInput (change)="onFileSelected($event)" multiple style="display: none">
                          <button mat-raised-button color="accent" type="button" (click)="fileInput.click()" [disabled]="submitting || !submissionId">
                            <mat-icon>upload_file</mat-icon>
                            Загрузить файлы
                          </button>
                          <p class="file-hint">Поддерживаются любые форматы (код, архивы, документы)</p>
                        </div>

                        <div class="uploaded-files-list" *ngIf="uploadedFiles.length > 0">
                          <div class="list-header">Загруженные файлы ({{ uploadedFiles.length }}):</div>
                          <div *ngFor="let file of uploadedFiles" class="file-row">
                            <div class="file-details">
                              <mat-icon>insert_drive_file</mat-icon>
                              <span class="file-name">{{ file.original_name }}</span>
                              <span class="file-size">({{ (file.size / 1024).toFixed(1) }} KB)</span>
                            </div>
                            <button mat-icon-button color="warn" type="button" (click)="deleteFile(file.id)" [disabled]="submitting">
                              <mat-icon>delete</mat-icon>
                            </button>
                          </div>
                        </div>
                      </div>
                    </mat-card-content>
                  </mat-card>
                </div>
              </div>

              <!-- Navigation Controls -->
              <div class="navigation-controls">
                <button mat-icon-button 
                        type="button"
                        (click)="previousQuestion()" 
                        [disabled]="currentQuestionIndex === 0"
                        class="nav-button nav-button-left">
                  <mat-icon>chevron_left</mat-icon>
                </button>

                <div class="indicators-container">
                  <div class="indicators-wrapper" [style.transform]="getIndicatorsTransform()">
                    <div *ngFor="let question of test.questions; let i = index" 
                         class="indicator-dot"
                         [class.active]="i === currentQuestionIndex"
                         [class.answered]="hasAnswer(i)"
                         (click)="goToQuestion(i)"
                         [title]="'Вопрос ' + (i + 1)">
                    </div>
                  </div>
                </div>

                <button mat-icon-button 
                        type="button"
                        (click)="nextQuestion()" 
                        [disabled]="currentQuestionIndex === test.questions.length - 1"
                        class="nav-button nav-button-right">
                  <mat-icon>chevron_right</mat-icon>
                </button>
              </div>

              <div class="question-counter">
                Вопрос {{ currentQuestionIndex + 1 }} из {{ test.questions.length }}
              </div>

              <div class="form-actions">
                <button type="button" 
                        (click)="onCancel()"
                        class="pill-btn pill-btn-outline cancel-button"
                        *ngIf="test.test_type.toLowerCase() === 'project'">
                  <mat-icon>close</mat-icon>
                  <span>Выйти без отправки</span>
                </button>
                <button type="submit" 
                        [disabled]="submitting || timeExpired"
                        class="pill-btn pill-btn-dark submit-button">
                  <mat-icon>check</mat-icon>
                  <span *ngIf="!submitting">Завершить и отправить</span>
                  <span *ngIf="submitting">Отправка...</span>
                </button>
              </div>
            </div>
          </form>

          <!-- Quick Navigation Sidebar -->
          <div class="quick-nav-sidebar">
            <h3 class="sidebar-title">Навигация по вопросам</h3>
            <div class="questions-list">
              <button *ngFor="let question of test.questions; let i = index"
                      type="button"
                      class="question-nav-item"
                      [class.active]="i === currentQuestionIndex"
                      [class.answered]="hasAnswer(i)"
                      (click)="goToQuestion(i)">
                <span class="question-nav-number">{{ i + 1 }}</span>
                <span class="question-nav-status" *ngIf="hasAnswer(i)">
                  <mat-icon>check_circle</mat-icon>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .test-container {
      min-height: 100%;
    }

    .test-content {
      max-width: 1400px;
      margin: 0 auto;
    }

    .test-main-layout {
      display: flex;
      gap: 24px;
      align-items: flex-start;
    }

    .test-header {
      background: rgba(255, 255, 255, 0.78);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 20px;
      padding: 28px 32px;
      margin-bottom: 24px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.04);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
    }

    .header-info {
      flex: 1;
    }

    .test-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 34px;
      font-weight: 400;
      color: #09090b;
      margin: 0 0 10px 0;
      line-height: 1.2;
    }

    .test-description {
      font-size: 14.5px;
      color: #52525b;
      margin: 0;
      line-height: 1.6;
    }

    .test-assets-wrapper {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
    }

    .assets-header {
      font-size: 14.5px;
      font-weight: 600;
      color: #18181b;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .test-assets-list {
      padding: 0;
    }

    .test-asset-item {
      height: auto !important;
      padding: 4px 0 !important;
    }

    .asset-link-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .asset-download-link {
      color: #18181b;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
      transition: opacity 0.2s;
    }

    .asset-download-link:hover {
      opacity: 0.75;
      text-decoration: underline;
    }

    .asset-download-link mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .asset-size-badge {
      font-size: 11px;
      color: #71717a;
      background: rgba(0, 0, 0, 0.05);
      padding: 2px 6px;
      border-radius: 4px;
    }

    .timer-container {
      flex-shrink: 0;
    }

    .timer {
      background: #18181b;
      border-radius: 14px;
      padding: 16px 22px;
      color: white;
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 190px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      transition: all 0.3s ease;
    }

    .timer.timer-warning {
      background: #ea580c;
      animation: pulse 1s infinite;
    }

    .timer.timer-critical {
      background: #dc2626;
      animation: pulse 0.5s infinite;
    }

    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.02);
      }
    }

    .timer-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .timer-display {
      display: flex;
      flex-direction: column;
    }

    .timer-value {
      font-size: 28px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: 1px;
      line-height: 1;
    }

    .timer-label {
      font-size: 12px;
      opacity: 0.9;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .test-form {
      flex: 1;
      background: rgba(255, 255, 255, 0.78);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.04);
    }

    .questions-carousel {
      position: relative;
    }

    .carousel-wrapper {
      overflow: hidden;
      margin-bottom: 32px;
    }

    .carousel-track {
      display: flex;
      transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
    }

    .question-card {
      min-width: 100%;
      flex-shrink: 0;
      border-radius: 16px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
      transition: box-shadow 0.3s ease, transform 0.3s ease;
      overflow: hidden;
      opacity: 0.3;
      transform: scale(0.96);
      pointer-events: none;
      background: rgba(255, 255, 255, 0.95);
    }

    .question-card.active {
      opacity: 1;
      transform: scale(1);
      pointer-events: auto;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
    }

    .question-card:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    }

    .question-header {
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

    .question-points {
      font-size: 13px;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.16);
      padding: 4px 12px;
      border-radius: 12px;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-shadow: 0 0 0 transparent;
      opacity: 1;
    }

    .question-content {
      padding: 24px;
    }

    .question-title {
      font-size: 18px;
      font-weight: 600;
      color: #18181b;
      margin: 0 0 24px 0;
      line-height: 1.5;
    }

    .answer-section {
      margin-top: 16px;
    }

    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .radio-option {
      padding: 14px 18px;
      border: 1.5px solid rgba(0, 0, 0, 0.08);
      border-radius: 12px;
      transition: all 0.2s ease;
      background: rgba(255, 255, 255, 0.6);
    }

    .radio-option:hover {
      border-color: #18181b;
      background: rgba(255, 255, 255, 0.95);
    }

    .radio-option ::ng-deep .mat-radio-checked .mat-radio-outer-circle {
      border-color: #18181b;
    }

    .radio-option ::ng-deep .mat-radio-checked .mat-radio-inner-circle {
      background-color: #18181b;
    }

    .option-label {
      font-size: 15px;
      color: #27272a;
      margin-left: 8px;
    }

    .answer-field {
      width: 100%;
    }

    .answer-textarea {
      font-size: 16px;
      line-height: 1.6;
    }

    .navigation-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin: 32px 0 16px 0;
      padding: 24px;
      background: #f8f9fa;
      border-radius: 12px;
    }

    .nav-button {
      width: 48px;
      height: 48px;
      background: white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      padding: 0;
      margin: 0;
    }

    .nav-button:hover:not(:disabled) {
      background: #18181b;
      color: white;
      transform: scale(1.08);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .nav-button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .nav-button mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      line-height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .indicators-container {
      flex: 1;
      overflow: hidden;
      max-width: 400px;
      height: 32px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 8px;
    }

    .indicators-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: transform 0.3s ease;
      will-change: transform;
      height: 100%;
    }

    .indicator-dot {
      width: 10px;
      height: 10px;
      min-width: 10px;
      min-height: 10px;
      border-radius: 50%;
      background: #e4e4e7;
      cursor: pointer;
      transition: all 0.2s ease;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }

    .indicator-dot:hover {
      transform: scale(1.3);
      background: #18181b;
    }

    .indicator-dot.active {
      background: #18181b;
      transform: scale(1.3);
      box-shadow: 0 0 6px rgba(0, 0, 0, 0.2);
    }

    .indicator-dot.answered {
      background: #10b981;
    }

    .indicator-dot.answered.active {
      background: #18181b;
    }

    .question-counter {
      text-align: center;
      font-size: 14.5px;
      font-weight: 500;
      color: #71717a;
      margin-bottom: 24px;
    }

    .form-actions {
      display: flex;
      gap: 16px;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
      justify-content: flex-end;
    }

    .quick-nav-sidebar {
      width: 280px;
      background: rgba(255, 255, 255, 0.78);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.04);
      position: sticky;
      top: 24px;
      max-height: calc(100vh - 48px);
      overflow-y: auto;
    }

    .sidebar-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 20px;
      font-weight: 400;
      color: #09090b;
      margin: 0 0 16px 0;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    .questions-list {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
    }

    .question-nav-item {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      border: 1px solid rgba(0, 0, 0, 0.1);
      background: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      transition: all 0.2s ease;
      font-weight: 600;
      color: #3f3f46;
    }

    .question-nav-item:hover {
      border-color: #18181b;
      transform: translateY(-2px);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
    }

    .question-nav-item.active {
      background: #18181b;
      border-color: #18181b;
      color: white;
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .question-nav-item.answered {
      background: #10b981;
      border-color: #10b981;
      color: white;
    }

    .question-nav-item.answered.active {
      background: #18181b;
      border-color: #18181b;
    }

    .question-nav-number {
      font-size: 14px;
    }

    .question-nav-status {
      position: absolute;
      top: -4px;
      right: -4px;
      width: 16px;
      height: 16px;
      background: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .question-nav-status mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
      color: #4caf50;
    }

    .project-info {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #e3f2fd;
      padding: 12px;
      border-radius: 8px;
      color: #1976d2;
      margin-bottom: 20px;
      font-size: 14px;
    }

    .file-upload-zone {
      border: 2px dashed #e0e0e0;
      border-radius: 12px;
      padding: 32px;
      text-align: center;
      background: #fafafa;
      margin-bottom: 24px;
      transition: all 0.3s ease;
    }

    .file-upload-zone:hover {
      border-color: #667eea;
      background: #f3f4ff;
    }

    .file-hint {
      margin-top: 12px;
      font-size: 12px;
      color: #757575;
    }

    .uploaded-files-list {
      margin-top: 16px;
    }

    .list-header {
      font-weight: 500;
      margin-bottom: 12px;
      color: #424242;
    }

    .file-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      margin-bottom: 8px;
    }

    .file-details {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .file-name {
      font-weight: 500;
    }

    .file-size {
      font-size: 12px;
      color: #9e9e9e;
    }

    .submit-button {
      min-width: 180px;
      height: 48px;
      font-size: 16px;
      font-weight: 500;
      border-radius: 8px;
    }

    .cancel-button {
      min-width: 120px;
      height: 48px;
      font-size: 16px;
      border-radius: 8px;
    }

    .error-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 60vh;
      padding: 20px;
    }

    .error-content {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 20px;
      padding: 44px 36px;
      text-align: center;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .error-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: #ef4444;
      margin-bottom: 16px;
    }

    .error-content h2 {
      font-family: 'Instrument Serif', Georgia, serif;
      color: #18181b;
      font-size: 28px;
      font-weight: 400;
      margin: 0 0 10px 0;
    }

    .error-content p {
      color: #71717a;
      font-size: 14px;
      margin: 0 0 24px 0;
      line-height: 1.5;
    }

    .pill-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 24px;
      border-radius: 24px;
      font-size: 13.5px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      border: none;
    }

    .pill-btn-dark {
      background: #18181b;
      color: #fff;
    }

    .pill-btn-dark:hover {
      background: #27272a;
      transform: translateY(-1px);
    }

    .back-button {
      min-width: 200px;
      height: 48px;
      font-size: 16px;
      border-radius: 8px;
    }

    @media (max-width: 1200px) {
      .test-main-layout {
        flex-direction: column;
      }

      .quick-nav-sidebar {
        width: 100%;
        position: static;
        max-height: none;
      }

      .questions-list {
        grid-template-columns: repeat(10, 1fr);
      }
    }

    @media (max-width: 768px) {
      .test-container {
        padding: 16px;
      }

      .test-header {
        flex-direction: column;
        padding: 24px;
      }

      .timer-container {
        width: 100%;
      }

      .timer {
        width: 100%;
        justify-content: center;
      }

      .test-title {
        font-size: 24px;
      }

      .test-form {
        padding: 24px;
      }

      .navigation-controls {
        padding: 16px;
        gap: 8px;
      }

      .indicators-container {
        max-width: 200px;
      }

      .questions-list {
        grid-template-columns: repeat(5, 1fr);
        gap: 8px;
      }

      .question-nav-item {
        width: 36px;
        height: 36px;
      }

      .form-actions {
        flex-direction: column;
      }

      .submit-button,
      .cancel-button {
        width: 100%;
      }
    }

    /* Buffer Screen */
    .pre-start-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 400px;
      padding: 20px;
    }
    .buffer-card {
      max-width: 480px;
      width: 100%;
      border-radius: 20px;
      padding: 32px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.08);
    }
    .buffer-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 26px;
      font-weight: 400;
      color: #09090b;
      margin: 0;
      text-align: center;
    }
    .buffer-content {
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin-top: 20px;
      text-align: center;
    }
    .warning-box {
      background: rgba(0, 0, 0, 0.03);
      padding: 16px;
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      color: #52525b;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13.5px;
      line-height: 1.4;
      text-align: left;
    }
    .warning-box mat-icon { width: 24px; height: 24px; font-size: 24px; color: #71717a; flex-shrink: 0; }
    .warning-box p { margin: 0; }
    .test-pre-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .pre-info-item {
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(0, 0, 0, 0.07);
      padding: 14px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      text-align: left;
    }
    .pre-info-item mat-icon { color: #18181b; }
    .pre-info-item .label { display: block; font-size: 11px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; }
    .pre-info-item .value { font-weight: 700; color: #18181b; font-size: 16px; }
    .buffer-actions {
      margin-top: 28px;
      display: flex;
      gap: 12px;
      padding: 0 !important;
    }
    .buffer-actions button {
      flex: 1;
      height: 44px;
    }
  `]
})
export class TestTakeComponent implements OnInit, OnDestroy {
  test: any = null;
  answerForm!: FormGroup;
  submissionId: string | null = null;
  submitting = false;
  isTestExpired: boolean = false;
  hasTimeLimit: boolean = false;
  timeLimitMinutes: number = 0;
  timeRemaining: number = 0; // в секундах
  timeExpired: boolean = false;
  timerSubscription?: Subscription;
  startTime: Date | null = null;
  currentQuestionIndex: number = 0;
  answeredQuestions: Set<number> = new Set();
  uploadedFiles: any[] = [];
  testAssets: any[] = [];
  source: string | null = null;
  courseId: string | null = null;
  returnTab?: number;
  returnLessonId?: string | null;
  isPreStart: boolean = false;
  private saveSubject = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private apiService: ApiService,
    private auth: AuthService
  ) { }

  ngOnInit() {
    const testId = this.route.snapshot.paramMap.get('id');
    this.source = this.route.snapshot.queryParamMap.get('source');
    this.courseId = this.route.snapshot.queryParamMap.get('courseId');
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    this.returnTab = tabParam !== null && tabParam !== undefined ? parseInt(tabParam, 10) : undefined;
    this.returnLessonId = this.route.snapshot.queryParamMap.get('lessonId');
    
    if (testId) {
      this.loadTest(testId);
    }

    // Initialize debounced auto-save
    this.saveSubject.pipe(
      debounceTime(1000)
    ).subscribe(() => {
      this.performSave();
    });
  }

  loadTest(testId: string) {
    this.apiService.getTest(testId).subscribe({
      next: (test) => {
        this.test = test;

        // Проверяем доступность теста по дедлайну
        if (test.due_date) {
          // Дата хранится в московском времени (формат +03:00)
          // Просто сравниваем напрямую
          const dueDate = new Date(test.due_date);
          const now = new Date();

          // Тест недоступен только если дедлайн уже прошел
          if (dueDate.getTime() < now.getTime()) {
            this.isTestExpired = true;
            return;
          }
        }

        // Проверяем наличие таймера
        if (test.time_limit_minutes && test.time_limit_minutes > 0) {
          this.hasTimeLimit = true;
          this.timeLimitMinutes = test.time_limit_minutes;
        }

        this.initForm();
        this.loadTestAssets(testId);

        const currentUser = this.auth.getCurrentUser();
        if (currentUser && test.test_type.toLowerCase() !== 'project') {
          this.apiService.getSubmissions(testId, currentUser.name).subscribe(subs => {
            const activeSub = subs.find(sub => sub.is_finished === 'false' || sub.is_finished === false);
            if (activeSub) {
              // Already started, just resume
              this.startSubmission(testId);
            } else {
              // Fresh start, show buffer only if there is a time limit
              if (this.hasTimeLimit) {
                this.isPreStart = true;
              } else {
                this.startSubmission(testId);
              }
            }
          });
        } else {
          // Projects or no user, standard flow
          this.startSubmission(testId);
        }
      },
      error: (err) => {
        console.error('Error loading test:', err);
        alert('Ошибка загрузки теста');
      }
    });
  }

  initForm() {
    const answers = this.fb.array(
      this.test.questions.map(() => this.fb.control(''))
    );
    this.answerForm = this.fb.group({ answers });

    // Проверяем начальные ответы
    this.checkAllAnswers();

    // Отслеживаем изменения в форме для определения отвеченных вопросов
    this.answerForm.valueChanges.subscribe(() => {
      this.checkAllAnswers();
    });
  }

  checkAllAnswers() {
    if (!this.test || !this.answerForm) return;

    this.test.questions.forEach((_question: any, index: number) => {
      if (this.hasAnswer(index)) {
        this.answeredQuestions.add(index);
      } else {
        this.answeredQuestions.delete(index);
      }
    });
  }

  startTest() {
    this.isPreStart = false;
    if (this.test) {
      this.startSubmission(this.test.id);
    }
  }

  startSubmission(testId: string) {
    const currentUser = this.auth.getCurrentUser();
    if (!currentUser) {
      alert('Сначала войдите или зарегистрируйтесь');
      this.router.navigate(['/login']);
      return;
    }
    const submissionData = {
      test_id: testId,
      user: currentUser.name,
      answers: this.test.questions.map((q: any) => ({
        question_id: q.question_id,
        answer: ''
      }))
    };

    this.apiService.createSubmission(submissionData).subscribe({
      next: (submission) => {
        this.submissionId = submission.id;
        
        // Populate existing answers if any (for drafts/resume)
        if (submission.answers && submission.answers.length > 0) {
          const answersArray = this.answerForm.get('answers') as FormArray;
          submission.answers.forEach((ans: any) => {
            const index = this.test.questions.findIndex((q: any) => q.question_id === ans.question_id);
            if (index !== -1 && answersArray.at(index)) {
              answersArray.at(index).patchValue(ans.answer);
            }
          });
          this.checkAllAnswers();
        }

        // Используем время начала из базы данных (UTC)
        // Если суффикса Z нет, добавляем его для корректного парсинга как UTC
        const startedAtStr = submission.started_at.endsWith('Z') ? submission.started_at : submission.started_at + 'Z';
        this.startTime = new Date(startedAtStr);
        
        console.log('Submission loaded/created:', submission.id, 'Timer started from:', this.startTime, 'Time limit:', this.timeLimitMinutes, 'minutes');

        // Track test start activity
        const currentUser = this.auth.getCurrentUser();
        if (currentUser) {
          this.apiService.createActivity({
            user_name: currentUser.name,
            action_type: 'test_start',
            resource_type: 'test',
            resource_id: testId,
            session_duration: null
          }).subscribe({
            error: (err) => console.error('Error tracking test start activity:', err)
          });
        }

        // Запускаем таймер если есть ограничение по времени
        if (this.hasTimeLimit) {
          this.startTimer();
        }

        // Загружаем файлы если это проект
        if (this.test.test_type === 'PROJECT' || this.test.test_type === 'project') {
          this.loadSubmissionFiles();
        }
      },
      error: (err) => {
        console.error('Error creating submission:', err);
        alert('Ошибка при создании сдачи теста. Попробуйте еще раз.');
      }
    });
  }

  startTimer() {
    if (!this.hasTimeLimit || !this.startTime) {
      console.warn('Cannot start timer: hasTimeLimit=', this.hasTimeLimit, 'startTime=', this.startTime);
      return;
    }

    // Сохраняем таймер в localStorage
    try {
      localStorage.setItem('active_test_timer', JSON.stringify({
        testId: this.test.id,
        testTitle: this.test.title,
        startTime: this.startTime.toISOString(),
        timeLimitMinutes: this.timeLimitMinutes
      }));
    } catch (e) {
      console.error('Error saving active test timer to localStorage', e);
    }

    // Вычисляем время окончания на основе текущего времени клиента
    const endTime = new Date(this.startTime.getTime() + this.timeLimitMinutes * 60 * 1000);
    const now = new Date();
    const initialRemaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));

    console.log('Timer initialized:', {
      startTime: this.startTime,
      endTime: endTime,
      now: now,
      timeLimitMinutes: this.timeLimitMinutes,
      initialRemaining: initialRemaining
    });

    // Если время уже истекло, сразу завершаем тест
    if (initialRemaining === 0) {
      console.error('Timer expired immediately! This should not happen.');
      this.timeRemaining = 0;
      this.timeExpired = true;
      this.autoSubmit();
      return;
    }

    this.timeRemaining = initialRemaining;

    // Обновляем таймер каждую секунду
    this.timerSubscription = interval(1000).subscribe(() => {
      const currentTime = new Date();
      const remaining = Math.max(0, Math.floor((endTime.getTime() - currentTime.getTime()) / 1000));

      this.timeRemaining = remaining;

      if (remaining === 0 && !this.timeExpired) {
        this.timeExpired = true;
        if (this.timerSubscription) {
          this.timerSubscription.unsubscribe();
        }
        this.autoSubmit();
      }
    });
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  previousQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
    }
  }

  nextQuestion() {
    if (this.currentQuestionIndex < this.test.questions.length - 1) {
      this.currentQuestionIndex++;
    }
  }

  goToQuestion(index: number) {
    if (index >= 0 && index < this.test.questions.length) {
      this.currentQuestionIndex = index;
    }
  }

  hasAnswer(index: number): boolean {
    if (!this.answerForm) return false;
    const answer = this.answerForm.value.answers[index];
    if (!answer) return false;
    const answerStr = answer.toString().trim();
    if (answerStr === '') return false;

    try {
      const parsed = JSON.parse(answerStr);
      if (parsed && typeof parsed === 'object') {
        return !!(
          (parsed.text && parsed.text.trim() !== '') ||
          (parsed.external_link && parsed.external_link.trim() !== '') ||
          (parsed.video_link && parsed.video_link.trim() !== '')
        );
      }
    } catch (e) {
      // Not JSON
    }

    return true;
  }

  getProjectAnswer(index: number, field: 'text' | 'external_link' | 'video_link'): string {
    if (!this.answerForm) return '';
    const answersArray = this.answerForm.get('answers') as FormArray;
    const controlVal = answersArray?.at(index)?.value;
    if (!controlVal) return '';
    try {
      const parsed = JSON.parse(controlVal);
      if (parsed && typeof parsed === 'object') {
        return parsed[field] || '';
      }
    } catch (e) {
      if (field === 'text') return controlVal;
    }
    return '';
  }

  updateProjectAnswer(index: number, field: 'text' | 'external_link' | 'video_link', value: string) {
    if (!this.answerForm) return;
    const answersArray = this.answerForm.get('answers') as FormArray;
    const control = answersArray?.at(index);
    if (!control) return;

    let currentObj = { text: '', external_link: '', video_link: '' };
    try {
      const parsed = JSON.parse(control.value || '{}');
      if (parsed && typeof parsed === 'object') {
        currentObj = { ...currentObj, ...parsed };
      }
    } catch (e) {
      currentObj.text = control.value || '';
    }

    currentObj[field] = value;
    control.setValue(JSON.stringify(currentObj));
    this.onAnswerChange(index);
  }

  onAnswerChange(index: number) {
    if (this.hasAnswer(index)) {
      this.answeredQuestions.add(index);
    } else {
      this.answeredQuestions.delete(index);
    }

    // Trigger auto-save via subject correctly
    this.saveSubject.next();
  }

  private performSave() {
    if (this.submissionId && this.answerForm && !this.timeExpired && !this.submitting) {
      const answers = this.answerForm.value.answers.map((answer: string, idx: number) => ({
        question_id: this.test.questions[idx].question_id,
        answer: answer || ''
      }));

      this.apiService.updateSubmission(this.submissionId, { answers }).subscribe({
        error: (err) => console.error('Error auto-saving progress:', err)
      });
    }
  }

  getIndicatorsTransform(): string {
    const maxVisible = 12; // Максимум видимых индикаторов
    const total = this.test?.questions?.length || 0;

    if (total <= maxVisible) {
      return 'translateX(0)';
    }

    // Вычисляем смещение так, чтобы текущий вопрос был в центре видимой области
    const current = this.currentQuestionIndex;
    const halfVisible = Math.floor(maxVisible / 2);
    let offset = current - halfVisible;

    // Ограничиваем смещение
    if (offset < 0) {
      offset = 0;
    } else if (offset > total - maxVisible) {
      offset = total - maxVisible;
    }

    // Смещаем на отрицательное значение (12px ширина + 8px gap = 20px на индикатор)
    return `translateX(-${offset * 20}px)`;
  }

  autoSubmit() {
    // Защита от множественных вызовов
    if (this.submitting) return;

    localStorage.removeItem('active_test_timer');
    this.submitting = true;
    this.timeExpired = true;

    // Сохраняем текущие ответы перед автоматической отправкой
    if (this.answerForm && this.submissionId && this.test) {
      const answers = this.answerForm.value.answers.map((answer: string, index: number) => ({
        question_id: this.test.questions[index].question_id,
        answer: answer || ''
      }));

      this.apiService.updateSubmission(this.submissionId, { answers }).subscribe({
        next: () => {
          this.apiService.finishSubmission(this.submissionId!, false).subscribe({
            next: (result) => {
              // Track test finish activity (auto-submit)
              const currentUser = this.auth.getCurrentUser();
              if (currentUser && this.test) {
                const duration = this.startTime ? Math.floor((new Date().getTime() - this.startTime.getTime()) / 1000) : null;
                this.apiService.createActivity({
                  user_name: currentUser.name,
                  action_type: 'test_finish',
                  resource_type: 'test',
                  resource_id: this.test.id,
                  session_duration: duration
                }).subscribe({
                  error: (err) => console.error('Error tracking auto-submit activity:', err)
                });
              }

              alert('Время на прохождение теста истекло. Тест автоматически завершен.');
              this.router.navigate(['/submissions', this.submissionId, 'results']);
            },
            error: (err) => {
              console.error('Error finishing submission:', err);
              alert('Время истекло, но произошла ошибка при завершении теста. Ваши ответы сохранены.');
              this.submitting = false;
            }
          });
        },
        error: (err) => {
          console.error('Error updating submission:', err);
          alert('Время истекло, но произошла ошибка при сохранении ответов.');
          this.submitting = false;
        }
      });
    } else {
      this.submitting = false;
    }
  }
  onCancel() {
    if (this.submitting) return;

    // Save current answers as draft before leaving - ONLY for PROJECTS
    const isProject = this.test?.test_type?.toLowerCase() === 'project';
    
    if (this.submissionId && this.answerForm && !this.timeExpired && isProject) {
      const answers = this.answerForm.value.answers.map((answer: string, index: number) => ({
        question_id: this.test.questions[index].question_id,
        answer: answer || ''
      }));

      this.apiService.updateSubmission(this.submissionId, { answers }).subscribe({
        next: () => this.navigateBack(),
        error: () => this.navigateBack() // Navigate anyway even if save fails
      });
    } else {
      this.navigateBack();
    }
  }

  navigateBack() {
    const courseId = this.courseId || (this.source === 'courses' ? this.test?.subject_id : null);
    if (courseId) {
      const qParams: any = {};
      if (this.returnTab !== undefined) {
        qParams.tab = this.returnTab;
      }
      if (this.returnLessonId) {
        qParams.lessonId = this.returnLessonId;
      }
      this.router.navigate(['/courses', courseId], { queryParams: qParams });
    } else {
      this.router.navigate(['/tests']);
    }
  }

  onSubmit() {
    if (!this.submissionId) {
      alert('Ошибка: сдача теста не создана. Попробуйте обновить страницу.');
      return;
    }

    if (!this.answerForm) {
      alert('Ошибка: форма не инициализирована.');
      return;
    }

    if (this.timeExpired) {
      return;
    }

    this.submitting = true;
    localStorage.removeItem('active_test_timer');

    const answers = this.answerForm.value.answers.map((answer: string, index: number) => ({
      question_id: this.test.questions[index].question_id,
      answer: answer || ''
    }));

    this.apiService.updateSubmission(this.submissionId, { answers }).subscribe({
      next: () => {
        this.apiService.finishSubmission(this.submissionId!, false).subscribe({
          next: (result) => {
            // Track test finish activity
            const currentUser = this.auth.getCurrentUser();
            if (currentUser && this.test) {
              const duration = this.startTime ? Math.floor((new Date().getTime() - this.startTime.getTime()) / 1000) : null;
              this.apiService.createActivity({
                user_name: currentUser.name,
                action_type: 'test_finish',
                resource_type: 'test',
                resource_id: this.test.id,
                session_duration: duration
              }).subscribe({
                error: (err) => console.error('Error tracking test finish activity:', err)
              });
            }

            // Redirect based on source
            const isMultipleChoice = this.test && this.test.test_type === 'multiple_choice';
            const courseId = this.courseId || (this.source === 'courses' ? this.test?.subject_id : null);
            
            if (isMultipleChoice) {
              const resParams: any = { source: this.source };
              if (courseId) resParams.courseId = courseId;
              if (this.returnTab !== undefined) resParams.tab = this.returnTab;
              if (this.returnLessonId) resParams.lessonId = this.returnLessonId;
              this.router.navigate(['/submissions', this.submissionId, 'results'], { queryParams: resParams });
            } else {
              if (this.source === 'courses' && courseId) {
                alert('Тест завершен! Ваш результат отправлен на проверку.');
                const qParams: any = {};
                if (this.returnTab !== undefined) qParams.tab = this.returnTab;
                if (this.returnLessonId) qParams.lessonId = this.returnLessonId;
                this.router.navigate(['/courses', courseId], { queryParams: qParams });
              } else if (this.source === 'tests') {
                this.router.navigate(['/tests']);
              } else {
                this.router.navigate(['/submissions', this.submissionId, 'results']);
              }
            }
          },
          error: (err) => {
            console.error('Error finishing submission:', err);
            alert('Ошибка при завершении теста: ' + (err.error?.detail || err.message || 'Неизвестная ошибка'));
            this.submitting = false;
          }
        });
      },
      error: (err) => {
        console.error('Error updating submission:', err);
        alert('Ошибка при сохранении ответов: ' + (err.error?.detail || err.message || 'Неизвестная ошибка'));
        this.submitting = false;
      }
    });
  }

  loadSubmissionFiles() {
    if (!this.submissionId) return;
    this.apiService.getSubmissionFiles(this.submissionId).subscribe({
      next: (files) => this.uploadedFiles = files,
      error: (err) => console.error('Error loading submission files:', err)
    });
  }

  onFileSelected(event: any) {
    const files: FileList = event.target.files;
    if (!files || files.length === 0 || !this.submissionId) return;

    this.submitting = true;
    let uploadedCount = 0;
    const totalToUpload = files.length;

    for (let i = 0; i < totalToUpload; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);

      this.apiService.uploadSubmissionFile(this.submissionId, formData).subscribe({
        next: () => {
          uploadedCount++;
          if (uploadedCount === totalToUpload) {
            this.submitting = false;
            this.loadSubmissionFiles();
            alert('Файлы успешно загружены');
          }
        },
        error: (err) => {
          console.error('Error uploading file:', err);
          alert(`Ошибка при загрузке файла ${file.name}: ${err.error?.detail || err.message}`);
          this.submitting = false;
        }
      });
    }
  }

  deleteFile(fileId: string) {
    if (!this.submissionId || !confirm('Удалить этот файл из ответа?')) return;
    
    this.submitting = true;
    this.apiService.deleteSubmissionFile(this.submissionId, fileId).subscribe({
      next: () => {
        this.submitting = false;
        this.loadSubmissionFiles();
      },
      error: (err) => {
        console.error('Error deleting file:', err);
        alert('Ошибка при удалении файла');
        this.submitting = false;
      }
    });
  }

  loadTestAssets(testId: string) {
    this.apiService.getTestFiles(testId).subscribe({
      next: (assets) => this.testAssets = assets,
      error: (err) => console.error('Error loading test assets:', err)
    });
  }

  ngOnDestroy() {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
  }
}

