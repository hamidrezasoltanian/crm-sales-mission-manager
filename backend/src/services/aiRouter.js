import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export class AiRouter {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.modelName = DEFAULT_MODEL;

    console.log(`[AiRouter] Initializing with model: ${this.modelName}, API key present: ${!!this.apiKey}`);

    if (this.apiKey) {
      try {
        this.client = new GoogleGenerativeAI(this.apiKey);
        this.model = this.client.getGenerativeModel({ model: this.modelName });
        console.log(`[AiRouter] Successfully initialized with model: ${this.modelName}`);
      } catch (error) {
        console.error('❌ Failed to initialize Gemini client:', error.message);
        this.client = null;
        this.model = null;
      }
    } else {
      console.warn('⚠️ GEMINI_API_KEY is not configured. AI router is disabled.');
      this.client = null;
      this.model = null;
    }
  }

  isEnabled() {
    return !!this.model;
  }

  async interpret(text, context = {}) {
    if (!this.isEnabled()) {
      throw new Error('Gemini AI is not configured.');
    }

    if (!text || !text.trim()) {
      return this.buildFallbackResult('unknown', 0, {}, 'متن دریافت نشد.');
    }

    const prompt = this.buildPrompt(text, context);

    const generationConfig = {
      temperature: 0.2,
      topK: 32,
      topP: 0.85,
      maxOutputTokens: 8192
    };

    let result;
    try {
      result = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig
      });
    } catch (error) {
      console.error('❌ Gemini generateContent error:', error?.message || error);
      return this.buildFallbackResult('unknown', 0, {}, 'پاسخی از مدل دریافت نشد.');
    }

    const rawText = this.extractResponseText(result?.response);
    if (!rawText) {
      if (result?.response) {
        console.warn('⚠️ Gemini returned empty response body. Dumping raw response object:');
        console.dir(result.response, { depth: 5 });
      } else {
        console.warn('⚠️ Gemini returned empty response body and response object is undefined.');
      }
      return this.buildFallbackResult('unknown', 0, {}, 'پاسخی از مدل دریافت نشد.');
    }
    const parsed = this.safeParseJson(rawText);
    parsed.raw = rawText;

    return parsed;
  }

  extractResponseText(response) {
    if (!response) return '';
    try {
      if (typeof response.text === 'function') {
        const textValue = response.text();
        if (textValue) {
          return textValue;
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to read response.text():', error.message);
    }

    const candidates = response.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate?.content?.parts || [];
      const textParts = parts
        .map(part => part?.text)
        .filter(Boolean);
      if (textParts.length) {
        return textParts.join('\n');
      }
    }

    return '';
  }

  buildPrompt(text, context) {
    const userName = context?.userName || 'کاربر';
    const userRole = context?.userRole || 'نامشخص';

    return `
شما دستیار هوش مصنوعی سیستم CRM فروش و ماموریت آتنا زیست درمان هستید.
وظیفه شما این است که ورودی گفتاری یا متنی کاربر (به زبان فارسی) را
به یکی از intent های از پیش تعریف شده تبدیل کنید و اطلاعات ساختاریافته را برگردانید.

کاربر: ${userName}
نقش احتمالی: ${userRole}
پیام:
"""
${text.trim()}
"""

قوانین:
1. فقط JSON معتبر بازگردان.
2. بدون هیچ متن اضافی قبل یا بعد از JSON پاسخ نده.
3. ساختار JSON باید این باشد:
{
  "intent": "medical_request | create_contact | request_leave | request_report | create_assignment | unknown",
  "confidence": 0.0-1.0,
  "fields": {
      "centerName": "",
      "centerCandidates": [],
      "centerCity": "",
      "contactType": "tehran | province | visit | phone",
      "assignee": "",
      "startDate": "",
      "endDate": "",
      "notes": "",
      "tags": [],
      "reportType": "assignments | contacts | combined",
      "timeRange": "day | week | month | all",
      "leaveType": "annual | sick | hourly | emergency",
      "doctorName": "",
      "specialty": "",
      "province": "",
      "brand": "",
      "product": "",
      "description": ""
  },
  "response": "پاسخ متنی کوتاه برای کاربر به زبان فارسی",
  "followUpQuestion": "اگر برای تکمیل کار نیاز به سوال است، اینجا بنویس؛ در غیر اینصورت null"
}

Intent های موجود:
- medical_request: آپلود یا جستجوی تاییدیه پزشکی، نسخه، آزمایش (کلیدواژه: تاییدیه، پزشکی، medical، نسخه، آزمایش، گواهی، دکتر در مورد فایل)
- create_contact: ثبت تماس تلفنی یا حضوری با مرکز (کلیدواژه: تماس، call، پیگیری، زنگ)
- request_leave: درخواست مرخصی (کلیدواژه: مرخصی، استعلاجی، ساعتی، leave)
- request_report: درخواست گزارش (ماموریت‌ها، تماس‌ها، یا هر دو)
- create_assignment: ایجاد ماموریت یا بازدید حضوری (کلیدواژه: ماموریت، ویزیت، بازدید، اعزام)
- unknown: درخواست نامشخص

توجه مهم: 
- اگر متن شامل "تاییدیه" یا "پزشکی" یا "medical" یا "نسخه" یا "آزمایش" بود، intent باید حتماً medical_request باشد نه create_assignment
- اگر متن شامل "تماس" یا "call" بود، intent باید create_contact باشد نه create_assignment
- فقط زمانی create_assignment بده که واقعاً درخواست ماموریت یا بازدید حضوری باشد

برای request_report:
- reportType: "assignments" برای ماموریت‌ها، "contacts" برای تماس‌ها، "combined" برای هر دو
- timeRange: "day" برای امروز، "week" برای این هفته، "month" برای این ماه، "all" برای همه

اگر intent مشخص نبود، intent را "unknown" قرار بده و در response توضیح بده که نیاز به توضیح بیشتر است.
اگر در متن اشاره‌ای به تهران، شهر، نوع مرخصی، یا بازه زمانی شد آن را استخراج کن و داخل fields قرار بده.

استخراج نام مرکز (centerName و centerCandidates):
- اگر در متن یک مرکز ذکر شد، آن را در centerName قرار بده.
- اگر چند مرکز با جداکننده (، / و یا خط جدید) ذکر شد، هر کدام را در centerCandidates به صورت آرایه قرار بده.
- نام مرکز را بدون کلمات اضافی مثل "بیمارستان"، "مرکز"، "مجموعه" استخراج کن.
- مثال: "شریعتی، یاس سپید و نیکان" -> centerCandidates: ["شریعتی", "یاس سپید", "نیکان"]
- مثال: "بیمارستان نیکان" -> centerName: "نیکان"
- اگر نام مرکز در متن مشخص نیست، centerName را خالی بگذار و centerCandidates را null بگذار.
`
      .trim();
  }

  safeParseJson(rawText) {
    if (!rawText) {
      return this.buildFallbackResult('unknown', 0, {}, 'پاسخی از مدل دریافت نشد.');
    }

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const candidate = jsonMatch ? jsonMatch[0] : rawText;

    try {
      const parsed = JSON.parse(candidate);
      return {
        intent: parsed.intent || 'unknown',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        fields: parsed.fields || {},
        response: parsed.response || '',
        followUpQuestion: parsed.followUpQuestion || null
      };
    } catch (error) {
      console.warn('⚠️ Failed to parse Gemini response as JSON. raw:', rawText);
      return this.buildFallbackResult('unknown', 0, {}, 'متوجه درخواست شما نشدم، لطفاً واضح‌تر بگویید.');
    }
  }

  buildFallbackResult(intent, confidence, fields, response) {
    return {
      intent,
      confidence,
      fields,
      response,
      followUpQuestion: null,
      raw: null
    };
  }
}

