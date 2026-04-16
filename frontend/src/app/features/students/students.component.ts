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
          <h1 class="page-title">Пользователи</h1>
          <p class="page-subtitle">Список всех пользователей в системе</p>
        </div>

        <mat-card class="filter-card">
          <mat-card-content>
            <div class="filters">
              <mat-form-field appearance="outline">
                <mat-label>Курс</mat-label>
                <mat-select [(ngModel)]="selectedSubjectId" (selectionChange)="loadStudents()">
                  <mat-option [value]="null">Все курсы</mat-option>
                  <mat-option *ngFor="let subject of subjects" [value]="subject.id">
                    {{ subject.name }}
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Поиск</mat-label>
                <input matInput [(ngModel)]="searchQuery" (input)="loadStudents()" placeholder="Введите имя студента">
                <mat-icon matSuffix>search</mat-icon>
              </mat-form-field>
            </div>
          </mat-card-content>
        </mat-card>

        <div *ngIf="loading" class="loading">
          <mat-spinner></mat-spinner>
        </div>

        <mat-card *ngIf="!loading" class="students-card">
          <mat-card-content>
            <div *ngIf="students.length === 0" class="empty-state">
              <mat-icon>people</mat-icon>
              <p>Студенты не найдены</p>
            </div>

            <table mat-table [dataSource]="students" *ngIf="students.length > 0" class="students-table">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Имя</th>
                <td mat-cell *matCellDef="let student">
                  <span class="user-link" (click)="viewProfile(student)">{{ student.name }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="groups">
                <th mat-header-cell *matHeaderCellDef>Группы</th>
                <td mat-cell *matCellDef="let student">
                  <div *ngIf="student.groups && student.groups.length > 0" class="groups-list">
                    <span *ngFor="let group of student.groups" class="group-chip">
                      {{ group.name }} ({{ getSubjectName(group.subject_id) }})
                    </span>
                  </div>
                  <span *ngIf="!student.groups || student.groups.length === 0" class="no-groups">
                    Нет групп
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
                      <mat-option value="instructor">
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
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .students-container {
      min-height: 100%;
    }

    .students-content {
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 32px;
    }

    .page-title {
      font-size: 32px;
      font-weight: 600;
      margin: 0 0 8px 0;
      color: #1a237e;
      line-height: 1.2;
    }

    .page-subtitle {
      font-size: 16px;
      color: #616161;
      margin: 0;
      line-height: 1.5;
    }

    .filter-card {
      margin-bottom: 24px;
      border-radius: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      background: white;
    }

    .filters {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 60px;
    }

    .students-card {
      border-radius: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      background: white;
    }

    .students-table {
      width: 100%;
    }

    .groups-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .group-chip {
      display: inline-block;
      padding: 4px 12px;
      background: #e3f2fd;
      color: #1976d2;
      border-radius: 16px;
      font-size: 14px;
    }

    .no-groups {
      color: #999;
      font-style: italic;
    }

    .empty-state {
      text-align: center;
      padding: 80px 20px;
      color: #999;
    }

    .empty-state mat-icon {
      font-size: 96px;
      width: 96px;
      height: 96px;
      margin-bottom: 24px;
      opacity: 0.4;
      color: #9e9e9e;
    }

    .empty-state p {
      font-size: 24px;
      font-weight: 500;
      color: #616161;
      margin: 0;
    }

    @media (max-width: 768px) {
      .students-container {
        padding: 16px;
      }

      .filters {
        grid-template-columns: 1fr;
      }
    }
    .user-link {
        color: #3f51b5;
        cursor: pointer;
        font-weight: 500;
        text-decoration: underline;
    }
    .user-link:hover {
        color: #1a237e;
    }
    .mat-column-name {
        flex: 1;
        padding-right: 16px;
    }
    .mat-column-groups {
        flex: 3;
        padding-right: 16px;
    }
    .mat-column-role {
        flex: 0 0 190px;
    }

    .role-badge-picker, .role-display-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    .role-badge-picker {
        cursor: pointer;
        width: fit-content;
        min-width: 160px;
    }

    .role-badge-picker:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }

    /* Role Colors */
    .role-badge-picker.admin, .role-display-badge.admin {
        background: linear-gradient(135deg, #6a1b9a, #4a0072);
        color: white;
    }
    .role-badge-picker.instructor, .role-display-badge.instructor {
        background: linear-gradient(135deg, #2e7d32, #1b5e20);
        color: white;
    }
    .role-badge-picker.student, .role-display-badge.student {
        background: linear-gradient(135deg, #1565c0, #0d47a1);
        color: white;
    }

    .role-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        margin-right: 8px;
    }

    .role-label {
        flex: 1;
        white-space: nowrap;
        overflow: visible;
        text-overflow: clip;
    }

    ::ng-deep .role-badge-picker .mat-mdc-select-value {
        color: white !important;
    }
    ::ng-deep .role-badge-picker .mat-mdc-select-arrow {
        color: rgba(255,255,255,0.7) !important;
    }
    ::ng-deep .role-badge-picker .mat-mdc-form-field-wrapper {
        padding: 0 !important;
    }
    ::ng-deep .role-badge-picker .mat-mdc-form-field-infix {
        border-top: 0 !important;
        padding: 0 !important;
    }
    /* Hide the standard Material field elements */
    ::ng-deep .role-badge-picker .mat-mdc-text-field-wrapper,
    ::ng-deep .role-badge-picker .mat-mdc-form-field-flex,
    ::ng-deep .role-badge-picker .mat-mdc-form-field-infix {
        background: transparent !important;
    }
    ::ng-deep .role-badge-picker .mdc-line-ripple {
        display: none !important;
    }
    ::ng-deep .role-select-panel .mat-mdc-option .mdc-list-item__primary-text {
        white-space: nowrap !important;
        overflow: visible !important;
        text-overflow: unset !important;
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
        const userPromises = users.map(user =>
          this.apiService.getGroups(undefined, user.name).toPromise().then(groups => ({
            ...user,
            groups: groups || []
          }))
        );

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
    return this.currentUser?.role === 'admin' || this.currentUser?.role === 'instructor';
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
      case 'instructor': return 'Преподаватель';
      case 'student': return 'Студент';
      default: return role;
    }
  }

  getRoleIcon(role: string): string {
    switch (role) {
      case 'admin': return 'admin_panel_settings';
      case 'instructor': return 'school';
      case 'student': return 'person';
      default: return 'help_outline';
    }
  }
}
