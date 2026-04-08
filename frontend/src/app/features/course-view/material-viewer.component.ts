import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { Subscription, interval, of } from 'rxjs';
import { switchMap, takeWhile, catchError, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-material-viewer',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="viewer-container">
      <div class="viewer-header">
        <h2 mat-dialog-title>{{ data.title }}</h2>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      
      <mat-dialog-content class="viewer-content">
        <!-- Loading State -->
        <div *ngIf="loadingStatus" class="loading-container">
          <mat-spinner diameter="50"></mat-spinner>
          <p>{{ statusMessage }}</p>
        </div>

        <!-- Failure State -->
        <div *ngIf="!loadingStatus && status === 'failed'" class="unsupported-container">
          <mat-icon class="big-icon" color="warn">error</mat-icon>
          <p>Не удалось подготовить файл для просмотра.</p>
          <div class="error-actions">
            <button mat-raised-button color="primary" (click)="checkStatus()">
              Попробовать снова
            </button>
            <a mat-button [href]="data.url" target="_blank">
              Скачать оригинал
            </a>
          </div>
        </div>

        <!-- Document Viewers -->
        <ng-container *ngIf="!loadingStatus && (status === 'ready' || status === 'unsupported')">
          <div *ngIf="type === 'pdf'" class="full-size">
            <iframe [src]="safeUrl" width="100%" height="100%" frameborder="0"></iframe>
          </div>
          
          <div *ngIf="type === 'image'" class="image-container">
            <img [src]="data.url" [alt]="data.title" class="viewer-image">
          </div>
          
          <div *ngIf="type === 'video'" class="video-container">
            <video controls autoplay class="viewer-video">
              <source [src]="data.url" [type]="data.mimeType">
              Ваш браузер не поддерживает видео.
            </video>
          </div>
          
          <div *ngIf="type === 'html'" class="full-size">
            <iframe [src]="safeUrl" width="100%" height="100%" frameborder="0"></iframe>
          </div>

          <div *ngIf="type === 'unsupported'" class="unsupported-container">
            <mat-icon class="big-icon">description</mat-icon>
            <p>Этот тип файла не поддерживается для прямого просмотра.</p>
            <a mat-raised-button color="primary" [href]="data.url" target="_blank">
              Скачать файл
            </a>
          </div>
        </ng-container>
      </mat-dialog-content>
    </div>
  `,
  styles: [`
    .viewer-container {
      display: flex;
      flex-direction: column;
      height: 90vh;
      max-height: 900px;
    }
    .viewer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      border-bottom: 1px solid #eee;
    }
    .viewer-content {
      flex: 1;
      padding: 0 !important;
      overflow: hidden;
      background: #f5f5f5;
    }
    .full-size {
      width: 100%;
      height: 100%;
    }
    .image-container, .video-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
      padding: 20px;
    }
    .viewer-image {
      max-width: 100%;
      max-height: 100%;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .viewer-video {
      max-width: 100%;
      max-height: 100%;
    }
    .loading-container, .unsupported-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100%;
      gap: 16px;
      text-align: center;
      padding: 20px;
    }
    .error-actions {
      display: flex;
      gap: 8px;
    }
    .big-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #999;
    }
    h2 {
       margin: 0;
    }
  `]
})
export class MaterialViewerComponent implements OnInit, OnDestroy {
  safeUrl: SafeResourceUrl;
  type: 'pdf' | 'image' | 'video' | 'html' | 'unsupported' = 'unsupported';
  
  loadingStatus = false;
  status: 'ready' | 'processing' | 'failed' | 'not_started' | 'unsupported' = 'ready';
  statusMessage = 'Загрузка...';
  private pollingSub?: Subscription;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { materialId?: string, format?: string, url: string; title: string; mimeType: string },
    public dialogRef: MatDialogRef<MaterialViewerComponent>,
    private sanitizer: DomSanitizer,
    private apiService: ApiService
  ) {
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(data.url);
  }

  ngOnInit() {
    this.detectType();
    if (this.data.materialId && (this.type === 'pdf' || this.type === 'html' || this.data.format)) {
      this.checkStatus();
    }
  }

  ngOnDestroy() {
    this.pollingSub?.unsubscribe();
  }

  detectType() {
    const mime = this.data.mimeType.toLowerCase();
    const url = this.data.url.toLowerCase();

    if (mime.includes('pdf') || url.endsWith('.pdf')) {
      this.type = 'pdf';
    } else if (mime.startsWith('image/')) {
      this.type = 'image';
    } else if (mime.startsWith('video/')) {
      this.type = 'video';
    } else if (mime.includes('html') || url.includes('format=html') || this.data.format === 'html') {
      this.type = 'html';
    } else {
      this.type = 'unsupported';
    }
  }

  checkStatus() {
    if (!this.data.materialId) return;

    this.loadingStatus = true;
    this.statusMessage = 'Проверка готовности файла...';
    
    this.pollingSub?.unsubscribe();
    this.pollingSub = interval(2000).pipe(
      startWith(0),
      switchMap(() => this.apiService.getMaterialStatus(this.data.materialId!, this.data.format).pipe(
        catchError(err => {
          console.error('Status check error:', err);
          return of({ status: 'failed' });
        })
      )),
      takeWhile(res => res.status === 'processing' || res.status === 'not_started', true)
    ).subscribe({
      next: (res) => {
        this.status = res.status;
        if (res.status === 'ready') {
          this.loadingStatus = false;
          // Refresh safeUrl
          this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.data.url);
        } else if (res.status === 'processing') {
          this.statusMessage = 'Файл подготавливается... Пожалуйста, подождите.';
        } else if (res.status === 'failed' || res.status === 'unsupported') {
          this.loadingStatus = false;
          if (res.status === 'unsupported') {
            this.type = 'unsupported';
          }
        }
      },
      error: () => {
        this.loadingStatus = false;
        this.status = 'failed';
      }
    });
  }

  close() {
    this.dialogRef.close();
  }
}
