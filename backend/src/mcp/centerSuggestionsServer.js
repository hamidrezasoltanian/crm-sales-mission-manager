#!/usr/bin/env node
/**
 * MCP Server for Center Suggestions
 * این سرور وقتی نام مرکز پیدا نمی‌شود، از لیست موجود پیشنهاد می‌دهد
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getDB } from '../config/database.js';
import { ensureDatabaseConnection } from './initDatabase.js';

class CenterSuggestionsServer {
  constructor() {
    this.server = new Server(
      {
        name: 'center-suggestions-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // لیست tools موجود
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_centers',
          description:
            'جستجوی هوشمند مراکز در دیتابیس. وقتی نام مرکز پیدا نمی‌شود، از لیست موجود پیشنهادات مشابه را برمی‌گرداند. فقط از مراکز موجود در دیتابیس پیشنهاد می‌دهد، نه خارج از لیست.',
          inputSchema: {
            type: 'object',
            properties: {
              searchTerm: {
                type: 'string',
                description:
                  'نام مرکز یا بخشی از نام برای جستجو (مثلاً "نیکان" یا "شریعتی")',
              },
              city: {
                type: 'string',
                description: 'نام شهر برای فیلتر کردن نتایج (اختیاری)',
              },
              province: {
                type: 'string',
                description: 'نام استان برای فیلتر کردن نتایج (اختیاری)',
              },
              limit: {
                type: 'number',
                description: 'حداکثر تعداد نتایج (پیش‌فرض: 5)',
                default: 5,
              },
            },
            required: ['searchTerm'],
          },
        },
      ],
    }));

    // اجرای tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'search_centers') {
        return await this.searchCenters(args);
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  // نرمال‌سازی نام مرکز (حذف کلمات اضافی)
  normalizeCenterName(name = '') {
    if (!name || typeof name !== 'string') return '';

    const stopWords = [
      'بیمارستان',
      'مرکز',
      'مجموعه',
      'کلینیک',
      'درمانگاه',
      'مطب',
      'hospital',
      'center',
      'clinic',
      'medical',
      'برای',
      'که',
      'دارم',
      'داریم',
      'می',
      'میرم',
      'می‌روم',
      'می‌رم',
      'میخوام',
      'می‌خوام',
      'جهت',
      'تا',
      'از',
      'ایجاد',
      'ثبت',
      'بابت',
      'روی',
    ];

    let normalized = name.trim();

    for (const stopWord of stopWords) {
      const regex = new RegExp(`^${stopWord}\\s+|\\s+${stopWord}$`, 'gi');
      normalized = normalized.replace(regex, ' ').trim();
    }

    normalized = normalized.replace(/\s+/g, ' ').trim();
    return normalized.slice(0, 100);
  }

  // محاسبه شباهت بین دو رشته
  calculateSimilarity(str1 = '', str2 = '') {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }

    return matches / longer.length;
  }

  // محاسبه امتیاز برای یک مرکز
  scoreCenterMatch(center, searchTerm = '', cityHint = '') {
    if (!center || !searchTerm) return 0;

    const normalizedSearch = this.normalizeCenterName(searchTerm).toLowerCase();
    const centerName = (center.name || '').toLowerCase();
    const centerCity = (center.city || '').toLowerCase();
    const centerProvince = (center.province || '').toLowerCase();
    const centerAddress = (center.address || '').toLowerCase();

    let score = 0;

    // امتیاز برای تطابق دقیق نام
    if (centerName === normalizedSearch) {
      score += 100;
    } else if (centerName.startsWith(normalizedSearch)) {
      score += 80;
    } else if (centerName.includes(normalizedSearch)) {
      score += 60;
    } else {
      const similarity = this.calculateSimilarity(normalizedSearch, centerName);
      score += similarity * 40;
    }

    // امتیاز برای تطابق شهر
    if (cityHint) {
      const normalizedCity = cityHint.trim().toLowerCase();
      if (centerCity === normalizedCity) {
        score += 30;
      } else if (
        centerCity.includes(normalizedCity) ||
        normalizedCity.includes(centerCity)
      ) {
        score += 15;
      }
    }

    // امتیاز برای تطابق در آدرس
    if (centerAddress.includes(normalizedSearch)) {
      score += 10;
    }

    // امتیاز برای تطابق در استان
    if (centerProvince.includes(normalizedSearch)) {
      score += 5;
    }

    // امتیاز اضافی برای مراکز فعال
    if (center.isActive) {
      score += 5;
    }

    return score;
  }

  // جستجوی هوشمند مراکز
  async searchCenters(args) {
    try {
      const { searchTerm, city, province, limit = 5 } = args || {};

      if (!searchTerm || typeof searchTerm !== 'string') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'نام مرکز برای جستجو الزامی است',
                  suggestions: [],
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const db = getDB();
      const normalizedSearch = this.normalizeCenterName(searchTerm);

      if (!normalizedSearch || normalizedSearch.length < 2) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'نام مرکز باید حداقل 2 کاراکتر باشد',
                  suggestions: [],
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // جستجوی اولیه با LIKE
      let query = `
        SELECT c.*,
               p.name as responsiblePersonnelName,
               p.phone as responsiblePersonnelPhone
        FROM centers c
        LEFT JOIN personnel p ON c.responsiblePersonnelId = p.id
        WHERE c.isActive = 1
      `;

      const params = [];
      const searchPattern = `%${normalizedSearch}%`;

      query += ` AND (
        c.name LIKE ? OR
        c.address LIKE ? OR
        c.city LIKE ? OR
        c.province LIKE ? OR
        p.name LIKE ?
      )`;

      params.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );

      if (city) {
        query += ' AND c.city = ?';
        params.push(city);
      }

      if (province) {
        query += ' AND c.province = ?';
        params.push(province);
      }

      query += ' LIMIT 50'; // بیشتر بگیریم تا بعداً فیلتر کنیم

      const initialCandidates = await db.all(query, params);

      let allCenters = initialCandidates;

      // اگر با LIKE چیزی پیدا نشد، همه مراکز فعال را بگیر
      if (!Array.isArray(initialCandidates) || initialCandidates.length === 0) {
        let allQuery = `
          SELECT c.*,
                 p.name as responsiblePersonnelName,
                 p.phone as responsiblePersonnelPhone
          FROM centers c
          LEFT JOIN personnel p ON c.responsiblePersonnelId = p.id
          WHERE c.isActive = 1
        `;

        const allParams = [];

        if (city) {
          allQuery += ' AND c.city = ?';
          allParams.push(city);
        }

        if (province) {
          allQuery += ' AND c.province = ?';
          allParams.push(province);
        }

        allQuery += ' LIMIT 200';

        allCenters = await db.all(allQuery, allParams);
      }

      if (!Array.isArray(allCenters) || allCenters.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: 'هیچ مرکزی در دیتابیس پیدا نشد',
                  searchTerm: normalizedSearch,
                  suggestions: [],
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // امتیازدهی و مرتب‌سازی
      const scored = allCenters
        .map((center) => ({
          center,
          score: this.scoreCenterMatch(center, normalizedSearch, city),
        }))
        .filter((item) => item.score > 20) // فقط نتایج با امتیاز بالای 20
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((item) => ({
          id: item.center.id,
          name: item.center.name,
          city: item.center.city || null,
          province: item.center.province || null,
          address: item.center.address || null,
          type: item.center.type || null,
          responsiblePersonnel: item.center.responsiblePersonnelName || null,
          score: Math.round(item.score * 100) / 100,
        }));

      const result = {
        message: scored.length > 0
          ? `برای "${normalizedSearch}" ${scored.length} مرکز مشابه پیدا شد:`
          : `هیچ مرکز مشابهی برای "${normalizedSearch}" پیدا نشد`,
        searchTerm: normalizedSearch,
        originalSearchTerm: searchTerm,
        suggestions: scored,
        totalFound: scored.length,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('[MCP] Error searching centers:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: 'خطا در جستجوی مراکز',
                message: error.message,
                suggestions: [],
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    // اطمینان از اتصال دیتابیس
    try {
      await ensureDatabaseConnection();
      const db = getDB();
      if (!db) {
        throw new Error('Database not initialized');
      }
    } catch (error) {
      console.error('[MCP] Database connection error:', error);
      process.exit(1);
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[MCP] Center Suggestions Server running on stdio');
  }
}

// اجرای سرور
const server = new CenterSuggestionsServer();
server.run().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});

