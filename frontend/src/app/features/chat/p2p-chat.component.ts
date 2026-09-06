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
                <div class="avatar-mini" *ngIf="user.avatar_url && !avatarErrors.has(user.name)">
                  <img [src]="getAvatarUrl(user.avatar_url)" (error)="avatarErrors.add(user.name)" />
                </div>
                <div class="avatar-mini-initials" *ngIf="!user.avatar_url || avatarErrors.has(user.name)">
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
              <div class="avatar-container" *ngIf="dialog.avatar_url && !avatarErrors.has(dialog.username)">
                <img [src]="getAvatarUrl(dialog.avatar_url)" (error)="avatarErrors.add(dialog.username)" />
              </div>
              <div class="avatar-initials" *ngIf="!dialog.avatar_url || avatarErrors.has(dialog.username)">
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
                  {{ dialog.last_message_content || 'Нет сообщений' }}
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
                <div class="avatar-container" *ngIf="selectedDialog.avatar_url && !avatarErrors.has(selectedDialog.username)">
                  <img [src]="getAvatarUrl(selectedDialog.avatar_url)" (error)="avatarErrors.add(selectedDialog.username)" />
                </div>
                <div class="avatar-initials" *ngIf="!selectedDialog.avatar_url || avatarErrors.has(selectedDialog.username)">
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

              <div *ngFor="let message of messages; let idx = index" 
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
                  <div class="message-text">{{ message.content }}</div>
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

          <!-- Floating pill input bar -->
          <div class="chat-pill-wrapper">
            <div class="chat-pill-input-bar">
              <input type="text" 
                     [(ngModel)]="newMessageContent" 
                     (keyup.enter)="sendChatMessage()"
                     placeholder="Напишите сообщение..."
                     [disabled]="sending"
                     class="pill-input" />
              <button type="button" 
                      class="pill-send-btn" 
                      [class.active]="!!newMessageContent.trim()" 
                      [disabled]="!newMessageContent.trim() || sending" 
                      (click)="sendChatMessage()"
                      title="Отправить сообщение">
                <mat-icon>arrow_upward</mat-icon>
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
    </div>
  `,
  styles: [`
    .chat-wrapper {
      display: flex;
      height: calc(100vh - 110px);
      background: #fafafa;
      border: 1px solid #eaeaea;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.04);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    /* Sidebar styles */
    .dialogs-sidebar {
      width: 330px;
      min-width: 330px;
      border-right: 1px solid #eaeaea;
      display: flex;
      flex-direction: column;
      background: #ffffff;
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
      background: #ffffff;
      border: 1px solid #dcdcdc;
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
      border-bottom: 1px solid #f7f7f8;
    }
    .dialog-item:hover {
      background: #f9fafb;
    }
    .dialog-item.active {
      background: #f0f0f2;
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
      background: #fafafa;
      position: relative;
    }
    .chat-header {
      background: #ffffff;
      padding: 14px 28px;
      border-bottom: 1px solid #eaeaea;
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
      padding: 24px 32px;
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
      gap: 10px;
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
      max-width: 65%;
      padding: 10px 18px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      animation: messageSpring 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    /* Outgoing: Dark #111, radius: 18px 18px 4px 18px */
    .message-row.outgoing .message-bubble {
      background: #111111;
      color: #ffffff;
      border-radius: 18px 18px 4px 18px;
      box-shadow: 0 3px 12px rgba(0, 0, 0, 0.12);
    }

    /* Incoming: Glass white with backdrop-blur, radius: 18px 18px 18px 4px */
    .message-row:not(.outgoing) .message-bubble {
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: #111111;
      border: 1px solid rgba(0, 0, 0, 0.05);
      border-radius: 18px 18px 18px 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    }

    .message-text {
      font-size: 14px;
      line-height: 1.5;
      word-break: break-word;
      white-space: pre-wrap;
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
      border-radius: 18px 18px 18px 4px;
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
      padding: 14px 28px 20px;
      background: transparent;
      display: flex;
      justify-content: center;
    }
    .chat-pill-input-bar {
      width: 100%;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 9999px;
      padding: 6px 10px 6px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      transition: all 0.2s ease;
    }
    .chat-pill-input-bar:focus-within {
      border-color: #111111;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08);
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
  showTypingIndicator: boolean = false;
  private typingTimer?: any;

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

    // Connect WebSocket for instant real-time message delivery
    this.connectWebSocket();

    // Start background polling every 2 seconds as fallback
    this.pollingSub = interval(2000).subscribe(() => {
      this.pollUpdates();
    });
  }

  private socket?: WebSocket;

  private connectWebSocket() {
    if (!this.currentUser?.name) return;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/chat?user=${encodeURIComponent(this.currentUser.name)}`;
      this.socket = new WebSocket(wsUrl);
      this.socket.onmessage = () => {
        this.pollUpdates();
      };
      this.socket.onerror = () => {};
    } catch (e) {
      console.log('WebSocket fallback to HTTP polling active');
    }
  }

  ngOnDestroy() {
    if (this.socket) {
      try { this.socket.close(); } catch (e) {}
    }
    if (this.pollingSub) this.pollingSub.unsubscribe();
    if (this.routeParamSub) this.routeParamSub.unsubscribe();
  }

  loadDialogs(callback?: () => void) {
    this.loadingDialogs = this.dialogs.length === 0;
    this.apiService.getDialogs().subscribe({
      next: (dialogs) => {
        // Map avatars if not present
        this.dialogs = dialogs.map((d: any) => ({
          ...d,
          last_message_time: d.last_message_time ? new Date(d.last_message_time) : null
        }));
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
          const tempDialog: Dialog = {
            username: user.name,
            last_message_content: '',
            last_message_time: new Date(),
            last_message_sender: '',
            unread_count: 0,
            avatar_url: user.avatar_url,
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
      // Update unread badges and previews
      dialogs.forEach((updated: any) => {
        const match = this.dialogs.find(d => d.username === updated.username);
        if (match) {
          match.last_message_content = updated.last_message_content;
          match.last_message_time = new Date(updated.last_message_time);
          match.last_message_sender = updated.last_message_sender;
          
          // Only update unread if we aren't currently reading this dialog
          if (this.selectedDialog?.username !== updated.username) {
            match.unread_count = updated.unread_count;
          }
        } else {
          // New dialog arrived
          this.dialogs.push({
            ...updated,
            last_message_time: new Date(updated.last_message_time)
          });
        }
      });

      // Sort dialogs by last message time
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
        const prevLength = this.messages.length;
        this.messages = messages.map((m: any) => ({
          ...m,
          created_at: new Date(m.created_at)
        }));
        
        this.cdr.markForCheck();

        // If new message arrived, scroll down
        if (messages.length > prevLength) {
          this.scrollToBottom();
          // Mark read immediately
          this.apiService.markChatRead(activeUser).subscribe();
        }
      });
    }
  }

  sendChatMessage() {
    if (!this.newMessageContent.trim() || !this.selectedDialog || this.sending) return;

    const content = this.newMessageContent.trim();
    const recipient = this.selectedDialog.username;
    this.newMessageContent = '';
    this.sending = true;

    // Add message locally for immediate display
    const tempMsg: Message = {
      sender_name: this.currentUser.name,
      recipient_name: recipient,
      content: content,
      is_read: false,
      created_at: new Date()
    };
    this.messages.push(tempMsg);
    this.scrollToBottom();

    // Trigger typing indicator 800ms after sending to simulate response/reading
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

    // Call API
    this.apiService.sendMessage(recipient, content).subscribe({
      next: (res) => {
        this.sending = false;
        // Update temporary message with real ID and timestamp
        tempMsg.id = res.id;
        tempMsg.created_at = new Date(res.created_at);
        
        // Remove temp state of dialog if applicable
        if (this.selectedDialog) {
          this.selectedDialog.isTemp = false;
          this.selectedDialog.last_message_content = content;
          this.selectedDialog.last_message_time = tempMsg.created_at;
          this.selectedDialog.last_message_sender = this.currentUser.name;
        }

        this.cdr.markForCheck();
      },
      error: (err) => {
        this.sending = false;
        console.error('Error sending message:', err);
        this.snackBar.open('Не удалось отправить сообщение: ' + (err.error?.detail || err.message), 'OK', { duration: 3000 });
        // Remove temp message on error
        this.messages = this.messages.filter(m => m !== tempMsg);
        this.cdr.markForCheck();
      }
    });
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
