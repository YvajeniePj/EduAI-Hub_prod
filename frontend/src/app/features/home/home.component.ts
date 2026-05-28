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
  selector: 'app-news-dialog',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatDialogModule, RussianDatePipe],
  template: `
    <div class="news-dialog-container" style="display: flex; flex-direction: column; max-height: 85vh; max-width: 800px; overflow: hidden; border-radius: 16px; font-family: Roboto, sans-serif;">
      <!-- Header -->
      <div class="dialog-header" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid #f1f5f9; background: #fff;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #1e1b4b; line-height: 1.4; word-break: break-word;">{{ data.news.title }}</h2>
        <button mat-icon-button (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Content wrapper with scroll -->
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
export class NewsDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<NewsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { news: any, subjectName: string }
  ) {}
}

@Component({
  selector: 'app-home',
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

      <!-- Main Layout: Grid -->
      <div class="home-layout-grid">
        
        <!-- Left Side: News -->
        <div class="news-section">
          <div class="section-title-row">
            <h2>Новости и объявления</h2>
          </div>
          
          <div *ngIf="news.length === 0" class="empty-state">
            <mat-icon class="empty-icon">feed</mat-icon>
            <p>Новостей пока нет</p>
          </div>

          <div class="news-scroll-wrapper" *ngIf="news.length > 0">
            <div class="news-fade-top"></div>
            <div class="news-grid">
              <mat-card *ngFor="let item of news" class="news-card">
                <div class="news-image-container" *ngIf="item.image_url">
                  <img [src]="item.image_url" alt="News image" class="news-image">
                </div>
                <mat-card-content class="news-card-body">
                  <div class="news-card-meta">
                    <span class="subject-tag">{{ getSubjectName(item.subject_id) }}</span>
                    <span class="news-date">{{ item.created_at | russianDate:'datetime' }}</span>
                  </div>
                  <h3 class="news-card-title">{{ item.title }}</h3>
                  <p class="news-card-excerpt">{{ item.content }}</p>
                </mat-card-content>
                <mat-card-actions class="news-card-actions">
                  <button mat-button color="primary" (click)="openNewsDialog(item)" class="read-more-btn">
                    Читать полностью
                    <mat-icon>arrow_forward</mat-icon>
                  </button>
                </mat-card-actions>
              </mat-card>
            </div>
          </div>
        </div>

        <!-- Right Side: Deadlines and Calendar -->
        <div class="sidebar-section">
          
          <!-- Upcoming Deadlines -->
          <div class="sidebar-block shadow-sm">
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
          </div>

          <!-- Calendar -->
          <div class="sidebar-block shadow-sm" style="margin-top: 24px;">
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

    /* Layout Grid */
    .home-layout-grid {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 32px;
    }

    /* Section Titles */
    .section-title-row h2 {
      font-size: 20px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 20px 0;
    }

    /* News Cards with Inner Scrolling */
    .news-scroll-wrapper {
      position: relative;
      display: block;
    }
    .news-fade-top {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 24px;
      background: linear-gradient(to bottom, #f8fafc 0%, rgba(248, 250, 252, 0) 100%);
      z-index: 5;
      pointer-events: none;
    }
    .news-grid {
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-height: 760px;
      overflow-y: auto;
      padding-top: 8px;
      padding-right: 8px;
      scroll-behavior: smooth;
    }
    .news-grid::-webkit-scrollbar {
      width: 6px;
    }
    .news-grid::-webkit-scrollbar-track {
      background: transparent;
    }
    .news-grid::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 3px;
    }
    .news-grid::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }
    .news-card {
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
      transition: all 0.25s ease;
      overflow: hidden;
    }
    .news-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.04);
      border-color: #cbd5e1;
    }
    .news-image-container {
      width: 100%;
      height: 600px;
      overflow: hidden;
      border-bottom: 1px solid #f1f5f9;
      background: #eaeef3;
    }
    .news-image {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover;
      display: block;
      transition: transform 0.4s ease;
    }
    .news-card:hover .news-image {
      transform: scale(1.02);
    }
    .news-card-body {
      padding: 24px;
    }
    .news-card-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
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
    .news-card-title {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 10px 0;
      line-height: 1.4;
    }
    .news-card-excerpt {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      word-break: break-word;
    }
    .news-card-actions {
      padding: 0 24px 20px;
      border-top: none;
    }
    .read-more-btn {
      padding: 0 12px;
      font-weight: 500;
      color: #3f51b5;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .read-more-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      transition: transform 0.2s ease;
    }
    .read-more-btn:hover mat-icon {
      transform: translateX(4px);
    }

    /* Sidebar Blocks */
    .sidebar-block {
      background: white;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
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
      color: #64748b;
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

    /* Timeline list */
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
    }
    .timeline-subject {
      font-weight: 500;
      max-width: 150px;
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

    /* Common Empty & Spin states */
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
    .spin { animation: rotation 2s infinite linear; }
    @keyframes rotation { from { transform: rotate(0deg); } to { transform: rotate(359deg); } }

    @media (max-width: 1024px) {
      .home-layout-grid {
        grid-template-columns: 1fr;
      }
      .welcome-content {
        max-width: 100%;
      }
      .welcome-illustration {
        display: none;
      }
    }
  `]
})
export class HomeComponent implements OnInit {
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
      error: (err) => {
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
          .slice(0, 5);

        this.generateCalendar();
      },
      error: (err) => {
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

  getDeadlineCount(day: any): number {
    if (!this.hasDeadlineOnDate(day)) return 0;
    const dayStr = this.formatDateForComparison(day.fullDate);
    return this.deadlines.filter(d => {
      const deadlineDate = new Date(d.due_date);
      return this.formatDateForComparison(deadlineDate) === dayStr;
    }).length;
  }

  loadSubjects() {
    this.apiService.getSubjects().subscribe({
      next: (subjects) => {
        this.subjects = subjects;
        this.loadDeadlines();
      },
      error: (err) => {
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
    this.dialog.open(NewsDialogComponent, {
      data: {
        news: newsItem,
        subjectName: this.getSubjectName(newsItem.subject_id)
      },
      panelClass: 'custom-news-dialog-panel'
    });
  }
}
