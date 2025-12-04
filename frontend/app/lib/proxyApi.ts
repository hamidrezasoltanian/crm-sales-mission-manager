/**
 * Proxy API - Access to external backend services through main backend proxy
 */

import apiInstance from './api';

// Sales Analysis Dashboard API
export const salesAnalysisApi = {
  // Get dashboard data (maps to /api/reports/dashboard)
  getDashboard: (filters = {}) => {
    return apiInstance.get('/proxy/sales-analysis/reports/dashboard', { params: filters });
  },
  
  // Get reports (maps to /api/reports/product-sales)
  getReports: (filters = {}) => {
    return apiInstance.get('/proxy/sales-analysis/reports/product-sales', { params: filters });
  },
  
  // Get employee comparison (maps to /api/reports/employee-comparison)
  getEmployeeComparison: (filters = {}) => {
    return apiInstance.get('/proxy/sales-analysis/reports/employee-comparison', { params: filters });
  },
  
  // Get leaderboard (maps to /api/reports/leaderboard)
  getLeaderboard: (filters = {}) => {
    return apiInstance.get('/proxy/sales-analysis/reports/leaderboard', { params: filters });
  },
  
  // Get performance trends (maps to /api/reports/performance-trends)
  getPerformanceTrends: (filters = {}) => {
    return apiInstance.get('/proxy/sales-analysis/reports/performance-trends', { params: filters });
  },
};

// EZ Dashboard API
export const ezDashboardApi = {
  // Get orders
  getOrders: (filters = {}) => {
    return apiInstance.get('/proxy/ez-dashboard/orders', { params: filters });
  },
  
  // Get products
  getProducts: (filters = {}) => {
    return apiInstance.get('/proxy/ez-dashboard/products', { params: filters });
  },
  
  // Get workflows
  getWorkflow: () => {
    return apiInstance.get('/proxy/ez-dashboard/workflows');
  },
  
  // Create order
  createOrder: (data: any) => {
    return apiInstance.post('/proxy/ez-dashboard/orders', data);
  },
  
  // Update order
  updateOrder: (id: string, data: any) => {
    return apiInstance.put(`/proxy/ez-dashboard/orders/${id}`, data);
  },
};

// Leave Management API
export const leaveManagementApi = {
  // Get leave requests
  getLeaveRequests: (filters = {}) => {
    return apiInstance.get('/proxy/leave-management/leave-requests', { params: filters });
  },
  
  // Create leave request
  createLeaveRequest: (data: any) => {
    return apiInstance.post('/proxy/leave-management/leave-requests', data);
  },
  
  // Update leave request
  updateLeaveRequest: (id: string, data: any) => {
    return apiInstance.put(`/proxy/leave-management/leave-requests/${id}`, data);
  },
  
  // Approve leave request
  approveLeaveRequest: (id: string, data: any) => {
    return apiInstance.post(`/proxy/leave-management/leave-requests/${id}/manager-approval`, data);
  },
  
  // Get attendances
  getAttendances: (filters = {}) => {
    return apiInstance.get('/proxy/leave-management/attendances', { params: filters });
  },
  
  // Create attendance
  createAttendance: (data: any) => {
    return apiInstance.post('/proxy/leave-management/attendances', data);
  },
  
  // Get employees
  getEmployees: () => {
    return apiInstance.get('/proxy/leave-management/employees');
  },
  
  // Get salaries
  getSalaries: (filters = {}) => {
    return apiInstance.get('/proxy/leave-management/salaries', { params: filters });
  },
};

// Medical Files API
export const medicalFilesApi = {
  // Get medical files
  getMedicalFiles: (filters = {}) => {
    return apiInstance.get('/proxy/medical-files/medical-files', { params: filters });
  },
  
  // Upload medical file
  uploadMedicalFile: (file: File, data: any) => {
    const formData = new FormData();
    formData.append('file', file);
    Object.keys(data).forEach(key => {
      formData.append(key, data[key]);
    });
    return apiInstance.post('/proxy/medical-files/medical-files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Get categories
  getCategories: () => {
    return apiInstance.get('/proxy/medical-files/categories');
  },
  
  // Download file
  downloadFile: (id: string) => {
    return apiInstance.get(`/proxy/medical-files/medical-files/${id}/download`, {
      responseType: 'blob',
    });
  },
};

// Recruitment API
export const recruitmentApi = {
  // Get candidates
  getCandidates: (filters = {}) => {
    return apiInstance.get('/proxy/recruitment/candidates', { params: filters });
  },
  
  // Create candidate
  createCandidate: (data: any) => {
    return apiInstance.post('/proxy/recruitment/candidates', data);
  },
  
  // Update candidate
  updateCandidate: (id: string, data: any) => {
    return apiInstance.put(`/proxy/recruitment/candidates/${id}`, data);
  },
  
  // Get stages
  getStages: () => {
    return apiInstance.get('/proxy/recruitment/stages');
  },
  
  // Get analytics
  getAnalytics: (filters = {}) => {
    return apiInstance.get('/proxy/recruitment/analytics', { params: filters });
  },
};

