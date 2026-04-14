import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpBackend } from '@angular/common/http';
import { Observable, BehaviorSubject, from, of, throwError } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { UserManager, User, UserManagerSettings } from 'oidc-client-ts';

export interface CurrentUser {
  id: string;
  name: string;
  avatar_url?: string;
  role?: string;
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

  currentUser$ = this.currentUserSubject.asObservable();
  token$ = this.tokenSubject.asObservable();
  idToken$ = this.idTokenSubject.asObservable();
  isInitialized$ = this.isInitializedSubject.asObservable();

  private apiBaseUrl = '/api';
  private httpWithoutInterceptor: HttpClient;

  constructor(
    private http: HttpClient,
    private handler: HttpBackend
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
    
    // Initialize from storage if exists
    this.userManager.getUser().then(user => {
      if (user && !user.expired) {
        console.log('User loaded from storage:', user.profile.preferred_username);
        this.handleUser(user);
      }
      this.isInitializedSubject.next(true);
    });

    this.userManager.events.addUserLoaded((user) => {
      console.log('UserLoaded event fired');
      this.handleUser(user);
    });

    this.userManager.events.addUserSignedOut(() => {
      this.logout();
    });
  }

  private handleUser(user: User) {
    console.log('Handling loaded user...');
    if (user && user.access_token) {
      this.tokenSubject.next(user.access_token);
      this.idTokenSubject.next(user.id_token || null);
      
      // In OIDC, profile info is in user.profile
      const profile = user.profile;
      console.log('Token received, user profile:', profile.preferred_username);
      console.log('=== FULL KEYCLOAK PROFILE ===', JSON.stringify(profile, null, 2));
      
      const properName = profile.name ? (profile.name as string) : (profile.preferred_username as string);
      
      // Robust avatar mapping: check picture, avatar, avatar_url in Keycloak profile
      const properAvatar = (profile['picture'] || profile['avatar'] || profile['avatar_url']) as string | undefined;
      
      console.log('Properly mapped user data:', { name: properName, avatar: properAvatar });
      
      const currentUser: CurrentUser = {
        id: profile.sub,
        name: properName,
        avatar_url: properAvatar,
        role: this.mapRoles(profile)
      };
      
      this.currentUserSubject.next(currentUser);
      
      // Sync with our backend /auth/me for any specific user linking/roles
      console.log('Syncing with backend...');
      this.syncUserWithBackend().subscribe({
        next: () => console.log('Backend sync successful'),
        error: (err) => console.error('Backend sync failed:', err)
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
    return 'student';
  }

  private syncUserWithBackend(): Observable<any> {
    const token = this.getToken();
    if (!token) return of(null);
    
    return this.http.get<any>(`${this.apiBaseUrl}/auth/me`).pipe(
      tap(backendUser => {
        const current = this.currentUserSubject.value;
        if (current) {
          this.currentUserSubject.next({
            ...current,
            id: backendUser.user_id,
            name: current.name || backendUser.username,
            role: backendUser.role,
            avatar_url: current.avatar_url || backendUser.avatar_url
          });
        }
      }),
      catchError(err => {
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
    
    this.tokenSubject.next(null);
    this.idTokenSubject.next(null);
    this.currentUserSubject.next(null);
    
    const postLogoutUrl = window.location.origin; // Try standard origin
    
    // We only pass the spec-standard parameters: id_token_hint and post_logout_redirect_uri.
    // Removing extraQueryParams to avoid conflicting with strict redirect policies.
    this.userManager.signoutRedirect({
      id_token_hint: this.idTokenSubject.value || undefined,
      post_logout_redirect_uri: postLogoutUrl
    });
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  getCurrentUser(): CurrentUser | null {
    return this.currentUserSubject.value;
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
}

