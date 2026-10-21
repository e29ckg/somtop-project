<template>
  <div class="login-container">
    <div class="card login-card">
      <div class="login-header">
        <div class="logo-placeholder">⚖️</div>
        <h1 class="title">โปรแกรมบริหารจัดการ</h1>
        <p class="subtitle">ผู้พิพากษาสมทบ ศาลเยาวชนและครอบครัว</p>
      </div>

      <p v-if="!providers && !errorMessage" class="subtitle">กำลังตรวจสอบระบบเข้าสู่ระบบ...</p>
      <form v-if="providers?.includes('local')" @submit.prevent="handleLogin" class="login-form">
        <p class="subtitle login-method-title">เข้าสู่ระบบด้วยบัญชี Somtop</p>
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

        <button type="submit" class="btn-primary login-btn" :disabled="isLoading">
          {{ isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วยบัญชี Somtop' }}
        </button>
      </form>
      <div v-if="providers?.includes('auth-hub')" class="sso-login">
        <div class="login-divider"><span>หรือ</span></div>
        <button type="button" class="btn-secondary login-btn" :disabled="isLoading" @click="handleSsoLogin">
          เข้าสู่ระบบด้วย Auth-Hub
        </button>
        <p class="subtitle sso-description">ใช้บัญชีกลางที่เชื่อมกับบัญชี Somtop</p>
      </div>
      <div v-if="errorMessage" class="error-alert" role="alert">{{ errorMessage }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../services/api'
import swal from 'sweetalert2' // นำเข้า SweetAlert2 สำหรับแสดง Alert
import { setSessionUser } from '../services/session'

const router = useRouter()
const route = useRoute()
const providers = ref(null)
const username = ref('')
const password = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

onMounted(async () => {
  const messages = {
    access_denied: 'บัญชีนี้ยังไม่ได้เชื่อมกับ Somtop หรือไม่มีสิทธิ์ใช้งาน กรุณาติดต่อผู้ดูแลระบบ',
    unavailable: 'ไม่สามารถเชื่อมต่อ Auth-Hub ได้ กรุณาลองใหม่',
    failed: 'การเข้าสู่ระบบไม่สำเร็จหรือคำขอหมดอายุ กรุณาลองใหม่'
  }
  if (route.query.auth_error) {
    errorMessage.value = messages[route.query.auth_error] || messages.failed
    await router.replace({ path: '/', query: {} })
  }
  try {
    const response = await api.get('/auth/config')
    providers.value = response.data.providers || (response.data.provider === 'auth-hub' ? ['auth-hub'] : ['local'])
  } catch {
    errorMessage.value = 'ไม่สามารถตรวจสอบระบบเข้าสู่ระบบได้ กรุณาโหลดหน้าใหม่'
  }
})

const handleSsoLogin = () => {
  isLoading.value = true
  window.location.assign(`${import.meta.env.BASE_URL}api/auth/sso/login`)
}

const handleLogin = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await api.post('/auth/login', {
      username: username.value,
      password: password.value
    })

    if (response.data.user) {
      setSessionUser(response.data.user)
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

.login-method-title,
.sso-description {
  text-align: center;
}

.login-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 24px 0 12px;
  color: #6B7280;
  font-size: 14px;
}

.login-divider::before,
.login-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #E5E7EB;
}

.sso-description {
  margin-top: 12px;
  font-size: 13px;
}

.error-alert {
  margin-top: 16px;
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
