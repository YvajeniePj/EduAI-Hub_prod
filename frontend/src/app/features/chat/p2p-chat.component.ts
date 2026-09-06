import { Component, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { interval, Subscription, of } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, switchMap, catchError, map } from 'rxjs/operators';

interface Dialog {
  username: string;
  last_message_content: string;
  last_message_time: Date;
  last_message_sender: string;
  unread_count: number;
  avatar_url?: string;
  isTemp?: boolean;
}

interface ChatAttachment {
  url: string;
  file_name: string;
  content_type: string;
  size: number;
}

interface ParsedMessageContent {
  text: string;
  attachment?: ChatAttachment;
}

interface Message {
  id?: string;
  sender_name: string;
  recipient_name: string;
  content: string;
  is_read: boolean;
  created_at: Date;
}


@Component({
  selector: 'app-p2p-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatListModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatBadgeModule,
    MatSnackBarModule,
    MatMenuModule,
    MatDialogModule,
    MatTooltipModule
  ],
  template: `
    <div class="chat-wrapper">
      <!-- Left sidebar: Dialogs list -->
      <div class="dialogs-sidebar">
        <div class="sidebar-header">
          <h2 class="sidebar-title">Сообщения</h2>
        </div>

        <!-- Start new chat search box -->
        <div class="search-box">
          <div class="custom-search-pill">
            <mat-icon class="search-icon">search</mat-icon>
            <input 
              type="text"
              [formControl]="searchControl" 
              [matAutocomplete]="auto" 
              placeholder="Начать новый чат..."
              class="search-input" />
          </div>

          <mat-autocomplete #auto="matAutocomplete" panelClass="search-autocomplete-panel" (optionSelected)="onUserSelected($event)">
            <mat-option *ngFor="let user of foundUsers" [value]="user.name" class="search-user-option">
              <div class="user-option-wrap">
                <div class="avatar-mini" *ngIf="getResolvedAvatar(user.name, user.avatar_url) && !avatarErrors.has(user.name)">
                  <img [src]="getAvatarUrl(getResolvedAvatar(user.name, user.avatar_url))" (error)="avatarErrors.add(user.name)" />
                </div>
                <div class="avatar-mini-initials" *ngIf="!getResolvedAvatar(user.name, user.avatar_url) || avatarErrors.has(user.name)">
                  {{ getInitials(user.name) }}
                </div>
                <span class="user-option-name">{{ user.name }}</span>
              </div>
            </mat-option>
            <mat-option *ngIf="foundUsers.length === 0 && searchControl.value && searchControl.value.trim().length >= 1" [disabled]="true">
              <span class="no-results-text">Пользователи не найдены</span>
            </mat-option>
          </mat-autocomplete>
        </div>

        <!-- List of dialogs -->
        <div class="dialogs-list">
          <div *ngIf="loadingDialogs" class="dialogs-spinner">
            <mat-spinner diameter="32"></mat-spinner>
          </div>

          <div *ngIf="!loadingDialogs && dialogs.length === 0" class="empty-dialogs">
            <mat-icon>chat_bubble_outline</mat-icon>
            <p>У вас еще нет активных диалогов</p>
          </div>

          <div *ngFor="let dialog of dialogs" 
               class="dialog-item" 
               [class.active]="selectedDialog?.username === dialog.username"
               (click)="selectDialog(dialog)">
            
            <div class="active-indicator" *ngIf="selectedDialog?.username === dialog.username"></div>

            <div class="dialog-avatar">
              <div class="avatar-container" *ngIf="getResolvedAvatar(dialog.username, dialog.avatar_url) && !avatarErrors.has(dialog.username)">
                <img [src]="getAvatarUrl(getResolvedAvatar(dialog.username, dialog.avatar_url))" (error)="avatarErrors.add(dialog.username)" />
              </div>
              <div class="avatar-initials" *ngIf="!getResolvedAvatar(dialog.username, dialog.avatar_url) || avatarErrors.has(dialog.username)">
                {{ getInitials(dialog.username) }}
              </div>
              <span class="status-dot online"></span>
            </div>

            <div class="dialog-info">
              <div class="dialog-row">
                <span class="dialog-name">{{ dialog.username }}</span>
                <span class="dialog-time" *ngIf="dialog.last_message_time">
                  {{ formatTime(dialog.last_message_time) }}
                </span>
              </div>
              <div class="dialog-row">
                <span class="dialog-preview" [class.unread]="dialog.unread_count > 0">
                  <span *ngIf="dialog.last_message_sender === currentUser?.name" class="you-label">Вы: </span>
                  {{ getDialogPreviewText(dialog.last_message_content) }}
                </span>
                <div class="dialog-item-actions">
                  <span class="unread-badge" *ngIf="dialog.unread_count > 0" [matBadge]="dialog.unread_count" matBadgeColor="warn"></span>
                  <button type="button" class="btn-dialog-trash" (click)="openClearChatModal(dialog, $event)" title="Очистить чат">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right pane: Current chat messages -->
      <div class="chat-pane">
        <ng-container *ngIf="selectedDialog; else noSelectedDialog">
          <!-- Chat header -->
          <div class="chat-header">
            <div class="chat-header-user">
              <div class="chat-header-avatar">
                <div class="avatar-container" *ngIf="getResolvedAvatar(selectedDialog.username, selectedDialog.avatar_url) && !avatarErrors.has(selectedDialog.username)">
                  <img [src]="getAvatarUrl(getResolvedAvatar(selectedDialog.username, selectedDialog.avatar_url))" (error)="avatarErrors.add(selectedDialog.username)" />
                </div>
                <div class="avatar-initials" *ngIf="!getResolvedAvatar(selectedDialog.username, selectedDialog.avatar_url) || avatarErrors.has(selectedDialog.username)">
                  {{ getInitials(selectedDialog.username) }}
                </div>
                <span class="status-dot online"></span>
              </div>
              <div class="chat-header-info">
                <span class="chat-title">{{ selectedDialog.username }}</span>
                <span class="chat-status" [class.temp-chat]="selectedDialog.isTemp">
                  <span class="status-dot-mini" [class.temp]="selectedDialog.isTemp"></span>
                  {{ selectedDialog.isTemp ? 'Новый диалог' : 'в сети' }}
                </span>
              </div>
            </div>

            <div class="chat-header-actions">
              <button type="button" class="btn-clear-chat" (click)="openClearChatModal(selectedDialog)" title="Очистить историю чата">
                <mat-icon>delete_outline</mat-icon>
                <span>Очистить чат</span>
              </button>
            </div>
          </div>

          <!-- Messages stream -->
          <div class="chat-messages-container" #messagesContainer>
            <div class="messages-list">
              <div *ngIf="loadingHistory" class="history-spinner">
                <mat-spinner diameter="30"></mat-spinner>
              </div>

              <div *ngIf="!loadingHistory && messages.length === 0" class="empty-messages">
                <p>Напишите первое сообщение, чтобы начать диалог</p>
              </div>

              <div *ngFor="let message of messages; let idx = index; trackBy: trackByMessageId" 
                   class="message-row"
                   [class.outgoing]="message.sender_name === currentUser?.name">
                <div class="message-bubble">
                  <button type="button" 
                          *ngIf="message.id" 
                          class="msg-delete-btn" 
                          (click)="deleteSingleMessage(message, $event)" 
                          title="Удалить сообщение">
                    <mat-icon>delete_outline</mat-icon>
                  </button>

                  <ng-container *ngIf="parseMessage(message.content) as parsed">
                    <!-- Photo attachment -->
                    <div *ngIf="parsed.attachment && isImageAttachment(parsed.attachment)" class="msg-image-wrap">
                      <img [src]="getAttachmentUrl(parsed.attachment.url)" 
                           [alt]="parsed.attachment.file_name"
                           class="msg-image-thumb"
                           (click)="openImageModal(getAttachmentUrl(parsed.attachment.url))" />
                    </div>

                    <!-- File / Document attachment -->
                    <a *ngIf="parsed.attachment && !isImageAttachment(parsed.attachment)" 
                       [href]="getAttachmentUrl(parsed.attachment.url)" 
                       [download]="parsed.attachment.file_name"
                       target="_blank"
                       class="msg-file-card"
                       [class.outgoing-file]="message.sender_name === currentUser?.name">
                      <div class="file-icon-box">
                        <mat-icon>insert_drive_file</mat-icon>
                      </div>
                      <div class="file-card-info">
                        <span class="file-card-name" [title]="parsed.attachment.file_name">{{ parsed.attachment.file_name }}</span>
                        <span class="file-card-size">{{ formatFileSize(parsed.attachment.size) }}</span>
                      </div>
                      <div class="file-download-btn">
                        <mat-icon>download</mat-icon>
                      </div>
                    </a>

                    <!-- Text content -->
                    <div class="message-text" *ngIf="parsed.text">{{ parsed.text }}</div>
                  </ng-container>

                  <div class="message-meta">
                    <span class="message-time">{{ formatMessageTime(message.created_at) }}</span>
                    <mat-icon *ngIf="message.sender_name === currentUser?.name" 
                              class="message-status-icon"
                              [class.read]="message.is_read">
                      {{ message.is_read ? 'done_all' : 'done' }}
                    </mat-icon>
                  </div>
                </div>
              </div>

              <!-- Typing indicator (3 dots wave) -->
              <div class="typing-indicator-row" *ngIf="showTypingIndicator">
                <div class="typing-bubble">
                  <span class="typing-dot"></span>
                  <span class="typing-dot"></span>
                  <span class="typing-dot"></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Floating pill input bar & attachment preview -->
          <div class="chat-pill-wrapper">
            <!-- Pending attachment preview card -->
            <div class="attachment-preview-bar" *ngIf="selectedFile">
              <div class="attachment-chip">
                <div class="attachment-thumb" *ngIf="selectedFileIsImage && selectedFilePreview">
                  <img [src]="selectedFilePreview" alt="preview" />
                </div>
                <mat-icon *ngIf="!selectedFileIsImage" class="attachment-file-icon">insert_drive_file</mat-icon>
                <div class="attachment-details">
                  <span class="attachment-name">{{ selectedFile.name }}</span>
                  <span class="attachment-size">{{ formatFileSize(selectedFile.size) }}</span>
                </div>
                <button type="button" class="attachment-remove-btn" (click)="removeSelectedFile()" title="Удалить прикрепленный файл">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>

            <div class="chat-pill-input-bar">
              <input id="chatFileInput" 
                     #fileInput 
                     type="file" 
                     (change)="onFileSelected($event)" 
                     style="position: absolute; left: -9999px; opacity: 0; width: 1px; height: 1px; pointer-events: none;" />
              <label for="chatFileInput" 
                     class="pill-attach-btn" 
                     (click)="triggerFileInput($event)" 
                     [class.disabled]="sending" 
                     title="Прикрепить файл или фото">
                <mat-icon>attach_file</mat-icon>
              </label>
              <input type="text" 
                     [(ngModel)]="newMessageContent" 
                     (keyup.enter)="sendChatMessage()"
                     (paste)="onPaste($event)"
                     placeholder="Напишите сообщение..."
                     [disabled]="sending"
                     class="pill-input" />
              <button type="button" 
                      class="pill-send-btn" 
                      [class.active]="!!newMessageContent.trim() || !!selectedFile" 
                      [disabled]="(!newMessageContent.trim() && !selectedFile) || sending" 
                      (click)="sendChatMessage()"
                      title="Отправить сообщение">
                <mat-spinner diameter="18" *ngIf="sending" class="send-spinner"></mat-spinner>
                <mat-icon *ngIf="!sending">arrow_upward</mat-icon>
              </button>
            </div>
          </div>
        </ng-container>

        <!-- Placeholder when no chat is selected -->
        <ng-template #noSelectedDialog>
          <div class="no-chat-selected">
            <mat-icon>forum</mat-icon>
            <h3>Выберите диалог, чтобы начать общение</h3>
            <p>Вы можете написать преподавателям, сокурсникам или администраторам курса.</p>
          </div>
        </ng-template>
      </div>

      <!-- Full-screen Image Modal Preview -->
      <div class="image-modal-overlay" *ngIf="selectedModalImage" (click)="selectedModalImage = null">
        <div class="image-modal-content" (click)="$event.stopPropagation()">
          <img [src]="selectedModalImage" class="modal-large-img" />
          <button type="button" class="modal-close-btn" (click)="selectedModalImage = null" title="Закрыть">
            <mat-icon>close</mat-icon>
          </button>
          <a [href]="selectedModalImage" download target="_blank" class="modal-download-btn" title="Открыть в полном размере">
            <mat-icon>open_in_new</mat-icon>
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: calc(100vh - 112px);
      box-sizing: border-box;
    }

    .chat-wrapper {
      display: flex;
      height: 100%;
      max-height: 860px;
      width: 100%;
      max-width: 1080px;
      margin: 0 auto;
      background: rgba(255, 255, 255, 0.42);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.65);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.08);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    /* Sidebar styles */
    .dialogs-sidebar {
      width: 330px;
      min-width: 330px;
      border-right: 1px solid rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
      background: rgba(255, 255, 255, 0.62);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }
    .sidebar-header {
      padding: 24px 20px 14px;
    }
    .sidebar-title {
      margin: 0;
      font-family: 'Newsreader', 'Playfair Display', Georgia, serif;
      font-weight: 500;
      color: #111111;
      font-size: 26px;
      letter-spacing: -0.01em;
    }
    .search-box {
      padding: 0 16px 14px;
      position: relative;
    }
    .custom-search-pill {
      display: flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.82);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 12px;
      padding: 8px 14px;
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
    }
    .custom-search-pill:focus-within {
      border-color: #111111;
      box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.05);
    }
    .search-icon {
      color: #8e8e93;
      font-size: 20px;
      width: 20px;
      height: 20px;
      margin-right: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .search-input {
      border: none;
      outline: none;
      background: transparent;
      width: 100%;
      font-size: 14px;
      color: #111111;
    }
    .search-input::placeholder {
      color: #8e8e93;
    }

    /* Autocomplete dropdown styles with slide down + fade */
    ::ng-deep .search-autocomplete-panel {
      animation: dropdownSlideFade 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important;
      border-radius: 16px !important;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08) !important;
      border: 1px solid #eaeaea !important;
      overflow: hidden !important;
      background: #ffffff !important;
      margin-top: 6px !important;
      padding: 6px 0 !important;
    }
    @keyframes dropdownSlideFade {
      0% {
        opacity: 0;
        transform: translateY(-8px) scale(0.98);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .user-option-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 4px 0;
    }
    .user-option-name {
      font-size: 14px;
      font-weight: 500;
      color: #111111;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .no-results-text {
      font-size: 13px;
      color: #8e8e93;
    }

    .dialogs-list {
      flex: 1;
      overflow-y: auto;
    }
    .dialogs-spinner {
      display: flex;
      justify-content: center;
      padding: 40px 0;
    }
    .empty-dialogs {
      text-align: center;
      padding: 48px 20px;
      color: #8e8e93;
    }
    .empty-dialogs mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      margin-bottom: 8px;
      color: #d1d5db;
    }

    .dialog-item {
      position: relative;
      display: flex;
      align-items: center;
      padding: 12px 16px;
      gap: 12px;
      cursor: pointer;
      transition: background 0.15s ease;
      border-bottom: 1px solid rgba(0, 0, 0, 0.03);
    }
    .dialog-item:hover {
      background: rgba(255, 255, 255, 0.6);
    }
    .dialog-item.active {
      background: rgba(255, 255, 255, 0.85);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    }
    .active-indicator {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: #111111;
      border-radius: 0 2px 2px 0;
    }

    .dialog-avatar {
      position: relative;
      flex-shrink: 0;
    }
    .avatar-container, .avatar-initials {
      width: 44px;
      height: 44px;
      min-width: 44px;
      min-height: 44px;
      max-width: 44px;
      max-height: 44px;
      aspect-ratio: 1 / 1;
      border-radius: 50%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .avatar-container {
      background: #f4f4f5;
    }
    .avatar-container img {
      width: 100%;
      height: 100%;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      display: block;
      border-radius: 50%;
    }
    .avatar-initials {
      background: #e4e4e7;
      color: #3f3f46;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .avatar-mini, .avatar-mini-initials {
      width: 32px;
      height: 32px;
      min-width: 32px;
      min-height: 32px;
      max-width: 32px;
      max-height: 32px;
      aspect-ratio: 1 / 1;
      border-radius: 50%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .avatar-mini {
      background: #f4f4f5;
    }
    .avatar-mini img {
      width: 100%;
      height: 100%;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      display: block;
      border-radius: 50%;
    }
    .avatar-mini-initials {
      background: #e4e4e7;
      color: #3f3f46;
      font-size: 12px;
      font-weight: 600;
    }

    /* Online status pulsating dot */
    .status-dot {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      background: #22c55e;
      z-index: 1;
    }
    .status-dot.online {
      animation: pulseAura 2s infinite ease-in-out;
    }
    @keyframes pulseAura {
      0% {
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
      }
      70% {
        box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
      }
    }

    .dialog-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 3px;
      overflow: hidden;
    }
    .dialog-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .dialog-name {
      font-weight: 500;
      color: #111111;
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .dialog-time {
      font-size: 11px;
      color: #8e8e93;
      white-space: nowrap;
    }
    .dialog-preview {
      font-size: 13px;
      color: #71717a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 170px;
    }
    .dialog-preview.unread {
      color: #111111;
      font-weight: 600;
    }
    .you-label {
      color: #71717a;
      font-weight: 500;
    }
    .dialog-item-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-dialog-trash {
      opacity: 0;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 3px;
      color: #9ca3af;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
    }
    .btn-dialog-trash mat-icon {
      font-size: 17px;
      width: 17px;
      height: 17px;
    }
    .dialog-item:hover .btn-dialog-trash {
      opacity: 1;
    }
    .btn-dialog-trash:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.08);
    }
    .unread-badge {
      margin-right: 4px;
    }

    /* Right Chat Pane styles */
    .chat-pane {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: transparent;
      position: relative;
    }
    .chat-header {
      background: rgba(255, 255, 255, 0.65);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      padding: 14px 28px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .chat-header-user {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .chat-header-avatar {
      position: relative;
    }
    .chat-header-avatar .avatar-container, 
    .chat-header-avatar .avatar-initials {
      width: 40px;
      height: 40px;
      min-width: 40px;
      min-height: 40px;
      max-width: 40px;
      max-height: 40px;
      font-size: 13px;
    }
    .chat-header-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .chat-title {
      font-weight: 600;
      color: #111111;
      font-size: 15px;
    }
    .chat-status {
      font-size: 12px;
      color: #22c55e;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .status-dot-mini {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #22c55e;
      display: inline-block;
    }
    .status-dot-mini.temp {
      background: #f59e0b;
    }
    .chat-status.temp-chat {
      color: #f59e0b;
    }
    .btn-clear-chat {
      display: flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 500;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-clear-chat mat-icon {
      font-size: 17px;
      width: 17px;
      height: 17px;
    }
    .btn-clear-chat:hover {
      border-color: #fca5a5;
      color: #ef4444;
      background: rgba(239, 68, 68, 0.05);
    }

    /* Messages stream & Animation */
    .chat-messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
      box-sizing: border-box;
      animation: chatFadeIn 0.25s ease-out;
    }
    @keyframes chatFadeIn {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .messages-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    }
    .history-spinner {
      display: flex;
      justify-content: center;
      padding: 20px 0;
    }
    .empty-messages {
      text-align: center;
      padding: 60px 20px;
      color: #8e8e93;
      font-size: 14px;
    }
    .message-row {
      display: flex;
      width: 100%;
      justify-content: flex-start;
    }
    .message-row.outgoing {
      justify-content: flex-end;
    }

    /* Message bubbles with Spring animation */
    @keyframes messageSpring {
      0% {
        opacity: 0;
        transform: translateY(16px) scale(0.94);
      }
      60% {
        opacity: 1;
        transform: translateY(-2px) scale(1.01);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .message-bubble {
      position: relative;
      max-width: 68%;
      padding: 10px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-radius: 18px;
      animation: messageSpring 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    /* Outgoing: Dark #111, clean symmetrical 18px radius */
    .message-row.outgoing .message-bubble {
      background: #111111;
      color: #ffffff;
      border-radius: 18px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
    }

    /* Incoming: Glass white with backdrop-blur, clean symmetrical 18px radius */
    .message-row:not(.outgoing) .message-bubble {
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: #111111;
      border: 1px solid rgba(255, 255, 255, 0.85);
      border-radius: 18px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
    }

    .message-text {
      font-size: 14px;
      line-height: 1.5;
      word-break: break-word;
      white-space: pre-wrap;
    }

    /* Attached image styling */
    .msg-image-wrap {
      border-radius: 12px;
      overflow: hidden;
      max-width: 320px;
      cursor: pointer;
      margin-bottom: 4px;
    }
    .msg-image-thumb {
      width: 100%;
      max-height: 280px;
      object-fit: cover;
      display: block;
      border-radius: 12px;
      transition: transform 0.2s ease;
    }
    .msg-image-thumb:hover {
      transform: scale(1.02);
    }

    /* Attached document card styling */
    .msg-file-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 12px;
      text-decoration: none;
      color: inherit;
      margin-bottom: 4px;
      max-width: 320px;
      transition: background 0.15s ease;
    }
    .msg-file-card:hover {
      background: rgba(0, 0, 0, 0.08);
    }
    .msg-file-card.outgoing-file {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }
    .msg-file-card.outgoing-file:hover {
      background: rgba(255, 255, 255, 0.22);
    }
    .file-icon-box {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .outgoing-file .file-icon-box {
      background: rgba(255, 255, 255, 0.2);
    }
    .file-icon-box mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .file-card-info {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .file-card-name {
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .file-card-size {
      font-size: 11px;
      opacity: 0.65;
    }
    .file-download-btn {
      opacity: 0.7;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .file-download-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* Time and read receipts appear ONLY ON HOVER */
    .message-meta {
      display: flex;
      align-self: flex-end;
      align-items: center;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s ease;
      height: 14px;
      margin-top: 2px;
      margin-left: 8px;
    }
    .message-bubble:hover .message-meta {
      opacity: 1;
    }

    .message-time {
      font-size: 10px;
    }
    .message-row.outgoing .message-time {
      color: #9ca3af;
    }
    .message-row:not(.outgoing) .message-time {
      color: #8e8e93;
    }

    .message-status-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
      color: #9ca3af;
    }
    .message-status-icon.read {
      color: #38bdf8;
    }

    /* Delete message icon button on hover */
    .msg-delete-btn {
      position: absolute;
      top: -10px;
      background: #ffffff;
      border: 1px solid #eaeaea;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #9ca3af;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      opacity: 0;
      transition: all 0.15s ease;
      z-index: 2;
    }
    .message-row.outgoing .msg-delete-btn {
      left: -12px;
    }
    .message-row:not(.outgoing) .msg-delete-btn {
      right: -12px;
    }
    .message-bubble:hover .msg-delete-btn {
      opacity: 0.85;
    }
    .msg-delete-btn:hover {
      opacity: 1 !important;
      color: #ef4444;
      transform: scale(1.1);
    }
    .msg-delete-btn mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    /* Typing indicator: 3 bouncing dots wave */
    .typing-indicator-row {
      display: flex;
      width: 100%;
      justify-content: flex-start;
      margin-top: 4px;
      animation: messageSpring 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }
    .typing-bubble {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 10px 16px;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 0, 0, 0.05);
      border-radius: 18px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    }
    .typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #71717a;
      display: inline-block;
      animation: typingWave 1.4s infinite ease-in-out;
    }
    .typing-dot:nth-child(1) { animation-delay: 0s; }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typingWave {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.35;
      }
      30% {
        transform: translateY(-5px);
        opacity: 1;
      }
    }

    /* Floating Pill Input Bar */
    .chat-pill-wrapper {
      padding: 14px 24px 20px;
      background: transparent;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      width: 100%;
      box-sizing: border-box;
    }

    /* Pending attachment chip preview */
    .attachment-preview-bar {
      width: 100%;
      display: flex;
      justify-content: flex-start;
      animation: dropdownSlideFade 0.2s ease-out;
    }
    .attachment-chip {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 14px;
      padding: 6px 12px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
      max-width: 320px;
    }
    .attachment-thumb {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
    }
    .attachment-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .attachment-file-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: #4b5563;
    }
    .attachment-details {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .attachment-name {
      font-size: 12px;
      font-weight: 500;
      color: #111111;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .attachment-size {
      font-size: 10px;
      color: #8e8e93;
    }
    .attachment-remove-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #8e8e93;
      border-radius: 50%;
      transition: color 0.15s;
    }
    .attachment-remove-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .attachment-remove-btn:hover {
      color: #ef4444;
    }

    .chat-pill-input-bar {
      width: 100%;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 9999px;
      padding: 6px 10px 6px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      transition: all 0.2s ease;
      box-sizing: border-box;
    }
    .chat-pill-input-bar:focus-within {
      border-color: #111111;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08);
    }
    .pill-attach-btn {
      background: transparent;
      border: none;
      color: #71717a;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
      border-radius: 50%;
      transition: color 0.15s, transform 0.15s;
      user-select: none;
    }
    .pill-attach-btn.disabled {
      opacity: 0.4;
      pointer-events: none;
    }
    .pill-attach-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .pill-attach-btn:hover {
      color: #111111;
      transform: scale(1.1);
    }
    .pill-input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-size: 14px;
      color: #111111;
      padding: 6px 0;
    }
    .pill-input::placeholder {
      color: #8e8e93;
    }

    /* Send button: scale up on text, scale on hover */
    .pill-send-btn {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #111111;
      color: #ffffff;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s, opacity 0.2s;
      transform: scale(0.85);
      opacity: 0.45;
    }
    .pill-send-btn.active {
      transform: scale(1);
      opacity: 1;
    }
    .pill-send-btn.active:hover {
      transform: scale(1.12);
      background: #000000;
    }
    .pill-send-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .send-spinner {
      display: inline-block;
    }
    ::ng-deep .send-spinner circle {
      stroke: #ffffff !important;
    }

    /* Fullscreen image modal overlay */
    .image-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: modalFadeIn 0.2s ease-out;
    }
    @keyframes modalFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .image-modal-content {
      position: relative;
      max-width: 90vw;
      max-height: 90vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-large-img {
      max-width: 90vw;
      max-height: 85vh;
      border-radius: 12px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
      object-fit: contain;
    }
    .modal-close-btn, .modal-download-btn {
      position: absolute;
      top: -44px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .modal-close-btn:hover, .modal-download-btn:hover {
      background: rgba(255, 255, 255, 0.35);
    }
    .modal-close-btn {
      right: 0;
    }
    .modal-download-btn {
      right: 46px;
    }
    .modal-close-btn mat-icon, .modal-download-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    /* Placeholder when no chat is selected */
    .no-chat-selected {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #8e8e93;
      text-align: center;
      padding: 40px;
    }
    .no-chat-selected mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #d1d5db;
      margin-bottom: 16px;
    }
    .no-chat-selected h3 {
      font-size: 18px;
      font-weight: 500;
      margin: 0 0 8px;
      color: #111111;
    }
  `]
})
export class P2pChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') private messagesContainer?: ElementRef;
  @ViewChild('fileInput') private fileInputRef?: ElementRef<HTMLInputElement>;

  currentUser: any = null;
  dialogs: Dialog[] = [];
  messages: Message[] = [];
  selectedDialog: Dialog | null = null;
  newMessageContent: string = '';
  
  loadingDialogs: boolean = false;
  loadingHistory: boolean = false;
  sending: boolean = false;

  searchControl = new FormControl('');
  foundUsers: any[] = [];
  avatarErrors = new Set<string>();
  userAvatarMap = new Map<string, string>();
  showTypingIndicator: boolean = false;
  private typingTimer?: any;

  selectedFile: File | null = null;
  selectedFilePreview: string | null = null;
  selectedFileIsImage: boolean = false;
  uploadingFile: boolean = false;
  selectedModalImage: string | null = null;

  private pollingSub?: Subscription;
  private routeParamSub?: Subscription;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    if (this.currentUser?.avatar_url) {
      this.userAvatarMap.set(this.currentUser.name, this.currentUser.avatar_url);
    }

    // Preload users into avatar map to ensure avatars show immediately
    this.apiService.getUsers().subscribe({
      next: (users) => {
        if (Array.isArray(users)) {
          users.forEach((u: any) => {
            if (u.name && u.avatar_url) {
              this.userAvatarMap.set(u.name, u.avatar_url);
            }
          });
          if (this.currentUser && !this.currentUser.avatar_url && this.userAvatarMap.has(this.currentUser.name)) {
            this.currentUser.avatar_url = this.userAvatarMap.get(this.currentUser.name);
          }
          this.cdr.markForCheck();
        }
      },
      error: () => {}
    });

    // Set up user search autocomplete (triggers from 1st character)
    this.searchControl.valueChanges.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(value => {
        const query = typeof value === 'string' ? value.trim() : '';
        if (query.length >= 1) {
          const queryLower = query.toLowerCase();
          return this.apiService.getUsers(query).pipe(
            map(users => users.filter((u: any) => 
              u.name !== this.currentUser?.name && 
              u.name.toLowerCase().includes(queryLower)
            )),
            catchError(() => of([]))
          );
        }
        return of([]);
      })
    ).subscribe(users => {
      this.foundUsers = users;
      this.cdr.markForCheck();
    });

    // Load initial dialogs
    this.loadDialogs(() => {
      // Handle route query params (?chatWith=username)
      this.routeParamSub = this.route.queryParams.subscribe(params => {
        const chatWith = params['chatWith'];
        if (chatWith) {
          this.openChatWithUser(chatWith);
        }
      });
    });

    // Start background polling every 2 seconds for real-time synchronization
    this.pollingSub = interval(2000).subscribe(() => {
      this.pollUpdates();
    });
  }

  ngOnDestroy() {
    if (this.pollingSub) this.pollingSub.unsubscribe();
    if (this.routeParamSub) this.routeParamSub.unsubscribe();
  }

  loadDialogs(callback?: () => void) {
    this.loadingDialogs = this.dialogs.length === 0;
    this.apiService.getDialogs().subscribe({
      next: (dialogs) => {
        this.dialogs = dialogs.map((d: any) => {
          const resolvedAvatar = d.avatar_url || this.userAvatarMap.get(d.username);
          if (resolvedAvatar) {
            this.userAvatarMap.set(d.username, resolvedAvatar);
          }
          return {
            ...d,
            avatar_url: resolvedAvatar,
            last_message_time: d.last_message_time ? new Date(d.last_message_time) : null
          };
        });
        this.loadingDialogs = false;
        this.cdr.markForCheck();
        if (callback) callback();
      },
      error: (err) => {
        console.error('Error loading dialogs:', err);
        this.loadingDialogs = false;
        this.cdr.markForCheck();
      }
    });
  }

  openChatWithUser(username: string) {
    const existing = this.dialogs.find(d => d.username === username);
    if (existing) {
      this.selectDialog(existing);
    } else {
      // Find user details to create a temporary dialog
      this.apiService.getUserByName(username).subscribe({
        next: (user) => {
          const resolvedAvatar = user.avatar_url || this.userAvatarMap.get(user.name);
          if (resolvedAvatar) {
            this.userAvatarMap.set(user.name, resolvedAvatar);
          }
          const tempDialog: Dialog = {
            username: user.name,
            last_message_content: '',
            last_message_time: new Date(),
            last_message_sender: '',
            unread_count: 0,
            avatar_url: resolvedAvatar,
            isTemp: true
          };
          this.dialogs.unshift(tempDialog);
          this.selectDialog(tempDialog);
        },
        error: () => {
          // Fallback if user details fail
          const tempDialog: Dialog = {
            username: username,
            last_message_content: '',
            last_message_time: new Date(),
            last_message_sender: '',
            unread_count: 0,
            avatar_url: this.userAvatarMap.get(username),
            isTemp: true
          };
          this.dialogs.unshift(tempDialog);
          this.selectDialog(tempDialog);
        }
      });
    }
  }

  selectDialog(dialog: Dialog) {
    this.selectedDialog = dialog;
    this.messages = [];
    this.showTypingIndicator = false;
    clearTimeout(this.typingTimer);
    this.loadingHistory = true;
    
    // Clear route query params silently to clean url
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { chatWith: null },
      queryParamsHandling: 'merge'
    });

    this.loadChatHistory(dialog.username, () => {
      this.loadingHistory = false;
      this.scrollToBottom(true);
      // Mark read
      if (dialog.unread_count > 0) {
        dialog.unread_count = 0;
        this.apiService.markChatRead(dialog.username).subscribe();
      }
    });
  }

  loadChatHistory(username: string, callback?: () => void) {
    this.apiService.getChatHistory(username).subscribe({
      next: (messages) => {
        this.messages = messages.map((m: any) => ({
          ...m,
          created_at: new Date(m.created_at)
        }));
        this.cdr.markForCheck();
        if (callback) callback();
      },
      error: (err) => {
        console.error('Error loading chat history:', err);
        if (callback) callback();
      }
    });
  }

  pollUpdates() {
    // Poll dialogs list
    this.apiService.getDialogs().subscribe(dialogs => {
      dialogs.forEach((updated: any) => {
        const resolvedAvatar = updated.avatar_url || this.userAvatarMap.get(updated.username);
        if (resolvedAvatar) {
          this.userAvatarMap.set(updated.username, resolvedAvatar);
        }
        const match = this.dialogs.find(d => d.username === updated.username);
        if (match) {
          match.last_message_content = updated.last_message_content;
          match.last_message_time = new Date(updated.last_message_time);
          match.last_message_sender = updated.last_message_sender;
          if (resolvedAvatar && !match.avatar_url) {
            match.avatar_url = resolvedAvatar;
          }
          
          if (this.selectedDialog?.username !== updated.username) {
            match.unread_count = updated.unread_count;
          }
        } else {
          this.dialogs.push({
            ...updated,
            avatar_url: resolvedAvatar,
            last_message_time: new Date(updated.last_message_time)
          });
        }
      });

      this.dialogs.sort((a, b) => {
        const timeA = a.last_message_time?.getTime() || 0;
        const timeB = b.last_message_time?.getTime() || 0;
        return timeB - timeA;
      });

      this.cdr.markForCheck();
    });

    // Poll current chat history if a dialog is active
    if (this.selectedDialog) {
      const activeUser = this.selectedDialog.username;
      this.apiService.getChatHistory(activeUser).subscribe(messages => {
        // Smart diff: only replace array when message IDs or statuses changed to eliminate flicker
        const hasChanges = messages.length !== this.messages.length ||
          messages.some((m: any, i: number) => {
            const current = this.messages[i];
            return !current || current.id !== m.id || current.is_read !== m.is_read;
          });

        if (hasChanges) {
          const prevLength = this.messages.length;
          this.messages = messages.map((m: any) => ({
            ...m,
            created_at: new Date(m.created_at)
          }));
          
          this.cdr.markForCheck();

          if (messages.length > prevLength) {
            this.scrollToBottom();
            this.apiService.markChatRead(activeUser).subscribe();
          }
        }
      });
    }
  }

  sendChatMessage() {
    const textContent = this.newMessageContent.trim();
    if ((!textContent && !this.selectedFile) || !this.selectedDialog || this.sending) return;

    const recipient = this.selectedDialog.username;
    const fileToUpload = this.selectedFile;
    
    this.newMessageContent = '';
    this.selectedFile = null;
    this.selectedFilePreview = null;
    this.selectedFileIsImage = false;
    this.sending = true;

    const proceedWithSend = (attachment?: ChatAttachment) => {
      const payloadContent = attachment
        ? JSON.stringify({ text: textContent, attachment })
        : textContent;

      const tempMsg: Message = {
        sender_name: this.currentUser.name,
        recipient_name: recipient,
        content: payloadContent,
        is_read: false,
        created_at: new Date()
      };
      this.messages.push(tempMsg);
      this.scrollToBottom();

      clearTimeout(this.typingTimer);
      this.typingTimer = setTimeout(() => {
        if (this.selectedDialog?.username === recipient) {
          this.showTypingIndicator = true;
          this.scrollToBottom();
          this.cdr.markForCheck();
          setTimeout(() => {
            this.showTypingIndicator = false;
            this.cdr.markForCheck();
          }, 2200);
        }
      }, 800);

      this.apiService.sendMessage(recipient, payloadContent).subscribe({
        next: (res) => {
          this.sending = false;
          tempMsg.id = res.id;
          tempMsg.created_at = new Date(res.created_at);
          
          if (this.selectedDialog) {
            this.selectedDialog.isTemp = false;
            this.selectedDialog.last_message_content = payloadContent;
            this.selectedDialog.last_message_time = tempMsg.created_at;
            this.selectedDialog.last_message_sender = this.currentUser.name;
          }

          this.cdr.markForCheck();
        },
        error: (err) => {
          this.sending = false;
          console.error('Error sending message:', err);
          this.snackBar.open('Не удалось отправить сообщение: ' + (err.error?.detail || err.message), 'OK', { duration: 3000 });
          this.messages = this.messages.filter(m => m !== tempMsg);
          this.cdr.markForCheck();
        }
      });
    };

    if (fileToUpload) {
      this.uploadingFile = true;
      this.apiService.uploadChatFile(fileToUpload).subscribe({
        next: (uploaded) => {
          this.uploadingFile = false;
          proceedWithSend({
            url: uploaded.url,
            file_name: uploaded.file_name,
            content_type: uploaded.content_type,
            size: uploaded.size
          });
        },
        error: (err) => {
          this.uploadingFile = false;
          this.sending = false;
          console.error('Error uploading file:', err);
          this.snackBar.open('Не удалось загрузить файл: ' + (err.error?.detail || err.message), 'OK', { duration: 3000 });
          this.cdr.markForCheck();
        }
      });
    } else {
      proceedWithSend();
    }
  }

  trackByMessageId(index: number, message: Message): string {
    return message.id || `${message.sender_name}-${message.created_at?.getTime?.() || index}`;
  }

  getResolvedAvatar(username?: string, existingUrl?: string): string | undefined {
    if (!username) return existingUrl;
    if (this.currentUser && this.currentUser.name === username && this.currentUser.avatar_url) {
      return this.currentUser.avatar_url;
    }
    return existingUrl || this.userAvatarMap.get(username);
  }

  getDialogPreviewText(content: string): string {
    if (!content) return 'Нет сообщений';
    const parsed = this.parseMessage(content);
    if (parsed.attachment) {
      if (this.isImageAttachment(parsed.attachment)) {
        return parsed.text ? `[Фото] ${parsed.text}` : '📷 Фотография';
      }
      return parsed.text ? `[Файл] ${parsed.text}` : `📎 ${parsed.attachment.file_name}`;
    }
    return content;
  }

  parseMessage(content: string): ParsedMessageContent {
    if (!content) return { text: '' };
    if (content.startsWith('{') && content.includes('"attachment"')) {
      try {
        const data = JSON.parse(content);
        if (data && (data.attachment || data.text !== undefined)) {
          return {
            text: data.text || '',
            attachment: data.attachment
          };
        }
      } catch (e) {}
    }
    return { text: content };
  }

  isImageAttachment(attachment: ChatAttachment): boolean {
    if (!attachment) return false;
    if (attachment.content_type && attachment.content_type.startsWith('image/')) return true;
    const name = (attachment.file_name || attachment.url || '').toLowerCase();
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(name);
  }

  formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  triggerFileInput(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    const input = this.fileInputRef?.nativeElement || (document.getElementById('chatFileInput') as HTMLInputElement);
    if (input) {
      input.click();
    }
  }

  onFileSelected(event: any) {
    const file = event.target?.files?.[0];
    if (file) {
      this.handleFileChosen(file);
    }
    if (event.target) {
      event.target.value = '';
    }
  }

  onPaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          this.handleFileChosen(file);
          event.preventDefault();
          break;
        }
      }
    }
  }

  handleFileChosen(file: File) {
    if (file.size > 50 * 1024 * 1024) {
      this.snackBar.open('Файл слишком большой. Максимальный размер 50 МБ.', 'OK', { duration: 3000 });
      return;
    }
    this.selectedFile = file;
    this.selectedFileIsImage = file.type.startsWith('image/');
    if (this.selectedFileIsImage) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.selectedFilePreview = e.target.result;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    } else {
      this.selectedFilePreview = null;
    }
    this.cdr.markForCheck();
  }

  removeSelectedFile() {
    this.selectedFile = null;
    this.selectedFilePreview = null;
    this.selectedFileIsImage = false;
    this.cdr.markForCheck();
  }

  openImageModal(url: string | undefined) {
    if (url) {
      this.selectedModalImage = url;
      this.cdr.markForCheck();
    }
  }

  openClearChatModal(dialog: Dialog | null, event?: Event) {
    if (event) event.stopPropagation();
    if (!dialog) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Очистить историю чата?',
        message: `Вы действительно хотите удалить все сообщения в диалоге с ${dialog.username}? Это действие нельзя отменить.`,
        confirmText: 'Удалить',
        cancelText: 'Отмена',
        isDestructive: true,
        icon: 'delete_forever'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.clearChat(dialog);
      }
    });
  }

  clearChat(dialog: Dialog) {
    this.apiService.clearChatHistory(dialog.username).subscribe({
      next: () => {
        this.snackBar.open(`Чат с ${dialog.username} очищен`, 'OK', { duration: 3000 });
        this.dialogs = this.dialogs.filter(d => d.username !== dialog.username);
        if (this.selectedDialog?.username === dialog.username) {
          this.messages = [];
          this.selectedDialog = null;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error clearing chat:', err);
        this.snackBar.open('Не удалось очистить чат: ' + (err.error?.detail || err.message), 'OK', { duration: 3000 });
      }
    });
  }

  deleteSingleMessage(message: Message, event: Event) {
    event.stopPropagation();
    if (!message.id) return;

    this.apiService.deleteMessage(message.id).subscribe({
      next: () => {
        this.messages = this.messages.filter(m => m.id !== message.id);
        if (this.selectedDialog && this.messages.length > 0) {
          const last = this.messages[this.messages.length - 1];
          this.selectedDialog.last_message_content = last.content;
          this.selectedDialog.last_message_time = last.created_at;
          this.selectedDialog.last_message_sender = last.sender_name;
        } else if (this.selectedDialog) {
          this.selectedDialog.last_message_content = '';
        }
        this.snackBar.open('Сообщение удалено', 'OK', { duration: 2000 });
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error deleting message:', err);
        this.snackBar.open('Не удалось удалить сообщение', 'OK', { duration: 3000 });
      }
    });
  }

  getInitials(name: string | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  onUserSelected(event: any) {
    const selectedUsername = event.option.value;
    this.searchControl.setValue('');
    this.openChatWithUser(selectedUsername);
  }

  getAvatarUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/static')) return `/api${url}`;
    if (url.startsWith('/api/')) return url;
    return `/api/${url}`;
  }

  getAttachmentUrl(url: string | undefined): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/static')) return `/api${url}`;
    if (url.startsWith('/api/')) return url;
    return `/api/${url}`;
  }

  formatTime(date: Date): string {
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  }

  formatMessageTime(date: Date): string {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  scrollToBottom(immediate = false) {
    setTimeout(() => {
      const container = this.messagesContainer?.nativeElement;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: immediate ? 'auto' : 'smooth'
        });
      }
    }, 50);
  }
}

