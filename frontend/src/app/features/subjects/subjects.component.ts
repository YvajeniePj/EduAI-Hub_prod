import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { RouterModule } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CourseGenerationService } from '../../core/services/course-generation.service';

@Component({
  selector: 'app-generate-course-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">Сгенерировать курс с AI</h2>
    <mat-dialog-content class="dialog-content-body">
      <form [formGroup]="form" *ngIf="!loading; else loadingTpl">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Тема курса</mat-label>
          <input matInput formControlName="topic" required placeholder="Например: Основы Python">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Дополнительные пожелания</mat-label>
          <textarea matInput formControlName="additionalInfo" rows="4" placeholder="Например: акцент на практику, разбор библиотек pandas и numpy..."></textarea>
        </mat-form-field>

        <p class="hint">
          <mat-icon inline>auto_awesome</mat-icon>
          AI создаст структуру курса, модули, уроки и наполнит их контентом. Это может занять около 1-2 минут.
        </p>
      </form>

      <ng-template #loadingTpl>
        <div class="loading-container">
          <mat-spinner diameter="44"></mat-spinner>
          <p>AI генерирует курс...</p>
          <p class="sub-text">Пожалуйста, не закрывайте окно</p>
        </div>
      </ng-template>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="dialog-actions-row" *ngIf="!loading">
      <button type="button" class="pill-btn pill-btn-outline" (click)="cancel()">Отмена</button>
      <button type="button" class="pill-btn pill-btn-dark" (click)="generate()" [disabled]="!form.valid">
        <mat-icon>auto_awesome</mat-icon>
        <span>Сгенерировать</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title {
      font-family: 'Instrument Serif', Georgia, serif !important;
      font-size: 26px !important;
      font-weight: 400 !important;
      color: #09090b !important;
      padding: 24px 24px 8px !important;
      margin: 0 !important;
    }
    .dialog-content-body {
      padding: 12px 24px !important;
    }
    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }
    .hint {
      font-size: 13px;
      color: #52525b;
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(0, 0, 0, 0.03);
      border: 1px solid rgba(0, 0, 0, 0.06);
      padding: 14px;
      border-radius: 12px;
      line-height: 1.4;
    }
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 24px;
      text-align: center;
    }
    .loading-container p {
      margin-top: 16px;
      font-weight: 600;
      color: #18181b;
      font-size: 15px;
    }
    .sub-text {
      font-size: 12.5px;
      color: #71717a !important;
      margin-top: 4px !important;
    }
    .dialog-actions-row {
      padding: 16px 24px 24px !important;
      gap: 10px;
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
  `]
})
export class GenerateCourseDialogComponent {
  form: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<GenerateCourseDialogComponent>,
    private courseGenService: CourseGenerationService
  ) {
    this.form = this.fb.group({
      topic: ['', Validators.required],
      additionalInfo: ['']
    });
  }

  generate() {
    if (this.form.valid) {
      const { topic, additionalInfo } = this.form.value;
      this.courseGenService.startGeneration(topic, 'Beginners', additionalInfo);
      this.dialogRef.close(true);
    }
  }

  cancel() {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-create-subject-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">Создать курс</h2>
    <mat-dialog-content class="dialog-content-body">
      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Название курса</mat-label>
          <input matInput formControlName="name" required placeholder="Например: Архитектура веб-приложений">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Описание (опционально)</mat-label>
          <textarea matInput formControlName="description" rows="4" placeholder="Краткое описание целей и содержания курса"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="dialog-actions-row">
      <button type="button" class="pill-btn pill-btn-outline" (click)="cancel()">Отмена</button>
      <button type="button" class="pill-btn pill-btn-dark" (click)="save()" [disabled]="!form.valid">
        <span>Создать</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title {
      font-family: 'Instrument Serif', Georgia, serif !important;
      font-size: 26px !important;
      font-weight: 400 !important;
      color: #09090b !important;
      padding: 24px 24px 8px !important;
      margin: 0 !important;
    }
    .dialog-content-body {
      padding: 12px 24px !important;
    }
    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }
    .dialog-actions-row {
      padding: 16px 24px 24px !important;
      gap: 10px;
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
  `]
})
export class CreateSubjectDialogComponent {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CreateSubjectDialogComponent>
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: ['']
    });
  }

  save() {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value);
    }
  }

  cancel() {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-subjects',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatTabsModule,
    MatMenuModule,
    RouterModule,
    FormsModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="page-container">
      <div class="header">
        <h1>Мои курсы</h1>
        <button mat-raised-button color="warn" class="live-dashboard-btn" [routerLink]="['/streaming']">
          <mat-icon>live_tv</mat-icon>
          Прямой эфир
        </button>
      </div>

      <div class="content-wrapper">
        <mat-tab-group animationDuration="0ms" class="custom-tabs">
          <mat-tab label="Обзор курсов">
            <div class="tab-content">
              <div class="filters-bar">

                
                <div class="search-field">
                  <input type="text" placeholder="Найти" [(ngModel)]="searchQuery" (input)="filterSubjects()">
                </div>

                <div class="spacer"></div>

                <button mat-raised-button color="accent" (click)="openGenerateDialog()" class="ai-btn" *ngIf="isAdmin">
                  <mat-icon>auto_awesome</mat-icon>
                  AI Генерация
                </button>
                
                <button mat-raised-button color="primary" (click)="openCreateDialog()" *ngIf="isAdmin">
                  Создать курс
                </button>
              </div>

              <div class="courses-grid" *ngIf="subjects.length > 0">
                <mat-card *ngFor="let subject of subjects" class="course-card" [routerLink]="['/courses', subject.id]">
                  <div class="course-cover" [class.has-image]="subject.cover_image">
                    <img *ngIf="subject.cover_image" [src]="'/api/subjects/' + subject.id + '/cover'" alt="" class="cover-img">
                    <div *ngIf="!subject.cover_image" class="cover-pattern">
                      <mat-icon class="cover-icon">auto_awesome</mat-icon>
                      <div class="cover-text">{{ subject.name }}</div>
                    </div>
                  </div>
                  <mat-card-content class="course-info">
                    <div class="course-name">{{ subject.name }}</div>
                    <div class="course-description" *ngIf="subject.description">{{ subject.description | slice:0:60 }}{{ subject.description?.length > 60 ? '...' : '' }}</div>
                  </mat-card-content>
                  <div class="course-actions" *ngIf="isAdmin">
                    <button mat-icon-button class="more-btn" (click)="$event.stopPropagation();" [matMenuTriggerFor]="menu" [disabled]="cloningSubjectId === subject.id">
                      <mat-icon *ngIf="cloningSubjectId !== subject.id">more_vert</mat-icon>
                      <mat-spinner diameter="24" *ngIf="cloningSubjectId === subject.id"></mat-spinner>
                    </button>
                    <mat-menu #menu="matMenu">
                      <button mat-menu-item (click)="openCoverUpload(subject)">
                        <mat-icon>image</mat-icon>
                        <span>Загрузить обложку</span>
                      </button>
                      <button mat-menu-item [routerLink]="['/course-builder', subject.id]">
                        <mat-icon>edit</mat-icon>
                        <span>Редактировать</span>
                      </button>
                      <button mat-menu-item (click)="cloneSubject(subject)">
                        <mat-icon>content_copy</mat-icon>
                        <span>Дублировать курс</span>
                      </button>
                      <button mat-menu-item (click)="deleteSubject(subject.id)">
                        <mat-icon>delete</mat-icon>
                        <span>Удалить</span>
                      </button>
                    </mat-menu>
                  </div>
                </mat-card>
              </div>

              <div *ngIf="subjects.length === 0" class="empty-state">
                <p>Нет доступных курсов</p>
                <div class="button-row" *ngIf="isAdmin">
                  <button mat-raised-button color="accent" (click)="openGenerateDialog()">
                    <mat-icon>auto_awesome</mat-icon>
                    Сгенерировать с AI
                  </button>
                  <button mat-raised-button color="primary" (click)="openCreateDialog()">
                    Создать курс
                  </button>
                </div>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>

      <!-- Floating Action Button for creating courses -->
      <button mat-fab color="primary" class="fab-add" (click)="openCreateDialog()" *ngIf="isAdmin">
        <mat-icon>add</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 0;
      background-color: #fff;
      min-height: 100vh;
    }

    .header {
      padding: 24px 32px 0;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .live-dashboard-btn {
      font-weight: bold;
      height: 48px;
      padding: 0 24px;
      font-size: 16px;
    }
    .live-dashboard-btn.no-pulse {
      animation: none;
    }

    @keyframes pulse-red {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.4); }
      70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(244, 67, 54, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(244, 67, 54, 0); }
    }

    h1 {
      font-size: 28px;
      font-weight: 600;
      color: #6200ee; /* Purple color from screenshot */
      margin: 0;
    }

    .content-wrapper {
      padding: 0 32px;
    }

    /* Custom Tabs Styling */
    ::ng-deep .custom-tabs .mat-mdc-tab-label-container {
      border-bottom: 1px solid #e0e0e0;
    }

    ::ng-deep .custom-tabs .mat-mdc-tab-label {
      font-weight: 600;
      color: #6200ee;
      opacity: 1;
      font-size: 14px;
      text-transform: uppercase;
    }

    ::ng-deep .custom-tabs .mat-mdc-tab-indicator .mdc-tab-indicator__content--underline {
      border-color: #6200ee !important;
    }

    .tab-content {
      padding-top: 24px;
    }

    /* Filters Bar */
    .filters-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 32px;
      flex-wrap: wrap;
      align-items: center;
      background: #f9f9f9;
      padding: 16px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }

    .filter-btn, .sort-btn, .view-btn {
      color: #757575;
      border-color: #e0e0e0;
      font-weight: 400;
      background: white;
    }

    .search-field input {
      padding: 8px 12px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      width: 200px;
      font-size: 14px;
    }

    .spacer {
      flex: 1;
    }

    .ai-btn {
      margin-right: 12px;
      background-color: #b388ff !important; /* Lighter purple accent */
      color: #311b92 !important;
    }

    /* Grid */
    .courses-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 24px;
    }

    .course-card {
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
      transition: all 0.3s cubic-bezier(.25,.8,.25,1);
      cursor: pointer;
      position: relative;
      overflow: hidden;
      border: 1px solid #e0e0e0;
    }

    .course-card:hover {
      box-shadow: 0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22);
    }

    .course-cover {
      height: 140px;
      background-color: #1a1a1a;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    
    .cover-pattern {
        text-align: center;
    }
    
    .cover-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .course-cover.has-image {
        padding: 0;
    }

    .cover-icon {
        color: #cddc39; /* Lime green accent */
    }

    .cover-text {
        font-weight: 700;
        text-transform: uppercase;
        padding: 0 16px;
    }

    .course-info {
      padding: 16px;
    }

    .course-name {
      font-size: 16px;
      font-weight: 500;
      color: #000;
      margin-bottom: 4px;
      line-height: 1.4;
    }

    .course-description {
      font-size: 12px;
      color: #757575;
      line-height: 1.4;
    }

    .course-actions {
      position: absolute;
      bottom: 8px;
      right: 8px;
    }
    
    .more-btn {
        color: #757575;
    }

    .fab-add {
      position: fixed;
      bottom: 32px;
      right: 32px;
      background-color: #6200ee;
    }

    .empty-state {
        text-align: center;
        margin-top: 48px;
        color: #757575;
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    
    .button-row {
        display: flex;
        gap: 16px;
        margin-top: 16px;
    }
  `]
})
export class SubjectsComponent implements OnInit {
  subjects: any[] = [];
  allSubjects: any[] = [];
  searchQuery: string = '';
  cloningSubjectId: string | null = null;
  loading: boolean = false;
  isAdmin: boolean = false;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) { 
    const user = this.authService.getCurrentUser();
    this.isAdmin = user?.role === 'teacher' || user?.role === 'admin';
  }

  ngOnInit() {
    this.loadSubjects();
  }

  loadSubjects() {
    this.apiService.getSubjects().subscribe({
      next: (subjects) => {
        this.allSubjects = subjects;
        this.filterSubjects();
      },
      error: (err) => console.error('Error loading subjects:', err)
    });
  }

  filterSubjects() {
    if (!this.searchQuery) {
      this.subjects = [...this.allSubjects];
    } else {
      const query = this.searchQuery.toLowerCase().trim();
      this.subjects = this.allSubjects.filter(subject =>
        subject.name.toLowerCase().includes(query) ||
        (subject.description && subject.description.toLowerCase().includes(query))
      );
    }
  }

  openCreateDialog() {
    const dialogRef = this.dialog.open(CreateSubjectDialogComponent, {
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.apiService.createSubject(result.name, result.description).subscribe({
          next: () => {
            this.loadSubjects();
          },
          error: (err) => {
            console.error('Error creating subject:', err);
            alert('Ошибка при создании курса: ' + (err.error?.detail || err.message));
          }
        });
      }
    });
  }

  openGenerateDialog() {
    const dialogRef = this.dialog.open(GenerateCourseDialogComponent, {
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.snackBar.open('Генерация курса запущена в фоновом режиме! Следите за прогрессом в виджете.', 'Отлично', { duration: 4000 });
      }
    });
  }
  
  cloneSubject(subject: any) {
    if (confirm(`Создать копию курса "${subject.name}"? (Материалы будут скопированы, студенты - нет)`)) {
      this.cloningSubjectId = subject.id;
      this.apiService.cloneSubject(subject.id).subscribe({
        next: () => {
          this.cloningSubjectId = null;
          this.loadSubjects();
          this.snackBar.open('Курс успешно скопирован!', 'Закрыть', { duration: 3000 });
        },
        error: (err) => {
          this.cloningSubjectId = null;
          console.error('Error cloning subject:', err);
          this.snackBar.open('Ошибка при клонировании курса: ' + (err.error?.detail || err.message), 'Закрыть', { duration: 5000 });
        }
      });
    }
  }

  deleteSubject(id: string) {
    if (confirm('Удалить курс?')) {
      this.apiService.deleteSubject(id).subscribe({
        next: () => this.loadSubjects(),
        error: (err) => console.error('Error deleting subject:', err)
      });
    }
  }

  openCoverUpload(subject: any) {
    // Create a hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif';

    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      this.apiService.uploadSubjectCover(subject.id, formData).subscribe({
        next: () => {
          this.loadSubjects();
          alert('Обложка загружена! Рекомендуемый размер: 600×400px');
        },
        error: (err) => {
          console.error('Error uploading cover:', err);
          alert('Ошибка при загрузке обложки: ' + (err.error?.detail || err.message));
        }
      });
    };

    input.click();
  }
}
