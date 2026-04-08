import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-callback',
  standalone: true,
  template: `
    <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column;">
      <h2>Авторизация...</h2>
      <p>Пожалуйста, подождите, мы завершаем вход в систему.</p>
    </div>
  `
})
export class CallbackComponent implements OnInit {
  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit() {
    this.auth.completeLogin().subscribe({
      next: () => {
        this.router.navigate(['/']);
      },
      error: (err) => {
        console.error('Callback error:', err);
        this.router.navigate(['/login'], { queryParams: { error: 'auth_failed' } });
      }
    });
  }
}
