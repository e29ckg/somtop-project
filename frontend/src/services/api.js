import axios from 'axios'
import router from '../router' // นำเข้า router จากไฟล์ที่เราตั้งค่าไว้
import swal from 'sweetalert2' // นำเข้า SweetAlert2 สำหรับแสดง Alert

// สร้าง Axios Instance พร้อมกำหนด Base URL ของ Backend PHP
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8088/api', // ใช้ VITE_API_URL จาก .env.development หรือค่าเริ่มต้น
  withCredentials: true
})

// 1. Request Interceptor: แนบ Token ไปก่อนส่ง Request (เหมือนเดิม)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 2. Response Interceptor (ส่วนที่เพิ่มใหม่): ดักจับ Error ตอน Backend ตอบกลับมา
api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.user) {
      localStorage.setItem('user', JSON.stringify(response.data.user))
    }
    // ถ้าสำเร็จ (Status 2xx) ก็ปล่อยผ่านไปปกติ
    return response 
  },
  (error) => {
    // ดักจับ Error Status 401 Unauthorized
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn("เซสชันหมดอายุหรือไม่มีสิทธิ์เข้าถึง เด้งไปหน้า Login")
      
      // ลบ Token เก่า/เสีย ทิ้งไป
      localStorage.removeItem('token') 
      localStorage.removeItem('user')
            
      swal.fire({
        icon: 'warning',
        title: error.response.data.message || 'เซสชันหมดอายุหรือไม่มีสิทธิ์เข้าถึง',
        text: 'กรุณาเข้าสู่ระบบใหม่',
        confirmButtonText: 'ตกลง'
      }).then(() => {
        // บังคับเปลี่ยนหน้าไปที่หน้า Login ('/')
        router.push('/') 
      })
      return Promise.reject(error) // ป้องกันการทำงานต่อของ Request ที่ล้มเหลว
    }     
    
    // ส่ง Error ต่อไปให้หน้า Component จัดการ (เช่น แสดง alert แจ้งผู้ใช้)
    return Promise.reject(error)
  }
)

export default api