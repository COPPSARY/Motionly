/**
 * Main application entry point - Svelte 5
 */

import { mount } from 'svelte';
import { appUrl, initialRoute, ONBOARDING_COMPLETE_KEY, relativeAppPath } from './app/routing';
import Onboarding from './ui/Onboarding.svelte';
import MotionlyApp from './ui/MotionlyApp.svelte';

const forceWelcome = new URLSearchParams(location.search).get('welcome') === '1';
const completed = localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
const route = initialRoute(location.pathname, forceWelcome, completed, import.meta.env.BASE_URL);

if (route === 'editor' && relativeAppPath(location.pathname).replace(/\/$/, '') !== '/editor') {
  history.replaceState(null, '', appUrl('editor'));
}

const app = mount(route === 'editor' ? MotionlyApp : Onboarding, {
  target: document.body,
});

export default app;
