<template>
  <div class="manage-layout">
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">โปรไฟล์ของฉัน</h1>
        <p class="page-subtitle">จัดการข้อมูลส่วนตัวและเปลี่ยนรหัสผ่าน</p>
      </div>
    </div>

    <!-- ฟอร์มแก้ไขข้อมูลส่วนตัว -->
    <div class="card" style="max-width: 600px; margin: 0 auto; padding: 32px;">
      <form @submit.prevent="saveProfile" class="form-grid">
        
        <!-- ส่วนที่ 1: ข้อมูลส่วนตัว -->
        <div class="input-group full-width">
          <h3 style="margin: 0 0 16px 0; border-bottom: 1px solid #E5E7EB; padding-bottom: 8px; font-size: 16px; color: #111827;">
            ข้อมูลส่วนตัว
          </h3>
        </div>

        <div class="input-group full-width">
          <label>ชื่อผู้ใช้ (Username)</label>
          <input type="text" :value="userInfo.username" disabled style="background-color: #F3F4F6; cursor: not-allowed;" />
          <small class="text-muted">ไม่สามารถแก้ไขชื่อผู้ใช้ได้</small>
        </div>

        <div class="input-group full-width">
          <label>ชื่อ-สกุล <span class="text-danger">*</span></label>
          <input type="text" v-model="formData.full_name" required placeholder="ชื่อ-สกุล ของคุณ" />
        </div>

        <div class="input-group">
          <label>สิทธิ์การใช้งาน</label>
          <input type="text" :value="userInfo.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้งานทั่วไป (Viewer)'" disabled style="background-color: #F3F4F6;" />
        </div>

        <div class="input-group">
          <label>รหัสศาล</label>
          <input type="text" :value="userInfo.court_code ? userInfo.court_code.toUpperCase() : '-'" disabled style="background-color: #F3F4F6;" class="font-mono" />
        </div>

        <!-- ส่วนที่ 2: เปลี่ยนรหัสผ่าน -->
        <div class="input-group full-width" style="margin-top: 16px;">
          <h3 style="margin: 0 0 16px 0; border-bottom: 1px solid #E5E7EB; padding-bottom: 8px; font-size: 16px; color: #111827;">
            เปลี่ยนรหัสผ่าน <span style="font-size: 13px; font-weight: normal; color: #6B7280;">(เว้นว่างไว้หากไม่ต้องการเปลี่ยน)</span>
          </h3>
        </div>

        <div class="input-group full-width">
          <label>รหัสผ่านเดิม</label>
          <input type="password" v-model="formData.old_password" placeholder="กรอกรหัสผ่านเดิมเพื่อยืนยัน" />
        </div>

        <div class="input-group">
          <label>รหัสผ่านใหม่</label>
          <input type="password" v-model="formData.new_password" placeholder="รหัสผ่านใหม่" />
        </div>

        <div class="input-group">
          <label>ยืนยันรหัสผ่านใหม่</label>
          <input type="password" v-model="formData.confirm_password" placeholder="กรอกรหัสผ่านใหม่อีกครั้ง" />
        </div>

        <div class="modal-actions full-width" style="margin-top: 24px; justify-content: center;">
          <button type="submit" class="btn-primary" style="width: 100%; padding: 12px; font-size: 16px;" :disabled="isLoading">
            {{ isLoading ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'
import { swalSuccess, swalError } from '../utils/swal'

const isLoading = ref(false)
const userInfo = ref({
  id: null,
  username: '',
  role: '',
  court_code: ''
})

const formData = ref({
  full_name: '',
  old_password: '',
  new_password: '',
  confirm_password: ''
})

// === โหลดข้อมูลตั้งต้นจาก LocalStorage ===
onMounted(() => {
  const storedUser = localStorage.getItem('user')
  if (storedUser) {
    const user = JSON.parse(storedUser)
    userInfo.value = user
    formData.value.full_name = user.full_name || ''
  }
})

// === ฟังก์ชันบันทึกข้อมูล ===
const saveProfile = async () => {
  // 1. ตรวจสอบเงื่อนไขรหัสผ่าน
  if (formData.value.new_password || formData.value.confirm_password || formData.value.old_password) {
    if (!formData.value.old_password) {
      swalError('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกรหัสผ่านเดิมเพื่อยืนยันการเปลี่ยนรหัสผ่าน')
      return
    }
    if (formData.value.new_password !== formData.value.confirm_password) {
      swalError('รหัสผ่านไม่ตรงกัน', 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง')
      return
    }
  }

  isLoading.value = true

  try {
    const payload = {
      id: userInfo.value.id,
      full_name: formData.value.full_name,
      old_password: formData.value.old_password,
      new_password: formData.value.new_password
    }

    // ⭐️ เรียก API อัปเดตโปรไฟล์ (คุณจะต้องไปสร้าง Endpoint: PUT /users/profile ที่ Backend เพิ่มเติม)
    const response = await api.put('/users/profile', payload)

    // ⭐️ อัปเดตชื่อใหม่ลงใน LocalStorage ทันที เพื่อให้ Topbar เปลี่ยนชื่อตาม
    const updatedUser = { ...userInfo.value, full_name: formData.value.full_name }
    localStorage.setItem('user', JSON.stringify(updatedUser))

    swalSuccess('บันทึกสำเร็จ', 'อัปเดตข้อมูลโปรไฟล์ของคุณเรียบร้อยแล้ว')
    
    // รีเซ็ตช่องรหัสผ่าน
    formData.value.old_password = ''
    formData.value.new_password = ''
    formData.value.confirm_password = ''

    // รีเฟรชหน้าเบาๆ เพื่อให้ Topbar อ่านค่าใหม่จาก LocalStorage
    setTimeout(() => {
      window.location.reload()
    }, 1500)

  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถอัปเดตข้อมูลได้ รหัสผ่านเดิมอาจไม่ถูกต้อง')
  } finally {
    isLoading.value = false
  }
}
</script>