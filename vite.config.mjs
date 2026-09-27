import { defineConfig } from 'vite';
import { sites } from '@openai/sites-vite-plugin';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  publicDir: '.runtime/sites-public',
  plugins: [sites(), cloudflare({
    viteEnvironment: { name: 'server' },
    config: {
      name: 'trackbite-restaurant',
      main: './trackbite-system/cloud/sites/worker.mjs',
      compatibility_date: '2026-05-22',
      compatibility_flags: ['nodejs_compat'],
      assets: { binding: 'ASSETS', run_worker_first: true },
      d1_databases: [{ binding: 'DB', database_name: 'trackbite-orders', database_id: '00000000-0000-4000-8000-000000000000' }]
    }
  })]
});
