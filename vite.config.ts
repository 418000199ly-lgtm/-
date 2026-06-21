import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';
import {defineConfig} from 'vite';
import { browserslistToTargets } from 'lightningcss';
import browserslist from 'browserslist';

// A custom Vite plugin to remove 'crossorigin' attributes from scripts and links.
// This is critical for Capacitor/Cordova webviews as crossorigin triggers CORS checks 
// which are blocked when running files locally (e.g. file:// or custom webview protocols).
const removeCrossorigin = () => {
  return {
    name: 'remove-crossorigin',
    enforce: 'post' as const, // Run after all other plugins (like legacy) have inserted their tags
    transformIndexHtml(html: string) {
      return html
        .replace(/\bcrossorigin\s*=\s*"[^"]*"/gi, '')
        .replace(/\bcrossorigin\s*=\s*'[^']*'/gi, '')
        .replace(/\bcrossorigin\b/gi, '');
    }
  };
};

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(), 
      tailwindcss(),
      legacy({
        targets: ['chrome >= 60', 'android >= 6', 'defaults'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime']
      }),
      removeCrossorigin(),
    ],
    css: {
      transformer: 'lightningcss',
      lightningcss: {
        targets: browserslistToTargets(browserslist('chrome >= 60, android >= 6')),
      }
    },
    build: {
      target: 'es2015', // Lower target for older android webviews
      cssTarget: 'chrome60', // Ensure CSS is compiled to match older webviews
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
