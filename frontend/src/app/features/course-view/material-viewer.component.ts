import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../../core/services/api.service';
import { Subscription, interval, of } from 'rxjs';
import { switchMap, takeWhile, catchError, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-material-viewer',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
    <div class="viewer-container">
      <div class="viewer-header">
        <div class="header-left">
          <span class="type-pill" [attr.data-type]="type">{{ getFormatBadge() }}</span>
          <h2 class="viewer-title">{{ data.title }}</h2>
        </div>
        <div class="header-right">
          <a class="header-btn" [href]="data.url" target="_blank" download matTooltip="Скачать оригинал">
            <mat-icon>download</mat-icon>
            <span>Скачать</span>
          </a>
          <button type="button" class="close-btn" (click)="close()" matTooltip="Закрыть">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
      
      <div class="viewer-content">
        <!-- Loading State -->
        <div *ngIf="loadingStatus" class="status-box loading-box">
          <div class="custom-spinner"></div>
          <p class="status-msg">{{ statusMessage }}</p>
        </div>

        <!-- Failure State -->
        <div *ngIf="!loadingStatus && status === 'failed'" class="status-box error-box">
          <mat-icon class="status-icon warn">error_outline</mat-icon>
          <h3>Не удалось подготовить документ</h3>
          <p>Произошла ошибка при конвертации файла для интерактивного просмотра.</p>
          <div class="status-actions">
            <button type="button" class="pill-btn pill-btn-dark" (click)="checkStatus()">
              <mat-icon>refresh</mat-icon> Попробовать снова
            </button>
            <a class="pill-btn pill-btn-outline" [href]="data.url" target="_blank" download>
              <mat-icon>download</mat-icon> Скачать оригинал
            </a>
          </div>
        </div>

        <!-- Document Viewers -->
        <ng-container *ngIf="!loadingStatus && (status === 'ready' || status === 'unsupported')">
          <!-- PDF / HTML / DOCX Viewer -->
          <div *ngIf="type === 'pdf' || type === 'html' || type === 'docx'" class="full-frame-wrap">
            <iframe [src]="safeUrl" class="viewer-iframe" frameborder="0"></iframe>
          </div>

          <!-- Text / Code Viewer -->
          <div *ngIf="type === 'text'" class="text-viewer-wrap">
            <div *ngIf="loadingText" class="status-box loading-box">
              <div class="custom-spinner"></div>
              <p>Загрузка содержимого файла...</p>
            </div>
            <pre *ngIf="!loadingText" class="code-preview"><code>{{ textContent }}</code></pre>
          </div>
          
          <!-- Image Viewer -->
          <div *ngIf="type === 'image'" class="media-container">
            <img [src]="data.url" [alt]="data.title" class="viewer-image">
          </div>
          
          <!-- Video Viewer -->
          <div *ngIf="type === 'video'" class="media-container">
            <video controls autoplay class="viewer-video">
              <source [src]="data.url" [type]="data.mimeType">
              Ваш браузер не поддерживает видео.
            </video>
          </div>

          <!-- Unsupported Fallback -->
          <div *ngIf="type === 'unsupported'" class="status-box unsupported-box">
            <mat-icon class="status-icon">description</mat-icon>
            <h3>Прямой просмотр недоступен</h3>
            <p>Данный формат файла не поддерживает отображение в браузере. Вы можете скачать его на устройство.</p>
            <a class="pill-btn pill-btn-dark" [href]="data.url" target="_blank" download>
              <mat-icon>download</mat-icon> Скачать файл
            </a>
          </div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .viewer-container {
      display: flex;
      flex-direction: column;
      height: 90vh;
      max-height: 920px;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
    }

    .viewer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 24px;
      background: #ffffff;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      gap: 16px;
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .type-pill {
      display: inline-flex;
      align-items: center;
      padding: 4px 9px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      background: #f4f4f5;
      color: #18181b;
      border: 1px solid rgba(0, 0, 0, 0.08);
      flex-shrink: 0;
    }

    .type-pill[data-type="pdf"] { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }
    .type-pill[data-type="docx"] { background: #e0e7ff; color: #3730a3; border-color: #c7d2fe; }
    .type-pill[data-type="html"] { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
    .type-pill[data-type="text"] { background: #fef3c7; color: #92400e; border-color: #fde68a; }

    .viewer-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #09090b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .header-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 9999px;
      background: #f4f4f5;
      color: #18181b;
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      border: 1px solid rgba(0, 0, 0, 0.08);
      transition: all 0.15s ease;
    }

    .header-btn:hover {
      background: #e4e4e7;
    }

    .header-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .close-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: #71717a;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .close-btn:hover {
      background: rgba(0, 0, 0, 0.06);
      color: #09090b;
    }

    .close-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .viewer-content {
      flex: 1;
      padding: 0 !important;
      overflow: auto;
      background: #f8fafc;
      position: relative;
    }

    .full-frame-wrap {
      width: 100%;
      height: 100%;
    }

    .viewer-iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
      background: #ffffff;
    }

    .text-viewer-wrap {
      width: 100%;
      height: 100%;
      padding: 24px;
      box-sizing: border-box;
      overflow: auto;
    }

    .code-preview {
      margin: 0;
      padding: 20px 24px;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 12px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 13.5px;
      line-height: 1.6;
      color: #1e293b;
      white-space: pre-wrap;
      word-break: break-word;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
    }

    .media-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
      padding: 24px;
      box-sizing: border-box;
    }

    .viewer-image {
      max-width: 100%;
      max-height: 100%;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    .viewer-video {
      max-width: 100%;
      max-height: 100%;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    .status-box {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100%;
      gap: 14px;
      text-align: center;
      padding: 40px 24px;
      box-sizing: border-box;
    }

    .status-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #94a3b8;
    }

    .status-icon.warn {
      color: #ef4444;
    }

    .status-box h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
    }

    .status-box p {
      margin: 0;
      font-size: 14px;
      color: #64748b;
      max-width: 440px;
      line-height: 1.5;
    }

    .status-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 10px;
    }

    .pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 20px;
      border-radius: 9999px;
      font-size: 13.5px;
      font-weight: 500;
      border: none;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .pill-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .pill-btn-dark {
      background: #09090b;
      color: #ffffff;
    }

    .pill-btn-dark:hover {
      background: #27272a;
    }

    .pill-btn-outline {
      background: transparent;
      color: #09090b;
      border: 1px solid rgba(0, 0, 0, 0.16);
    }

    .pill-btn-outline:hover {
      background: rgba(0, 0, 0, 0.04);
    }

    .custom-spinner {
      width: 44px;
      height: 44px;
      border: 3px solid rgba(0, 0, 0, 0.08);
      border-top-color: #09090b;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class MaterialViewerComponent implements OnInit, OnDestroy {
  safeUrl: SafeResourceUrl;
  type: 'pdf' | 'image' | 'video' | 'html' | 'docx' | 'text' | 'unsupported' = 'unsupported';
  
  loadingStatus = false;
  status: 'ready' | 'processing' | 'failed' | 'not_started' | 'unsupported' = 'ready';
  statusMessage = 'Загрузка...';
  
  textContent = '';
  loadingText = false;

  private pollingSub?: Subscription;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { materialId?: string, format?: string, url: string; title: string; mimeType: string },
    public dialogRef: MatDialogRef<MaterialViewerComponent>,
    private sanitizer: DomSanitizer,
    private apiService: ApiService,
    private http: HttpClient
  ) {
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(data.url);
  }

  ngOnInit() {
    this.detectType();
    if (this.data.materialId && (this.type === 'pdf' || this.type === 'html' || this.type === 'docx' || this.data.format)) {
      this.checkStatus();
    }
  }

  ngOnDestroy() {
    this.pollingSub?.unsubscribe();
  }

  detectType() {
    const mime = (this.data.mimeType || '').toLowerCase();
    const url = (this.data.url || '').toLowerCase();
    const title = (this.data.title || '').toLowerCase();

    if (mime.includes('pdf') || url.endsWith('.pdf') || title.endsWith('.pdf')) {
      this.type = 'pdf';
    } else if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(title)) {
      this.type = 'image';
    } else if (mime.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(title)) {
      this.type = 'video';
    } else if (title.endsWith('.docx') || title.endsWith('.doc') || mime.includes('word') || mime.includes('officedocument')) {
      this.type = 'docx';
      this.data.format = 'html';
      this.data.url = `/api/materials/${this.data.materialId}/download?inline=true&format=html`;
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.data.url);
    } else if (mime.includes('html') || url.includes('format=html') || this.data.format === 'html') {
      this.type = 'html';
    } else if (/\.(txt|md|py|json|csv|tex|c|cpp|js|ts|java|sql|sh|yml|yaml|xml)$/i.test(title) || mime.startsWith('text/')) {
      this.type = 'text';
      this.loadTextContent();
    } else {
      this.type = 'unsupported';
    }
  }

  getFormatBadge(): string {
    const title = (this.data.title || '').toLowerCase();
    const ext = title.split('.').pop() || '';
    if (ext && ext.length <= 5) return ext.toUpperCase();
    return this.type.toUpperCase();
  }

  loadTextContent() {
    this.loadingText = true;
    this.http.get(this.data.url, { responseType: 'text' }).subscribe({
      next: (text) => {
        this.textContent = text;
        this.loadingText = false;
      },
      error: (err) => {
        console.error('Error fetching text file:', err);
        this.textContent = 'Не удалось загрузить текстовое содержимое файла.';
        this.loadingText = false;
      }
    });
  }

  checkStatus() {
    if (!this.data.materialId) return;

    this.loadingStatus = true;
    this.statusMessage = 'Подготовка документа к просмотру...';
    
    this.pollingSub?.unsubscribe();
    this.pollingSub = interval(1800).pipe(
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
          this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.data.url);
        } else if (res.status === 'processing') {
          this.statusMessage = 'Документ конвертируется... Пожалуйста, подождите.';
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

