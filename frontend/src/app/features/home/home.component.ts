import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
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
      
      <!-- Welcome Banner: White translucent card with blur -->
      <div class="welcome-banner" *ngIf="isBannerVisible">
        <div class="banner-icon-wrapper">
          <mat-icon class="banner-icon">auto_awesome</mat-icon>
        </div>
        <div class="welcome-content">
          <h2 class="banner-title">Добро пожаловать в EduAI Hub</h2>
          <p class="banner-desc">
            Платформа находится в разработке. При обнаружении ошибок пишите в Telegram:
            <a href="https://t.me/Uvajenie_pj" target="_blank" class="contact-link">&#64;Uvajenie_pj</a>.
            Также будем рады вашим предложениям по улучшению!
          </p>
        </div>
        <button class="banner-close-btn" (click)="dismissBanner()" title="Закрыть">
          <mat-icon style="font-size: 18px; width: 18px; height: 18px;">close</mat-icon>
        </button>
      </div>

      <!-- Header with page title and live stream button -->
      <div class="header">
        <h1 class="section-title">Мои курсы</h1>
        <button class="btn-live" [routerLink]="['/streaming']">
          <span class="live-dot"></span>
          <span>ПРЯМОЙ ЭФИР</span>
        </button>
      </div>

      <div class="content-wrapper">
        <!-- Filters & Action Bar -->
        <div class="filters-bar">
          <div class="search-field">
            <mat-icon class="search-icon">search</mat-icon>
            <input type="text" placeholder="Найти курс..." [(ngModel)]="searchQuery" (input)="filterSubjects()">
          </div>

          <div class="spacer"></div>

          <button class="btn-ai" (click)="openGenerateDialog()" *ngIf="isAdmin">
            <mat-icon class="btn-ai-icon">auto_awesome</mat-icon>
            <span>AI Генерация</span>
          </button>
          
          <button class="btn-create" (click)="openCreateDialog()" *ngIf="isAdmin">
            <span>СОЗДАТЬ КУРС</span>
          </button>
        </div>

        <!-- Grid of Courses -->
        <div class="courses-grid" *ngIf="subjects.length > 0">
          <div *ngFor="let subject of subjects; let i = index" class="course-card" [routerLink]="['/courses', subject.id]">
            <!-- Dark geometric pattern header without inner plus circle -->
            <div class="course-cover" [class.has-image]="subject.cover_image">
              <img *ngIf="subject.cover_image" [src]="'/api/subjects/' + subject.id + '/cover'" alt="" class="cover-img">
              <div *ngIf="!subject.cover_image" class="cover-pattern">
                <div class="cover-code">{{ getCourseCode(subject.name) }}</div>
              </div>
            </div>
            <div class="course-footer">
              <div class="course-name-box">
                <div class="course-name">{{ subject.name }}</div>
                <div class="course-description" *ngIf="subject.description">{{ subject.description | slice:0:50 }}{{ subject.description?.length > 50 ? '...' : '' }}</div>
              </div>
              <div class="course-actions" *ngIf="isAdmin">
                <button class="more-btn" (click)="$event.stopPropagation();" [matMenuTriggerFor]="menu" [disabled]="cloningSubjectId === subject.id">
                  <mat-icon *ngIf="cloningSubjectId !== subject.id" style="font-size: 20px; width: 20px; height: 20px;">more_horiz</mat-icon>
                  <mat-spinner diameter="18" *ngIf="cloningSubjectId === subject.id"></mat-spinner>
                </button>
                <mat-menu #menu="matMenu" class="custom-course-menu">
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
            </div>
          </div>
        </div>

        <div *ngIf="subjects.length === 0" class="empty-state">
          <p>Нет доступных курсов</p>
          <div class="button-row" *ngIf="isAdmin">
            <button class="btn-ai" (click)="openGenerateDialog()">
              <mat-icon class="btn-ai-icon">auto_awesome</mat-icon>
              <span>Сгенерировать с AI</span>
            </button>
            <button class="btn-create" (click)="openCreateDialog()">
              <span>Создать курс</span>
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
      padding: 16px 24px 32px;
      font-family: 'Inter', Roboto, sans-serif;
    }

    /* Welcome Banner: White card with blur effect */
    .welcome-banner {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 16px;
      padding: 18px 24px;
      margin-bottom: 28px;
      box-shadow: 0 4px 20px -4px rgba(0, 0, 0, 0.04);
      position: relative;
    }
    .banner-icon-wrapper {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #fafafa;
      border: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .banner-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #64748b;
    }
    .welcome-content {
      flex: 1;
      padding-right: 24px;
    }
    .banner-title {
      font-family: 'Instrument Serif', 'Cormorant Garamond', Georgia, serif;
      font-size: 23px;
      font-weight: 500;
      color: #09090b;
      margin: 0 0 6px 0;
      letter-spacing: -0.01em;
    }
    .banner-desc {
      font-family: 'Inter', sans-serif;
      font-size: 13.5px;
      line-height: 1.55;
      margin: 0;
      color: #64748b;
    }
    .contact-link {
      color: #09090b;
      text-decoration: underline;
      font-weight: 500;
      transition: opacity 0.15s ease;
    }
    .contact-link:hover {
      opacity: 0.7;
    }
    .banner-close-btn {
      position: absolute;
      top: 14px;
      right: 16px;
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s ease, background-color 0.15s ease;
    }
    .banner-close-btn:hover {
      color: #09090b;
      background-color: rgba(0, 0, 0, 0.04);
    }

    /* Header */
    .header {
      padding: 0 4px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .section-title {
      font-family: 'Instrument Serif', 'Cormorant Garamond', Georgia, serif;
      font-size: 32px;
      font-weight: 500;
      color: #09090b;
      margin: 0;
      letter-spacing: -0.01em;
    }

    /* Live Button */
    .btn-live {
      height: 38px;
      padding: 0 16px;
      background: #09090b;
      color: #ffffff;
      border: 1px solid #09090b;
      border-radius: 8px;
      font-family: 'Inter', sans-serif;
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
    }
    .btn-live:hover {
      background: #27272a;
      transform: translateY(-1px);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
    }
    .live-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #ef4444;
      box-shadow: 0 0 6px rgba(239, 68, 68, 0.8);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }

    .content-wrapper {
      padding: 0 4px;
    }

    /* Filters Bar */
    .filters-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 28px;
      flex-wrap: wrap;
      align-items: center;
    }
    .search-field {
      display: flex;
      align-items: center;
      background: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      padding: 0 12px;
      width: 260px;
      height: 38px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .search-field:focus-within {
      border-color: #09090b;
      box-shadow: 0 0 0 1px #09090b;
    }
    .search-icon {
      color: #94a3b8;
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 8px;
    }
    .search-field input {
      border: none;
      outline: none;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      width: 100%;
      color: #09090b;
      background: transparent;
    }
    .search-field input::placeholder {
      color: #94a3b8;
    }
    .spacer {
      flex: 1;
    }

    /* Buttons */
    .btn-ai {
      height: 38px;
      padding: 0 14px;
      background: #ffffff;
      color: #09090b;
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .btn-ai:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
      transform: translateY(-1px);
    }
    .btn-ai-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #64748b;
    }
    .btn-create {
      height: 38px;
      padding: 0 16px;
      background: #09090b;
      color: #ffffff;
      border: 1px solid #09090b;
      border-radius: 8px;
      font-family: 'Inter', sans-serif;
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
    }
    .btn-create:hover {
      background: #27272a;
      transform: translateY(-1px);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
    }

    /* Course Cards Grid */
    .courses-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }
    .course-card {
      border-radius: 14px;
      background: #ffffff;
      border: 1px solid #e4e4e7;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }
    .course-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 16px 32px -8px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.04);
      border-color: #cbd5e1;
    }

    /* Dark Header with geometric dot/line pattern */
    .course-cover {
      height: 135px;
      background-color: #0f172a;
      background-image: 
        radial-gradient(rgba(255, 255, 255, 0.16) 1.2px, transparent 1.2px),
        linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 18px 18px, 36px 36px, 36px 36px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-top-left-radius: 13px;
      border-top-right-radius: 13px;
    }
    .course-cover.has-image {
      background: none;
    }
    .cover-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .cover-pattern {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
    .cover-code {
      font-family: 'Inter', sans-serif;
      font-size: 13.5px;
      font-weight: 600;
      letter-spacing: 0.15em;
      color: #f1f5f9;
      text-transform: uppercase;
      user-select: none;
      text-align: center;
      padding: 0 16px;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    }

    /* Card Footer */
    .course-footer {
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #ffffff;
      min-height: 54px;
    }
    .course-name-box {
      flex: 1;
      min-width: 0;
    }
    .course-name {
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: #09090b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.3;
    }
    .course-description {
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }
    .more-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s, background-color 0.15s;
      flex-shrink: 0;
      margin-left: 8px;
    }
    .more-btn:hover {
      color: #09090b;
      background-color: #f1f5f9;
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      margin-top: 48px;
      color: #64748b;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px;
      border: 1px dashed #e4e4e7;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.7);
    }
    .button-row {
      display: flex;
      gap: 12px;
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
  isBannerVisible: boolean = true;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router
  ) { 
    const user = this.authService.getCurrentUser();
    this.isAdmin = user?.role === 'teacher' || user?.role === 'admin';
  }

  ngOnInit() {
    try {
      if (localStorage.getItem('welcome_banner_dismissed') === 'true') {
        this.isBannerVisible = false;
      }
    } catch (e) {}
    this.loadSubjects();
  }

  dismissBanner() {
    this.isBannerVisible = false;
    try {
      localStorage.setItem('welcome_banner_dismissed', 'true');
    } catch (e) {}
  }

  getCourseCode(name: string): string {
    if (!name) return 'КУРС';
    return name.trim().toUpperCase();
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
          next: (createdSubject: any) => {
            if (createdSubject && createdSubject.id) {
              this.router.navigate(['/course-builder', createdSubject.id]);
            } else {
              this.loadSubjects();
            }
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
      width: '640px',
      maxHeight: '90vh',
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadSubjects();
        this.snackBar.open('Курс добавлен в очередь генерации. Отслеживайте прогресс в виджете.', 'OK', { duration: 5000 });
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
