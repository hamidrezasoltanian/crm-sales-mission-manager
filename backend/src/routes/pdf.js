import express from 'express';
import puppeteer from 'puppeteer';
import jalaali from 'jalaali-js';

const router = express.Router();

// Helper function برای تبدیل تاریخ به فارسی
function toPersianDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const jDate = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const monthNames = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ];
  return `${jDate.jd} ${monthNames[jDate.jm - 1]} ${jDate.jy}`;
}

// Helper برای escape HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Generate PDF endpoint با استفاده از puppeteer
router.post('/generate', async (req, res) => {
  let browser;
  try {
    const { title, headers, rows, filename } = req.body;

    if (!title || !headers || !rows) {
      return res.status(400).json({ error: 'عنوان، هدرها و ردیف‌ها الزامی هستند' });
    }

    // ایجاد HTML
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Vazir:wght@400;700&display=swap');
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          @font-face {
            font-family: 'Vazir';
            font-style: normal;
            font-weight: 400;
            src: url('https://fonts.gstatic.com/s/vazir/v28/7P-rf2QpV0iNcvYWyWqyFQN2XQ.woff2') format('woff2');
            font-display: swap;
          }
          body {
            font-family: 'Vazir', 'Tahoma', 'Arial', sans-serif;
            direction: rtl;
            text-align: right;
            padding: 20px;
            background: white;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          h1 {
            font-size: 18px;
            margin-bottom: 10px;
            color: #1f2937;
            font-weight: bold;
          }
          .date {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-top: 10px;
          }
          th {
            background-color: #3b82f6;
            color: white;
            padding: 8px;
            text-align: right;
            font-weight: bold;
            border: 1px solid #2563eb;
          }
          td {
            padding: 6px;
            text-align: right;
            border: 1px solid #e5e7eb;
          }
          tr:nth-child(even) {
            background-color: #f5f7fa;
          }
          tr:nth-child(odd) {
            background-color: white;
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <div class="date">تاریخ: ${toPersianDate(new Date())}</div>
        <table>
          <thead>
            ${headers.map(header => `
              <tr>
                ${header.map(cell => `<th>${escapeHtml(String(cell))}</th>`).join('')}
              </tr>
            `).join('')}
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map(cell => `<td>${escapeHtml(String(cell))}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    // راه‌اندازی browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });

    const page = await browser.newPage();
    
    // Set longer timeout for font loading
    page.setDefaultTimeout(30000);
    
    // Wait for fonts to load before generating PDF
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait for fonts to be fully loaded
    try {
      await page.evaluate(async () => {
        await document.fonts.ready;
        // Wait a bit more for font rendering
        await new Promise(resolve => setTimeout(resolve, 2000));
      });
    } catch (fontError) {
      console.warn('Font loading warning:', fontError.message);
      // Continue anyway - fonts may still render
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // تولید PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '10mm',
        bottom: '20mm',
        left: '10mm'
      },
      printBackground: true
    });

    await browser.close();

    // ارسال PDF
    // Use RFC 5987 encoding for filename with non-ASCII characters
    const dateStr = new Date().toISOString().split('T')[0];
    const baseFilename = filename || 'report';
    const fullFilename = `${baseFilename}_${dateStr}.pdf`;
    
    // For ASCII-only filename, use simple format
    // For non-ASCII, use RFC 5987 format
    const isAscii = /^[\x00-\x7F]*$/.test(fullFilename);
    
    // Ensure we send binary data, not JSON
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    if (isAscii) {
      res.setHeader('Content-Disposition', `attachment; filename="${fullFilename}"`);
    } else {
      // Use RFC 5987 encoding for non-ASCII filenames
      const encodedFilename = encodeURIComponent(fullFilename);
      res.setHeader('Content-Disposition', `attachment; filename="${fullFilename.replace(/[^\x20-\x7E]/g, '_')}"; filename*=UTF-8''${encodedFilename}`);
    }
    // Send as binary buffer
    res.end(pdfBuffer, 'binary');

  } catch (error) {
    console.error('Error generating PDF:', error);
    if (browser) {
      await browser.close();
    }
    res.status(500).json({ error: 'خطا در تولید PDF: ' + error.message });
  }
});

export default router;
