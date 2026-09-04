import { Component, OnInit, Inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTreeModule } from '@angular/material/tree';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { NestedTreeControl } from '@angular/cdk/tree';
import { MatTreeNestedDataSource } from '@angular/material/tree';

interface TreeNode {
  id: string;
  title: string;
  type: 'module' | 'lesson';
  lessonType?: string;
  orderIndex: number;
  children?: TreeNode[];
  moduleId?: string;
  content?: any;
}

@Component({
  selector: 'app-course-builder',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTreeModule,
    MatExpansionModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="builder-container">
      <!-- Верхняя панель навигации и статуса -->
      <div class="builder-topbar">
        <div class="topbar-left">
          <button type="button" class="btn-back" (click)="goBack()" matTooltip="Назад к курсу">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="topbar-titles">
            <span class="topbar-category">КОНСТРУКТОР КУРСА</span>
            <h1 class="topbar-course-title">{{ courseName || 'Курс' }}</h1>
          </div>
        </div>

        <div class="topbar-right">
          <div class="save-status-badge" *ngIf="justSaved">
            <mat-icon>check_circle</mat-icon>
            <span>Сохранено</span>
          </div>
          <button type="button" class="btn-save-course" (click)="saveStructure()" [disabled]="saving">
            <mat-icon>save</mat-icon>
            <span>Сохранить курс</span>
          </button>
        </div>
      </div>

      <!-- Основная двухколоночная сетка -->
      <div class="builder-grid">
        <!-- Левая колонка: Структура курса -->
        <div class="structure-column">
          <div class="structure-card glass-panel">
            <div class="structure-header">
              <span class="structure-label">СТРУКТУРА КУРСА</span>
              <span class="modules-pill">
                {{ getModulesCount() }} {{ getModulesCount() === 1 ? 'модуль' : (getModulesCount() >= 2 && getModulesCount() <= 4 ? 'модуля' : 'модулей') }}
              </span>
            </div>

            <div class="tree-scroll-container">
              <mat-tree [dataSource]="dataSource" [treeControl]="treeControl" class="structure-tree">
                <!-- Листовые узлы: Уроки или пустые модули -->
                <mat-tree-node *matTreeNodeDef="let node" matTreeNodePadding>
                  <!-- Пустой модуль без дочерних уроков -->
                  <div *ngIf="node.type === 'module'" class="tree-node-row module-row" [class.selected]="selectedNode?.id === node.id" (click)="selectNode(node)">
                    <span class="toggle-placeholder"></span>
                    <mat-icon class="node-icon folder-icon">folder_open</mat-icon>
                    <span class="node-title" [title]="node.title">{{ getModuleIndex(node) }}. {{ node.title }}</span>
                    <div class="node-actions" (click)="$event.stopPropagation()">
                      <button type="button" class="action-btn add-btn" (click)="addLesson(node)" matTooltip="Добавить урок">
                        <mat-icon>add</mat-icon>
                      </button>
                      <button type="button" class="action-btn delete-btn" (click)="deleteNode(node)" matTooltip="Удалить модуль">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </div>
                  </div>

                  <!-- Урок -->
                  <div *ngIf="node.type === 'lesson'" class="tree-node-row lesson-row" [class.selected]="selectedNode?.id === node.id" (click)="selectNode(node)">
                    <mat-icon class="node-icon lesson-icon">{{ getNodeIcon(node.lessonType || 'lecture') }}</mat-icon>
                    <span class="node-title" [title]="node.title">{{ getLessonIndex(node) }}. {{ node.title }}</span>
                    <div class="node-actions" (click)="$event.stopPropagation()">
                      <button type="button" class="action-btn delete-btn" (click)="deleteNode(node)" matTooltip="Удалить урок">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </div>
                  </div>
                </mat-tree-node>

                <!-- Вложенные узлы: Модули с дочерними уроками -->
                <mat-nested-tree-node *matTreeNodeDef="let node; when: hasChild" matTreeNodePadding>
                  <div class="tree-node-row module-row" [class.selected]="selectedNode?.id === node.id" (click)="selectNode(node)">
                    <button type="button" class="toggle-btn" matTreeNodeToggle [attr.aria-label]="'Toggle ' + node.title" (click)="$event.stopPropagation()">
                      <mat-icon>{{ treeControl.isExpanded(node) ? 'expand_more' : 'chevron_right' }}</mat-icon>
                    </button>
                    <mat-icon class="node-icon folder-icon">folder_open</mat-icon>
                    <span class="node-title" [title]="node.title">{{ getModuleIndex(node) }}. {{ node.title }}</span>
                    <div class="node-actions" (click)="$event.stopPropagation()">
                      <button type="button" class="action-btn add-btn" (click)="addLesson(node)" matTooltip="Добавить урок">
                        <mat-icon>add</mat-icon>
                      </button>
                      <button type="button" class="action-btn delete-btn" (click)="deleteNode(node)" matTooltip="Удалить модуль">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </div>
                  </div>
                  <div [class.tree-hidden]="!treeControl.isExpanded(node)" role="group" class="tree-nested-group">
                    <ng-container matTreeNodeOutlet></ng-container>
                  </div>
                </mat-nested-tree-node>
              </mat-tree>
            </div>

            <!-- Пунктирная ghost-кнопка добавления модуля -->
            <button type="button" class="btn-add-module-dashed" (click)="addModule()">
              <mat-icon>add</mat-icon>
              <span>Добавить модуль</span>
            </button>
          </div>
        </div>

        <!-- Правая колонка: Панель редактирования -->
        <div class="editor-column">
          <div *ngIf="selectedNode" class="editor-panel glass-panel">
            <!-- Шапка панели редактирования -->
            <div class="editor-header">
              <div class="editor-header-info">
                <span class="type-badge">
                  {{ selectedNode.type === 'module' ? ('МОДУЛЬ ' + getModuleIndex(selectedNode)) : ('УРОК ' + getLessonIndex(selectedNode)) }}
                </span>
                <h2 class="editor-item-title">
                  {{ editForm.get('title')?.value || (selectedNode.type === 'module' ? 'Модуль' : 'Урок') }}
                </h2>
              </div>
              <div class="editor-header-actions">
                <button type="button" class="btn-outline-cancel" (click)="cancelEdit()">Отмена</button>
                <button type="button" class="btn-solid-save" (click)="saveNode()" [disabled]="!editForm.valid">Сохранить</button>
              </div>
            </div>

            <!-- Форма редактирования -->
            <form [formGroup]="editForm" (ngSubmit)="saveNode()" class="editor-form">
              <!-- Секция: Редактирование модуля -->
              <div *ngIf="selectedNode.type === 'module'" class="form-section">
                <div class="form-field-group">
                  <label class="field-label">НАЗВАНИЕ *</label>
                  <input class="field-input" formControlName="title" placeholder="Введите название модуля" required>
                </div>
                <div class="form-field-group">
                  <label class="field-label">ОПИСАНИЕ</label>
                  <textarea class="field-textarea" formControlName="description" rows="5" placeholder="Краткое описание целей модуля..."></textarea>
                </div>
              </div>

              <!-- Секция: Редактирование урока -->
              <div *ngIf="selectedNode.type === 'lesson'" class="form-section">
                <div class="form-field-group">
                  <label class="field-label">НАЗВАНИЕ *</label>
                  <input class="field-input" formControlName="title" placeholder="Введите название урока" required>
                </div>

                <!-- Pill-переключатель типа урока -->
                <div class="form-field-group">
                  <label class="field-label">ТИП УРОКА</label>
                  <div class="lesson-type-pills">
                    <button type="button" class="pill-btn" 
                            [class.active]="editForm.get('lessonType')?.value === 'material' || editForm.get('lessonType')?.value === 'lecture'" 
                            (click)="setLessonType('material')">
                      <mat-icon>description</mat-icon>
                      <span>Материал</span>
                    </button>
                    <button type="button" class="pill-btn" 
                            [class.active]="editForm.get('lessonType')?.value === 'quiz'" 
                            (click)="setLessonType('quiz')">
                      <mat-icon>quiz</mat-icon>
                      <span>Опрос</span>
                    </button>
                    <button type="button" class="pill-btn" 
                            [class.active]="editForm.get('lessonType')?.value === 'video'" 
                            (click)="setLessonType('video')">
                      <mat-icon>smart_display</mat-icon>
                      <span>Видео</span>
                    </button>
                  </div>
                </div>

                <div class="form-field-group">
                  <label class="field-label">ТЕКСТ / ОПИСАНИЕ</label>
                  <textarea class="field-textarea" formControlName="textContent" rows="5" placeholder="Введите текст урока или методические указания..."></textarea>
                </div>

                <!-- Контентный блок: Материал -->
                <div *ngIf="editForm.get('lessonType')?.value === 'material' || editForm.get('lessonType')?.value === 'lecture'" class="sub-section">
                  <div class="sub-section-header">
                    <label class="field-label">МАТЕРИАЛ ДЛЯ УРОКА</label>
                    <div class="sub-actions">
                      <button type="button" class="btn-sub-action" (click)="openMaterialUploadDialog()">
                        <mat-icon>file_download</mat-icon>
                        <span>Загрузить новый</span>
                      </button>
                      <button type="button" class="btn-sub-action" (click)="loadMaterials()">
                        <mat-icon>refresh</mat-icon>
                        <span>Обновить список</span>
                      </button>
                    </div>
                  </div>

                  <div class="cards-list" *ngIf="availableMaterials.length > 0; else noMaterialsTpl">
                    <div *ngFor="let material of availableMaterials" 
                         class="selectable-card"
                         [class.selected]="editForm.get('materialId')?.value === material.id"
                         (click)="selectMaterial(material.id)">
                      <div class="card-icon-box">
                        <mat-icon>description</mat-icon>
                      </div>
                      <div class="card-text">
                        <span class="card-main-title">{{ material.original_name || material.name }}</span>
                        <span class="card-sub-info">
                          {{ getFileExt(material.original_name || material.name) }} • {{ formatFileSize(material.file_size) }}
                          <span *ngIf="material.note"> • {{ material.note }}</span>
                        </span>
                      </div>
                      <div class="checkmark-badge" *ngIf="editForm.get('materialId')?.value === material.id">
                        <mat-icon>check</mat-icon>
                      </div>
                    </div>
                  </div>
                  <ng-template #noMaterialsTpl>
                    <div class="empty-cards-placeholder">
                      <mat-icon>cloud_upload</mat-icon>
                      <span>Нет загруженных материалов. Нажмите «Загрузить новый».</span>
                    </div>
                  </ng-template>
                </div>

                <!-- Контентный блок: Видео -->
                <div *ngIf="editForm.get('lessonType')?.value === 'video'" class="sub-section">
                  <div class="form-field-group" *ngIf="availableVideos.length > 0">
                    <label class="field-label">СУЩЕСТВУЮЩИЕ ВИДЕО ПРЕДМЕТА</label>
                    <div class="chips-row">
                      <button type="button" *ngFor="let video of availableVideos" class="chip-item"
                              [class.active]="editForm.get('videoUrl')?.value === video.url"
                              (click)="onVideoSelect(video.url)">
                        <mat-icon>play_circle_outline</mat-icon>
                        <span>{{ video.title }}</span>
                      </button>
                    </div>
                  </div>

                  <div class="form-field-group">
                    <label class="field-label">URL ВИДЕО (YOUTUBE / RUTUBE)</label>
                    <input class="field-input" formControlName="videoUrl" (ngModelChange)="updateSafeVideoUrl($event)" placeholder="https://www.youtube.com/watch?v=... или https://rutube.ru/video/...">
                  </div>

                  <div class="form-field-group">
                    <label class="field-label">НАЗВАНИЕ ВИДЕО (МЕТКА)</label>
                    <input class="field-input" formControlName="videoTitle" placeholder="Например: Введение в курс">
                  </div>

                  <div *ngIf="safeVideoUrl" class="video-embed-box">
                    <iframe 
                      [src]="safeVideoUrl" 
                      frameborder="0" 
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowfullscreen
                      class="video-iframe">
                    </iframe>
                  </div>
                </div>

                <!-- Контентный блок: Опрос / Тест -->
                <div *ngIf="editForm.get('lessonType')?.value === 'quiz'" class="sub-section">
                  <div class="sub-section-header">
                    <label class="field-label">ВЫБЕРИТЕ ИЛИ СОЗДАЙТЕ ТЕСТ</label>
                    <div class="sub-actions">
                      <button type="button" class="btn-sub-action" (click)="openCreateTestDialog()">
                        <mat-icon>add</mat-icon>
                        <span>Создать тест</span>
                      </button>
                      <button type="button" class="btn-sub-action highlight" (click)="openGenerateTestDialog()">
                        <mat-icon>auto_awesome</mat-icon>
                        <span>AI-генерация</span>
                      </button>
                      <button type="button" class="btn-sub-action" (click)="loadTests()">
                        <mat-icon>refresh</mat-icon>
                        <span>Обновить</span>
                      </button>
                    </div>
                  </div>

                  <div class="cards-list" *ngIf="availableTests.length > 0; else noTestsTpl">
                    <div *ngFor="let test of availableTests"
                         class="selectable-card"
                         [class.selected]="editForm.get('testId')?.value === test.id"
                         (click)="selectTest(test.id)">
                      <div class="card-icon-box quiz-box">
                        <mat-icon>quiz</mat-icon>
                      </div>
                      <div class="card-text">
                        <span class="card-main-title">{{ test.title }}</span>
                        <span class="card-sub-info">{{ test.description || 'Тестирование знаний' }}</span>
                      </div>
                      <div class="checkmark-badge" *ngIf="editForm.get('testId')?.value === test.id">
                        <mat-icon>check</mat-icon>
                      </div>
                    </div>
                  </div>
                  <ng-template #noTestsTpl>
                    <div class="empty-cards-placeholder">
                      <mat-icon>quiz</mat-icon>
                      <span>Нет доступных тестов. Создайте новый или сгенерируйте с помощью AI.</span>
                    </div>
                  </ng-template>

                  <div *ngIf="editForm.get('testId')?.value" class="test-toolbar-strip">
                    <div class="test-toolbar-name">
                      <mat-icon>check_circle</mat-icon>
                      <span>Выбран тест: <strong>{{ getTestName(editForm.get('testId')?.value) }}</strong></span>
                    </div>
                    <div class="test-toolbar-buttons">
                      <button type="button" class="btn-sub-action" (click)="viewTest(editForm.get('testId')?.value)">Просмотр теста</button>
                      <button type="button" class="btn-sub-action" (click)="editTestQuestions(editForm.get('testId')?.value)">Редактировать вопросы</button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <!-- Пустое состояние, когда ничего не выбрано -->
          <div *ngIf="!selectedNode" class="empty-panel glass-panel">
            <div class="empty-icon-circle">
              <mat-icon>edit_note</mat-icon>
            </div>
            <h3 class="empty-title">Выберите модуль или урок для редактирования</h3>
            <p class="empty-description">Нажмите на нужный элемент в структуре курса слева или создайте новый модуль</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .builder-container {
      min-height: 100vh;
      background: transparent;
      padding: 24px 32px 48px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-sizing: border-box;
    }

    /* Верхняя панель */
    .builder-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding: 6px 0;
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .btn-back {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #18181b;
      transition: all 0.2s ease;
    }

    .btn-back:hover {
      background: #18181b;
      color: #fff;
      transform: translateX(-2px);
    }

    .btn-back mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .topbar-titles {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .topbar-category {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #71717a;
      text-transform: uppercase;
    }

    .topbar-course-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 26px;
      font-weight: 400;
      color: #18181b;
      margin: 0;
      line-height: 1.15;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .save-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      background: rgba(22, 163, 74, 0.1);
      border: 1px solid rgba(22, 163, 74, 0.25);
      color: #15803d;
      font-size: 13px;
      font-weight: 500;
      animation: fadeIn 0.2s ease;
    }

    .save-status-badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .btn-save-course {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 20px;
      border-radius: 22px;
      background: #18181b;
      color: #fff;
      border: 1px solid #18181b;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: all 0.2s ease;
    }

    .btn-save-course:hover:not(:disabled) {
      background: #27272a;
      transform: translateY(-1px);
    }

    .btn-save-course:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-save-course mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* Сетка страницы */
    .builder-grid {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 24px;
      align-items: start;
    }

    /* Стеклянные панели */
    .glass-panel {
      background: rgba(255, 255, 255, 0.72);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 18px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.04);
      padding: 24px;
      box-sizing: border-box;
    }

    /* Левая колонка: Структура */
    .structure-card {
      position: sticky;
      top: 24px;
      display: flex;
      flex-direction: column;
    }

    .structure-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
    }

    .structure-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #71717a;
      text-transform: uppercase;
    }

    .modules-pill {
      font-size: 11px;
      font-weight: 600;
      color: #52525b;
      background: #f4f4f5;
      padding: 3px 10px;
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.06);
    }

    .tree-scroll-container {
      max-height: calc(100vh - 280px);
      overflow-y: auto;
      padding-right: 4px;
    }

    .structure-tree {
      background: transparent;
    }

    /* Направляющие линии вложенности */
    .tree-nested-group {
      border-left: 1.5px solid rgba(0, 0, 0, 0.08);
      margin-left: 18px;
      padding-left: 10px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin-top: 3px;
      margin-bottom: 6px;
    }

    .tree-hidden {
      display: none;
    }

    /* Строки дерева */
    .tree-node-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 10px;
      cursor: pointer;
      width: 100%;
      box-sizing: border-box;
      transition: all 0.15s ease;
      user-select: none;
    }

    .tree-node-row:hover {
      background: rgba(0, 0, 0, 0.04);
    }

    .module-row {
      font-weight: 500;
    }

    .module-row.selected {
      background: rgba(0, 0, 0, 0.06);
      font-weight: 600;
    }

    .lesson-row {
      font-size: 13px;
    }

    .lesson-row.selected {
      background: #18181b;
      color: #fff;
    }

    .lesson-row.selected .node-title {
      color: #fff;
    }

    .lesson-row.selected .node-icon {
      color: #fff;
    }

    .lesson-row.selected .action-btn {
      color: #a1a1aa;
    }

    .lesson-row.selected .action-btn:hover {
      color: #ef4444;
      background: rgba(255, 255, 255, 0.15);
    }

    .toggle-btn {
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #71717a;
      border-radius: 4px;
      transition: all 0.15s ease;
    }

    .toggle-btn:hover {
      background: rgba(0, 0, 0, 0.06);
      color: #18181b;
    }

    .toggle-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .toggle-placeholder {
      width: 24px;
      flex-shrink: 0;
    }

    .node-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #71717a;
      flex-shrink: 0;
    }

    .folder-icon {
      color: #52525b;
    }

    .lesson-icon {
      color: #71717a;
    }

    .node-title {
      font-size: 13px;
      color: #18181b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }

    /* Hover-действия */
    .node-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      margin-left: auto;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease;
    }

    .tree-node-row:hover .node-actions {
      opacity: 1;
      pointer-events: auto;
    }

    .action-btn {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      border: none;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #71717a;
      padding: 0;
      transition: all 0.15s ease;
    }

    .action-btn:hover {
      background: rgba(0, 0, 0, 0.08);
      color: #18181b;
    }

    .action-btn.delete-btn:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }

    .action-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    /* Пунктирная кнопка добавления модуля */
    .btn-add-module-dashed {
      width: 100%;
      margin-top: 16px;
      border: 1.5px dashed rgba(0, 0, 0, 0.18);
      border-radius: 12px;
      background: transparent;
      padding: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #52525b;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-add-module-dashed:hover {
      border-color: #18181b;
      color: #18181b;
      background: rgba(0, 0, 0, 0.02);
    }

    .btn-add-module-dashed mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* Правая колонка: Редактор */
    .editor-column {
      min-height: 500px;
    }

    .editor-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.07);
      margin-bottom: 24px;
    }

    .editor-header-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .type-badge {
      display: inline-block;
      align-self: flex-start;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #52525b;
      background: #f4f4f5;
      border: 1px solid rgba(0, 0, 0, 0.06);
      padding: 3px 8px;
      border-radius: 6px;
      text-transform: uppercase;
    }

    .editor-item-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 26px;
      font-weight: 400;
      color: #18181b;
      margin: 0;
      line-height: 1.2;
    }

    .editor-header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn-outline-cancel {
      padding: 7px 18px;
      border-radius: 20px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      background: #fff;
      color: #3f3f46;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-outline-cancel:hover {
      background: #f4f4f5;
      border-color: rgba(0, 0, 0, 0.2);
    }

    .btn-solid-save {
      padding: 7px 20px;
      border-radius: 20px;
      border: 1px solid #18181b;
      background: #18181b;
      color: #fff;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
      transition: all 0.15s ease;
    }

    .btn-solid-save:hover:not(:disabled) {
      background: #27272a;
    }

    .btn-solid-save:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Форма */
    .editor-form {
      display: flex;
      flex-direction: column;
    }

    .form-section {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #71717a;
      text-transform: uppercase;
    }

    .field-input, .field-textarea {
      width: 100%;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 14px;
      font-family: inherit;
      color: #18181b;
      background: rgba(255, 255, 255, 0.85);
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .field-input:focus, .field-textarea:focus {
      border-color: #18181b;
      box-shadow: 0 0 0 2px rgba(24, 24, 27, 0.06);
    }

    .field-textarea {
      resize: vertical;
      line-height: 1.5;
    }

    /* Pill-переключатель типов */
    .lesson-type-pills {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 16px;
      border-radius: 20px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      background: #fff;
      color: #3f3f46;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .pill-btn:hover {
      background: #fafafa;
      border-color: rgba(0, 0, 0, 0.25);
    }

    .pill-btn.active {
      background: #18181b;
      color: #fff;
      border-color: #18181b;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
    }

    .pill-btn mat-icon {
      font-size: 17px;
      width: 17px;
      height: 17px;
    }

    /* Подсекции контента */
    .sub-section {
      margin-top: 10px;
      padding-top: 20px;
      border-top: 1px solid rgba(0, 0, 0, 0.07);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .sub-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }

    .sub-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .btn-sub-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 16px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      background: #fff;
      color: #3f3f46;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-sub-action:hover {
      background: #fafafa;
      border-color: rgba(0, 0, 0, 0.25);
    }

    .btn-sub-action.highlight {
      background: #18181b;
      color: #fff;
      border-color: #18181b;
    }

    .btn-sub-action.highlight:hover {
      background: #27272a;
    }

    .btn-sub-action mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
    }

    /* Карточки материалов и тестов */
    .cards-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 280px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .selectable-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: rgba(255, 255, 255, 0.85);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .selectable-card:hover {
      border-color: rgba(0, 0, 0, 0.22);
      background: #fafafa;
    }

    .selectable-card.selected {
      border-color: #18181b;
      background: rgba(24, 24, 27, 0.03);
      box-shadow: 0 0 0 1px #18181b inset;
    }

    .card-icon-box {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: #f4f4f5;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #52525b;
      flex-shrink: 0;
    }

    .card-icon-box.quiz-box {
      background: #f4f4f5;
      color: #18181b;
    }

    .card-icon-box mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .card-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }

    .card-main-title {
      font-size: 13px;
      font-weight: 500;
      color: #18181b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-sub-info {
      font-size: 11px;
      color: #71717a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .checkmark-badge {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #18181b;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .checkmark-badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .empty-cards-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      border-radius: 12px;
      border: 1px dashed rgba(0, 0, 0, 0.12);
      background: rgba(255, 255, 255, 0.4);
      color: #71717a;
      font-size: 13px;
      gap: 8px;
      text-align: center;
    }

    .empty-cards-placeholder mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      opacity: 0.6;
    }

    /* Видео и чипы */
    .chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 16px;
      border: 1px solid rgba(0, 0, 0, 0.1);
      background: #fff;
      color: #3f3f46;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .chip-item:hover {
      border-color: rgba(0, 0, 0, 0.2);
    }

    .chip-item.active {
      border-color: #18181b;
      background: #18181b;
      color: #fff;
    }

    .chip-item mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .video-embed-box {
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: #000;
    }

    .video-iframe {
      width: 100%;
      height: 380px;
      display: block;
      border: none;
    }

    /* Тулбар выбранного теста */
    .test-toolbar-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 12px;
      background: rgba(24, 24, 27, 0.04);
      border: 1px solid rgba(0, 0, 0, 0.08);
      margin-top: 8px;
    }

    .test-toolbar-name {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #18181b;
    }

    .test-toolbar-name mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #16a34a;
    }

    .test-toolbar-buttons {
      display: flex;
      gap: 8px;
    }

    /* Пустое состояние */
    .empty-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 24px;
      text-align: center;
      min-height: 440px;
    }

    .empty-icon-circle {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.04);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      color: #71717a;
    }

    .empty-icon-circle mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .empty-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 24px;
      font-weight: 400;
      color: #18181b;
      margin: 0 0 8px 0;
    }

    .empty-description {
      font-size: 13px;
      color: #71717a;
      max-width: 380px;
      margin: 0;
      line-height: 1.5;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-3px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class CourseBuilderComponent implements OnInit {
  subjectId: string = '';
  courseName: string = '';
  structure: any = null;
  selectedNode: TreeNode | null = null;
  editForm: FormGroup;
  saving = false;
  justSaved = false;
  availableMaterials: any[] = [];
  availableTests: any[] = [];
  uploadingMaterial = false;

  dataSource = new MatTreeNestedDataSource<TreeNode>();
  treeControl = new NestedTreeControl<TreeNode>(node => node.children);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private auth: AuthService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer
  ) {
    this.editForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      lessonType: ['lecture'],
      textContent: [''],
      videoUrl: [''],
      videoTitle: [''],
      materialId: [''],
      testId: ['']
    });
  }

  availableVideos: any[] = [];
  safeVideoUrl: SafeResourceUrl | null = null;
  lastProcessedVideoUrl: string | null = null;

  ngOnInit() {
    this.subjectId = this.route.snapshot.params['id'];
    this.loadCourse();
    this.loadMaterials();
    this.loadTests();
    this.loadVideos();
  }

  loadCourse() {
    this.apiService.getSubjects().subscribe({
      next: (subjects) => {
        const subject = subjects.find((s: any) => s.id === this.subjectId);
        if (subject) {
          this.courseName = subject.name;
        }
      }
    });

    this.apiService.getCourseStructure(this.subjectId).subscribe({
      next: (structure) => {
        this.structure = structure;
        this.buildTree();
      },
      error: (err) => {
        console.error('Error loading course structure:', err);
        this.snackBar.open('Ошибка загрузки структуры курса', 'Закрыть');
      }
    });
  }

  buildTree() {
    if (!this.structure || !this.structure.modules) return;

    // Save expanded states
    const expandedIds = new Set<string>();
    if (this.dataSource.data) {
      this.dataSource.data.forEach(node => {
        if (this.treeControl.isExpanded(node)) {
          expandedIds.add(node.id);
        }
      });
    }

    const nodes: TreeNode[] = this.structure.modules.map((module: any) => ({
      id: module.id,
      title: module.title,
      type: 'module',
      orderIndex: module.order_index,
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

    // Restore expanded states
    if (expandedIds.size > 0) {
      this.dataSource.data.forEach(node => {
        if (expandedIds.has(node.id)) {
          this.treeControl.expand(node);
        }
      });
    }
  }

  hasChild = (_: number, node: TreeNode) => !!node.children && node.children.length > 0;

  toggleNode(node: TreeNode) {
    if (this.treeControl.isExpanded(node)) {
      this.treeControl.collapse(node);
    } else {
      this.treeControl.expand(node);
    }
  }

  getNodeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'module': 'folder',
      'lecture': 'article',
      'quiz': 'quiz',
      'video': 'video_library',
      'material': 'description',
      'exercise': 'fitness_center'
    };
    return icons[type] || 'circle';
  }

  selectNode(node: TreeNode) {
    this.selectedNode = node;
    this.editForm.patchValue({
      title: node.title,
      description: node.type === 'module' ? (this.structure?.modules?.find((m: any) => m.id === node.id)?.description || '') : '',
      lessonType: node.lessonType || 'lecture',
      textContent: node.content?.text_content || '',
      videoUrl: node.content?.video_url || '',
      videoTitle: node.content?.extra_data?.video_title || '',
      materialId: node.content?.material_id || '',
      testId: node.content?.test_id || ''
    });
    this.updateSafeVideoUrl(node.content?.video_url);
  }

  updateSafeVideoUrl(url: string) {
    if (!url) {
      this.safeVideoUrl = null;
      return;
    }
    if (url === this.lastProcessedVideoUrl) return;
    this.lastProcessedVideoUrl = url;
    
    let embedUrl = '';
    // YouTube
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
    }
    else if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
    }
    // Rutube
    else if (url.includes('rutube.ru/video/')) {
      const videoId = url.split('rutube.ru/video/')[1]?.split('/')[0];
      embedUrl = `https://rutube.ru/play/embed/${videoId}`;
    }
    
    this.safeVideoUrl = embedUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl) : null;
  }

  addModule() {
    const dialogRef = this.dialog.open(InputDialogComponent, {
      width: '400px',
      data: { title: 'Добавить модуль', label: 'Название модуля:', placeholder: 'Введите название модуля' }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.trim()) {
        this.apiService.createModule(this.subjectId, {
          title: result.trim(),
          description: '',
          is_collapsed: false
        }).subscribe({
          next: () => {
            this.loadCourse();
            this.snackBar.open('Модуль добавлен', 'Закрыть', { duration: 2000 });
          },
          error: (err) => {
            console.error('Error creating module:', err);
            this.snackBar.open('Ошибка создания модуля: ' + (err.error?.detail || err.message || 'Неизвестная ошибка'), 'Закрыть', { duration: 5000 });
          }
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/courses', this.subjectId]);
  }

  getModulesCount(): number {
    return this.dataSource?.data?.length || 0;
  }

  getModuleIndex(node: TreeNode): number {
    if (!this.dataSource?.data) return 1;
    if (node.type === 'module') {
      const idx = this.dataSource.data.findIndex(m => m.id === node.id);
      return idx >= 0 ? idx + 1 : 1;
    } else {
      const parent = this.dataSource.data.find(m => m.id === node.moduleId || (m.children && m.children.some(c => c.id === node.id)));
      if (parent) {
        const idx = this.dataSource.data.findIndex(m => m.id === parent.id);
        return idx >= 0 ? idx + 1 : 1;
      }
      return 1;
    }
  }

  getLessonIndex(node: TreeNode): string {
    if (!this.dataSource?.data) return '1.1';
    for (let m = 0; m < this.dataSource.data.length; m++) {
      const mod = this.dataSource.data[m];
      if (mod.children) {
        const lIdx = mod.children.findIndex(c => c.id === node.id);
        if (lIdx >= 0) {
          return `${m + 1}.${lIdx + 1}`;
        }
      }
    }
    return '1.1';
  }

  setLessonType(type: string): void {
    this.editForm.patchValue({ lessonType: type });
  }

  selectMaterial(materialId: string): void {
    const current = this.editForm.get('materialId')?.value;
    this.editForm.patchValue({ materialId: current === materialId ? '' : materialId });
  }

  selectTest(testId: string): void {
    const current = this.editForm.get('testId')?.value;
    this.editForm.patchValue({ testId: current === testId ? '' : testId });
  }

  getFileExt(name?: string): string {
    if (!name) return 'FILE';
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop()!.toUpperCase() : 'FILE';
  }

  formatFileSize(bytes?: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  addLesson(moduleNode: TreeNode) {
    const dialogRef = this.dialog.open(InputDialogComponent, {
      width: '400px',
      data: { title: 'Добавить урок', label: 'Название урока:', placeholder: 'Введите название урока' }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.trim()) {
        this.apiService.createLesson(moduleNode.id, {
          title: result.trim(),
          lesson_type: 'lecture'
        }).subscribe({
          next: () => {
            this.loadCourse();
            this.snackBar.open('Урок добавлен', 'Закрыть', { duration: 2000 });
          },
          error: (err) => {
            console.error('Error creating lesson:', err);
            this.snackBar.open('Ошибка создания урока: ' + (err.error?.detail || err.message || 'Неизвестная ошибка'), 'Закрыть', { duration: 5000 });
          }
        });
      }
    });
  }

  deleteNode(node: TreeNode) {
    if (!confirm(`Удалить "${node.title}" ? `)) return;

    if (node.type === 'module') {
      this.apiService.deleteModule(node.id).subscribe({
        next: () => {
          this.loadCourse();
          this.selectedNode = null;
          this.snackBar.open('Модуль удален', 'Закрыть', { duration: 2000 });
        }
      });
    } else {
      this.apiService.deleteLesson(node.id).subscribe({
        next: () => {
          this.loadCourse();
          this.selectedNode = null;
          this.snackBar.open('Урок удален', 'Закрыть', { duration: 2000 });
        }
      });
    }
  }

  saveNode() {
    if (!this.selectedNode || !this.editForm.valid) return;

    const formValue = this.editForm.value;

    if (this.selectedNode.type === 'module') {
      this.apiService.updateModule(this.selectedNode.id, {
        title: formValue.title,
        description: formValue.description || null
      }).subscribe({
        next: () => {
          this.loadCourse();
          this.justSaved = true;
          setTimeout(() => this.justSaved = false, 3000);
          this.snackBar.open('Модуль сохранен', 'Закрыть', { duration: 2000 });
        }
      });
    } else {
      // Update lesson
      this.apiService.updateLesson(this.selectedNode.id, {
        title: formValue.title,
        lesson_type: formValue.lessonType
      }).subscribe({
        next: () => {
          // Update content
          const contentData: any = {};
          contentData.lesson_id = this.selectedNode!.id; // Add lesson_id for validation
          if (formValue.textContent) contentData.text_content = formValue.textContent;
          if (formValue.videoUrl) {
            contentData.video_url = formValue.videoUrl;
            contentData.video_platform = formValue.videoUrl.includes('youtube') ? 'youtube' : 'rutube';
            contentData.extra_data = { video_title: formValue.videoTitle };
            
            // Register video in video-service if it's new or has a manual title
            this.apiService.createVideo({
              subject_id: this.subjectId,
              url: formValue.videoUrl,
              title: formValue.videoTitle || 'Видео',
              uploader: this.auth.getCurrentUser()?.name || 'Teacher'
            }).subscribe();
          }
          if (formValue.materialId) contentData.material_id = formValue.materialId;
          if (formValue.testId) contentData.test_id = formValue.testId;

          if (this.selectedNode?.content?.id) {
            this.apiService.updateContent(this.selectedNode.content.id, contentData).subscribe({
              next: () => {
                this.loadCourse();
                this.justSaved = true;
                setTimeout(() => this.justSaved = false, 3000);
                this.snackBar.open('Урок сохранен', 'Закрыть', { duration: 2000 });
              }
            });
          } else {
            this.apiService.createContent(this.selectedNode!.id, contentData).subscribe({
              next: () => {
                this.loadCourse();
                this.justSaved = true;
                setTimeout(() => this.justSaved = false, 3000);
                this.snackBar.open('Урок сохранен', 'Закрыть', { duration: 2000 });
              }
            });
          }
        }
      });
    }
  }

  cancelEdit() {
    this.selectedNode = null;
    this.editForm.reset();
  }

  saveStructure() {
    this.saving = true;
    if (this.selectedNode && this.editForm.valid) {
      this.saveNode();
    }
    setTimeout(() => {
      this.saving = false;
      this.justSaved = true;
      setTimeout(() => this.justSaved = false, 3000);
      this.snackBar.open('Структура сохранена', 'Закрыть', { duration: 2000 });
    }, 400);
  }

  loadMaterials() {
    if (!this.subjectId) return;
    this.apiService.getMaterials(this.subjectId).subscribe({
      next: (materials) => {
        this.availableMaterials = materials;
      },
      error: (err) => {
        console.error('Error loading materials:', err);
      }
    });
  }

  loadTests() {
    if (!this.subjectId) return;
    this.apiService.getTests(this.subjectId).subscribe({
      next: (tests) => {
        this.availableTests = tests;
      },
      error: (err) => {
        console.error('Error loading tests:', err);
      }
    });
  }

  getMaterialName(materialId: string): string {
    const material = this.availableMaterials.find(m => m.id === materialId);
    return material ? (material.original_name || material.name) : '';
  }

  getTestName(testId: string): string {
    const test = this.availableTests.find(t => t.id === testId);
    return test ? test.title : '';
  }

  loadVideos() {
    if (!this.subjectId) return;
    this.apiService.getVideos(this.subjectId).subscribe({
      next: (videos) => {
        this.availableVideos = videos;
      },
      error: (err) => {
        console.error('Error loading videos:', err);
      }
    });
  }

  getVideoEmbedUrl(url: string): SafeResourceUrl {
    if (!url) return '';
    let embedUrl = '';
    // YouTube
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    }
    else if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    }
    // Rutube
    else if (url.includes('rutube.ru/video/')) {
      const videoId = url.split('rutube.ru/video/')[1]?.split('/')[0];
      embedUrl = `https://rutube.ru/play/embed/${videoId}`;
    }
    
    return embedUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl) : '';
  }

  openMaterialUploadDialog() {
    const dialogRef = this.dialog.open(MaterialUploadDialogComponent, {
      width: '500px',
      data: { subjectId: this.subjectId }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadMaterials();
        this.editForm.patchValue({ materialId: result.id });
        this.snackBar.open('Материал загружен и выбран', 'Закрыть', { duration: 2000 });
      }
    });
  }

  openCreateTestDialog() {
    this.router.navigate(['/tests/create'], { queryParams: { subjectId: this.subjectId, returnTo: `/course-builder/${this.subjectId}` } });
  }

  openGenerateTestDialog() {
    this.router.navigate(['/ai-test'], { queryParams: { subjectId: this.subjectId, returnTo: `/course-builder/${this.subjectId}` } });
  }

  viewTest(testId: string) {
    this.router.navigate(['/tests', testId]);
  }

  editTestQuestions(testId: string) {
    this.router.navigate(['/tests/edit', testId], { queryParams: { returnTo: `/course-builder/${this.subjectId}` } });
  }

  onVideoSelect(url: string) {
    const selectedVideo = this.availableVideos.find(v => v.url === url);
    this.editForm.patchValue({ 
      videoUrl: url,
      videoTitle: selectedVideo ? selectedVideo.title : ''
    });
    this.updateSafeVideoUrl(url);
  }
}

@Component({
  selector: 'app-input-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ data.label }}</mat-label>
        <input matInput [(ngModel)]="inputValue" [placeholder]="data.placeholder" (keyup.enter)="onSubmit()" autofocus>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Отмена</button>
      <button mat-raised-button color="primary" (click)="onSubmit()" [disabled]="!inputValue || !inputValue.trim()">OK</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
      min-width: 300px;
    }
    mat-dialog-content {
      padding: 20px 24px;
    }
    mat-dialog-actions {
      padding: 8px 24px 16px;
    }
  `]
})
export class InputDialogComponent {
  inputValue: string = '';

  constructor(
    public dialogRef: MatDialogRef<InputDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; label: string; placeholder: string }
  ) { }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.inputValue?.trim()) {
      this.dialogRef.close(this.inputValue);
    }
  }
}

@Component({
  selector: 'app-material-upload-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Загрузить материал</h2>
    <mat-dialog-content>
      <input type="file" #fileInput (change)="onFileSelected($event)" style="display: none">
      <button mat-raised-button (click)="fileInput.click()" [disabled]="uploading">
        <mat-icon>attach_file</mat-icon>
        Выбрать файл
      </button>
      <div *ngIf="selectedFile" style="margin-top: 16px;">
        <p><strong>Выбран файл:</strong> {{ selectedFile.name }}</p>
        <p><strong>Размер:</strong> {{ formatSize(selectedFile.size) }}</p>
      </div>
      <mat-form-field appearance="outline" class="full-width" style="margin-top: 16px;">
        <mat-label>Описание (опционально)</mat-label>
        <input matInput [(ngModel)]="note" placeholder="Например: лекция 1, слайды">
      </mat-form-field>
      <mat-spinner *ngIf="uploading" diameter="30" style="margin: 20px auto;"></mat-spinner>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()" [disabled]="uploading">Отмена</button>
      <button mat-raised-button color="primary" (click)="onUpload()" [disabled]="!selectedFile || uploading">
        {{ uploading ? 'Загрузка...' : 'Загрузить' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
      min-width: 300px;
    }
    mat-dialog-content {
      padding: 20px 24px;
    }
    mat-dialog-actions {
      padding: 8px 24px 16px;
    }
  `]
})
export class MaterialUploadDialogComponent {
  selectedFile: File | null = null;
  note: string = '';
  uploading = false;

  constructor(
    public dialogRef: MatDialogRef<MaterialUploadDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { subjectId: string },
    private apiService: ApiService,
    private snackBar: MatSnackBar
  ) { }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onUpload(): void {
    if (!this.selectedFile) return;

    this.uploading = true;
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('subject_id', this.data.subjectId);
    if (this.note) {
      formData.append('note', this.note);
    }

    this.apiService.uploadMaterial(formData).subscribe({
      next: (material) => {
        this.uploading = false;
        this.dialogRef.close(material);
        this.snackBar.open('Материал успешно загружен', 'Закрыть', { duration: 2000 });
      },
      error: (err) => {
        this.uploading = false;
        this.snackBar.open('Ошибка загрузки: ' + (err.error?.detail || err.message || 'Неизвестная ошибка'), 'Закрыть', { duration: 5000 });
      }
    });
  }
}
