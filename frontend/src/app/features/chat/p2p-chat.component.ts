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
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { interval, Subscription, of } from 'rxjs';
import { startWith, debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';

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
    MatSnackBarModule
  ],
  template: `
    <div class="chat-wrapper">
      <!-- Left sidebar: Dialogs list -->
      <div class="dialogs-sidebar">
        <div class="sidebar-header">
          <h2>Сообщения</h2>
        </div>

        <!-- Start new chat search box -->
        <div class="search-box">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Начать новый чат...</mat-label>
            <input matInput [formControl]="searchControl" [matAutocomplete]="auto" placeholder="Введите имя пользователя">
            <mat-icon matSuffix>search</mat-icon>
            <mat-autocomplete #auto="matAutocomplete" (optionSelected)="onUserSelected($event)">
              <mat-option *ngFor="let user of foundUsers" [value]="user.name">
                <div class="user-option">
                  <div class="avatar-mini" *ngIf="user.avatar_url">
                    <img [src]="getAvatarUrl(user.avatar_url)" (error)="user.avatar_url = undefined" />
                  </div>
                  <div class="avatar-mini-placeholder" *ngIf="!user.avatar_url">
                    <mat-icon>person</mat-icon>
                  </div>
                  <span>{{ user.name }}</span>
                </div>
              </mat-option>
              <mat-option *ngIf="foundUsers.length === 0 && searchControl.value" [disabled]="true">
                Пользователи не найдены
              </mat-option>
            </mat-autocomplete>
          </mat-form-field>
        </div>

        <!-- List of dialogs -->
        <div class="dialogs-list">
          <div *ngIf="loadingDialogs" class="dialogs-spinner">
            <mat-spinner diameter="35"></mat-spinner>
          </div>

          <div *ngIf="!loadingDialogs && dialogs.length === 0" class="empty-dialogs">
            <mat-icon>chat_bubble_outline</mat-icon>
            <p>У вас еще нет активных диалогов</p>
          </div>

          <div *ngFor="let dialog of dialogs" 
               class="dialog-item" 
               [class.active]="selectedDialog?.username === dialog.username"
               (click)="selectDialog(dialog)">
            
            <div class="dialog-avatar">
              <div class="avatar-container" *ngIf="dialog.avatar_url && !avatarErrors.has(dialog.username)">
                <img [src]="getAvatarUrl(dialog.avatar_url)" (error)="avatarErrors.add(dialog.username)" />
              </div>
              <div class="avatar-placeholder" *ngIf="!dialog.avatar_url || avatarErrors.has(dialog.username)">
                <mat-icon>person</mat-icon>
              </div>
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
                <span class="unread-badge" *ngIf="dialog.unread_count > 0" [matBadge]="dialog.unread_count" matBadgeColor="warn"></span>
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
            <div class="chat-header-avatar">
              <div class="avatar-container" *ngIf="selectedDialog.avatar_url && !avatarErrors.has(selectedDialog.username)">
                <img [src]="getAvatarUrl(selectedDialog.avatar_url)" (error)="avatarErrors.add(selectedDialog.username)" />
              </div>
              <div class="avatar-placeholder" *ngIf="!selectedDialog.avatar_url || avatarErrors.has(selectedDialog.username)">
                <mat-icon>person</mat-icon>
              </div>
            </div>
            <div class="chat-header-info">
              <span class="chat-title">{{ selectedDialog.username }}</span>
              <span class="chat-status" [class.temp-chat]="selectedDialog.isTemp">
                {{ selectedDialog.isTemp ? 'Новый диалог' : 'в сети' }}
              </span>
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
            </div>
          </div>

          <!-- Message input bar -->
          <div class="chat-input-bar">
            <mat-form-field appearance="outline" class="input-field">
              <input matInput 
                     [(ngModel)]="newMessageContent" 
                     (keyup.enter)="sendChatMessage()"
                     placeholder="Напишите сообщение..."
                     [disabled]="sending">
            </mat-form-field>
            <button mat-fab color="primary" 
                    [disabled]="!newMessageContent.trim() || sending" 
                    (click)="sendChatMessage()">
              <mat-icon>send</mat-icon>
            </button>
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
      height: calc(100vh - 120px);
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
    }

    /* Sidebar styles */
    .dialogs-sidebar {
      width: 320px;
      border-right: 1px solid #e0e0e0;
      display: flex;
      flex-direction: column;
      background: #f8f9fa;
    }
    .sidebar-header {
      padding: 20px 20px 10px;
    }
    .sidebar-header h2 {
      margin: 0;
      font-weight: 500;
      color: #202124;
      font-size: 20px;
    }
    .search-box {
      padding: 0 16px 10px;
    }
    .search-field {
      width: 100%;
    }
    ::ng-deep .search-field .mat-mdc-form-field-subscript-wrapper {
      display: none;
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
      padding: 40px 20px;
      color: #5f6368;
    }
    .empty-dialogs mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }
    .dialog-item {
      display: flex;
      padding: 12px 16px;
      gap: 12px;
      cursor: pointer;
      transition: background 0.2s;
      border-bottom: 1px solid #f1f3f4;
    }
    .dialog-item:hover {
      background: #f1f3f4;
    }
    .dialog-item.active {
      background: #e8f0fe;
    }
    .dialog-avatar {
      position: relative;
    }
    .avatar-container, .avatar-placeholder {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      overflow: hidden;
      background: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .avatar-container img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .avatar-placeholder mat-icon {
      color: #757575;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }
    .dialog-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
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
      color: #202124;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .dialog-time {
      font-size: 11px;
      color: #70757a;
      white-space: nowrap;
    }
    .dialog-preview {
      font-size: 13px;
      color: #5f6368;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 180px;
    }
    .dialog-preview.unread {
      color: #202124;
      font-weight: 500;
    }
    .you-label {
      color: #1a73e8;
      font-weight: 500;
    }
    .unread-badge {
      margin-right: 12px;
    }

    /* Right Chat Pane styles */
    .chat-pane {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #f1f3f4;
    }
    .chat-header {
      background: #ffffff;
      padding: 12px 24px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .chat-header-avatar .avatar-container, 
    .chat-header-avatar .avatar-placeholder {
      width: 40px;
      height: 40px;
    }
    .chat-header-info {
      display: flex;
      flex-direction: column;
    }
    .chat-title {
      font-weight: 500;
      color: #202124;
      font-size: 16px;
    }
    .chat-status {
      font-size: 12px;
      color: #34a853;
    }
    .chat-status.temp-chat {
      color: #fbbc05;
    }
    .chat-messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }
    .messages-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .history-spinner {
      display: flex;
      justify-content: center;
      padding: 20px 0;
    }
    .empty-messages {
      text-align: center;
      padding: 40px;
      color: #5f6368;
    }
    .message-row {
      display: flex;
      width: 100%;
      justify-content: flex-start;
    }
    .message-row.outgoing {
      justify-content: flex-end;
    }
    .message-bubble {
      max-width: 65%;
      padding: 10px 16px;
      border-radius: 16px;
      background: #ffffff;
      color: #202124;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .message-row.outgoing .message-bubble {
      background: #e8f0fe;
      border-bottom-right-radius: 4px;
    }
    .message-row:not(.outgoing) .message-bubble {
      border-bottom-left-radius: 4px;
    }
    .message-text {
      font-size: 14px;
      line-height: 1.5;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .message-meta {
      display: flex;
      align-self: flex-end;
      align-items: center;
      gap: 4px;
    }
    .message-time {
      font-size: 10px;
      color: #70757a;
    }
    .message-status-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #5f6368;
    }
    .message-status-icon.read {
      color: #1a73e8;
    }
    .chat-input-bar {
      background: #ffffff;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .input-field {
      flex: 1;
    }
    ::ng-deep .input-field .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }
    .no-chat-selected {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #5f6368;
      text-align: center;
      padding: 40px;
    }
    .no-chat-selected mat-icon {
      font-size: 72px;
      width: 72px;
      height: 72px;
      color: #bdc1c6;
      margin-bottom: 16px;
    }
    .no-chat-selected h3 {
      font-size: 20px;
      font-weight: 500;
      margin: 0 0 8px;
      color: #202124;
    }

    /* Autocomplete user option styles */
    .user-option {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .avatar-mini, .avatar-mini-placeholder {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      overflow: hidden;
      background: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .avatar-mini img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .avatar-mini-placeholder mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #757575;
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

  private pollingSub?: Subscription;
  private routeParamSub?: Subscription;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();

    // Set up user search autocomplete
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(value => {
        if (typeof value === 'string' && value.trim().length > 1) {
          return this.apiService.getUsers(value.trim()).pipe(
            catchError(() => of([]))
          );
        }
        return of([]);
      })
    ).subscribe(users => {
      // Exclude current user from search
      this.foundUsers = users.filter((u: any) => u.name !== this.currentUser?.name);
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
