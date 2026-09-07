import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CourseGenerationService, CourseGenTask } from '../services/course-generation.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-course-generation-dock',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="dock-container" *ngIf="(tasks$ | async) as tasks">
      <ng-container *ngIf="tasks.length > 0">
        <!-- Collapsed floating trigger badge -->
        <div class="dock-pill" *ngIf="isCollapsed" (click)="toggleCollapse()">
          <div class="dock-pill-icon" [class.has-completed]="hasCompleted(tasks)">
            <mat-icon *ngIf="!hasCompleted(tasks)">auto_awesome</mat-icon>
            <mat-icon *ngIf="hasCompleted(tasks)">check_circle</mat-icon>
          </div>
          <span class="dock-pill-text">
            {{ getSummaryText(tasks) }}
          </span>
          <span class="count-badge">{{ tasks.length }}</span>
        </div>

        <!-- Expanded floating card -->
        <div class="dock-card" *ngIf="!isCollapsed">
          <div class="dock-card-header">
            <div class="header-left">
              <mat-icon class="header-icon">auto_awesome</mat-icon>
              <span class="header-title">Очередь генерации</span>
              <span class="header-badge">{{ tasks.length }}</span>
            </div>
            <div class="header-actions">
              <button type="button" class="header-btn" (click)="clearFinished()" matTooltip="Очистить завершенные" *ngIf="hasFinished(tasks)">
                <mat-icon>done_all</mat-icon>
              </button>
              <button type="button" class="header-btn" (click)="toggleCollapse()" matTooltip="Свернуть">
                <mat-icon>expand_more</mat-icon>
              </button>
            </div>
          </div>

          <div class="tasks-list">
            <div class="task-item" *ngFor="let task of tasks" [ngClass]="task.status">
              <div class="task-top">
                <span class="task-topic" [title]="task.topic">{{ task.topic }}</span>
                <button type="button" class="task-close-btn" (click)="dismissTask(task.id)" matTooltip="Удалить">
                  <mat-icon>close</mat-icon>
                </button>
              </div>

              <div class="task-status-line">
                <span class="status-label">{{ task.statusText }}</span>
                <span class="progress-num" *ngIf="task.status !== 'completed' && task.status !== 'error'">
                  {{ task.progress }}%
                </span>
              </div>

              <!-- Progress bar -->
              <div class="progress-track" *ngIf="task.status !== 'completed' && task.status !== 'error'">
                <div class="progress-fill" [style.width.%]="task.progress"></div>
              </div>

              <!-- Completed Action -->
              <div class="task-actions-row" *ngIf="task.status === 'completed' && task.subjectId">
                <button type="button" class="pill-btn-small dark" (click)="navigateToCourse(task.subjectId)">
                  <mat-icon>arrow_forward</mat-icon>
                  <span>Перейти к курсу</span>
                </button>
              </div>

              <!-- Error Action -->
              <div class="task-actions-row error-row" *ngIf="task.status === 'error'">
                <span class="error-msg">{{ task.error || 'Ошибка' }}</span>
                <button type="button" class="pill-btn-small outline" (click)="retryTask(task.id)">
                  <mat-icon>refresh</mat-icon>
                  <span>Повторить</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .dock-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Collapsed Pill */
    .dock-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      color: #ffffff;
      padding: 10px 18px;
      border-radius: 9999px;
      cursor: pointer;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
    }

    .dock-pill:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.28);
      background: #09090b;
    }

    .dock-pill-icon {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dock-pill-icon mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #a5b4fc;
    }

    .dock-pill-icon.has-completed mat-icon {
      color: #34d399;
    }

    .dock-pill-text {
      font-size: 13.5px;
      font-weight: 500;
      letter-spacing: -0.01em;
    }

    .count-badge {
      padding: 2px 7px;
      border-radius: 9999px;
      background: #3b82f6;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
    }

    /* Expanded Card */
    .dock-card {
      width: 360px;
      max-height: 480px;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 20px;
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.04);
      border: 1px solid rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: dockAppear 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes dockAppear {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .dock-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: #ffffff;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #6366f1;
    }

    .header-title {
      font-size: 14px;
      font-weight: 600;
      color: #09090b;
    }

    .header-badge {
      padding: 2px 7px;
      border-radius: 9999px;
      background: #f4f4f5;
      color: #52525b;
      font-size: 11px;
      font-weight: 700;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .header-btn {
      width: 28px;
      height: 28px;
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

    .header-btn:hover {
      background: rgba(0, 0, 0, 0.06);
      color: #09090b;
    }

    .header-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .tasks-list {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      max-height: 400px;
    }

    .task-item {
      padding: 14px 16px;
      border-radius: 14px;
      background: #f8fafc;
      border: 1px solid rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: all 0.2s ease;
    }

    .task-item.completed {
      background: #f0fdf4;
      border-color: rgba(16, 185, 129, 0.2);
    }

    .task-item.error {
      background: #fef2f2;
      border-color: rgba(239, 68, 68, 0.2);
    }

    .task-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .task-topic {
      font-size: 13.5px;
      font-weight: 600;
      color: #09090b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }

    .task-close-btn {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: none;
      background: transparent;
      color: #a1a1aa;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .task-close-btn:hover {
      background: rgba(0, 0, 0, 0.06);
      color: #09090b;
    }

    .task-close-btn mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .task-status-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
    }

    .status-label {
      color: #64748b;
    }

    .task-item.completed .status-label {
      color: #059669;
      font-weight: 600;
    }

    .task-item.error .status-label {
      color: #dc2626;
      font-weight: 600;
    }

    .progress-num {
      font-weight: 600;
      color: #09090b;
    }

    .progress-track {
      width: 100%;
      height: 5px;
      border-radius: 9999px;
      background: rgba(0, 0, 0, 0.06);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #6366f1);
      border-radius: 9999px;
      transition: width 0.4s ease;
    }

    .task-actions-row {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 4px;
    }

    .task-actions-row.error-row {
      justify-content: space-between;
    }

    .error-msg {
      font-size: 11.5px;
      color: #dc2626;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pill-btn-small {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .pill-btn-small mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .pill-btn-small.dark {
      background: #09090b;
      color: #ffffff;
    }

    .pill-btn-small.dark:hover {
      background: #27272a;
    }

    .pill-btn-small.outline {
      background: transparent;
      color: #09090b;
      border: 1px solid rgba(0, 0, 0, 0.14);
    }

    .pill-btn-small.outline:hover {
      background: rgba(0, 0, 0, 0.04);
    }
  `]
})
export class CourseGenerationDockComponent implements OnInit {
  tasks$: Observable<CourseGenTask[]>;
  isCollapsed = false;

  constructor(
    private courseGenService: CourseGenerationService,
    private router: Router
  ) {
    this.tasks$ = this.courseGenService.tasks$;
  }

  ngOnInit(): void {}

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  hasCompleted(tasks: CourseGenTask[]): boolean {
    return tasks.some(t => t.status === 'completed');
  }

  hasFinished(tasks: CourseGenTask[]): boolean {
    return tasks.some(t => t.status === 'completed' || t.status === 'error');
  }

  getSummaryText(tasks: CourseGenTask[]): string {
    const completed = tasks.filter(t => t.status === 'completed').length;
    if (completed > 0) {
      return `Курс готов к просмотру! (${completed})`;
    }
    return `Генерация курсов (${tasks.length})`;
  }

  dismissTask(taskId: string): void {
    this.courseGenService.removeTask(taskId);
  }

  retryTask(taskId: string): void {
    this.courseGenService.retryTask(taskId);
  }

  clearFinished(): void {
    this.courseGenService.clearFinished();
  }

  navigateToCourse(subjectId: string): void {
    this.router.navigate(['/courses', subjectId]);
  }
}
