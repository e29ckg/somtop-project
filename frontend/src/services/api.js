import axios from 'axios'
import swal from 'sweetalert2' // นำเข้า SweetAlert2 สำหรับแสดง Alert
import { clearSession, setSessionUser } from './session'

// เรียก API ผ่าน Apache ภายใต้ path เดียวกับหน้าเว็บ
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `${import.meta.env.BASE_URL}api`,
  withCredentials: true
})

// HttpOnly cookie เป็นแหล่งยืนยันตัวตนเพียงแหล่งเดียว
api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.user) {
      setSessionUser(response.data.user)
    }
    // ถ้าสำเร็จ (Status 2xx) ก็ปล่อยผ่านไปปกติ
    return response 
  },
  (error) => {
    // ดักจับ Error Status 401 Unauthorized
    if (error.response?.status === 401) {
      clearSession()
      if (window.location.pathname !== import.meta.env.BASE_URL) window.location.assign(import.meta.env.BASE_URL)
    } else if (error.response?.status === 403) {
      swal.fire({
        icon: 'warning',
        title: 'ไม่มีสิทธิ์ดำเนินการ',
        text: error.response?.data?.message || 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงรายการดังกล่าว',
        confirmButtonText: 'ตกลง'
      })
    }
    
    // ส่ง Error ต่อไปให้หน้า Component จัดการ (เช่น แสดง alert แจ้งผู้ใช้)
    return Promise.reject(error)
  }
)

export default api
