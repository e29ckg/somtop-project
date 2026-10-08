<template>
  <div class="manage-layout update-page">
    <div class="page-header">
      <div><h1 class="page-title">อัปเดตโปรเจกต์จาก GitHub</h1><p class="page-subtitle">สำรองข้อมูลและติดตามทุกขั้นตอนจนเว็บและ API พร้อมใช้งาน</p></div>
    </div>

    <section ref="progressPanel" class="card update-card" aria-labelledby="update-status-title">
      <div class="status-heading"><h2 id="update-status-title" class="card-title">สถานะการอัปเดต</h2><span v-if="status" class="state-pill" :class="status.status">{{ stateLabel }}</span></div>
      <p v-if="loading && !status">กำลังตรวจสอบสถานะ...</p>
      <p v-if="!enabled && !running && !loading" class="notice">ยังไม่ได้เปิดใช้งานการอัปเดตผ่านหน้าเว็บบนเซิร์ฟเวอร์นี้</p>
      <p v-if="connectionMessage" class="notice" role="status">{{ connectionMessage }}</p>
      <template v-if="status">
        <div class="status-summary" :class="status.status">
          <div><strong aria-live="polite">{{ statusText }}</strong><p v-if="status.message">{{ status.message }}</p></div>
          <div class="elapsed"><small>เวลาที่ใช้</small><strong>{{ elapsedText }}</strong></div>
        </div>
        <div class="status-meta"><span v-if="status.started_at">เริ่ม {{ formatTime(status.started_at) }}</span><span v-if="status.previous_commit">เวอร์ชันเดิม {{ status.previous_commit }}</span><span v-if="status.target_commit">GitHub {{ status.target_commit }}</span></div>
        <template v-if="steps.length">
          <div class="progress-label"><strong>ดำเนินการแล้ว {{ finishedSteps }}/{{ steps.length }} ขั้นตอน</strong><small v-if="skippedSteps">ข้าม {{ skippedSteps }} ขั้นตอนที่ไม่จำเป็น</small></div>
          <div class="progress-track" role="progressbar" aria-label="จำนวนขั้นตอนที่ดำเนินการแล้ว" :aria-valuenow="finishedSteps" :aria-valuemin="0" :aria-valuemax="steps.length"><div :style="{ width: `${finishedSteps / steps.length * 100}%` }" :class="status.status"></div></div>
          <div class="progress-content">
            <ol class="step-list" aria-label="ขั้นตอนการอัปเดต">
              <li v-for="(step, index) in steps" :key="step.key" class="step-row" :class="step.status" :aria-current="step.status === 'running' ? 'step' : undefined">
                <span class="step-marker" aria-hidden="true"><span v-if="step.status === 'running'" class="step-spinner"></span><template v-else>{{ step.status === 'completed' ? '✓' : step.status === 'failed' ? '✕' : step.status === 'skipped' ? '–' : index + 1 }}</template></span>
                <div class="step-body"><strong>{{ step.label }}</strong><p v-if="step.detail">{{ step.detail }}</p><small v-if="step.finished_at">{{ formatClock(step.finished_at) }}</small></div>
                <span class="step-state">{{ stepStateLabels[step.status] || step.status }}</span>
              </li>
            </ol>
            <div class="activity-panel"><h3>บันทึกความคืบหน้า</h3><div ref="activityLog" class="activity-log" role="log" aria-live="off"><div v-for="(event, index) in events" :key="`${event.at}-${index}`" class="activity-entry" :class="event.level"><time>{{ formatClock(event.at) }}</time><span>{{ event.message }}</span></div><p v-if="!events.length">รอข้อมูลความคืบหน้า...</p></div><small class="refresh-note">อัปเดตสถานะทุก 1 วินาทีระหว่างทำงาน แม้ API หยุดชั่วคราว</small></div>
          </div>
        </template>
        <p v-else class="muted">การอัปเดตครั้งถัดไปจะแสดงขั้นตอนและบันทึกความคืบหน้าที่นี่</p>
      </template>
      <p v-else-if="!loading">ยังไม่มีประวัติการอัปเดต เริ่มอัปเดตเพื่อดูความคืบหน้าที่นี่</p>
      <button class="btn-secondary" type="button" @click="loadStatus" :disabled="starting">ตรวจสถานะอีกครั้ง</button>
    </section>

    <section class="card update-card start-card">
      <h2 class="card-title">เริ่มอัปเดต</h2>
      <p>ระบบจะสำรองฐานข้อมูล ไฟล์อัปโหลด เทมเพลต และค่าระบบก่อนดาวน์โหลดจาก GitHub หากสำรองไม่สำเร็จ ระบบจะยกเลิกการอัปเดต</p>
      <p>ระหว่างติดตั้งและเริ่ม API ใหม่ ความคืบหน้าจะยังแสดงต่อเนื่อง หน้านี้กลับมาดูต่อได้แม้รีเฟรชระหว่างอัปเดต</p>
      <label class="confirm-row"><input v-model="maintenanceConfirmed" type="checkbox" :disabled="running || starting" /><span>ฉันตรวจ migration ที่จำเป็นแล้ว และยืนยันให้อัปเดตระบบ</span></label>
      <button class="btn-primary" type="button" :disabled="!enabled || !maintenanceConfirmed || running || starting" @click="startUpdate">{{ starting ? 'กำลังเริ่ม...' : running ? 'กำลังอัปเดต...' : 'เริ่มสำรองข้อมูลและอัปเดต' }}</button>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import Swal from 'sweetalert2'
import api from '../services/api'
import { swalError } from '../utils/swal'
import { readActiveUpdate, saveActiveUpdate, validProgressUrl } from '../services/updateProgress'

const enabled = ref(false)
const loading = ref(true)
const starting = ref(false)
const maintenanceConfirmed = ref(false)
const status = ref(readActiveUpdate())
const connectionMessage = ref('')
const progressPanel = ref(null)
const activityLog = ref(null)
const now = ref(Date.now())
let polling
let disposed = false
let pollingBusy = false
let generation = 0
const running = computed(() => status.value?.status === 'running')
const steps = computed(() => status.value?.steps || [])
const events = computed(() => status.value?.events || [])
const finishedSteps = computed(() => steps.value.filter(step => ['completed', 'skipped'].includes(step.status)).length)
const skippedSteps = computed(() => steps.value.filter(step => step.status === 'skipped').length)
const stepStateLabels = { pending: 'รอ', running: 'กำลังทำ', completed: 'เสร็จแล้ว', skipped: 'ข้าม', failed: 'ไม่สำเร็จ' }
const phaseNames = { queued: 'รอเริ่มงาน', done: 'อัปเดตสำเร็จ', up_to_date: 'เป็นเวอร์ชันล่าสุดแล้ว', failed: 'อัปเดตไม่สำเร็จ', deploying: 'กำลังติดตั้งและเริ่ม API ใหม่' }
const stateLabel = computed(() => ({ running: 'กำลังทำงาน', completed: 'เสร็จสมบูรณ์', failed: 'ไม่สำเร็จ' })[status.value?.status] || '')
const statusText = computed(() => steps.value.find(step => step.status === 'running')?.label || phaseNames[status.value?.phase] || status.value?.phase || '')
const elapsedText = computed(() => {
  if (!status.value?.started_at) return '–'
  const end = status.value.finished_at ? Date.parse(status.value.finished_at) : now.value
  const seconds = Math.max(0, Math.floor((end - Date.parse(status.value.started_at)) / 1000))
  return seconds < 60 ? `${seconds} วินาที` : `${Math.floor(seconds / 60)} นาที ${seconds % 60} วินาที`
})
const formatTime = value => new Date(value).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Bangkok' })
const formatClock = value => new Date(value).toLocaleTimeString('th-TH', { hour12: false, timeZone: 'Asia/Bangkok' })

const applyStatus = async value => {
  const nearBottom = !activityLog.value || activityLog.value.scrollTop + activityLog.value.clientHeight >= activityLog.value.scrollHeight - 50
  status.value = value
  saveActiveUpdate(value)
  now.value = Date.now()
  if (nearBottom) { await nextTick(); if (activityLog.value) activityLog.value.scrollTop = activityLog.value.scrollHeight }
}
const privateStatus = async (requestGeneration = generation) => {
  const response = await api.get('/system-update', { timeout: 5000 })
  if (requestGeneration !== generation) return
  enabled.value = response.data.enabled
  await applyStatus(response.data.status)
}
const loadStatus = async () => {
  if (pollingBusy || disposed) return
  pollingBusy = true
  const requestGeneration = generation
  try {
    const progressUrl = status.value?.progress_url
    if (running.value && validProgressUrl(progressUrl)) {
      try {
        const response = await fetch(progressUrl, { cache: 'no-store', signal: AbortSignal.timeout(4000) })
        if (!response.ok) throw new Error('Progress feed unavailable')
        const value = await response.json()
        if (requestGeneration !== generation) return
        if (value.id !== status.value.id) throw new Error('Progress job mismatch')
        await applyStatus({ ...value, progress_url: progressUrl })
        connectionMessage.value = ''
        if (!running.value) await privateStatus(requestGeneration)
        return
      } catch { /* Retry the authenticated API if Apache's progress feed is unavailable. */ }
    }
    await privateStatus()
    connectionMessage.value = ''
  } catch {
    connectionMessage.value = running.value ? 'กำลังเชื่อมต่อสถานะใหม่ ข้อมูลล่าสุดยังแสดงอยู่และจะตรวจให้อัตโนมัติ' : 'ยังเชื่อมต่อ API ไม่ได้ ระบบจะตรวจสถานะให้อีกครั้ง'
  } finally { pollingBusy = false; loading.value = false }
}
const startUpdate = async () => {
  const confirmation = await Swal.fire({ title: 'ยืนยันเริ่มสำรองข้อมูลและอัปเดต', text: 'พิมพ์ UPDATE เพื่อเริ่มสำรองข้อมูล ดึงโค้ดจาก GitHub และเริ่มบริการใหม่', icon: 'warning', input: 'text', showCancelButton: true, confirmButtonText: 'เริ่มอัปเดต', cancelButtonText: 'ยกเลิก', inputValidator: value => value === 'UPDATE' ? undefined : 'กรุณาพิมพ์ UPDATE ให้ตรงกัน' })
  if (!confirmation.isConfirmed) return
  starting.value = true
  try {
    const response = await api.post('/system-update', { confirmation: 'UPDATE', maintenance_confirmed: maintenanceConfirmed.value }, { timeout: 10000 })
    generation++
    await applyStatus(response.data.status)
    maintenanceConfirmed.value = false
    await nextTick()
    progressPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (error) { swalError('เริ่มอัปเดตไม่สำเร็จ', error.response?.data?.message || 'กรุณาตรวจการเชื่อมต่อและสถานะอีกครั้ง') }
  finally { starting.value = false; loadStatus() }
}
const poll = async () => { now.value = Date.now(); await loadStatus(); if (!disposed) polling = window.setTimeout(poll, running.value ? 1000 : 4000) }
onMounted(poll)
onUnmounted(() => { disposed = true; window.clearTimeout(polling) })
</script>

<style scoped>
.update-card{max-width:1100px;margin-bottom:20px}.update-card p{color:#475569;line-height:1.65}.status-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.state-pill{font-size:12px;font-weight:700;border-radius:999px;padding:6px 12px;background:#dbeafe;color:#1d4ed8}.state-pill.completed{background:#dcfce7;color:#166534}.state-pill.failed{background:#fee2e2;color:#991b1b}.notice{padding:12px;border-radius:8px;background:#fef3c7;color:#92400e!important}.status-summary{display:flex;justify-content:space-between;gap:20px;margin:16px 0 10px;padding:18px;border-radius:12px;background:#eff6ff;border:1px solid #dbeafe}.status-summary.completed{background:#f0fdf4;border-color:#bbf7d0}.status-summary.failed{background:#fef2f2;border-color:#fecaca}.status-summary strong{font-size:17px}.status-summary p{margin:6px 0 0;font-size:13px}.elapsed{display:flex;flex-direction:column;align-items:flex-end;gap:5px;min-width:110px}.elapsed small,.status-meta{font-size:12px;color:#64748b}.elapsed strong{font-size:14px;white-space:nowrap}.status-meta{display:flex;flex-wrap:wrap;gap:8px 20px;margin-bottom:20px}.progress-label{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13px}.progress-label small{color:#64748b}.progress-track{height:7px;border-radius:99px;background:#e2e8f0;overflow:hidden;margin:10px 0 22px}.progress-track>div{height:100%;background:#2563eb;transition:width .3s}.progress-track>.completed{background:#16a34a}.progress-track>.failed{background:#dc2626}.progress-content{display:grid;grid-template-columns:1.1fr 1fr;gap:28px;margin-bottom:22px}.step-list{list-style:none;margin:0;padding:0}.step-row{position:relative;display:grid;grid-template-columns:32px 1fr auto;gap:10px;min-height:54px;padding-bottom:15px}.step-row:not(:last-child)::after{content:'';position:absolute;width:2px;background:#e2e8f0;left:15px;top:33px;bottom:3px}.step-marker{width:32px;height:32px;display:grid;place-items:center;border-radius:50%;font-size:13px;font-weight:700;background:#f1f5f9;color:#64748b}.step-row.completed .step-marker{background:#dcfce7;color:#15803d}.step-row.running .step-marker{background:#dbeafe;color:#2563eb}.step-row.failed .step-marker{background:#fee2e2;color:#dc2626}.step-body{padding-top:5px;min-width:0}.step-body strong{font-size:13px;font-weight:600;color:#334155}.step-row.running .step-body strong{color:#1d4ed8}.step-row.pending .step-body strong,.step-row.skipped .step-body strong{color:#64748b}.step-body p{margin:4px 0 0;font-size:12px;overflow-wrap:anywhere}.step-body small{color:#94a3b8;font-size:11px}.step-state{font-size:11px;padding-top:8px;color:#64748b;white-space:nowrap}.step-row.running .step-state{color:#1d4ed8;font-weight:700}.step-row.failed .step-state{color:#dc2626}.step-spinner{width:14px;height:14px;border:2px solid #93c5fd;border-top-color:#2563eb;border-radius:50%;animation:spin .8s linear infinite}.activity-panel{min-width:0}.activity-panel h3{font-size:14px;margin:0 0 12px}.activity-log{max-height:490px;min-height:160px;overflow:auto;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px}.activity-entry{display:grid;grid-template-columns:66px 1fr;gap:8px;font-size:12px;line-height:1.6;padding:7px 0;border-bottom:1px solid #e2e8f0}.activity-entry:last-child{border:0}.activity-entry time{color:#94a3b8;font-variant-numeric:tabular-nums}.activity-entry span{color:#475569;overflow-wrap:anywhere}.activity-entry.success span{color:#15803d}.activity-entry.error span{color:#b91c1c}.refresh-note{display:block;font-size:11px;color:#64748b;margin-top:10px;line-height:1.5}.confirm-row{display:flex;gap:10px;align-items:flex-start;margin:20px 0}.confirm-row input{margin-top:5px}.start-card{max-width:1100px}.muted{font-size:13px;color:#64748b}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:850px){.progress-content{grid-template-columns:1fr}.activity-log{max-height:280px}}@media(max-width:520px){.status-summary{flex-direction:column;gap:12px}.elapsed{align-items:flex-start}.step-row{grid-template-columns:32px 1fr}.step-state{grid-column:2;padding-top:0;margin-top:-8px}.status-meta{gap:6px 12px}}@media(prefers-reduced-motion:reduce){.step-spinner{animation:none}.progress-track>div{transition:none}}
</style>