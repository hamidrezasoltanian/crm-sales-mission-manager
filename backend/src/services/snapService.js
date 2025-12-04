import axios from 'axios';

/**
 * سرویس اتصال به API اسنپ
 * این سرویس برای دریافت لوکیشن و محاسبه هزینه استفاده می‌شود
 */

export class SnapService {
  constructor() {
    // API Key اسنپ - باید از .env خوانده شود
    this.apiKey = process.env.SNAP_API_KEY || '';
    this.baseUrl = process.env.SNAP_API_URL || 'https://snappfood.ir/api';
    
    // در صورت نبودن API واقعی، از mock استفاده می‌کنیم
    this.useMock = !this.apiKey || this.apiKey === '';
  }

  /**
   * دریافت اطلاعات لوکیشن از اسنپ
   * @param {number} latitude - عرض جغرافیایی
   * @param {number} longitude - طول جغرافیایی
   */
  async getLocationInfo(latitude, longitude) {
    if (this.useMock) {
      // Mock response برای تست
      return {
        locationId: `loc_${Date.now()}`,
        address: `آدرس تقریبی: ${latitude}, ${longitude}`,
        city: 'تهران',
        district: 'منطقه نامشخص',
        latitude: latitude,
        longitude: longitude
      };
    }

    try {
      const response = await axios.post(`${this.baseUrl}/v2/location/coordinates`, {
        latitude,
        longitude
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-API-KEY': this.apiKey
        },
        timeout: 10000
      });

      return {
        locationId: response.data.locationId || response.data.id,
        address: response.data.address || response.data.formatted_address,
        city: response.data.city || response.data.address_components?.find(c => c.types.includes('locality'))?.long_name,
        district: response.data.district || response.data.neighborhood,
        latitude: response.data.latitude || latitude,
        longitude: response.data.longitude || longitude
      };
    } catch (error) {
      console.error('Snap location API error:', error.message);
      // در صورت خطا، اطلاعات اولیه را برمی‌گردانیم
      return {
        locationId: `loc_${Date.now()}`,
        address: `آدرس: ${latitude}, ${longitude}`,
        city: 'تهران',
        district: 'نامشخص',
        latitude: latitude,
        longitude: longitude
      };
    }
  }

  /**
   * محاسبه هزینه سفر از اسنپ
   * @param {number} originLat - عرض جغرافیایی مبدا
   * @param {number} originLng - طول جغرافیایی مبدا
   * @param {number} destLat - عرض جغرافیایی مقصد
   * @param {number} destLng - طول جغرافیایی مقصد
   */
  async calculateCost(originLat, originLng, destLat, destLng) {
    if (this.useMock) {
      // محاسبه فاصله تقریبی (Haversine formula)
      const distance = this.calculateDistance(originLat, originLng, destLat, destLng);
      // هزینه تقریبی: 5000 تومان به ازای هر کیلومتر + پایه 10000
      const cost = Math.round(10000 + (distance * 5000));
      
      return {
        cost: cost,
        distance: Math.round(distance * 100) / 100, // کیلومتر با 2 رقم اعشار
        duration: Math.round(distance * 3), // دقیقه تقریبی
        estimatedTime: `${Math.round(distance * 3)} دقیقه`
      };
    }

    try {
      const response = await axios.post(`${this.baseUrl}/v2/delivery/estimate`, {
        origin: {
          latitude: originLat,
          longitude: originLng
        },
        destination: {
          latitude: destLat,
          longitude: destLng
        },
        vehicleType: 'motorcycle' // یا 'car' بسته به نیاز
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-API-KEY': this.apiKey
        },
        timeout: 10000
      });

      return {
        cost: response.data.fare?.total || response.data.cost || 0,
        distance: response.data.distance || 0,
        duration: response.data.duration || 0,
        estimatedTime: response.data.estimatedTime || `${response.data.duration || 0} دقیقه`
      };
    } catch (error) {
      console.error('Snap cost calculation error:', error.message);
      
      // در صورت خطا، محاسبه تقریبی انجام می‌دهیم
      const distance = this.calculateDistance(originLat, originLng, destLat, destLng);
      const cost = Math.round(10000 + (distance * 5000));
      
      return {
        cost: cost,
        distance: Math.round(distance * 100) / 100,
        duration: Math.round(distance * 3),
        estimatedTime: `${Math.round(distance * 3)} دقیقه`
      };
    }
  }

  /**
   * محاسبه فاصله بین دو نقطه جغرافیایی (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // شعاع زمین به کیلومتر
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * دریافت هزینه بین دو مرکز
   * @param {number} centerId1 - ID مرکز اول
   * @param {number} centerId2 - ID مرکز دوم
   */
  async getCostBetweenCenters(centerId1, centerId2) {
    // این متد نیاز به Center model دارد
    // فعلاً placeholder است
    try {
      // باید مراکز را از دیتابیس بخوانیم
      // برای حالا یک mock برمی‌گردانیم
      return {
        cost: 15000,
        distance: 5,
        duration: 15
      };
    } catch (error) {
      console.error('Error calculating cost between centers:', error);
      throw error;
    }
  }
}

export default new SnapService();