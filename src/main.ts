/**
 * Main application entry point - Svelte 5
 */

import '@fontsource-variable/inter';
import { inject } from '@vercel/analytics';
import { mount } from 'svelte';
import { appUrl, relativeAppPath } from './app/routing';
import MotionlyApp from './ui/MotionlyApp.svelte';

if (relativeAppPath(location.pathname).replace(/\/$/, '') === '/editor') {
  history.replaceState(null, '', appUrl());
}

inject({ mode: import.meta.env.PROD ? 'production' : 'development' });

const app = mount(MotionlyApp, {
  target: document.body,
});

export default app;
