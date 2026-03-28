/**
 * PM2 Ecosystem Configuration
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop tele-mind
 *   pm2 restart tele-mind
 *   pm2 logs tele-mind
 *   pm2 monit
 *
 * Save current processes:
 *   pm2 save
 *
 * Restore processes on reboot:
 *   pm2 startup
 */

module.exports = {
  apps: [
    {
      name: 'tele-mind',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      // Listen on specific port for readiness check
      listen_timeout: 10000,
    },
  ],
};
