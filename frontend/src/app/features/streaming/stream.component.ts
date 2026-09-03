import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import {
    Room,
    RoomEvent,
    RemoteParticipant,
    RemoteTrack,
    RemoteTrackPublication,
    Track,
    createLocalVideoTrack,
    createLocalAudioTrack,
    LocalVideoTrack,
    LocalAudioTrack,
    LocalTrack,
    DataPacket_Kind,
    VideoPresets,
    ScreenSharePresets,
    ParticipantEvent
} from 'livekit-client';

interface ChatMessage {
    user: string;
    text: string;
    time: Date;
    isMe: boolean;
}

@Component({
    selector: 'app-stream',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        MatFormFieldModule,
        MatInputModule,
        FormsModule
    ],
    template: `
    <div class="stream-page-container">
      <!-- Top Bar matching Home page header -->
      <div class="stream-topbar">
        <div class="topbar-left">
          <button class="btn-back" [routerLink]="['/streaming']" title="Вернуться к списку пар">
            <mat-icon class="back-icon">arrow_back</mat-icon>
            <span>К списку пар</span>
          </button>
          <div class="title-group">
            <h1 class="stream-page-title">Онлайн пара</h1>
            <span class="subject-subtext" *ngIf="subjectName">• {{ subjectName }}</span>
          </div>
        </div>

        <div class="topbar-right">
          <!-- Live badge with ticker -->
          <div class="live-pill" *ngIf="isActive">
            <span class="live-dot"></span>
            <span>В ЭФИРЕ • {{ streamDuration }}</span>
          </div>

          <!-- Target audience badge -->
          <div class="audience-pill" *ngIf="targetAudienceLabel">
            <mat-icon class="audience-icon">groups</mat-icon>
            <span>{{ targetAudienceLabel }}</span>
          </div>

          <!-- Participants count -->
          <div class="participants-pill" *ngIf="isActive">
            <mat-icon class="pill-icon">group</mat-icon>
            <span>{{ participantCount }}</span>
          </div>
        </div>
      </div>

      <!-- Main Layout -->
      <div class="main-layout">
        <!-- Video Canvas Section -->
        <div class="video-container">
          <div class="video-grid" #videoGrid>
            <!-- Overlay for loading -->
            <div *ngIf="loading" class="overlay-card loading-overlay">
              <mat-spinner diameter="44"></mat-spinner>
              <p class="overlay-text">Подключение к трансляции...</p>
            </div>
            
            <!-- Overlay for connection error (e.g. VPN issue) -->
            <div *ngIf="!loading && connectionError" class="overlay-card error-overlay">
              <div class="error-icon-wrapper">
                <mat-icon class="error-icon">wifi_off</mat-icon>
              </div>
              <h3 class="overlay-title">Ошибка подключения к WebRTC</h3>
              <p class="overlay-desc">{{ connectionError }}</p>
              <button class="btn-retry" (click)="retryConnection()">
                <mat-icon style="font-size: 18px; width: 18px; height: 18px;">refresh</mat-icon>
                <span>Повторить подключение</span>
              </button>
            </div>

            <!-- Overlay for offline -->
            <div *ngIf="!loading && !isActive && !connectionError" class="overlay-card offline-overlay">
              <div class="offline-icon-wrapper">
                <mat-icon class="offline-icon">videocam_off</mat-icon>
              </div>
              <h3 class="overlay-title">Трансляция не активна</h3>
              <p class="overlay-desc" *ngIf="isTeacher">Вы можете начать трансляцию по данному курсу прямо сейчас</p>
              <p class="overlay-desc" *ngIf="!isTeacher">Преподаватель еще не начал эфир. Ожидайте начала пары.</p>
              <button class="btn-start-action" (click)="startBroadcast()" *ngIf="isTeacher">
                <mat-icon style="font-size: 18px; width: 18px; height: 18px;">videocam</mat-icon>
                <span>Начать трансляцию</span>
              </button>
            </div>

            <!-- Dynamic inner grid for participants video elements -->
            <div class="video-grid-inner" [class.single-participant]="trackMap.size === 1" #videoGridInner>
            </div>
          </div>

          <!-- Floating Controls Pill matching modern UI -->
          <div class="floating-controls-wrapper" *ngIf="isActive && !connectionError">
            <div class="floating-controls-pill">
              <button class="btn-control-start" *ngIf="!isBroadcasting && isTeacher" (click)="startBroadcasting()" title="Выйти в эфир">
                <mat-icon style="font-size: 18px; width: 18px; height: 18px;">videocam</mat-icon>
                <span>Выйти в эфир</span>
              </button>
              
              <ng-container *ngIf="isBroadcasting">
                <button class="btn-circle-control" [class.off]="!isCameraOn" (click)="toggleCamera()" [title]="isCameraOn ? 'Выключить камеру' : 'Включить камеру'">
                  <mat-icon>{{ isCameraOn ? 'videocam' : 'videocam_off' }}</mat-icon>
                </button>
                <button class="btn-circle-control" [class.off]="!isMicOn" (click)="toggleMic()" [title]="isMicOn ? 'Выключить микрофон' : 'Включить микрофон'">
                  <mat-icon>{{ isMicOn ? 'mic' : 'mic_off' }}</mat-icon>
                </button>
                <button class="btn-circle-control" [class.active]="isScreenSharing" (click)="toggleScreenShare()" [title]="isScreenSharing ? 'Остановить показ экрана' : 'Демонстрация экрана'">
                  <mat-icon>{{ isScreenSharing ? 'stop_screen_share' : 'screen_share' }}</mat-icon>
                </button>
                <button class="btn-stop-broadcast" (click)="stopBroadcasting()" title="Прекратить эфир">
                  <mat-icon style="font-size: 16px; width: 16px; height: 16px;">pause</mat-icon>
                  <span>Остановить</span>
                </button>
              </ng-container>

              <button class="btn-end-for-all" *ngIf="isTeacher" (click)="endRoom()" title="Завершить пару для всех">
                <span>Завершить пару</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Translucent Chat Panel -->
        <div class="chat-container">
          <div class="chat-header">
            <div class="chat-header-title">
              <mat-icon class="chat-icon">forum</mat-icon>
              <span>Чат пары</span>
            </div>
            <span class="chat-badge">{{ messages.length }}</span>
          </div>

          <div class="chat-messages" #chatScroll>
            <div *ngIf="messages.length === 0" class="chat-empty">
              <mat-icon class="empty-bubble-icon">chat_bubble_outline</mat-icon>
              <span>Сообщений пока нет. Будьте первым!</span>
            </div>
            <div *ngFor="let msg of messages" class="message-item" [class.is-me]="msg.isMe">
              <div class="msg-header">
                <span class="msg-author">{{ msg.user }}</span>
                <span class="msg-time">{{ msg.time | date:'HH:mm' }}</span>
              </div>
              <div class="msg-bubble">{{ msg.text }}</div>
            </div>
          </div>

          <div class="chat-input-bar">
            <input 
              type="text" 
              class="chat-text-input" 
              [(ngModel)]="newMessage" 
              (keyup.enter)="sendMessage()" 
              placeholder="Напишите сообщение..." 
            />
            <button class="btn-send-msg" (click)="sendMessage()" [disabled]="!newMessage.trim()" title="Отправить">
              <mat-icon style="font-size: 18px; width: 18px; height: 18px;">send</mat-icon>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .stream-page-container {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 84px);
      padding: 12px 24px 20px;
      max-width: 1600px;
      margin: 0 auto;
      box-sizing: border-box;
      font-family: 'Inter', sans-serif;
    }

    /* Top Bar */
    .stream-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .topbar-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .btn-back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      padding: 6px 14px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 500;
      color: #09090b;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .btn-back:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
      transform: translateX(-2px);
    }
    .back-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #64748b;
    }
    .title-group {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    .stream-page-title {
      font-family: 'Instrument Serif', 'Cormorant Garamond', Georgia, serif;
      font-size: 26px;
      font-weight: 500;
      color: #09090b;
      margin: 0;
      letter-spacing: -0.01em;
    }
    .subject-subtext {
      font-family: 'Inter', sans-serif;
      font-size: 14.5px;
      font-weight: 500;
      color: #64748b;
    }
    .topbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .live-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(239, 68, 68, 0.95);
      color: #ffffff;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      box-shadow: 0 2px 6px rgba(239, 68, 68, 0.3);
    }
    .live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ffffff;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }
    .audience-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f1f5f9;
      color: #475569;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 500;
      border: 1px solid #e2e8f0;
    }
    .audience-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      color: #64748b;
    }
    .participants-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #ffffff;
      color: #09090b;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 500;
      border: 1px solid #e4e4e7;
    }
    .pill-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      color: #64748b;
    }

    /* Main Layout */
    .main-layout {
      flex: 1;
      display: flex;
      gap: 18px;
      min-height: 0;
      overflow: hidden;
    }

    /* Video Canvas Section */
    .video-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      position: relative;
      background: #09090b;
      border-radius: 16px;
      border: 1px solid #27272a;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }
    .video-grid {
      flex: 1;
      position: relative;
      background-color: #09090b;
      background-image: 
        radial-gradient(rgba(255, 255, 255, 0.08) 1.2px, transparent 1.2px),
        linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: 20px 20px, 40px 40px, 40px 40px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .video-grid-inner {
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
      gap: 16px;
      padding: 20px;
      overflow-y: auto;
      align-content: center;
      flex: 1;
      box-sizing: border-box;
    }
    .video-grid-inner.single-participant {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 0;
      grid-template-columns: none;
    }
    .video-grid-inner.single-participant ::ng-deep .participant-tile {
      width: 100%;
      height: 100%;
      border-radius: 0;
      border: none;
    }

    ::ng-deep .video-grid video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000000;
    }

    ::ng-deep .participant-tile {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #18181b;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }
    ::ng-deep .edu-participant-label {
      position: absolute;
      bottom: 12px;
      left: 12px;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.02em;
      border: 1px solid rgba(255, 255, 255, 0.15);
      z-index: 5;
    }

    /* Overlays (Card Blur Aesthetic) */
    .overlay-card {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 16px;
      padding: 32px 36px;
      text-align: center;
      max-width: 440px;
      width: 90%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .overlay-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 24px;
      font-weight: 500;
      color: #09090b;
      margin: 12px 0 8px;
    }
    .overlay-desc {
      font-family: 'Inter', sans-serif;
      font-size: 13.5px;
      line-height: 1.5;
      color: #64748b;
      margin: 0 0 20px;
    }
    .overlay-text {
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      color: #09090b;
      margin-top: 14px;
      font-weight: 500;
    }
    .offline-icon-wrapper, .error-icon-wrapper {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .offline-icon-wrapper {
      background: #f1f5f9;
    }
    .offline-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
      color: #64748b;
    }
    .error-icon-wrapper {
      background: #fef2f2;
    }
    .error-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
      color: #ef4444;
    }
    .btn-start-action, .btn-retry {
      height: 40px;
      padding: 0 20px;
      background: #09090b;
      color: #ffffff;
      border: 1px solid #09090b;
      border-radius: 8px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    }
    .btn-start-action:hover, .btn-retry:hover {
      background: #27272a;
      transform: translateY(-1px);
    }

    /* Floating Controls Bar */
    .floating-controls-wrapper {
      position: absolute;
      bottom: 20px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      z-index: 20;
      pointer-events: none;
    }
    .floating-controls-pill {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 30px;
      padding: 8px 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
    }
    .btn-control-start {
      height: 40px;
      padding: 0 18px;
      border-radius: 20px;
      background: #09090b;
      color: #ffffff;
      border: none;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .btn-control-start:hover {
      background: #27272a;
      transform: translateY(-1px);
    }
    .btn-circle-control {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 1px solid #e4e4e7;
      background: #ffffff;
      color: #09090b;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .btn-circle-control:hover {
      background: #f8fafc;
      transform: translateY(-1px);
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
    }
    .btn-circle-control.off {
      background: #fef2f2;
      color: #ef4444;
      border-color: #fecaca;
    }
    .btn-circle-control.active {
      background: #09090b;
      color: #ffffff;
      border-color: #09090b;
    }
    .btn-stop-broadcast {
      height: 40px;
      padding: 0 16px;
      border-radius: 20px;
      background: #fef2f2;
      color: #ef4444;
      border: 1px solid #fecaca;
      font-family: 'Inter', sans-serif;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn-stop-broadcast:hover {
      background: #fee2e2;
    }
    .btn-end-for-all {
      height: 40px;
      padding: 0 16px;
      border-radius: 20px;
      background: #09090b;
      color: #ffffff;
      border: none;
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-end-for-all:hover {
      background: #dc2626;
    }

    /* Chat Panel */
    .chat-container {
      width: 360px;
      min-width: 320px;
      display: flex;
      flex-direction: column;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid #e4e4e7;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
    }
    .chat-header {
      padding: 14px 18px;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #ffffff;
    }
    .chat-header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 14px;
      color: #09090b;
    }
    .chat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #64748b;
    }
    .chat-badge {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 10px;
    }
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 0;
      background: #fafafa;
    }
    .chat-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #94a3b8;
      font-size: 13px;
      text-align: center;
      gap: 8px;
      padding: 20px;
    }
    .empty-bubble-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      opacity: 0.5;
    }
    .message-item {
      display: flex;
      flex-direction: column;
      max-width: 84%;
    }
    .message-item.is-me {
      align-self: flex-end;
    }
    .msg-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 3px;
      font-size: 11px;
      color: #94a3b8;
      padding: 0 4px;
    }
    .msg-author {
      font-weight: 600;
      color: #64748b;
    }
    .message-item.is-me .msg-author {
      color: #09090b;
    }
    .msg-bubble {
      padding: 8px 12px;
      font-size: 13px;
      line-height: 1.45;
      border-radius: 14px;
      word-break: break-word;
    }
    .message-item:not(.is-me) .msg-bubble {
      background: #ffffff;
      color: #09090b;
      border: 1px solid #e4e4e7;
      border-bottom-left-radius: 3px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    }
    .message-item.is-me .msg-bubble {
      background: #09090b;
      color: #ffffff;
      border-bottom-right-radius: 3px;
    }
    .chat-input-bar {
      padding: 12px 16px;
      border-top: 1px solid #f1f5f9;
      background: #ffffff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .chat-text-input {
      flex: 1;
      height: 38px;
      padding: 0 14px;
      border: 1px solid #e4e4e7;
      border-radius: 20px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      color: #09090b;
      outline: none;
      transition: border-color 0.2s;
    }
    .chat-text-input:focus {
      border-color: #09090b;
    }
    .btn-send-msg {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: none;
      background: #09090b;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .btn-send-msg:disabled {
      background: #e2e8f0;
      color: #94a3b8;
      cursor: not-allowed;
    }

    @media (max-width: 960px) {
      .main-layout {
        flex-direction: column;
      }
      .chat-container {
        width: 100%;
        height: 280px;
      }
    }
  `]
})
export class StreamComponent implements OnInit, OnDestroy, AfterViewInit {
    @ViewChild('videoGrid') videoGrid!: ElementRef;
    @ViewChild('videoGridInner') videoGridInner!: ElementRef;
    @ViewChild('chatScroll') chatScroll!: ElementRef;

    subjectId: string = '';
    subjectName: string = '';
    roomName: string = '';
    isActive: boolean = false;
    isBroadcasting: boolean = false;
    loading: boolean = true;
    connectionError: string = '';

    room?: Room;
    localVideoTrack?: LocalVideoTrack;
    localAudioTrack?: LocalAudioTrack;

    isCameraOn: boolean = true;
    isMicOn: boolean = true;
    isScreenSharing: boolean = false;

    messages: ChatMessage[] = [];
    newMessage: string = '';

    currentUser: any;
    isTeacher: boolean = false;

    streamCreatedAt?: Date;
    streamDuration: string = '00:00';
    targetAudienceLabel: string = '';
    private timerInterval?: any;

    trackMap = new Map<string, HTMLElement>();

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private apiService: ApiService,
        private auth: AuthService,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit() {
        this.subjectId = this.route.snapshot.params['id'];
        this.currentUser = this.auth.getCurrentUser() || { name: 'Гость', role: 'student' };
        this.isTeacher = this.currentUser?.role === 'teacher' || this.currentUser?.role === 'admin';

        if (this.subjectId) {
            this.apiService.getSubject(this.subjectId).subscribe({
                next: (subject) => {
                    this.subjectName = subject?.name || '';
                },
                error: () => {}
            });
        }

        this.timerInterval = setInterval(() => {
            this.updateStreamDuration();
        }, 1000);

        this.checkRoom();
    }

    ngAfterViewInit() {
        this.scrollToBottom();
    }

    ngOnDestroy() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        this.cleanup();
    }

    get participantCount(): number {
        const remoteCount = this.room?.remoteParticipants?.size || 0;
        return remoteCount + (this.isActive ? 1 : 0);
    }

    updateStreamDuration() {
        if (!this.isActive || !this.streamCreatedAt) {
            this.streamDuration = '00:00';
            return;
        }
        const diff = Math.max(0, Math.floor((Date.now() - this.streamCreatedAt.getTime()) / 1000));
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        const pad = (n: number) => n.toString().padStart(2, '0');
        if (hours > 0) {
            this.streamDuration = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        } else {
            this.streamDuration = `${pad(minutes)}:${pad(seconds)}`;
        }
    }

    parseAudienceLabel(room: any) {
        if (room.target_groups) {
            try {
                const parsed = typeof room.target_groups === 'string' ? JSON.parse(room.target_groups) : room.target_groups;
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.targetAudienceLabel = `Группы: ${parsed.join(', ')}`;
                    return;
                }
            } catch (e) {
                const split = String(room.target_groups).split(',').map(s => s.trim()).filter(Boolean);
                if (split.length > 0) {
                    this.targetAudienceLabel = `Группы: ${split.join(', ')}`;
                    return;
                }
            }
        }
        if (room.room_name && room.room_name.includes('__groups__')) {
            try {
                const part = room.room_name.split('__groups__')[1].split('_')[0];
                const decoded = decodeURIComponent(part).split(',').map((s: string) => s.trim()).filter(Boolean);
                if (decoded.length > 0) {
                    this.targetAudienceLabel = `Группы: ${decoded.join(', ')}`;
                    return;
                }
            } catch (e) {}
        }
        this.targetAudienceLabel = 'Для всех групп';
    }

    async checkRoom() {
        this.loading = true;
        this.connectionError = '';
        try {
            const activeRooms = await this.apiService.getActiveStreamingRooms().toPromise();
            const room = (activeRooms || []).find((r: any) => r && r.subject_id === this.subjectId);

            if (room) {
                this.roomName = room.room_name;
                this.isActive = true;
                this.streamCreatedAt = room.created_at ? new Date(room.created_at) : new Date();
                this.parseAudienceLabel(room);
                await this.connect();
            } else {
                this.isActive = false;
                this.loading = false;
            }
        } catch (err) {
            console.error('Error checking room:', err);
            this.connectionError = 'Не удалось проверить активность трансляции';
            this.loading = false;
        }
    }

    async retryConnection() {
        this.connectionError = '';
        await this.checkRoom();
    }

    async startBroadcast() {
        this.loading = true;
        this.connectionError = '';
        try {
            const room = await this.apiService.createStreamingRoom({
                subject_id: this.subjectId,
                teacher_name: this.currentUser.name
            }).toPromise();

            this.roomName = room.room_name;
            this.isActive = true;
            this.streamCreatedAt = room.created_at ? new Date(room.created_at) : new Date();
            this.parseAudienceLabel(room);
            await this.connect(true);
            this.isBroadcasting = true;
        } catch (err: any) {
            console.error('Error starting broadcast:', err);
            this.connectionError = 'Не удалось создать трансляцию: ' + (err?.message || 'Ошибка сервера');
            this.loading = false;
        }
    }

    async connect(requestPublish: boolean = false) {
        this.connectionError = '';
        try {
            const tokenData = await this.apiService.generateStreamingToken({
                room_name: this.roomName,
                identity: this.currentUser.name,
                is_teacher: requestPublish
            }).toPromise();

            // WebRTC Room instance
            this.room = new Room({
                adaptiveStream: true,
                dynacast: true,
                videoCaptureDefaults: {
                    resolution: VideoPresets.h720.resolution,
                },
                publishDefaults: {
                    videoEncoding: VideoPresets.h720.encoding,
                    screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
                }
            });

            // Setup events
            this.room
                .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                    this.handleTrackSubscribed(track, publication, participant);
                })
                .on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
                    this.handleTrackUnsubscribed(track, publication, participant);
                })
                .on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
                    this.handleDataReceived(payload, participant);
                })
                .on(RoomEvent.Disconnected, () => {
                    this.isActive = false;
                    this.cleanup();
                });

            // Handle local track publishing for self-view
            this.room.localParticipant.on(ParticipantEvent.LocalTrackPublished, (publication) => {
                if (publication.track && publication.track.kind === Track.Kind.Video) {
                    this.addTrackToGrid(
                        publication.track as any,
                        this.currentUser.name,
                        publication.source === Track.Source.ScreenShare
                    );
                }
            });

            this.room.localParticipant.on(ParticipantEvent.LocalTrackUnpublished, (publication) => {
                const track = publication.track;
                if (track && track.sid) {
                    const elem = this.trackMap.get(track.sid);
                    if (elem) {
                        elem.remove();
                        this.trackMap.delete(track.sid);
                    }
                }
            });

            // Connect over standard WebRTC with STUN resolution for NAT/VPN traversal
            await this.room.connect(tokenData.server_url, tokenData.token, {
                autoSubscribe: true,
                rtcConfig: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun.cloudflare.com:3478' }
                    ]
                }
            });

            if (requestPublish) {
                if (this.room.state === 'connected') {
                    await this.publishTracks();
                } else {
                    console.warn('Room not connected yet, waiting...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await this.publishTracks();
                }
            }

            this.loading = false;
        } catch (err: any) {
            console.error('Connection error:', err);
            const errStr = String(err?.message || err);
            if (errStr.includes('pc connection') || errStr.includes('ConnectionError')) {
                this.connectionError = 'Не удалось установить прямое WebRTC-соединение. Если у вас включен VPN или строгий файрвол, они могут блокировать UDP/STUN трафик стриминга. Попробуйте отключить VPN или повторить подключение.';
            } else {
                this.connectionError = 'Ошибка подключения к эфиру: ' + (err?.message || 'Неизвестная ошибка');
            }
            this.loading = false;
        }
    }

    async startBroadcasting() {
        this.loading = true;
        try {
            await this.publishTracks();
            this.isBroadcasting = true;
        } catch (err) {
            console.error('Error starting broadcast:', err);
            this.snackBar.open('Не удалось выйти в эфир', 'OK', { duration: 3000 });
        } finally {
            this.loading = false;
        }
    }

    async stopBroadcasting() {
        this.loading = true;
        try {
            if (this.localVideoTrack && this.localVideoTrack.sid) {
                await this.room?.localParticipant.unpublishTrack(this.localVideoTrack);
                const elem = this.trackMap.get(this.localVideoTrack.sid);
                elem?.remove();
                this.trackMap.delete(this.localVideoTrack.sid);
                this.localVideoTrack.stop();
                this.localVideoTrack = undefined;
            }
            if (this.localAudioTrack && this.localAudioTrack.sid) {
                await this.room?.localParticipant.unpublishTrack(this.localAudioTrack);
                this.localAudioTrack.stop();
                this.localAudioTrack = undefined;
            }
            this.isBroadcasting = false;
        } catch (err) {
            console.error('Error stopping broadcast:', err);
        } finally {
            this.loading = false;
        }
    }

    async publishTracks() {
        if (!this.room) return;

        try {
            this.localVideoTrack = await createLocalVideoTrack();
            this.localAudioTrack = await createLocalAudioTrack();

            await this.room.localParticipant.publishTrack(this.localVideoTrack);
            await this.room.localParticipant.publishTrack(this.localAudioTrack);
        } catch (err) {
            console.error('Error publishing tracks:', err);
            throw err;
        }
    }

    private addTrackToGrid(track: LocalTrack | RemoteTrack, identity: string, isScreenShare: boolean = false) {
        if (!track.sid || track.kind !== Track.Kind.Video) return;

        if (this.trackMap.has(track.sid)) {
            return;
        }

        const container = document.createElement('div');
        container.className = 'participant-tile';

        const videoElem = track.attach();
        container.appendChild(videoElem);

        const label = document.createElement('div');
        label.className = 'edu-participant-label';
        label.innerText = identity + (isScreenShare ? ' (Экран)' : '');
        container.appendChild(label);

        this.videoGridInner.nativeElement.appendChild(container);
        this.trackMap.set(track.sid, container);
    }

    handleTrackSubscribed(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) {
        if (track.kind === Track.Kind.Video) {
            this.addTrackToGrid(track, participant.identity, publication.source === Track.Source.ScreenShare);
        } else if (track.kind === Track.Kind.Audio) {
            const element = track.attach();
            document.body.appendChild(element);
        }
    }

    handleTrackUnsubscribed(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) {
        if (track.sid) {
            const elem = this.trackMap.get(track.sid);
            if (elem) {
                elem.remove();
                this.trackMap.delete(track.sid);
            }
        }
        track.detach();
    }

    handleDataReceived(payload: Uint8Array, participant?: RemoteParticipant) {
        try {
            const data = JSON.parse(new TextDecoder().decode(payload));
            if (data.type === 'chat') {
                this.messages.push({
                    user: participant?.identity || 'Аноним',
                    text: data.text,
                    time: new Date(),
                    isMe: false
                });
                this.scrollToBottom();
            }
        } catch (e) {
            console.warn('Error parsing data packet:', e);
        }
    }

    sendMessage() {
        if (!this.newMessage.trim() || !this.room) return;

        const payload = {
            type: 'chat',
            text: this.newMessage
        };

        const encoder = new TextEncoder();
        this.room.localParticipant.publishData(
            encoder.encode(JSON.stringify(payload)),
            { reliable: true }
        );

        this.messages.push({
            user: 'Вы',
            text: this.newMessage,
            time: new Date(),
            isMe: true
        });

        this.newMessage = '';
        this.scrollToBottom();
    }

    toggleCamera() {
        if (this.room) {
            this.isCameraOn = !this.isCameraOn;
            this.room.localParticipant.setCameraEnabled(this.isCameraOn);
        }
    }

    toggleMic() {
        if (this.room) {
            this.isMicOn = !this.isMicOn;
            this.room.localParticipant.setMicrophoneEnabled(this.isMicOn);
        }
    }

    async toggleScreenShare() {
        if (!this.room) return;

        try {
            if (!this.isScreenSharing) {
                await this.room.localParticipant.setScreenShareEnabled(true);
                this.isScreenSharing = true;
            } else {
                await this.room.localParticipant.setScreenShareEnabled(false);
                this.isScreenSharing = false;
            }
        } catch (err) {
            console.error('Error toggling screen share:', err);
        }
    }

    async endRoom() {
        if (!confirm('Вы уверены, что хотите завершить трансляцию для всех участников?')) return;

        try {
            await this.apiService.endStreamingRoom(this.roomName).toPromise();
            await this.room?.disconnect();
            this.cleanup();
            this.isActive = false;
            this.snackBar.open('Трансляция завершена', 'OK', { duration: 3000 });
        } catch (err) {
            console.error('Error ending broadcast:', err);
        }
    }

    cleanup() {
        if (this.room) {
            this.room.disconnect();
            this.room = undefined;
        }
        if (this.localVideoTrack) {
            this.localVideoTrack.stop();
            this.localVideoTrack.detach();
            this.localVideoTrack = undefined;
        }
        if (this.localAudioTrack) {
            this.localAudioTrack.stop();
            this.localAudioTrack = undefined;
        }
        if (this.videoGridInner?.nativeElement) {
            this.videoGridInner.nativeElement.innerHTML = '';
        }
        this.trackMap.clear();
        this.isBroadcasting = false;
    }

    scrollToBottom() {
        if (this.chatScroll) {
            setTimeout(() => {
                this.chatScroll.nativeElement.scrollTop = this.chatScroll.nativeElement.scrollHeight;
            }, 100);
        }
    }
}
