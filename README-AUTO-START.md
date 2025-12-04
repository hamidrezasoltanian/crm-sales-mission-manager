# راه‌اندازی خودکار (Auto-Start)

این راهنما برای راه‌اندازی خودکار اپلیکیشن Sales Mission Manager است.

## روش 1: استفاده از Systemd (پیشنهادی)

### نصب سرویس‌ها

```bash
cd /home/hamidreza/App/sales-mission-manager
sudo ./scripts/setup-auto-start.sh
```

این دستور:
- سرویس‌های systemd را نصب می‌کند
- آن‌ها را برای راه‌اندازی خودکار در boot فعال می‌کند
- سرویس‌ها را شروع می‌کند

### دستورات مفید

```bash
# بررسی وضعیت
sudo systemctl status sales-mission-manager-backend
sudo systemctl status sales-mission-manager-frontend

# راه‌اندازی مجدد
sudo systemctl restart sales-mission-manager-backend
sudo systemctl restart sales-mission-manager-frontend

# توقف
sudo systemctl stop sales-mission-manager-backend
sudo systemctl stop sales-mission-manager-frontend

# مشاهده لاگ‌ها
journalctl -u sales-mission-manager-backend -f
journalctl -u sales-mission-manager-frontend -f
```

## روش 2: Monitoring Script (بررسی دوره‌ای)

این script هر 5 دقیقه چک می‌کند که سرویس‌ها در حال اجرا هستند یا نه و اگر down بودند آن‌ها را restart می‌کند.

### نصب

```bash
cd /home/hamidreza/App/sales-mission-manager
./scripts/setup-monitoring.sh
```

### استفاده دستی

```bash
# اجرای یکباره
./scripts/monitor.sh

# مشاهده لاگ monitoring
tail -f scripts/monitor.log
```

## روش 3: راه‌اندازی دستی

```bash
# راه‌اندازی همه سرویس‌ها
./scripts/start-all.sh

# یا جداگانه
./scripts/start-backend.sh
./scripts/start-frontend.sh
```

## پورت‌ها

- Backend: `http://localhost:2001`
- Frontend: `http://localhost:2000`
- API: `http://localhost:2001/api`

## لاگ‌ها

- Backend: `/tmp/backend.log`
- Frontend: `/tmp/frontend.log`
- Monitoring: `scripts/monitor.log`

## حذف سرویس‌ها

```bash
# حذف systemd services
sudo systemctl stop sales-mission-manager-backend
sudo systemctl stop sales-mission-manager-frontend
sudo systemctl disable sales-mission-manager-backend
sudo systemctl disable sales-mission-manager-frontend
sudo rm /etc/systemd/system/sales-mission-manager-*.service
sudo systemctl daemon-reload

# حذف monitoring cron
crontab -e  # حذف خط مربوط به monitor.sh
```

