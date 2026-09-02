import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  isStreaming?: boolean;
}

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  list_courses: { label: 'Курсы платформы', icon: 'school' },
  get_course_details: { label: 'Структура курса', icon: 'menu_book' },
  get_course_progress: { label: 'Прогресс обучения', icon: 'trending_up' },
  list_tests: { label: 'Тесты и дедлайны', icon: 'assignment' },
  get_my_submissions: { label: 'Сданные работы', icon: 'grade' },
  get_my_notifications: { label: 'Уведомления', icon: 'notifications' },
  get_my_points: { label: 'XP и рейтинг', icon: 'emoji_events' }
};

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatSelectModule,
    MatListModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="chat-container">
      <div class="chat-header-bar">
        <h1>🤖 ИИ-Агент EduAI-Hub</h1>
        <button mat-stroked-button color="warn" (click)="resetSession()" *ngIf="messages.length > 0" class="new-dialog-btn">
          <mat-icon>refresh</mat-icon>
          Новый диалог
        </button>
      </div>

      <mat-card *ngIf="subjects.length > 0" class="subject-card">
        <mat-card-content>
          <mat-form-field>
            <mat-label>Контекст курса (опционально)</mat-label>
            <mat-select [(ngModel)]="selectedSubjectId">
              <mat-option [value]="null">Все курсы</mat-option>
              <mat-option *ngFor="let subject of subjects" [value]="subject.id">
                {{ subject.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </mat-card-content>
      </mat-card>

      <mat-card class="chat-messages">
        <mat-card-content>
          <div class="messages-container">
            <div *ngIf="messages.length === 0" class="welcome-message">
              <h2>Чем я могу помочь вам сегодня?</h2>
              <p>Я автономный образовательный ассистент. Я могу самостоятельно обращаться к данным платформы:</p>
              <div class="suggestions-grid">
                <button mat-stroked-button (click)="useSuggestion('Какие курсы мне доступны?')">
                  <mat-icon>school</mat-icon> Какие курсы мне доступны?
                </button>
                <button mat-stroked-button (click)="useSuggestion('Какой у меня текущий прогресс?')">
                  <mat-icon>trending_up</mat-icon> Какой у меня текущий прогресс?
                </button>
                <button mat-stroked-button (click)="useSuggestion('Когда ближайшие дедлайны по тестам?')">
                  <mat-icon>alarm</mat-icon> Когда ближайшие дедлайны?
                </button>
                <button mat-stroked-button (click)="useSuggestion('Сколько у меня XP-баллов?')">
                  <mat-icon>emoji_events</mat-icon> Сколько у меня баллов?
                </button>
                <button mat-stroked-button (click)="useSuggestion('Есть ли новые уведомления?')">
                  <mat-icon>notifications</mat-icon> Есть ли новые уведомления?
                </button>
              </div>
            </div>

            <div *ngFor="let message of messages" [class]="'message ' + message.role">
              <div class="message-header">
                <strong>{{ message.role === 'user' ? 'Вы' : 'ИИ-Агент' }}</strong>
                <span class="timestamp">{{ formatTime(message.timestamp) }}</span>
              </div>

              <!-- Tool usage indicators in assistant message -->
              <div *ngIf="message.role === 'assistant' && message.toolsUsed && message.toolsUsed.length > 0" class="tools-badge-container">
                <span class="tools-badge-title">Использованные источники:</span>
                <div class="tools-chips">
                  <span *ngFor="let tool of message.toolsUsed" class="tool-chip">
                    <mat-icon class="chip-icon">{{ getToolInfo(tool).icon }}</mat-icon>
                    {{ getToolInfo(tool).label }}
                  </span>
                </div>
              </div>

              <div class="message-content" [innerHTML]="formatMessage(message.content)"></div>
            </div>

            <!-- Active Thinking / Tool Calling Indicator -->
            <div *ngIf="loading" class="agent-activity-banner">
              <mat-spinner diameter="24"></mat-spinner>
              <div class="agent-activity-text">
                <span class="activity-status">{{ activeStatusText }}</span>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="chat-input">
        <mat-card-content>
          <div class="input-container">
            <mat-form-field style="flex: 1;">
              <mat-label>Задайте вопрос агенту</mat-label>
              <input
                matInput
                [(ngModel)]="currentQuestion"
                (keyup.enter)="sendMessage()"
                [disabled]="loading"
                placeholder="Например: Какой у меня прогресс по курсам и есть ли горящие дедлайны?">
            </mat-form-field>
            <button
              mat-raised-button
              color="primary"
              (click)="sendMessage()"
              [disabled]="!currentQuestion.trim() || loading"
              style="margin-left: 10px;">
              <mat-icon>send</mat-icon>
              Отправить
            </button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .chat-container {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      height: calc(100vh - 120px);
    }
    .chat-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .chat-header-bar h1 {
      margin: 0;
      font-size: 1.6rem;
      color: #1a237e;
    }
    .new-dialog-btn {
      font-size: 0.85rem;
    }
    mat-card {
      margin-bottom: 12px;
    }
    .subject-card {
      border-radius: 10px;
    }
    .chat-messages {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }
    .chat-messages mat-card-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 0 !important;
      overflow: hidden;
    }
    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .message {
      padding: 16px 20px;
      border-radius: 16px;
      max-width: 85%;
      position: relative;
      line-height: 1.5;
      animation: fadeIn 0.2s ease-in-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .message.user {
      background: linear-gradient(135deg, #3f51b5, #303f9f);
      color: white;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
      box-shadow: 0 2px 6px rgba(63, 81, 181, 0.2);
    }
    .message.assistant {
      background-color: #f8f9fa;
      border: 1px solid #e9ecef;
      color: #212529;
      align-self: flex-start;
      border-bottom-left-radius: 4px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
    }
    .message-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 0.85em;
      opacity: 0.8;
    }
    .message-content {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 0.95rem;
    }
    .timestamp {
      font-size: 0.8em;
      margin-left: 12px;
    }
    .tools-badge-container {
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #dee2e6;
    }
    .tools-badge-title {
      font-size: 0.75rem;
      color: #6c757d;
      font-weight: 500;
      display: block;
      margin-bottom: 4px;
    }
    .tools-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .tool-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      background: #e8eaf6;
      color: #283593;
      padding: 3px 8px;
      border-radius: 12px;
      font-weight: 500;
    }
    .chip-icon {
      font-size: 14px;
      height: 14px;
      width: 14px;
    }
    .agent-activity-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 18px;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-radius: 12px;
      align-self: flex-start;
      color: #3730a3;
      font-size: 0.88rem;
      font-weight: 500;
      animation: pulse 1.5s infinite alternate;
    }
    @keyframes pulse {
      from { opacity: 0.85; }
      to { opacity: 1; }
    }
    .welcome-message {
      text-align: center;
      padding: 40px 20px;
      color: #495057;
    }
    .welcome-message h2 {
      margin-bottom: 12px;
      color: #1a237e;
    }
    .suggestions-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin-top: 24px;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }
    .suggestions-grid button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 20px;
      font-size: 0.85rem;
    }
    .chat-input {
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      margin-top: 8px;
    }
    .input-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    mat-form-field {
      width: 100%;
    }
    ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }
  `]
})
export class ChatComponent implements OnInit, OnDestroy {
  subjects: any[] = [];
  messages: ChatMessage[] = [];
  currentQuestion: string = '';
  selectedSubjectId: string | null = null;
  loading: boolean = false;
  activeStatusText: string = 'ИИ-Агент думает...';
  sessionId: string = this.generateSessionId();

  private streamSub?: Subscription;

  constructor(
    private apiService: ApiService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadSubjects();
  }

  ngOnDestroy() {
    if (this.streamSub) {
      this.streamSub.unsubscribe();
    }
  }

  generateSessionId(): string {
    return 'session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
  }

  resetSession() {
    this.messages = [];
    this.sessionId = this.generateSessionId();
    this.loading = false;
  }

  loadSubjects() {
    this.apiService.getSubjects().subscribe({
      next: (subjects) => {
        this.subjects = subjects || [];
      },
      error: (err) => console.error('Error loading subjects:', err)
    });
  }

  useSuggestion(text: string) {
    this.currentQuestion = text;
    this.sendMessage();
  }

  getToolInfo(toolName: string): { label: string; icon: string } {
    return TOOL_LABELS[toolName] || { label: toolName, icon: 'build' };
  }

  sendMessage() {
    if (!this.currentQuestion.trim() || this.loading) return;

    const question = this.currentQuestion.trim();
    this.currentQuestion = '';

    // Add user message
    this.messages.push({
      role: 'user',
      content: question,
      timestamp: new Date()
    });

    setTimeout(() => this.scrollToBottom(), 100);

    this.loading = true;
    this.activeStatusText = 'ИИ-Агент анализирует запрос...';

    const toolsCalled: string[] = [];
    let assistantMessageIndex = -1;
    const token = this.authService.getToken();

    this.streamSub = this.apiService.agentChatStream(
      question,
      this.sessionId,
      this.selectedSubjectId || undefined,
      token
    ).subscribe({
      next: (event) => {
        if (event.type === 'thinking') {
          this.activeStatusText = event.data?.message || 'ИИ-Агент планирует действия...';
        } else if (event.type === 'tool_call') {
          const toolName = event.data?.name || '';
          if (toolName && !toolsCalled.includes(toolName)) {
            toolsCalled.push(toolName);
          }
          const info = this.getToolInfo(toolName);
          this.activeStatusText = `Обращаюсь к сервису: ${info.label}...`;
        } else if (event.type === 'tool_result') {
          this.activeStatusText = 'Обрабатываю полученные данные...';
        } else if (event.type === 'token') {
          this.loading = false;
          if (assistantMessageIndex === -1) {
            this.messages.push({
              role: 'assistant',
              content: event.data?.text || '',
              timestamp: new Date(),
              toolsUsed: [...toolsCalled],
              isStreaming: true
            });
            assistantMessageIndex = this.messages.length - 1;
          } else {
            this.messages[assistantMessageIndex].content += (event.data?.text || '');
          }
          this.scrollToBottom();
        } else if (event.type === 'answer') {
          this.loading = false;
          const answerText = event.data?.text || '';
          if (assistantMessageIndex === -1) {
            this.messages.push({
              role: 'assistant',
              content: answerText,
              timestamp: new Date(),
              toolsUsed: [...toolsCalled],
              isStreaming: false
            });
          } else {
            this.messages[assistantMessageIndex].content = answerText;
            this.messages[assistantMessageIndex].isStreaming = false;
          }
          this.scrollToBottom();
        } else if (event.type === 'error') {
          this.loading = false;
          const errorMsg = event.data?.message || 'Произошла ошибка при обработке запроса.';
          this.messages.push({
            role: 'assistant',
            content: `⚠️ ${errorMsg}`,
            timestamp: new Date(),
            toolsUsed: [...toolsCalled]
          });
          this.scrollToBottom();
        } else if (event.type === 'done') {
          this.loading = false;
          if (assistantMessageIndex !== -1) {
            this.messages[assistantMessageIndex].isStreaming = false;
          }
          this.scrollToBottom();
        }
      },
      error: (err) => {
        this.loading = false;
        console.error('Agent chat stream error:', err);
        this.fallbackLegacyChat(question, toolsCalled);
      },
      complete: () => {
        this.loading = false;
        this.scrollToBottom();
      }
    });
  }

  private fallbackLegacyChat(question: string, toolsCalled: string[]) {
    this.apiService.chat(question, this.selectedSubjectId || undefined).subscribe({
      next: (response) => {
        this.messages.push({
          role: 'assistant',
          content: response.message || response.answer || 'Ответ получен.',
          timestamp: new Date(),
          toolsUsed: toolsCalled
        });
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: (err) => {
        this.messages.push({
          role: 'assistant',
          content: 'Извините, произошла ошибка подключения к сервису ассистента.',
          timestamp: new Date()
        });
        setTimeout(() => this.scrollToBottom(), 100);
      }
    });
  }

  formatMessage(content: string): string {
    if (!content) return '';
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  scrollToBottom() {
    const container = document.querySelector('.messages-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
}
