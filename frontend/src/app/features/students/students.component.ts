import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { UserProfileDialogComponent } from './user-profile-dialog.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    MatTableModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  template: `
    <div class="students-container">
      <div class="students-content">
        <div class="page-header">
          <div class="page-title-row">
            <h1 class="page-title">Пользователи</h1>
            <span class="user-count-badge" *ngIf="!loading">{{ students.length }}</span>
          </div>
          <p class="page-subtitle">Управление участниками, ролями и академическими группами платформы</p>
        </div>

        <div class="glass-filters-card">
          <div class="filters">
            <div class="search-input-wrap">
              <mat-icon class="search-icon">search</mat-icon>
              <input type="text" class="custom-search-input" [(ngModel)]="searchQuery" (input)="loadStudents()" placeholder="Поиск по имени или логину...">
            </div>

            <mat-form-field appearance="outline" class="course-filter-field">
              <mat-label>Курс</mat-label>
              <mat-select [(ngModel)]="selectedSubjectId" (selectionChange)="loadStudents()">
                <mat-option [value]="null">Все курсы</mat-option>
                <mat-option *ngFor="let subject of subjects" [value]="subject.id">
                  {{ subject.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <div *ngIf="loading" class="loading">
          <mat-spinner diameter="44"></mat-spinner>
        </div>

        <div *ngIf="!loading" class="glass-table-card">
          <div *ngIf="students.length === 0" class="empty-state">
            <mat-icon>group_off</mat-icon>
            <p>Пользователи не найдены</p>
            <span class="empty-sub">Попробуйте изменить поисковый запрос или фильтр курса</span>
          </div>

          <table mat-table [dataSource]="students" *ngIf="students.length > 0" class="students-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Пользователь</th>
              <td mat-cell *matCellDef="let student">
                <div class="user-cell" (click)="viewProfile(student)">
                  <div class="avatar-ring">
                    <img *ngIf="student.avatar_url" [src]="getAvatarUrl(student.avatar_url)" alt="avatar" class="avatar-img" (error)="student.avatar_url = undefined">
                    <div *ngIf="!student.avatar_url" class="avatar-monogram" [style.background]="getMonogramGradient(student.name)">
                      {{ getUserInitials(student.full_name || student.name) }}
                    </div>
                  </div>
                  <div class="user-info-text">
                    <span class="user-link">{{ student.full_name || student.name }}</span>
                    <span class="user-handle" *ngIf="student.full_name">&#64;{{ student.name }}</span>
                  </div>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="groups">
              <th mat-header-cell *matHeaderCellDef>Группы</th>
              <td mat-cell *matCellDef="let student">
                <div *ngIf="student.groups && student.groups.length > 0" class="groups-list">
                  <span *ngFor="let group of student.groups" class="group-pill">
                    {{ group.name }} <span class="group-subject" *ngIf="getSubjectName(group.subject_id)">({{ getSubjectName(group.subject_id) }})</span>
                  </span>
                </div>
                <span *ngIf="!student.groups || student.groups.length === 0" class="no-groups-pill">
                  Без групп
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef>Роль</th>
              <td mat-cell *matCellDef="let student">
                <div *ngIf="canManageRoles()" class="role-badge-picker" [ngClass]="student.role">
                  <mat-select [(ngModel)]="student.role" (selectionChange)="changeRole(student, $event.value)" panelClass="role-select-panel">
                    <mat-select-trigger>
                      <mat-icon class="role-icon">{{ getRoleIcon(student.role) }}</mat-icon>
                      <span class="role-label">{{ getRoleLabel(student.role) }}</span>
                    </mat-select-trigger>
                    <mat-option value="student">
                      <mat-icon>person</mat-icon> Студент
                    </mat-option>
                    <mat-option value="teacher">
                      <mat-icon>school</mat-icon> Преподаватель
                    </mat-option>
                  </mat-select>
                </div>
                <div *ngIf="!canManageRoles()" class="role-display-badge" [ngClass]="student.role">
                  <mat-icon class="role-icon">{{ getRoleIcon(student.role) }}</mat-icon>
                  <span>{{ getRoleLabel(student.role) }}</span>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="user-table-row"></tr>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .students-container {
      min-height: 100%;
      padding: 32px 24px 60px;
    }

    .students-content {
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 28px;
    }

    .page-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .page-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 40px;
      font-weight: 400;
      margin: 0;
      color: #09090b;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }

    .user-count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 2px 10px;
      border-radius: 9999px;
      background: rgba(0, 0, 0, 0.05);
      border: 1px solid rgba(0, 0, 0, 0.08);
      font-size: 13px;
      font-weight: 600;
      color: #52525b;
    }

    .page-subtitle {
      font-size: 15px;
      color: #71717a;
      margin: 6px 0 0;
      line-height: 1.5;
    }

    .glass-filters-card {
      margin-bottom: 24px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      padding: 16px 20px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
    }

    .filters {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .search-input-wrap {
      flex: 1;
      min-width: 260px;
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f4f4f5;
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 12px;
      padding: 0 14px;
      height: 48px;
      transition: all 0.2s ease;
    }

    .search-input-wrap:focus-within {
      background: #ffffff;
      border-color: #18181b;
      box-shadow: 0 0 0 3px rgba(24, 24, 27, 0.08);
    }

    .search-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #71717a;
    }

    .custom-search-input {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      font-size: 14.5px;
      color: #09090b;
    }

    .custom-search-input::placeholder {
      color: #a1a1aa;
    }

    .course-filter-field {
      width: 240px;
      margin-bottom: -1.25em;
    }

    .glass-table-card {
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
      overflow: hidden;
    }

    .students-table {
      width: 100%;
      background: transparent;
    }

    .user-table-row {
      transition: background 0.15s ease;
    }

    .user-table-row:hover {
      background: rgba(0, 0, 0, 0.02) !important;
    }

    .user-cell {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 10px 0;
      cursor: pointer;
    }

    .avatar-ring {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f4f4f5;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      flex-shrink: 0;
    }

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-monogram {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .user-info-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .user-link {
      color: #09090b;
      font-weight: 600;
      font-size: 14.5px;
      letter-spacing: -0.01em;
      transition: color 0.15s ease;
    }

    .user-cell:hover .user-link {
      color: #2563eb;
    }

    .user-handle {
      font-size: 12px;
      color: #71717a;
    }

    .groups-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .group-pill {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid rgba(0, 0, 0, 0.08);
      font-size: 12.5px;
      font-weight: 500;
      color: #334155;
    }

    .group-subject {
      color: #64748b;
      margin-left: 4px;
      font-size: 11.5px;
    }

    .no-groups-pill {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      background: #f4f4f5;
      color: #a1a1aa;
      font-size: 12px;
    }

    .role-badge-picker, .role-display-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .role-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .role-badge-picker {
      cursor: pointer;
      width: fit-content;
      min-width: 150px;
    }

    .role-badge-picker.admin, .role-display-badge.admin {
      background: rgba(139, 92, 246, 0.1);
      color: #7c3aed;
      border: 1px solid rgba(139, 92, 246, 0.25);
    }

    .role-badge-picker.teacher, .role-display-badge.teacher {
      background: rgba(16, 185, 129, 0.1);
      color: #059669;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }

    .role-badge-picker.student, .role-display-badge.student {
      background: rgba(37, 99, 235, 0.1);
      color: #2563eb;
      border: 1px solid rgba(37, 99, 235, 0.25);
    }

    .role-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: currentColor;
    }

    .role-label {
      flex: 1;
      white-space: nowrap;
      color: currentColor;
    }

    ::ng-deep .role-badge-picker .mat-mdc-select-value {
      color: inherit !important;
    }
    ::ng-deep .role-badge-picker .mat-mdc-select-arrow {
      color: currentColor !important;
      opacity: 0.6;
    }
    ::ng-deep .role-badge-picker .mat-mdc-form-field-wrapper {
      padding: 0 !important;
    }
    ::ng-deep .role-badge-picker .mat-mdc-form-field-infix {
      border-top: 0 !important;
      padding: 0 !important;
    }
    ::ng-deep .role-badge-picker .mat-mdc-text-field-wrapper,
    ::ng-deep .role-badge-picker .mat-mdc-form-field-flex,
    ::ng-deep .role-badge-picker .mat-mdc-form-field-infix {
      background: transparent !important;
    }
    ::ng-deep .role-badge-picker .mdc-line-ripple {
      display: none !important;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #71717a;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #d4d4d8;
      margin-bottom: 12px;
    }

    .empty-state p {
      font-size: 18px;
      font-weight: 600;
      color: #18181b;
      margin: 0 0 4px;
    }

    .empty-sub {
      font-size: 13.5px;
      color: #a1a1aa;
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 60px;
    }

    @media (max-width: 768px) {
      .students-container {
        padding: 16px;
      }
      .filters {
        flex-direction: column;
        align-items: stretch;
      }
      .course-filter-field {
        width: 100%;
      }
    }
  `]
})
export class StudentsComponent implements OnInit {
  students: any[] = [];
  subjects: any[] = [];
  selectedSubjectId: string | null = null;
  searchQuery: string = '';
  loading = false;
  displayedColumns: string[] = ['name', 'groups', 'role'];
  currentUser: any = null;

  constructor(
    private apiService: ApiService,
    private auth: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit() {
    this.auth.currentUser$.subscribe(user => this.currentUser = user);
    this.loadSubjects();
    this.loadStudents();
  }

  loadSubjects() {
    this.apiService.getSubjects().subscribe({
      next: (subjects) => {
        this.subjects = subjects;
      },
      error: (err) => console.error('Error loading subjects:', err)
    });
  }

  loadStudents() {
    this.loading = true;
    const search = this.searchQuery.trim() || undefined;
    this.apiService.getUsers(search).subscribe({
      next: (users) => {
        // Load groups for each user
        const userPromises = users.map(user => {
          const role = user.role === 'instructor' ? 'teacher' : user.role;
          return this.apiService.getGroups(undefined, user.name).toPromise().then(groups => ({
            ...user,
            role,
            groups: groups || []
          }));
        });

        Promise.all(userPromises).then(studentsWithGroups => {
          // Filter by subject if selected
          if (this.selectedSubjectId) {
            this.students = studentsWithGroups.map(student => ({
              ...student,
              groups: student.groups.filter((g: any) => g.subject_id === this.selectedSubjectId)
            })).filter(student => student.groups.length > 0);
          } else {
            this.students = studentsWithGroups;
          }

          // Sort alphabetically by name
          this.students.sort((a, b) => a.name.localeCompare(b.name));
          this.loading = false;
        });
      },
      error: (err) => {
        console.error('Error loading students:', err);
        this.loading = false;
      }
    });
  }

  getSubjectName(subjectId: string): string {
    const subject = this.subjects.find(s => s.id === subjectId);
    return subject ? subject.name : 'Неизвестный курс';
  }

  viewProfile(user: any) {
    this.dialog.open(UserProfileDialogComponent, {
      width: '400px',
      data: { user }
    });
  }

  canManageRoles(): boolean {
    return this.currentUser?.role === 'admin' || this.currentUser?.role === 'teacher';
  }

  changeRole(student: any, newRole: string) {
    if (student.role === newRole) return;

    this.apiService.updateUser(student.id, { role: newRole }).subscribe({
      next: (val) => {
        student.role = newRole;
        this.snackBar.open(`Роль пользователя ${student.name} изменена на ${newRole}`, 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.snackBar.open('Ошибка при смене роли: ' + (err.error?.detail || 'Неизвестная ошибка'), 'OK', { duration: 5000 });
      }
    });
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'admin': return 'Администратор';
      case 'teacher': return 'Преподаватель';
      case 'student': return 'Студент';
      default: return role;
    }
  }

  getRoleIcon(role: string): string {
    switch (role) {
      case 'admin': return 'admin_panel_settings';
      case 'teacher': return 'school';
      case 'student': return 'person';
      default: return 'help_outline';
    }
  }

  getUserInitials(name?: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  getMonogramGradient(name?: string): string {
    if (!name) return 'linear-gradient(135deg, #3b82f6, #6366f1)';
    const colors = [
      'linear-gradient(135deg, #3b82f6, #6366f1)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #8b5cf6, #ec4899)',
      'linear-gradient(135deg, #f59e0b, #d97706)',
      'linear-gradient(135deg, #06b6d4, #0284c7)',
      'linear-gradient(135deg, #ec4899, #f43f5e)'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  getAvatarUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/static')) return `/api${url}`;
    if (url.startsWith('/api/')) return url;
    return `/api/${url}`;
  }
}
