/**
 * pm2 process definition for the CRM API.
 *
 *   npm run build            # compile to dist/ first - pm2 runs the built output
 *   npx pm2 start ecosystem.config.js
 *   npx pm2 logs aspcv-api
 *   npx pm2 save             # persist the process list across reboots
 *
 * On Linux also run `npx pm2 startup` once; on Windows use pm2-windows-startup
 * or wrap `pm2 resurrect` in a Scheduled Task set to run at boot.
 *
 * Without a process manager, an unhandled crash at 02:00 stops the business-rule
 * and AMC-reminder crons until someone notices by hand.
 */
module.exports = {
  apps: [
    {
      name: 'aspcv-api',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      // Crons in index.ts use setInterval and hold per-process state, so a
      // second instance would double-fire every rule. Keep this at 1 unless
      // that scheduling is moved out to a shared lock.
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      // A process that dies within this window counts as an unstable start,
      // so pm2 backs off instead of hot-looping a crash.
      min_uptime: '20s',
      restart_delay: 4000,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
      },
      time: true,
      out_file: 'logs/api-out.log',
      error_file: 'logs/api-error.log',
      merge_logs: true,
    },
  ],
}
