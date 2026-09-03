import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, NgZone, HostListener } from '@angular/core';
import { RouterOutlet, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { ApiService } from './core/services/api.service';
import { AuthService, CurrentUser } from './core/services/auth.service';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatTooltipModule,
    MatBadgeModule,
    MatMenuModule
  ],
  template: `
    <!-- Global Animated Constellation Canvas Background -->
    <canvas #globalParticleCanvas class="global-particle-canvas"></canvas>

    <div *ngIf="!isInitialized" class="initial-loader">
      <div class="loader-content">
        <mat-icon class="loader-icon">school</mat-icon>
        <span class="loader-text">EduAI Hub</span>
        <div class="spinner"></div>
      </div>
    </div>

    <mat-sidenav-container class="sidenav-container" *ngIf="isInitialized && currentUser; else noAuth">
      <mat-sidenav #sidenav mode="over" class="app-sidenav">
        <div class="sidenav-header">
          <div class="brand-logo" (click)="sidenav.close()" routerLink="/">
            <div class="ai-square-logo">
              <span>AI</span>
            </div>
            <span class="brand-name">EduAI Hub</span>
          </div>
          <button class="close-sidenav-btn" (click)="sidenav.close()" aria-label="Закрыть меню">
            <mat-icon style="font-size: 18px; width: 18px; height: 18px;">close</mat-icon>
          </button>
        </div>
        
        <mat-nav-list class="sidenav-list">
          <!-- Home -->
          <a mat-list-item routerLink="/" (click)="sidenav.close()" routerLinkActive="active-link" [routerLinkActiveOptions]="{exact: true}" class="nav-item">
            <mat-icon matListItemIcon class="nav-icon">home</mat-icon>
            <span matListItemTitle class="nav-title">Главная</span>
          </a>
          <a mat-list-item routerLink="/calendar-news" (click)="sidenav.close()" routerLinkActive="active-link" class="nav-item">
            <mat-icon matListItemIcon class="nav-icon">calendar_month</mat-icon>
            <span matListItemTitle class="nav-title">Календарь и новости</span>
          </a>

          <!-- Dynamic Courses -->
          <ng-container *ngIf="sidebarSubjects && sidebarSubjects.length > 0">
            <div class="nav-block-header">МОИ КУРСЫ</div>
            <a mat-list-item *ngFor="let subject of sidebarSubjects" [routerLink]="['/courses', subject.id]" (click)="sidenav.close()" routerLinkActive="active-link" class="nav-item nav-course-item">
              <span class="course-dot">•</span>
              <span matListItemTitle class="course-nav-title">{{ subject.name }}</span>
            </a>
          </ng-container>

          <!-- Block: Management (Teachers/Admins Only) -->
          <ng-container *ngIf="currentUser.role === 'teacher' || currentUser.role === 'admin'">
            <div class="nav-block-header">УПРАВЛЕНИЕ</div>
            <a mat-list-item routerLink="/analytics" (click)="sidenav.close()" routerLinkActive="active-link" class="nav-item">
              <mat-icon matListItemIcon class="nav-icon">insights</mat-icon>
              <span matListItemTitle class="nav-title">Аналитика</span>
            </a>
            <a mat-list-item routerLink="/activity-monitor" (click)="sidenav.close()" routerLinkActive="active-link" class="nav-item">
              <mat-icon matListItemIcon class="nav-icon">visibility</mat-icon>
              <span matListItemTitle class="nav-title">Мониторинг</span>
            </a>
            <a mat-list-item routerLink="/news/manage" (click)="sidenav.close()" routerLinkActive="active-link" class="nav-item">
              <mat-icon matListItemIcon class="nav-icon">feed</mat-icon>
              <span matListItemTitle class="nav-title">Новости</span>
            </a>
            <a mat-list-item routerLink="/admin/db" (click)="sidenav.close()" routerLinkActive="active-link" class="nav-item">
              <mat-icon matListItemIcon class="nav-icon">database</mat-icon>
              <span matListItemTitle class="nav-title">База данных</span>
            </a>
          </ng-container>

          <!-- Block: Users (Teachers/Admins Only) -->
          <ng-container *ngIf="currentUser.role === 'teacher' || currentUser.role === 'admin'">
            <div class="nav-block-header">ПОЛЬЗОВАТЕЛИ</div>
            <a mat-list-item routerLink="/students" (click)="sidenav.close()" routerLinkActive="active-link" class="nav-item">
              <mat-icon matListItemIcon class="nav-icon">person_search</mat-icon>
              <span matListItemTitle class="nav-title">Пользователи</span>
            </a>
            <a mat-list-item routerLink="/groups" (click)="sidenav.close()" routerLinkActive="active-link" class="nav-item">
              <mat-icon matListItemIcon class="nav-icon">groups</mat-icon>
              <span matListItemTitle class="nav-title">Группы</span>
            </a>
          </ng-container>

          <!-- Block: Common Additional Sections -->
          <div class="nav-block-header">ДОПОЛНИТЕЛЬНО</div>
          <a mat-list-item routerLink="/leaderboard" (click)="sidenav.close()" routerLinkActive="active-link" class="nav-item">
            <mat-icon matListItemIcon class="nav-icon">emoji_events</mat-icon>
            <span matListItemTitle class="nav-title">Лидерборд</span>
          </a>
          <a mat-list-item routerLink="/messages" (click)="sidenav.close()" routerLinkActive="active-link" class="nav-item">
            <mat-icon matListItemIcon class="nav-icon">forum</mat-icon>
            <span matListItemTitle class="nav-title">Сообщения</span>
          </a>
          <a mat-list-item routerLink="/chat" (click)="sidenav.close()" routerLinkActive="active-link" class="nav-item">
            <mat-icon matListItemIcon class="nav-icon">smart_toy</mat-icon>
            <span matListItemTitle class="nav-title">Чат-ассистент</span>
          </a>
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="app-toolbar">
          <!-- 3-thin-lines Hamburger Menu -->
          <button class="menu-hamburger-btn" (click)="sidenav.toggle()" aria-label="Открыть меню">
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
          </button>
          
          <!-- Brand Logo: Black square with AI in Instrument Serif -->
          <div class="brand-logo" routerLink="/">
            <div class="ai-square-logo">
              <span>AI</span>
            </div>
            <span class="brand-name">EduAI Hub</span>
          </div>

          <!-- Active test timer widget -->
          <div class="active-test-timer-toolbar" *ngIf="activeTestTimer" (click)="goToActiveTest()" matTooltip="Нажмите, чтобы вернуться к тесту">
            <mat-icon style="color: #ffd700; font-size: 18px; width: 18px; height: 18px; margin: 0;">timer</mat-icon>
            <span style="font-size: 13px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1e293b;">{{ activeTestTimer.testTitle }}</span>
            <span style="font-size: 13px; font-family: monospace; background: rgba(0,0,0,0.06); padding: 2px 8px; border-radius: 12px; color: #1e293b;">{{ activeTestTimer.displayTime }}</span>
          </div>
          
          <span class="spacer"></span>
          
          <!-- Notifications -->
          <button mat-icon-button [matMenuTriggerFor]="notificationsMenu" class="notification-button" aria-label="Уведомления">
            <mat-icon [matBadge]="unreadCount" [matBadgeHidden]="unreadCount === 0" matBadgeColor="warn" style="font-size: 20px; width: 20px; height: 20px; color: #64748b;">notifications</mat-icon>
          </button>
          
          <mat-menu #notificationsMenu="matMenu" class="notifications-menu">
            <div class="notifications-header">
              <h3>Уведомления</h3>
              <button mat-button *ngIf="unreadCount > 0" (click)="markAllRead()" class="mark-all-read">Отметить все прочитанными</button>
            </div>
            <div class="notifications-list">
              <div *ngIf="notifications.length === 0" class="no-notifications">
                Нет уведомлений
              </div>
              <div *ngFor="let notification of notifications" 
                   class="notification-item" 
                   [class.unread]="!notification.is_read"
                   (click)="markAsRead(notification.id)">
                <div class="notification-content">
                  <div class="notification-title">{{ notification.title || notification.type || 'Уведомление' }}</div>
                  <div class="notification-message">{{ notification.message }}</div>
                  <div class="notification-time">{{ formatNotificationTime(notification.created_at) }}</div>
                </div>
                <button mat-icon-button (click)="deleteNotification(notification.id, $event)" class="delete-notification">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>
          </mat-menu>
          
          <!-- Monogram avatar + User Name -->
          <button mat-button routerLink="/profile" class="profile-button">
            <div class="profile-content">
              <div class="user-monogram">
                {{ getUserInitials(currentUser.name) }}
              </div>
              <span class="toolbar-user-name">{{ currentUser.name }}</span>
            </div>
          </button>

          <!-- Logout Button -->
          <button mat-icon-button (click)="logout()" matTooltip="Выйти" class="logout-icon-btn">
            <mat-icon style="font-size: 20px; width: 20px; height: 20px; color: #64748b;">arrow_forward</mat-icon>
          </button>
        </mat-toolbar>

        <div class="main-content">
          <router-outlet></router-outlet>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
    
    <ng-template #noAuth>
      <div class="no-auth-container">
        <router-outlet></router-outlet>
      </div>
    </ng-template>
  `,
  styles: [`
    .global-particle-canvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 0;
    }
    .no-auth-container {
      width: 100%;
      min-height: 100vh;
      margin: 0;
      padding: 0;
      position: relative;
      z-index: 1;
    }
    .initial-loader {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #faf9f6;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    }
    .loader-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .loader-icon {
      font-size: 64px;
      height: 64px;
      width: 64px;
      color: #3f51b5;
      margin-bottom: 8px;
    }
    .loader-text {
      font-size: 24px;
      font-weight: 500;
      color: #1a237e;
      letter-spacing: 1px;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(63, 81, 181, 0.1);
      border-radius: 50%;
      border-top-color: #3f51b5;
      animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .spacer {
      flex: 1 1 auto;
    }
    .sidenav-container {
      height: 100vh;
      background: transparent !important;
      position: relative;
      z-index: 1;
    }
    .app-sidenav {
      width: 280px;
      background: rgba(255, 255, 255, 0.88) !important;
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border-right: 1px solid rgba(0, 0, 0, 0.06);
      box-shadow: 10px 0 35px rgba(0, 0, 0, 0.03);
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }
    .sidenav-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: transparent;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    }
    .close-sidenav-btn {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 6px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.15s, color 0.15s;
    }
    .close-sidenav-btn:hover {
      background-color: rgba(0, 0, 0, 0.05);
      color: #09090b;
    }
    .sidenav-list {
      padding: 12px 8px;
    }
    .nav-item {
      border-radius: 8px !important;
      margin: 2px 4px !important;
      height: 40px !important;
      transition: background-color 0.15s ease;
    }
    .nav-item:hover {
      background-color: rgba(0, 0, 0, 0.04) !important;
    }
    .nav-icon {
      font-size: 19px !important;
      width: 19px !important;
      height: 19px !important;
      color: #64748b !important;
      margin-right: 12px !important;
    }
    .nav-title {
      font-family: 'Inter', sans-serif !important;
      font-size: 13.5px !important;
      font-weight: 400 !important;
      color: #334155 !important;
    }
    .nav-block-header {
      padding: 18px 16px 6px;
      font-family: 'Inter', sans-serif;
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: #94a3b8;
      text-transform: uppercase;
    }
    .nav-course-item {
      padding-left: 14px !important;
    }
    .course-dot {
      color: #94a3b8;
      font-size: 16px;
      margin-right: 12px;
      display: inline-block;
      line-height: 1;
    }
    .course-nav-title {
      font-family: 'Inter', sans-serif !important;
      font-size: 13px !important;
      color: #334155 !important;
    }
    .active-link {
      background: #f1f5f9 !important;
      color: #09090b !important;
    }
    .active-link .nav-icon {
      color: #09090b !important;
    }
    .active-link .nav-title, .active-link .course-nav-title {
      font-weight: 600 !important;
      color: #09090b !important;
    }
    .active-link .course-dot {
      color: #09090b !important;
    }

    /* Toolbar & Navbar Elements */
    .app-toolbar {
      height: 60px;
      padding: 0 24px;
      display: flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.78) !important;
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
      border-bottom: 1px solid rgba(0, 0, 0, 0.06) !important;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02) !important;
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .menu-hamburger-btn {
      background: transparent;
      border: none;
      padding: 8px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 3.5px;
      border-radius: 6px;
      margin-right: 8px;
      transition: background-color 0.15s ease;
    }
    .menu-hamburger-btn:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }
    .hamburger-line {
      display: block;
      width: 17px;
      height: 1.5px;
      background-color: #09090b;
      border-radius: 1px;
    }

    /* Brand Logo */
    .brand-logo {
      display: flex;
      align-items: center;
      gap: 9px;
      cursor: pointer;
      user-select: none;
      text-decoration: none;
    }
    .ai-square-logo {
      width: 28px;
      height: 28px;
      background: #09090b;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
    }
    .ai-square-logo span {
      font-family: 'Instrument Serif', 'Cormorant Garamond', Georgia, serif;
      font-size: 16px;
      font-weight: 500;
      color: #ffffff;
      line-height: 1;
      letter-spacing: -0.5px;
    }
    .brand-name {
      font-family: 'Instrument Serif', 'Cormorant Garamond', Georgia, serif;
      font-size: 20px;
      font-weight: 500;
      color: #09090b;
      letter-spacing: -0.01em;
    }

    .active-test-timer-toolbar {
      cursor: pointer;
      display: flex;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 5px 12px;
      border-radius: 20px;
      margin-left: 20px;
      gap: 8px;
    }
    .timer-title {
      font-size: 13px;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #334155;
      font-weight: 500;
    }
    .timer-badge {
      font-size: 13px;
      font-family: monospace;
      background: #e2e8f0;
      padding: 1px 6px;
      border-radius: 10px;
      color: #1e293b;
      font-weight: 600;
    }

    .main-content {
      padding: 24px;
      min-height: calc(100vh - 64px);
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    /* Monogram Avatar & Profile */
    .profile-button {
      border-radius: 20px !important;
      padding: 4px 12px 4px 6px !important;
      height: 40px !important;
      margin-left: 4px;
    }
    .profile-button:hover {
      background: rgba(0, 0, 0, 0.04) !important;
    }
    .profile-content {
      display: flex !important;
      align-items: center;
      gap: 8px;
    }
    .user-monogram {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #475569;
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.05em;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .toolbar-user-name {
      font-family: 'Inter', sans-serif;
      font-size: 13.5px;
      font-weight: 500;
      color: #334155;
    }
    .logout-icon-btn {
      color: #64748b !important;
      margin-left: 2px;
    }
    .logout-icon-btn:hover {
      color: #09090b !important;
    }
    mat-icon.status-disconnected {
      color: #f44336;
    }
    .notification-button {
      margin-right: 8px;
    }
    ::ng-deep .notifications-menu {
      max-width: 400px;
      min-width: 350px;
      margin-top: 10px;
      border-radius: 8px !important;
    }
    .notifications-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #f0f0f0;
      background: #fff;
    }
    .notifications-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
    .mark-all-read {
      font-size: 11px;
      line-height: normal;
      color: #3f51b5;
    }
    .notifications-list {
      max-height: 400px;
      overflow-y: auto;
    }
    .no-notifications {
      padding: 32px 16px;
      text-align: center;
      color: #999;
      font-size: 14px;
    }
    .notification-item {
      display: flex;
      align-items: flex-start;
      padding: 12px 16px;
      border-bottom: 1px solid #f9f9f9;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }
    .notification-item:hover {
      background-color: #fafafa;
    }
    .notification-item.unread {
      background-color: #f0f7ff;
      border-left: 3px solid #3f51b5;
    }
    .notification-item.unread:hover {
      background-color: #e8f0fe;
    }
    .notification-content {
      flex: 1;
      min-width: 0;
      padding-right: 8px;
    }
    .notification-title {
      font-weight: 600;
      margin-bottom: 4px;
      color: #2c3e50;
      font-size: 14px;
      line-height: 1.3;
    }
    .notification-message {
      font-size: 13px;
      color: #555;
      margin-bottom: 6px;
      line-height: 1.4;
      word-wrap: break-word;
    }
    .notification-time {
      font-size: 11px;
      color: #999;
      display: flex;
      align-items: center;
    }
    .delete-notification {
      width: 28px;
      height: 28px;
      line-height: 28px;
      opacity: 0.2;
      transition: opacity 0.2s;
    }
    .notification-item:hover .delete-notification {
      opacity: 0.6;
    }
    .delete-notification:hover {
      opacity: 1;
      color: #f44336;
    }
  `]
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('globalParticleCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  private animationFrameId: number | null = null;
  private particles: Particle[] = [];
  private resizeListener?: () => void;
  private mouseMoveListener?: (e: MouseEvent) => void;
  private mouseLeaveListener?: () => void;
  private mouse = { x: -1000, y: -1000, radius: 130 };

  sidebarSubjects: any[] = [];
  title = 'EduAI Hub';
  aiStatus: any = null;
  activeTestTimer: any = null;
  private timerSubscription?: Subscription;
  private statusCheckSubscription?: Subscription;
  private authSubscription?: Subscription;
  currentUser: CurrentUser | null = null;
  isInitialized = false;
  avatarError = false;
  notifications: any[] = [];
  unreadCount: number = 0;
  private notificationCheckInterval?: Subscription;
  private sessionStartTime: number = Date.now();

  constructor(
    private apiService: ApiService,
    private auth: AuthService,
    private router: Router,
    private ngZone: NgZone
  ) { }

  getUserInitials(name?: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  ngOnInit() {
    this.currentUser = this.auth.getCurrentUser();

    // Subscribe to initialization status
    this.auth.isInitialized$.subscribe(initialized => {
      this.isInitialized = initialized;
    });

    // Подписываемся на изменения текущего пользователя
    this.authSubscription = this.auth.currentUser$.pipe(
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    ).subscribe(user => {
      const previouslyLoggedIn = !!this.currentUser;
      this.currentUser = user;
      this.avatarError = false;

      if (user) {
        this.loadSidebarSubjects();
        if (!previouslyLoggedIn) {
          this.startSession();
        }
      } else {
        this.sidebarSubjects = [];
      }
    });

    if (this.currentUser) {
      this.startSession();
      this.loadSidebarSubjects();
    }

    this.checkAiStatus();
    // Check status every 30 seconds
    this.statusCheckSubscription = interval(30000).subscribe(() => {
      this.checkAiStatus();
    });

    // Load notifications
    this.loadNotifications();
    // Check notifications every 10 seconds
    this.notificationCheckInterval = interval(10000).subscribe(() => {
      this.loadNotifications();
    });

    this.startGlobalTimerCheck();
  }

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      this.initParticleCanvas();
    });
  }

  ngOnDestroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
    if (this.mouseMoveListener) {
      window.removeEventListener('mousemove', this.mouseMoveListener);
    }
    if (this.mouseLeaveListener) {
      window.removeEventListener('mouseleave', this.mouseLeaveListener);
    }
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
    if (this.statusCheckSubscription) {
      this.statusCheckSubscription.unsubscribe();
    }
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.notificationCheckInterval) {
      this.notificationCheckInterval.unsubscribe();
    }
    this.endSession();
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: any) {
    this.endSession();
  }

  private startSession() {
    if (!this.currentUser) return;
    this.sessionStartTime = Date.now();

    this.apiService.createActivity({
      user_name: this.currentUser.name,
      action_type: 'session_start'
    }).subscribe({
      error: (err) => {
        // Silenced: console.error('Error tracking session start:', err)
      }
    });
  }

  private endSession() {
    if (!this.currentUser) return;
    const duration = Math.floor((Date.now() - this.sessionStartTime) / 1000);

    // We use a beacon or a synchronous-like call if possible, but for now just try standard call
    // In a real app, we might use navigator.sendBeacon for beforeunload
    this.apiService.createActivity({
      user_name: this.currentUser.name,
      action_type: 'session_end',
      session_duration: duration
    }).subscribe();
  }

  loadSidebarSubjects() {
    this.apiService.getSubjects().subscribe({
      next: (subjects) => {
        this.sidebarSubjects = subjects;
      },
      error: (err) => {
        console.error('Error loading sidebar subjects:', err);
      }
    });
  }

  loadNotifications() {
    if (!this.currentUser) return;

    this.apiService.getNotifications(this.currentUser.name, false).subscribe({
      next: (notifications) => {
        this.notifications = notifications.slice(0, 10); // Show latest 10
        this.unreadCount = notifications.filter((n: any) => !n.is_read).length;
      },
      error: (err) => {
        // Silenced: console.error('Error loading notifications:', err);
      }
    });
  }

  markAsRead(notificationId: string) {
    this.apiService.markNotificationRead(notificationId).subscribe({
      next: () => {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
          notification.is_read = true;
        }
        this.unreadCount = Math.max(0, this.unreadCount - 1);
      },
      error: (err) => {
        console.error('Error marking notification as read:', err);
      }
    });
  }

  markAllRead() {
    if (!this.currentUser) return;

    this.apiService.markAllNotificationsRead(this.currentUser.name).subscribe({
      next: () => {
        this.notifications.forEach(n => n.is_read = true);
        this.unreadCount = 0;
      },
      error: (err) => {
        console.error('Error marking all notifications as read:', err);
      }
    });
  }

  deleteNotification(notificationId: string, event: Event) {
    event.stopPropagation();
    this.apiService.deleteNotification(notificationId).subscribe({
      next: () => {
        const index = this.notifications.findIndex(n => n.id === notificationId);
        if (index !== -1) {
          if (!this.notifications[index].is_read) {
            this.unreadCount = Math.max(0, this.unreadCount - 1);
          }
          this.notifications.splice(index, 1);
        }
      },
      error: (err) => {
        console.error('Error deleting notification:', err);
      }
    });
  }

  formatNotificationTime(dateString: string): string {
    try {
      // Backend returns UTC but might be missing 'Z' or explicit offset in some cases
      // or browser interprets naive string as local.
      // Easiest fix: if it doesn't end in Z, append it to treat as UTC.
      let safeDateString = dateString;
      if (!dateString.endsWith('Z') && !dateString.includes('+')) {
        safeDateString = dateString + 'Z';
      }

      const date = new Date(safeDateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'только что';
      if (diffMins < 60) return `${diffMins} мин. назад`;
      if (diffHours < 24) return `${diffHours} ч. назад`;
      if (diffDays < 7) return `${diffDays} дн. назад`;

      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  }

  checkAiStatus() {
    this.apiService.getAiStatus().subscribe({
      next: (status) => {
        this.aiStatus = status;
      },
      error: (err) => {
        // Мы скрыли console.error, чтобы он не засорял консоль красным до логина
        this.aiStatus = {
          available: false,
          message: 'Ошибка проверки статуса'
        };
      }
    });
  }

  logout() {
    this.endSession();
    this.auth.logout();
    this.currentUser = null;
    this.router.navigate(['/login']);
  }

  getAvatarUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/static')) return `/api${url}`;
    if (url.startsWith('/api/')) return url;
    return `/api/${url}`;
  }

  startGlobalTimerCheck() {
    this.timerSubscription = interval(1000).subscribe(() => {
      // Скрываем таймер в шапке, если пользователь находится на странице прохождения теста
      if (this.router.url.includes('/take')) {
        this.activeTestTimer = null;
        return;
      }

      const timerDataStr = localStorage.getItem('active_test_timer');
      if (!timerDataStr) {
        this.activeTestTimer = null;
        return;
      }

      try {
        const timerData = JSON.parse(timerDataStr);
        if (!timerData || !timerData.startTime || typeof timerData.timeLimitMinutes !== 'number') {
          this.activeTestTimer = null;
          localStorage.removeItem('active_test_timer');
          return;
        }
        const startTime = new Date(timerData.startTime);
        const timeLimitMinutes = timerData.timeLimitMinutes;
        const endTime = new Date(startTime.getTime() + timeLimitMinutes * 60 * 1000);
        const now = new Date();
        const remaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));

        if (remaining <= 0) {
          this.activeTestTimer = null;
          localStorage.removeItem('active_test_timer');
        } else {
          this.activeTestTimer = {
            testId: timerData.testId,
            testTitle: timerData.testTitle,
            displayTime: this.formatActiveTime(remaining)
          };
        }
      } catch (e) {
        this.activeTestTimer = null;
      }
    });
  }

  formatActiveTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  goToActiveTest() {
    if (this.activeTestTimer) {
      this.router.navigate(['/tests', this.activeTestTimer.testId, 'take']);
    }
  }

  private initParticleCanvas() {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setupDimensions = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    setupDimensions();

    this.resizeListener = () => {
      setupDimensions();
      this.createParticles(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this.resizeListener);

    this.mouseMoveListener = (e: MouseEvent) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', this.mouseMoveListener);

    this.mouseLeaveListener = () => {
      this.mouse.x = -1000;
      this.mouse.y = -1000;
    };
    window.addEventListener('mouseleave', this.mouseLeaveListener);

    this.createParticles(window.innerWidth, window.innerHeight);
    this.renderCanvas(ctx);
  }

  private createParticles(width: number, height: number) {
    const count = Math.min(70, Math.floor((width * height) / 20000) + 30);
    this.particles = [];

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radius: Math.random() * 1.4 + 1.1,
        baseAlpha: Math.random() * 0.28 + 0.25
      });
    }
  }

  private renderCanvas(ctx: CanvasRenderingContext2D) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const maxDistance = 145;

    const loop = () => {
      ctx.clearRect(0, 0, width, height);

      const len = this.particles.length;
      for (let i = 0; i < len; i++) {
        const p = this.particles[i];

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        else if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        else if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(140, 140, 150, ${p.baseAlpha})`;
        ctx.fill();

        for (let j = i + 1; j < len; j++) {
          const p2 = this.particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const alpha = (1 - dist / maxDistance) * 0.16;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(160, 160, 175, ${alpha})`;
            ctx.lineWidth = 0.9;
            ctx.stroke();
          }
        }

        const mdx = p.x - this.mouse.x;
        const mdy = p.y - this.mouse.y;
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mDist < this.mouse.radius) {
          const mAlpha = (1 - mDist / this.mouse.radius) * 0.22;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(this.mouse.x, this.mouse.y);
          ctx.strokeStyle = `rgba(120, 120, 140, ${mAlpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    loop();
  }
}

