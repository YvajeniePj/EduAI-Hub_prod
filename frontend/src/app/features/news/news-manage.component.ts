import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../core/services/api.service';
import { RussianDatePipe } from '../../core/pipes/russian-date.pipe';

@Component({
  selector: 'app-news-manage',
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
    MatSelectModule,
    MatIconModule,
    MatChipsModule,
    RussianDatePipe
  ],
  template: `
    <div class="news-manage-container">
      <div class="news-main-column">
        <h1>Управление новостями</h1>
        
        <div *ngIf="allNews.length === 0" class="empty-state">
          <mat-icon class="empty-icon">feed</mat-icon>
          <p>Новостей пока нет</p>
        </div>
        
        <div class="news-list" *ngIf="allNews.length > 0">
          <mat-card *ngFor="let news of allNews" class="news-item-card">
            <div class="news-item-image-wrapper" *ngIf="news.image_url">
              <img [src]="news.image_url" alt="News image" class="news-item-image">
            </div>
            <mat-card-content class="news-item-content">
              <div class="news-item-meta">
                <span class="subject-tag">{{ getSubjectName(news.subject_id) }}</span>
                <span class="news-date">{{ news.created_at | russianDate:'datetime' }}</span>
              </div>
              <h3 class="news-item-title">{{ news.title }}</h3>
              <p class="news-item-text">{{ news.content }}</p>
            </mat-card-content>
            <mat-card-actions class="news-item-actions">
              <button mat-button color="primary" (click)="editNews(news)">
                <mat-icon>edit</mat-icon>
                Редактировать
              </button>
              <button mat-button color="warn" (click)="deleteNews(news.id)">
                <mat-icon>delete</mat-icon>
                Удалить
              </button>
            </mat-card-actions>
          </mat-card>
        </div>
      </div>

      <div class="news-sidebar-column">
        <mat-card class="sticky-form-card">
          <mat-card-header>
            <mat-card-title>{{ editingNews ? 'Редактировать' : 'Создать' }} новость</mat-card-title>
          </mat-card-header>
          <mat-card-content style="padding-top: 12px;">
            <form [formGroup]="newsForm" (ngSubmit)="onSubmit()">
              <mat-form-field appearance="outline" style="width: 100%;">
                <mat-label>Курс</mat-label>
                <mat-select formControlName="subject_id" required>
                  <mat-option *ngFor="let subject of subjects" [value]="subject.id">
                    {{ subject.name }}
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" style="width: 100%;">
                <mat-label>Заголовок</mat-label>
                <input matInput formControlName="title" required>
              </mat-form-field>

              <mat-form-field appearance="outline" style="width: 100%;">
                <mat-label>Содержание</mat-label>
                <textarea matInput formControlName="content" rows="6" required></textarea>
              </mat-form-field>

              <!-- Image Section -->
              <div class="image-upload-area" (click)="!uploadingImage && !newsForm.value.image_url && fileInput.click()">
                <input type="file" #fileInput (change)="onFileSelected($event)" accept="image/*" style="display: none;">
                
                <!-- Если картинка не выбрана/не загружена -->
                <div class="upload-placeholder" *ngIf="!newsForm.value.image_url && !uploadingImage">
                  <mat-icon class="upload-icon">image_search</mat-icon>
                  <span class="upload-text">Выбрать изображение с компьютера</span>
                </div>
                
                <!-- Загрузка в процессе -->
                <div class="upload-loading" *ngIf="uploadingImage">
                  <mat-icon class="spin-icon">sync</mat-icon>
                  <span class="upload-text">Загрузка на сервер...</span>
                </div>

                <!-- Картинка загружена -->
                <div class="uploaded-preview" *ngIf="newsForm.value.image_url && !uploadingImage" (click)="$event.stopPropagation()">
                  <img [src]="newsForm.value.image_url" alt="Preview" class="preview-img">
                  <button mat-mini-fab color="warn" class="remove-img-btn" type="button" (click)="removeImage()" matTooltip="Удалить картинку">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>

              <div class="actions">
                <button mat-raised-button color="primary" type="submit" [disabled]="!newsForm.valid || submitting" style="flex: 1;">
                  {{ editingNews ? 'Сохранить' : 'Опубликовать' }}
                </button>
                <button mat-button type="button" (click)="resetForm()" style="flex: 1;" *ngIf="editingNews">
                  Отмена
                </button>
                <button mat-button type="button" (click)="resetForm()" style="flex: 1;" *ngIf="!editingNews">
                  Очистить
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .news-manage-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 12px 24px 24px;
      display: grid;
      grid-template-columns: 1fr 420px;
      gap: 32px;
      align-items: start;
      font-family: Roboto, sans-serif;
    }

    /* Main Column */
    .news-main-column h1 {
      font-size: 24px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 24px 0;
    }

    .news-list {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .news-item-card {
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }

    .news-item-image-wrapper {
      width: 100%;
      height: 400px;
      overflow: hidden;
      border-bottom: 1px solid #f1f5f9;
      background: #eaeef3;
      flex-shrink: 0;
    }

    .news-item-image {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover;
      display: block;
    }

    .news-item-content {
      padding: 20px 24px;
    }

    .news-item-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }

    .subject-tag {
      font-size: 11px;
      font-weight: 600;
      color: #3f51b5;
      background: rgba(63, 81, 181, 0.08);
      padding: 3px 10px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .news-date {
      font-size: 12px;
      color: #94a3b8;
    }

    .news-item-title {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 10px 0;
      line-height: 1.4;
    }

    .news-item-text {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .news-item-actions {
      padding: 0 24px 20px;
      border-top: none;
      display: flex;
      gap: 8px;
    }

    /* Sidebar Sidebar Sticky Form */
    .news-sidebar-column {
      position: sticky;
      top: 80px;
      z-index: 10;
    }

    .sticky-form-card {
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      background: white;
      box-shadow: 0 4px 20px rgba(0,0,0,0.03);
    }

    .sticky-form-card mat-card-header {
      padding: 20px 24px 12px;
    }

    .sticky-form-card mat-card-title {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
    }

    .sticky-form-card mat-card-content {
      padding: 0 24px 24px;
    }

    .actions {
      display: flex;
      gap: 12px;
      margin-top: 12px;
    }

    /* Image Upload Section Styles */
    .image-upload-area {
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      cursor: pointer;
      margin-bottom: 20px;
      transition: all 0.2s ease;
      background: #f8fafc;
      min-height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .image-upload-area:hover {
      border-color: #3f51b5;
      background: #f1f5f9;
    }

    .upload-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: #64748b;
      width: 100%;
    }

    .upload-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #94a3b8;
    }

    .upload-text {
      font-size: 13px;
      font-weight: 500;
    }

    .upload-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: #3f51b5;
    }

    .spin-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      animation: rotation 2s infinite linear;
    }

    @keyframes rotation {
      from { transform: rotate(0deg); }
      to { transform: rotate(359deg); }
    }

    .uploaded-preview {
      position: relative;
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
      height: 160px;
      border: 1px solid #e2e8f0;
      background: #eaeef3;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .preview-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }

    .remove-img-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 32px;
      height: 32px;
      line-height: 32px;
      z-index: 2;
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      background: white;
      border: 1px dashed #cbd5e1;
      border-radius: 16px;
      color: #94a3b8;
    }

    .empty-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      margin-bottom: 8px;
    }

    @media (max-width: 960px) {
      .news-manage-container {
        grid-template-columns: 1fr;
      }
      .news-sidebar-column {
        position: static;
        order: -1;
        margin-bottom: 24px;
      }
    }
  `]
})
export class NewsManageComponent implements OnInit {
  newsForm: FormGroup;
  subjects: any[] = [];
  allNews: any[] = [];
  editingNews: any = null;
  submitting = false;
  selectedFile: File | null = null;
  uploadingImage = false;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService
  ) {
    this.newsForm = this.fb.group({
      subject_id: ['', Validators.required],
      title: ['', Validators.required],
      content: ['', Validators.required],
      image_url: ['']
    });
  }

  ngOnInit() {
    this.loadSubjects();
    this.loadAllNews();
  }

  loadSubjects() {
    this.apiService.getSubjects().subscribe({
      next: (subjects) => {
        this.subjects = subjects;
      },
      error: (err) => console.error('Error loading subjects:', err)
    });
  }

  loadAllNews() {
    this.apiService.getNews().subscribe({
      next: (news) => {
        this.allNews = news;
      },
      error: (err) => {
        console.error('Error loading news:', err);
        this.allNews = [];
      }
    });
  }

  getSubjectName(subjectId: string): string {
    const subject = this.subjects.find(s => s.id === subjectId);
    return subject ? subject.name : 'Неизвестный курс';
  }

  onSubmit() {
    if (this.newsForm.valid) {
      this.submitting = true;
      const newsData = this.newsForm.value;

      if (this.editingNews) {
        this.apiService.updateNews(this.editingNews.id, newsData).subscribe({
          next: () => {
            this.submitting = false;
            this.resetForm();
            this.loadAllNews();
          },
          error: (err) => {
            console.error('Error updating news:', err);
            alert('Ошибка при обновлении новости');
            this.submitting = false;
          }
        });
      } else {
        this.apiService.createNews(newsData).subscribe({
          next: () => {
            this.submitting = false;
            this.resetForm();
            this.loadAllNews();
          },
          error: (err) => {
            console.error('Error creating news:', err);
            alert('Ошибка при создании новости');
            this.submitting = false;
          }
        });
      }
    }
  }

  editNews(news: any) {
    this.editingNews = news;
    this.newsForm.patchValue({
      subject_id: news.subject_id,
      title: news.title,
      content: news.content,
      image_url: news.image_url || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteNews(newsId: string) {
    if (confirm('Вы уверены, что хотите удалить эту новость?')) {
      this.apiService.deleteNews(newsId).subscribe({
        next: () => {
          this.loadAllNews();
        },
        error: (err) => {
          console.error('Error deleting news:', err);
          alert('Ошибка при удалении новости');
        }
      });
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.uploadImage();
    }
  }

  uploadImage() {
    if (!this.selectedFile) return;

    this.uploadingImage = true;
    const formData = new FormData();
    formData.append('file', this.selectedFile);

    this.apiService.uploadNewsImage(formData).subscribe({
      next: (res) => {
        this.uploadingImage = false;
        this.selectedFile = null;
        if (res && res.image_url) {
          const fullImageUrl = `/api${res.image_url}`;
          this.newsForm.patchValue({ image_url: fullImageUrl });
        }
      },
      error: (err) => {
        console.error('Error uploading news image:', err);
        alert('Ошибка при загрузке изображения');
        this.uploadingImage = false;
        this.selectedFile = null;
      }
    });
  }

  removeImage() {
    this.newsForm.patchValue({ image_url: '' });
    this.selectedFile = null;
  }

  resetForm() {
    this.editingNews = null;
    this.selectedFile = null;
    this.newsForm.reset();
  }
}
