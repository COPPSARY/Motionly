export const ONBOARDING_COMPLETE_KEY = 'motionly.onboarding.complete.v1';

export function initialRoute(
  pathname: string,
  forceWelcome: boolean,
  completed: boolean,
  base = '/'
): 'editor' | 'onboarding' {
  if (relativeAppPath(pathname, base).replace(/\/$/, '') === '/editor') return 'editor';
  return completed && !forceWelcome ? 'editor' : 'onboarding';
}

export function appUrl(path = '', base = import.meta.env.BASE_URL): string {
  return `${base.endsWith('/') ? base : `${base}/`}${path.replace(/^\/+/, '')}`;
}

export function relativeAppPath(pathname: string, base = import.meta.env.BASE_URL): string {
  const prefix = base === '/' ? '' : base.replace(/\/$/, '');
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length) || '/' : pathname;
}
