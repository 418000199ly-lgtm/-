import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(), 
      tailwindcss(),
      cssInjectedByJs(), // 将 CSS 自动打入 JS，彻底避免在 HBuilderX、Capacitor 或雷神等老版安卓模拟器下 file:// 协议、跨域、加载时机等引起的 CSS 完全不生效、排版崩溃与文字按钮重叠问题
      legacy({
        targets: ['chrome >= 60', 'android >= 6', 'defaults'], // 自动生成 Polyfill 降级包，兼容老安卓 WebView 内核
        additionalLegacyPolyfills: ['regenerator-runtime/runtime']
      })
    ],
    build: {
      target: ['es2015', 'chrome60'], // 打包代码至支持旧内核的等级
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
