import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatIconModule
  ],
  template: `
    <div class="leaderboard-page">
      <div class="page-header">
        <div class="badge-pill">
          <mat-icon>emoji_events</mat-icon>
          <span>Зал славы</span>
        </div>
        <h1 class="page-title">Рейтинг успеваемости</h1>
        <p class="page-subtitle">Лидеры платформы по сумме баллов за тесты, проекты и активность</p>
      </div>

      <!-- Top 3 Podium Cards -->
      <div class="podium-grid" *ngIf="topThree.length > 0">
        <!-- 2nd Place -->
        <div class="podium-card rank-2" *ngIf="topThree[1]">
          <div class="medal-circle medal-silver">2</div>
          <div class="user-avatar-box">
            <span>{{ getMonogram(topThree[1].user) }}</span>
          </div>
          <div class="user-name">{{ topThree[1].user }}</div>
          <div class="points-pill">{{ topThree[1].points }} баллов</div>
          <div class="podium-pedestal pedestal-2">2 МЕСТО</div>
        </div>

        <!-- 1st Place -->
        <div class="podium-card rank-1" *ngIf="topThree[0]">
          <div class="crown-icon">👑</div>
          <div class="medal-circle medal-gold">1</div>
          <div class="user-avatar-box avatar-gold">
            <span>{{ getMonogram(topThree[0].user) }}</span>
          </div>
          <div class="user-name font-bold">{{ topThree[0].user }}</div>
          <div class="points-pill points-gold">{{ topThree[0].points }} баллов</div>
          <div class="podium-pedestal pedestal-1">1 МЕСТО</div>
        </div>

        <!-- 3rd Place -->
        <div class="podium-card rank-3" *ngIf="topThree[2]">
          <div class="medal-circle medal-bronze">3</div>
          <div class="user-avatar-box">
            <span>{{ getMonogram(topThree[2].user) }}</span>
          </div>
          <div class="user-name">{{ topThree[2].user }}</div>
          <div class="points-pill">{{ topThree[2].points }} баллов</div>
          <div class="podium-pedestal pedestal-3">3 МЕСТО</div>
        </div>
      </div>

      <!-- Full Table Card -->
      <div class="glass-card table-card">
        <div class="card-header">
          <h2 class="card-title">Все участники</h2>
          <span class="count-badge">Всего: {{ leaderboard.length }}</span>
        </div>

        <table mat-table [dataSource]="leaderboard" class="clean-table" *ngIf="leaderboard.length > 0">
          <ng-container matColumnDef="rank">
            <th mat-header-cell *matHeaderCellDef class="th-rank">Место</th>
            <td mat-cell *matCellDef="let element" class="td-rank">
              <span class="rank-badge" 
                    [class.badge-gold]="element.rank === 1"
                    [class.badge-silver]="element.rank === 2"
                    [class.badge-bronze]="element.rank === 3">
                {{ element.rank }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="user">
            <th mat-header-cell *matHeaderCellDef>Студент</th>
            <td mat-cell *matCellDef="let element">
              <div class="student-cell">
                <div class="avatar-tiny">{{ getMonogram(element.user) }}</div>
                <span class="student-name">{{ element.user }}</span>
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="points">
            <th mat-header-cell *matHeaderCellDef class="th-points">Баллы</th>
            <td mat-cell *matCellDef="let element" class="td-points">
              <span class="points-tag">{{ element.points }}</span>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="table-row"></tr>
        </table>

        <div *ngIf="leaderboard.length === 0" class="empty-state">
          <mat-icon class="empty-icon">emoji_events</mat-icon>
          <p>Пока нет данных для отображения рейтинга</p>
          <span class="empty-sub">Выполняйте задания и проходите тесты, чтобы попасть в топ!</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .leaderboard-page {
      max-width: 960px;
      margin: 0 auto;
      padding: 32px 24px 60px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .page-header {
      text-align: center;
      margin-bottom: 40px;
    }

    .badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 14px;
      border-radius: 9999px;
      background: rgba(0, 0, 0, 0.05);
      font-size: 12px;
      font-weight: 600;
      color: #3f3f46;
      margin-bottom: 12px;
    }

    .badge-pill mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #eab308;
    }

    .page-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 40px;
      font-weight: 500;
      color: #09090b;
      margin: 0 0 8px 0;
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      font-size: 15px;
      color: #71717a;
      margin: 0;
      max-width: 520px;
      margin-left: auto;
      margin-right: auto;
    }

    /* Podium */
    .podium-grid {
      display: grid;
      grid-template-columns: 1fr 1.15fr 1fr;
      gap: 16px;
      align-items: flex-end;
      margin-bottom: 36px;
    }

    .podium-card {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 20px 20px 14px 14px;
      padding: 24px 16px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      position: relative;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
      transition: transform 0.2s ease;
    }

    .podium-card:hover {
      transform: translateY(-4px);
    }

    .podium-card.rank-1 {
      padding-top: 32px;
      border-color: rgba(234, 179, 8, 0.3);
      box-shadow: 0 10px 30px rgba(234, 179, 8, 0.1);
    }

    .crown-icon {
      font-size: 28px;
      margin-bottom: 4px;
    }

    .medal-circle {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 10px;
    }

    .medal-gold {
      background: #fef08a;
      color: #854d0e;
    }

    .medal-silver {
      background: #e4e4e7;
      color: #3f3f46;
    }

    .medal-bronze {
      background: #fed7aa;
      color: #9a3412;
    }

    .user-avatar-box {
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: #09090b;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 17px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .user-avatar-box.avatar-gold {
      width: 64px;
      height: 64px;
      font-size: 20px;
      background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%);
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(234, 179, 8, 0.35);
    }

    .user-name {
      font-size: 15px;
      font-weight: 600;
      color: #09090b;
      margin-bottom: 6px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .points-pill {
      font-size: 13px;
      font-weight: 600;
      color: #52525b;
      background: #f4f4f5;
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 18px;
    }

    .points-gold {
      background: #fef9c3;
      color: #854d0e;
    }

    .podium-pedestal {
      width: 100%;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      padding: 8px 0;
      color: #71717a;
      border-top: 1px solid rgba(0, 0, 0, 0.06);
    }

    .pedestal-1 {
      height: 48px;
      background: rgba(234, 179, 8, 0.08);
      color: #854d0e;
    }

    .pedestal-2 {
      height: 36px;
      background: rgba(0, 0, 0, 0.03);
    }

    .pedestal-3 {
      height: 28px;
      background: rgba(194, 65, 12, 0.06);
      color: #9a3412;
    }

    /* Glass Card & Table */
    .glass-card {
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
      overflow: hidden;
    }

    .table-card {
      padding: 24px;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .card-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 24px;
      font-weight: 500;
      color: #09090b;
      margin: 0;
    }

    .count-badge {
      font-size: 12px;
      color: #71717a;
      background: #f4f4f5;
      padding: 4px 10px;
      border-radius: 9999px;
      font-weight: 500;
    }

    .clean-table {
      width: 100%;
      background: transparent;
    }

    .th-rank, .td-rank {
      width: 80px;
      text-align: center;
    }

    .th-points, .td-points {
      width: 140px;
      text-align: right;
    }

    .clean-table th {
      font-size: 12px;
      font-weight: 600;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #f4f4f5;
      padding: 12px 16px;
    }

    .clean-table td {
      padding: 14px 16px;
      border-bottom: 1px solid #f4f4f5;
      font-size: 14px;
      color: #18181b;
    }

    .table-row:hover {
      background: rgba(0, 0, 0, 0.02);
    }

    .rank-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      font-size: 12.5px;
      font-weight: 600;
      color: #71717a;
    }

    .badge-gold {
      background: #fef08a;
      color: #854d0e;
      font-weight: 700;
    }

    .badge-silver {
      background: #e4e4e7;
      color: #27272a;
      font-weight: 700;
    }

    .badge-bronze {
      background: #fed7aa;
      color: #9a3412;
      font-weight: 700;
    }

    .student-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .avatar-tiny {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #18181b;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .student-name {
      font-weight: 500;
      color: #09090b;
    }

    .points-tag {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      background: #09090b;
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
    }

    /* Empty state */
    .empty-state {
      padding: 40px 20px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .empty-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #a1a1aa;
      margin-bottom: 12px;
    }

    .empty-state p {
      font-size: 15px;
      font-weight: 500;
      color: #27272a;
      margin: 0 0 4px 0;
    }

    .empty-sub {
      font-size: 13px;
      color: #71717a;
    }

    @media (max-width: 640px) {
      .podium-grid {
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .page-title {
        font-size: 32px;
      }
    }
  `]
})
export class LeaderboardComponent implements OnInit {
  leaderboard: any[] = [];
  topThree: any[] = [];
  displayedColumns: string[] = ['rank', 'user', 'points'];

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.loadLeaderboard();
  }

  getMonogram(name?: string): string {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  loadLeaderboard() {
    this.apiService.getLeaderboard().subscribe({
      next: (leaderboard) => {
        const sorted = (leaderboard || []).map((item: any, idx: number) => ({
          ...item,
          rank: item.rank || idx + 1
        }));
        this.leaderboard = sorted;
        this.topThree = sorted.slice(0, 3);
      },
      error: (err) => {
        console.error('Error loading leaderboard:', err);
        this.leaderboard = [];
        this.topThree = [];
      }
    });
  }
}
