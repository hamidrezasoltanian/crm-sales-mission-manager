import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const HR_BASE_URL = process.env.HR_API_BASE_URL || 'http://localhost:8002';
const MEDICAL_BASE_URL = process.env.MEDICAL_API_BASE_URL || 'http://localhost:8003';

export class HrApi {
  static axiosInstance = null;

  static async getAxios() {
    if (!HrApi.axiosInstance) {
      HrApi.axiosInstance = (await import('axios')).default;
    }
    return HrApi.axiosInstance;
  }

  static sanitizePayload(payload = {}) {
    const sanitized = {};
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        sanitized[key] = value;
      }
    });
    return sanitized;
  }

  static async checkHrBackendHealth() {
    try {
      const axios = await HrApi.getAxios();
      // Try multiple endpoints to check if HR backend is accessible
      try {
        await axios.get(`${HR_BASE_URL}/docs`, { timeout: 5000 });
      } catch (docsError) {
        // If /docs fails, try /api/employees
        try {
          await axios.get(`${HR_BASE_URL}/api/employees`, { timeout: 5000, params: { limit: 1 } });
        } catch (apiError) {
          throw docsError; // Throw original error
        }
      }
      console.log(`[HrApi] HR backend health check passed`);
      return true;
    } catch (error) {
      console.error(`[HrApi] HR backend health check failed:`, {
        message: error.message,
        code: error?.code,
        url: `${HR_BASE_URL}`
      });
      return false;
    }
  }

  static async ensureEmployee({ telegramId, firstName, lastName, username, phone, hourlyRate, totalLeaveDays }) {
    if (!telegramId) {
      throw new Error('telegramId is required to sync HR employee');
    }
    const axios = await HrApi.getAxios();
    const payload = HrApi.sanitizePayload({
      telegram_id: Number(telegramId),
      first_name: firstName || 'کاربر',
      last_name: lastName || '',
      username,
      phone,
      hourly_rate: hourlyRate,
      total_leave_days: totalLeaveDays
    });
    
    console.log(`[HrApi] Calling ensureEmployee:`, {
      url: `${HR_BASE_URL}/api/employees/ensure`,
      payload
    });
    
    try {
      const { data } = await axios.post(`${HR_BASE_URL}/api/employees/ensure`, payload, {
        timeout: 10000 // 10 seconds timeout
      });
      console.log(`[HrApi] ensureEmployee success:`, { id: data?.id, telegram_id: data?.telegram_id });
      return data;
    } catch (error) {
      const errorDetails = {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        message: error?.message,
        code: error?.code,
        url: `${HR_BASE_URL}/api/employees/ensure`
      };
      
      console.error(`[HrApi] ensureEmployee error:`, errorDetails);
      
      // اگر connection error است، پیام واضح‌تری بده
      if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT' || error?.message?.includes('connect')) {
        throw new Error(`HR backend در دسترس نیست. لطفاً مطمئن شوید که سرویس HR در حال اجرا است (${HR_BASE_URL})`);
      }
      
      throw error;
    }
  }

  static async getEmployeeByTelegram(telegramId) {
    if (!telegramId) {
      return null;
    }
    const axios = await HrApi.getAxios();
    try {
      const { data } = await axios.get(`${HR_BASE_URL}/api/employees/by-telegram/${telegramId}`);
      return data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return null;
      }
      throw error;
    }
  }

  static async listLeaveRequests({ employeeId, status, limit = 5 }) {
    const axios = await HrApi.getAxios();
    const params = HrApi.sanitizePayload({
      employee_id: employeeId,
      status,
      limit
    });
    const { data } = await axios.get(`${HR_BASE_URL}/api/leave-requests`, { params });
    return data;
  }

  static async createLeaveRequest(payload) {
    const axios = await HrApi.getAxios();
    const body = HrApi.sanitizePayload(payload);
    const { data } = await axios.post(`${HR_BASE_URL}/api/leave-requests`, body);
    return data;
  }

  static async managerApproveLeave({ leaveId, action, telegramId }) {
    const axios = await HrApi.getAxios();
    const body = HrApi.sanitizePayload({
      manager_telegram_id: Number(telegramId),
      action
    });
    
    console.log(`[HrApi] Calling manager approval:`, {
      url: `${HR_BASE_URL}/api/leave-requests/${leaveId}/manager-approval`,
      body,
      leaveId,
      action,
      telegramId
    });
    
    try {
      const { data } = await axios.post(
        `${HR_BASE_URL}/api/leave-requests/${leaveId}/manager-approval`,
        body
      );
      return data;
    } catch (error) {
      console.error(`[HrApi] Manager approval error:`, {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        message: error?.message,
        url: `${HR_BASE_URL}/api/leave-requests/${leaveId}/manager-approval`
      });
      throw error;
    }
  }

  static async cancelLeaveRequest({ leaveId, employeeId }) {
    if (!leaveId) {
      throw new Error('leaveId is required');
    }
    const axios = await HrApi.getAxios();
    const params = HrApi.sanitizePayload({ employee_id: employeeId });
    const { data } = await axios.delete(`${HR_BASE_URL}/api/leave-requests/${leaveId}`, {
      params
    });
    return data;
  }

  static async listAttendances({ employeeId, limit = 7, startDate, endDate }) {
    const axios = await HrApi.getAxios();
    const params = HrApi.sanitizePayload({
      employee_id: employeeId,
      limit,
      start_date: startDate,
      end_date: endDate
    });
    const { data } = await axios.get(`${HR_BASE_URL}/api/attendances`, { params });
    return data;
  }

  static async createAttendance(payload) {
    const axios = await HrApi.getAxios();
    const body = HrApi.sanitizePayload(payload);
    const { data } = await axios.post(`${HR_BASE_URL}/api/attendances`, body);
    return data;
  }

  static async updateAttendance(attendanceId, payload) {
    const axios = await HrApi.getAxios();
    const body = HrApi.sanitizePayload(payload);
    const { data } = await axios.put(`${HR_BASE_URL}/api/attendances/${attendanceId}`, body);
    return data;
  }

  static async listSalaries({ employeeId, month, year, limit = 6 }) {
    const axios = await HrApi.getAxios();
    const params = HrApi.sanitizePayload({
      employee_id: employeeId,
      month,
      year,
      limit
    });
    const { data } = await axios.get(`${HR_BASE_URL}/api/salaries`, { params });
    return data;
  }

  static async listMedicalFiles({ search, category, brand, product, centerId, limit = 5, skip = 0 }) {
    const axios = await HrApi.getAxios();
    const params = HrApi.sanitizePayload({
      search,
      category,
      brand,
      product,
      center_id: centerId,
      limit,
      skip
    });
    try {
      const { data } = await axios.get(`${MEDICAL_BASE_URL}/api/medical-files`, { params });
      return data;
    } catch (error) {
      console.error('[HrApi] Error listing medical files:', error.message);
      throw error;
    }
  }

  static async listMedicalCategories() {
    const axios = await HrApi.getAxios();
    const { data } = await axios.get(`${MEDICAL_BASE_URL}/api/categories`);
    return data;
  }

  static async downloadMedicalFile(fileId) {
    const axios = await HrApi.getAxios();
    const response = await axios.get(`${MEDICAL_BASE_URL}/api/medical-files/${fileId}/download`, {
      responseType: 'arraybuffer'
    });
    return response;
  }

  static async deleteMedicalFile(fileId) {
    const axios = await HrApi.getAxios();
    try {
      const { data } = await axios.delete(`${MEDICAL_BASE_URL}/api/medical-files/${fileId}`);
      return data;
    } catch (error) {
      console.error('[HrApi] Error deleting medical file:', error.message);
      throw error;
    }
  }

  static async uploadMedicalFile({
    fileBuffer,
    filename,
    mimeType,
    brand,
    product,
    centerId,
    doctorName,
    doctorSpecialty,
    province,
    category,
    description,
    uploadedBy
  }) {
    if (!fileBuffer || !filename) {
      throw new Error('File buffer and filename are required for medical upload');
    }

    const axios = await HrApi.getAxios();
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename,
      contentType: mimeType || 'application/octet-stream'
    });

    const fields = HrApi.sanitizePayload({
      brand,
      product,
      center_id: centerId,
      doctor_name: doctorName,
      doctor_specialty: doctorSpecialty,
      province,
      category,
      description,
      uploaded_by: uploadedBy
    });

    Object.entries(fields).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, value);
      }
    });

    const headers = formData.getHeaders();
    const { data } = await axios.post(`${MEDICAL_BASE_URL}/api/medical-files/upload`, formData, {
      headers
    });
    return data;
  }
}


