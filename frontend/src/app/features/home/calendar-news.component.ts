import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { RussianDatePipe } from '../../core/pipes/russian-date.pipe';

@Component({
  selector: 'app-news-dialog-cn',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatDialogModule, RussianDatePipe],
  template: `
    <div class="news-dialog-container" style="display: flex; flex-direction: column; max-height: 85vh; max-width: 800px; overflow: hidden; border-radius: 16px; font-family: Roboto, sans-serif;">
      <div class="dialog-header" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid #f1f5f9; background: #fff;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #1e1b4b; line-height: 1.4; word-break: break-word;">{{ data.news.title }}</h2>
        <button mat-icon-button (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body" style="flex: 1; overflow-y: auto; padding: 24px; background: #f8fafc;">
        <img *ngIf="data.news.image_url" [src]="data.news.image_url" alt="News image" 
             style="width: 100%; max-height: 480px; object-fit: contain; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); background: #eaeef3;">
        
        <div class="news-meta" style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
          <mat-chip-set>
            <mat-chip style="background: rgba(63, 81, 181, 0.06); color: #3f51b5; font-weight: 500; font-size: 12px;">
              {{ data.subjectName }}
            </mat-chip>
          </mat-chip-set>
          <span style="font-size: 13px; color: #64748b; display: flex; align-items: center; gap: 6px;">
            <mat-icon style="font-size: 16px; width: 16px; height: 16px; color: #94a3b8;">calendar_today</mat-icon>
            {{ data.news.created_at | russianDate:'datetime' }}
          </span>
        </div>

        <div class="news-text-content" style="font-size: 15px; line-height: 1.7; color: #334155; white-space: pre-wrap; word-break: break-word;">
          {{ data.news.content }}
        </div>
      </div>
    </div>
  `
})
export class NewsDialogCnComponent {
  constructor(
    public dialogRef: MatDialogRef<NewsDialogCnComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { news: any, subjectName: string }
  ) {}
}

@Component({
  selector: 'app-calendar-news',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    RussianDatePipe
  ],
  template: `
    <div class="calendar-news-page">
      <div class="page-header-row">
        <h1>Календарь и новости</h1>
        <p>Календарь дедлайнов и важные объявления по курсам</p>
      </div>

      <div class="workspace-grid">
        <!-- Левая колонка: Календарь и Дедлайны (основной акцент) -->
        <div class="focus-section">
          
          <div class="focus-grid">
            <!-- Календарь -->
            <mat-card class="block-card calendar-card shadow-sm">
              <div class="block-title">
                <mat-icon>calendar_month</mat-icon>
                <h3>Календарь событий</h3>
              </div>
              
              <div class="calendar-header">
                <button mat-icon-button (click)="previousMonth()" class="calendar-nav-btn">
                  <mat-icon>chevron_left</mat-icon>
                </button>
                <h4 class="calendar-month">{{ getMonthYearLabel() }}</h4>
                <button mat-icon-button (click)="nextMonth()" class="calendar-nav-btn">
                  <mat-icon>chevron_right</mat-icon>
                </button>
              </div>
              
              <div class="calendar-grid">
                <div class="calendar-weekday" *ngFor="let day of weekDays">{{ day }}</div>
                <div 
                  *ngFor="let day of calendarDays" 
                  class="calendar-day"
                  [class.has-deadline]="hasDeadlineOnDate(day)"
                  [class.overdue]="isDateOverdue(day)"
                  [class.soon]="isDateSoon(day)"
                  [class.other-month]="day.otherMonth"
                  [matTooltip]="getDeadlinesTooltip(day)"
                  [matTooltipPosition]="'above'"
                  [matTooltipShowDelay]="200"
                  [matTooltipClass]="'deadline-tooltip'">
                  <span class="day-number">{{ day.date }}</span>
                  <div *ngIf="hasDeadlineOnDate(day)" class="deadline-indicator"></div>
                </div>
              </div>
            </mat-card>

            <!-- Ближайшие дедлайны -->
            <mat-card class="block-card deadlines-card shadow-sm">
              <div class="block-title">
                <mat-icon>assignment_late</mat-icon>
                <h3>Ближайшие дедлайны</h3>
              </div>
              
              <div *ngIf="upcomingDeadlines.length === 0" class="empty-timeline">
                <mat-icon class="empty-timeline-icon">task_alt</mat-icon>
                <p>Нет предстоящих дедлайнов</p>
              </div>

              <div class="timeline-list" *ngIf="upcomingDeadlines.length > 0">
                <div class="timeline-item" *ngFor="let deadline of upcomingDeadlines" 
                     [class.overdue]="isOverdue(deadline.due_date)" 
                     [class.soon]="isSoon(deadline.due_date)">
                  <div class="timeline-marker"></div>
                  <div class="timeline-content">
                    <div class="timeline-title" [routerLink]="['/tests', deadline.test_id]">{{ deadline.title }}</div>
                    <div class="timeline-meta">
                      <span class="timeline-subject">{{ deadline.subject_name }}</span>
                      <span class="timeline-time">До {{ deadline.due_date | date:'dd.MM.yyyy HH:mm' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </mat-card>
          </div>

        </div>

        <!-- Правая колонка: Новости (второстепенная роль, компактно) -->
        <div class="news-side-section">
          <div class="side-header">
            <mat-icon>feed</mat-icon>
            <h3>Новости и объявления</h3>
          </div>

          <div *ngIf="news.length === 0" class="empty-state">
            <mat-icon class="empty-icon">feed</mat-icon>
            <p>Новостей пока нет</p>
          </div>

          <div class="compact-news-list" *ngIf="news.length > 0">
            <mat-card *ngFor="let item of news" class="compact-news-card" (click)="openNewsDialog(item)">
              <div class="news-thumb" *ngIf="item.image_url">
                <img [src]="item.image_url" alt="">
              </div>
              <div class="news-details">
                <div class="news-meta">
                  <span class="subject-tag">{{ getSubjectName(item.subject_id) }}</span>
                  <span class="news-date">{{ item.created_at | russianDate:'datetime' }}</span>
                </div>
                <h4 class="news-title">{{ item.title }}</h4>
                <p class="news-excerpt">{{ item.content | slice:0:100 }}{{ item.content?.length > 100 ? '...' : '' }}</p>
              </div>
            </mat-card>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .calendar-news-page {
      max-width: 1400px;
      margin: 0 auto;
      padding: 12px 24px 24px;
      font-family: Roboto, sans-serif;
    }

    .page-header-row {
      margin-bottom: 24px;
    }

    .page-header-row h1 {
      font-size: 28px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 6px 0;
    }

    .page-header-row p {
      font-size: 14px;
      color: #64748b;
      margin: 0;
    }

    .workspace-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 28px;
      align-items: start;
    }

    /* Focus Section (Calendar & Deadlines) */
    .focus-section {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .focus-grid {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 24px;
      align-items: start;
    }

    .block-card {
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      background: white;
      padding: 24px;
    }

    .block-title {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 12px;
    }

    .block-title mat-icon {
      color: #4f46e5;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .block-title h3 {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    /* Deadlines list */
    .timeline-list {
      display: flex;
      flex-direction: column;
      position: relative;
      padding-left: 20px;
    }

    .timeline-list::before {
      content: '';
      position: absolute;
      left: 4px;
      top: 8px;
      bottom: 8px;
      width: 2px;
      background: #e2e8f0;
    }

    .timeline-item {
      position: relative;
      padding-bottom: 20px;
    }

    .timeline-item:last-child {
      padding-bottom: 0;
    }

    .timeline-marker {
      position: absolute;
      left: -20px;
      top: 4px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #cbd5e1;
      border: 2px solid white;
      box-sizing: content-box;
      z-index: 1;
    }

    .timeline-item.soon .timeline-marker {
      background: #f97316;
    }

    .timeline-item.overdue .timeline-marker {
      background: #ef4444;
    }

    .timeline-content {
      background: #f8fafc;
      border-radius: 8px;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      transition: all 0.2s ease;
    }

    .timeline-content:hover {
      border-color: #cbd5e1;
      background: #f1f5f9;
    }

    .timeline-title {
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 4px;
      cursor: pointer;
    }

    .timeline-title:hover {
      color: #3f51b5;
      text-decoration: underline;
    }

    .timeline-meta {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #64748b;
      flex-wrap: wrap;
      gap: 6px;
    }

    .timeline-subject {
      font-weight: 500;
      max-width: 130px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .timeline-time {
      font-weight: 600;
    }

    .timeline-item.soon .timeline-time {
      color: #ea580c;
    }

    .timeline-item.overdue .timeline-time {
      color: #dc2626;
    }

    /* Calendar styles */
    .calendar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .calendar-month {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #334155;
    }

    .calendar-nav-btn {
      width: 32px;
      height: 32px;
      line-height: 32px;
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 3px;
    }

    .calendar-weekday {
      text-align: center;
      font-weight: 600;
      padding: 4px;
      color: #64748b;
      font-size: 11px;
      text-transform: uppercase;
    }

    .calendar-day {
      aspect-ratio: 1;
      border: 1px solid #f1f5f9;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      cursor: pointer;
      transition: all 0.2s;
      background: #f8fafc;
      font-size: 12px;
      color: #334155;
    }

    .calendar-day:hover {
      background: #e2e8f0;
      border-color: #cbd5e1;
    }

    .calendar-day.other-month {
      opacity: 0.25;
      background: transparent;
      border-color: transparent;
      cursor: default;
    }

    .calendar-day.other-month:hover {
      background: transparent;
      border-color: transparent;
    }

    .calendar-day.has-deadline {
      background: #f1f5f9;
      border-color: #cbd5e1;
      font-weight: 600;
    }

    .calendar-day.has-deadline.overdue {
      background: #fef2f2;
      border-color: #fca5a5;
      color: #991b1b;
    }

    .calendar-day.has-deadline.soon {
      background: #fff7ed;
      border-color: #ffedd5;
      color: #9a3412;
    }

    .deadline-indicator {
      width: 4px;
      height: 4px;
      background: #64748b;
      border-radius: 50%;
      margin-top: 2px;
    }

    .calendar-day.overdue .deadline-indicator {
      background: #ef4444;
    }

    .calendar-day.soon .deadline-indicator {
      background: #f97316;
    }

    /* News Column (Compact styling) */
    .news-side-section {
      background: white;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      padding: 24px;
    }

    .side-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 12px;
      color: #0f172a;
    }

    .side-header h3 {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
    }

    .side-header mat-icon {
      color: #64748b;
    }

    .compact-news-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: 800px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .compact-news-list::-webkit-scrollbar {
      width: 4px;
    }

    .compact-news-list::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 2px;
    }

    .compact-news-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: white;
      box-shadow: none;
      transition: all 0.2s ease;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .compact-news-card:hover {
      border-color: #3f51b5;
      background: #f8fafc;
    }

    .news-thumb {
      width: 100%;
      height: 120px;
      overflow: hidden;
      background: #eaeef3;
    }

    .news-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .news-details {
      padding: 12px;
    }

    .news-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      flex-wrap: wrap;
    }

    .subject-tag {
      font-size: 9px;
      font-weight: 600;
      color: #3f51b5;
      background: rgba(63, 81, 181, 0.08);
      padding: 2px 6px;
      border-radius: 8px;
      text-transform: uppercase;
    }

    .news-date {
      font-size: 10px;
      color: #94a3b8;
    }

    .news-title {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 6px 0;
      line-height: 1.3;
    }

    .news-excerpt {
      font-size: 12px;
      color: #475569;
      margin: 0;
      line-height: 1.5;
    }

    /* Common states */
    .empty-state {
      text-align: center;
      padding: 32px 12px;
      color: #94a3b8;
    }

    .empty-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      margin-bottom: 8px;
    }

    .empty-timeline {
      text-align: center;
      padding: 24px 12px;
      color: #94a3b8;
    }

    .empty-timeline-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      margin-bottom: 6px;
      color: #cbd5e1;
    }

    @media (max-width: 1100px) {
      .workspace-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .focus-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class CalendarNewsComponent implements OnInit {
  news: any[] = [];
  deadlines: any[] = [];
  upcomingDeadlines: any[] = [];
  subjects: any[] = [];
  currentDate: Date = new Date();
  calendarDays: any[] = [];
  weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.loadSubjects();
    this.loadNews();
  }

  loadNews() {
    this.apiService.getNews().subscribe({
      next: (news) => {
        this.news = news;
      },
      error: () => {
        this.news = [];
      }
    });
  }

  loadDeadlines() {
    this.apiService.getTests().subscribe({
      next: (tests) => {
        this.deadlines = tests
          .filter(t => t.due_date)
          .map(t => ({
            title: t.title,
            due_date: t.due_date,
            subject_id: t.subject_id,
            test_id: t.id,
            subject_name: this.getSubjectName(t.subject_id)
          }))
          .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        
        const now = new Date().getTime();
        this.upcomingDeadlines = this.deadlines
          .filter(d => new Date(d.due_date).getTime() >= now - 24 * 60 * 60 * 1000)
          .slice(0, 8); // Display up to 8 deadlines in list

        this.generateCalendar();
      },
      error: () => {
        this.deadlines = [];
        this.upcomingDeadlines = [];
        this.generateCalendar();
      }
    });
  }

  generateCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;
    
    let endDay = lastDay.getDay();
    endDay = endDay === 0 ? 6 : endDay - 1;
    
    const days: any[] = [];
    
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({
        date: prevMonthLastDay - i,
        fullDate: new Date(year, month - 1, prevMonthLastDay - i),
        otherMonth: true
      });
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: i,
        fullDate: new Date(year, month, i),
        otherMonth: false
      });
    }
    
    const daysToAdd = 42 - days.length;
    for (let i = 1; i <= daysToAdd; i++) {
      days.push({
        date: i,
        fullDate: new Date(year, month + 1, i),
        otherMonth: true
      });
    }
    
    this.calendarDays = days;
  }

  previousMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    this.generateCalendar();
  }

  nextMonth() {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    this.generateCalendar();
  }

  getMonthYearLabel(): string {
    const months = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return `${months[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
  }

  hasDeadlineOnDate(day: any): boolean {
    if (day.otherMonth) return false;
    const dayStr = this.formatDateForComparison(day.fullDate);
    return this.deadlines.some(d => {
      const deadlineDate = new Date(d.due_date);
      return this.formatDateForComparison(deadlineDate) === dayStr;
    });
  }

  isDateOverdue(day: any): boolean {
    if (day.otherMonth) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayDate = new Date(day.fullDate);
    dayDate.setHours(0, 0, 0, 0);
    return dayDate < today && this.hasDeadlineOnDate(day);
  }

  isDateSoon(day: any): boolean {
    if (day.otherMonth || this.isDateOverdue(day)) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayDate = new Date(day.fullDate);
    dayDate.setHours(0, 0, 0, 0);
    const daysDiff = Math.ceil((dayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 7 && daysDiff > 0 && this.hasDeadlineOnDate(day);
  }

  getDeadlinesTooltip(day: any): string {
    if (!this.hasDeadlineOnDate(day)) return '';
    const dayStr = this.formatDateForComparison(day.fullDate);
    const dayDeadlines = this.deadlines.filter(d => {
      const deadlineDate = new Date(d.due_date);
      return this.formatDateForComparison(deadlineDate) === dayStr;
    });
    
    if (dayDeadlines.length === 0) return '';
    
    return dayDeadlines.map(d => {
      const deadlineDate = new Date(d.due_date);
      const now = new Date();
      const isExpired = deadlineDate.getTime() < now.getTime();
      const status = isExpired ? '❌ Закрыт' : '✅ Открыт';
      const timeStr = this.formatRussianTime(deadlineDate);
      
      return `${d.title}\n${status} | До ${timeStr}\n${d.subject_name || 'Без предмета'}`;
    }).join('\n\n');
  }

  formatDateForComparison(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatRussianTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  loadSubjects() {
    this.apiService.getSubjects().subscribe({
      next: (subjects) => {
        this.subjects = subjects;
        this.loadDeadlines();
      },
      error: () => {
        this.loadDeadlines();
      }
    });
  }

  getSubjectName(subjectId: string): string {
    const subject = this.subjects.find(s => s.id === subjectId);
    return subject ? subject.name : 'Общий';
  }

  isOverdue(date: string): boolean {
    return new Date(date) < new Date();
  }

  isSoon(date: string): boolean {
    const deadline = new Date(date);
    const now = new Date();
    const daysDiff = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 7 && daysDiff > 0;
  }

  openNewsDialog(newsItem: any) {
    this.dialog.open(NewsDialogCnComponent, {
      data: {
        news: newsItem,
        subjectName: this.getSubjectName(newsItem.subject_id)
      }
    });
  }
}
