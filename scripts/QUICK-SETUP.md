# راه‌اندازی سریع Auto-Start

## روش 1: Systemd Services (پیشنهادی - برای auto-start در boot)

```bash
cd /home/hamidreza/App/sales-mission-manager
sudo ./scripts/setup-auto-start.sh
```

این دستور:
- ✅ سرویس‌ها را نصب می‌کند
- ✅ در boot خودکار راه‌اندازی می‌شوند
- ✅ اگر crash کنند، خودکار restart می‌شوند

## روش 2: Monitoring Script (بررسی دوره‌ای هر 5 دقیقه)

```bash
cd /home/hamidreza/App/sales-mission-manager
./scripts/setup-monitoring.sh
```

این script:
- ✅ هر 5 دقیقه چک می‌کند
- ✅ اگر سرویس down باشد، restart می‌کند
- ✅ لاگ در `scripts/monitor.log` ذخیره می‌شود

## استفاده دستی

```bash
# راه‌اندازی همه
./scripts/start-all.sh

# یا جداگانه
./scripts/start-backend.sh
./scripts/start-frontend.sh

# چک کردن وضعیت
./scripts/monitor.sh
```

## بررسی وضعیت

```bash
# بررسی پورت‌ها
lsof -i :2001  # Backend
lsof -i :2000  # Frontend

# بررسی systemd services
sudo systemctl status sales-mission-manager-backend
sudo systemctl status sales-mission-manager-frontend

# مشاهده لاگ‌ها
tail -f /tmp/backend.log
tail -f /tmp/frontend.log
tail -f scripts/monitor.log
```

