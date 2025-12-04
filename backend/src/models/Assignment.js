import { getDB } from '../config/database.js';
import { Personnel } from './Personnel.js';
import { Center } from './Center.js';
import { DiscountCode } from './DiscountCode.js';
import snapService from '../services/snapService.js';
import workflowBoardService from '../services/workflowBoardService.js';

export class Assignment {
  static async getAll(filters = {}) {
    const db = getDB();
    let query = `
      SELECT a.*,
             (p.first_name || ' ' || p.last_name) as personnelName, p.phone as personnelPhone,
             c.name as centerName, c.address as centerAddress,
             c.responsiblePersonnelId as centerResponsiblePersonnelId,
             (rp.first_name || ' ' || rp.last_name) as centerResponsiblePersonnelName,
             (m.first_name || ' ' || m.last_name) as managerName
      FROM mission_assignments a
      LEFT JOIN personnel p ON a.personnelId = p.id
      LEFT JOIN centers c ON a.centerId = c.id
      LEFT JOIN personnel rp ON c.responsiblePersonnelId = rp.id
      LEFT JOIN personnel m ON a.managerId = m.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.personnelId) {
      query += ' AND a.personnelId = ?';
      params.push(filters.personnelId);
    }
    if (filters.centerId) {
      query += ' AND a.centerId = ?';
      params.push(filters.centerId);
    }
    if (filters.status) {
      query += ' AND a.status = ?';
      params.push(filters.status);
    }
    if (filters.managerId) {
      query += ' AND a.managerId = ?';
      params.push(filters.managerId);
    }
    // فیلتر بر اساس مسئول مرکز - فقط مراکزی که کارمند مسئول آن است
    if (filters.onlyResponsibleCenters && filters.personnelId) {
      query += ' AND c.responsiblePersonnelId = ?';
      params.push(filters.personnelId);
    }
    
    query += ' ORDER BY a.createdAt DESC';
    
    // Pagination support
    if (filters.limit !== undefined) {
      query += ` LIMIT ${parseInt(filters.limit)}`;
    }
    if (filters.offset !== undefined) {
      query += ` OFFSET ${parseInt(filters.offset)}`;
    }
    
    const result = await db.all(query, params);
    
    return result.map(row => this.formatRow(row));
  }

  // تابع برای شمارش کل تعداد assignments با فیلترها
  static async count(filters = {}) {
    const db = getDB();
    let query = `
      SELECT COUNT(*) as total
      FROM mission_assignments a
      LEFT JOIN centers c ON a.centerId = c.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.personnelId) {
      query += ' AND a.personnelId = ?';
      params.push(filters.personnelId);
    }
    if (filters.centerId) {
      query += ' AND a.centerId = ?';
      params.push(filters.centerId);
    }
    if (filters.status) {
      query += ' AND a.status = ?';
      params.push(filters.status);
    }
    if (filters.managerId) {
      query += ' AND a.managerId = ?';
      params.push(filters.managerId);
    }
    if (filters.onlyResponsibleCenters && filters.personnelId) {
      query += ' AND c.responsiblePersonnelId = ?';
      params.push(filters.personnelId);
    }
    
    const result = await db.get(query, params);
    
    return result ? result.total : 0;
  }

  static async getById(id) {
    const db = getDB();
    const result = await db.get(`
      SELECT a.*,
             (p.first_name || ' ' || p.last_name) as personnelName, p.phone as personnelPhone,
             c.name as centerName, c.address as centerAddress,
             c.responsiblePersonnelId as centerResponsiblePersonnelId,
             (rp.first_name || ' ' || rp.last_name) as centerResponsiblePersonnelName,
             (m.first_name || ' ' || m.last_name) as managerName
      FROM mission_assignments a
      LEFT JOIN personnel p ON a.personnelId = p.id
      LEFT JOIN centers c ON a.centerId = c.id
      LEFT JOIN personnel rp ON c.responsiblePersonnelId = rp.id
      LEFT JOIN personnel m ON a.managerId = m.id
      WHERE a.id = ?
    `, [id]);
    
    if (!result) {
      return null;
    }
    
    return this.formatRow(result);
  }

  static async create(data) {
    const db = getDB();
    let { personnelId, centerId, snapLocationLatitude, snapLocationLongitude, 
            snapLocationAddress, snapCost, discountCode, discountCodeId, notes, centerNotes, personalPayment } = data;
    
    // بررسی وجود پرسنل و مرکز
    const personnel = await Personnel.getById(personnelId);
    if (!personnel) {
      throw new Error('پرسنل یافت نشد');
    }
    
    const center = await Center.getById(centerId);
    if (!center) {
      throw new Error('مرکز یافت نشد');
    }
    
    // اگر لوکیشن اسنپ داده نشده، از API اسنپ بگیریم
    let finalSnapCost = snapCost;
    if ((!snapLocationLatitude || !snapLocationLongitude) && center.latitude && center.longitude) {
      // می‌توانیم لوکیشن مرکز را به عنوان مبدا استفاده کنیم
      // و از کاربر مقصد را بگیریم یا از مرکز استفاده کنیم
      try {
        const snapInfo = await snapService.getLocationInfo(
          snapLocationLatitude || center.latitude,
          snapLocationLongitude || center.longitude
        );
        
        snapLocationLatitude = snapLocationLatitude || snapInfo.latitude;
        snapLocationLongitude = snapLocationLongitude || snapInfo.longitude;
        snapLocationAddress = snapLocationAddress || snapInfo.address;
        
        // اگر هزینه داده نشده، از اسنپ محاسبه کنیم
        if (!finalSnapCost && center.latitude && center.longitude) {
          const costInfo = await snapService.calculateCost(
            snapLocationLatitude,
            snapLocationLongitude,
            center.latitude,
            center.longitude
          );
          finalSnapCost = costInfo.cost;
        }
      } catch (error) {
        console.error('Error getting snap info:', error);
        // در صورت خطا، ادامه می‌دهیم با مقادیر قبلی
      }
    } else if (!finalSnapCost && snapLocationLatitude && snapLocationLongitude && center.latitude && center.longitude) {
      // محاسبه هزینه از اسنپ
      try {
        const costInfo = await snapService.calculateCost(
          snapLocationLatitude,
          snapLocationLongitude,
          center.latitude,
          center.longitude
        );
        finalSnapCost = costInfo.cost;
      } catch (error) {
        console.error('Error calculating snap cost:', error);
      }
    }
    
    // محاسبه هزینه و تخفیف
    // snapCost = کل هزینه اسنپ (بدون تخفیف)
    // discountAmount = سهم شرکت (با سقف کد تخفیف)
    // personalPayment = باقی‌مانده بعد از تخفیف
    // totalCost = کل هزینه اسنپ
    
    let finalDiscountCodeId = discountCodeId || null;
    const snapCostTotal = Number(finalSnapCost) || 0;
    let discountDetails = null;
    
    if (discountCode) {
      const discount = await DiscountCode.getByCode(discountCode);
      if (discount && discount.isActive) {
        finalDiscountCodeId = discount.id;
        discountDetails = discount;
      }
    } else if (discountCodeId) {
      // اگر discountCodeId مستقیماً داده شده
      const discount = await DiscountCode.getById(discountCodeId);
      if (discount && discount.isActive) {
        discountDetails = discount;
      } else {
        finalDiscountCodeId = null;
      }
    }
    
    const { companyShare, personalPayment: defaultPersonalPayment } = Assignment.calculateCostBreakdown(snapCostTotal, discountDetails);
    const discountAmount = companyShare;
    
    // محاسبه هزینه شخصی (باقی‌مانده بعد از تخفیف)
    let calculatedPersonalPayment = personalPayment;
    if (calculatedPersonalPayment === undefined || calculatedPersonalPayment === null) {
      calculatedPersonalPayment = defaultPersonalPayment;
    }
    
    // totalCost = کل هزینه اسنپ
    const totalCost = snapCostTotal;
    
    const now = new Date().toISOString();
    
    const result = await db.run(`
      INSERT INTO mission_assignments (
        personnelId, centerId, status, snapLocationLatitude, snapLocationLongitude,
        snapLocationAddress, snapCost, discountCode, discountCodeId, discountAmount, totalCost,
        personalPayment, notes, centerNotes, createdAt, updatedAt
      )
      VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      personnelId, centerId, snapLocationLatitude || null, snapLocationLongitude || null,
      snapLocationAddress || null, snapCostTotal, discountCode || null, finalDiscountCodeId,
      discountAmount, totalCost, calculatedPersonalPayment, notes || null, centerNotes || null, now, now
    ]);
    
    // افزایش استفاده از کد تخفیف
    if (finalDiscountCodeId) {
      await db.run('UPDATE mission_discount_codes SET currentUses = currentUses + 1 WHERE id = ?', [finalDiscountCodeId]);
    }
    
    const createdAssignment = await this.getById(result.lastID);
    await workflowBoardService.handleAssignmentCreated(createdAssignment);
    return createdAssignment;
  }

  static async approve(assignmentId, managerId, personalPayment = 0, managerComment = null) {
    const db = getDB();
    console.log(`[Assignment.approve] Starting approval for assignment #${assignmentId} by manager ${managerId}`);
    
    const assignment = await this.getById(assignmentId);
    
    if (!assignment) {
      console.error(`[Assignment.approve] Assignment #${assignmentId} not found`);
      throw new Error('ماموریت یافت نشد');
    }
    
    console.log(`[Assignment.approve] Found assignment #${assignmentId}, status: ${assignment.status}`);
    
    if (assignment.status !== 'pending') {
      console.error(`[Assignment.approve] Assignment #${assignmentId} is not pending, status: ${assignment.status}`);
      throw new Error('فقط ماموریت‌های در انتظار قابل تایید هستند');
    }
    
    // بررسی اینکه مدیر واقعاً مدیر است
    const manager = await Personnel.getById(managerId);
    if (!manager || (manager.role !== 'admin' && manager.role !== 'manager')) {
      console.error(`[Assignment.approve] Manager ${managerId} is not a manager, role: ${manager?.role}`);
      throw new Error('فقط مدیران می‌توانند ماموریت را تایید کنند');
    }
    
    // محاسبه personalPayment اگر داده نشده
    let calculatedPersonalPayment = personalPayment;
    if (calculatedPersonalPayment === undefined || calculatedPersonalPayment === null) {
      // محاسبه بر اساس snapCost و discountAmount
      const discountAmount = assignment.discountAmount || 0;
      calculatedPersonalPayment = Math.max(0, assignment.snapCost - discountAmount);
    }
    
    console.log(`[Assignment.approve] Calculated personalPayment: ${calculatedPersonalPayment}, snapCost: ${assignment.snapCost}, discountAmount: ${assignment.discountAmount || 0}`);
    
    const now = new Date().toISOString();
    
    // totalCost همیشه برابر snapCost است
    try {
      await db.run(`
        UPDATE mission_assignments 
        SET status = 'approved', managerId = ?, approvedAt = ?, personalPayment = ?, totalCost = ?, managerComment = ?, updatedAt = ?
        WHERE id = ?
      `, [managerId, now, calculatedPersonalPayment, assignment.snapCost, managerComment || null, now, assignmentId]);
      
      console.log(`[Assignment.approve] UPDATE query executed successfully for assignment #${assignmentId}`);
      
      // دریافت مجدد assignment بعد از update
      const updatedAssignment = await this.getById(assignmentId);
      
      if (!updatedAssignment) {
        console.error(`[Assignment.approve] Failed to retrieve assignment #${assignmentId} after update`);
        throw new Error('خطا در دریافت ماموریت تایید شده');
      }
      
      console.log(`[Assignment.approve] Successfully approved assignment #${assignmentId}, new status: ${updatedAssignment.status}`);
      await workflowBoardService.handleAssignmentStatusChange(updatedAssignment);
      return updatedAssignment;
    } catch (error) {
      console.error(`[Assignment.approve] Error updating assignment #${assignmentId}:`, error);
      throw error;
    }
  }

  static async reject(assignmentId, managerId, managerComment = null) {
    const db = getDB();
    console.log(`[Assignment.reject] Starting rejection for assignment #${assignmentId} by manager ${managerId}`);
    
    const assignment = await this.getById(assignmentId);
    
    if (!assignment) {
      console.error(`[Assignment.reject] Assignment #${assignmentId} not found`);
      throw new Error('ماموریت یافت نشد');
    }
    
    if (assignment.status !== 'pending') {
      console.error(`[Assignment.reject] Assignment #${assignmentId} is not pending, status: ${assignment.status}`);
      throw new Error('فقط ماموریت‌های در انتظار قابل رد هستند');
    }
    
    // بررسی اینکه مدیر واقعاً مدیر است
    const manager = await Personnel.getById(managerId);
    if (!manager || (manager.role !== 'admin' && manager.role !== 'manager')) {
      console.error(`[Assignment.reject] Manager ${managerId} is not a manager, role: ${manager?.role}`);
      throw new Error('فقط مدیران می‌توانند ماموریت را رد کنند');
    }
    
    const now = new Date().toISOString();
    
    try {
      await db.run(`
        UPDATE mission_assignments 
        SET status = 'rejected', managerId = ?, managerComment = ?, updatedAt = ?
        WHERE id = ?
      `, [managerId, managerComment || null, now, assignmentId]);
      
      console.log(`[Assignment.reject] UPDATE query executed successfully for assignment #${assignmentId}`);
      const updatedAssignment = await this.getById(assignmentId);
      await workflowBoardService.handleAssignmentStatusChange(updatedAssignment);
      return updatedAssignment;
    } catch (error) {
      console.error(`[Assignment.reject] Error updating assignment #${assignmentId}:`, error);
      throw error;
    }
  }

  static async updateStatus(assignmentId, status, userId) {
    const db = getDB();
    const assignment = await this.getById(assignmentId);
    
    if (!assignment) {
      throw new Error('ماموریت یافت نشد');
    }
    
    const now = new Date().toISOString();
    let updateQuery = 'UPDATE mission_assignments SET status = ?, updatedAt = ?';
    const params = [status, now];
    
    if (status === 'completed') {
      updateQuery += ', completedAt = ?';
      params.push(now);
    }
    
    params.push(assignmentId);
    updateQuery += ' WHERE id = ?';
    
    await db.run(updateQuery, params);
    
    const updatedAssignment = await this.getById(assignmentId);
    await workflowBoardService.handleAssignmentStatusChange(updatedAssignment);
    return updatedAssignment;
  }

  static async update(id, data) {
    const db = getDB();
    const existing = await this.getById(id);
    if (!existing) return null;
    
    const { snapLocationLatitude, snapLocationLongitude, snapLocationAddress, 
            snapCost, discountCode, discountCodeId, personalPayment, notes, centerNotes, 
            managerComment, status, managerId, approvedAt, createdAt } = data;
    const now = new Date().toISOString();
    
    // محاسبه مجدد هزینه در صورت تغییر
    // snapCost = کل هزینه اسنپ (بدون تخفیف)
    // discountAmount = سهم شرکت (با سقف کد تخفیف)
    // personalPayment = باقی‌مانده بعد از تخفیف
    // totalCost = کل هزینه اسنپ
    
    let snapCostValue = snapCost !== undefined ? snapCost : existing.snapCost;
    snapCostValue = Number(snapCostValue) || 0;
    let discountAmount = existing.discountAmount || 0;
    let discountCodeValue = discountCode !== undefined ? discountCode : existing.discountCode;
    let finalDiscountCodeId = discountCodeId !== undefined ? discountCodeId : existing.discountCodeId;
    let discountDetails = null;
    
    if (discountCodeValue) {
      const discount = await DiscountCode.getByCode(discountCodeValue);
      if (discount && discount.isActive) {
        finalDiscountCodeId = discount.id;
        discountDetails = discount;
      } else if (finalDiscountCodeId === undefined) {
        finalDiscountCodeId = null;
      }
    } else if (finalDiscountCodeId) {
      const discount = await DiscountCode.getById(finalDiscountCodeId);
      if (discount && discount.isActive) {
        discountDetails = discount;
      } else {
        finalDiscountCodeId = null;
      }
    }
    
    const { companyShare, personalPayment: computedPersonalPayment } = Assignment.calculateCostBreakdown(snapCostValue, discountDetails);
    if (snapCost !== undefined || discountCode !== undefined || discountCodeId !== undefined) {
      discountAmount = companyShare;
    }
    
    // محاسبه personalPayment و totalCost
    let personalPaymentValue = personalPayment !== undefined ? personalPayment : existing.personalPayment;
    if (personalPayment === undefined && (snapCost !== undefined || discountCode !== undefined || discountCodeId !== undefined)) {
      personalPaymentValue = computedPersonalPayment;
    }
    
    // totalCost = کل هزینه اسنپ
    const totalCost = snapCostValue;
    
    const updates = [];
    const values = [];
    
    if (snapLocationLatitude !== undefined) {
      updates.push('snapLocationLatitude = ?');
      values.push(snapLocationLatitude);
    }
    if (snapLocationLongitude !== undefined) {
      updates.push('snapLocationLongitude = ?');
      values.push(snapLocationLongitude);
    }
    if (snapLocationAddress !== undefined) {
      updates.push('snapLocationAddress = ?');
      values.push(snapLocationAddress);
    }
    if (snapCost !== undefined) {
      updates.push('snapCost = ?');
      values.push(snapCostValue);
    }
    if (discountCode !== undefined) {
      updates.push('discountCode = ?');
      values.push(discountCodeValue);
    }
    if (discountCodeId !== undefined) {
      updates.push('discountCodeId = ?');
      values.push(finalDiscountCodeId);
    }
    // اگر snapCost یا discountCode/discountCodeId تغییر کرده، discountAmount را به‌روزرسانی کن
    if (snapCost !== undefined || discountCode !== undefined || discountCodeId !== undefined) {
      updates.push('discountAmount = ?');
      values.push(discountAmount);
    }
    // محاسبه و به‌روزرسانی personalPayment و totalCost
    if (personalPayment !== undefined) {
      // اگر personalPayment مستقیماً داده شده
      updates.push('personalPayment = ?');
      values.push(personalPayment);
      // totalCost همیشه برابر snapCost است
      updates.push('totalCost = ?');
      values.push(snapCostValue);
    } else if (snapCost !== undefined || discountCode !== undefined || discountCodeId !== undefined) {
      // اگر snapCost یا discountCode تغییر کرده، personalPayment را محاسبه می‌کنیم
      updates.push('personalPayment = ?');
      values.push(personalPaymentValue);
      // totalCost همیشه برابر snapCost است
      updates.push('totalCost = ?');
      values.push(totalCost);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }
    if (centerNotes !== undefined) {
      updates.push('centerNotes = ?');
      values.push(centerNotes);
    }
    if (managerComment !== undefined) {
      updates.push('managerComment = ?');
      values.push(managerComment);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (managerId !== undefined) {
      updates.push('managerId = ?');
      values.push(managerId);
    }
    if (approvedAt !== undefined) {
      updates.push('approvedAt = ?');
      values.push(approvedAt);
    }
    if (createdAt !== undefined) {
      // اگر تاریخ به صورت ISO string یا Date object است، تبدیل به ISO string
      let createdAtValue = createdAt;
      if (createdAt instanceof Date) {
        createdAtValue = createdAt.toISOString();
      } else if (typeof createdAt === 'string') {
        // اگر تاریخ معتبر است، استفاده کن
        const dateObj = new Date(createdAt);
        if (!isNaN(dateObj.getTime())) {
          createdAtValue = dateObj.toISOString();
        }
      }
      updates.push('createdAt = ?');
      values.push(createdAtValue);
    }
    
    updates.push('updatedAt = ?');
    values.push(now);
    values.push(id);
    
    await db.run(`
      UPDATE mission_assignments 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);
    
    const updatedAssignment = await this.getById(id);
    await workflowBoardService.handleAssignmentStatusChange(updatedAssignment);
    return updatedAssignment;
  }

  static async delete(id) {
    const db = getDB();
    const assignment = await this.getById(id);
    
    if (!assignment) return false;
    
    await db.run('DELETE FROM mission_assignments WHERE id = ?', [id]);
    await workflowBoardService.handleAssignmentDeleted(id);
    
    return true;
  }

  static calculateCostBreakdown(snapCostValue, discount) {
    const snapCost = Math.max(0, Number(snapCostValue) || 0);
    let companyShare = 0;
    
    if (discount) {
      const type = (discount.discountType || '').toLowerCase();
      const value = Number(discount.discountValue) || 0;
      
      if (type === 'percentage' && value > 0) {
        companyShare = Math.min(snapCost, (snapCost * value) / 100);
      } else if (type === 'personal' || value <= 0) {
        companyShare = 0;
      } else {
        companyShare = Math.min(snapCost, value);
      }
    }
    
    const personalPayment = Math.max(0, snapCost - companyShare);
    
    return {
      companyShare,
      personalPayment
    };
  }

  static formatRow(row) {
    if (!row) return null;
    
    return {
      ...row,
      _id: row.id.toString()
    };
  }
}
