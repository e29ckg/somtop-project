<template>
  <div class="manage-layout">
    <!-- Header -->
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">การเชื่อมต่อ Google Calendar</h1>
        <p class="page-subtitle">ตั้งค่าปฏิทินและทดสอบการส่งข้อมูลจากระบบขึ้น Google (เฉพาะผู้ดูแลระบบ)</p>
      </div>
    </div>

    <!-- 2 Columns Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px;">
      
      <!-- Card 1: ตั้งค่า Calendar ID -->
      <div class="card">
        <h2 class="card-title" style="margin-bottom: 16px;">⚙️ ตั้งค่าบัญชีปฏิทิน (Calendar ID)</h2>
        <form @submit.prevent="saveSettings" class="form-grid">
          
          <div class="input-group full-width">
            <label>เปิดใช้งานการส่งข้อมูลอัตโนมัติ (Auto Sync)</label>
            <select v-model="formData.is_sync_enabled">
              <option :value="1">เปิดใช้งาน (ส่งข้อมูลขึ้น Google ทันทีที่สร้างกิจกรรม)</option>
              <option :value="0">ปิดใช้งาน</option>
            </select>
          </div>

          <div class="input-group full-width">
            <label>Google Calendar ID <span style="color: #DC2626;">*</span></label>
            <input type="text" v-model="formData.calendar_id" placeholder="เช่น court_email@group.calendar.google.com" required />
            <small style="color: #6B7280; margin-top: 4px; display: block;">นำอีเมลจากหน้าตั้งค่าของ Google Calendar มาใส่ที่นี่</small>
          </div>

          <div class="modal-actions full-width mt-4" style="justify-content: flex-start;">
            <button type="submit" class="btn-primary">
               💾 บันทึกการตั้งค่า
            </button>
          </div>
        </form>
      </div>

      <!-- Card 2: ทดสอบการเชื่อมต่อ -->
      <div class="card">
        <h2 class="card-title" style="margin-bottom: 16px;">🚀 ทดสอบการเชื่อมต่อระบบ</h2>
        <p style="color: #6B7280; font-size: 14px; margin-bottom: 20px; line-height: 1.5;">
          กดปุ่มด้านล่างเพื่อทดสอบสร้างกิจกรรมจำลองไปยัง Google Calendar ระบบจะตรวจสอบว่า Service Account ทำงานและได้รับสิทธิ์เขียนข้อมูลถูกต้องหรือไม่
        </p>
        
        <button class="btn-secondary" @click="testConnection" :disabled="isTesting" style="display: flex; align-items: center; gap: 8px;">
          <span v-if="isTesting">กำลังทดสอบส่งข้อมูล...</span>
          <span v-else>🔄 ทดสอบการส่งข้อมูล (Test Connection)</span> 
        </button>

        <div v-if="testResult" style="margin-top: 16px; padding: 12px; border-radius: 8px;" :style="testResult.success ? 'background-color: #D1FAE5; color: #065F46;' : 'background-color: #FEE2E2; color: #991B1B;'">
          <strong>{{ testResult.success ? '✅ สำเร็จ:' : '❌ ผิดพลาด:' }}</strong> {{ testResult.message }}
        </div>
      </div>

      <!-- Card 3: อัปเดตไฟล์ Service Account -->
    <div class="card mt-4">
      <h2 class="card-title" style="margin-bottom: 16px;">🔑 อัปเดต Service Account Key (JSON)</h2>
      <p style="color: #6B7280; font-size: 14px; margin-bottom: 20px;">
        คัดลอกเนื้อหาทั้งหมดจากไฟล์ <code>.json</code> ที่ได้จาก Google Cloud Console มาวางที่นี่ ระบบจะบันทึกเป็นไฟล์ลับในเซิร์ฟเวอร์
      </p>
      
      <form @submit.prevent="saveServiceAccount" class="form-grid">
        <div class="input-group full-width">
          <textarea 
            v-model="serviceAccountText" 
            rows="8" 
            placeholder='{&#10;  "type": "service_account",&#10;  "project_id": "...",&#10;  "private_key_id": "..."&#10;}' 
            style="font-family: monospace; font-size: 13px;"
            required
          ></textarea>
        </div>

        <div class="modal-actions full-width mt-4" style="justify-content: flex-start;">
          <button type="submit" class="btn-primary" :disabled="isSavingKey">
            {{ isSavingKey ? 'กำลังบันทึก...' : '💾 บันทึก Service Account Key' }}
          </button>
        </div>
      </form>
    </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'
import { swalSuccess, swalError } from '../utils/swal' // ใช้ Swal แบบเดิม

// State ของฟอร์มตั้งค่า
const formData = ref({
  calendar_id: '',
  is_sync_enabled: 1
})

// State ของระบบทดสอบเชื่อมต่อ
const isTesting = ref(false)
const testResult = ref(null)

// ⭐️ เพิ่ม State สำหรับ Service Account
const serviceAccountText = ref('')
const isSavingKey = ref(false)

// 1. ดึงข้อมูลการตั้งค่าเดิมจาก Backend
const fetchSettings = async () => {
  try {
    const response = await api.get('/settings/calendar')
    if (response.data && response.data.record) {
      formData.value.calendar_id = response.data.record.calendar_id || ''
      formData.value.is_sync_enabled = response.data.record.is_sync_enabled ?? 1
    }
  } catch (error) {
    console.error("ดึงข้อมูลการตั้งค่าปฏิทินไม่สำเร็จ:", error)
  }
}

// 2. บันทึกข้อมูลการตั้งค่า
const saveSettings = async () => {
  try {
    await api.post('/settings/calendar', formData.value)
    swalSuccess('บันทึกสำเร็จ', 'อัปเดตการตั้งค่า Google Calendar เรียบร้อย')
  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกการตั้งค่าได้')
  }
}

// 3. ทดสอบการเชื่อมต่อ API ของ Google
const testConnection = async () => {
  isTesting.value = true
  testResult.value = null
  try {
    const response = await api.post('/settings/calendar/test', {
      calendar_id: formData.value.calendar_id
    })
    testResult.value = { success: true, message: 'สร้างกิจกรรมทดสอบสำเร็จ! ตรวจสอบที่หน้า Google Calendar ของคุณ' }
    swalSuccess('เชื่อมต่อสำเร็จ', 'Service Account ทำงานได้ปกติ')
  } catch (error) {
    testResult.value = { success: false, message: error.response?.data?.message || 'ไม่สามารถเชื่อมต่อได้ ตรวจสอบ Calendar ID หรือสิทธิ์ Share' }
  } finally {
    isTesting.value = false
  }
}

// ⭐️ เพิ่มฟังก์ชันบันทึก
const saveServiceAccount = async () => {
  isSavingKey.value = true
  try {
    await api.post('/settings/calendar/service-account', { 
      service_account_text: serviceAccountText.value 
    })
    swalSuccess('บันทึกสำเร็จ', 'อัปเดตไฟล์ Service Account ในระบบเรียบร้อยแล้ว')
    serviceAccountText.value = '' // ล้างช่องว่างเพื่อความปลอดภัยหลังบันทึกเสร็จ
  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกไฟล์ได้')
  } finally {
    isSavingKey.value = false
  }
}

onMounted(() => {
  fetchSettings()
})
</script>

<style scoped>
/* ใช้ Class มาตรฐานของระบบ */
</style>