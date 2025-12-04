import { getDB } from '../config/database.js';

export class CustomerSource {
  static table = 'customer_sources';

  static async getAll() {
    const db = getDB();
    return db.all(`SELECT * FROM ${this.table} ORDER BY createdAt DESC, id DESC`);
  }

  static async getById(id) {
    const db = getDB();
    return db.get(`SELECT * FROM ${this.table} WHERE id = ?`, [id]);
  }

  static async getByName(name) {
    if (!name) return null;
    const db = getDB();
    return db.get(`SELECT * FROM ${this.table} WHERE LOWER(name) = LOWER(?)`, [name.trim()]);
  }

  static async create({ name, description, color }) {
    const trimmedName = name?.trim();
    if (!trimmedName) {
      throw new Error('نام منبع الزامی است');
    }

    const existing = await this.getByName(trimmedName);
    if (existing) return existing;

    const db = getDB();
    const result = await db.run(
      `INSERT INTO ${this.table} (name, description, color) VALUES (?, ?, ?)`,
      [trimmedName, description || null, color || null]
    );

    return this.getById(result.lastID);
  }

  static async ensure(name) {
    return this.create({ name });
  }
}

export default CustomerSource;

