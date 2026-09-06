import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-stream-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule
  ],
  template: `
    <div class="page-container">
      <!-- Header matching Home page style -->
      <div class="header">
        <h1 class="section-title">Онлайн пары</h1>
        <!-- Hidden if activeStreams.length === 0 as requested -->
        <button class="btn-live-action" (click)="openStartStreamDialog()" *ngIf="isTeacher && activeStreams.length > 0">
          <mat-icon class="btn-icon">videocam</mat-icon>
          <span>НАЧАТЬ ТРАНСЛЯЦИЮ</span>
        </button>
      </div>

      <div class="content">
        <div *ngIf="loading" class="loading">
          <mat-spinner diameter="36"></mat-spinner>
        </div>

        <!-- Empty State matching Home page blur card aesthetic -->
        <div *ngIf="!loading && activeStreams.length === 0" class="empty-state">
          <div class="empty-icon-wrapper">
            <mat-icon class="empty-icon">videocam_off</mat-icon>
          </div>
          <p class="empty-title">В данный момент нет активных трансляций</p>
          <p class="empty-desc">Когда преподаватель запустит трансляцию, она сразу отобразится здесь в реальном времени</p>
          <button class="btn-start-stream" (click)="openStartStreamDialog()" *ngIf="isTeacher">
            <mat-icon style="font-size: 18px; width: 18px; height: 18px;">videocam</mat-icon>
            <span>Начать трансляцию</span>
          </button>
        </div>

        <!-- Grid of Streams matching Course Cards -->
        <div class="streams-grid" *ngIf="!loading && activeStreams.length > 0">
          <div *ngFor="let stream of activeStreams" class="stream-card">
            <div class="stream-preview">
              <div class="live-badge">
                <span class="live-dot"></span>
                <span>В ЭФИРЕ • {{ getStreamDuration(stream.created_at) }}</span>
              </div>
              <mat-icon class="preview-icon">play_circle_filled</mat-icon>
            </div>
            <div class="stream-body">
              <h3 class="subject-name">{{ getSubjectName(stream.subject_id) }}</h3>
              <div class="stream-meta">
                <div class="meta-row">
                  <mat-icon class="meta-icon">person</mat-icon>
                  <span>Ведущий: {{ stream.teacher_name }}</span>
                </div>
                <div class="meta-row">
                  <mat-icon class="meta-icon">schedule</mat-icon>
                  <span>Начало: {{ stream.created_at | date:'HH:mm' }}</span>
                </div>
                <div class="meta-row">
                  <mat-icon class="meta-icon">timer</mat-icon>
                  <span>В эфире: <strong class="timer-bold">{{ getStreamDuration(stream.created_at) }}</strong></span>
                </div>
                <div class="meta-row" *ngIf="getStreamGroupsLabel(stream) as groupLabel">
                  <mat-icon class="meta-icon">groups</mat-icon>
                  <span class="group-target-text">{{ groupLabel }}</span>
                </div>
              </div>
              <button class="btn-join" [routerLink]="['/courses', stream.subject_id, 'stream']">
                <span>ПРИСОЕДИНИТЬСЯ</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 16px 24px 32px;
      font-family: 'Inter', Roboto, sans-serif;
      min-height: calc(100vh - 80px);
    }

    /* Header */
    .header {
      padding: 0 4px;
      margin-bottom: 28px;
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

    /* Start Stream Header Action */
    .btn-live-action {
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
    .btn-live-action:hover {
      background: #27272a;
      transform: translateY(-1px);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
    }
    .btn-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .content {
      padding: 0 4px;
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 64px;
    }

    /* Empty State Card */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 56px 24px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 16px;
      box-shadow: 0 4px 20px -4px rgba(0, 0, 0, 0.03);
      max-width: 620px;
      margin: 40px auto 0;
    }
    .empty-icon-wrapper {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #fafafa;
      border: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 18px;
    }
    .empty-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
      color: #94a3b8;
    }
    .empty-title {
      font-family: 'Inter', sans-serif;
      font-size: 16px;
      font-weight: 500;
      color: #09090b;
      margin: 0 0 6px 0;
    }
    .empty-desc {
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: #64748b;
      margin: 0 0 22px 0;
      max-width: 420px;
    }
    .btn-start-stream {
      height: 40px;
      padding: 0 20px;
      background: #09090b;
      color: #ffffff;
      border: 1px solid #09090b;
      border-radius: 8px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
    }
    .btn-start-stream:hover {
      background: #27272a;
      transform: translateY(-1px);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
    }

    /* Streams Grid */
    .streams-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 24px;
    }
    .stream-card {
      border-radius: 14px;
      background: #ffffff;
      border: 1px solid #e4e4e7;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .stream-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 16px 32px -8px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.04);
      border-color: #cbd5e1;
    }
    .stream-preview {
      height: 140px;
      background-color: #0f172a;
      background-image: 
        radial-gradient(rgba(255, 255, 255, 0.15) 1.2px, transparent 1.2px),
        linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 18px 18px, 36px 36px, 36px 36px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .live-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      background: rgba(239, 68, 68, 0.95);
      color: white;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      display: flex;
      align-items: center;
      gap: 5px;
      box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
    }
    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ffffff;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }
    .preview-icon {
      font-size: 44px;
      width: 44px;
      height: 44px;
      color: rgba(255, 255, 255, 0.85);
      transition: transform 0.2s ease;
    }
    .stream-card:hover .preview-icon {
      transform: scale(1.08);
      color: #ffffff;
    }
    .stream-body {
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .subject-name {
      font-family: 'Inter', sans-serif;
      font-size: 16px;
      font-weight: 600;
      color: #09090b;
      margin: 0 0 10px 0;
      line-height: 1.35;
    }
    .stream-meta {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 18px;
    }
    .meta-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      color: #64748b;
    }
    .meta-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #94a3b8;
    }
    .timer-bold {
      font-weight: 600;
      color: #09090b;
      font-variant-numeric: tabular-nums;
    }
    .group-target-text {
      font-weight: 500;
      color: #475569;
    }
    .btn-join {
      margin-top: auto;
      height: 38px;
      width: 100%;
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
    }
    .btn-join:hover {
      background: #27272a;
      transform: translateY(-1px);
    }
  `]
})
export class StreamListComponent implements OnInit, OnDestroy {
  activeStreams: any[] = [];
  subjects: any[] = [];
  loading = true;
  isTeacher = false;
  currentUser: any = null;
  private timerInterval?: any;

  constructor(
    private apiService: ApiService,
    private auth: AuthService,
    private dialog: MatDialog,
    private router: Router
  ) {
    this.currentUser = this.auth.getCurrentUser();
    this.isTeacher = this.currentUser?.role === 'teacher' || this.currentUser?.role === 'admin';
  }

  ngOnInit() {
    this.refresh();
    this.timerInterval = setInterval(() => {
      // Trigger change detection for live duration timers
      if (this.activeStreams.length > 0) {
        this.activeStreams = [...this.activeStreams];
      }
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  async refresh() {
    this.loading = true;
    this.activeStreams = [];
    try {
      const [streams, subjects] = await Promise.all([
        this.apiService.getActiveStreamingRooms().toPromise(),
        this.apiService.getSubjects().toPromise()
      ]);

      let validStreams = (streams || []).filter((s: any) => s && s.subject_id);
      this.subjects = subjects || [];

      // If user is a student, filter out streams restricted to other groups
      if (this.currentUser?.role === 'student') {
        const myGroups = await this.apiService.getGroups(undefined, this.currentUser.name).toPromise().catch(() => []);
        const myGroupNames = new Set((myGroups || []).map((g: any) => g.name?.trim().toLowerCase()));

        validStreams = validStreams.filter((stream: any) => {
          const tg = this.getStreamTargetGroups(stream);
          if (tg.length === 0) return true; // Available for all groups
          return tg.some((groupName: string) => myGroupNames.has(groupName.trim().toLowerCase()));
        });
      }

      this.activeStreams = validStreams;
    } catch (err) {
      console.error('Error refreshing streams:', err);
    } finally {
      this.loading = false;
    }
  }

  getSubjectName(subjectId: string): string {
    if (!subjectId) return 'Неизвестный курс';
    const subject = this.subjects.find(s => s && s.id === subjectId);
    return subject ? subject.name : 'Неизвестный курс';
  }

  getStreamTargetGroups(stream: any): string[] {
    if (stream.target_groups) {
      try {
        const parsed = typeof stream.target_groups === 'string' ? JSON.parse(stream.target_groups) : stream.target_groups;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        const split = String(stream.target_groups).split(',').map((s: string) => s.trim()).filter(Boolean);
        if (split.length > 0) return split;
      }
    }
    if (stream.room_name && stream.room_name.includes('__groups__')) {
      try {
        const part = stream.room_name.split('__groups__')[1].split('_')[0];
        const decoded = decodeURIComponent(part).split(',').map((s: string) => s.trim()).filter(Boolean);
        if (decoded.length > 0) return decoded;
      } catch (e) {}
    }
    return [];
  }

  getStreamGroupsLabel(stream: any): string {
    const groups = this.getStreamTargetGroups(stream);
    if (groups.length === 0) {
      return 'Для всех групп';
    }
    return `Группы: ${groups.join(', ')}`;
  }

  parseUtcDate(val: string | Date | undefined): Date {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    let s = String(val).trim();
    if (!s) return new Date();
    if (!s.endsWith('Z') && !s.includes('+')) {
      s = s.replace(' ', 'T') + 'Z';
    }
    return new Date(s);
  }

  getStreamDuration(createdAt: string | Date): string {
    if (!createdAt) return '00:00';
    const start = this.parseUtcDate(createdAt).getTime();
    const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  openStartStreamDialog() {
    const dialogRef = this.dialog.open(StartStreamDialogComponent, {
      width: '460px',
      data: { subjects: this.subjects }
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result && result.subjectId) {
        const targetGroups = result.targetGroups || [];
        const groupSlug = targetGroups.length ? '__groups__' + encodeURIComponent(targetGroups.join(',')) : '';
        const roomName = `room_${result.subjectId.slice(0, 8)}${groupSlug}_${Date.now()}`;

        this.apiService.createStreamingRoom({
          subject_id: result.subjectId,
          teacher_name: this.currentUser?.name || 'Преподаватель',
          room_name: roomName,
          target_groups: targetGroups
        }).subscribe({
          next: () => {
            this.router.navigate(['/courses', result.subjectId, 'stream']);
          },
          error: (err) => {
            console.warn('Room may already exist or error occurred:', err);
            this.router.navigate(['/courses', result.subjectId, 'stream']);
          }
        });
      }
    });
  }
}

@Component({
  selector: 'app-start-stream-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatSelectModule, MatButtonModule, FormsModule],
  template: `
    <h2 mat-dialog-title class="dialog-title">Начать новую пару</h2>
    <mat-dialog-content class="dialog-content">
      <p class="dialog-desc">Выберите курс, по которому будет проходить трансляция:</p>
      
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Курс</mat-label>
        <mat-select [(ngModel)]="selectedSubjectId" (selectionChange)="onSubjectChange($event.value)">
          <mat-option *ngFor="let s of subjects" [value]="s.id">
            {{ s.name }}
          </mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Target Groups Option -->
      <div class="groups-section" *ngIf="selectedSubjectId">
        <div class="groups-section-title">Аудитория трансляции:</div>

        <div class="radio-options">
          <label class="radio-label">
            <input type="radio" name="audience" [value]="true" [(ngModel)]="forAllGroups">
            <span>Для всех групп курса</span>
          </label>
          <label class="radio-label" *ngIf="availableGroups.length > 0">
            <input type="radio" name="audience" [value]="false" [(ngModel)]="forAllGroups">
            <span>Выбрать конкретные группы</span>
          </label>
        </div>

        <div class="groups-list" *ngIf="!forAllGroups && availableGroups.length > 0">
          <div class="groups-chips">
            <button type="button" *ngFor="let g of availableGroups" 
              class="group-chip" 
              [class.active]="isGroupSelected(g.name)" 
              (click)="toggleGroup(g.name)">
              <span class="chip-dot" *ngIf="isGroupSelected(g.name)">✓</span>
              <span>{{ g.name }}</span>
            </button>
          </div>
        </div>

        <div class="no-groups-hint" *ngIf="!loadingGroups && availableGroups.length === 0">
          В этом курсе нет отдельных групп (эфир увидят все студенты курса).
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button [mat-dialog-close]="null" class="btn-cancel">Отмена</button>
      <button mat-flat-button (click)="submit()" [disabled]="!canSubmit()" class="btn-submit">
        Начать
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title {
      font-family: 'Instrument Serif', 'Cormorant Garamond', Georgia, serif;
      font-size: 22px;
      font-weight: 500;
      color: #09090b;
      margin: 0;
      padding: 20px 24px 8px;
    }
    .dialog-content {
      padding: 0 24px 8px;
    }
    .dialog-desc {
      font-family: 'Inter', sans-serif;
      font-size: 13.5px;
      color: #64748b;
      margin: 0 0 16px 0;
    }
    .full-width {
      width: 100%;
    }
    .groups-section {
      margin-top: 12px;
      padding: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
    }
    .groups-section-title {
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: #09090b;
      margin-bottom: 10px;
    }
    .radio-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }
    .radio-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      color: #334155;
      cursor: pointer;
    }
    .groups-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .group-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 20px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #475569;
      font-family: 'Inter', sans-serif;
      font-size: 12.5px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .group-chip.active {
      background: #09090b;
      color: #ffffff;
      border-color: #09090b;
    }
    .chip-dot {
      font-size: 11px;
      font-weight: bold;
    }
    .no-groups-hint {
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      color: #94a3b8;
      font-style: italic;
    }
    .dialog-actions {
      padding: 12px 24px 20px;
    }
    .btn-cancel {
      font-family: 'Inter', sans-serif;
      color: #64748b !important;
      border-radius: 8px !important;
    }
    .btn-submit {
      background: #09090b !important;
      color: #ffffff !important;
      border-radius: 8px !important;
      font-family: 'Inter', sans-serif;
      font-weight: 500;
    }
    .btn-submit[disabled] {
      background: #e2e8f0 !important;
      color: #94a3b8 !important;
    }
  `]
})
export class StartStreamDialogComponent {
  subjects: any[] = [];
  selectedSubjectId: string = '';
  availableGroups: any[] = [];
  selectedGroups: string[] = [];
  forAllGroups: boolean = true;
  loadingGroups: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<StartStreamDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private apiService: ApiService
  ) {
    this.subjects = data.subjects || [];
  }

  onSubjectChange(subjectId: string) {
    this.availableGroups = [];
    this.selectedGroups = [];
    this.forAllGroups = true;
    if (!subjectId) return;

    this.loadingGroups = true;
    this.apiService.getGroups(subjectId).subscribe({
      next: (groups) => {
        this.availableGroups = groups || [];
        this.loadingGroups = false;
      },
      error: () => {
        this.availableGroups = [];
        this.loadingGroups = false;
      }
    });
  }

  toggleGroup(name: string) {
    const idx = this.selectedGroups.indexOf(name);
    if (idx >= 0) {
      this.selectedGroups.splice(idx, 1);
    } else {
      this.selectedGroups.push(name);
    }
  }

  isGroupSelected(name: string): boolean {
    return this.selectedGroups.includes(name);
  }

  canSubmit(): boolean {
    if (!this.selectedSubjectId) return false;
    if (!this.forAllGroups && this.selectedGroups.length === 0) return false;
    return true;
  }

  submit() {
    if (!this.canSubmit()) return;
    this.dialogRef.close({
      subjectId: this.selectedSubjectId,
      targetGroups: this.forAllGroups ? [] : [...this.selectedGroups]
    });
  }
}

