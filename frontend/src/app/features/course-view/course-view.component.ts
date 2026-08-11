import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTreeModule, MatTreeNestedDataSource } from '@angular/material/tree';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatListModule } from '@angular/material/list';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { NestedTreeControl } from '@angular/cdk/tree';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, combineLatest, filter } from 'rxjs';
import { CreateGroupDialogComponent } from '../groups/groups.component';
import { UploadMaterialDialogComponent } from './upload-material-dialog.component';
import { MaterialViewerComponent } from './material-viewer.component';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RussianDatePipe } from '../../core/pipes/russian-date.pipe';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface TreeNode {
  id: string;
  title: string;
  type: 'module' | 'lesson';
  lessonType?: string;
  orderIndex: number;
  children?: TreeNode[];
  moduleId?: string;
  content?: any;
  isCollapsed?: boolean;
}

@Component({
  selector: 'app-course-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTreeModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatTableModule,
    MatDialogModule,
    MatSelectModule,
    MatCheckboxModule,
    MatInputModule,
    MatListModule,
    FormsModule,
    ReactiveFormsModule,
    CreateGroupDialogComponent,
    UploadMaterialDialogComponent,
    MaterialViewerComponent,
    MatMenuModule,
    MatTooltipModule,
    RussianDatePipe,
    MatAutocompleteModule,
    MatSnackBarModule
  ],
  template: `
    <div class="course-hub-container">
      <div class="course-header" *ngIf="!loading" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #dadce0; background: white; padding: 12px 24px; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 400; color: #1e88e5;">{{ courseName }}</h1>
          <!-- Small red pulse/dot indicator if stream is live -->
          <div *ngIf="isStreamActive" class="live-pulse-dot" matTooltip="Трансляция в эфире!" style="width: 10px; height: 10px; border-radius: 50%; background-color: #d32f2f; box-shadow: 0 0 0 0 rgba(211, 47, 47, 0.7); animation: pulse 1.2s infinite; margin-left: 8px;"></div>
        </div>
        <div class="header-actions" style="display: flex; align-items: center; gap: 12px;">
          <ng-container *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin'">
            <button mat-stroked-button (click)="copyCourseInviteLink()" style="height: 36px;">
              🔗 Приглашение на курс
            </button>
            <button mat-stroked-button [routerLink]="['/course-builder', subjectId]" style="height: 36px;">
              ⚙️ Конструктор курса
            </button>
            <button mat-stroked-button [routerLink]="['/ai-test']" [queryParams]="{ subjectId: subjectId }" style="height: 36px;">
              🤖 AI-тест
            </button>
            <button mat-raised-button color="warn" (click)="startStream()" style="height: 36px; display: flex; align-items: center; gap: 4px;">
              <mat-icon>videocam</mat-icon> Начать трансляцию
            </button>
          </ng-container>
        </div>
      </div>

      <mat-tab-group animationDuration="0ms" class="course-tabs" [selectedIndex]="0">
        <!-- Tab 1: Лента -->
        <mat-tab label="Лента">
          <div class="tab-content-container">
            <div class="course-banner-card">
              <div class="banner-overlay"></div>
              <div class="banner-content">
                <h1 class="banner-title">{{ courseName }}</h1>
                <p class="banner-description" *ngIf="courseDescription">{{ courseDescription }}</p>
                <div class="banner-meta">
                  <span *ngIf="courseTeachers.length > 0">
                    Преподаватель: <strong *ngFor="let t of courseTeachers; let last = last">{{ t.name }}{{ last ? '' : ', ' }}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div class="stream-layout">
              <!-- Left Column: Deadlines -->
              <div class="deadlines-sidebar">
                <mat-card class="sidebar-card">
                  <mat-card-header>
                    <mat-card-title>Предстоящие задания</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <div *ngIf="courseDeadlines.length === 0" class="no-deadlines">
                      Ура, заданий на этой неделе нет!
                    </div>
                    <div *ngIf="courseDeadlines.length > 0" class="deadlines-list">
                      <div *ngFor="let deadline of courseDeadlines" class="deadline-item" [class.overdue]="deadline.overdue" [class.finished]="deadline.finished">
                        <mat-icon [style.color]="deadline.finished ? '#43a047' : (deadline.overdue ? '#d32f2f' : '#5f6368')">
                          {{ deadline.finished ? 'check_circle' : 'event' }}
                        </mat-icon>
                        <div class="deadline-info">
                          <a [routerLink]="['/tests', deadline.id, 'take']" [queryParams]="{ source: 'courses' }" class="deadline-title">
                            {{ deadline.title }}
                          </a>
                          <div class="deadline-date">
                            Срок: {{ deadline.dueDate | date:'short' }}
                          </div>
                          <div *ngIf="deadline.overdue" class="deadline-status overdue-text">Просрочено</div>
                          <div *ngIf="deadline.finished" class="deadline-status finished-text">Сдано</div>
                        </div>
                      </div>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>

              <!-- Right Column: Compose Form & Feed -->
              <div class="stream-feed">
                <!-- Compose box for teachers/admins -->
                <mat-card class="compose-card" *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin'">
                  <mat-card-content>
                    <div class="compose-trigger" *ngIf="!showComposeForm" (click)="showComposeForm = true">
                      <img *ngIf="currentUser?.avatar_url" [src]="getAvatarUrl(currentUser.avatar_url)" (error)="currentUser.avatar_url = undefined" class="compose-avatar" />
                      <div *ngIf="!currentUser?.avatar_url" class="compose-avatar-placeholder">
                        <mat-icon>person</mat-icon>
                      </div>
                      <span class="placeholder-text">Поделитесь чем-нибудь с классом...</span>
                    </div>
                    
                    <form [formGroup]="announcementForm" (ngSubmit)="postAnnouncement()" *ngIf="showComposeForm" class="compose-form">
                      <mat-form-field appearance="outline" class="full-width">
                        <mat-label>Тема объявления</mat-label>
                        <input matInput formControlName="title" placeholder="Тема..." />
                      </mat-form-field>
                      
                      <mat-form-field appearance="outline" class="full-width">
                        <mat-label>Текст объявления</mat-label>
                        <textarea matInput formControlName="content" rows="4" placeholder="Напишите здесь ваше сообщение..."></textarea>
                      </mat-form-field>
                      
                      <div class="compose-actions">
                        <button mat-button type="button" (click)="showComposeForm = false; announcementForm.reset()">Отмена</button>
                        <button mat-raised-button color="primary" type="submit" [disabled]="announcementForm.invalid || saving">
                          Опубликовать
                        </button>
                      </div>
                    </form>
                  </mat-card-content>
                </mat-card>

                <!-- Announcements Feed -->
                <div class="announcements-feed">
                  <!-- Bright LIVE card for students when stream is active -->
                  <mat-card *ngIf="isStreamActive && currentUser?.role === 'student'" class="live-stream-card" style="background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%); color: white; margin-bottom: 24px; border-radius: 12px; box-shadow: 0 4px 15px rgba(255, 75, 43, 0.4); overflow: hidden; position: relative;">
                    <div style="position: absolute; top: -20px; right: -20px; font-size: 100px; opacity: 0.15; pointer-events: none;">
                      <mat-icon style="font-size: 100px; width: 100px; height: 100px; color: white;">live_tv</mat-icon>
                    </div>
                    <mat-card-content style="padding: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
                      <div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                          <span style="background: white; color: #ff4b2b; font-weight: bold; font-size: 11px; padding: 2px 8px; border-radius: 4px; letter-spacing: 1px;">ЭФИР</span>
                          <div class="live-pulse-dot" style="width: 8px; height: 8px; border-radius: 50%; background-color: white; box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); animation: pulse-white 1.2s infinite; display: inline-block;"></div>
                        </div>
                        <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 500; color: white; border: none;">Трансляция уже началась!</h2>
                        <p style="margin: 0; font-size: 14px; opacity: 0.9;">Присоединяйтесь к онлайн-уроку прямо сейчас.</p>
                      </div>
                      <button mat-raised-button [routerLink]="['/courses', subjectId, 'stream']" style="background: white; color: #ff4b2b; font-weight: 600; padding: 8px 24px;">
                        Войти в класс
                      </button>
                    </mat-card-content>
                  </mat-card>

                  <div *ngIf="courseAnnouncements.length === 0 && !isStreamActive" class="no-announcements">
                    <mat-icon class="feed-empty-icon">chat_bubble_outline</mat-icon>
                    <p>Здесь пока ничего нет. Объявления появятся в этой ленте.</p>
                  </div>
                  <mat-card *ngFor="let announcement of courseAnnouncements" class="announcement-card">
                    <mat-card-header class="announcement-header">
                      <img mat-card-avatar *ngIf="announcement.author_avatar" [src]="getAvatarUrl(announcement.author_avatar)" (error)="announcement.author_avatar = undefined" class="author-avatar" />
                      <div *ngIf="!announcement.author_avatar" class="author-avatar-placeholder" mat-card-avatar>
                        <mat-icon>person</mat-icon>
                      </div>
                      <div class="announcement-meta-container">
                        <mat-card-title class="announcement-author">
                          {{ announcement.author_name || 'Преподаватель' }}
                        </mat-card-title>
                        <mat-card-subtitle class="announcement-date">
                          {{ announcement.created_at | russianDate }}
                        </mat-card-subtitle>
                      </div>
                      <span class="spacer"></span>
                      <button mat-icon-button [matMenuTriggerFor]="announcementMenu" *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin'">
                        <mat-icon>more_vert</mat-icon>
                      </button>
                      <mat-menu #announcementMenu="matMenu">
                        <button mat-menu-item (click)="deleteAnnouncement(announcement.id)">
                          <mat-icon>delete</mat-icon>
                          <span>Удалить</span>
                        </button>
                      </mat-menu>
                    </mat-card-header>
                    <mat-card-content class="announcement-body">
                      <h3 class="announcement-title-text">{{ announcement.title }}</h3>
                      <div [innerHTML]="announcement.content" class="announcement-content-text"></div>
                      <div *ngIf="announcement.image_url" class="announcement-image-container">
                        <img [src]="announcement.image_url" class="announcement-image" />
                      </div>
                    </mat-card-content>
                  </mat-card>
                </div>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Tab 2: Задания -->
        <mat-tab label="Задания">
          <!-- Classwork List (viewingLessonMode === false) -->
          <div class="tab-content-container" *ngIf="!viewingLessonMode">
            <div class="classwork-header-bar">
              <h2>Задания и Материалы курса</h2>
              <div class="actions" *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin'">
                <button mat-raised-button color="primary" (click)="openCreateTest()">
                  <mat-icon>quiz</mat-icon> Создать тест
                </button>
                <button mat-raised-button color="accent" (click)="openUploadMaterial()">
                  <mat-icon>upload_file</mat-icon> Загрузить материал
                </button>
              </div>
            </div>

            <!-- Progress Bar for Students -->
            <div class="student-progress-container" *ngIf="currentUser?.role === 'student'" style="margin-bottom: 24px; background: white; padding: 16px; border-radius: 8px; border: 1px solid #dadce0;">
              <div class="progress-label" style="display: flex; justify-content: space-between; font-weight: 500; font-size: 14px; margin-bottom: 8px;">
                <span>Пройдено {{ completedLessonsCount }} из {{ totalLessonsCount }} уроков</span>
                <span>{{ totalLessonsCount > 0 ? mathRound((completedLessonsCount / totalLessonsCount) * 100) : 0 }}%</span>
              </div>
              <div class="progress-bar-bg" style="background: #e0e0e0; height: 8px; border-radius: 4px; overflow: hidden; position: relative;">
                <div class="progress-bar-fill" [style.width.%]="totalLessonsCount > 0 ? (completedLessonsCount / totalLessonsCount) * 100 : 0" style="background: #4caf50; height: 100%; transition: width 0.3s ease;"></div>
              </div>
            </div>

            <!-- Modules Accordion -->
            <mat-accordion multi="true" class="modules-accordion">
              <mat-expansion-panel *ngFor="let module of dataSource.data" [expanded]="true" class="module-panel">
                <mat-expansion-panel-header>
                  <mat-panel-title>
                    <span class="module-panel-title">{{ module.title }}</span>
                  </mat-panel-title>
                </mat-expansion-panel-header>

                <div class="lessons-list">
                  <div *ngFor="let lesson of module.children" class="lesson-row" (click)="selectLessonFromOutline(lesson)">
                    <mat-icon class="lesson-type-icon" [style.color]="getLessonIconColor(lesson)">
                      {{ getLessonTypeIcon(lesson.lessonType) }}
                    </mat-icon>
                    <span class="lesson-row-title">{{ lesson.title }}</span>
                    <span class="spacer"></span>
                    
                    <!-- Status Badge -->
                    <span class="status-badge" [ngClass]="getLessonStatusClass(lesson)">
                      {{ getLessonStatusText(lesson) }}
                    </span>

                    <!-- Deadline Badge -->
                    <span class="deadline-badge-item" *ngIf="getLessonDeadline(lesson)">
                      Срок: {{ getLessonDeadline(lesson) | date:'short' }}
                    </span>
                  </div>
                  <div *ngIf="!module.children || module.children.length === 0" class="no-lessons">
                    В этом модуле нет уроков.
                  </div>
                </div>
              </mat-expansion-panel>
            </mat-accordion>

            <!-- Management Section for Teachers -->
            <div class="teacher-management-section" *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin'">
              <div class="section-title">
                <h3>Панель управления (Все материалы и тесты)</h3>
              </div>
              <div class="assignments-list">
                <div class="list-section">
                    <h3>Тесты</h3>
                    <div *ngIf="visibleTests.length === 0" class="empty-list">Нет тестов</div>
                    <mat-card *ngFor="let test of visibleTests" class="item-card">
                        <mat-card-content class="item-content">
                            <div class="item-info">
                                <div class="item-title-row">
                                    <mat-icon class="item-icon">quiz</mat-icon>
                                    <span class="item-title">{{ test.title }}</span>
                                </div>
                                <div class="item-meta">
                                    <span class="meta-label">Доступ:</span> {{ getGroupNames(test.allowed_groups) }}
                                    <span *ngIf="test.due_date" class="meta-separator">•</span>
                                    <span *ngIf="test.due_date">Дедлайн: {{ test.due_date | date:'short' }}</span>
                                </div>
                            </div>
                            <div class="item-actions" style="display: flex; align-items: center; gap: 16px;">
                                <mat-checkbox [checked]="test.peer_review_enabled === 'true'" (change)="togglePeerReview(test, $event.checked)">
                                    Включить кросс-проверку
                                </mat-checkbox>
                                <button mat-icon-button color="warn" (click)="deleteTest(test.id)">
                                    <mat-icon>delete</mat-icon>
                                </button>
                            </div>
                        </mat-card-content>
                    </mat-card>
                </div>

                <div class="list-section">
                    <h3>Материалы</h3>
                    <div *ngIf="visibleMaterials.length === 0" class="empty-list">Нет материалов</div>
                    <mat-card *ngFor="let material of visibleMaterials" class="item-card">
                         <mat-card-content class="item-content">
                            <div class="item-info">
                                <div class="item-title-row">
                                    <mat-icon class="item-icon">description</mat-icon>
                                    <span class="item-title">{{ material.original_name || material.name }}</span>
                                </div>
                                <div class="item-meta">
                                    <span class="meta-label">Доступ:</span> {{ getGroupNames(material.allowed_groups) }}
                                    <span class="meta-separator">•</span>
                                    <span>{{ material.note || 'Без описания' }}</span>
                                </div>
                            </div>
                            <div class="item-actions">
                                <button mat-button color="primary" (click)="downloadMaterial(material.id)">Скачать</button>
                                <button mat-icon-button color="warn" (click)="deleteMaterial(material.id)">
                                    <mat-icon>delete</mat-icon>
                                </button>
                            </div>
                         </mat-card-content>
                    </mat-card>
                </div>
              </div>
            </div>
          </div>

          <!-- Lesson Viewer split layout (viewingLessonMode === true) -->
          <div class="lesson-viewer-container" *ngIf="viewingLessonMode">
            <div class="viewer-header">
              <button mat-button color="primary" (click)="viewingLessonMode = false" class="back-btn">
                <mat-icon>arrow_back</mat-icon>
                Вернуться к заданиям
              </button>
            </div>
            
            <div class="course-layout">
              <!-- Left Sidebar: Contents -->
              <div class="sidebar">
                <div class="sidebar-header">
                  <h2>Содержание</h2>
                </div>
                <div class="sidebar-content">
                  <mat-tree [dataSource]="dataSource" [treeControl]="treeControl" class="nav-tree">
                    <!-- Lesson Node (Leaf) -->
                    <mat-tree-node *matTreeNodeDef="let node" matTreeNodePadding>
                      <button mat-button class="nav-item-btn" [class.active]="selectedLesson?.id === node.id" (click)="selectLesson(node)">
                        <span class="tree-indicator"></span>
                        <span class="nav-text">{{ node.title }}</span>
                      </button>
                    </mat-tree-node>

                    <!-- Module Node (Parent) -->
                    <mat-nested-tree-node *matTreeNodeDef="let node; when: hasChild" matTreeNodePadding>
                      <div class="module-group">
                        <button mat-icon-button matTreeNodeToggle [attr.aria-label]="'Toggle ' + node.title">
                          <mat-icon class="mat-icon-rtl-mirror">
                            {{ treeControl.isExpanded(node) ? 'expand_more' : 'chevron_right' }}
                          </mat-icon>
                        </button>
                        <span class="module-title">{{ node.title }}</span>
                      </div>
                      <div [class.example-tree-invisible]="!treeControl.isExpanded(node)" role="group">
                        <ng-container matTreeNodeOutlet></ng-container>
                      </div>
                    </mat-nested-tree-node>
                  </mat-tree>
                </div>
              </div>

              <!-- Right Content Area -->
              <div class="main-content">
                <!-- Breadcrumbs -->
                 <div class="breadcrumbs" *ngIf="selectedLesson">
                    <span>{{ courseName }}</span>
                    <mat-icon class="separator">chevron_right</mat-icon>
                    <span>{{ lessonMetadata.moduleName }}</span>
                    <mat-icon class="separator">chevron_right</mat-icon>
                    <span class="current">{{ selectedLesson.title }}</span>
                 </div>

                <div *ngIf="loading" class="loading-container">
                  <mat-spinner diameter="40"></mat-spinner>
                </div>

                <div *ngIf="!loading && selectedLesson" class="content-area">
                  <div class="lesson-header">
                    <div class="header-icon">
                       <mat-icon>menu_book</mat-icon>
                    </div>
                    <div class="header-text">
                       <h1>Учебник</h1>
                       <div class="lesson-title">{{ selectedLesson.title }}</div>
                    </div>
                    <span class="spacer"></span>
                    <button mat-raised-button color="warn" *ngIf="isStreamActive" [routerLink]="['/courses', subjectId, 'stream']" class="live-btn">
                      <mat-icon>videocam</mat-icon>
                      В ЭФИРЕ
                    </button>
                  </div>

                  <div class="content-body">
                      <!-- Text content -->
                      <div *ngIf="selectedLesson.content?.text_content" class="text-content">
                        <div [innerHTML]="selectedLesson.content.text_content"></div>
                      </div>

                      <!-- Video content -->
                      <div *ngIf="selectedLesson.content?.video_url" class="video-section">
                        <h3>Видеоматериал</h3>
                        <div class="video-container" style="position: relative;">
                          <!-- Video overlay for students to track play click -->
                          <div *ngIf="!isVideoStarted && currentUser?.role === 'student'" class="video-overlay" (click)="startVideo()">
                            <mat-icon style="font-size: 64px; width: 64px; height: 64px; color: white; margin: 0;">play_circle_filled</mat-icon>
                            <span style="color: white; font-weight: 500; font-size: 16px; margin-top: 8px;">Нажмите для просмотра видео-урока</span>
                          </div>

                          <iframe
                            *ngIf="safeVideoUrl && (isVideoStarted || currentUser?.role !== 'student')"
                            [src]="safeVideoUrl"
                            frameborder="0"
                            loading="lazy"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen
                            class="video-iframe">
                          </iframe>
                        </div>
                      </div>

                       <!-- Material link -->
                      <ng-container *ngIf="selectedLesson.content?.material_id">
                          <div *ngIf="lessonMetadata.materialAllowed" class="resource-card">
                            <mat-icon class="resource-icon">description</mat-icon>
                            <div class="resource-info">
                               <div class="resource-title">
                                 {{ lessonMetadata.materialName }}
                               </div>
                               <div class="resource-actions">
                                 <button mat-button color="primary" (click)="viewMaterial(selectedLesson.content.material_id)">
                                   <mat-icon>visibility</mat-icon> Просмотр
                                 </button>
                                 <button mat-button (click)="downloadMaterial(selectedLesson.content.material_id)">
                                   <mat-icon>download</mat-icon>
                                 </button>
                                 <button mat-stroked-button color="accent" *ngIf="lessonMetadata.isLatex" (click)="viewMaterialAs(selectedLesson.content.material_id, 'pdf')">
                                   <mat-icon>picture_as_pdf</mat-icon> PDF
                                 </button>
                                 <button mat-stroked-button color="accent" *ngIf="lessonMetadata.isJupyter" (click)="viewMaterialAs(selectedLesson.content.material_id, 'html')">
                                   <mat-icon>html</mat-icon> HTML
                                 </button>
                               </div>
                            </div>
                          </div>
                          <div *ngIf="!lessonMetadata.materialAllowed" class="resource-card locked">
                              <mat-icon class="resource-icon">lock</mat-icon>
                              <div class="resource-info">
                                  <div class="resource-title">Материал недоступен для вашей группы</div>
                              </div>
                          </div>
                      </ng-container>

                      <!-- Test link -->
                      <ng-container *ngIf="selectedLesson.content?.test_id">
                          <div *ngIf="lessonMetadata.testAllowed" class="resource-card test-card">
                            <mat-icon class="resource-icon">quiz</mat-icon>
                             <div class="resource-info">
                                <div class="resource-title">Проверочное тестирование</div>
                                <div class="test-action-buttons" style="display: flex; gap: 8px;">
                                  <button mat-raised-button color="primary" [routerLink]="['/tests', selectedLesson.content.test_id, 'take']" [queryParams]="{ source: 'courses' }">
                                    Начать тест
                                  </button>
                                  <button mat-stroked-button color="accent" *ngIf="isPeerReviewEnabledForTest(selectedLesson.content.test_id)" (click)="openPeerReviewDialog(selectedLesson.content.test_id)">
                                    <mat-icon>rate_review</mat-icon> Кросс-проверка
                                  </button>
                                </div>
                             </div>
                          </div>
                          <div *ngIf="!lessonMetadata.testAllowed" class="resource-card locked">
                              <mat-icon class="resource-icon">lock</mat-icon>
                              <div class="resource-info">
                                  <div class="resource-title">Тест недоступен для вашей группы</div>
                              </div>
                          </div>
                      </ng-container>

                      <div *ngIf="!selectedLesson.content || (!selectedLesson.content.text_content && !selectedLesson.content.video_url && !selectedLesson.content.material_id && !selectedLesson.content.test_id)" class="empty-content">
                        <p>Содержимое урока пока не добавлено.</p>
                      </div>

                      <!-- Text study confirmation button for students -->
                      <div *ngIf="selectedLesson.content?.text_content && !selectedLesson.content?.video_url && !selectedLesson.content?.material_id && currentUser?.role === 'student'" 
                           style="margin-top: 24px; display: flex; justify-content: center;">
                        <button mat-raised-button 
                                [color]="isLessonViewed(selectedLesson.id) ? 'accent' : 'primary'"
                                [disabled]="isLessonViewed(selectedLesson.id)"
                                (click)="triggerLessonViewed()">
                          <mat-icon>{{ isLessonViewed(selectedLesson.id) ? 'check_circle' : 'assignment_turned_in' }}</mat-icon>
                          {{ isLessonViewed(selectedLesson.id) ? 'Материал изучен' : 'Я изучил этот материал' }}
                        </button>
                      </div>

                      <!-- Lesson Navigation Buttons -->
                      <div class="lesson-navigation-buttons" style="display: flex; justify-content: space-between; margin-top: 32px; border-top: 1px solid #dadce0; padding-top: 16px;">
                        <button mat-button color="primary" [disabled]="!previousLesson" (click)="previousLesson && navigateToLesson(previousLesson)" style="display: flex; align-items: center; gap: 4px;">
                          <mat-icon>navigate_before</mat-icon> Предыдущий урок
                        </button>
                        <button mat-button color="primary" [disabled]="!nextLesson" (click)="nextLesson && navigateToLesson(nextLesson)" style="display: flex; align-items: center; gap: 4px;">
                          Следующий урок <mat-icon>navigate_next</mat-icon>
                        </button>
                      </div>
                  </div>
                </div>

                <div *ngIf="!loading && !selectedLesson" class="select-hint">
                  <mat-icon>touch_app</mat-icon>
                  <p>Выберите главу из содержания, чтобы начать обучение</p>
                </div>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Tab 3: Участники -->
        <mat-tab label="Участники">
          <div class="tab-content-container">
            <div class="people-tab-container">
              <!-- Teachers Section -->
              <div class="people-section">
                <div class="people-section-header">
                  <h2>Преподаватели</h2>
                  <span class="people-count">{{ courseTeachers.length }}</span>
                </div>
                <!-- Assign Teacher Form -->
                <div class="add-teacher-form-wrapper" *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin'">
                  <form [formGroup]="addTeacherForm" (ngSubmit)="assignTeacher()" class="add-teacher-form">
                    <mat-form-field appearance="outline" class="small-input" style="margin-bottom: 0;">
                      <mat-label>Имя пользователя преподавателя</mat-label>
                      <input matInput formControlName="username" placeholder="Имя пользователя..." [matAutocomplete]="auto" />
                      <mat-autocomplete #auto="matAutocomplete">
                        <mat-option *ngFor="let user of suggestedTeachers" [value]="user.name">
                          {{ user.name }}
                        </mat-option>
                      </mat-autocomplete>
                    </mat-form-field>
                    <button mat-raised-button color="primary" type="submit" [disabled]="addTeacherForm.invalid">
                      Назначить
                    </button>
                  </form>
                </div>
                <div class="people-list">
                  <div *ngFor="let teacher of courseTeachers" class="person-row">
                    <div class="person-info">
                      <img *ngIf="teacher.avatar_url" [src]="getAvatarUrl(teacher.avatar_url)" (error)="teacher.avatar_url = undefined" class="person-avatar" />
                      <div *ngIf="!teacher.avatar_url" class="person-avatar-placeholder">
                        <mat-icon>person</mat-icon>
                      </div>
                      <span class="person-name">{{ teacher.name }}</span>
                    </div>
                    <div class="person-actions">
                      <button mat-icon-button (click)="startChatWith(teacher.name)" title="Начать чат" *ngIf="teacher.name !== currentUser?.name">
                        <mat-icon>chat</mat-icon>
                      </button>
                      <button mat-icon-button color="warn" *ngIf="(currentUser?.role === 'teacher' || currentUser?.role === 'admin') && teacher.name !== currentUser.name" (click)="removeTeacher(teacher.name)" title="Удалить преподавателя">
                        <mat-icon>person_remove</mat-icon>
                      </button>
                    </div>
                  </div>
                  <div *ngIf="courseTeachers.length === 0" class="empty-people">
                    Нет назначенных преподавателей.
                  </div>
                </div>
              </div>

              <!-- Students Section -->
              <div class="people-section">
                <div class="people-section-header">
                  <h2>Учащиеся</h2>
                  <span class="people-count">{{ courseStudents.length }}</span>
                </div>
                <div class="people-list">
                  <div *ngFor="let student of courseStudents" class="person-row" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-bottom: 1px solid #f1f3f4;">
                    <div class="person-info" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                      <img *ngIf="student.avatar_url" [src]="getAvatarUrl(student.avatar_url)" (error)="student.avatar_url = undefined" class="person-avatar" />
                      <div *ngIf="!student.avatar_url" class="person-avatar-placeholder">
                        <mat-icon>person</mat-icon>
                      </div>
                      <span class="person-name" style="font-weight: 500;">{{ student.name }}</span>
                      
                      <!-- Group status for non-teachers -->
                      <span *ngIf="!(currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin')" 
                            style="font-size: 13px; color: #5f6368; background-color: #f1f3f4; padding: 2px 8px; border-radius: 12px; margin-left: 12px;">
                        Группа: {{ (studentGroupMappings && studentGroupMappings[student.name]) ? studentGroupMappings[student.name].group_name : 'Без группы' }}
                      </span>
                      
                      <!-- Teacher group assignment dropdown -->
                      <div *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin'" 
                           style="margin-left: 12px; display: flex; align-items: center; gap: 4px;">
                        <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width: 160px; font-size: 13px;">
                          <mat-select [value]="(studentGroupMappings && studentGroupMappings[student.name]) ? studentGroupMappings[student.name].group_id : ''" 
                                      (selectionChange)="onGroupSelectedForStudent(student.name, $event.value)"
                                      placeholder="Без группы">
                            <mat-option value="">Без группы</mat-option>
                            <mat-option *ngFor="let g of groups" [value]="g.id">{{ g.name }}</mat-option>
                          </mat-select>
                        </mat-form-field>
                      </div>
                    </div>
                    <div class="person-actions">
                      <button mat-icon-button (click)="startChatWith(student.name)" title="Начать чат" *ngIf="student.name !== currentUser?.name">
                        <mat-icon>chat</mat-icon>
                      </button>
                    </div>
                  </div>
                  <div *ngIf="courseStudents.length === 0" class="empty-people">
                    Нет учащихся на данном курсе.
                  </div>
                </div>
              </div>

              <!-- Groups Section -->
              <div class="people-section groups-section-wrapper">
                <div class="people-section-header">
                  <h2>Группы курса</h2>
                  <button mat-raised-button color="primary" (click)="createGroup()" *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin'">
                    <mat-icon>group_add</mat-icon> Создать группу
                  </button>
                </div>
                
                <div class="list-section" *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin'">
                    <p class="section-hint">Управляйте участниками и заявками на странице каждой группы.</p>
                </div>
                
                <div class="groups-list">
                    <div *ngIf="groups.length === 0" class="empty-list">Нет доступных групп</div>
                    <mat-card *ngFor="let group of groups" class="item-card">
                         <mat-card-content class="item-content">
                            <div class="item-info">
                                <div class="item-title-row">
                                    <mat-icon class="item-icon">group</mat-icon>
                                    <span class="item-title">{{ group.name }}</span>
                                </div>
                                <div class="item-meta">
                                    <span>Участников: {{ group.member_count || 0 }}</span>
                                    <span class="meta-separator">•</span>
                                    <span>{{ group.description || 'Без описания' }}</span>
                                </div>
                            </div>
                            <div class="item-actions">
                                <!-- Teacher actions -->
                                <div *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin'" class="teacher-btns">
                                    <button mat-stroked-button color="primary" (click)="copyInviteLink(group)" style="height: 40px; margin-right: 8px;">
                                        <mat-icon>share</mat-icon> Ссылка для приглашения
                                    </button>
                                    <button mat-icon-button color="primary" (click)="navigateToGroup(group.id)" matTooltip="Управление">
                                        <mat-icon>settings</mat-icon>
                                    </button>
                                    <button mat-icon-button color="warn" (click)="deleteGroup(group.id)">
                                        <mat-icon>delete</mat-icon>
                                    </button>
                                </div>
                                
                                <!-- Student actions -->
                                <div *ngIf="currentUser?.role === 'student'">
                                    <span *ngIf="isGroupMember(group.id)" class="status-badge member">Вы участник</span>
                                    <span *ngIf="!isGroupMember(group.id) && hasPendingRequest(group.id)" class="status-badge pending">Заявка отправлена</span>
                                    <button mat-raised-button color="primary" *ngIf="!isGroupMember(group.id) && !hasPendingRequest(group.id)" (click)="joinGroup(group.id)">
                                        Вступить
                                    </button>
                                </div>
                            </div>
                         </mat-card-content>
                    </mat-card>
                </div>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Tab 4: Проверка работ -->
        <mat-tab *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin'">
          <ng-template mat-tab-label>
            <span>Проверка работ</span>
            <span class="pending-badge" *ngIf="pendingSubmissionsCount > 0" style="background: #d32f2f; color: white; border-radius: 10px; padding: 2px 8px; font-size: 11px; margin-left: 8px; font-weight: bold;">
              {{ pendingSubmissionsCount }}
            </span>
          </ng-template>

          <div class="tab-content-container">
            <div class="submissions-grading-header" style="display: flex; gap: 16px; margin-bottom: 24px; align-items: center; flex-wrap: wrap;">
              <mat-form-field appearance="outline" style="flex: 1; min-width: 200px; margin-bottom: 0;">
                <mat-label>Поиск по тесту</mat-label>
                <input matInput [(ngModel)]="submissionFilterTest" (ngModelChange)="applySubmissionFilters()" placeholder="Название теста..." />
              </mat-form-field>

              <mat-form-field appearance="outline" style="flex: 1; min-width: 150px; margin-bottom: 0;">
                <mat-label>Статус</mat-label>
                <mat-select [(ngModel)]="submissionFilterStatus" (selectionChange)="applySubmissionFilters()">
                  <mat-option value="">Все статусы</mat-option>
                  <mat-option value="pending">Ожидает проверки</mat-option>
                  <mat-option value="approved">Одобрено</mat-option>
                  <mat-option value="rejected">Отклонено</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" style="flex: 1; min-width: 200px; margin-bottom: 0;">
                <mat-label>Поиск по ученику</mat-label>
                <input matInput [(ngModel)]="submissionFilterStudent" (ngModelChange)="applySubmissionFilters()" placeholder="Имя ученика..." />
              </mat-form-field>
            </div>

            <!-- Submissions Table -->
            <div class="submissions-table-container" style="background: white; border-radius: 8px; border: 1px solid #dadce0; overflow: hidden;">
              <table mat-table [dataSource]="filteredSubmissions" class="submissions-table" style="width: 100%;">
                
                <!-- Student Column -->
                <ng-container matColumnDef="student">
                  <th mat-header-cell *matHeaderCellDef style="padding: 16px; text-align: left;"> Ученик </th>
                  <td mat-cell *matCellDef="let s" style="padding: 16px; text-align: left;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <img *ngIf="s.user_avatar" [src]="getAvatarUrl(s.user_avatar)" class="person-avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" (error)="s.user_avatar = undefined" />
                      <div *ngIf="!s.user_avatar" class="person-avatar-placeholder" style="width: 32px; height: 32px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <mat-icon style="font-size: 18px; width: 18px; height: 18px; line-height: 18px; margin: 0;">person</mat-icon>
                      </div>
                      <span style="font-weight: 500;">{{ s.user_name }}</span>
                    </div>
                  </td>
                </ng-container>

                <!-- Test Title Column -->
                <ng-container matColumnDef="testTitle">
                  <th mat-header-cell *matHeaderCellDef style="padding: 16px; text-align: left;"> Тест </th>
                  <td mat-cell *matCellDef="let s" style="padding: 16px; text-align: left;">
                    {{ getTestTitle(s.test_id) }}
                  </td>
                </ng-container>

                <!-- Submission Date Column -->
                <ng-container matColumnDef="date">
                  <th mat-header-cell *matHeaderCellDef style="padding: 16px; text-align: left;"> Дата сдачи </th>
                  <td mat-cell *matCellDef="let s" style="padding: 16px; text-align: left;">
                    {{ s.finished_at | date:'short' }}
                  </td>
                </ng-container>

                <!-- Score Column -->
                <ng-container matColumnDef="score">
                  <th mat-header-cell *matHeaderCellDef style="padding: 16px; text-align: left;"> Балл </th>
                  <td mat-cell *matCellDef="let s" style="padding: 16px; text-align: left; font-weight: 600;">
                    {{ s.total_score !== undefined && s.total_score !== null ? s.total_score : '—' }}
                  </td>
                </ng-container>

                <!-- Status Column -->
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef style="padding: 16px; text-align: left;"> Статус </th>
                  <td mat-cell *matCellDef="let s" style="padding: 16px; text-align: left;">
                    <span class="status-badge" [ngClass]="getSubmissionStatusClass(s.status)">
                      {{ getSubmissionStatusText(s.status) }}
                    </span>
                  </td>
                </ng-container>

                <!-- Action Column -->
                <ng-container matColumnDef="action">
                  <th mat-header-cell *matHeaderCellDef style="padding: 16px; text-align: left;"> Действие </th>
                  <td mat-cell *matCellDef="let s" style="padding: 16px; text-align: left;">
                    <button mat-raised-button color="primary" [routerLink]="['/submissions', s.id]" [queryParams]="{ returnTo: 'course', subjectId: subjectId }">
                      Проверить
                    </button>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="['student', 'testTitle', 'date', 'score', 'status', 'action']"></tr>
                <tr mat-row *matRowDef="let row; columns: ['student', 'testTitle', 'date', 'score', 'status', 'action'];"></tr>
              </table>

              <div *ngIf="filteredSubmissions.length === 0" style="padding: 32px; text-align: center; color: #5f6368; font-style: italic;">
                Нет сданных работ, соответствующих фильтрам.
              </div>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .course-hub-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background-color: #f8f9fa;
      color: #3c4043;
      font-family: Roboto, Arial, sans-serif;
    }

    .course-header {
      background: white;
      padding: 12px 24px;
      border-bottom: 1px solid #dadce0;
      flex-shrink: 0;
    }

    .course-header h1 {
        margin: 0;
        font-size: 22px;
        font-weight: 400;
        color: #1e88e5;
    }

    ::ng-deep .course-tabs .mat-mdc-tab-body-wrapper {
        flex: 1; 
        height: 100%;
        background-color: #f8f9fa;
    }
    
    ::ng-deep .course-tabs {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    ::ng-deep .course-tabs .mat-mdc-tab-header {
        background-color: white;
        border-bottom: 1px solid #dadce0;
    }

    ::ng-deep .course-tabs .mdc-tab__text-label {
        font-weight: 500;
        font-size: 14px;
        letter-spacing: 0.25px;
    }

    .tab-content-container {
        padding: 24px;
        max-width: 1000px;
        margin: 0 auto;
        width: 100%;
        box-sizing: border-box;
        overflow-y: auto;
        height: 100%;
    }

    /* Course Banner */
    .course-banner-card {
      position: relative;
      background: linear-gradient(90deg, #1e3c72 0%, #2a5298 100%);
      color: white;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 2px 0 rgba(60,64,67,0.3), 0 2px 6px 2px rgba(60,64,67,0.15);
      overflow: hidden;
    }

    .banner-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.05)" stroke-width="2" fill="none"/></svg>') repeat;
      opacity: 0.3;
    }

    .banner-content {
      position: relative;
      z-index: 1;
    }

    .banner-title {
      font-size: 32px;
      font-weight: 500;
      margin: 0 0 8px 0;
      line-height: 1.2;
    }

    .banner-description {
      font-size: 16px;
      opacity: 0.9;
      margin: 0 0 16px 0;
    }

    .banner-meta {
      font-size: 14px;
      opacity: 0.8;
    }

    /* Stream Layout */
    .stream-layout {
      display: flex;
      gap: 24px;
      align-items: flex-start;
    }

    .deadlines-sidebar {
      width: 280px;
      flex-shrink: 0;
    }

    .sidebar-card {
      border: 1px solid #dadce0;
      border-radius: 8px;
      box-shadow: none !important;
      background: white;
    }

    .sidebar-card mat-card-title {
      font-size: 14px;
      font-weight: 500;
      color: #3c4043;
      margin: 16px 16px 8px 16px;
    }

    .no-deadlines {
      padding: 16px;
      color: #5f6368;
      font-size: 13px;
    }

    .deadlines-list {
      padding: 8px 16px 16px 16px;
    }

    .deadline-item {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }

    .deadline-item:last-child {
      margin-bottom: 0;
    }

    .deadline-info {
      display: flex;
      flex-direction: column;
    }

    .deadline-title {
      font-size: 14px;
      color: #1a73e8;
      text-decoration: none;
      font-weight: 500;
    }

    .deadline-title:hover {
      text-decoration: underline;
    }

    .deadline-date {
      font-size: 12px;
      color: #5f6368;
      margin-top: 2px;
    }

    .deadline-status {
      font-size: 11px;
      font-weight: 500;
      margin-top: 4px;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-block;
      width: fit-content;
    }

    .overdue-text {
      background-color: #fce8e6;
      color: #c5221f;
    }

    .finished-text {
      background-color: #e6f4ea;
      color: #137333;
    }

    .stream-feed {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Compose Card */
    .compose-card {
      border: 1px solid #dadce0;
      border-radius: 8px;
      box-shadow: 0 1px 2px 0 rgba(60,64,67,0.3) !important;
      background: white;
      margin-bottom: 8px;
    }

    .compose-trigger {
      display: flex;
      align-items: center;
      gap: 16px;
      cursor: pointer;
      padding: 8px 0;
    }

    .compose-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
    }

    .placeholder-text {
      color: #5f6368;
      font-size: 14px;
    }

    .compose-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 8px 0;
    }

    .compose-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    /* Announcements Feed */
    .announcements-feed {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .no-announcements {
      text-align: center;
      padding: 48px;
      background: white;
      border-radius: 8px;
      border: 1px solid #dadce0;
      color: #5f6368;
    }

    .feed-empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      color: #dadce0;
    }

    .announcement-card {
      border: 1px solid #dadce0;
      border-radius: 8px;
      box-shadow: 0 1px 2px 0 rgba(60,64,67,0.3) !important;
      background: white;
    }

    .announcement-header {
      display: flex;
      align-items: center;
      padding: 16px 16px 8px 16px !important;
    }

    .author-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
    }

    .announcement-meta-container {
      display: flex;
      flex-direction: column;
      margin-left: 12px;
    }

    .announcement-author {
      font-size: 14px;
      font-weight: 500;
      color: #3c4043;
    }

    .announcement-date {
      font-size: 12px;
      color: #5f6368;
    }

    .announcement-body {
      padding: 0 16px 16px 16px !important;
    }

    .announcement-title-text {
      font-size: 16px;
      font-weight: 500;
      color: #202124;
      margin: 8px 0;
    }

    .announcement-content-text {
      font-size: 14px;
      line-height: 1.5;
      color: #3c4043;
      white-space: pre-wrap;
    }

    .announcement-image-container {
      margin-top: 12px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #dadce0;
      max-height: 400px;
    }

    .announcement-image {
      width: 100%;
      height: auto;
      object-fit: cover;
    }

    /* Classwork Tab Styles */
    .classwork-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      border-bottom: 1px solid #dadce0;
      padding-bottom: 12px;
    }

    .classwork-header-bar h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 400;
      color: #3c4043;
    }

    .modules-accordion {
      box-shadow: none !important;
    }

    .module-panel {
      border: 1px solid #dadce0;
      border-radius: 8px !important;
      margin-bottom: 16px !important;
      box-shadow: none !important;
      overflow: hidden;
    }

    .module-panel-title {
      font-size: 18px;
      font-weight: 500;
      color: #1e88e5;
    }

    .lessons-list {
      display: flex;
      flex-direction: column;
    }

    .lesson-row {
      display: flex;
      align-items: center;
      padding: 14px 16px;
      border-top: 1px solid #dadce0;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .lesson-row:hover {
      background-color: #f1f3f4;
    }

    .lesson-type-icon {
      margin-right: 16px;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .lesson-row-title {
      font-size: 15px;
      font-weight: 500;
      color: #3c4043;
    }

    .status-badge {
      font-size: 12px;
      padding: 4px 12px;
      border-radius: 12px;
      font-weight: 500;
      margin-right: 12px;
    }

    .status-completed {
      background-color: #e6f4ea;
      color: #137333;
    }

    .status-progress {
      background-color: #e8f0fe;
      color: #1a73e8;
    }

    .status-not-started {
      background-color: #f1f3f4;
      color: #5f6368;
    }

    .deadline-badge-item {
      font-size: 12px;
      color: #5f6368;
      background: #f1f3f4;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #dadce0;
    }

    .no-lessons {
      padding: 16px;
      text-align: center;
      color: #5f6368;
      font-style: italic;
      border-top: 1px solid #dadce0;
    }

    /* Teacher Management Section */
    .teacher-management-section {
      margin-top: 40px;
      border-top: 2px dashed #dadce0;
      padding-top: 24px;
    }

    .teacher-management-section h3 {
      font-size: 18px;
      color: #3c4043;
      margin-top: 0;
      margin-bottom: 16px;
    }

    .assignments-list {
        display: flex;
        flex-direction: column;
        gap: 24px;
    }
    
    .list-section h3 {
        margin: 0 0 16px 0;
        font-size: 16px;
        color: #1e88e5;
        border-bottom: 2px solid #e8eaf6;
        padding-bottom: 8px;
    }
    
    .item-card {
        margin-bottom: 12px;
        border-left: 4px solid #1e88e5;
        border-right: 1px solid #dadce0;
        border-top: 1px solid #dadce0;
        border-bottom: 1px solid #dadce0;
        box-shadow: none !important;
        border-radius: 4px;
    }
    
    .item-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px !important;
    }
    
    .item-info {
        flex: 1;
    }
    
    .item-title-row {
        display: flex;
        align-items: center;
        margin-bottom: 4px;
    }
    
    .item-icon {
        margin-right: 8px;
        color: #1e88e5;
    }
    
    .item-title {
        font-weight: 500;
        font-size: 16px;
    }
    
    .item-meta {
        font-size: 13px;
        color: #666;
        margin-left: 32px; 
    }
    
    .meta-label {
        font-weight: 500;
        color: #333;
    }
    
    .meta-separator {
        margin: 0 8px;
        color: #ccc;
    }

    .empty-list {
        padding: 24px;
        text-align: center;
        color: #999;
        font-style: italic;
        background: white;
        border-radius: 4px;
        border: 1px solid #dadce0;
    }

    /* Lesson Viewer Split Layout */
    .lesson-viewer-container {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 112px);
      background-color: white;
    }

    .viewer-header {
      padding: 12px 24px;
      border-bottom: 1px solid #dadce0;
      background: #f8f9fa;
    }

    .viewer-header .back-btn {
      font-weight: 500;
    }

    .course-layout {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* Sidebar */
    .sidebar {
      width: 320px;
      background: white;
      border-right: 1px solid #dadce0;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }

    .sidebar-header {
      padding: 20px 24px;
      border-bottom: 1px solid #f0f0f0;
    }

    .sidebar-header h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
      color: #3c4043;
    }

    .sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px 0;
    }

    .nav-tree {
      background: transparent;
    }

    .module-group {
      display: flex;
      align-items: center;
      padding: 4px 8px;
      font-weight: 500;
      color: #3c4043;
    }

    .module-title {
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .nav-item-btn {
      width: 100%;
      text-align: left;
      padding: 8px 16px 8px 48px; /* Indent for lessons */
      font-size: 14px;
      color: #5f6368;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      border-radius: 0;
    }
    
    .nav-item-btn:hover {
        background-color: #f1f3f4;
    }

    .nav-item-btn.active {
      background-color: #e8f0fe;
      color: #1a73e8;
      font-weight: 500;
    }
    
    .nav-item-btn.active::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        background-color: #1a73e8;
    }
    
    .nav-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* Main Content */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #f8f9fa;
    }

    .breadcrumbs {
      padding: 16px 32px;
      display: flex;
      align-items: center;
      font-size: 13px;
      color: #5f6368;
      border-bottom: 1px solid #dadce0;
      background: white;
    }

    .separator {
      font-size: 16px;
      width: 16px;
      height: 16px;
      margin: 0 8px;
      color: #5f6368;
    }

    .current {
      color: #1a73e8;
      font-weight: 500;
    }

    .content-area {
      flex: 1;
      padding: 32px 48px;
      overflow-y: auto;
      background: white;
      max-width: 1000px; /* Readability limit */
      width: 100%;
      margin: 0 auto;
      box-shadow: 0 0 10px rgba(0,0,0,0.02);
    }

    .lesson-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 32px;
      border-bottom: 1px solid #dadce0;
      padding-bottom: 24px;
    }

    .header-icon {
        width: 48px;
        height: 48px;
        background-color: #e8f0fe;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #1a73e8;
    }

    .header-icon mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
    }

    .header-text h1 {
        margin: 0;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #5f6368;
        font-weight: 500;
    }

    .lesson-title {
        font-size: 24px;
        font-weight: 500;
        color: #202124;
        margin-top: 4px;
    }

    .text-content {
      font-size: 16px;
      line-height: 1.6;
      color: #3c4043;
      margin-bottom: 32px;
    }

    .video-section {
        margin: 32px 0;
    }
    
    .video-section h3 {
        margin-bottom: 16px;
        font-size: 18px;
        color: #3c4043;
    }

    .video-container {
        position: relative;
        padding-bottom: 56.25%; /* 16:9 Aspect Ratio */
        height: 0;
        overflow: hidden;
        border-radius: 8px;
        background: black;
    }
    
    .video-iframe {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }

    .resource-card {
      display: flex;
      align-items: center;
      padding: 16px;
      border: 1px solid #dadce0;
      border-radius: 8px;
      margin-bottom: 16px;
      background: #f8f9fa;
    }

    .resource-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: #1a73e8;
        margin-right: 16px;
    }

    .resource-info {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .resource-title {
        font-weight: 500;
        color: #3c4043;
        margin-right: auto;
    }

    .resource-actions {
        display: flex;
        gap: 8px;
    }

    .test-card .resource-icon {
        color: #a142f4;
    }

    .locked {
      background-color: #f1f3f4;
      border-color: #dadce0;
    }

    .locked .resource-icon {
      color: #5f6368;
    }

    .locked .resource-title {
      color: #5f6368;
      font-style: italic;
    }

    .loading-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
    }

    .select-hint {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #5f6368;
    }
    
    .select-hint mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        opacity: 0.5;
    }

    .live-btn {
        animation: pulse 2s infinite;
        font-weight: bold;
    }

    @keyframes pulse {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.4); }
        70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(244, 67, 54, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(244, 67, 54, 0); }
    }

    .spacer {
        flex: 1 1 auto;
    }

    .example-tree-invisible {
      display: none;
    }

    /* People Tab Styles */
    .people-tab-container {
      display: flex;
      flex-direction: column;
      gap: 32px;
      background: white;
      padding: 24px;
      border-radius: 8px;
      border: 1px solid #dadce0;
    }

    .people-section {
      display: flex;
      flex-direction: column;
    }

    .people-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #1a73e8;
      padding-bottom: 8px;
      margin-bottom: 16px;
    }

    .people-section-header h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 400;
      color: #1a73e8;
    }

    .people-count {
      font-size: 14px;
      color: #5f6368;
    }

    .people-list {
      display: flex;
      flex-direction: column;
    }

    .person-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 8px;
      border-bottom: 1px solid #dadce0;
    }

    .person-row:last-child {
      border-bottom: none;
    }

    .person-info {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .person-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      object-fit: cover;
    }

    .person-name {
      font-size: 14px;
      font-weight: 500;
      color: #3c4043;
    }

    .empty-people {
      padding: 16px;
      color: #5f6368;
      text-align: center;
      font-style: italic;
    }

    .groups-section-wrapper {
      margin-top: 16px;
    }

    .groups-section-wrapper .people-section-header {
      border-bottom: 1px solid #dadce0;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }

    .groups-section-wrapper .people-section-header h2 {
      color: #3c4043;
    }

    .teacher-btns {
      display: flex;
      gap: 8px;
    }

    .status-badge.member {
      background-color: #e6f4ea;
      color: #137333;
    }

    .status-badge.pending {
      background-color: #fef7e0;
      color: #b06000;
    }

    .section-hint {
      color: #5f6368;
      font-style: italic;
      margin-bottom: 16px;
      font-size: 13px;
    }

    .add-teacher-form-wrapper {
      margin: 16px 0;
      padding: 16px;
      background-color: #f1f3f4;
      border-radius: 8px;
      border: 1px dashed #dadce0;
    }
    .add-teacher-form {
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .small-input {
      flex: 1;
    }

    .compose-avatar-placeholder, .author-avatar-placeholder {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: #f1f3f4;
      color: #5f6368;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .compose-avatar-placeholder mat-icon, .author-avatar-placeholder mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      margin: 0;
    }
    
    .person-avatar-placeholder {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background-color: #f1f3f4;
      color: #5f6368;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .person-avatar-placeholder mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      margin: 0;
    }
    .live-pulse-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: #d32f2f;
      box-shadow: 0 0 0 0 rgba(211, 47, 47, 0.7);
      animation: pulse 1.2s infinite;
      display: inline-block;
    }
    @keyframes pulse {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(211, 47, 47, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 6px rgba(211, 47, 47, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(211, 47, 47, 0);
      }
    }
    @keyframes pulse-white {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 6px rgba(255, 255, 255, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
      }
    }
    .submission-pending {
      background-color: #fef7e0;
      color: #b06000;
    }
    .submission-approved {
      background-color: #e6f4ea;
      color: #137333;
    }
    .submission-rejected {
      background-color: #fce8e6;
      color: #c5221f;
    }
    .status-pending {
      background-color: #fef7e0;
      color: #b06000;
    }
    .video-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      transition: background 0.3s;
    }
    .video-overlay:hover {
      background: rgba(0, 0, 0, 0.7);
    }
  `]
})
export class CourseViewComponent implements OnInit, OnDestroy {
  subjectId: string = '';
  courseName: string = 'Загрузка...';
  structure: any = null;
  selectedLesson: TreeNode | null = null;
  saving = false;
  safeVideoUrl: SafeResourceUrl | null = null;
  lastProcessedVideoUrl: string | null = null;
  loading = false;
  isStreamActive = false;
  currentUser: any;
  private destroy$ = new Subject<void>();

  isVideoStarted = false;

  // New state properties
  viewingLessonMode = false;
  showComposeForm = false;
  announcementForm!: FormGroup;
  addTeacherForm!: FormGroup;
  courseAnnouncements: any[] = [];
  courseDeadlines: any[] = [];
  userSubmissions: any[] = [];
  courseTeachers: any[] = [];
  suggestedTeachers: any[] = [];
  courseStudents: any[] = [];
  studentGroupMappings: Record<string, { group_id: string, group_name: string }> = {};
  courseDescription: string = '';

  // Submissions grading tab properties
  allSubmissions: any[] = [];
  filteredSubmissions: any[] = [];
  pendingSubmissionsCount = 0;
  submissionFilterTest = '';
  submissionFilterStatus = '';
  submissionFilterStudent = '';
  private rawAllSubmissions: any[] = [];

  // Lesson progress tracking property
  lessonProgress: string[] = [];

  // Data for tabs
  lessonMetadata = {
    moduleName: '',
    materialName: '',
    materialAllowed: false,
    testAllowed: false,
    isLatex: false,
    isJupyter: false
  };

  materials: any[] = [];
  tests: any[] = [];
  groups: any[] = []; // All groups (Teacher/Student View)
  myGroups: any[] = []; // Current user's groups (Student)
  myRequests: any[] = []; // Requests made by student

  dataSource = new MatTreeNestedDataSource<TreeNode>();
  treeControl = new NestedTreeControl<TreeNode>(node => node.children);

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private authService: AuthService,
    private sanitizer: DomSanitizer,
    private router: Router,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.announcementForm = this.fb.group({
      title: ['', Validators.required],
      content: ['', Validators.required]
    });
    this.addTeacherForm = this.fb.group({
      username: ['', Validators.required]
    });
  }

  ngOnInit() {
    combineLatest([
      this.route.params,
      this.authService.currentUser$.pipe(filter(user => user !== null && user !== undefined))
    ]).pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged((prev, curr) => {
        return prev[0]['id'] === curr[0]['id'] && prev[1]?.name === curr[1]?.name && prev[1]?.role === curr[1]?.role;
      })
    ).subscribe(([params, user]) => {
      this.subjectId = params['id'];
      this.currentUser = user;

      if (this.subjectId && this.currentUser) {
        this.loadCourse();
        this.loadMaterials();
        this.loadTests();
        this.loadGroups();
        this.loadAnnouncements();
        this.loadParticipants();
        this.loadUserSubmissions();
        this.loadLessonProgress();
        this.checkActiveStream();
        
        if (this.currentUser.role === 'student') {
          this.loadMyGroups();
          this.loadMyRequests();
        }
      }
      this.cdr.markForCheck();
    });

    this.addTeacherForm.get('username')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      if (value && value.trim().length >= 1) {
        this.apiService.getUsers(value.trim()).subscribe({
          next: (users) => {
            const existingTeacherNames = this.courseTeachers.map(t => t.name);
            this.suggestedTeachers = (users || []).filter((u: any) => !existingTeacherNames.includes(u.name));
            this.cdr.markForCheck();
          },
          error: (err) => console.error('Error fetching users for suggestion:', err)
        });
      } else {
        this.suggestedTeachers = [];
        this.cdr.markForCheck();
      }
    });
  }

  checkActiveStream() {
    this.apiService.getActiveStreamingRooms().subscribe({
      next: (rooms) => {
        this.isStreamActive = (rooms || []).some((r: any) => r && r.subject_id === this.subjectId);
        this.cdr.markForCheck();
      }
    });
  }

  loadCourse() {
    this.loading = true;

    this.apiService.getSubject(this.subjectId).subscribe({
      next: (subject) => {
        if (subject) {
          this.courseName = subject.name;
          this.courseDescription = subject.description || '';
          this.cdr.markForCheck();
        }
      },
      error: (err) => console.error('Error loading subject details:', err)
    });

    this.apiService.getCourseStructure(this.subjectId).subscribe({
      next: (structure) => {
        this.structure = structure;
        this.buildTree();
        this.loading = false;

        // Auto-select first lesson if available
        if (this.dataSource.data.length > 0) {
          const firstModule = this.dataSource.data[0];
          if (firstModule.children && firstModule.children.length > 0) {
            this.selectLesson(firstModule.children[0]);
          }
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading course structure:', err);
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  buildTree() {
    if (!this.structure || !this.structure.modules) return;

    const nodes: TreeNode[] = this.structure.modules.map((module: any) => ({
      id: module.id,
      title: module.title,
      type: 'module',
      orderIndex: module.order_index,
      isCollapsed: module.is_collapsed,
      children: (module.lessons || []).map((lesson: any) => ({
        id: lesson.id,
        title: lesson.title,
        type: 'lesson' as const,
        lessonType: lesson.lesson_type,
        orderIndex: lesson.order_index,
        moduleId: module.id,
        content: lesson.content
      }))
    }));

    this.dataSource.data = nodes;

    nodes.forEach(node => {
      if (node.children && node.children.length > 0 && !node.isCollapsed) {
        this.treeControl.expand(node);
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  hasChild = (_: number, node: TreeNode) => !!node.children && node.children.length > 0;

  loadLessonProgress() {
    if (!this.currentUser) return;
    this.apiService.getLessonProgress(this.subjectId).subscribe({
      next: (progressList) => {
        this.lessonProgress = progressList || [];
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading lesson progress:', err);
      }
    });
  }

  get flatLessons(): TreeNode[] {
    const list: TreeNode[] = [];
    if (this.dataSource.data) {
      for (const module of this.dataSource.data) {
        if (module.children) {
          for (const lesson of module.children) {
            list.push(lesson);
          }
        }
      }
    }
    return list;
  }

  get totalLessonsCount(): number {
    return this.flatLessons.length;
  }

  get completedLessonsCount(): number {
    let count = 0;
    const lessons = this.flatLessons;
    for (const lesson of lessons) {
      if (this.getLessonStatusText(lesson) === 'Сдано') {
        count++;
      }
    }
    return count;
  }

  get previousLesson(): TreeNode | null {
    if (!this.selectedLesson) return null;
    const lessons = this.flatLessons;
    const index = lessons.findIndex(l => l.id === this.selectedLesson?.id);
    if (index > 0) {
      return lessons[index - 1];
    }
    return null;
  }

  get nextLesson(): TreeNode | null {
    if (!this.selectedLesson) return null;
    const lessons = this.flatLessons;
    const index = lessons.findIndex(l => l.id === this.selectedLesson?.id);
    if (index >= 0 && index < lessons.length - 1) {
      return lessons[index + 1];
    }
    return null;
  }

  navigateToLesson(lesson: TreeNode) {
    this.selectLesson(lesson);
    this.cdr.markForCheck();
  }

  mathRound(val: number): number {
    return Math.round(val);
  }

  startStream() {
    const teacherName = this.currentUser?.name || 'Преподаватель';
    const roomName = `subject-${this.subjectId}`;
    
    const roomData = {
      name: roomName,
      subject_id: this.subjectId,
      teacher_name: teacherName
    };

    this.apiService.createStreamingRoom(roomData).subscribe({
      next: () => {
        const announcementContent = `🔴 Преподаватель <strong>${teacherName}</strong> начал трансляцию! <br/><br/> <a href="/courses/${this.subjectId}/stream" class="mat-mdc-raised-button mat-warn" style="display: inline-block; text-decoration: none; padding: 8px 16px; border-radius: 4px; background-color: #f44336; color: white; font-weight: 500;">Присоединиться к трансляции</a>`;
        
        const newsData = {
          title: '🔴 Прямой эфир',
          content: announcementContent,
          subject_id: this.subjectId
        };
        
        this.apiService.createNews(newsData).subscribe({
          next: () => {
            this.router.navigate(['/courses', this.subjectId, 'stream']);
          },
          error: (err) => {
            console.error('Error creating news for stream:', err);
            this.router.navigate(['/courses', this.subjectId, 'stream']);
          }
        });
      },
      error: (err) => {
        this.router.navigate(['/courses', this.subjectId, 'stream']);
      }
    });
  }

  selectLesson(node: TreeNode) {
    this.selectedLesson = node;
    this.updateLessonMetadata(node);
    this.updateSafeVideoUrl(node.content?.video_url);
    this.isVideoStarted = false;
    
    // Save to viewed-lessons in localStorage
    const viewedIds = JSON.parse(localStorage.getItem('viewed-lessons') || '[]');
    if (!viewedIds.includes(node.id)) {
      viewedIds.push(node.id);
      localStorage.setItem('viewed-lessons', JSON.stringify(viewedIds));
    }

    this.checkActiveStream();
    this.cdr.markForCheck();

    // Track video view if lesson has video
    if (node.content?.video_url) {
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        this.apiService.createActivity({
          user_name: currentUser.name,
          action_type: 'video_view',
          resource_type: 'video',
          resource_id: node.id
        }).subscribe();
      }
    }
  }

  startVideo() {
    this.isVideoStarted = true;
    this.triggerLessonViewed();
  }

  triggerLessonViewed() {
    if (this.currentUser?.role === 'student' && this.selectedLesson) {
      const lessonId = this.selectedLesson.id;
      if (!this.lessonProgress.includes(lessonId)) {
        this.apiService.markLessonViewed(this.subjectId, lessonId).subscribe({
          next: () => {
            this.lessonProgress.push(lessonId);
            this.cdr.markForCheck();
          },
          error: (err) => console.error('Error marking lesson viewed:', err)
        });
      }
    }
  }

  isLessonViewed(lessonId: string): boolean {
    return this.lessonProgress.includes(lessonId);
  }

  startChatWith(username: string) {
    this.router.navigate(['/messages'], { queryParams: { chatWith: username } });
  }

  getModuleName(moduleId?: string): string {
    if (!moduleId || !this.structure?.modules) return '';
    const module = this.structure.modules.find((m: any) => m.id === moduleId);
    return module ? module.title : '';
  }

  getVideoEmbedUrl(url: string): SafeResourceUrl {
    let embedUrl = '';

    if (url.includes('youtube.com/watch')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes('rutube.ru/video/')) {
      const videoId = url.split('rutube.ru/video/')[1]?.split('/')[0];
      embedUrl = `https://rutube.ru/play/embed/${videoId}`;
    } else {
      embedUrl = url;
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  updateSafeVideoUrl(url: string) {
    if (!url) {
      this.safeVideoUrl = null;
      return;
    }
    if (url === this.lastProcessedVideoUrl) return;
    this.lastProcessedVideoUrl = url;
    
    let embedUrl = '';
    if (url.includes('youtube.com/watch') || url.includes('youtube.com/embed/')) {
        let videoId = '';
        if (url.includes('v=')) {
          videoId = url.split('v=')[1]?.split('&')[0];
        } else {
          videoId = url.split('embed/')[1]?.split('?')[0];
        }
        embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
    } else if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
    } else if (url.includes('rutube.ru/video/')) {
      const videoId = url.split('rutube.ru/video/')[1]?.split('/')[0];
      embedUrl = `https://rutube.ru/play/embed/${videoId}`;
    } else {
      embedUrl = url;
    }
    
    this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
    this.cdr.markForCheck();
  }

  updateLessonMetadata(node: TreeNode) {
    this.lessonMetadata = {
      moduleName: this.getModuleName(node.moduleId),
      materialName: node.content?.material_id ? (this.getMaterialName(node.content.material_id) || 'Материал для скачивания') : '',
      materialAllowed: node.content?.material_id ? this.isContentAllowed(node.content.material_id, 'material') : false,
      testAllowed: node.content?.test_id ? this.isContentAllowed(node.content.test_id, 'test') : false,
      isLatex: node.content?.material_id ? this.isLatex(node.content.material_id) : false,
      isJupyter: node.content?.material_id ? this.isJupyter(node.content.material_id) : false
    };
  }

  downloadMaterial(materialId: string) {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.apiService.createActivity({
        user_name: currentUser.name,
        action_type: 'material_view',
        resource_type: 'material',
        resource_id: materialId
      }).subscribe();
    }

    this.triggerLessonViewed();
    const url = `/api/materials/${materialId}/download`;
    window.open(url, '_blank');
  }

  loadMaterials() {
    this.apiService.getMaterials(this.subjectId).subscribe({
      next: (data) => {
        this.materials = data;
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Error loading materials', err)
    });
  }

  loadTests() {
    this.apiService.getTests(this.subjectId).subscribe({
      next: (data) => {
        this.tests = data || [];
        this.filterCourseDeadlines();
        if (this.currentUser && (this.currentUser.role === 'teacher' || this.currentUser.role === 'admin' || this.currentUser.role === 'hidden_admin')) {
          this.applySubmissionsSubjectFilter();
        }
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Error loading tests', err)
    });
  }

  loadGroups() {
    this.apiService.getGroups(this.subjectId).subscribe({
      next: (data) => {
        this.groups = data;
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Error loading groups', err)
    });
  }

  loadMyGroups() {
    if (!this.currentUser) return;
    this.apiService.getGroups(this.subjectId, this.currentUser.name).subscribe({
      next: (data) => {
        this.myGroups = data;
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Error loading my groups', err)
    });
  }

  isContentAllowed(contentId: string, type: 'test' | 'material'): boolean {
    if (this.currentUser?.role === 'teacher' || this.currentUser?.role === 'admin') return true;

    let item: any;
    if (type === 'test') {
      item = this.tests.find(t => t.id === contentId);
    } else {
      item = this.materials.find(m => m.id === contentId);
    }

    if (!item) {
      console.warn(`[AccessControl] Item ${contentId} (${type}) not found in loaded lists.`);
      return false;
    }

    if (!item.allowed_groups || item.allowed_groups.length === 0) {
      return true;
    }

    const hasAccess = this.myGroups.some(g => item.allowed_groups.includes(g.id));
    return hasAccess;
  }

  loadMyRequests() {
    if (!this.currentUser) return;
    this.apiService.getMyGroupRequests(this.currentUser.name, 'pending').subscribe({
      next: (requests) => {
        this.myRequests = requests;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading my requests', err);
        this.cdr.markForCheck();
      }
    });
  }

  getGroupName(groupId: string): string {
    const g = this.groups.find(group => group.id === groupId);
    return g ? g.name : 'Unknown';
  }

  getGroupNames(groupIds: string[]): string {
    if (!groupIds || groupIds.length === 0) return 'Все';
    if (!this.groups || this.groups.length === 0) return '...';

    return groupIds.map(id => {
      const g = this.groups.find(group => group.id === id);
      return g ? g.name : 'Unknown';
    }).join(', ');
  }

  isGroupMember(groupId: string): boolean {
    return this.myGroups.some(g => g.id === groupId);
  }

  hasPendingRequest(groupId: string): boolean {
    return this.myRequests.some(r => r.group_id === groupId);
  }

  joinGroup(groupId: string) {
    if (!this.currentUser) return;
    this.apiService.createGroupRequest(groupId, this.currentUser.name).subscribe({
      next: () => {
        alert('Заявка отправлена!');
        this.loadMyRequests();
        this.cdr.markForCheck();
      },
      error: (err) => {
        alert('Ошибка при отправке заявки: ' + (err.error?.detail || err.message));
        this.cdr.markForCheck();
      }
    });
  }

  navigateToGroup(id: string) {
    this.router.navigate(['/groups', id]);
  }

  get visibleTests() {
    return this.tests.filter(t => this.isContentAllowed(t.id, 'test'));
  }

  get visibleMaterials() {
    return this.materials.filter(m => this.isContentAllowed(m.id, 'material'));
  }

  deleteTest(testId: string) {
    if (confirm('Удалить тест?')) {
      this.apiService.deleteTest(testId).subscribe({
        next: () => {
          this.loadTests();
          this.cdr.markForCheck();
        },
        error: (err) => {
          alert('Ошибка при удалении');
          this.cdr.markForCheck();
        }
      });
    }
  }

  deleteMaterial(materialId: string) {
    if (confirm('Удалить материал?')) {
      this.apiService.deleteMaterial(materialId).subscribe({
        next: () => {
          this.loadMaterials();
          this.cdr.markForCheck();
        },
        error: (err) => {
          alert('Ошибка при удалении');
          this.cdr.markForCheck();
        }
      });
    }
  }

  deleteGroup(groupId: string) {
    if (confirm('Удалить группу?')) {
      this.apiService.deleteGroup(groupId).subscribe({
        next: () => {
          this.loadGroups();
          this.cdr.markForCheck();
        },
        error: (err) => {
          alert('Ошибка при удалении');
          this.cdr.markForCheck();
        }
      });
    }
  }

  openCreateTest() {
    this.router.navigate(['/tests/create'], { queryParams: { subjectId: this.subjectId } });
  }

  openUploadMaterial() {
    const dialogRef = this.dialog.open(UploadMaterialDialogComponent, {
      width: '600px',
      data: { subjectId: this.subjectId }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadMaterials();
      }
    });
  }

  createGroup() {
    const dialogRef = this.dialog.open(CreateGroupDialogComponent, {
      width: '600px',
      data: {
        subjects: [{ id: this.subjectId, name: this.courseName }],
        currentUser: this.currentUser
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        result.subject_id = this.subjectId;

        this.apiService.createGroup(result).subscribe({
          next: () => {
            this.loadGroups();
            alert('Группа создана!');
          },
          error: (err) => {
            console.error('Error creating group:', err);
            alert('Ошибка при создании группы: ' + (err.error?.detail || err.message));
          }
        });
      }
    });
  }

  getMaterialName(materialId: string): string {
    const m = this.materials.find(mat => mat.id === materialId);
    return m ? (m.original_name || m.name) : '';
  }

  isLatex(materialId: string): boolean {
    const m = this.materials.find(mat => mat.id === materialId);
    if (!m) return false;
    const name = (m.original_name || m.name || '').toLowerCase();
    return name.endsWith('.tex') || m.mime_type === 'application/x-tex';
  }

  isJupyter(materialId: string): boolean {
    const m = this.materials.find(mat => mat.id === materialId);
    if (!m) return false;
    const name = (m.original_name || m.name || '').toLowerCase();
    return name.endsWith('.ipynb') || m.mime_type === 'application/x-ipynb+json';
  }

  viewMaterial(materialId: string) {
    const m = this.materials.find(mat => mat.id === materialId);
    if (!m) return;

    this.triggerLessonViewed();
    this.dialog.open(MaterialViewerComponent, {
      width: '90vw',
      maxWidth: '1200px',
      data: {
        materialId: materialId,
        url: `/api/materials/${materialId}/download?inline=true`,
        title: m.original_name || m.name,
        mimeType: m.mime_type || ''
      }
    });
  }

  viewMaterialAs(materialId: string, format: string) {
    const m = this.materials.find(mat => mat.id === materialId);
    if (!m) return;

    this.triggerLessonViewed();
    this.dialog.open(MaterialViewerComponent, {
      width: '90vw',
      maxWidth: '1200px',
      data: {
        materialId: materialId,
        format: format,
        url: `/api/materials/${materialId}/download?format=${format}&inline=true`,
        title: (m.original_name || m.name) + ` (${format.toUpperCase()})`,
        mimeType: format === 'pdf' ? 'application/pdf' : 'text/html'
      }
    });
  }

  // Handlers for new tabs
  postAnnouncement() {
    if (this.announcementForm.invalid) return;
    const val = this.announcementForm.value;
    const newsData = {
      title: val.title,
      content: val.content,
      subject_id: this.subjectId
    };
    this.saving = true;
    this.apiService.createNews(newsData).subscribe({
      next: () => {
        this.saving = false;
        this.announcementForm.reset();
        this.showComposeForm = false;
        this.loadAnnouncements();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error posting announcement:', err);
        this.saving = false;
        alert('Ошибка при публикации объявления: ' + (err.error?.detail || err.message));
        this.cdr.markForCheck();
      }
    });
  }

  deleteAnnouncement(id: string) {
    if (confirm('Вы уверены, что хотите удалить это объявление?')) {
      this.apiService.deleteNews(id).subscribe({
        next: () => {
          this.loadAnnouncements();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error deleting announcement:', err);
          alert('Ошибка при удалении объявления');
          this.cdr.markForCheck();
        }
      });
    }
  }

  selectLessonFromOutline(lesson: TreeNode) {
    this.viewingLessonMode = true;
    this.selectLesson(lesson);
  }

  getLessonTypeIcon(lessonType?: string): string {
    switch (lessonType?.toLowerCase()) {
      case 'lecture':
        return 'menu_book';
      case 'quiz':
        return 'quiz';
      case 'video':
        return 'play_circle';
      case 'material':
        return 'description';
      default:
        return 'insert_drive_file';
    }
  }

  getLessonIconColor(lesson: TreeNode): string {
    const status = this.getLessonStatusText(lesson);
    if (status === 'Сдано') return '#4caf50'; // Green
    if (status === 'На проверке') return '#ffb300'; // Yellow/Pending
    return '#9e9e9e'; // Gray/Unstarted
  }

  isTestFinished(testId: string): boolean {
    return this.userSubmissions.some(s => s.test_id === testId && (s.status === 'approved' || s.status === 'pending'));
  }

  getTestDeadlineText(test: any): string {
    if (!test.due_date) return 'Без дедлайна';
    return new RussianDatePipe().transform(test.due_date, 'datetime');
  }

  isTestOverdue(test: any): boolean {
    if (!test.due_date) return false;
    const dueDate = new Date(test.due_date);
    const now = new Date();
    return dueDate < now && !this.isTestFinished(test.id);
  }

  applySubmissionsSubjectFilter() {
    if (!this.tests || this.tests.length === 0) {
      this.allSubmissions = [];
      this.pendingSubmissionsCount = 0;
      this.applySubmissionFilters();
      return;
    }
    this.allSubmissions = this.rawAllSubmissions.filter((s: any) => {
      return this.tests.some(t => t.id === s.test_id);
    });
    this.pendingSubmissionsCount = this.allSubmissions.filter(s => s.status === 'pending').length;
    this.applySubmissionFilters();
  }

  applySubmissionFilters() {
    this.filteredSubmissions = this.allSubmissions.filter(s => {
      const test = this.tests.find(t => t.id === s.test_id);
      const testTitle = test ? test.title.toLowerCase() : '';
      const filterTest = this.submissionFilterTest.toLowerCase();
      if (filterTest && !testTitle.includes(filterTest)) return false;

      if (this.submissionFilterStatus && s.status !== this.submissionFilterStatus) return false;

      const studentName = s.user_name ? s.user_name.toLowerCase() : '';
      const filterStudent = this.submissionFilterStudent.toLowerCase();
      if (filterStudent && !studentName.includes(filterStudent)) return false;

      return true;
    });
  }

  getTestTitle(testId: string): string {
    const t = this.tests.find(test => test.id === testId);
    return t ? t.title : 'Неизвестный тест';
  }

  getSubmissionStatusText(status: string): string {
    switch (status) {
      case 'pending': return 'Ожидает проверки';
      case 'approved': return 'Одобрено';
      case 'rejected': return 'Отклонено';
      default: return status;
    }
  }

  getSubmissionStatusClass(status: string): string {
    switch (status) {
      case 'pending': return 'submission-pending';
      case 'approved': return 'submission-approved';
      case 'rejected': return 'submission-rejected';
      default: return '';
    }
  }

  loadUserSubmissions() {
    if (!this.currentUser) return;
    
    if (this.currentUser.role === 'teacher' || this.currentUser.role === 'admin' || this.currentUser.role === 'hidden_admin') {
      this.apiService.getSubmissions().subscribe({
        next: (subs) => {
          this.rawAllSubmissions = subs || [];
          this.applySubmissionsSubjectFilter();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading all submissions', err);
          this.cdr.markForCheck();
        }
      });
    } else {
      this.apiService.getSubmissions(undefined, this.currentUser.name).subscribe({
        next: (subs) => {
          this.userSubmissions = subs || [];
          this.filterCourseDeadlines();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading user submissions', err);
          this.cdr.markForCheck();
        }
      });
    }
  }

  loadAnnouncements() {
    this.apiService.getNews(this.subjectId).subscribe({
      next: (data) => {
        this.courseAnnouncements = data || [];
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading announcements:', err);
        this.courseAnnouncements = [];
        this.cdr.markForCheck();
      }
    });
  }

  loadParticipants() {
    this.apiService.getSubjectTeachers(this.subjectId).subscribe({
      next: (teachersList) => {
        const list = teachersList || [];
        this.apiService.getUsers().subscribe({
          next: (users) => {
            this.courseTeachers = list.map((t: any) => {
              const matchingUser = users.find((u: any) => u.name === t.user_name);
              return {
                id: t.id,
                name: matchingUser ? matchingUser.name : t.user_name,
                avatar_url: matchingUser ? matchingUser.avatar_url : undefined
              };
            });

            this.apiService.getSubjectStudents(this.subjectId).subscribe({
              next: (enrolledUsernames) => {
                this.apiService.getStudentGroupMappings(this.subjectId).subscribe({
                  next: (mappings) => {
                    this.studentGroupMappings = mappings || {};
                    this.courseStudents = users.filter((u: any) => u.role === 'student' && enrolledUsernames.includes(u.name));
                    this.cdr.markForCheck();
                  },
                  error: () => {
                    this.courseStudents = users.filter((u: any) => u.role === 'student' && enrolledUsernames.includes(u.name));
                    this.cdr.markForCheck();
                  }
                });
              },
              error: () => {
                this.courseStudents = [];
                this.cdr.markForCheck();
              }
            });
          },
          error: (err) => {
            console.error('Error loading users:', err);
            this.courseTeachers = list.map((t: any) => ({
              id: t.id,
              name: t.user_name,
              avatar_url: undefined
            }));
            this.cdr.markForCheck();
          }
        });
      },
      error: (err) => {
        console.error('Error loading subject teachers:', err);
      }
    });
  }

  onGroupSelectedForStudent(studentName: string, groupId: string) {
    const targetGroupId = groupId ? groupId : null;
    this.apiService.assignStudentToGroup(this.subjectId, studentName, targetGroupId).subscribe({
      next: () => {
        this.snackBar.open('Группа студента успешно обновлена!', 'OK', { duration: 3000 });
        this.loadParticipants();
      },
      error: (err) => {
        console.error('Error assigning group for student:', err);
        this.snackBar.open('Не удалось обновить группу студента.', 'OK', { duration: 3000 });
      }
    });
  }

  copyCourseInviteLink() {
    const inviteUrl = window.location.origin + '/invite/subject/' + this.subjectId;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      this.snackBar.open('Ссылка для вступления на курс скопирована в буфер обмена!', 'OK', { duration: 3000 });
    }).catch(err => {
      console.error('Could not copy text: ', err);
      this.snackBar.open('Не удалось скопировать ссылку в буфер обмена.', 'OK', { duration: 3000 });
    });
  }

  getUserEmail(name: string): string {
    if (!name) return 'info@eduai.ru';
    const clean = name.toLowerCase()
      .replace(/\s+/g, '.')
      .replace(/[а-яё]/g, (ch) => {
        const map: { [key: string]: string } = {
          'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
          'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
          'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
          'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
        };
        return map[ch] || ch;
      });
    return `${clean}@eduai.ru`;
  }

  getAvatarUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/static')) return `/api${url}`;
    if (url.startsWith('/api/')) return url;
    return `/api/${url}`;
  }

  handleAvatarError(event: any) {
    event.target.src = 'assets/default-avatar.png';
  }

  filterCourseDeadlines() {
    this.courseDeadlines = this.tests
      .filter(t => t.due_date)
      .map(t => ({
        id: t.id,
        title: t.title,
        dueDate: t.due_date ? new Date(t.due_date) : null,
        overdue: this.isTestOverdue(t),
        finished: this.isTestFinished(t.id)
      }))
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      });
  }

  getLessonStatusText(lesson: TreeNode): string {
    if (lesson.content?.test_id) {
      const testId = lesson.content.test_id;
      const sub = this.userSubmissions.find(s => s.test_id === testId);
      if (sub) {
        if (sub.status === 'approved' || (sub.total_score !== undefined && sub.total_score !== null && sub.total_score >= 0)) {
          return 'Сдано';
        }
        if (sub.status === 'pending') {
          return 'На проверке';
        }
      }
      return 'Не начато';
    }

    const viewedIds = JSON.parse(localStorage.getItem('viewed-lessons') || '[]');
    if (viewedIds.includes(lesson.id) || this.lessonProgress.includes(lesson.id)) {
      return 'Сдано';
    }
    return 'Не начато';
  }

  getLessonStatusClass(lesson: TreeNode): string {
    const status = this.getLessonStatusText(lesson);
    if (status === 'Сдано') return 'status-completed';
    if (status === 'На проверке') return 'status-pending';
    return 'status-not-started';
  }

  getLessonDeadline(lesson: TreeNode): Date | null {
    if (lesson.content?.test_id) {
      const test = this.tests.find(t => t.id === lesson.content.test_id);
      return test && test.due_date ? new Date(test.due_date) : null;
    }
    return null;
  }

  assignTeacher() {
    if (this.addTeacherForm.invalid) return;
    const username = this.addTeacherForm.value.username;
    this.apiService.addSubjectTeacher(this.subjectId, username).subscribe({
      next: () => {
        this.addTeacherForm.reset();
        this.loadParticipants();
      },
      error: (err) => {
        console.error('Error assigning teacher:', err);
        alert('Ошибка при добавлении преподавателя. Возможно, пользователь не найден или уже назначен.');
      }
    });
  }

  removeTeacher(username: string) {
    if (confirm(`Вы уверены, что хотите удалить преподавателя ${username}?`)) {
      this.apiService.removeSubjectTeacher(this.subjectId, username).subscribe({
        next: () => {
          this.loadParticipants();
        },
        error: (err) => {
          console.error('Error removing teacher:', err);
          alert('Ошибка при удалении преподавателя.');
        }
      });
    }
  }

  copyInviteLink(group: any) {
    const link = window.location.origin + '/invite/subject/' + this.subjectId + '/group/' + group.id;
    navigator.clipboard.writeText(link).then(() => {
      this.snackBar.open('Ссылка скопирована в буфер обмена!', 'Закрыть', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom'
      });
    }).catch(err => {
      console.error('Could not copy text: ', err);
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = link;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        this.snackBar.open('Ссылка скопирована в буфер обмена!', 'Закрыть', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      } catch (e) {
        console.error(e);
      }
      document.body.removeChild(textarea);
    });
  }

  togglePeerReview(test: any, checked: boolean) {
    const value = checked ? 'true' : 'false';
    this.apiService.updateTest(test.id, { peer_review_enabled: value }).subscribe({
      next: () => {
        test.peer_review_enabled = value;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error updating peer review status:', err);
        alert('Ошибка при обновлении статуса кросс-проверки');
      }
    });
  }

  isPeerReviewEnabledForTest(testId: string): boolean {
    const test = this.tests.find(t => t.id === testId);
    return test && test.peer_review_enabled === 'true';
  }

  openPeerReviewDialog(testId: string) {
    this.dialog.open(PeerReviewDialogComponent, {
      width: '600px',
      data: {
        testId: testId,
        currentUser: this.currentUser?.name
      }
    });
  }
}

@Component({
  selector: 'app-peer-review-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    ReactiveFormsModule
  ],
  template: `
    <h2 mat-dialog-title>Кросс-проверка работ одноклассников</h2>
    <mat-dialog-content>
      <div *ngIf="loading" class="loading-state">
        <p>Загрузка работ для проверки...</p>
      </div>

      <div *ngIf="!loading && submissions.length === 0" class="empty-state">
        <mat-icon>check_circle</mat-icon>
        <p>Нет доступных работ для проверки. Вы проверили все доступные работы или никто ещё не сдал тест.</p>
      </div>

      <div *ngIf="!loading && submissions.length > 0 && !selectedSubmission" class="submissions-list">
        <p>Выберите работу для проверки:</p>
        <div *ngFor="let sub of submissions" class="submission-row-item" (click)="selectSubmission(sub)">
          <div class="sub-info">
            <mat-icon>assignment</mat-icon>
            <span>Работа #{{ sub.id.substring(0, 8) }} (Автор скрыт)</span>
          </div>
          <button mat-raised-button color="primary">Оценить</button>
        </div>
      </div>

      <div *ngIf="selectedSubmission" class="review-form-container">
        <button mat-button color="primary" (click)="selectedSubmission = null">
          <mat-icon>arrow_back</mat-icon> К списку работ
        </button>
        
        <h3 style="margin-top: 16px;">Содержимое работы #{{ selectedSubmission.id.substring(0, 8) }}</h3>
        
        <mat-card style="margin-bottom: 24px; padding: 16px;">
          <mat-card-content>
            <div *ngFor="let ans of selectedSubmission.answers; let idx = index" style="margin-bottom: 16px;">
              <div style="font-weight: 500; color: #5f6368; font-size: 13px; margin-bottom: 4px;">Ответ на вопрос #{{ idx + 1 }}:</div>
              
              <!-- If JSON structure -->
              <div *ngIf="isJsonAnswer(ans.answer)" style="display: flex; flex-direction: column; gap: 8px;">
                <div *ngIf="parseJsonAnswer(ans.answer).text" style="white-space: pre-wrap; font-size: 15px;">
                  {{ parseJsonAnswer(ans.answer).text }}
                </div>
                <div *ngIf="parseJsonAnswer(ans.answer).external_link">
                  <strong>🔗 Ссылка на проект:</strong>
                  <a [href]="parseJsonAnswer(ans.answer).external_link" target="_blank" style="color: #1a73e8; margin-left: 8px; font-weight: 500;">
                    {{ parseJsonAnswer(ans.answer).external_link }}
                  </a>
                </div>
                <div *ngIf="parseJsonAnswer(ans.answer).video_link" style="margin-top: 8px;">
                  <strong>🎥 Видео-презентация:</strong>
                  <div class="video-container" style="margin-top: 4px; max-width: 500px;">
                    <iframe 
                      [src]="getSafeUrl(parseJsonAnswer(ans.answer).video_link)" 
                      frameborder="0" 
                      allowfullscreen 
                      style="width: 100%; height: 280px; border-radius: 8px;">
                    </iframe>
                  </div>
                </div>
              </div>
              
              <!-- If regular text -->
              <div *ngIf="!isJsonAnswer(ans.answer)" style="white-space: pre-wrap; font-size: 15px;">
                {{ ans.answer || 'Текстовый ответ пустой' }}
              </div>
            </div>
            
            <!-- Files section -->
            <div *ngIf="selectedSubmission.files && selectedSubmission.files.length > 0" style="margin-top: 16px;">
              <div style="font-weight: 500; color: #5f6368; font-size: 13px; margin-bottom: 8px;">Прикрепленные файлы ({{ selectedSubmission.files.length }}):</div>
              <div *ngFor="let file of selectedSubmission.files" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: #f8f9fa; border-radius: 6px; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 14px;">
                  <mat-icon style="color: #5f6368;">insert_drive_file</mat-icon>
                  <span>{{ file.original_name }}</span>
                  <span style="color: #70757a; font-size: 12px;">({{ (file.size / 1024).toFixed(1) }} KB)</span>
                </div>
                <a mat-stroked-button color="primary" [href]="'/api/submissions/' + selectedSubmission.id + '/files/' + file.id + '/download'" target="_blank">
                  Скачать
                </a>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <h3>Оценка работы</h3>
        
        <form [formGroup]="reviewForm" (ngSubmit)="submitReview()" class="review-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Соответствие теме (1-5)</mat-label>
            <mat-select formControlName="relevance">
              <mat-option *ngFor="let val of scoreOptions" [value]="val">{{ val }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Структура и логика (1-5)</mat-label>
            <mat-select formControlName="structure">
              <mat-option *ngFor="let val of scoreOptions" [value]="val">{{ val }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Аргументация (1-5)</mat-label>
            <mat-select formControlName="argument">
              <mat-option *ngFor="let val of scoreOptions" [value]="val">{{ val }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Ясность изложения (1-5)</mat-label>
            <mat-select formControlName="clarity">
              <mat-option *ngFor="let val of scoreOptions" [value]="val">{{ val }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Комментарий / Критика</mat-label>
            <textarea matInput formControlName="comment" rows="3" placeholder="Опишите ваши впечатления о работе..."></textarea>
          </mat-form-field>

          <div class="actions">
            <button mat-raised-button color="primary" type="submit" [disabled]="reviewForm.invalid || submitting">
              Отправить оценку
            </button>
          </div>
        </form>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Закрыть</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
      margin-bottom: 12px;
    }
    .loading-state, .empty-state {
      text-align: center;
      padding: 24px;
      color: #666;
    }
    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #4caf50;
      margin-bottom: 8px;
    }
    .submission-row-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .submission-row-item:hover {
      background-color: #f5f5f5;
    }
    .sub-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .review-form {
      margin-top: 16px;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
  `]
})
export class PeerReviewDialogComponent implements OnInit {
  submissions: any[] = [];
  selectedSubmission: any = null;
  loading = true;
  submitting = false;
  reviewForm: FormGroup;
  scoreOptions = [1, 2, 3, 4, 5];

  constructor(
    private dialogRef: MatDialogRef<PeerReviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { testId: string; currentUser: string },
    private apiService: ApiService,
    private fb: FormBuilder,
    private sanitizer: DomSanitizer
  ) {
    this.reviewForm = this.fb.group({
      relevance: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
      structure: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
      argument: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
      clarity: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
      comment: ['']
    });
  }

  ngOnInit(): void {
    this.loadSubmissions();
  }

  loadSubmissions(): void {
    this.loading = true;
    this.apiService.getSubmissionsForReview(this.data.testId, this.data.currentUser).subscribe({
      next: (subs) => {
        this.submissions = subs || [];
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  selectSubmission(sub: any): void {
    this.selectedSubmission = sub;
  }

  submitReview(): void {
    if (this.reviewForm.invalid || !this.selectedSubmission) return;
    this.submitting = true;
    const formVal = this.reviewForm.value;
    const review = {
      submission_id: this.selectedSubmission.id,
      assignment_id: this.data.testId,
      reviewer: this.data.currentUser,
      relevance: formVal.relevance,
      structure: formVal.structure,
      argument: formVal.argument,
      clarity: formVal.clarity,
      comment: formVal.comment
    };

    this.apiService.createReview(review).subscribe({
      next: () => {
        alert('Отзыв успешно сохранен!');
        this.selectedSubmission = null;
        this.loadSubmissions();
        this.submitting = false;
      },
      error: (err) => {
        console.error(err);
        alert('Ошибка сохранения отзыва: ' + (err.error?.detail || 'Неизвестная ошибка'));
        this.submitting = false;
      }
    });
  }

  isJsonAnswer(answer: string): boolean {
    if (!answer) return false;
    try {
      const parsed = JSON.parse(answer);
      return typeof parsed === 'object' && parsed !== null;
    } catch {
      return false;
    }
  }

  parseJsonAnswer(answer: string): any {
    try {
      return JSON.parse(answer);
    } catch {
      return {};
    }
  }

  getSafeUrl(url: string): SafeResourceUrl {
    let embedUrl = '';
    if (url.includes('youtube.com/watch') || url.includes('youtube.com/embed/')) {
      const videoId = url.includes('v=') ? url.split('v=')[1]?.split('&')[0] : url.split('embed/')[1]?.split('?')[0];
      embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
    } else if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
    } else if (url.includes('rutube.ru/video/')) {
      const videoId = url.split('rutube.ru/video/')[1]?.split('/')[0];
      embedUrl = `https://rutube.ru/play/embed/${videoId}`;
    } else {
      embedUrl = url;
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }
}
