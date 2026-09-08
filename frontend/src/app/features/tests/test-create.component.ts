import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule, FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-test-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTooltipModule
  ],
  template: `
    <div class="test-editor-layout">
      <!-- Top Navigation & Header Bar -->
      <div class="top-nav-bar">
        <button type="button" class="back-pill-btn" (click)="onCancel()">
          <mat-icon>arrow_back</mat-icon>
          <span>{{ getBackLabel() }}</span>
        </button>

        <div class="header-status-tags">
          <span class="mode-badge" [class.edit]="isEditMode">
            <mat-icon>{{ isEditMode ? 'edit_note' : 'add_circle' }}</mat-icon>
            {{ isEditMode ? 'Режим редактирования' : 'Создание нового теста' }}
          </span>
        </div>
      </div>

      <header class="editor-header">
        <div class="header-tag">
          <mat-icon>quiz</mat-icon>
          <span>ТЕСТИРОВАНИЕ И ОЦЕНКА</span>
        </div>
        <h1 class="page-main-title">{{ isEditMode ? 'Редактировать тест' : 'Создать проверочный тест' }}</h1>
        <p class="page-subtitle">Настройте общие параметры теста, установите дедлайн и сформируйте список вопросов</p>
      </header>

      <form [formGroup]="testForm" (ngSubmit)="onSubmit()" class="editor-form">
        <!-- Main Parameters Glass Card -->
        <section class="glass-card main-settings-card">
          <div class="card-section-header">
            <div class="section-icon-badge">
              <mat-icon>tune</mat-icon>
            </div>
            <div class="section-text">
              <h2 class="section-title">Основные параметры</h2>
              <span class="section-hint">Курс, название и базовые условия прохождения</span>
            </div>
          </div>

          <!-- Preselected Course Banner -->
          <div class="course-pill-banner" *ngIf="hasPreselectedSubject && getSelectedSubjectName()">
            <div class="course-banner-icon">
              <mat-icon>school</mat-icon>
            </div>
            <div class="course-banner-info">
              <span class="course-banner-label">Тест привязан к курсу</span>
              <span class="course-banner-title">{{ getSelectedSubjectName() }}</span>
            </div>
          </div>

          <!-- Course Selector (when not preselected) -->
          <div class="form-row" *ngIf="!hasPreselectedSubject">
            <mat-form-field appearance="outline" class="full-width modern-field">
              <mat-label>Курс</mat-label>
              <mat-select formControlName="subject_id" required (selectionChange)="onSubjectChange()">
                <mat-option *ngFor="let subject of subjects" [value]="subject.id">
                  {{ subject.name }}
                </mat-option>
              </mat-select>
              <mat-icon matPrefix class="field-icon">school</mat-icon>
              <mat-error *ngIf="testForm.get('subject_id')?.hasError('required')">
                Выберите курс для размещения теста
              </mat-error>
            </mat-form-field>
          </div>

          <!-- Groups Selector -->
          <div class="form-row" *ngIf="availableGroups.length > 0">
            <mat-form-field appearance="outline" class="full-width modern-field">
              <mat-label>Назначить учебным группам (опционально)</mat-label>
              <mat-select formControlName="allowed_groups" multiple>
                <mat-option *ngFor="let group of availableGroups" [value]="group.id">
                  {{ group.name }}
                </mat-option>
              </mat-select>
              <mat-icon matPrefix class="field-icon">group</mat-icon>
              <mat-hint>Если группы не выбраны, тест доступен всем студентам курса</mat-hint>
            </mat-form-field>
          </div>

          <!-- Test Title -->
          <div class="form-row">
            <mat-form-field appearance="outline" class="full-width modern-field title-field">
              <mat-label>Название теста</mat-label>
              <input matInput formControlName="title" placeholder="Например: Проверочный тест по основам Python" required>
              <mat-icon matPrefix class="field-icon">edit</mat-icon>
              <mat-error *ngIf="testForm.get('title')?.hasError('required')">
                Введите название теста
              </mat-error>
            </mat-form-field>
          </div>

          <!-- Test Description -->
          <div class="form-row">
            <mat-form-field appearance="outline" class="full-width modern-field">
              <mat-label>Описание и инструкции для студентов</mat-label>
              <textarea matInput formControlName="description" rows="3" placeholder="Укажите рекомендации, разрешенные материалы или важные детали..."></textarea>
              <mat-hint>Отображается студентам перед началом тестирования</mat-hint>
            </mat-form-field>
          </div>

          <!-- Test Type -->
          <div class="form-row">
            <mat-form-field appearance="outline" class="full-width modern-field">
              <mat-label>Тип проверки теста</mat-label>
              <mat-select formControlName="test_type" required (selectionChange)="onTestTypeChange()">
                <mat-option value="multiple_choice">
                  <div class="type-select-item">
                    <mat-icon class="type-select-icon">check_circle_outline</mat-icon>
                    <div class="type-select-info">
                      <span class="type-select-name">С вариантами ответов</span>
                      <span class="type-select-desc">Автоматическая моментальная проверка</span>
                    </div>
                  </div>
                </mat-option>
                <mat-option value="keyword_based">
                  <div class="type-select-item">
                    <mat-icon class="type-select-icon">psychology</mat-icon>
                    <div class="type-select-info">
                      <span class="type-select-name">Развёрнутый ответ</span>
                      <span class="type-select-desc">Оценка нейросетью по смыслу и ключевым терминам</span>
                    </div>
                  </div>
                </mat-option>
                <mat-option value="project">
                  <div class="type-select-item">
                    <mat-icon class="type-select-icon">folder_zip</mat-icon>
                    <div class="type-select-info">
                      <span class="type-select-name">Практический проект</span>
                      <span class="type-select-desc">Загрузка архивов с кодом, ноутбуков или отчётов</span>
                    </div>
                  </div>
                </mat-option>
              </mat-select>
              <mat-icon matPrefix class="field-icon">fact_check</mat-icon>
            </mat-form-field>
          </div>

          <!-- 3-Column Responsive Grid: Date, Time, Limit -->
          <div class="params-triplet-grid">
            <mat-form-field appearance="outline" class="modern-field">
              <mat-label>Дата сдачи (дедлайн)</mat-label>
              <input matInput [matDatepicker]="picker" formControlName="due_date" [min]="minDate" placeholder="Выберите дату">
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
              <mat-hint>Крайний срок сдачи</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" class="modern-field">
              <mat-label>Время дедлайна</mat-label>
              <input matInput type="time" formControlName="due_time" [min]="getMinTime()" placeholder="23:59" [disabled]="!testForm.get('due_date')?.value" (input)="onTimeInput()">
              <mat-icon matSuffix class="field-icon">schedule</mat-icon>
              <mat-hint>Время по Москве</mat-hint>
              <mat-error *ngIf="testForm.get('due_time')?.hasError('pastTime')">
                Выбранное время уже прошло
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="modern-field">
              <mat-label>Лимит времени (минуты)</mat-label>
              <input matInput type="number" formControlName="time_limit_minutes" min="1" placeholder="Без ограничений">
              <mat-icon matSuffix class="field-icon">timer</mat-icon>
              <mat-hint>Таймер прохождения</mat-hint>
            </mat-form-field>
          </div>

          <!-- Project Assets Section -->
          <div class="project-assets-box" *ngIf="isProject()">
            <div class="assets-box-header">
              <mat-icon>attachment</mat-icon>
              <div>
                <h4 class="assets-box-title">Материалы к практическому проекту</h4>
                <p class="assets-box-desc">Прикрепите исходные данные, шаблоны ноутбуков или методические указания</p>
              </div>
            </div>

            <!-- Existing Files on server -->
            <div class="files-stack" *ngIf="existingFiles.length > 0">
              <div *ngFor="let file of existingFiles" class="file-chip-row existing">
                <div class="file-icon"><mat-icon>cloud_done</mat-icon></div>
                <div class="file-details">
                  <span class="file-title">{{ file.original_name }}</span>
                  <span class="file-meta">{{ (file.size / 1024).toFixed(1) }} KB • На сервере</span>
                </div>
                <button type="button" class="file-del-btn" (click)="deleteExistingFile(file.id)" matTooltip="Удалить с сервера">
                  <mat-icon>delete_forever</mat-icon>
                </button>
              </div>
            </div>

            <!-- Selected Files for upload -->
            <div class="files-stack" *ngIf="selectedFiles.length > 0">
              <div *ngFor="let file of selectedFiles; let fi = index" class="file-chip-row">
                <div class="file-icon"><mat-icon>insert_drive_file</mat-icon></div>
                <div class="file-details">
                  <span class="file-title">{{ file.name }}</span>
                  <span class="file-meta">{{ (file.size / 1024).toFixed(1) }} KB • Будет загружен при сохранении</span>
                </div>
                <button type="button" class="file-del-btn" (click)="removeAsset(fi)" matTooltip="Убрать">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>

            <div class="upload-dropzone-card" (click)="fileInput.click()">
              <input type="file" #fileInput (change)="onFileSelected($event)" style="display: none" multiple>
              <div class="dropzone-circle">
                <mat-icon>cloud_upload</mat-icon>
              </div>
              <span class="dropzone-cta">Нажмите, чтобы прикрепить файлы</span>
              <span class="dropzone-types">Поддерживаются ZIP, IPYNB, PDF, DOCX, CSV</span>
            </div>
          </div>
        </section>

        <!-- Questions Section -->
        <div class="questions-section-header">
          <div class="section-title-group">
            <h2 class="questions-main-heading">Вопросы теста</h2>
            <span class="questions-count-pill">{{ questions.length }} {{ getQuestionsWord(questions.length) }}</span>
          </div>

          <div class="points-summary-badge">
            <mat-icon>stars</mat-icon>
            <span>Всего: <strong>{{ getTotalPoints() }}</strong> баллов</span>
          </div>
        </div>

        <!-- Questions List -->
        <div formArrayName="questions" class="questions-stack">
          <div *ngFor="let question of questions.controls; let i = index" 
               [formGroupName]="i" 
               class="question-modern-card">

            <!-- Question Card Topbar -->
            <div class="q-card-topbar">
              <div class="q-index-pill">
                <span class="q-number-text">Вопрос {{ i + 1 }}</span>
                <span class="q-type-badge">{{ getQuestionTypeBadge() }}</span>
              </div>

              <div class="q-actions-group">
                <div class="points-field-group">
                  <label [for]="'points-' + i">Баллы:</label>
                  <input [id]="'points-' + i" 
                         type="number" 
                         formControlName="max_points" 
                         class="points-inline-input"
                         required 
                         min="1" 
                         (input)="onQuestionFieldChange()">
                  <span class="points-inline-suffix">б.</span>
                </div>

                <button type="button" 
                        class="q-icon-btn" 
                        (click)="duplicateQuestion(i)" 
                        matTooltip="Дублировать вопрос">
                  <mat-icon>content_copy</mat-icon>
                </button>

                <button type="button" 
                        class="q-icon-btn delete" 
                        (click)="removeQuestion(i)" 
                        *ngIf="questions.length > 1" 
                        matTooltip="Удалить вопрос">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
            </div>

            <!-- Question Title Field -->
            <div class="form-row q-title-row">
              <mat-form-field appearance="outline" class="full-width modern-field">
                <mat-label>Формулировка вопроса</mat-label>
                <input matInput formControlName="title" placeholder="Введите суть вопроса..." required (input)="onQuestionFieldChange()">
                <mat-error *ngIf="questions.at(i).get('title')?.hasError('required')">
                  Введите формулировку вопроса
                </mat-error>
              </mat-form-field>
            </div>

            <!-- Project Type Notice -->
            <div class="project-info-notice" *ngIf="testForm.get('test_type')?.value === 'project'">
              <mat-icon>info</mat-icon>
              <div>
                <strong>Формат практического ответа:</strong>
                <p>Студенты должны будут загрузить свои файлы (код, архивы, отчеты) в качестве решения данного задания.</p>
              </div>
            </div>

            <!-- Multiple Choice Options -->
            <div class="options-container" *ngIf="testForm.get('test_type')?.value === 'multiple_choice'">
              <div class="options-section-label">
                <span class="options-heading">Варианты ответов</span>
                <span class="options-instruction">Кликните по кружку слева, чтобы отметить верный вариант ответа</span>
              </div>

              <div [formArrayName]="'options'" class="options-rows-list">
                <div *ngFor="let option of getQuestionOptions(i).controls; let j = index" 
                     class="option-row-item"
                     [class.correct]="isOptionCorrect(i, j)">
                  
                  <button type="button" 
                          class="option-radio-btn" 
                          [class.selected]="isOptionCorrect(i, j)"
                          (click)="setCorrectAnswer(i, j)"
                          [matTooltip]="isOptionCorrect(i, j) ? 'Правильный ответ' : 'Сделать правильным'">
                    <mat-icon>{{ isOptionCorrect(i, j) ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                  </button>

                  <span class="option-letter-chip" [class.selected]="isOptionCorrect(i, j)">
                    {{ getOptionLetter(j) }}
                  </span>

                  <div class="option-input-field">
                    <input class="option-native-input" 
                           [formControlName]="j" 
                           [placeholder]="'Вариант ' + getOptionLetter(j)" 
                           (input)="onOptionInput(i, j)"
                           required>
                  </div>

                  <span class="correct-tag-badge" *ngIf="isOptionCorrect(i, j)">
                    <mat-icon>check</mat-icon> Верный
                  </span>

                  <button type="button" 
                          class="option-delete-btn" 
                          (click)="removeOption(i, j)" 
                          *ngIf="getQuestionOptions(i).length > 2"
                          matTooltip="Удалить этот вариант">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              </div>

              <div class="options-footer-bar">
                <button type="button" class="btn-add-option-pill" (click)="addOption(i)">
                  <mat-icon>add</mat-icon>
                  <span>Добавить вариант</span>
                </button>

                <div class="unselected-warning" *ngIf="!questions.at(i).get('correct_answer')?.value">
                  <mat-icon>warning_amber</mat-icon>
                  <span>Выберите верный вариант ответа</span>
                </div>
              </div>
            </div>

            <!-- Keyword Based -->
            <div class="keywords-container" *ngIf="testForm.get('test_type')?.value === 'keyword_based'">
              <div class="keywords-header">
                <div class="keywords-title-with-icon">
                  <mat-icon>vpn_key</mat-icon>
                  <span class="keywords-heading">Ключевые слова для ИИ-анализа</span>
                </div>
                <span class="keywords-instruction">Укажите термины и количество баллов, которое ИИ начислит за их грамотное употребление</span>
              </div>

              <div [formArrayName]="'keywords'" class="keywords-rows-list">
                <div *ngFor="let keyword of getQuestionKeywords(i).controls; let j = index" [formGroupName]="j" class="keyword-row-item">
                  <div class="keyword-word-col">
                    <mat-form-field appearance="outline" class="keyword-input-wrap">
                      <mat-label>Ключевое слово или термин</mat-label>
                      <input matInput formControlName="word" placeholder="например: градиентный спуск" required (input)="onKeywordChange()">
                    </mat-form-field>
                  </div>

                  <div class="keyword-points-col">
                    <mat-form-field appearance="outline" class="keyword-input-wrap">
                      <mat-label>Баллы</mat-label>
                      <input matInput type="number" formControlName="points" placeholder="2" required min="1" (input)="onKeywordChange()">
                    </mat-form-field>
                  </div>

                  <button type="button" class="keyword-del-btn" (click)="removeKeyword(i, j)" matTooltip="Удалить слово">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </div>

              <button type="button" class="btn-add-keyword-pill" (click)="addKeyword(i)">
                <mat-icon>add</mat-icon>
                <span>{{ getQuestionKeywords(i).length === 0 ? 'Добавить ключевое слово' : 'Добавить ещё одно слово' }}</span>
              </button>

              <div class="ai-reference-card">
                <div class="ai-ref-header">
                  <mat-icon>auto_awesome</mat-icon>
                  <div>
                    <span class="ai-ref-title">Эталон ответа для ИИ-ассистента</span>
                    <span class="ai-ref-subtitle">ИИ будет сопоставлять аргументацию и логику ответа студента с этим образцом</span>
                  </div>
                </div>
                <mat-form-field appearance="outline" class="full-width modern-field ref-answer-field">
                  <mat-label>Образец идеального ответа</mat-label>
                  <textarea matInput 
                            formControlName="correct_answer" 
                            rows="4" 
                            placeholder="Опишите полный идеальный ответ студента на этот вопрос..."
                            (input)="onQuestionFieldChange()"></textarea>
                </mat-form-field>
              </div>
            </div>

          </div>
        </div>

        <!-- Sticky Bottom Action Dock -->
        <div class="bottom-dock-wrapper">
          <div class="bottom-dock">
            <div class="dock-left">
              <button type="button" class="dock-add-btn" (click)="addQuestion()">
                <mat-icon>add_circle_outline</mat-icon>
                <span>Добавить вопрос</span>
              </button>
            </div>

            <div class="dock-right">
              <button type="button" class="dock-cancel-btn" (click)="onCancel()">
                Отмена
              </button>

              <button type="submit" class="dock-submit-btn" [disabled]="!isFormValid()">
                <mat-icon>{{ isEditMode ? 'save' : 'check' }}</mat-icon>
                <span>{{ isEditMode ? 'Сохранить изменения' : 'Создать тест' }}</span>
              </button>
            </div>
          </div>
        </div>

      </form>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #fafafa;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #09090b;
    }

    .test-editor-layout {
      max-width: 920px;
      margin: 0 auto;
      padding: 32px 24px 100px 24px;
      box-sizing: border-box;
    }

    /* Top Navigation Bar */
    .top-nav-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .back-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 100px;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 500;
      color: #27272a;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: all 0.2s ease;
    }

    .back-pill-btn:hover {
      background: #f4f4f5;
      color: #09090b;
      transform: translateX(-2px);
    }

    .back-pill-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .header-status-tags {
      display: flex;
      gap: 8px;
    }

    .mode-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 600;
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #dbeafe;
    }

    .mode-badge.edit {
      background: #fef3c7;
      color: #b45309;
      border-color: #fde68a;
    }

    .mode-badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    /* Editor Header */
    .editor-header {
      margin-bottom: 28px;
    }

    .header-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6366f1;
      margin-bottom: 8px;
    }

    .header-tag mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .page-main-title {
      font-size: 32px;
      font-weight: 700;
      color: #09090b;
      margin: 0 0 8px 0;
      letter-spacing: -0.025em;
      line-height: 1.2;
    }

    .page-subtitle {
      font-size: 15px;
      color: #71717a;
      margin: 0;
      line-height: 1.5;
    }

    /* Glass Panels & Cards */
    .glass-card {
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 20px;
      box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.04);
      padding: 28px;
      margin-bottom: 28px;
      box-sizing: border-box;
    }

    .card-section-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 22px;
      padding-bottom: 16px;
      border-bottom: 1px solid #f4f4f5;
    }

    .section-icon-badge {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: #f4f4f5;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #18181b;
      flex-shrink: 0;
    }

    .section-icon-badge mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #09090b;
      margin: 0;
      letter-spacing: -0.01em;
    }

    .section-hint {
      font-size: 13px;
      color: #71717a;
      margin-top: 2px;
      display: block;
    }

    /* Course Pill Banner */
    .course-pill-banner {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 18px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      margin-bottom: 20px;
    }

    .course-banner-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #18181b;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .course-banner-icon mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .course-banner-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      display: block;
    }

    .course-banner-title {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
    }

    /* Form Rows and Fields */
    .form-row {
      margin-bottom: 20px;
    }

    .full-width {
      width: 100%;
    }

    .modern-field {
      width: 100%;
    }

    .field-icon {
      color: #71717a;
      margin-right: 6px;
    }

    /* Type Selector Options */
    .type-select-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 0;
    }

    .type-select-icon {
      color: #6366f1;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .type-select-info {
      display: flex;
      flex-direction: column;
    }

    .type-select-name {
      font-size: 14px;
      font-weight: 600;
      color: #09090b;
    }

    .type-select-desc {
      font-size: 12px;
      color: #71717a;
    }

    /* 3-Column Params Grid */
    .params-triplet-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 4px;
    }

    @media (max-width: 768px) {
      .params-triplet-grid {
        grid-template-columns: 1fr;
      }
    }

    /* Project Assets Box */
    .project-assets-box {
      margin-top: 24px;
      padding-top: 22px;
      border-top: 1px solid #f4f4f5;
    }

    .assets-box-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
      color: #18181b;
    }

    .assets-box-header mat-icon {
      color: #6366f1;
      font-size: 22px;
      width: 22px;
      height: 22px;
      margin-top: 2px;
    }

    .assets-box-title {
      font-size: 15px;
      font-weight: 600;
      color: #09090b;
      margin: 0;
    }

    .assets-box-desc {
      font-size: 13px;
      color: #71717a;
      margin: 4px 0 0 0;
    }

    .files-stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 14px;
    }

    .file-chip-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
    }

    .file-chip-row.existing {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }

    .file-icon {
      color: #64748b;
      display: flex;
      align-items: center;
    }

    .file-chip-row.existing .file-icon {
      color: #16a34a;
    }

    .file-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .file-title {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-meta {
      font-size: 11px;
      color: #64748b;
    }

    .file-del-btn {
      border: none;
      background: transparent;
      color: #94a3b8;
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .file-del-btn:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }

    .upload-dropzone-card {
      border: 1.5px dashed #cbd5e1;
      border-radius: 14px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #fcfcfd;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .upload-dropzone-card:hover {
      border-color: #6366f1;
      background: #f5f3ff;
    }

    .dropzone-circle {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #eef2ff;
      color: #6366f1;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }

    .dropzone-cta {
      font-size: 14px;
      font-weight: 600;
      color: #18181b;
    }

    .dropzone-types {
      font-size: 12px;
      color: #71717a;
      margin-top: 4px;
    }

    /* Questions Section Header */
    .questions-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 36px 0 20px 0;
    }

    .section-title-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .questions-main-heading {
      font-size: 22px;
      font-weight: 700;
      color: #09090b;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .questions-count-pill {
      background: #f4f4f5;
      color: #52525b;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 100px;
    }

    .points-summary-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #fefce8;
      border: 1px solid #fef08a;
      color: #854d0e;
      padding: 6px 14px;
      border-radius: 100px;
      font-size: 13px;
      font-weight: 500;
    }

    .points-summary-badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #eab308;
    }

    /* Question Card */
    .questions-stack {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .question-modern-card {
      background: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 18px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.03);
      padding: 24px;
      box-sizing: border-box;
      transition: all 0.2s ease;
    }

    .question-modern-card:hover {
      border-color: #cbd5e1;
      box-shadow: 0 6px 24px -2px rgba(0, 0, 0, 0.06);
    }

    .q-card-topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid #f4f4f5;
    }

    .q-index-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .q-number-text {
      font-size: 15px;
      font-weight: 700;
      color: #09090b;
    }

    .q-type-badge {
      font-size: 11px;
      font-weight: 600;
      color: #4f46e5;
      background: #eef2ff;
      padding: 2px 8px;
      border-radius: 6px;
    }

    .q-actions-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .points-field-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 500;
      color: #64748b;
    }

    .points-inline-input {
      width: 40px;
      border: none;
      background: transparent;
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      text-align: center;
      outline: none;
      padding: 0;
      font-family: inherit;
    }

    .points-inline-suffix {
      font-size: 12px;
      color: #64748b;
    }

    .q-icon-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid #e4e4e7;
      background: #ffffff;
      color: #71717a;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
      padding: 0;
    }

    .q-icon-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .q-icon-btn:hover {
      background: #f4f4f5;
      color: #18181b;
      border-color: #d4d4d8;
    }

    .q-icon-btn.delete:hover {
      background: #fef2f2;
      color: #ef4444;
      border-color: #fecaca;
    }

    .q-title-row {
      margin-bottom: 16px;
    }

    /* Project Notice */
    .project-info-notice {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      color: #166534;
      font-size: 13px;
    }

    .project-info-notice mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #16a34a;
    }

    .project-info-notice p {
      margin: 4px 0 0 0;
      color: #15803d;
    }

    /* Options Section (Multiple Choice) */
    .options-container {
      margin-top: 16px;
    }

    .options-section-label {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: 12px;
    }

    .options-heading {
      font-size: 14px;
      font-weight: 600;
      color: #09090b;
    }

    .options-instruction {
      font-size: 12px;
      color: #71717a;
    }

    .options-rows-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .option-row-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      transition: all 0.18s ease;
    }

    .option-row-item:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }

    .option-row-item.correct {
      background: #f0fdf4;
      border-color: #86efac;
      box-shadow: 0 2px 8px rgba(34, 197, 94, 0.12);
    }

    .option-radio-btn {
      border: none;
      background: transparent;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.15s;
    }

    .option-radio-btn:hover {
      color: #64748b;
    }

    .option-radio-btn.selected {
      color: #16a34a;
    }

    .option-radio-btn mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .option-letter-chip {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      background: #e2e8f0;
      color: #475569;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.15s;
    }

    .option-letter-chip.selected {
      background: #16a34a;
      color: #ffffff;
    }

    .option-input-field {
      flex: 1;
    }

    .option-native-input {
      width: 100%;
      border: none;
      background: transparent;
      font-size: 14px;
      color: #0f172a;
      outline: none;
      font-family: inherit;
      padding: 6px 0;
    }

    .correct-tag-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      color: #15803d;
      background: rgba(34, 197, 94, 0.15);
      padding: 3px 8px;
      border-radius: 100px;
      flex-shrink: 0;
    }

    .correct-tag-badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .option-delete-btn {
      border: none;
      background: transparent;
      color: #94a3b8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
      border-radius: 6px;
      transition: all 0.15s;
      flex-shrink: 0;
    }

    .option-delete-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .option-delete-btn:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }

    .options-footer-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 12px;
    }

    .btn-add-option-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #ffffff;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-add-option-pill:hover {
      border-color: #18181b;
      color: #18181b;
      background: #f8fafc;
    }

    .btn-add-option-pill mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .unselected-warning {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #d97706;
      font-size: 12px;
      font-weight: 500;
    }

    .unselected-warning mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    /* Keyword Based Section */
    .keywords-container {
      margin-top: 16px;
    }

    .keywords-header {
      margin-bottom: 14px;
    }

    .keywords-title-with-icon {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #7c3aed;
      margin-bottom: 2px;
    }

    .keywords-title-with-icon mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .keywords-heading {
      font-size: 14px;
      font-weight: 600;
      color: #09090b;
    }

    .keywords-instruction {
      font-size: 12px;
      color: #71717a;
    }

    .keywords-rows-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }

    .keyword-row-item {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .keyword-word-col {
      flex: 1;
    }

    .keyword-points-col {
      width: 120px;
    }

    .keyword-input-wrap {
      width: 100%;
      margin-bottom: -1.25em;
    }

    .keyword-del-btn {
      border: none;
      background: transparent;
      color: #94a3b8;
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .keyword-del-btn:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }

    .btn-add-keyword-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f5f3ff;
      border: 1px solid #ddd6fe;
      border-radius: 8px;
      padding: 7px 14px;
      font-size: 13px;
      font-weight: 500;
      color: #6d28d9;
      cursor: pointer;
      transition: all 0.15s ease;
      margin-top: 8px;
    }

    .btn-add-keyword-pill:hover {
      background: #ede9fe;
    }

    .btn-add-keyword-pill mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .ai-reference-card {
      background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
      border: 1px solid #e9d5ff;
      border-radius: 14px;
      padding: 18px;
      margin-top: 20px;
    }

    .ai-ref-header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 12px;
      color: #7e22ce;
    }

    .ai-ref-header mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      margin-top: 1px;
    }

    .ai-ref-title {
      font-size: 14px;
      font-weight: 600;
      color: #581c87;
      display: block;
    }

    .ai-ref-subtitle {
      font-size: 12px;
      color: #7e22ce;
      display: block;
      margin-top: 2px;
    }

    .ref-answer-field {
      background: #ffffff;
      border-radius: 8px;
    }

    /* Sticky Bottom Action Dock */
    .bottom-dock-wrapper {
      position: sticky;
      bottom: 20px;
      z-index: 99;
      margin-top: 40px;
    }

    .bottom-dock {
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 100px;
      padding: 8px 16px;
      box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .dock-add-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #f4f4f5;
      color: #18181b;
      border: 1px solid #e4e4e7;
      border-radius: 100px;
      padding: 9px 20px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .dock-add-btn:hover {
      background: #e4e4e7;
      color: #09090b;
      transform: translateY(-1px);
    }

    .dock-add-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .dock-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .dock-cancel-btn {
      background: transparent;
      border: none;
      color: #71717a;
      border-radius: 100px;
      padding: 9px 18px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .dock-cancel-btn:hover {
      color: #18181b;
      background: rgba(0, 0, 0, 0.04);
    }

    .dock-submit-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #18181b;
      color: #ffffff;
      border: none;
      border-radius: 100px;
      padding: 9px 24px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    .dock-submit-btn:hover:not(:disabled) {
      background: #27272a;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .dock-submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }

    .dock-submit-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `]
})
export class TestCreateComponent implements OnInit {
  testForm!: FormGroup;
  isEditMode = false;
  testId: string | null = null;
  subjects: any[] = [];
  availableGroups: any[] = [];
  minDate: Date = new Date();
  selectedFiles: File[] = [];
  existingFiles: any[] = [];
  source: string | null = null;
  returnTo: string | null = null;
  hasPreselectedSubject = false;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    this.testForm = this.fb.group({
      subject_id: ['', Validators.required],
      allowed_groups: [[]],
      title: ['', Validators.required],
      description: [''],
      test_type: ['multiple_choice', Validators.required],
      due_date: [''],
      due_time: ['', this.timeValidator.bind(this)],
      time_limit_minutes: [''],
      questions: this.fb.array([this.createQuestion(1)])
    });

    // Update validators when test_type changes
    this.testForm.get('test_type')?.valueChanges.subscribe(testType => {
      this.updateQuestionValidators(testType);
    });

    // Обновляем валидацию времени при изменении даты или времени
    this.testForm.get('due_date')?.valueChanges.subscribe(() => {
      const dueTimeControl = this.testForm.get('due_time');
      if (dueTimeControl) {
        dueTimeControl.markAsTouched();
        dueTimeControl.updateValueAndValidity();
      }
    });

    this.loadSubjects();

    // Capture source from query params
    this.source = this.route.snapshot.queryParamMap.get('source');
    this.returnTo = this.route.snapshot.queryParamMap.get('returnTo');

    const urlSubjectId = this.route.snapshot.queryParams['subjectId'];
    if (urlSubjectId) {
      this.hasPreselectedSubject = true;
    }

    // Check for edit mode
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.testId = params['id'];
        this.hasPreselectedSubject = true;
        this.loadTestData(this.testId!);
      }
    });
  }

  getSelectedSubjectName(): string {
    const subjectId = this.testForm.get('subject_id')?.value;
    const subject = this.subjects.find(s => s.id === subjectId);
    return subject ? subject.name : '';
  }

  loadTestData(id: string) {
    this.apiService.getTest(id).subscribe({
      next: (test) => {
        // Prepare questions array
        while (this.questions.length > 0) {
          this.questions.removeAt(0);
        }

        test.questions?.forEach((q: any) => {
          const questionGroup = this.fb.group({
            question_id: [q.question_id],
            title: [q.title, Validators.required],
            max_points: [q.max_points, [Validators.required, Validators.min(1)]],
            options: this.fb.array(q.options?.map((o: string) => this.fb.control(o)) || [this.fb.control(''), this.fb.control('')]),
            correct_answer: [q.correct_answer || ''],
            keywords: this.fb.array(q.keywords?.map((k: any) => this.fb.group({
              word: [k.word, Validators.required],
              points: [k.points, [Validators.required, Validators.min(1)]]
            })) || [])
          });
          if (q.options && q.correct_answer) {
            const idx = q.options.indexOf(q.correct_answer);
            if (idx !== -1) {
              (questionGroup as any)._selectedOptIndex = idx;
            }
          }
          this.questions.push(questionGroup);
        });

        // Parse due_date
        let dueDate: Date | null = null;
        let dueTime: string = '';
        if (test.due_date) {
          const d = new Date(test.due_date);
          dueDate = d;
          dueTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }

        this.testForm.patchValue({
          subject_id: test.subject_id,
          allowed_groups: test.allowed_groups || [],
          title: test.title,
          description: test.description,
          test_type: test.test_type,
          due_date: dueDate,
          due_time: dueTime,
          time_limit_minutes: test.time_limit_minutes
        });

        if (test.subject_id) {
          this.loadGroups(test.subject_id);
        }

        if (test.test_type === 'project') {
          this.loadExistingFiles(id);
        }

        this.updateQuestionValidators(test.test_type);
      },
      error: (err) => {
        console.error('Error loading test data:', err);
        alert('Не удалось загрузить данные теста');
      }
    });
  }

  loadExistingFiles(testId: string) {
    this.apiService.getTestFiles(testId).subscribe(files => this.existingFiles = files);
  }

  deleteExistingFile(fileId: string) {
    if (confirm('Вы уверены, что хотите удалить этот файл с сервера?')) {
      this.apiService.deleteTestFile(this.testId!, fileId).subscribe(() => {
        this.loadExistingFiles(this.testId!);
      });
    }
  }

  loadGroups(subjectId: string) {
    this.apiService.getGroups(subjectId).subscribe({
      next: (groups) => {
        this.availableGroups = groups;
      },
      error: (err) => console.error('Error loading groups:', err)
    });
  }

  onSubjectChange() {
    const subjectId = this.testForm.get('subject_id')?.value;
    this.testForm.get('allowed_groups')?.setValue([]);
    this.availableGroups = [];
    if (subjectId) {
      this.loadGroups(subjectId);
    }
  }

  onTimeInput() {
    const dueTimeControl = this.testForm.get('due_time');
    if (dueTimeControl) {
      dueTimeControl.markAsTouched();
      dueTimeControl.updateValueAndValidity();
    }
  }

  onTestTypeChange() {
    const testType = this.testForm.get('test_type')?.value;
    this.updateQuestionValidators(testType);
  }

  updateQuestionValidators(testType: string) {
    this.questions.controls.forEach(question => {
      const correctAnswerControl = question.get('correct_answer');

      if (testType === 'multiple_choice') {
        // For multiple_choice: require correct_answer
        correctAnswerControl?.setValidators([Validators.required]);
        correctAnswerControl?.updateValueAndValidity();
      } else {
        // For keyword_based: clear correct_answer validators
        correctAnswerControl?.clearValidators();
        correctAnswerControl?.setValue(''); // Clear the value
        correctAnswerControl?.updateValueAndValidity();
      }
    });

    // Update form validity
    setTimeout(() => {
      this.testForm.updateValueAndValidity();
    }, 0);
  }

  isProject(): boolean {
    return this.testForm.get('test_type')?.value === 'project';
  }

  get questions() {
    return this.testForm?.get('questions') as FormArray;
  }

  createQuestion(index?: number): FormGroup {
    const questionIndex = index || (this.questions ? this.questions.length + 1 : 1);
    return this.fb.group({
      question_id: ['q' + questionIndex],
      title: ['', Validators.required],
      max_points: [10, [Validators.required, Validators.min(1)]],
      options: this.fb.array([
        this.fb.control(''),
        this.fb.control('')
      ]),
      correct_answer: [''],
      keywords: this.fb.array([])
    });
  }

  addQuestion() {
    if (this.questions) {
      const newQuestion = this.createQuestion(this.questions.length + 1);
      this.questions.push(newQuestion);
      // Update validators for the new question
      const testType = this.testForm.get('test_type')?.value;
      this.updateQuestionValidators(testType);
    }
  }

  removeQuestion(index: number) {
    this.questions.removeAt(index);
  }

  getQuestionOptions(index: number): FormArray {
    return this.questions.at(index).get('options') as FormArray;
  }

  addOption(questionIndex: number) {
    this.getQuestionOptions(questionIndex).push(this.fb.control(''));
    // Update form validity after adding option
    this.testForm.updateValueAndValidity();
  }

  removeOption(questionIndex: number, optionIndex: number) {
    const question = this.questions.at(questionIndex);
    const options = this.getQuestionOptions(questionIndex);
    const removedVal = options.at(optionIndex)?.value;

    if (question.get('correct_answer')?.value === removedVal || (question as any)._selectedOptIndex === optionIndex) {
      question.get('correct_answer')?.setValue('');
      (question as any)._selectedOptIndex = null;
    } else if ((question as any)._selectedOptIndex > optionIndex) {
      (question as any)._selectedOptIndex--;
    }

    options.removeAt(optionIndex);
    this.testForm.updateValueAndValidity();
  }

  duplicateQuestion(index: number) {
    const src = this.questions.at(index).value;
    const newGroup = this.fb.group({
      question_id: ['q' + (this.questions.length + 1)],
      title: [src.title ? src.title + ' (копия)' : '', Validators.required],
      max_points: [src.max_points || 10, [Validators.required, Validators.min(1)]],
      options: this.fb.array(src.options && src.options.length ? src.options.map((o: string) => this.fb.control(o)) : [this.fb.control(''), this.fb.control('')]),
      correct_answer: [src.correct_answer || ''],
      keywords: this.fb.array(src.keywords && src.keywords.length ? src.keywords.map((k: any) => this.fb.group({
        word: [k.word, Validators.required],
        points: [k.points, [Validators.required, Validators.min(1)]]
      })) : [])
    });

    const srcSelectedIdx = (this.questions.at(index) as any)._selectedOptIndex;
    if (srcSelectedIdx !== undefined && srcSelectedIdx !== null) {
      (newGroup as any)._selectedOptIndex = srcSelectedIdx;
    }

    this.questions.insert(index + 1, newGroup);
    const testType = this.testForm.get('test_type')?.value;
    this.updateQuestionValidators(testType);
    this.testForm.updateValueAndValidity();
  }

  getTotalPoints(): number {
    if (!this.questions || !this.questions.controls) return 0;
    return this.questions.controls.reduce((sum, q) => {
      const pts = Number(q.get('max_points')?.value) || 0;
      return sum + pts;
    }, 0);
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + (index % 26));
  }

  getQuestionsWord(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 19) return 'вопросов';
    if (mod10 === 1) return 'вопрос';
    if (mod10 >= 2 && mod10 <= 4) return 'вопроса';
    return 'вопросов';
  }

  getQuestionTypeBadge(): string {
    const type = this.testForm.get('test_type')?.value;
    switch (type) {
      case 'multiple_choice': return 'Один выбор';
      case 'keyword_based': return 'ИИ-анализ';
      case 'project': return 'Практика';
      default: return 'Вопрос';
    }
  }

  getBackLabel(): string {
    if (this.returnTo) return 'Назад';
    if (this.hasPreselectedSubject) return 'Назад к курсу';
    return 'Назад к тестам';
  }

  isOptionCorrect(questionIndex: number, optionIndex: number): boolean {
    const question = this.questions.at(questionIndex);
    if ((question as any)._selectedOptIndex === optionIndex) {
      return true;
    }
    const correctAnswer = question.get('correct_answer')?.value;
    const optionValue = this.getQuestionOptions(questionIndex).at(optionIndex)?.value;
    if (correctAnswer && optionValue && correctAnswer === optionValue) {
      (question as any)._selectedOptIndex = optionIndex;
      return true;
    }
    return false;
  }

  setCorrectAnswer(questionIndex: number, optionIndex: number) {
    const question = this.questions.at(questionIndex);
    (question as any)._selectedOptIndex = optionIndex;
    const optionValue = this.getQuestionOptions(questionIndex).at(optionIndex)?.value || '';
    question.get('correct_answer')?.setValue(optionValue);
    question.get('correct_answer')?.markAsTouched();
    this.onCorrectAnswerChange();
  }

  onOptionInput(questionIndex: number, optionIndex: number) {
    const question = this.questions.at(questionIndex);
    if ((question as any)._selectedOptIndex === optionIndex) {
      const optionValue = this.getQuestionOptions(questionIndex).at(optionIndex)?.value || '';
      question.get('correct_answer')?.setValue(optionValue);
    }
    this.onQuestionFieldChange();
  }

  getQuestionKeywords(index: number): FormArray {
    return this.questions.at(index).get('keywords') as FormArray;
  }

  addKeyword(questionIndex: number) {
    const keywordGroup = this.fb.group({
      word: ['', Validators.required],
      points: [1, [Validators.required, Validators.min(1)]]
    });
    this.getQuestionKeywords(questionIndex).push(keywordGroup);
    // Update form validity after adding keyword
    this.testForm.updateValueAndValidity();
  }

  removeKeyword(questionIndex: number, keywordIndex: number) {
    this.getQuestionKeywords(questionIndex).removeAt(keywordIndex);
    // Update form validity after removing keyword
    this.testForm.updateValueAndValidity();
  }

  loadSubjects() {
    this.apiService.getSubjects().subscribe({
      next: (subjects) => {
        this.subjects = subjects;
        // Check query params for pre-selection
        const subjectId = this.route.snapshot.queryParams['subjectId'];
        if (subjectId && subjects.find((s: any) => s.id === subjectId)) {
          this.testForm.patchValue({ subject_id: subjectId });
          this.loadGroups(subjectId);
        }
      },
      error: (err) => console.error('Error loading subjects:', err)
    });
  }

  onCorrectAnswerChange() {
    // Update form validity when correct answer changes
    this.testForm.updateValueAndValidity();
  }

  onKeywordChange() {
    // Update form validity when keyword fields change
    setTimeout(() => {
      this.testForm.updateValueAndValidity();
    }, 0);
  }

  getMinTime(): string {
    const dueDate = this.testForm.get('due_date')?.value;
    if (!dueDate) {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    const today = new Date();
    const selectedDate = new Date(dueDate);
    if (selectedDate.toDateString() === today.toDateString()) {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    return '00:00';
  }

  timeValidator(control: any) {
    const dueDate = this.testForm?.get('due_date')?.value;
    const dueTime = control.value;

    if (!dueDate || !dueTime) {
      return null; // Если дата или время не выбраны, валидация не требуется
    }

    const [hours, minutes] = dueTime.split(':');
    const deadline = new Date(dueDate);
    deadline.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const now = new Date();

    if (deadline.getTime() < now.getTime()) {
      return { pastTime: true }; // Время в прошлом
    }

    return null; // Время валидно
  }

  onQuestionFieldChange() {
    // Update form validity when question fields change
    setTimeout(() => {
      this.testForm.updateValueAndValidity();
    }, 0);
  }

  onFormFieldChange() {
    // Update form validity when form fields change
    setTimeout(() => {
      this.testForm.updateValueAndValidity();
    }, 0);
  }

  isFormValid(): boolean {
    // Check basic form fields
    if (!this.testForm.get('subject_id')?.value ||
      !this.testForm.get('title')?.value ||
      !this.testForm.get('test_type')?.value) {
      return false;
    }

    // Проверяем валидность времени дедлайна
    const dueDate = this.testForm.get('due_date')?.value;
    const dueTime = this.testForm.get('due_time')?.value;
    if (dueDate && dueTime) {
      if (this.testForm.get('due_time')?.hasError('pastTime')) {
        return false;
      }
    }

    const testType = this.testForm.get('test_type')?.value;

    // Check each question
    for (let i = 0; i < this.questions.length; i++) {
      const question = this.questions.at(i);

      // Title is always required
      const title = question.get('title')?.value;
      if (!title || title.trim() === '') {
        return false;
      }

      // Max points is always required
      const maxPoints = question.get('max_points')?.value;
      if (!maxPoints || maxPoints < 1) {
        return false;
      }

      if (testType === 'project') {
        // Project just needs a title/instruction
        continue;
      }

      if (testType === 'multiple_choice') {
        // For multiple_choice: need correct_answer and at least 2 options
        const correctAnswer = question.get('correct_answer')?.value;
        if (!correctAnswer || correctAnswer.trim() === '') {
          return false;
        }
        const options = question.get('options') as FormArray;
        const validOptions = options.value.filter((opt: string) => opt && opt.trim() !== '');
        if (validOptions.length < 2) {
          return false;
        }
      } else if (testType === 'keyword_based') {
        // For keyword_based: need at least one keyword with valid word and points
        const keywords = question.get('keywords') as FormArray;
        if (!keywords || keywords.length === 0) {
          return false;
        }
        // Check that at least one keyword is valid
        const validKeywords = keywords.controls.filter(kw => {
          const word = kw.get('word')?.value;
          const points = kw.get('points')?.value;
          return word && word.toString().trim() !== '' && points && Number(points) >= 1;
        });
        if (validKeywords.length === 0) {
          return false;
        }
      }
    }

    return true;
  }

  onSubmit() {
    // Mark all fields as touched to show validation errors
    this.testForm.markAllAsTouched();
    this.questions.controls.forEach(question => {
      question.markAllAsTouched();
    });

    const testType = this.testForm.get('test_type')?.value;

    // Проверяем валидность времени дедлайна перед отправкой
    const dueDateValue = this.testForm.get('due_date')?.value;
    const dueTimeValue = this.testForm.get('due_time')?.value;

    if (dueDateValue && dueTimeValue) {
      if (this.testForm.get('due_time')?.hasError('pastTime')) {
        alert('Невозможно создать тест: выбранное время дедлайна уже прошло. Выберите будущее время.');
        return;
      }
    }

    // Use custom validation instead of this.testForm.valid
    if (this.isFormValid()) {
      // Формируем дату дедлайна из отдельных полей даты и времени
      let dueDate: string | null = null;

      if (dueDateValue && dueTimeValue) {
        // dueDateValue - это Date объект из Material Datepicker
        // dueTimeValue - это строка "HH:mm"
        const [hours, minutes] = dueTimeValue.split(':');
        const deadline = new Date(dueDateValue);
        deadline.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        // Форматируем как московское время
        const year = deadline.getFullYear();
        const month = String(deadline.getMonth() + 1).padStart(2, '0');
        const day = String(deadline.getDate()).padStart(2, '0');
        dueDate = `${year}-${month}-${day}T${hours}:${minutes}:00+03:00`;
      } else if (dueDateValue) {
        // Если только дата без времени, используем конец дня
        const deadline = new Date(dueDateValue);
        deadline.setHours(23, 59, 0, 0);
        const year = deadline.getFullYear();
        const month = String(deadline.getMonth() + 1).padStart(2, '0');
        const day = String(deadline.getDate()).padStart(2, '0');
        dueDate = `${year}-${month}-${day}T23:59:00+03:00`;
      }
      const testData = {
        subject_id: this.testForm.get('subject_id')?.value,
        allowed_groups: this.testForm.get('allowed_groups')?.value,
        title: this.testForm.get('title')?.value,
        description: this.testForm.get('description')?.value,
        test_type: testType,
        due_date: dueDate,
        available_until: dueDate, // Используем ту же дату что и дедлайн
        time_limit_minutes: this.testForm.get('time_limit_minutes')?.value ? parseInt(this.testForm.get('time_limit_minutes')?.value) : null,
        questions: this.questions.controls.map((qForm: any, index: number) => {
          const q = qForm.value;
          const question: any = {
            question_id: q.question_id || ('q' + (index + 1)),
            title: q.title,
            max_points: q.max_points,
            test_type: testType
          };

          if (testType === 'multiple_choice') {
            question.options = q.options.filter((opt: string) => opt && opt.trim() !== '');
            question.correct_answer = q.correct_answer;
          } else if (testType === 'keyword_based') {
            // For keyword_based, ensure we have at least one keyword
            if (!q.keywords || q.keywords.length === 0) {
              throw new Error('Добавьте хотя бы одно ключевое слово для вопроса');
            }
            question.keywords = q.keywords.map((kw: any) => ({
              word: kw.word?.trim(),
              points: parseInt(kw.points) || 1
            })).filter((kw: any) => kw.word && kw.word.length > 0);

            if (question.keywords.length === 0) {
              throw new Error('Добавьте хотя бы одно ключевое слово для вопроса');
            }
          }

          return question;
        })
      };

      // Validate that we have at least one question
      if (testData.questions.length === 0) {
        alert('Добавьте хотя бы один вопрос');
        return;
      }

      if (this.isEditMode) {
        this.apiService.updateTest(this.testId!, testData).subscribe({
          next: () => {
            if (this.selectedFiles.length > 0) {
              this.uploadAssets(this.testId!, testData.subject_id);
            } else {
              this.finishCreation(testData.subject_id);
            }
          },
          error: (err) => {
            console.error('Error updating test:', err);
            alert('Ошибка при обновлении теста');
          }
        });
      } else {
        this.apiService.createTest(testData).subscribe({
          next: (response) => {
            console.log('Test created successfully:', response);
            const testId = response.id;
            const lessonId = this.route.snapshot.queryParams['lessonId'];
            
            const proceedAfterAttach = () => {
              if (this.selectedFiles.length > 0) {
                this.uploadAssets(testId, testData.subject_id);
              } else {
                this.finishCreation(testData.subject_id);
              }
            };

            if (lessonId) {
              this.apiService.createContent(lessonId, {
                content_type: 'test',
                test_id: testId,
                order_index: 1
              }).subscribe({
                next: () => proceedAfterAttach(),
                error: (attachErr) => {
                  console.warn('Could not auto-attach test to lesson:', attachErr);
                  proceedAfterAttach();
                }
              });
            } else {
              proceedAfterAttach();
            }
          },
          error: (err) => {
            console.error('Error creating test:', err);
            console.error('Error details:', err.error);
            alert('Ошибка при создании теста: ' + (err.error?.detail || err.error?.message || err.message || 'Неизвестная ошибка'));
          }
        });
      }
    } else {
      // Show validation errors
      const errors: string[] = [];
      if (this.testForm.get('subject_id')?.hasError('required')) {
        errors.push('Выберите курс');
      }
      if (this.testForm.get('title')?.hasError('required')) {
        errors.push('Введите название теста');
      }
      if (this.testForm.get('test_type')?.hasError('required')) {
        errors.push('Выберите тип теста');
      }

      this.questions.controls.forEach((question, index) => {
        if (question.get('title')?.hasError('required')) {
          errors.push(`Вопрос ${index + 1}: введите текст вопроса`);
        }
        if (testType === 'multiple_choice') {
          const correctAnswer = question.get('correct_answer')?.value;
          if (!correctAnswer || correctAnswer.trim() === '') {
            errors.push(`Вопрос ${index + 1}: выберите правильный ответ`);
          }
        }
        if (testType === 'keyword_based') {
          const keywords = question.get('keywords') as FormArray;
          if (!keywords || keywords.length === 0) {
            errors.push(`Вопрос ${index + 1}: добавьте хотя бы одно ключевое слово`);
          } else {
            // Check if all keywords are valid
            const invalidKeywords = keywords.controls.filter(kw => {
              const word = kw.get('word')?.value;
              const points = kw.get('points')?.value;
              return !word || word.trim() === '' || !points || points < 1;
            });
            if (invalidKeywords.length > 0) {
              errors.push(`Вопрос ${index + 1}: заполните все ключевые слова (слово и баллы)`);
            }
          }
        }
      });

      if (errors.length > 0) {
        alert('Исправьте ошибки:\n' + errors.join('\n'));
      }
    }
  }

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        this.selectedFiles.push(files[i]);
      }
    }
  }

  removeAsset(index: number) {
    this.selectedFiles.splice(index, 1);
  }

  uploadAssets(testId: string, subjectId: string) {
    let uploadedCount = 0;
    const totalFiles = this.selectedFiles.length;

    this.selectedFiles.forEach(file => {
      const formData = new FormData();
      formData.append('file', file);
      
      this.apiService.uploadTestFile(testId, formData).subscribe({
        next: () => {
          uploadedCount++;
          if (uploadedCount === totalFiles) {
            this.finishCreation(subjectId);
          }
        },
        error: (err) => {
          console.error('Error uploading file:', err);
          uploadedCount++;
          if (uploadedCount === totalFiles) {
            alert('Некоторые файлы не удалось загрузить');
            this.finishCreation(subjectId);
          }
        }
      });
    });
  }

  finishCreation(subjectId: string) {
    if (this.returnTo) {
      this.router.navigateByUrl(this.returnTo);
    } else if (this.source === 'tests') {
      this.router.navigate(['/tests']);
    } else if (subjectId) {
      this.router.navigate(['/courses', subjectId]);
    } else {
      this.router.navigate(['/tests']);
    }
  }

  onCancel() {
    if (this.returnTo) {
      this.router.navigateByUrl(this.returnTo);
    } else if (this.source === 'tests') {
      this.router.navigate(['/tests']);
    } else {
      const subjectId = this.testForm.get('subject_id')?.value || this.route.snapshot.queryParams['subjectId'];
      if (subjectId) {
        this.router.navigate(['/courses', subjectId]);
      } else {
        this.router.navigate(['/tests']);
      }
    }
  }
}

