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
      <div class="course-header" *ngIf="!loading">
        <div class="course-header-left">
          <a class="header-back-btn" [routerLink]="['/']" matTooltip="Назад на главную">
            <mat-icon>chevron_left</mat-icon>
          </a>
          <h1 class="course-header-title">{{ courseName }}</h1>
          <!-- Small red pulse/dot indicator if stream is live -->
          <div *ngIf="isStreamActive" class="live-pulse-dot" matTooltip="Трансляция в эфире!"></div>
        </div>
        <div class="header-actions">
          <ng-container *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin'">
            <button class="pill-btn pill-btn-outline" (click)="copyCourseInviteLink()">
              🔗 Приглашение на курс
            </button>
            <button class="pill-btn pill-btn-outline" [routerLink]="['/course-builder', subjectId]">
              ⚙️ Конструктор курса
            </button>
            <button class="pill-btn pill-btn-outline" [routerLink]="['/ai-test']" [queryParams]="{ subjectId: subjectId }">
              ☆ AI-тест
            </button>
            <button class="pill-btn pill-btn-red" (click)="startStream()">
              <mat-icon class="stream-btn-icon">videocam</mat-icon> НАЧАТЬ ТРАНСЛЯЦИЮ
            </button>
          </ng-container>
        </div>
      </div>

      <mat-tab-group animationDuration="0ms" class="course-tabs" [selectedIndex]="selectedTabIndex" (selectedIndexChange)="onTabChange($event)">
        <!-- Tab 1: Лента -->
        <mat-tab label="Лента">
          <div class="tab-content-container feed-tab-container">
            <div class="stream-layout">
              <!-- Left Column: Deadlines -->
              <div class="deadlines-sidebar">
                <div class="glass-card sidebar-card">
                  <div class="sidebar-header">
                    <span class="sidebar-title">Предстоящие задания</span>
                  </div>
                  <div class="sidebar-content">
                    <div *ngIf="courseDeadlines.length === 0" class="no-deadlines">
                      Ура, заданий на этой неделе нет!
                    </div>
                    <div *ngIf="courseDeadlines.length > 0" class="deadlines-list">
                      <div *ngFor="let deadline of courseDeadlines" class="deadline-item" [class.overdue]="deadline.overdue" [class.finished]="deadline.finished">
                        <div class="deadline-icon-box">
                          <mat-icon class="deadline-mat-icon">
                            {{ deadline.finished ? (deadline.statusText === 'На проверке' ? 'hourglass_empty' : 'check_circle') : 'assignment' }}
                          </mat-icon>
                        </div>
                        <div class="deadline-info">
                          <a [routerLink]="['/tests', deadline.id, 'take']" [queryParams]="{ source: 'courses', courseId: subjectId, tab: 0 }" class="deadline-title">
                            {{ deadline.title }}
                          </a>
                          <div class="deadline-date">
                            Срок: {{ deadline.dueDate | date:'M/d/yy, h:mm a' }}
                          </div>
                          <div *ngIf="deadline.overdue" class="deadline-status overdue-text">Просрочено</div>
                          <div *ngIf="deadline.finished" class="deadline-status finished-text" [class.pending-text]="deadline.statusText === 'На проверке'">
                            {{ deadline.statusText || 'Сдано' }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right Column: Compose Form & Feed -->
              <div class="stream-feed">
                <!-- Compose box for teachers/admins -->
                <div class="glass-card compose-card" *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin'">
                  <div class="compose-trigger" *ngIf="!showComposeForm" (click)="showComposeForm = true">
                    <div class="user-monogram-circle">
                      {{ getUserInitials(currentUser?.name) }}
                    </div>
                    <span class="placeholder-text">Поделитесь чем-нибудь с классом...</span>
                  </div>
                  
                  <form [formGroup]="announcementForm" (ngSubmit)="postAnnouncement()" *ngIf="showComposeForm" class="compose-form">
                    <div class="form-field-wrapper">
                      <input class="custom-input full-width" formControlName="title" placeholder="Тема объявления" />
                    </div>
                    
                    <div class="form-field-wrapper">
                      <textarea class="custom-textarea full-width" formControlName="content" rows="4" placeholder="Напишите здесь ваше сообщение..."></textarea>
                    </div>
                    
                    <div class="compose-actions">
                      <button class="pill-btn pill-btn-outline" type="button" (click)="showComposeForm = false; announcementForm.reset()">Отмена</button>
                      <button class="pill-btn pill-btn-dark" type="submit" [disabled]="announcementForm.invalid || saving">
                        Опубликовать
                      </button>
                    </div>
                  </form>
                </div>

                <!-- Announcements Feed -->
                <div class="announcements-feed">
                  <!-- Active stream card for students when stream is active -->
                  <div *ngIf="isStreamActive && currentUser?.role === 'student'" class="glass-card announcement-card live-announcement-card">
                    <div class="announcement-header">
                      <div class="user-monogram-circle">П</div>
                      <div class="announcement-meta-container">
                        <div class="announcement-author">Преподаватель</div>
                        <div class="announcement-date">Прямо сейчас</div>
                      </div>
                    </div>
                    <div class="announcement-body">
                      <div class="live-tag-row">
                        <span class="live-bullet"></span>
                        <span class="live-tag-title">Прямой эфир</span>
                      </div>
                      <div class="live-subtitle">Трансляция уже началась! Присоединяйтесь к онлайн-паре прямо сейчас.</div>
                      <button class="pill-btn-join-stream" [routerLink]="['/courses', subjectId, 'stream']">
                        ПРИСОЕДИНИТЬСЯ К ТРАНСЛЯЦИИ
                      </button>
                    </div>
                  </div>

                  <div *ngIf="courseAnnouncements.length === 0 && !isStreamActive" class="no-announcements">
                    <mat-icon class="feed-empty-icon">chat_bubble_outline</mat-icon>
                    <p>Здесь пока ничего нет. Объявления появятся в этой ленте.</p>
                  </div>

                  <div *ngFor="let announcement of courseAnnouncements" class="glass-card announcement-card" [class.live-announcement-card]="isLiveAnnouncement(announcement)">
                    <div class="announcement-header">
                      <div class="user-monogram-circle">
                        {{ getUserInitials(announcement.author_name || 'Преподаватель') }}
                      </div>
                      <div class="announcement-meta-container">
                        <div class="announcement-author">
                          {{ announcement.author_name || 'Преподаватель' }}
                        </div>
                        <div class="announcement-date">
                          {{ announcement.created_at | russianDate }}
                        </div>
                      </div>
                      <span class="spacer"></span>
                      <button mat-icon-button [matMenuTriggerFor]="announcementMenu" class="dots-btn" *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin'">
                        <mat-icon>more_horiz</mat-icon>
                      </button>
                      <mat-menu #announcementMenu="matMenu">
                        <button mat-menu-item (click)="deleteAnnouncement(announcement.id)">
                          <mat-icon>delete</mat-icon>
                          <span>Удалить</span>
                        </button>
                      </mat-menu>
                    </div>

                    <!-- Live announcement body -->
                    <div *ngIf="isLiveAnnouncement(announcement)" class="announcement-body">
                      <div class="live-tag-row">
                        <span class="live-bullet"></span>
                        <span class="live-tag-title">Прямой эфир</span>
                      </div>
                      <div class="live-subtitle">
                        Преподаватель {{ announcement.author_name || 'Преподаватель' }} начал трансляцию!
                      </div>
                      <button class="pill-btn-join-stream" [routerLink]="['/courses', subjectId, 'stream']">
                        ПРИСОЕДИНИТЬСЯ К ТРАНСЛЯЦИИ
                      </button>
                    </div>

                    <!-- Regular announcement body -->
                    <div *ngIf="!isLiveAnnouncement(announcement)" class="announcement-body">
                      <h3 class="announcement-title-text">{{ announcement.title }}</h3>
                      <div [innerHTML]="announcement.content" class="announcement-content-text"></div>
                      <div *ngIf="announcement.image_url" class="announcement-image-container">
                        <img [src]="announcement.image_url" class="announcement-image" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Tab 2: Задания -->
        <mat-tab label="Задания">
          <!-- Classwork List (viewingLessonMode === false) -->
          <div class="tab-content-container assignments-tab-container" *ngIf="!viewingLessonMode">
            <div class="classwork-header-bar">
              <h2 class="classwork-title">Задания и Материалы курса</h2>
              <div class="actions" *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin'">
                <button class="pill-btn pill-btn-outline" (click)="openCreateTest()">
                  ☆ Создать тест
                </button>
                <button class="pill-btn pill-btn-outline" (click)="openUploadMaterial()">
                  ⤓ Загрузить материал
                </button>
              </div>
            </div>

            <!-- Progress Bar for Students -->
            <div class="student-progress-container glass-card" *ngIf="currentUser?.role === 'student'">
              <div class="progress-label">
                <span>Пройдено {{ completedLessonsCount }} из {{ totalLessonsCount }} уроков</span>
                <span>{{ totalLessonsCount > 0 ? mathRound((completedLessonsCount / totalLessonsCount) * 100) : 0 }}%</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" [style.width.%]="totalLessonsCount > 0 ? (completedLessonsCount / totalLessonsCount) * 100 : 0"></div>
              </div>
            </div>

            <!-- Modules Accordion -->
            <mat-accordion multi="true" class="modules-accordion">
              <mat-expansion-panel *ngFor="let module of dataSource.data" [expanded]="true" class="glass-card module-panel">
                <mat-expansion-panel-header class="module-panel-header">
                  <mat-panel-title>
                    <span class="module-panel-title">{{ module.title }}</span>
                  </mat-panel-title>
                </mat-expansion-panel-header>

                <div class="lessons-list">
                  <div *ngFor="let lesson of module.children" class="lesson-row" (click)="selectLessonFromOutline(lesson)">
                    <div class="lesson-icon-box">
                      <mat-icon class="lesson-type-icon">
                        {{ getLessonTypeIcon(lesson.lessonType) }}
                      </mat-icon>
                    </div>
                    <span class="lesson-row-title">{{ lesson.title }}</span>
                    <span class="spacer"></span>
                    
                    <!-- Deadline Badge -->
                    <span class="deadline-badge-item" *ngIf="getLessonDeadline(lesson)">
                      Срок: {{ getLessonDeadline(lesson) | date:'M/d/yy, h:mm a' }}
                    </span>

                    <!-- Status Badge -->
                    <span class="status-badge" [ngClass]="getLessonStatusClass(lesson)">
                      {{ getLessonStatusText(lesson) }}
                    </span>
                  </div>
                  <div *ngIf="!module.children || module.children.length === 0" class="no-lessons">
                    В этом модуле нет уроков.
                  </div>
                </div>
              </mat-expansion-panel>
            </mat-accordion>

            <!-- Management Section for Teachers -->
            <div class="teacher-management-section" *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin'">
              <div class="section-title">
                <h3 class="mgmt-heading">Панель управления (Все материалы и тесты)</h3>
              </div>
              <div class="assignments-list">
                <div class="list-section">
                  <div class="section-subtitle-caps">ТЕСТЫ</div>
                  <div *ngIf="visibleTests.length === 0" class="empty-list">Нет тестов</div>
                  <div *ngFor="let test of visibleTests" class="glass-card test-mgmt-card">
                    <div class="item-content">
                      <div class="item-info">
                        <div class="item-title">{{ test.title }}</div>
                        <div class="item-meta">
                          Доступ: {{ getGroupNames(test.allowed_groups) }}
                          <span *ngIf="test.due_date"> • Дедлайн: {{ test.due_date | date:'M/d/yy, h:mm a' }}</span>
                        </div>
                      </div>
                      <div class="item-actions">
                        <mat-checkbox [checked]="test.peer_review_enabled === 'true'" (change)="togglePeerReview(test, $event.checked)" class="peer-review-check">
                          Включить кросс-проверку
                        </mat-checkbox>
                        <button mat-icon-button (click)="deleteTest(test.id)" class="delete-icon-btn">
                          <mat-icon>close</mat-icon>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="list-section">
                  <div class="section-subtitle-caps">МАТЕРИАЛЫ</div>
                  <div *ngIf="visibleMaterials.length === 0" class="empty-list">Нет материалов</div>
                  <div *ngFor="let material of visibleMaterials" class="glass-card material-mgmt-card">
                    <div class="item-content">
                      <div class="item-info">
                        <div class="item-title">{{ material.original_name || material.name }}</div>
                        <div class="item-meta">
                          Доступ: {{ getGroupNames(material.allowed_groups) }} • {{ material.note || 'Без описания' }}
                        </div>
                      </div>
                      <div class="item-actions">
                        <button class="pill-btn pill-btn-outline pill-sm" (click)="downloadMaterial(material.id)">Скачать</button>
                        <button mat-icon-button (click)="deleteMaterial(material.id)" class="delete-icon-btn">
                          <mat-icon>delete_outline</mat-icon>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Lesson Viewer split layout (viewingLessonMode === true) -->
          <div class="lesson-viewer-container" *ngIf="viewingLessonMode">
            <div class="viewer-header">
              <button mat-button color="primary" (click)="exitLessonView()" class="back-btn">
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
                            <div class="test-icon-circle">
                              <mat-icon class="resource-icon">quiz</mat-icon>
                            </div>
                            <div class="resource-info">
                              <div class="resource-title">Проверочное тестирование</div>
                              <div class="test-action-buttons" style="display: flex; gap: 10px; align-items: center; margin-top: 8px;">
                                <button type="button" 
                                        class="pill-btn pill-btn-dark" 
                                        [routerLink]="['/tests', selectedLesson.content.test_id, 'take']" 
                                        [queryParams]="{ source: 'courses', courseId: subjectId, tab: 1, lessonId: selectedLesson.id }">
                                  <mat-icon style="font-size: 18px; width: 18px; height: 18px;">play_arrow</mat-icon>
                                  <span>Начать тест</span>
                                </button>
                                <button type="button" 
                                        class="pill-btn pill-btn-outline" 
                                        *ngIf="isPeerReviewEnabledForTest(selectedLesson.content.test_id)" 
                                        (click)="openPeerReviewDialog(selectedLesson.content.test_id)">
                                  <mat-icon style="font-size: 18px; width: 18px; height: 18px;">rate_review</mat-icon>
                                  <span>Кросс-проверка</span>
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
                        <button type="button" 
                                class="pill-btn" 
                                [class.pill-btn-dark]="!isLessonViewed(selectedLesson.id)"
                                [class.pill-btn-outline]="isLessonViewed(selectedLesson.id)"
                                [disabled]="isLessonViewed(selectedLesson.id)"
                                (click)="triggerLessonViewed()">
                          <mat-icon style="font-size: 18px; width: 18px; height: 18px;">{{ isLessonViewed(selectedLesson.id) ? 'check_circle' : 'assignment_turned_in' }}</mat-icon>
                          <span>{{ isLessonViewed(selectedLesson.id) ? 'Материал изучен' : 'Я изучил этот материал' }}</span>
                        </button>
                      </div>

                      <!-- Lesson Navigation Buttons -->
                      <div class="lesson-navigation-buttons" style="display: flex; justify-content: space-between; margin-top: 32px; border-top: 1px solid rgba(0, 0, 0, 0.08); padding-top: 16px;">
                        <button type="button" class="pill-btn pill-btn-outline pill-sm" [disabled]="!previousLesson" (click)="previousLesson && navigateToLesson(previousLesson)">
                          <mat-icon style="font-size: 16px; width: 16px; height: 16px;">navigate_before</mat-icon>
                          <span>Предыдущий урок</span>
                        </button>
                        <button type="button" class="pill-btn pill-btn-outline pill-sm" [disabled]="!nextLesson" (click)="nextLesson && navigateToLesson(nextLesson)">
                          <span>Следующий урок</span>
                          <mat-icon style="font-size: 16px; width: 16px; height: 16px;">navigate_next</mat-icon>
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
          <div class="tab-content-container people-tab-container">
            <!-- Teachers Section -->
            <div class="glass-card people-card">
              <div class="people-card-header">
                <h2 class="people-card-title">Преподаватели</h2>
                <span class="people-count">{{ courseTeachers.length }}</span>
              </div>
              <!-- Assign Teacher Form -->
              <div class="add-teacher-row" *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin'">
                <form [formGroup]="addTeacherForm" (ngSubmit)="assignTeacher()" class="add-teacher-form">
                  <input class="custom-input teacher-input" formControlName="username" placeholder="Имя пользователя преподавателя*" [matAutocomplete]="auto" />
                  <mat-autocomplete #auto="matAutocomplete">
                    <mat-option *ngFor="let user of suggestedTeachers" [value]="user.name">
                      {{ user.name }}
                    </mat-option>
                  </mat-autocomplete>
                  <button class="pill-btn pill-btn-dark" type="submit" [disabled]="addTeacherForm.invalid">
                    Назначить
                  </button>
                </form>
              </div>
              <div class="people-list">
                <div *ngFor="let teacher of courseTeachers" class="person-row">
                  <div class="person-info">
                    <div class="user-monogram-circle">{{ getUserInitials(teacher.name) }}</div>
                    <span class="person-name">{{ teacher.name }}</span>
                  </div>
                  <div class="person-actions">
                    <button mat-icon-button (click)="startChatWith(teacher.name)" title="Начать чат" *ngIf="teacher.name !== currentUser?.name" class="chat-icon-btn">
                      <mat-icon>chat_bubble_outline</mat-icon>
                    </button>
                    <button mat-icon-button *ngIf="(currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin') && teacher.name !== currentUser.name" (click)="removeTeacher(teacher.name)" title="Удалить преподавателя" class="delete-icon-btn">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                </div>
                <div *ngIf="courseTeachers.length === 0" class="empty-people">
                  Нет назначенных преподавателей.
                </div>
              </div>
            </div>

            <!-- Students Section -->
            <div class="glass-card people-card">
              <div class="people-card-header">
                <h2 class="people-card-title">Учащиеся</h2>
                <span class="people-count">{{ courseStudents.length }}</span>
              </div>
              <div class="people-list">
                <div *ngFor="let student of courseStudents" class="person-row">
                  <div class="person-info">
                    <div class="user-monogram-circle">{{ getUserInitials(student.name) }}</div>
                    <span class="person-name">{{ student.name }}</span>
                  </div>
                  <div class="person-right-box">
                    <!-- Teacher group assignment dropdown -->
                    <div *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin'" class="group-select-wrapper">
                      <mat-select [value]="(studentGroupMappings && studentGroupMappings[student.name]) ? studentGroupMappings[student.name].group_id : ''" 
                                  (selectionChange)="onGroupSelectedForStudent(student.name, $event.value)"
                                  placeholder="Без группы" class="clean-group-select">
                        <mat-option value="">Без группы</mat-option>
                        <mat-option *ngFor="let g of groups" [value]="g.id">{{ g.name }}</mat-option>
                      </mat-select>
                    </div>
                    <!-- Group status for non-teachers -->
                    <span *ngIf="!(currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin')" class="student-group-chip">
                      {{ (studentGroupMappings && studentGroupMappings[student.name]) ? studentGroupMappings[student.name].group_name : 'Без группы' }}
                    </span>
                    <button mat-icon-button (click)="startChatWith(student.name)" title="Начать чат" *ngIf="student.name !== currentUser?.name" class="chat-icon-btn">
                      <mat-icon>chat_bubble_outline</mat-icon>
                    </button>
                  </div>
                </div>
                <div *ngIf="courseStudents.length === 0" class="empty-people">
                  Нет учащихся на данном курсе.
                </div>
              </div>
            </div>

            <!-- Groups Section -->
            <div class="glass-card people-card">
              <div class="people-card-header">
                <h2 class="people-card-title">Группы курса</h2>
                <button class="pill-btn pill-btn-outline" (click)="createGroup()" *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin'">
                  👥 Создать группу
                </button>
              </div>
              <p class="section-hint" *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin'">
                Управляйте участниками и заявками на странице каждой группы.
              </p>
              <div class="groups-list">
                <div *ngIf="groups.length === 0" class="empty-list">Нет доступных групп</div>
                <div *ngFor="let group of groups" class="group-item-card">
                  <div class="group-item-info">
                    <div class="group-item-title">{{ group.name }}</div>
                    <div class="group-item-meta">
                      Участников: {{ group.member_count || 0 }} • {{ group.description || 'Без описания' }}
                    </div>
                  </div>
                  <div class="group-item-actions">
                    <!-- Teacher actions -->
                    <ng-container *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin'">
                      <button class="pill-btn pill-btn-outline pill-sm" (click)="copyInviteLink(group)">
                        🔗 Ссылка для приглашения
                      </button>
                      <button mat-icon-button (click)="navigateToGroup(group.id)" matTooltip="Управление" class="settings-icon-btn">
                        <mat-icon>settings</mat-icon>
                      </button>
                      <button mat-icon-button (click)="deleteGroup(group.id)" class="delete-icon-btn">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </ng-container>
                    <!-- Student actions -->
                    <ng-container *ngIf="currentUser?.role === 'student'">
                      <span *ngIf="isGroupMember(group.id)" class="status-badge member">Вы участник</span>
                      <span *ngIf="!isGroupMember(group.id) && hasPendingRequest(group.id)" class="status-badge pending">Заявка отправлена</span>
                      <button class="pill-btn pill-btn-dark pill-sm" *ngIf="!isGroupMember(group.id) && !hasPendingRequest(group.id)" (click)="joinGroup(group.id)">
                        Вступить
                      </button>
                    </ng-container>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Tab 4: Проверка работ -->
        <mat-tab *ngIf="currentUser?.role === 'teacher' || currentUser?.role === 'admin' || currentUser?.role === 'hidden_admin'">
          <ng-template mat-tab-label>
            <span>Проверка работ</span>
            <span class="tab-counter-badge" *ngIf="pendingSubmissionsCount > 0">
              {{ pendingSubmissionsCount }}
            </span>
          </ng-template>

          <div class="tab-content-container submissions-tab-container">
            <div class="submissions-grading-header">
              <div class="filter-input-wrap">
                <input class="custom-input search-input" [(ngModel)]="submissionFilterTest" (ngModelChange)="applySubmissionFilters()" placeholder="Поиск по тесту" />
              </div>

              <div class="filter-input-wrap select-wrap">
                <mat-select [(ngModel)]="submissionFilterStatus" (selectionChange)="applySubmissionFilters()" class="custom-select" placeholder="Все статусы">
                  <mat-option value="">Все статусы</mat-option>
                  <mat-option value="pending">Ожидает проверки</mat-option>
                  <mat-option value="approved">Одобрено</mat-option>
                  <mat-option value="rejected">Отклонено</mat-option>
                </mat-select>
              </div>

              <div class="filter-input-wrap">
                <input class="custom-input search-input" [(ngModel)]="submissionFilterStudent" (ngModelChange)="applySubmissionFilters()" placeholder="Поиск по ученику" />
              </div>
            </div>

            <!-- Submissions Table Card -->
            <div class="glass-card submissions-table-card">
              <table mat-table [dataSource]="filteredSubmissions" class="clean-submissions-table">
                <!-- Student Column -->
                <ng-container matColumnDef="student">
                  <th mat-header-cell *matHeaderCellDef> Ученик </th>
                  <td mat-cell *matCellDef="let s">
                    <div class="table-student-box">
                      <div class="user-monogram-circle">{{ getUserInitials(s.user_name) }}</div>
                      <span class="table-student-name">{{ s.user_name }}</span>
                    </div>
                  </td>
                </ng-container>

                <!-- Test Title Column -->
                <ng-container matColumnDef="testTitle">
                  <th mat-header-cell *matHeaderCellDef> Тест </th>
                  <td mat-cell *matCellDef="let s" class="table-test-title">
                    {{ getTestTitle(s.test_id) }}
                  </td>
                </ng-container>

                <!-- Submission Date Column -->
                <ng-container matColumnDef="date">
                  <th mat-header-cell *matHeaderCellDef> Дата сдачи </th>
                  <td mat-cell *matCellDef="let s" class="table-date">
                    {{ s.finished_at | date:'M/d/yy, h:mm a' }}
                  </td>
                </ng-container>

                <!-- Score Column -->
                <ng-container matColumnDef="score">
                  <th mat-header-cell *matHeaderCellDef> Балл </th>
                  <td mat-cell *matCellDef="let s" class="table-score">
                    {{ s.total_score !== undefined && s.total_score !== null ? s.total_score : '—' }}
                  </td>
                </ng-container>

                <!-- Status Column -->
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef> Статус </th>
                  <td mat-cell *matCellDef="let s">
                    <span class="submission-status-pill" [ngClass]="getSubmissionStatusClass(s.status)">
                      {{ getSubmissionStatusText(s.status) }}
                    </span>
                  </td>
                </ng-container>

                <!-- Action Column -->
                <ng-container matColumnDef="action">
                  <th mat-header-cell *matHeaderCellDef> Действие </th>
                  <td mat-cell *matCellDef="let s">
                    <button class="pill-btn pill-btn-dark pill-sm" [routerLink]="['/submissions', s.id]" [queryParams]="{ returnTo: 'course', subjectId: subjectId }">
                      Проверить
                    </button>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="['student', 'testTitle', 'date', 'score', 'status', 'action']"></tr>
                <tr mat-row *matRowDef="let row; columns: ['student', 'testTitle', 'date', 'score', 'status', 'action'];"></tr>
              </table>

              <div *ngIf="filteredSubmissions.length === 0" class="empty-table-hint">
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
      min-height: 100vh;
      height: 100%;
      background: transparent;
      color: #09090b;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Course Header */
    .course-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      padding: 12px 28px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      flex-shrink: 0;
      z-index: 10;
    }

    .course-header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-back-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      color: #09090b;
      text-decoration: none;
      transition: background 0.15s ease;
      cursor: pointer;
    }

    .header-back-btn:hover {
      background: rgba(0, 0, 0, 0.05);
    }

    .header-back-btn mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      line-height: 24px;
    }

    .course-header-title {
      margin: 0;
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 28px;
      font-weight: 400;
      color: #09090b;
      letter-spacing: -0.01em;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* Pill Buttons */
    .pill-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 36px;
      padding: 0 16px;
      border-radius: 20px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      text-decoration: none;
      box-sizing: border-box;
      user-select: none;
    }

    .pill-btn-outline {
      background: rgba(255, 255, 255, 0.85);
      border: 1px solid rgba(0, 0, 0, 0.12);
      color: #18181b;
    }

    .pill-btn-outline:hover {
      background: #ffffff;
      border-color: rgba(0, 0, 0, 0.25);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }

    .pill-btn-dark {
      background: #09090b;
      color: #ffffff;
      border: 1px solid #09090b;
    }

    .pill-btn-dark:hover {
      background: #27272a;
      border-color: #27272a;
    }

    .pill-btn-dark:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .pill-btn-red {
      background: #991b1b;
      color: #ffffff;
      font-weight: 600;
      font-size: 12px;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      border: none;
      box-shadow: 0 2px 10px rgba(153, 27, 27, 0.25);
    }

    .pill-btn-red:hover {
      background: #7f1d1d;
    }

    .pill-sm {
      height: 30px;
      padding: 0 12px;
      font-size: 12px;
      border-radius: 15px;
    }

    .stream-btn-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
    }

    /* Tabs Styling */
    ::ng-deep .course-tabs {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: transparent;
    }

    ::ng-deep .course-tabs .mat-mdc-tab-header {
      background: transparent;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      padding: 0 16px;
    }

    ::ng-deep .course-tabs .mdc-tab {
      height: 46px;
      letter-spacing: 0;
      padding: 0 20px;
    }

    ::ng-deep .course-tabs .mdc-tab__text-label {
      font-family: 'Inter', sans-serif !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      color: #71717a !important;
    }

    ::ng-deep .course-tabs .mdc-tab--active .mdc-tab__text-label {
      color: #09090b !important;
      font-weight: 600 !important;
    }

    ::ng-deep .course-tabs .mdc-tab-indicator__content--underline {
      border-color: #09090b !important;
      border-top-width: 2px !important;
    }

    ::ng-deep .course-tabs .mat-mdc-tab-body-wrapper {
      flex: 1;
      height: 100%;
      background: transparent;
    }

    .tab-counter-badge {
      background: #09090b;
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 10px;
      margin-left: 6px;
      display: inline-block;
    }

    /* Tab Content Layouts */
    .tab-content-container {
      padding: 24px 20px;
      width: 100%;
      box-sizing: border-box;
      overflow-y: auto;
      height: 100%;
    }

    .feed-tab-container {
      max-width: 1100px;
      margin: 0 auto;
    }

    .assignments-tab-container,
    .people-tab-container,
    .submissions-tab-container {
      max-width: 860px;
      margin: 0 auto;
    }

    /* Glass Cards */
    .glass-card {
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 12px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.02);
      box-sizing: border-box;
      transition: box-shadow 0.2s ease, border-color 0.2s ease;
    }

    .glass-card:hover {
      border-color: rgba(0, 0, 0, 0.1);
    }

    /* Monogram circle */
    .user-monogram-circle {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #475569;
      font-family: 'Inter', sans-serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      text-transform: uppercase;
    }

    /* Custom Form Inputs */
    .custom-input,
    .custom-textarea {
      border: 1px solid rgba(0, 0, 0, 0.1);
      background: rgba(255, 255, 255, 0.9);
      border-radius: 8px;
      padding: 9px 14px;
      font-family: 'Inter', sans-serif;
      font-size: 13.5px;
      color: #09090b;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .custom-input:focus,
    .custom-textarea:focus {
      border-color: #09090b;
      box-shadow: 0 0 0 1px #09090b;
    }

    .full-width {
      width: 100%;
    }

    .form-field-wrapper {
      margin-bottom: 10px;
    }

    /* ========================================================
       Tab 1: Лента (Feed)
       ======================================================== */
    .stream-layout {
      display: flex;
      gap: 22px;
      align-items: flex-start;
    }

    .deadlines-sidebar {
      width: 260px;
      flex-shrink: 0;
    }

    .sidebar-card {
      padding: 16px;
      border-radius: 14px;
    }

    .sidebar-header {
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    .sidebar-title {
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 600;
      color: #09090b;
    }

    .no-deadlines {
      color: #71717a;
      font-size: 13px;
      padding: 8px 0;
    }

    .deadlines-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .deadline-item {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }

    .deadline-icon-box {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.03);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .deadline-mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #71717a;
    }

    .deadline-info {
      display: flex;
      flex-direction: column;
    }

    .deadline-title {
      font-size: 13.5px;
      font-weight: 500;
      color: #09090b;
      text-decoration: none;
    }

    .deadline-title:hover {
      text-decoration: underline;
    }

    .deadline-date {
      font-size: 11.5px;
      color: #71717a;
      margin-top: 2px;
    }

    .deadline-status {
      font-size: 11px;
      font-weight: 500;
      margin-top: 3px;
      display: inline-block;
    }

    .overdue-text {
      color: #dc2626;
    }

    .finished-text {
      color: #16a34a;
    }

    .stream-feed {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }

    .compose-card {
      padding: 14px 18px;
      border-radius: 12px;
    }

    .compose-trigger {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
    }

    .placeholder-text {
      color: #71717a;
      font-size: 14px;
    }

    .compose-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 8px;
    }

    .compose-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 4px;
    }

    .announcements-feed {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .no-announcements {
      text-align: center;
      padding: 48px;
      color: #71717a;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.05);
    }

    .feed-empty-icon {
      font-size: 44px;
      width: 44px;
      height: 44px;
      margin-bottom: 12px;
      color: #d4d4d8;
    }

    .announcement-card {
      padding: 18px 20px;
      border-radius: 14px;
    }

    .announcement-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .announcement-meta-container {
      display: flex;
      flex-direction: column;
    }

    .announcement-author {
      font-size: 14px;
      font-weight: 600;
      color: #09090b;
    }

    .announcement-date {
      font-size: 12px;
      color: #71717a;
    }

    .dots-btn {
      color: #a1a1aa !important;
    }

    .dots-btn:hover {
      color: #09090b !important;
    }

    .announcement-body {
      padding-top: 2px;
    }

    .announcement-title-text {
      font-size: 15px;
      font-weight: 600;
      color: #09090b;
      margin: 0 0 6px 0;
    }

    .announcement-content-text {
      font-size: 14px;
      line-height: 1.5;
      color: #3f3f46;
      white-space: pre-wrap;
    }

    .announcement-image-container {
      margin-top: 12px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(0, 0, 0, 0.06);
      max-height: 400px;
    }

    .announcement-image {
      width: 100%;
      height: auto;
      object-fit: cover;
    }

    /* Live broadcast announcement card */
    .live-announcement-card {
      border: 1px solid rgba(220, 38, 38, 0.2);
    }

    .live-tag-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }

    .live-bullet {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #dc2626;
      box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7);
      animation: pulse 1.2s infinite;
      display: inline-block;
    }

    .live-tag-title {
      font-weight: 700;
      font-size: 14px;
      color: #09090b;
    }

    .live-subtitle {
      font-size: 13.5px;
      color: #52525b;
      margin: 0 0 14px 0;
    }

    .pill-btn-join-stream {
      background: #991b1b;
      color: #ffffff;
      border: none;
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 9px 20px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-block;
      text-decoration: none;
      transition: background 0.15s;
    }

    .pill-btn-join-stream:hover {
      background: #7f1d1d;
    }

    /* ========================================================
       Tab 2: Задания (Assignments)
       ======================================================== */
    .classwork-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .classwork-title {
      margin: 0;
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 24px;
      font-weight: 400;
      color: #09090b;
    }

    .student-progress-container {
      margin-bottom: 20px;
      padding: 16px;
      border-radius: 12px;
    }

    .progress-label {
      display: flex;
      justify-content: space-between;
      font-weight: 500;
      font-size: 13.5px;
      margin-bottom: 8px;
      color: #3f3f46;
    }

    .progress-bar-bg {
      background: #e4e4e7;
      height: 8px;
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    }

    .progress-bar-fill {
      background: #16a34a;
      height: 100%;
      transition: width 0.3s ease;
    }

    .modules-accordion {
      box-shadow: none !important;
    }

    .module-panel {
      margin-bottom: 12px !important;
      border-radius: 12px !important;
      overflow: hidden;
      border: 1px solid rgba(0, 0, 0, 0.06) !important;
      box-shadow: none !important;
    }

    ::ng-deep .module-panel .mat-expansion-panel-header {
      padding: 0 20px;
      height: 52px;
    }

    .module-panel-title {
      font-size: 15px;
      font-weight: 600;
      color: #09090b;
    }

    .lessons-list {
      display: flex;
      flex-direction: column;
    }

    .lesson-row {
      display: flex;
      align-items: center;
      padding: 12px 20px;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
      cursor: pointer;
      transition: background-color 0.15s;
    }

    .lesson-row:hover {
      background-color: rgba(0, 0, 0, 0.02);
    }

    .lesson-icon-box {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
      flex-shrink: 0;
    }

    .lesson-type-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #71717a;
      line-height: 18px;
    }

    .lesson-row-title {
      font-size: 14px;
      font-weight: 500;
      color: #09090b;
    }

    .status-badge {
      font-size: 12px;
      padding: 3px 10px;
      border-radius: 12px;
      font-weight: 500;
      margin-left: 10px;
    }

    .status-completed {
      background-color: #dcfce7;
      color: #166534;
    }

    .status-progress {
      background-color: #fff7ed;
      color: #ea580c;
    }

    .status-not-started {
      background-color: #f1f5f9;
      color: #64748b;
    }

    .status-pending {
      background-color: #fef3c7;
      color: #92400e;
    }

    .status-rejected {
      background-color: #fee2e2;
      color: #991b1b;
    }

    .pending-text {
      color: #d97706 !important;
    }

    .deadline-badge-item {
      font-size: 12px;
      color: #71717a;
      margin-right: 8px;
    }

    .no-lessons {
      padding: 16px;
      text-align: center;
      color: #71717a;
      font-style: italic;
      border-top: 1px solid rgba(0, 0, 0, 0.05);
    }

    /* Teacher Management Section */
    .teacher-management-section {
      margin-top: 32px;
      padding-top: 20px;
    }

    .mgmt-heading {
      font-size: 14px;
      font-weight: 500;
      color: #71717a;
      margin: 0 0 16px 0;
    }

    .assignments-list {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .section-subtitle-caps {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #71717a;
      text-transform: uppercase;
      margin-bottom: 10px;
    }

    .test-mgmt-card {
      border-left: 4px solid #09090b !important;
      padding: 14px 18px;
      margin-bottom: 8px;
      border-radius: 10px;
    }

    .material-mgmt-card {
      padding: 14px 18px;
      margin-bottom: 8px;
      border-radius: 10px;
    }

    .item-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .item-info {
      flex: 1;
    }

    .item-title {
      font-weight: 600;
      font-size: 14.5px;
      color: #09090b;
      margin-bottom: 3px;
    }

    .item-meta {
      font-size: 12.5px;
      color: #71717a;
    }

    .item-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .peer-review-check {
      font-size: 13px;
      color: #3f3f46;
    }

    .delete-icon-btn {
      color: #a1a1aa !important;
      width: 32px !important;
      height: 32px !important;
      line-height: 32px !important;
      padding: 0 !important;
    }

    .delete-icon-btn:hover {
      color: #dc2626 !important;
    }

    .delete-icon-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
    }

    .empty-list {
      padding: 20px;
      text-align: center;
      color: #71717a;
      font-style: italic;
      background: rgba(255, 255, 255, 0.6);
      border-radius: 8px;
      border: 1px solid rgba(0, 0, 0, 0.05);
    }

    /* ========================================================
       Tab 3: Участники (People)
       ======================================================== */
    .people-tab-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .people-card {
      padding: 20px 24px;
      border-radius: 14px;
    }

    .people-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .people-card-title {
      margin: 0;
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 22px;
      font-weight: 400;
      color: #09090b;
    }

    .people-count {
      font-size: 13px;
      color: #71717a;
      font-weight: 500;
    }

    .add-teacher-row {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    .add-teacher-form {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .teacher-input {
      flex: 1;
      height: 38px;
    }

    .people-list {
      display: flex;
      flex-direction: column;
    }

    .person-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    .person-row:last-child {
      border-bottom: none;
    }

    .person-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .person-name {
      font-size: 14px;
      font-weight: 500;
      color: #09090b;
    }

    .person-right-box {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .clean-group-select {
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      padding: 4px 10px;
      font-size: 13px;
      background: rgba(255, 255, 255, 0.85);
      width: 140px;
    }

    .student-group-chip {
      font-size: 12.5px;
      color: #71717a;
      background-color: rgba(0, 0, 0, 0.04);
      padding: 3px 10px;
      border-radius: 12px;
    }

    .chat-icon-btn {
      color: #71717a !important;
      width: 32px !important;
      height: 32px !important;
      line-height: 32px !important;
      padding: 0 !important;
    }

    .chat-icon-btn:hover {
      color: #09090b !important;
    }

    .chat-icon-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
    }

    .settings-icon-btn {
      color: #71717a !important;
      width: 32px !important;
      height: 32px !important;
      line-height: 32px !important;
      padding: 0 !important;
    }

    .settings-icon-btn:hover {
      color: #09090b !important;
    }

    .settings-icon-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
    }

    .empty-people {
      padding: 16px 0;
      color: #71717a;
      text-align: center;
      font-style: italic;
    }

    .section-hint {
      color: #71717a;
      font-size: 12.5px;
      margin: 0 0 12px 0;
    }

    .groups-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .group-item-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(0, 0, 0, 0.02);
      border-radius: 8px;
      border: 1px solid rgba(0, 0, 0, 0.04);
    }

    .group-item-title {
      font-weight: 600;
      font-size: 14.5px;
      color: #09090b;
      margin-bottom: 2px;
    }

    .group-item-meta {
      font-size: 12.5px;
      color: #71717a;
    }

    .group-item-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-badge.member {
      background-color: #dcfce7;
      color: #166534;
    }

    .status-badge.pending {
      background-color: #fef3c7;
      color: #92400e;
    }

    /* ========================================================
       Tab 4: Проверка работ (Submissions)
       ======================================================== */
    .submissions-grading-header {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      align-items: center;
      flex-wrap: wrap;
    }

    .filter-input-wrap {
      flex: 1;
      min-width: 180px;
    }

    .search-input {
      width: 100%;
      height: 38px;
    }

    .custom-select {
      width: 100%;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.9);
      font-size: 13.5px;
      box-sizing: border-box;
    }

    .submissions-table-card {
      border-radius: 12px;
      overflow: hidden;
      padding: 0;
    }

    .clean-submissions-table {
      width: 100%;
      background: transparent;
      border-collapse: collapse;
    }

    ::ng-deep .clean-submissions-table th.mat-mdc-header-cell {
      padding: 14px 18px !important;
      font-family: 'Inter', sans-serif !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      color: #71717a !important;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06) !important;
      background: rgba(0, 0, 0, 0.015) !important;
    }

    ::ng-deep .clean-submissions-table td.mat-mdc-cell {
      padding: 14px 18px !important;
      font-family: 'Inter', sans-serif !important;
      font-size: 13.5px !important;
      color: #09090b !important;
      border-bottom: 1px solid rgba(0, 0, 0, 0.04) !important;
    }

    .table-student-box {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .table-student-name {
      font-weight: 500;
    }

    .table-test-title {
      font-weight: 600;
    }

    .table-date {
      color: #71717a;
      font-size: 13px;
    }

    .table-score {
      font-weight: 700;
    }

    .submission-status-pill {
      display: inline-block;
      font-size: 12px;
      font-weight: 500;
      padding: 3px 10px;
      border-radius: 12px;
    }

    .submission-pending {
      background: #fff7ed;
      color: #ea580c;
      border: 1px solid #ffedd5;
    }

    .submission-approved {
      background: #f0fdf4;
      color: #16a34a;
      border: 1px solid #dcfce7;
    }

    .submission-rejected {
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fee2e2;
    }

    .empty-table-hint {
      padding: 36px;
      text-align: center;
      color: #71717a;
      font-style: italic;
    }

    /* Pulse Animations */
    .live-pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #dc2626;
      box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7);
      animation: pulse 1.2s infinite;
      display: inline-block;
      margin-left: 4px;
    }

    @keyframes pulse {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 6px rgba(220, 38, 38, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(220, 38, 38, 0);
      }
    }

    .spacer {
      flex: 1 1 auto;
    }

    /* Lesson Viewer Split Layout */
    .lesson-viewer-container {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 112px);
      background: transparent;
    }

    .viewer-header {
      padding: 12px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(12px);
    }

    .course-layout {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .sidebar {
      width: 300px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(16px);
      border-right: 1px solid rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }

    .sidebar-header {
      padding: 18px 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    }

    .sidebar-header h2 {
      margin: 0;
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 20px;
      color: #09090b;
    }

    .sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: 12px 0;
    }

    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      background: transparent;
      padding: 24px 32px;
    }

    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #71717a;
      margin-bottom: 20px;
    }

    .breadcrumbs .current {
      color: #09090b;
      font-weight: 500;
    }

    .breadcrumbs .separator {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #a1a1aa;
    }

    .content-area {
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 12px;
      padding: 28px;
    }

    .lesson-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    }

    .header-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #09090b;
    }

    .lesson-title {
      font-size: 22px;
      font-family: 'Instrument Serif', Georgia, serif;
      font-weight: 400;
      color: #09090b;
    }

    .resource-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: rgba(0, 0, 0, 0.02);
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 10px;
      margin-top: 16px;
    }

    .resource-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #09090b;
    }

    .resource-title {
      font-weight: 600;
      font-size: 14.5px;
      color: #09090b;
    }

    .video-container {
      position: relative;
      margin-top: 16px;
      border-radius: 12px;
      overflow: hidden;
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
  getUserInitials(name?: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  isLiveAnnouncement(announcement: any): boolean {
    if (!announcement) return false;
    const title = (announcement.title || '').toLowerCase();
    const content = (announcement.content || '').toLowerCase();
    return title.includes('прямой эфир') || content.includes('/stream') || content.includes('начал трансляцию');
  }

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

  // Tab & navigation restoration state
  selectedTabIndex = 0;
  pendingLessonId: string | null = null;

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

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(qParams => {
      if (qParams['tab'] !== undefined && qParams['tab'] !== null) {
        this.selectedTabIndex = parseInt(qParams['tab'], 10) || 0;
      }
      if (qParams['lessonId']) {
        this.pendingLessonId = qParams['lessonId'];
        this.restorePendingLesson();
      }
      this.cdr.markForCheck();
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

        // Auto-select first lesson if available, or restore pending lesson
        if (this.pendingLessonId) {
          this.restorePendingLesson();
        } else if (this.dataSource.data.length > 0) {
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
      const status = this.getLessonStatusText(lesson);
      if (status === 'Сдано' || status === 'Просмотрено') {
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
    this.selectedTabIndex = 1;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: 1, lessonId: lesson.id },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.cdr.markForCheck();
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
    if (status === 'Сдано' || status === 'Просмотрено') return '#10b981'; // Green
    if (status === 'На проверке') return '#f59e0b'; // Amber/Pending
    if (status === 'На доработке') return '#ef4444'; // Red/Rejected
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

  onTabChange(index: number) {
    this.selectedTabIndex = index;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: index },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.cdr.markForCheck();
  }

  restorePendingLesson() {
    if (!this.pendingLessonId || !this.structure?.modules) return;
    const lessons = this.flatLessons;
    const targetLesson = lessons.find(l => l.id === this.pendingLessonId);
    if (targetLesson) {
      this.viewingLessonMode = true;
      this.selectLesson(targetLesson);
      this.selectedTabIndex = 1;
      this.pendingLessonId = null;
      this.cdr.markForCheck();
    }
  }

  exitLessonView() {
    this.viewingLessonMode = false;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: 1, lessonId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.cdr.markForCheck();
  }

  filterCourseDeadlines() {
    this.courseDeadlines = this.tests
      .filter(t => t.due_date)
      .map(t => {
        const sub = this.userSubmissions.find(s => s.test_id === t.id);
        let statusText = 'Сдано';
        if (sub) {
          if (sub.status === 'pending') {
            statusText = (t.test_type === 'multiple_choice') ? 'Сдано' : 'На проверке';
          } else if (sub.status === 'approved') {
            statusText = 'Сдано';
          } else if (sub.status === 'rejected') {
            statusText = 'На доработке';
          }
        }
        return {
          id: t.id,
          title: t.title,
          dueDate: t.due_date ? new Date(t.due_date) : null,
          overdue: this.isTestOverdue(t),
          finished: this.isTestFinished(t.id),
          statusText: statusText
        };
      })
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      });
  }

  getLessonStatusText(lesson: TreeNode): string {
    const isTest = !!(lesson.content?.test_id || lesson.lessonType === 'quiz');
    if (isTest) {
      const testId = lesson.content?.test_id;
      if (!testId) return 'Не начато';

      const test = this.tests.find(t => t.id === testId);
      const sub = this.userSubmissions.find(s => s.test_id === testId);
      if (sub) {
        // If multiple choice test, once submitted it is immediately 'Сдано'
        const isMultipleChoice = test?.test_type === 'multiple_choice';
        if (isMultipleChoice) {
          return 'Сдано';
        }
        if (sub.status === 'approved') {
          return 'Сдано';
        }
        if (sub.status === 'pending') {
          return 'На проверке';
        }
        if (sub.status === 'rejected') {
          return 'На доработке';
        }
        if (sub.total_score !== undefined && sub.total_score !== null && sub.total_score >= 0) {
          return 'Сдано';
        }
      }
      return 'Не начато';
    }

    // Materials (non-tests): only Просмотрено or Не просмотрено
    if (this.isLessonViewed(lesson.id)) {
      return 'Просмотрено';
    }
    return 'Не просмотрено';
  }

  getLessonStatusClass(lesson: TreeNode): string {
    const status = this.getLessonStatusText(lesson);
    if (status === 'Сдано' || status === 'Просмотрено') return 'status-completed';
    if (status === 'На проверке') return 'status-pending';
    if (status === 'На доработке') return 'status-rejected';
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
