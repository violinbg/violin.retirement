import { HttpInterceptorFn } from '@angular/common/http';

const TOKEN_KEY = 'vr_token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/v1/')) {
    return next(req);
  }

  let token: string | null = null;
  try {
    // if we run in SSR, localStorage is not available, so we need to catch the error and return the request without the Authorization header
    token = localStorage.getItem(TOKEN_KEY);
  } catch {
    return next(req);
  }

  if (!token) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
