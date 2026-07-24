export function appUrl(path = '', base = import.meta.env.BASE_URL): string {
  return `${base.endsWith('/') ? base : `${base}/`}${path.replace(/^\/+/, '')}`;
}

export function relativeAppPath(pathname: string, base = import.meta.env.BASE_URL): string {
  const prefix = base === '/' ? '' : base.replace(/\/$/, '');
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length) || '/' : pathname;
}
