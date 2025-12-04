import { getDB } from '../config/database.js';

const MAX_ADDRESSES = 3;

export class Center {
  static async getAll(filters = {}) {
    const db = getDB();
    let query = `
      SELECT c.*,
             (p.first_name || ' ' || p.last_name) as responsiblePersonnelName,
             p.phone as responsiblePersonnelPhone,
             cs.name as sourceName
      FROM centers c
      LEFT JOIN personnel p ON c.responsiblePersonnelId = p.id
      LEFT JOIN customer_sources cs ON c.sourceId = cs.id
      WHERE 1=1
    `;

    const params = [];

    if (filters.type) {
      query += ' AND c.type = ?';
      params.push(filters.type);
    }

    if (filters.isActive !== undefined) {
      query += ' AND c.isActive = ?';
      params.push(filters.isActive ? 1 : 0);
    }

    if (filters.responsiblePersonnelId) {
      query += ' AND c.responsiblePersonnelId = ?';
      params.push(parseInt(filters.responsiblePersonnelId));
    }

    if (filters.city) {
      query += ' AND c.city = ?';
      params.push(filters.city);
    }

    if (filters.province) {
      query += ' AND c.province = ?';
      params.push(filters.province);
    }

    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      query += ` AND (
        c.name LIKE ? OR
        c.address LIKE ? OR
        c.city LIKE ? OR
        c.province LIKE ? OR
        (p.first_name || ' ' || p.last_name) LIKE ?
      )`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY c.createdAt DESC';

    if (filters.limit !== undefined) {
      query += ` LIMIT ${parseInt(filters.limit)}`;
      if (filters.offset !== undefined) {
        query += ` OFFSET ${parseInt(filters.offset)}`;
      }
    }

    const rows = await db.all(query, params);
    const hydrated = await this.attachRelations(rows);
    return hydrated.map((row) => this.formatRow(row));
  }

  static async count(filters = {}) {
    const db = getDB();
    let query = `
      SELECT COUNT(*) as total
      FROM centers c
      LEFT JOIN personnel p ON c.responsiblePersonnelId = p.id
      WHERE 1=1
    `;

    const params = [];

    if (filters.type) {
      query += ' AND c.type = ?';
      params.push(filters.type);
    }

    if (filters.isActive !== undefined) {
      query += ' AND c.isActive = ?';
      params.push(filters.isActive ? 1 : 0);
    }

    if (filters.responsiblePersonnelId) {
      query += ' AND c.responsiblePersonnelId = ?';
      params.push(parseInt(filters.responsiblePersonnelId));
    }

    if (filters.city) {
      query += ' AND c.city = ?';
      params.push(filters.city);
    }

    if (filters.province) {
      query += ' AND c.province = ?';
      params.push(filters.province);
    }

    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      query += ' AND (c.name LIKE ? OR c.address LIKE ? OR c.city LIKE ? OR c.province LIKE ? OR (p.first_name || \' \' || p.last_name) LIKE ?)';
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const result = await db.get(query, params);
    return result ? result.total : 0;
  }

  static async getById(id) {
    const db = getDB();
    // Convert id to integer if it's a string
    const centerId = parseInt(id, 10);
    if (isNaN(centerId)) {
      return null;
    }
    
    const row = await db.get(
      `
      SELECT c.*,
             (p.first_name || ' ' || p.last_name) as responsiblePersonnelName,
             p.phone as responsiblePersonnelPhone,
             cs.name as sourceName
      FROM centers c
      LEFT JOIN personnel p ON c.responsiblePersonnelId = p.id
      LEFT JOIN customer_sources cs ON c.sourceId = cs.id
      WHERE c.id = ?
      `,
      [centerId]
    );

    if (!row) return null;

    const [hydrated] = await this.attachRelations([row]);
    return hydrated ? this.formatRow(hydrated) : null;
  }

  static async create(data = {}) {
    const db = getDB();
    const now = new Date().toISOString();
    const centerType = data.type || 'lead';
    const customerType = data.customerType || 'individual';
    const tagsJson = this.serializeTags(data.tags);
    const addressesInput = this.normalizeAddressesInput(data);
    const phonesInput = this.normalizePhonesInput(data);
    const customFieldsInput = this.normalizeCustomFieldsInput(data);
    const deliveryContactsInput = this.normalizeDeliveryContactsInput(data);

    await db.exec('BEGIN');
    try {
      const result = await db.run(
        `
        INSERT INTO centers (
          name, type, legal_type, customerType, sourceId,
          address, city, province, district, postal_code,
          mobile, website, economic_code, national_id,
          financial_credit, credit_rating, potentialLevel, potentialNotes,
          bank_info, warehouse_receiver, description,
          latitude, longitude, snapLocationId,
          responsiblePersonnelId, isActive, tags,
          createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          data.name,
          centerType,
          data.legal_type || data.legalType || null,
          customerType,
          data.sourceId || null,
          data.address || addressesInput[0]?.addressLine || null,
          data.city || addressesInput[0]?.city || null,
          data.province || addressesInput[0]?.province || null,
          data.district || addressesInput[0]?.district || null,
          data.postal_code || data.postalCode || addressesInput[0]?.postalCode || null,
          data.mobile || null,
          data.website || null,
          data.economic_code || data.economicCode || null,
          data.national_id || data.nationalId || null,
          data.financial_credit ?? data.financialCredit ?? null,
          data.credit_rating || data.creditRating || null,
          data.potentialLevel || null,
          data.potentialNotes || null,
          data.bank_info || data.bankInfo || null,
          data.warehouse_receiver || data.warehouseReceiver || null,
          data.description || null,
          data.latitude || null,
          data.longitude || null,
          data.snapLocationId || null,
          data.responsiblePersonnelId || null,
          data.isActive === false ? 0 : 1,
          tagsJson,
          now,
          now
        ]
      );

      const centerId = result.lastID;
      const addressMap = await this.replaceCenterAddresses(db, centerId, addressesInput);
      await this.replaceCenterPhones(db, centerId, phonesInput);
      await this.replaceCenterCustomFields(db, centerId, customFieldsInput);
      await this.replaceCenterDeliveryContacts(db, centerId, deliveryContactsInput, addressMap);

      await db.exec('COMMIT');

      return await this.getById(centerId);
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  }

  static async update(id, data = {}) {
    const db = getDB();
    const existing = await this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates = [];
    const values = [];

    const mappings = [
      ['name', 'name'],
      ['type', 'type'],
      ['legal_type', 'legal_type'],
      ['legalType', 'legal_type'],
      ['customerType', 'customerType'],
      ['sourceId', 'sourceId'],
      ['address', 'address'],
      ['city', 'city'],
      ['province', 'province'],
      ['district', 'district'],
      ['postal_code', 'postal_code'],
      ['postalCode', 'postal_code'],
      ['mobile', 'mobile'],
      ['website', 'website'],
      ['economic_code', 'economic_code'],
      ['economicCode', 'economic_code'],
      ['national_id', 'national_id'],
      ['nationalId', 'national_id'],
      ['financial_credit', 'financial_credit'],
      ['financialCredit', 'financial_credit'],
      ['credit_rating', 'credit_rating'],
      ['creditRating', 'credit_rating'],
      ['potentialLevel', 'potentialLevel'],
      ['potentialNotes', 'potentialNotes'],
      ['bank_info', 'bank_info'],
      ['bankInfo', 'bank_info'],
      ['warehouse_receiver', 'warehouse_receiver'],
      ['warehouseReceiver', 'warehouse_receiver'],
      ['description', 'description'],
      ['latitude', 'latitude'],
      ['longitude', 'longitude'],
      ['snapLocationId', 'snapLocationId'],
      ['responsiblePersonnelId', 'responsiblePersonnelId']
    ];

    for (const [inputKey, column] of mappings) {
      if (data[inputKey] !== undefined) {
        updates.push(`${column} = ?`);
        values.push(data[inputKey]);
      }
    }

    if (data.isActive !== undefined) {
      updates.push('isActive = ?');
      values.push(data.isActive ? 1 : 0);
    }

    if (data.tags !== undefined) {
      updates.push('tags = ?');
      values.push(this.serializeTags(data.tags));
    }

    updates.push('updatedAt = ?');
    values.push(now);
    values.push(id);

    await db.exec('BEGIN');
    try {
      if (updates.length) {
        await db.run(
          `UPDATE centers SET ${updates.join(', ')} WHERE id = ?`,
          values
        );
      }

      let addressMap = null;
      if (data.addresses !== undefined || data.address !== undefined) {
        const addressesInput = this.normalizeAddressesInput({
          ...data,
          address: data.address !== undefined ? data.address : existing.address,
          city: data.city !== undefined ? data.city : existing.city,
          province: data.province !== undefined ? data.province : existing.province,
          district: data.district !== undefined ? data.district : existing.district,
          postal_code: data.postal_code !== undefined ? data.postal_code : existing.postal_code || existing.postalCode
        });
        addressMap = await this.replaceCenterAddresses(db, id, addressesInput);
      }

      if (data.phones !== undefined || data.mobile !== undefined) {
        const phonesInput = this.normalizePhonesInput({
          ...data,
          mobile: data.mobile !== undefined ? data.mobile : existing.mobile
        });
        await this.replaceCenterPhones(db, id, phonesInput);
      }

      if (data.customFields !== undefined) {
        const customFieldsInput = this.normalizeCustomFieldsInput(data);
        await this.replaceCenterCustomFields(db, id, customFieldsInput);
      }

      if (data.deliveryContacts !== undefined) {
        const deliveryContactsInput = this.normalizeDeliveryContactsInput(data);
        if (!addressMap) {
          const addresses = await this.fetchAddressesMap([id]);
          addressMap = addresses.get(id) || new Map();
        }
        await this.replaceCenterDeliveryContacts(db, id, deliveryContactsInput, addressMap);
      }

      await db.exec('COMMIT');
      return await this.getById(id);
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  }

  static async delete(id) {
    const db = getDB();
    const center = await this.getById(id);
    if (!center) return false;

    const assignmentsResult = await db.get(
      'SELECT COUNT(*) as count FROM mission_assignments WHERE centerId = ?',
      [id]
    );
    if (assignmentsResult && assignmentsResult.count > 0) {
      throw new Error('نمی‌توان مرکز را حذف کرد زیرا در ماموریت‌ها استفاده شده است');
    }

    await db.run('DELETE FROM centers WHERE id = ?', [id]);
    return true;
  }

  // Helpers -----------------------------------------------------------------

  static serializeTags(tags) {
    if (!tags) return null;
    if (typeof tags === 'string') return tags;
    try {
      return JSON.stringify(tags);
    } catch (error) {
      return null;
    }
  }

  static normalizeAddressesInput(data) {
    const base =
      Array.isArray(data.addresses) && data.addresses.length
        ? data.addresses
        : [];

    const sanitized = base
      .filter((addr) => addr && addr.addressLine)
      .slice(0, MAX_ADDRESSES)
      .map((addr, index) => ({
        title: addr.title || (index === 0 ? 'آدرس اصلی' : `آدرس ${index + 1}`),
        addressLine: addr.addressLine,
        city: addr.city || data.city || null,
        province: addr.province || data.province || null,
        district: addr.district || data.district || null,
        postalCode: addr.postalCode || addr.postal_code || data.postal_code || data.postalCode || null,
        latitude: addr.latitude || null,
        longitude: addr.longitude || null,
        sortOrder: addr.sortOrder !== undefined ? addr.sortOrder : index
      }));

    if (!sanitized.length && data.address) {
      sanitized.push({
        title: 'آدرس اصلی',
        addressLine: data.address,
        city: data.city || null,
        province: data.province || null,
        district: data.district || null,
        postalCode: data.postal_code || data.postalCode || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        sortOrder: 0
      });
    }

    return sanitized.slice(0, MAX_ADDRESSES);
  }

  static normalizePhonesInput(data) {
    const base =
      Array.isArray(data.phones) && data.phones.length ? data.phones : [];

    const sanitized = base
      .filter((phone) => phone && phone.phone)
      .map((phone) => ({
        label: phone.label || null,
        phone: phone.phone,
        extension: phone.extension || null,
        type: phone.type || (phone.isMobile ? 'mobile' : 'landline'),
        isPrimary: phone.isPrimary ? 1 : 0
      }));

    if (!sanitized.length && data.mobile) {
      sanitized.push({
        label: 'موبایل',
        phone: data.mobile,
        type: 'mobile',
        isPrimary: 1
      });
    }

    if (!sanitized.length && data.phone) {
      sanitized.push({
        label: 'تلفن ثابت',
        phone: data.phone,
        type: 'landline',
        isPrimary: 1
      });
    }

    if (sanitized.length && !sanitized.some((item) => item.isPrimary === 1)) {
      sanitized[0].isPrimary = 1;
    }

    return sanitized;
  }

  static normalizeCustomFieldsInput(data) {
    if (!Array.isArray(data.customFields)) return [];
    return data.customFields
      .filter((field) => field && field.fieldKey && field.fieldValue !== undefined)
      .map((field) => ({
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel || null,
        fieldType: field.fieldType || 'text',
        fieldValue: String(field.fieldValue ?? '')
      }));
  }

  static normalizeDeliveryContactsInput(data) {
    if (!Array.isArray(data.deliveryContacts)) return [];
    return data.deliveryContacts
      .filter((contact) => contact && contact.fullName)
      .map((contact, index) => ({
        fullName: contact.fullName,
        position: contact.position || null,
        title: contact.title || null,
        mobile: contact.mobile || null,
        phone: contact.phone || null,
        extension: contact.extension || null,
        nationalId: contact.nationalId || null,
        notes: contact.notes || null,
        addressId: contact.addressId || null,
        addressIndex: contact.addressIndex ?? contact.addressSortOrder ?? null,
        sortOrder: contact.sortOrder ?? index
      }));
  }

  static async attachRelations(rows) {
    if (!rows || !rows.length) return [];
    const db = getDB();
    const ids = rows.map((row) => row.id);
    const placeholders = ids.map(() => '?').join(',');

    const [addressRows, phoneRows, customFieldRows, deliveryRows] = await Promise.all([
      db.all(
        `SELECT * FROM center_addresses WHERE centerId IN (${placeholders}) ORDER BY sortOrder ASC, id ASC`,
        ids
      ),
      db.all(
        `SELECT * FROM center_phones WHERE centerId IN (${placeholders}) ORDER BY isPrimary DESC, id ASC`,
        ids
      ),
      db.all(
        `SELECT * FROM center_custom_fields WHERE centerId IN (${placeholders}) ORDER BY id ASC`,
        ids
      ),
      db.all(
        `SELECT * FROM center_delivery_contacts WHERE centerId IN (${placeholders}) ORDER BY id ASC`,
        ids
      )
    ]);

    const addressesMap = new Map();
    const addressIdMap = new Map();
    addressRows.forEach((row) => {
      const address = {
        id: row.id,
        centerId: row.centerId,
        title: row.title,
        addressLine: row.addressLine,
        city: row.city,
        province: row.province,
        district: row.district,
        postalCode: row.postalCode,
        latitude: row.latitude,
        longitude: row.longitude,
        sortOrder: row.sortOrder ?? 0,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
      if (!addressesMap.has(row.centerId)) {
        addressesMap.set(row.centerId, []);
      }
      addressesMap.get(row.centerId).push(address);
      addressIdMap.set(row.id, address);
    });

    const phonesMap = new Map();
    phoneRows.forEach((row) => {
      const phone = {
        id: row.id,
        centerId: row.centerId,
        label: row.label,
        phone: row.phone,
        extension: row.extension,
        type: row.type,
        isPrimary: row.isPrimary === 1,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
      if (!phonesMap.has(row.centerId)) {
        phonesMap.set(row.centerId, []);
      }
      phonesMap.get(row.centerId).push(phone);
    });

    const customFieldsMap = new Map();
    customFieldRows.forEach((row) => {
      const field = {
        id: row.id,
        centerId: row.centerId,
        fieldKey: row.fieldKey,
        fieldLabel: row.fieldLabel,
        fieldType: row.fieldType,
        fieldValue: row.fieldValue,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      };
      if (!customFieldsMap.has(row.centerId)) {
        customFieldsMap.set(row.centerId, []);
      }
      customFieldsMap.get(row.centerId).push(field);
    });

    const deliveryMap = new Map();
    deliveryRows.forEach((row) => {
      const contact = {
        id: row.id,
        centerId: row.centerId,
        fullName: row.fullName,
        position: row.position || null,
        title: row.title || null,
        mobile: row.mobile,
        phone: row.phone,
        extension: row.extension,
        nationalId: row.nationalId,
        addressId: row.addressId,
        notes: row.notes,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        address: row.addressId ? addressIdMap.get(row.addressId) || null : null
      };
      if (!deliveryMap.has(row.centerId)) {
        deliveryMap.set(row.centerId, []);
      }
      deliveryMap.get(row.centerId).push(contact);
    });

    return rows.map((row) => ({
      ...row,
      _addresses: addressesMap.get(row.id) || [],
      _phones: phonesMap.get(row.id) || [],
      _customFields: customFieldsMap.get(row.id) || [],
      _deliveryContacts: deliveryMap.get(row.id) || []
    }));
  }

  static async replaceCenterAddresses(db, centerId, addresses = []) {
    await db.run('DELETE FROM center_addresses WHERE centerId = ?', [centerId]);
    const addressIdMap = new Map();

    for (const address of addresses) {
      const result = await db.run(
        `
        INSERT INTO center_addresses (
          centerId, title, addressLine, city, province, district,
          postalCode, latitude, longitude, sortOrder, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `,
        [
          centerId,
          address.title || null,
          address.addressLine,
          address.city || null,
          address.province || null,
          address.district || null,
          address.postalCode || null,
          address.latitude || null,
          address.longitude || null,
          address.sortOrder ?? 0
        ]
      );
      addressIdMap.set(address.sortOrder ?? 0, result.lastID);
    }

    return addressIdMap;
  }

  static async replaceCenterPhones(db, centerId, phones = []) {
    await db.run('DELETE FROM center_phones WHERE centerId = ?', [centerId]);

    for (const phone of phones) {
      await db.run(
        `
        INSERT INTO center_phones (
          centerId, label, phone, extension, type, isPrimary, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `,
        [
          centerId,
          phone.label || null,
          phone.phone,
          phone.extension || null,
          phone.type || null,
          phone.isPrimary ? 1 : 0
        ]
      );
    }
  }

  static async replaceCenterCustomFields(db, centerId, customFields = []) {
    await db.run('DELETE FROM center_custom_fields WHERE centerId = ?', [centerId]);

    for (const field of customFields) {
      await db.run(
        `
        INSERT INTO center_custom_fields (
          centerId, fieldKey, fieldLabel, fieldType, fieldValue, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `,
        [
          centerId,
          field.fieldKey,
          field.fieldLabel || null,
          field.fieldType || 'text',
          field.fieldValue
        ]
      );
    }
  }

  static async replaceCenterDeliveryContacts(db, centerId, contacts = [], addressMap = new Map()) {
    await db.run('DELETE FROM center_delivery_contacts WHERE centerId = ?', [centerId]);

    for (const contact of contacts) {
      let addressId = contact.addressId || null;
      if (!addressId && contact.addressIndex !== null && contact.addressIndex !== undefined) {
        addressId = addressMap.get(contact.addressIndex) || null;
      }

      // Check if position and title columns exist, if not, add them
      try {
        await db.run('ALTER TABLE center_delivery_contacts ADD COLUMN position TEXT');
      } catch (e) {
        // Column might already exist, ignore
      }
      try {
        await db.run('ALTER TABLE center_delivery_contacts ADD COLUMN title TEXT');
      } catch (e) {
        // Column might already exist, ignore
      }

      await db.run(
        `
        INSERT INTO center_delivery_contacts (
          centerId, fullName, position, title, mobile, phone, extension, nationalId, addressId, notes, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `,
        [
          centerId,
          contact.fullName,
          contact.position || null,
          contact.title || null,
          contact.mobile || null,
          contact.phone || null,
          contact.extension || null,
          contact.nationalId || null,
          addressId,
          contact.notes || null
        ]
      );
    }
  }

  static async fetchAddressesMap(centerIds) {
    const db = getDB();
    const map = new Map();
    if (!centerIds.length) return map;
    const placeholders = centerIds.map(() => '?').join(',');
    const rows = await db.all(
      `SELECT * FROM center_addresses WHERE centerId IN (${placeholders}) ORDER BY sortOrder ASC, id ASC`,
      centerIds
    );

    rows.forEach((row) => {
      if (!map.has(row.centerId)) {
        map.set(row.centerId, new Map());
      }
      const centerMap = map.get(row.centerId);
      centerMap.set(row.sortOrder ?? 0, row.id);
    });

    return map;
  }

  static formatRow(row) {
    if (!row) return null;
    const obj = { ...row };

    const addresses = obj._addresses || [];
    const phones = obj._phones || [];
    const customFields = obj._customFields || [];
    const deliveryContacts = obj._deliveryContacts || [];

    delete obj._addresses;
    delete obj._phones;
    delete obj._customFields;
    delete obj._deliveryContacts;

    if (obj.isActive !== undefined) {
      obj.isActive = obj.isActive === 1;
    }

    if (obj.tags && typeof obj.tags === 'string') {
      try {
        obj.tags = JSON.parse(obj.tags);
      } catch (error) {
        obj.tags = [];
      }
    }

    obj.customerType = obj.customerType || 'individual';
    obj.postalCode = obj.postal_code ?? obj.postalCode ?? null;

    const primaryAddress = addresses[0] || (obj.address
      ? {
          title: 'آدرس ثبت شده',
          addressLine: obj.address,
          city: obj.city,
          province: obj.province,
          postalCode: obj.postal_code || null
        }
      : null);

    const primaryPhone = phones.find((phone) => phone.isPrimary) || phones[0] || null;

    return {
      ...obj,
      address: primaryAddress?.addressLine || obj.address || null,
      addresses,
      phones,
      customFields,
      deliveryContacts,
      primaryAddress,
      primaryPhone,
      source: obj.sourceId
        ? {
            id: obj.sourceId,
            name: obj.sourceName || null
          }
        : null,
      _id: obj.id?.toString()
    };
  }
}
