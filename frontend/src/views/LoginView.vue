<template>
  <div class="login-container">
    <div class="card login-card">
      <div class="login-header">
        <div class="logo-placeholder">⚖️</div>
        <h1 class="title">โปรแกรมบริหารจัดการ</h1>
        <p class="subtitle">ผู้พิพากษาสมทบ ศาลเยาวชนและครอบครัว</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="input-group">
          <label for="username">ชื่อผู้ใช้ (Username)</label>
          <input
            type="text"
            id="username"
            v-model="username"
            placeholder="กรอกชื่อผู้ใช้ของคุณ..."
            required
            autocomplete="username"
          />
        </div>

        <div class="input-group">
          <label for="password">รหัสผ่าน (Password)</label>
          <input
            type="password"
            id="password"
            v-model="password"
            placeholder="กรอกรหัสผ่านของคุณ..."
            required
            autocomplete="current-password"
          />
        </div>

        <div v-if="errorMessage" class="error-alert">
          {{ errorMessage }}
        </div>

        <button type="submit" class="btn-primary login-btn" :disabled="isLoading">
          {{ isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'
import swal from 'sweetalert2' // นำเข้า SweetAlert2 สำหรับแสดง Alert

const router = useRouter()
const username = ref('')
const password = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

const handleLogin = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await api.post('/auth/login', {
      username: username.value,
      password: password.value
    })

    // ⭐️ บันทึก Token (ตั้งชื่อให้ตรงกับตัวแปรที่ใช้เช็กใน router/index.js)
    // const token = response.data.jwt || response.data.token
    // localStorage.setItem('token', token)
    
    // หาก API มีการส่งข้อมูลผู้ใช้กลับมาด้วย สามารถเก็บไว้ใช้แสดงชื่อมุมขวาบนได้
    if (response.data.user) {
      localStorage.setItem('user', JSON.stringify(response.data.user))
    }

    swal.fire({
      icon: 'success',
      title: 'เข้าสู่ระบบสำเร็จ',
      text: 'ยินดีต้อนรับ!',
      timer: 1500,
      showConfirmButton: false
    })
    
    router.push('/dashboard')
  } catch (error) {
    if (error.response && error.response.data && error.response.data.message) {
      errorMessage.value = error.response.data.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
    } else {
      errorMessage.value = 'ไม่สามารถเชื่อมต่อไปยังเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
/* พื้นหลังของหน้า Login ให้เต็มจอและอยู่ตรงกลาง */
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #F4F6F9;
  font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
  color: #333333;
}

/* กล่องล็อกอินสีขาวมีเงา */
.login-card {
  width: 100%;
  max-width: 420px;
  padding: 40px 32px;
  margin: 16px;
  box-sizing: border-box;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo-placeholder {
  font-size: 48px;
  margin-bottom: 12px;
}

.title {
  font-size: 24px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px 0;
}

.subtitle {
  font-size: 15px;
  color: #6B7280;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* แจ้งเตือนเมื่อผิดพลาดแบบกล่องสีแดงอ่อน */
.error-alert {
  background-color: #FEE2E2;
  color: #991B1B;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 14px;
  text-align: center;
  border: 1px solid #FCA5A5;
}

.login-btn {
  margin-top: 8px;
  width: 100%;
  padding: 12px;
  font-size: 16px;
}

/* รองรับ Responsive สำหรับมือถือ */
@media (max-width: 480px) {
  
  .login-card {
    padding: 32px 24px;
    border: none;
    box-shadow: none;
    background-color: transparent;
  }
  .login-container {
    background-color: #FFFFFF;
  }
}
</style>