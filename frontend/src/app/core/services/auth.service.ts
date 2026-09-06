import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders, HttpBackend } from '@angular/common/http';
import { Observable, BehaviorSubject, from, of, throwError, combineLatest } from 'rxjs';
import { map, catchError, switchMap, tap, distinctUntilChanged } from 'rxjs/operators';
import { UserManager, User, UserManagerSettings } from 'oidc-client-ts';

export interface CurrentUser {
  id: string;
  name: string;
  avatar_url?: string;
  role?: string;
  is_hidden_admin?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userManager: UserManager;
  private currentUserSubject = new BehaviorSubject<CurrentUser | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);
  private idTokenSubject = new BehaviorSubject<string | null>(null);
  private isInitializedSubject = new BehaviorSubject<boolean>(false);
  private simulationRoleSubject = new BehaviorSubject<string | null>(localStorage.getItem('simulationRole'));
  private isHandlingUser = false;

  currentUser$ = combineLatest([
    this.currentUserSubject.asObservable(),
    this.simulationRoleSubject.asObservable()
  ]).pipe(
    map(([user, simRole]) => {
      if (!user) return null;
      if (simRole && user.is_hidden_admin) {
        return { ...user, role: simRole };
      }
      return user;
    }),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
  );
  token$ = this.tokenSubject.asObservable();
  idToken$ = this.idTokenSubject.asObservable();
  isInitialized$ = this.isInitializedSubject.asObservable();
  simulationRole$ = this.simulationRoleSubject.asObservable();

  private apiBaseUrl = '/api';
  private httpWithoutInterceptor: HttpClient;

  constructor(
    private http: HttpClient,
    private handler: HttpBackend,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.httpWithoutInterceptor = new HttpClient(handler);
    
    const settings: UserManagerSettings = {
      authority: 'https://keycloak.aitalenthub.ru/realms/aith',
      client_id: 'eduaihub',
      redirect_uri: `${window.location.origin}/callback`,
      post_logout_redirect_uri: window.location.origin,
      response_type: 'code',
      scope: 'openid profile email',
      automaticSilentRenew: true,
      filterProtocolClaims: true,
      loadUserInfo: true
    };

    this.userManager = new UserManager(settings);
    console.log('OIDC Settings initialized:', settings);
    
    const mockUserStr = localStorage.getItem('mockUser');
    if (mockUserStr) {
      try {
        const mockData = JSON.parse(mockUserStr);
        this.currentUserSubject.next(mockData.user);
        this.tokenSubject.next(mockData.token);
        this.isInitializedSubject.next(true);
        console.log('Mock student user loaded from storage:', mockData.user.name);
        this.syncUserWithBackend(mockData.user).subscribe();
      } catch (e) {
        localStorage.removeItem('mockUser');
        this.loadOidcUser();
      }
    } else {
      this.loadOidcUser();
    }

    this.userManager.events.addUserLoaded((user) => {
      console.log('UserLoaded event fired');
      this.handleUser(user);
    });

    this.userManager.events.addUserSignedOut(() => {
      this.logout();
    });
  }

  private loadOidcUser() {
    this.userManager.getUser().then(user => {
      if (user && !user.expired) {
        console.log('User loaded from storage:', user.profile.preferred_username);
        this.handleUser(user);
      }
      this.isInitializedSubject.next(true);
    });
  }

  private handleUser(user: User) {
    console.log('Handling loaded user...');
    if (this.isHandlingUser) {
      console.log('Already handling user, skipping duplicate call');
      return;
    }
    if (user && user.access_token) {
      this.isHandlingUser = true;
      this.tokenSubject.next(user.access_token);
      this.idTokenSubject.next(user.id_token || null);
      
      // In OIDC, profile info is in user.profile
      const profile: any = user.profile;
      console.log('Token received, user profile:', profile.preferred_username);
      console.log('=== FULL KEYCLOAK PROFILE ===', JSON.stringify(profile, null, 2));
      
      const properName = profile.name ? (profile.name as string) : (profile.preferred_username as string);
      
      // Robust avatar mapping: check photo_url (Telegram standard), picture, avatar, avatar_url, etc.
      const attrs = profile.attributes as Record<string, any> | undefined;
      const properAvatar = (
        profile['photo_url'] ||
        profile['picture'] ||
        profile['avatar'] ||
        profile['avatar_url'] ||
        profile['telegram_photo_url'] ||
        profile['tg_photo_url'] ||
        profile['photo'] ||
        profile['image'] ||
        (attrs && (attrs['photo_url']?.[0] || attrs['picture']?.[0] || attrs['avatar']?.[0] || attrs['avatar_url']?.[0]))
      ) as string | undefined;
      
      console.log('Properly mapped user data:', { name: properName, avatar: properAvatar });
      
      const currentUser: CurrentUser = {
        id: profile.sub,
        name: properName,
        avatar_url: properAvatar,
        role: this.mapRoles(profile),
        is_hidden_admin: false // Default, will be updated by syncUserWithBackend
      };
      
      // Sync with our backend /auth/me for any specific user linking/roles
      console.log('Syncing with backend...');
      this.syncUserWithBackend(currentUser).subscribe({
        next: () => {
          console.log('Backend sync successful');
          this.isHandlingUser = false;
        },
        error: (err) => {
          console.error('Backend sync failed:', err);
          this.isHandlingUser = false;
        }
      });
    } else {
      console.warn('HandleUser called but no access token present');
    }
  }

  private mapRoles(profile: any): string {
    const realmAccess = profile.realm_access || {};
    const roles = realmAccess.roles || [];
    if (roles.includes('admin') || roles.includes('Admin')) return 'admin';
    if (roles.includes('teacher') || roles.includes('Teacher')) return 'teacher';
    if (roles.includes('instructor') || roles.includes('Instructor')) return 'teacher'; // Map instructor to teacher for frontend
    return 'student';
  }

  public isTeacherOrAdmin(role?: string): boolean {
    if (!role) {
      const user = this.getCurrentUser();
      role = user?.role;
    }
    return role === 'teacher' || role === 'admin';
  }

  public syncUserWithBackend(fallbackUser?: CurrentUser): Observable<any> {
    const token = this.getToken();
    if (!token) return of(null);
    
    return this.http.get<any>(`${this.apiBaseUrl}/auth/me`).pipe(
      tap(backendUser => {
        const current = fallbackUser || this.currentUserSubject.value;
        if (current) {
          const effectiveAvatar = backendUser.avatar_url || current.avatar_url;
          const updatedUser: CurrentUser = {
            ...current,
            id: backendUser.user_id,
            name: backendUser.username || current.name,
            role: backendUser.role,
            avatar_url: effectiveAvatar,
            is_hidden_admin: backendUser.is_hidden_admin || false
          };
          this.currentUserSubject.next(updatedUser);

          // Update localStorage mockUser if present so avatar persists on reload
          const mockUserStr = localStorage.getItem('mockUser');
          if (mockUserStr) {
            try {
              const mockData = JSON.parse(mockUserStr);
              mockData.user = updatedUser;
              localStorage.setItem('mockUser', JSON.stringify(mockData));
            } catch (e) {}
          }

          // If backend has no avatar, but frontend got one from Keycloak profile, sync it to backend
          if (!backendUser.avatar_url && current.avatar_url && backendUser.user_id) {
            this.http.put(`${this.apiBaseUrl}/users/${backendUser.user_id}`, { avatar_url: current.avatar_url }).subscribe({
              error: (e) => console.warn('Could not sync avatar to backend:', e)
            });
          }
        }
      }),
      catchError(err => {
        if (fallbackUser) {
          this.currentUserSubject.next(fallbackUser);
        }
        // Silenced: console.error('Error syncing user with backend:', err);
        return of(null);
      })
    );
  }

  login(): Promise<void> {
    return this.userManager.signinRedirect();
  }

  completeLogin(): Observable<void> {
    console.log('Completing login from callback...');
    return from(this.userManager.signinRedirectCallback()).pipe(
      tap(user => {
        console.log('signinRedirectCallback successful');
        this.handleUser(user);
      }),
      map(() => void 0),
      catchError(err => {
        console.error('signinRedirectCallback failed:', err);
        return throwError(() => err);
      })
    );
  }

  logout() {
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      this.httpWithoutInterceptor.post(`${this.apiBaseUrl}/analytics/activities`, {
        user_name: currentUser.name,
        action_type: 'logout',
        resource_type: 'system',
        session_duration: null
      }).subscribe();
    }
    
    const isMock = localStorage.getItem('mockUser') !== null;
    localStorage.removeItem('mockUser');
    
    this.tokenSubject.next(null);
    this.idTokenSubject.next(null);
    this.currentUserSubject.next(null);
    
    if (isMock) {
      this.router.navigate(['/login']);
      return;
    }
    
    const postLogoutUrl = window.location.origin;
    this.userManager.signoutRedirect({
      id_token_hint: this.idTokenSubject.value || undefined,
      post_logout_redirect_uri: postLogoutUrl
    });
  }

  toggleSimulationRole() {
    const current = this.currentUserSubject.value;
    if (!current || !current.is_hidden_admin) return;

    const currentSim = this.simulationRoleSubject.value;
    
    // Toggle
    if (currentSim) {
      this.simulationRoleSubject.next(null);
      localStorage.removeItem('simulationRole');
      this.snackBar.open('Режим администратора восстановлен', 'OK', { duration: 3000 });
    } else {
      this.simulationRoleSubject.next('student');
      localStorage.setItem('simulationRole', 'student');
      this.snackBar.open('Режим студента включен', 'OK', { duration: 3000 });
    }
  }

  getSimulationRole(): string | null {
    return this.simulationRoleSubject.value;
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  getCurrentUser(): CurrentUser | null {
    const user = this.currentUserSubject.value;
    if (!user) return null;
    
    // Apply simulation if active and user is hidden admin
    const simRole = this.simulationRoleSubject.value;
    if (simRole && user.is_hidden_admin) {
      return { ...user, role: simRole };
    }
    return user;
  }

  isAuthenticated(): boolean {
    return this.tokenSubject.value !== null && this.currentUserSubject.value !== null;
  }

  // Compatible for old components
  loginByName(name: string): Observable<CurrentUser> {
    console.warn('loginByName is deprecated for OIDC, use login() instead');
    return throwError(() => new Error('Use OIDC login instead'));
  }

  register(name: string, role: string = 'student'): Observable<CurrentUser> {
    console.warn('register is deprecated for OIDC');
    return throwError(() => new Error('Registration should be handled via University SSO'));
  }

  loginAsMockStudent(name: string, token: string): Observable<any> {
    const user: CurrentUser = {
      id: '00000000-0000-0000-0000-000000000001',
      name: name,
      avatar_url: undefined,
      role: 'student',
      is_hidden_admin: false
    };
    
    localStorage.setItem('mockUser', JSON.stringify({ user, token }));
    this.tokenSubject.next(token);
    this.currentUserSubject.next(user);
    
    return this.syncUserWithBackend(user);
  }

  loginAsMockTeacher(name: string = 'Тестик Ваня', token: string = 'mock-token-test-vanya'): Observable<any> {
    const user: CurrentUser = {
      id: '00000000-0000-0000-0000-000000000002',
      name: name,
      avatar_url: undefined,
      role: 'teacher',
      is_hidden_admin: false
    };
    
    localStorage.setItem('mockUser', JSON.stringify({ user, token }));
    this.tokenSubject.next(token);
    this.currentUserSubject.next(user);
    
    return this.syncUserWithBackend(user);
  }
}

