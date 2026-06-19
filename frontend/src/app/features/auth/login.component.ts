import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatInputModule, MatFormFieldModule, RouterModule],
  template: `
    <div class="auth-container">
      <mat-card class="auth-card">
        <mat-card-header>
          <mat-card-title>Добро пожаловать в EduAI Hub</mat-card-title>
          <mat-card-subtitle>Единая система авторизации ИТМО</mat-card-subtitle>
        </mat-card-header>
        
        <mat-card-content class="content">
          <div class="logo-container">
            <div class="ai-logo">AI</div>
          </div>
          
          <p class="description">
            Для продолжения работы, пожалуйста, авторизуйтесь через университетскую учетную запись.
          </p>

          <button mat-raised-button color="primary" class="sso-button" (click)="login()" [disabled]="loading">
            <span *ngIf="!loading">Войти через SSO ИТМО</span>
            <span *ngIf="loading">Перенаправление...</span>
          </button>

          <button mat-stroked-button color="accent" class="mock-button" (click)="loginAsGena()" [disabled]="loading" style="margin-top: 12px; width: 100%; height: 50px; font-size: 16px; font-weight: 500; border-radius: 8px;">
            <span>Войти как Тестик Гена</span>
          </button>
        </mat-card-content>
        
        <mat-card-footer>
          <p class="footer-text">Входя в систему, вы соглашаетесь с правилами использования EduAI Hub</p>
        </mat-card-footer>
      </mat-card>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 80vh;
      padding: 20px;
    }
    .auth-card {
      max-width: 450px;
      width: 100%;
      text-align: center;
      padding: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
      border-radius: 12px;
    }
    .logo-container {
      margin: 32px 0;
    }
    .ai-logo {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #3f51b5, #00BCD4);
      color: white;
      font-size: 32px;
      font-weight: bold;
      display: flex;
      justify-content: center;
      align-items: center;
      border-radius: 20px;
      margin: 0 auto;
      box-shadow: 0 5px 15px rgba(63, 81, 181, 0.4);
    }
    .content {
      padding: 0 24px 24px;
    }
    .description {
      color: #666;
      margin-bottom: 32px;
      line-height: 1.6;
    }
    .sso-button {
      width: 100%;
      height: 50px;
      font-size: 16px;
      font-weight: 500;
      border-radius: 8px;
    }
    .footer-text {
      font-size: 12px;
      color: #999;
      margin: 16px 0;
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

    // If the user is already authenticated, don't show the login page
    if (this.auth.isAuthenticated()) {
      const targetUrl = returnUrl || '/';
      this.router.navigateByUrl(targetUrl);
    }
    
    // Also subscribe to changes in case the user authenticates while on this page
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

