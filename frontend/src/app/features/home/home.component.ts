import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { GenerateCourseDialogComponent, CreateSubjectDialogComponent } from '../subjects/subjects.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <div class="home-container">
      
      <!-- Welcome Banner -->
      <div class="welcome-banner">
        <div class="welcome-content">
          <h1>Добро пожаловать в EduAI Hub</h1>
          <p>Платформа находится в разработке. При обнаружении ошибок или некорректном отображении пишите в Telegram: <a href="https://t.me/Uvajenie_pj" target="_blank" class="contact-link">&#64;Uvajenie_pj</a>. Также буду очень рад вашим предложениям по улучшению!</p>
        </div>
        <div class="welcome-illustration">
          <mat-icon class="banner-icon">construction</mat-icon>
        </div>
      </div>

      <!-- Header -->
      <div class="header">
        <h1>Мои курсы</h1>
        <button mat-raised-button color="warn" class="live-dashboard-btn" [routerLink]="['/streaming']">
          <mat-icon>live_tv</mat-icon>
          Прямой эфир
        </button>
      </div>

      <div class="content-wrapper">
        <!-- Filters Bar -->
        <div class="filters-bar">
          <div class="search-field">
            <mat-icon style="color: #64748b; font-size: 20px; width: 20px; height: 20px; margin-right: 8px; vertical-align: middle;">search</mat-icon>
            <input type="text" placeholder="Найти курс..." [(ngModel)]="searchQuery" (input)="filterSubjects()">
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

        <!-- Grid of Courses -->
        <div class="courses-grid" *ngIf="subjects.length > 0">
          <mat-card *ngFor="let subject of subjects; let i = index" class="course-card" [routerLink]="['/courses', subject.id]">
            <div class="course-cover" [class.has-image]="subject.cover_image" [style.background]="subject.cover_image ? 'none' : 'var(--course-' + ((i % 6) + 1) + ')'">
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
    </div>
  `,
  styles: [`
    .home-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 12px 24px 24px;
      font-family: Roboto, sans-serif;
    }

    /* Welcome Banner */
    .welcome-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1e293b;
      color: white;
      border-radius: 16px;
      padding: 16px 32px;
      margin-bottom: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.05);
    }
    .welcome-content {
      max-width: 85%;
    }
    .welcome-content h1 {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 6px 0;
      color: #f8fafc;
      letter-spacing: -0.5px;
    }
    .welcome-content p {
      font-size: 13.5px;
      line-height: 1.5;
      margin: 0;
      color: #94a3b8;
    }
    .contact-link {
      color: #818cf8;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s ease;
    }
    .contact-link:hover {
      color: #a5b4fc;
      text-decoration: underline;
    }
    .welcome-illustration {
      background: rgba(255, 255, 255, 0.05);
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .banner-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #818cf8;
    }

    .header {
      padding: 0 8px;
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

    h1 {
      font-size: 28px;
      font-weight: 600;
      color: #1a237e;
      margin: 0;
    }

    .content-wrapper {
      padding: 0 8px;
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
      border-radius: 8px;
    }

    .search-field {
      display: flex;
      align-items: center;
      background: white;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 4px 12px;
      width: 300px;
    }

    .search-field input {
      border: none;
      outline: none;
      font-size: 14px;
      width: 100%;
    }

    .spacer {
      flex: 1;
    }

    .ai-btn {
      margin-right: 12px;
      background-color: #b388ff !important;
      color: #311b92 !important;
    }

    /* Grid */
    .courses-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 24px;
    }

    .course-card {
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      transition: all 0.25s ease;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      background: white;
    }

    .course-card:hover {
      box-shadow: 0 8px 24px rgba(0,0,0,0.1);
      transform: translateY(-2px);
      border-color: #cbd5e1;
    }

    .course-cover {
      height: 140px;
      background-color: #1a1a1a;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      overflow: hidden;
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
      color: rgba(255, 255, 255, 0.7);
      font-size: 32px;
      width: 32px;
      height: 32px;
      margin-bottom: 4px;
    }

    .cover-text {
      font-weight: 700;
      text-transform: uppercase;
      padding: 0 16px;
      font-size: 16px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }

    .course-info {
      padding: 16px;
      min-height: 90px;
    }

    .course-name {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 6px;
      line-height: 1.4;
    }

    .course-description {
      font-size: 13px;
      color: #64748b;
      line-height: 1.5;
    }

    .course-actions {
      position: absolute;
      bottom: 8px;
      right: 8px;
    }
    
    .more-btn {
      color: #64748b;
    }

    .empty-state {
      text-align: center;
      margin-top: 48px;
      color: #64748b;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px;
      border: 1px dashed #cbd5e1;
      border-radius: 12px;
      background: white;
    }
    
    .button-row {
      display: flex;
      gap: 16px;
      margin-top: 16px;
    }
  `]
})
export class HomeComponent implements OnInit {
  subjects: any[] = [];
  allSubjects: any[] = [];
  searchQuery: string = '';
  cloningSubjectId: string | null = null;
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
      width: '500px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadSubjects();
        alert('Курс успешно создан AI!');
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
