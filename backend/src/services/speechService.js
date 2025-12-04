import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';
import { SpeechClient } from '@google-cloud/speech';

export class SpeechService {
  constructor(bot) {
    this.bot = bot;
    this.client = null;
    this.languageCode = process.env.SPEECH_LANGUAGE_CODE || 'fa-IR';
    this.encoding = process.env.SPEECH_ENCODING || 'OGG_OPUS';
    this.sampleRateHertz = parseInt(process.env.SPEECH_SAMPLE_RATE || '48000', 10);
  }

  getClient() {
    if (!this.client) {
      this.client = new SpeechClient();
    }
    return this.client;
  }

  async transcribeTelegramVoice(fileId, options = {}) {
    if (!fileId) {
      throw new Error('Voice file id is required');
    }

    const tempFilePath = await this.downloadTelegramFile(fileId);

    try {
      const transcription = await this.transcribeFile(tempFilePath, options);
      return transcription;
    } finally {
      await fs.promises.unlink(tempFilePath).catch(() => {});
    }
  }

  async downloadTelegramFile(fileId) {
    const file = await this.bot.getFile(fileId);
    if (!file || !file.file_path) {
      throw new Error('Unable to resolve Telegram file path');
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }

    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const tempPath = path.join(
      os.tmpdir(),
      `${file.file_unique_id || fileId}-${Date.now()}.oga`
    );

    const response = await axios.get(fileUrl, { responseType: 'stream' });
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    return tempPath;
  }

  async transcribeFile(filePath, options = {}) {
    const client = this.getClient();
    const audioBuffer = await fs.promises.readFile(filePath);

    const request = {
      audio: { content: audioBuffer.toString('base64') },
      config: {
        languageCode: options.languageCode || this.languageCode,
        encoding: options.encoding || this.encoding,
        sampleRateHertz: options.sampleRateHertz || this.sampleRateHertz,
        enableAutomaticPunctuation: true,
        model: process.env.SPEECH_MODEL || undefined,
      }
    };

    const [response] = await client.recognize(request);
    const transcription = response.results
      ?.map(result => result.alternatives?.[0]?.transcript)
      .filter(Boolean)
      .join(' ')
      ?.trim();

    return transcription || '';
  }
}

