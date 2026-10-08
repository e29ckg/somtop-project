<template>
  <div class="manage-layout">
    <div class="page-header">
      <div>
        <h1 class="page-title">อัปเดตโปรเจกต์จาก GitHub</h1>
        <p class="page-subtitle">ดึงโค้ดจาก origin/main แล้วรันสคริปต์อัปเดตบนเซิร์ฟเวอร์</p>
      </div>
    </div>

    <div class="card update-card">
      <h2 class="card-title">สถานะการอัปเดต</h2>
      <p v-if="loading">กำลังตรวจสอบสถานะ...</p>
      <template v-else>
        <p v-if="!enabled" class="notice">ยังไม่ได้เปิดใช้งานการอัปเดตผ่านหน้าเว็บบนเซิร์ฟเวอร์นี้</p>
        <p v-if="connectionMessage" class="notice">{{ connectionMessage }}</p>
        <div v-if="status" class="status-box" :class="status.status">
          <strong>{{ statusText }}</strong>
          <span v-if="status.started_at">เริ่ม: {{ formatTime(status.started_at) }}</span>
          <span v-if="status.finished_at">เสร็จ: {{ formatTime(status.finished_at) }}</span>
          <span v-if="status.previous_commit">เวอร์ชันเดิม: {{ status.previous_commit }}</span>
          <span v-if="status.target_commit">เวอร์ชัน GitHub: {{ status.target_commit }}</span>
          <span v-if="status.message">{{ status.message }}</span>
        </div>
        <p v-else-if="enabled">ยังไม่มีประวัติการอัปเดตผ่านหน้าเว็บ</p>
      </template>
      <button class="btn-secondary" type="button" @click="loadStatus" :disabled="loading">ตรวจสถานะอีกครั้ง</button>
    </div>

    <div class="card update-card">
      <h2 class="card-title">เริ่มอัปเดต</h2>
      <p>ก่อนเริ่ม ให้สำรองฐานข้อมูล ไฟล์อัปโหลด เทมเพลต และค่าเซิร์ฟเวอร์ พร้อมตรวจ migration ที่จำเป็นตามคู่มือขึ้นระบบจริง</p>
      <p>ระหว่างอัปเดต API จะหยุดและเริ่มใหม่ชั่วคราว หน้านี้จะกลับมาตรวจสถานะให้อัตโนมัติ</p>
      <label class="confirm-row">
        <input v-model="backupConfirmed" type="checkbox" />
        <span>ฉันสำรองข้อมูลและตรวจ migration ที่จำเป็นแล้ว</span>
      </label>
      <button class="btn-primary" type="button" :disabled="!enabled || !backupConfirmed || running || starting" @click="startUpdate">
        {{ starting ? 'กำลังเริ่ม...' : running ? 'กำลังอัปเดต...' : 'อัปเดตจาก GitHub' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Swal from 'sweetalert2'
import api from '../services/api'
import { swalError } from '../utils/swal'

const enabled = ref(false)
const loading = ref(true)
const starting = ref(false)
const backupConfirmed = ref(false)
const status = ref(null)
const connectionMessage = ref('')
let polling

const running = computed(() => status.value?.status === 'running')
const phaseNames = {
  queued: 'รอเริ่มงาน', fetching: 'กำลังตรวจ GitHub', pulling: 'กำลังดึงโค้ด',
  deploying: 'กำลัง build และเริ่ม API ใหม่', done: 'อัปเดตสำเร็จ',
  up_to_date: 'เป็นเวอร์ชันล่าสุดแล้ว', failed: 'อัปเดตไม่สำเร็จ', launch: 'เริ่มงานไม่สำเร็จ'
}
const statusText = computed(() => phaseNames[status.value?.phase] || status.value?.status || '')
const formatTime = value => new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'medium' })

const loadStatus = async () => {
  try {
    const response = await api.get('/system-update', { timeout: 8000 })
    enabled.value = response.data.enabled
    status.value = response.data.status
    connectionMessage.value = ''
  } catch {
    connectionMessage.value = 'เชื่อมต่อ API ไม่ได้ชั่วคราว หากกำลังอัปเดต ระบบจะตรวจให้อีกครั้ง'
  } finally {
    loading.value = false
  }
}

const startUpdate = async () => {
  const confirmation = await Swal.fire({
    title: 'ยืนยันอัปเดตโปรเจกต์',
    text: 'พิมพ์ UPDATE เพื่อยืนยันการดึง origin/main และเริ่มบริการใหม่',
    icon: 'warning', input: 'text', showCancelButton: true,
    confirmButtonText: 'เริ่มอัปเดต', cancelButtonText: 'ยกเลิก',
    inputValidator: value => value === 'UPDATE' ? undefined : 'กรุณาพิมพ์ UPDATE ให้ตรงกัน'
  })
  if (!confirmation.isConfirmed) return
  starting.value = true
  try {
    const response = await api.post('/system-update', { confirmation: 'UPDATE', backup_confirmed: backupConfirmed.value }, { timeout: 10000 })
    status.value = response.data.status
    backupConfirmed.value = false
  } catch (error) {
    swalError('เริ่มอัปเดตไม่สำเร็จ', error.response?.data?.message || 'กรุณาตรวจการเชื่อมต่อและสถานะอีกครั้ง')
  } finally {
    starting.value = false
    loadStatus()
  }
}

onMounted(() => {
  loadStatus()
  polling = window.setInterval(loadStatus, 4000)
})
onUnmounted(() => window.clearInterval(polling))
</script>

<style scoped>
.update-card { max-width: 760px; margin-bottom: 20px; }
.update-card p { color: #4b5563; line-height: 1.6; }
.notice { padding: 12px; border-radius: 8px; background: #fef3c7; color: #92400e !important; }
.status-box { display: grid; gap: 6px; padding: 14px; margin: 16px 0; border-radius: 8px; background: #eff6ff; }
.status-box.completed { background: #d1fae5; }
.status-box.failed { background: #fee2e2; }
.confirm-row { display: flex; gap: 10px; align-items: flex-start; margin: 20px 0; }
.confirm-row input { margin-top: 4px; }
</style>
