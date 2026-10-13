<template>
  <div class="swap-history">
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">ประวัติการเปลี่ยนเวร</h1>
        <p class="subtitle">รายการเปลี่ยนเวรปฏิบัติหน้าที่แยกตามเดือนที่เข้าเวร</p>
      </div>
    </div>

    <div class="toolbar no-print">
      <label for="swap-month">เดือนที่ปฏิบัติหน้าที่</label>
      <input id="swap-month" v-model="selectedMonth" type="month" />
      <button type="button" class="print-button" :disabled="isLoading || !records.length" @click="windowPrint">พิมพ์รายงาน</button>
    </div>

    <section class="history-card">
      <div class="report-heading">
        <h2>รายงานประวัติการเปลี่ยนเวรปฏิบัติหน้าที่</h2>
        <p>ประจำเดือน {{ monthTitle }}</p>
      </div>

      <p v-if="isLoading" class="state-message">กำลังโหลดข้อมูล...</p>
      <p v-else-if="errorMessage" class="state-message error" role="alert">{{ errorMessage }}</p>
      <p v-else-if="!records.length" class="state-message">ไม่พบรายการเปลี่ยนเวรในเดือนนี้</p>
      <div v-else class="table-scroll">
        <table class="history-table">
          <thead>
            <tr>
              <th>วันที่ปฏิบัติหน้าที่</th>
              <th>ประเภทเวร</th>
              <th>สถานที่</th>
              <th>ผู้เข้าเวรตามตารางเดิม</th>
              <th>ผู้ปฏิบัติหน้าที่แทน</th>
              <th>เหตุผล</th>
              <th>วันที่ขอเปลี่ยน</th>
              <th class="no-print">เอกสาร</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in records" :key="record.id">
              <td>{{ formatThaiDate(record.duty_date) }}<small v-if="record.order_number">คำสั่ง {{ record.order_number }}</small></td>
              <td>{{ record.duty_type_name || '—' }}</td>
              <td>{{ record.court_name || '—' }}</td>
              <td>{{ record.requester_name }}</td>
              <td>{{ record.replacement_name }}</td>
              <td>{{ record.reason }}</td>
              <td>{{ formatThaiDate(record.request_date) }}</td>
              <td class="no-print"><button type="button" class="download-button" :disabled="downloadingId === record.id" @click="downloadWord(record)">ดาวน์โหลดใบเปลี่ยนเวร</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!isLoading && !errorMessage && records.length" class="record-count">รวม {{ records.length }} รายการ</p>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import api from '../services/api'
import { swalError } from '../utils/swal'

const selectedMonth = ref(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }).slice(0, 7))
const records = ref([])
const isLoading = ref(false)
const errorMessage = ref('')
const downloadingId = ref(null)
let requestId = 0

const monthTitle = computed(() => {
  const [year, month] = selectedMonth.value.split('-').map(Number)
  if (!year || !month) return '—'
  return new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
})

const formatThaiDate = value => {
  if (!value) return '—'
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return '—'
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))
}

const loadHistory = async month => {
  const currentRequest = ++requestId
  records.value = []
  errorMessage.value = ''
  if (!month) {
    isLoading.value = false
    return
  }
  isLoading.value = true
  try {
    const { data } = await api.get('/duties/swaps', { params: { month } })
    if (currentRequest === requestId) records.value = data.records || []
  } catch (error) {
    if (currentRequest === requestId) errorMessage.value = error.response?.data?.message || 'ไม่สามารถโหลดประวัติการเปลี่ยนเวรได้'
  } finally {
    if (currentRequest === requestId) isLoading.value = false
  }
}

const downloadWord = async record => {
  downloadingId.value = record.id
  try {
    const { data } = await api.get(`/duties/swaps/${record.id}/export-word`, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = `ใบเปลี่ยนเวร_${record.id}.docx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch {
    swalError('ดาวน์โหลดไม่สำเร็จ', 'ไม่สามารถดาวน์โหลดใบเปลี่ยนเวรได้')
  } finally {
    downloadingId.value = null
  }
}

const windowPrint = () => window.print()
watch(selectedMonth, loadHistory, { immediate: true })
</script>

<style scoped>
.subtitle { margin: 5px 0 0; color: #64748b; }
.toolbar { display: flex; align-items: center; gap: 12px; margin: 18px 0; flex-wrap: wrap; }
.toolbar label { font-weight: 600; }
.toolbar input { padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; }
.print-button, .download-button { border: 1px solid #0f766e; background: #0f766e; color: white; padding: 9px 12px; border-radius: 8px; cursor: pointer; font: inherit; }
.download-button { white-space: nowrap; font-size: 13px; padding: 7px 9px; }
button:disabled { opacity: .55; cursor: not-allowed; }
.history-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
.report-heading { text-align: center; margin-bottom: 18px; }
.report-heading h2 { margin: 0; font-size: 20px; }
.report-heading p { margin: 5px 0 0; }
.table-scroll { overflow-x: auto; }
.history-table { width: 100%; border-collapse: collapse; min-width: 980px; }
.history-table th, .history-table td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; vertical-align: top; }
.history-table th { background: #f8fafc; white-space: nowrap; }
.history-table small { display: block; color: #64748b; margin-top: 4px; }
.state-message { padding: 28px; text-align: center; color: #64748b; }
.state-message.error { color: #b91c1c; }
.record-count { margin: 14px 0 0; text-align: right; font-weight: 600; }
@media print {
  .history-card { border: 0; padding: 0; }
  .table-scroll { overflow: visible; }
  .history-table { min-width: 0; font-size: 10px; }
  .history-table th, .history-table td { padding: 5px; border-color: #888; }
}
</style>
