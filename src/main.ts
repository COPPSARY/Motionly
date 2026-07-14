/**
 * Main application entry point - Svelte 5
 */

import { mount } from 'svelte';
import MotionlyApp from './ui/MotionlyApp.svelte';

const app = mount(MotionlyApp, {
  target: document.body,
});

export default app;
