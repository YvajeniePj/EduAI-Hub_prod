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
    MatNativeDateModule
  ],
  template: `
    <div class="container">
    <h1>{{ isEditMode ? 'Редактировать тест' : 'Создать тест' }}</h1>
      
      <form [formGroup]="testForm" (ngSubmit)="onSubmit()">
        <mat-card>
          <mat-card-content>
            <div class="form-row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Курс</mat-label>
                <mat-select formControlName="subject_id" required (selectionChange)="onSubjectChange()">
                  <mat-option *ngFor="let subject of subjects" [value]="subject.id">
                    {{ subject.name }}
                  </mat-option>
                </mat-select>
                <mat-error *ngIf="testForm.get('subject_id')?.hasError('required')">
                  Выберите курс
                </mat-error>
              </mat-form-field>
            </div>

            <div class="form-row" *ngIf="availableGroups.length > 0">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Назначить группам (опционально)</mat-label>
                <mat-select formControlName="allowed_groups" multiple>
                  <mat-option *ngFor="let group of availableGroups" [value]="group.id">
                    {{ group.name }}
                  </mat-option>
                </mat-select>
                <mat-hint>Если не выбрано, тест доступен всем</mat-hint>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Название теста</mat-label>
                <input matInput formControlName="title" required>
                <mat-error *ngIf="testForm.get('title')?.hasError('required')">
                  Введите название теста
                </mat-error>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Описание</mat-label>
                <textarea matInput formControlName="description" rows="3"></textarea>
              </mat-form-field>
            </div>

            <div class="form-row">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Тип теста</mat-label>
              <mat-select formControlName="test_type" required (selectionChange)="onTestTypeChange()">
                <mat-option value="multiple_choice">С вариантами ответов</mat-option>
                <mat-option value="keyword_based">Развёрнутый ответ</mat-option>
                <mat-option value="project">Проект (Загрузка файлов)</mat-option>
              </mat-select>
            </mat-form-field>
            </div>

            <div class="form-row deadline-row">
              <mat-form-field appearance="outline" class="deadline-date-field">
                <mat-label>Дедлайн - Дата</mat-label>
                <input matInput [matDatepicker]="picker" formControlName="due_date" [min]="minDate" placeholder="Выберите дату">
                <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                <mat-datepicker #picker startView="month"></mat-datepicker>
                <mat-hint>Дата до которой нужно сдать работу</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" class="deadline-time-field">
                <mat-label>Время</mat-label>
                <input matInput type="time" formControlName="due_time" [min]="getMinTime()" placeholder="ЧЧ:ММ" [disabled]="!testForm.get('due_date')?.value" (input)="onTimeInput()">
                <mat-icon matSuffix>schedule</mat-icon>
                <mat-hint>Время дедлайна</mat-hint>
                <mat-error *ngIf="testForm.get('due_time')?.hasError('pastTime')">
                  Выбранное время уже прошло. Выберите будущее время.
                </mat-error>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Ограничение по времени (минуты)</mat-label>
                <input matInput type="number" formControlName="time_limit_minutes" min="1" placeholder="Оставьте пустым, если ограничения нет">
                <mat-icon matSuffix>timer</mat-icon>
                <mat-hint>Максимальное время на прохождение теста в минутах (опционально)</mat-hint>
              </mat-form-field>
            </div>

            <!-- Project Assets Section -->
            <div class="assets-section" *ngIf="isProject()">
              <h3>Файлы проекта (материалы)</h3>
              
              <!-- Existing Files -->
              <div class="file-list" *ngIf="existingFiles.length > 0">
                <mat-card *ngFor="let file of existingFiles" class="file-inline-item existing">
                  <mat-icon>cloud_done</mat-icon>
                  <span class="file-name">{{ file.original_name }}</span>
                  <span class="file-size">({{ (file.size / 1024).toFixed(1) }} KB)</span>
                  <button mat-icon-button type="button" (click)="deleteExistingFile(file.id)" color="warn" matTooltip="Удалить с сервера">
                    <mat-icon>delete_forever</mat-icon>
                  </button>
                </mat-card>
              </div>

              <p class="hint-text">Загрузите файлы, которые студенты должны будут использовать (например, Jupyter ноутбуки, датасеты).</p>
              
              <div class="file-list" *ngIf="selectedFiles.length > 0">
                <mat-card *ngFor="let file of selectedFiles; let i = index" class="file-inline-item">
                  <mat-icon>insert_drive_file</mat-icon>
                  <span class="file-name">{{ file.name }}</span>
                  <span class="file-size">({{ (file.size / 1024).toFixed(1) }} KB)</span>
                  <button mat-icon-button type="button" (click)="removeAsset(i)" color="warn">
                    <mat-icon>close</mat-icon>
                  </button>
                </mat-card>
              </div>

              <div class="upload-actions">
                <input type="file" #fileInput (change)="onFileSelected($event)" style="display: none" multiple>
                <button mat-stroked-button type="button" (click)="fileInput.click()">
                  <mat-icon>upload_file</mat-icon>
                  Прикрепить новые файлы
                </button>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <h2>Вопросы</h2>
        <div formArrayName="questions">
          <mat-card *ngFor="let question of questions.controls; let i = index" [formGroupName]="i" class="question-card">
            <mat-card-header>
              <mat-card-title>Вопрос {{ i + 1 }}</mat-card-title>
              <button mat-icon-button type="button" (click)="removeQuestion(i)" *ngIf="questions.length > 1">
                <mat-icon>delete</mat-icon>
              </button>
            </mat-card-header>
            <mat-card-content>
              <div class="form-row">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Текст вопроса</mat-label>
                  <input matInput formControlName="title" required (input)="onQuestionFieldChange()">
                  <mat-error *ngIf="questions.at(i).get('title')?.hasError('required')">
                    Введите текст вопроса
                  </mat-error>
                </mat-form-field>
              </div>

              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Максимум баллов</mat-label>
                  <input matInput type="number" formControlName="max_points" required min="1" (input)="onQuestionFieldChange()">
                  <mat-error *ngIf="questions.at(i).get('max_points')?.hasError('required')">
                    Укажите количество баллов
                  </mat-error>
                </mat-form-field>
              </div>

              <!-- Project Instruction -->
              <div *ngIf="testForm.get('test_type')?.value === 'project'">
                <p class="hint-text">Студенты должны загрузить файлы (код, отчеты и т.д.) в качестве ответа.</p>
              </div>

              <!-- Multiple Choice -->
              <div *ngIf="testForm.get('test_type')?.value === 'multiple_choice'">
                <h3>Варианты ответов</h3>
                <div [formArrayName]="'options'">
                  <div *ngFor="let option of getQuestionOptions(i).controls; let j = index" class="option-row">
                    <mat-form-field>
                      <input matInput [formControlName]="j" placeholder="Вариант ответа" required>
                    </mat-form-field>
                    <button mat-icon-button type="button" (click)="removeOption(i, j)" *ngIf="getQuestionOptions(i).length > 2">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
                <button mat-button type="button" (click)="addOption(i)">
                  <mat-icon>add</mat-icon>
                  Добавить вариант
                </button>

                <mat-form-field appearance="outline">
                  <mat-label>Правильный ответ</mat-label>
                  <mat-select formControlName="correct_answer" (selectionChange)="onCorrectAnswerChange()">
                    <mat-option *ngFor="let option of getQuestionOptions(i).value; let j = index" [value]="option">
                      {{ option || 'Вариант ' + (j + 1) }}
                    </mat-option>
                  </mat-select>
                  <mat-error *ngIf="questions.at(i).get('correct_answer')?.hasError('required')">
                    Выберите правильный ответ
                  </mat-error>
                </mat-form-field>
              </div>

              <!-- Keyword Based -->
              <div *ngIf="testForm.get('test_type')?.value === 'keyword_based'">
                <h3>Ключевые слова</h3>
                <p class="hint-text">Укажите ключевые слова, которые должны быть в ответе студента, и количество баллов за каждое слово.</p>
                <div [formArrayName]="'keywords'">
                  <div *ngFor="let keyword of getQuestionKeywords(i).controls; let j = index" [formGroupName]="j" class="keyword-row">
                    <mat-form-field appearance="outline">
                      <mat-label>Ключевое слово</mat-label>
                      <input matInput formControlName="word" placeholder="например: алгоритм" required (input)="onKeywordChange()">
                      <mat-hint>Слово, которое должен упомянуть студент</mat-hint>
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Баллы</mat-label>
                      <input matInput type="number" formControlName="points" placeholder="10" required min="1" (input)="onKeywordChange()">
                      <mat-hint>Сколько баллов дать за это слово</mat-hint>
                    </mat-form-field>
                    <button mat-icon-button type="button" (click)="removeKeyword(i, j)" class="delete-btn">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
                <button mat-button type="button" (click)="addKeyword(i)" class="add-keyword-btn">
                  <mat-icon>add</mat-icon>
                  {{ getQuestionKeywords(i).length === 0 ? 'Добавить ключевое слово' : 'Добавить еще ключевое слово' }}
                </button>

                <div class="form-row" style="margin-top: 24px;">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Образец правильного ответа (для ИИ)</mat-label>
                    <textarea matInput formControlName="correct_answer" rows="4" 
                              placeholder="Введите идеальный ответ, на который должен ориентироваться ИИ при проверке..."
                              (input)="onQuestionFieldChange()"></textarea>
                    <mat-hint>ИИ будет сравнивать ответ студента с этим образцом по смыслу</mat-hint>
                  </mat-form-field>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <button mat-raised-button type="button" (click)="addQuestion()" class="add-question-btn">
          <mat-icon>add</mat-icon>
          Добавить вопрос
        </button>

        <div class="actions">
          <button mat-raised-button color="primary" type="submit" [disabled]="!isFormValid()">
            {{ isEditMode ? 'Сохранить изменения' : 'Создать тест' }}
          </button>
          <button mat-button type="button" (click)="onCancel()">Отмена</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }
    .form-row {
      margin-bottom: 16px;
    }
    .full-width {
      width: 100%;
    }
    .question-card {
      margin-bottom: 20px;
      padding: 16px;
    }
    .option-row, .keyword-row {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      margin-bottom: 10px;
    }
    .option-row mat-form-field, .keyword-row mat-form-field {
      flex: 1;
    }
    .add-question-btn {
      margin: 20px 0;
    }
    .actions {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }
    h2 {
      margin-top: 30px;
      margin-bottom: 20px;
    }
    h3 {
      margin-top: 20px;
      margin-bottom: 10px;
      font-size: 16px;
    }
    .hint-text {
      color: #666;
      font-size: 14px;
      margin-bottom: 15px;
      font-style: italic;
    }
    mat-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .delete-btn {
      margin-top: 8px;
    }
    .add-keyword-btn {
      margin-top: 10px;
    }
    .deadline-row {
      display: flex;
      gap: 15px;
      align-items: flex-start;
    }
    .deadline-date-field {
      flex: 1.5;
    }
    .deadline-time-field {
      flex: 1;
    }
    .deadline-time-field input[type="time"] {
      font-size: 16px;
      padding: 12px 0;
      letter-spacing: 2px;
    }
    .deadline-time-field mat-icon {
      color: #666;
    }
    .assets-section {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #eee;
    }
    .file-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }
    .file-inline-item {
      display: flex;
      align-items: center;
      padding: 8px 16px !important;
      gap: 12px;
      background: #f8f9fa !important;
      box-shadow: none !important;
      border: 1px solid #e0e0e0;
    }
    .file-name {
      flex: 1;
      font-weight: 500;
    }
    .file-size {
      color: #757575;
      font-size: 13px;
    }
    .upload-actions {
      display: flex;
      justify-content: flex-start;
    }
    .file-inline-item.existing {
      background: #e8f5e9 !important;
      border-color: #c8e6c9;
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

    // Check for edit mode
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.testId = params['id'];
        this.loadTestData(this.testId!);
      }
    });
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
    this.getQuestionOptions(questionIndex).removeAt(optionIndex);
    // Update form validity after removing option
    this.testForm.updateValueAndValidity();
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
            
            if (this.selectedFiles.length > 0) {
              this.uploadAssets(testId, testData.subject_id);
            } else {
              this.finishCreation(testData.subject_id);
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

