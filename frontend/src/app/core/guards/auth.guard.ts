import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, filter, take, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for initialization to complete before checking authentication
  return authService.isInitialized$.pipe(
    filter(initialized => initialized === true),
    take(1),
    map(() => {
      if (authService.isAuthenticated()) {
        return true;
      }
      
      // Redirect to login if not authenticated
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    })
  );
};
