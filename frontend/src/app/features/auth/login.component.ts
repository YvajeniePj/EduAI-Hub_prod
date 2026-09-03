import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="auth-wrapper">
      <!-- Minimalist Brand Header (Top Left) -->
      <div class="header-logo">
        ИТМО · EduAI Hub
      </div>

      <!-- Main Login Card -->
      <div class="auth-card">
        <!-- Floating AI Badge -->
        <div class="ai-badge-container">
          <div class="ai-badge">
            <span class="ai-badge-text">AI</span>
          </div>
        </div>

        <!-- Headings -->
        <h1 class="welcome-heading">Добро пожаловать</h1>
        <div class="brand-heading">EduAI Hub</div>

        <!-- Subtle Dash Divider -->
        <div class="divider-dash"></div>

        <!-- Subtitle -->
        <p class="auth-subtitle">
          Войдите через Телеграм аккаунт привязанный к университетским сервисам.
        </p>

        <!-- Actions -->
        <div class="actions-container">
          <button class="btn-sso" (click)="login()" [disabled]="loading">
            <span *ngIf="!loading">ВОЙТИ ЧЕРЕЗ SSO ИТМО</span>
            <span *ngIf="loading">ПЕРЕНАПРАВЛЕНИЕ...</span>
          </button>

          <button class="btn-mock" (click)="loginAsGena()" [disabled]="loading">
            <span>ВОЙТИ КАК ТЕСТИК ГЕНА</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-wrapper {
      position: relative;
      width: 100%;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      z-index: 2;
    }

    .header-logo {
      position: fixed;
      top: 28px;
      left: 32px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, monospace, sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #94a3b8;
      user-select: none;
      z-index: 20;
    }

    .auth-card {
      position: relative;
      z-index: 10;
      max-width: 440px;
      width: 100%;
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 
        0 20px 45px -15px rgba(0, 0, 0, 0.07),
        0 0 0 1px rgba(0, 0, 0, 0.04);
      padding: 48px 40px 44px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: box-shadow 0.3s ease;
    }

    .auth-card:hover {
      box-shadow: 
        0 24px 50px -15px rgba(0, 0, 0, 0.09),
        0 0 0 1px rgba(0, 0, 0, 0.05);
    }

    /* Floating AI Badge Animation */
    .ai-badge-container {
      margin-bottom: 22px;
      display: inline-flex;
      animation: aiFloat 4.2s ease-in-out infinite;
    }

    @keyframes aiFloat {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-8px);
      }
    }

    .ai-badge {
      width: 58px;
      height: 58px;
      background: #09090b;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 20px -4px rgba(0, 0, 0, 0.25);
    }

    .ai-badge-text {
      font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
      font-size: 26px;
      font-weight: 600;
      color: #ffffff;
      letter-spacing: -0.5px;
      user-select: none;
    }

    /* Typography */
    .welcome-heading {
      font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
      font-size: 34px;
      font-weight: 500;
      color: #18181b;
      line-height: 1.15;
      letter-spacing: -0.015em;
      margin: 0;
      user-select: none;
    }

    .brand-heading {
      font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
      font-style: italic;
      font-size: 30px;
      font-weight: 600;
      color: #09090b;
      line-height: 1.2;
      margin-top: 4px;
      letter-spacing: -0.01em;
      user-select: none;
    }

    .divider-dash {
      width: 28px;
      height: 1.5px;
      background: #e4e4e7;
      margin: 22px auto 20px;
      border-radius: 2px;
    }

    .auth-subtitle {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13.5px;
      font-weight: 400;
      color: #71717a;
      line-height: 1.55;
      max-width: 320px;
      margin: 0 auto 32px;
      user-select: none;
    }

    /* Actions */
    .actions-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .btn-sso {
      width: 100%;
      height: 48px;
      background: #09090b;
      color: #ffffff;
      border: 1px solid #09090b;
      border-radius: 8px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
    }

    .btn-sso:hover:not(:disabled) {
      background: #27272a;
      border-color: #27272a;
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.14);
    }

    .btn-sso:active:not(:disabled) {
      transform: translateY(0);
    }

    .btn-sso:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-mock {
      width: 100%;
      height: 48px;
      background: #ffffff;
      color: #18181b;
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-mock:hover:not(:disabled) {
      background: #f8fafc;
      border-color: #d4d4d8;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }

    .btn-mock:active:not(:disabled) {
      transform: translateY(0);
    }

    .btn-mock:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `]
})
export class LoginComponent implements OnInit {
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    if (returnUrl) {
      localStorage.setItem('auth_return_url', returnUrl);
    }

    // If user is already authenticated, redirect
    if (this.auth.isAuthenticated()) {
      const targetUrl = returnUrl || '/';
      this.router.navigateByUrl(targetUrl);
    }

    this.auth.currentUser$.subscribe(user => {
      if (user) {
        const targetUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
        this.router.navigateByUrl(targetUrl);
      }
    });
  }

  login() {
    this.loading = true;
    this.auth.login().catch(err => {
      this.loading = false;
      console.error('SSO Redirect error:', err);
      alert('Не удалось перенаправить на систему входа. Проверьте соединение.');
    });
  }

  loginAsGena() {
    this.loading = true;
    this.auth.loginAsMockStudent('Тестик Гена', 'mock-token-test-gena').subscribe({
      next: () => {
        const targetUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
        this.router.navigateByUrl(targetUrl);
      },
      error: (err) => {
        this.loading = false;
        console.error('Mock login failed:', err);
        alert('Не удалось выполнить тестовый вход.');
      }
    });
  }
}



