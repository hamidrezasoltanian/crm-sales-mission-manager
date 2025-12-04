module.exports = {
  apps: [
    {
      name: 'sales-backend',
      script: './backend/src/server.js',
      cwd: '/home/hamidreza/App/sales-mission-manager',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 2001
      },
      error_file: '/home/hamidreza/App/sales-mission-manager/logs/backend-error.log',
      out_file: '/home/hamidreza/App/sales-mission-manager/logs/backend-out.log',
      log_file: '/home/hamidreza/App/sales-mission-manager/logs/backend-combined.log',
      time: true,
      merge_logs: true,
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'sales-frontend',
      script: 'npm',
      args: 'run start',
      cwd: '/home/hamidreza/App/sales-mission-manager/frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 2000
      },
      error_file: '/home/hamidreza/App/sales-mission-manager/logs/frontend-error.log',
      out_file: '/home/hamidreza/App/sales-mission-manager/logs/frontend-out.log',
      log_file: '/home/hamidreza/App/sales-mission-manager/logs/frontend-combined.log',
      time: true,
      merge_logs: true,
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};

