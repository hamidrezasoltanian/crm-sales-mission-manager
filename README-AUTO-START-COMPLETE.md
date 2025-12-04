# راهنمای کامل Auto-Start و Monitoring

## وضعیت فعلی

✅ **Monitoring Cron Job**: فعال است (هر 5 دقیقه چک می‌کند)
- Script: `/home/hamidreza/App/sales-mission-manager/scripts/monitor.sh`
- Log: `/home/hamidreza/App/sales-mission-manager/scripts/monitor.log`
- Schedule: هر 5 دقیقه

⚠️ **Systemd Services**: نیاز به نصب با sudo

## نصب کامل Auto-Start

برای نصب کامل systemd services (auto-start در boot) و monitoring:

```bash
cd /home/hamidreza/App/sales-mission-manager
sudo bash scripts/setup-complete.sh
```

این اسکریپت:
1. Systemd services را نصب و enable می‌کند
2. Monitoring cron job را اضافه می‌کند
3. وضعیت همه چیز را بررسی می‌کند

## بررسی وضعیت

### بررسی Monitoring
```bash
# مشاهده لاگ monitoring
tail -f /home/hamidreza/App/sales-mission-manager/scripts/monitor.log

# بررسی cron job
crontab -l | grep monitor

# اجرای دستی monitoring
bash /home/hamidreza/App/sales-mission-manager/scripts/monitor.sh
```

### بررسی Systemd Services (بعد از نصب)
```bash
# وضعیت services
sudo systemctl status sales-mission-manager-backend
sudo systemctl status sales-mission-manager-frontend

# بررسی enable بودن
sudo systemctl is-enabled sales-mission-manager-backend
sudo systemctl is-enabled sales-mission-manager-frontend

# مشاهده لاگ‌ها
sudo journalctl -u sales-mission-manager-backend -f
sudo journalctl -u sales-mission-manager-frontend -f
```

## Monitoring چه چیزهایی را چک می‌کند؟

1. ✅ **Database**: بررسی وجود فایل دیتابیس
2. ✅ **Backend**: بررسی پورت 2001
3. ✅ **Telegram Bot**: بررسی initialization و process
4. ✅ **Frontend**: بررسی پورت 2000

اگر هر کدام down باشد، به صورت خودکار restart می‌شود.

## دستورات مفید

### Restart Services
```bash
# با systemd (بعد از نصب)
sudo systemctl restart sales-mission-manager-backend
sudo systemctl restart sales-mission-manager-frontend

# دستی
bash /home/hamidreza/App/sales-mission-manager/scripts/restart-backend.sh
```

### Stop Services
```bash
sudo systemctl stop sales-mission-manager-backend
sudo systemctl stop sales-mission-manager-frontend
```

### Disable Auto-Start
```bash
sudo systemctl disable sales-mission-manager-backend
sudo systemctl disable sales-mission-manager-frontend
```

### حذف Monitoring
```bash
crontab -e
# حذف خط مربوط به monitor.sh
```

## نکات مهم

1. **Monitoring** هر 5 دقیقه اجرا می‌شود و اگر سرویسی down باشد، restart می‌کند
2. **Systemd services** فقط با sudo نصب می‌شوند و برای auto-start در boot نیاز دارند
3. **Database** به صورت خودکار بررسی می‌شود و اگر وجود نداشته باشد، directory ایجاد می‌شود
4. **Telegram Bot** به صورت خودکار با backend restart می‌شود

## Troubleshooting

### اگر monitoring کار نمی‌کند:
```bash
# بررسی cron
crontab -l

# اجرای دستی
bash /home/hamidreza/App/sales-mission-manager/scripts/monitor.sh

# بررسی لاگ
tail -f /home/hamidreza/App/sales-mission-manager/scripts/monitor.log
```

### اگر services start نمی‌شوند:
```bash
# بررسی لاگ systemd
sudo journalctl -u sales-mission-manager-backend -n 50
sudo journalctl -u sales-mission-manager-frontend -n 50

# بررسی دستی
tail -f /tmp/backend.log
tail -f /tmp/frontend.log
```

