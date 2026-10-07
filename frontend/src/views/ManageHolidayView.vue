<template>
  <div class="manage-layout holiday-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">จัดการวันหยุดพิเศษ</h1>
        <p class="page-subtitle">วันหยุดที่เปิดใช้งานจะแสดงสีเดียวกับวันเสาร์อาทิตย์ในหลักฐานการรับเงิน</p>
      </div>
      <button class="btn-primary" type="button" @click="openAddModal">+ เพิ่มวันหยุดพิเศษ</button>
    </div>

    <section class="card table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>วันที่</th><th>ชื่อวันหยุด</th><th>ขอบเขต</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
          <tbody>
            <tr v-if="isLoading"><td colspan="5" class="text-center">กำลังโหลดข้อมูล...</td></tr>
            <template v-else>
              <tr v-for="holiday in holidays" :key="holiday.id">
                <td>{{ formatDate(holiday.holiday_date) }}</td>
                <td>{{ holiday.name }}</td>
                <td>{{ holiday.court_code ? `เฉพาะศาล ${holiday.court_code.toUpperCase()}` : 'ทั่วประเทศ' }}</td>
                <td><span class="status-badge" :class="holiday.status === 'ใช้งาน' ? 'active' : 'inactive'">{{ holiday.status }}</span></td>
                <td>
                  <div v-if="holiday.editable" class="action-buttons">
                    <button type="button" class="btn-icon edit" title="แก้ไข" @click="openEditModal(holiday)">✏️</button>
                    <button type="button" class="btn-icon delete" title="ลบ" @click="deleteHoliday(holiday)">🗑️</button>
                  </div>
                  <span v-else class="readonly-label">ดูได้อย่างเดียว</span>
                </td>
              </tr>
              <tr v-if="!holidays.length"><td colspan="5" class="text-center">ยังไม่มีวันหยุดที่บันทึกไว้</td></tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="isModalOpen" class="modal-overlay no-print" @click.self="closeModal" @keydown.esc="closeModal">
      <div class="modal-card holiday-modal" role="dialog" aria-modal="true" aria-labelledby="holiday-modal-title">
        <div class="modal-header">
          <h2 id="holiday-modal-title">{{ editingId ? 'แก้ไขวันหยุดพิเศษ' : 'เพิ่มวันหยุดพิเศษ' }}</h2>
          <button class="close-btn" type="button" aria-label="ปิด" :disabled="isSaving" @click="closeModal">✕</button>
        </div>
        <p v-if="!isCentralAdmin" class="scope-note">รายการนี้ใช้กับศาลของคุณ</p>
        <form class="form-grid" @submit.prevent="saveHoliday">
          <div v-if="isCentralAdmin" class="input-group full-width">
            <label for="holiday-scope">ขอบเขตวันหยุด</label>
            <select id="holiday-scope" v-model="form.scope">
              <option value="national">ทั่วประเทศ</option>
              <option value="court" :disabled="!activeCourtCode">เฉพาะศาลที่เลือก{{ activeCourtCode ? ` (${activeCourtCode.toUpperCase()})` : '' }}</option>
            </select>
          </div>
          <div class="input-group full-width">
            <label id="holiday-date-label">วันที่</label>
            <div class="holiday-date-inputs" role="group" aria-labelledby="holiday-date-label">
              <select ref="dateInput" v-model="dateParts.day" aria-label="วัน" required>
                <option value="" disabled>วัน</option>
                <option v-for="day in days" :key="day" :value="day">{{ Number(day) }}</option>
              </select>
              <select v-model="dateParts.month" aria-label="เดือน" required>
                <option value="" disabled>เดือน</option>
                <option v-for="month in thaiMonths" :key="month.value" :value="month.value">{{ month.label }}</option>
              </select>
              <select v-model="dateParts.year" aria-label="ปี พ.ศ." required>
                <option value="" disabled>ปี พ.ศ.</option>
                <option v-for="year in buddhistYears" :key="year" :value="year">{{ year }}</option>
              </select>
            </div>
          </div>
          <div class="input-group full-width">
            <label for="holiday-name">ชื่อวันหยุด</label>
            <input id="holiday-name" v-model.trim="form.name" type="text" maxlength="255" required placeholder="เช่น วันหยุดพิเศษประจำจังหวัด">
          </div>
          <div class="input-group full-width">
            <label for="holiday-status">สถานะ</label>
            <select id="holiday-status" v-model="form.status">
              <option value="ใช้งาน">ใช้งาน</option>
              <option value="ระงับ">ระงับ</option>
            </select>
          </div>
          <div class="modal-actions full-width">
            <button class="btn-secondary" type="button" :disabled="isSaving" @click="closeModal">ยกเลิก</button>
            <button class="btn-primary" type="submit" :disabled="isSaving">{{ isSaving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มวันหยุด' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import api from '../services/api'
import { activeCourtCode, isCentralAdmin } from '../services/session'
import { swalConfirm, swalError, swalSuccess } from '../utils/swal'

const holidays = ref([])
const isLoading = ref(false)
const isSaving = ref(false)
const isModalOpen = ref(false)
const dateInput = ref(null)
const editingId = ref(null)
const emptyForm = () => ({ name: '', status: 'ใช้งาน', scope: isCentralAdmin.value ? 'national' : 'court' })
const form = ref(emptyForm())
const dateParts = ref({ day: '', month: '', year: '' })
const thaiMonths = [
  { value: '01', label: 'มกราคม' }, { value: '02', label: 'กุมภาพันธ์' },
  { value: '03', label: 'มีนาคม' }, { value: '04', label: 'เมษายน' },
  { value: '05', label: 'พฤษภาคม' }, { value: '06', label: 'มิถุนายน' },
  { value: '07', label: 'กรกฎาคม' }, { value: '08', label: 'สิงหาคม' },
  { value: '09', label: 'กันยายน' }, { value: '10', label: 'ตุลาคม' },
  { value: '11', label: 'พฤศจิกายน' }, { value: '12', label: 'ธันวาคม' }
]
const buddhistYears = computed(() => {
  const currentYear = new Date().getFullYear() + 543
  const selectedYear = Number(dateParts.value.year) || currentYear
  const firstYear = Math.max(currentYear + 10, selectedYear)
  const lastYear = Math.min(currentYear - 30, selectedYear)
  return Array.from({ length: firstYear - lastYear + 1 }, (_, index) => String(firstYear - index))
})
const days = computed(() => {
  const { month, year } = dateParts.value
  const maxDay = month && year ? new Date(Number(year) - 543, Number(month), 0).getDate() : 31
  return Array.from({ length: maxDay }, (_, index) => String(index + 1).padStart(2, '0'))
})

watch(() => [dateParts.value.month, dateParts.value.year], () => {
  if (dateParts.value.day && !days.value.includes(dateParts.value.day)) dateParts.value.day = ''
})

const formatDate = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('th-TH', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
})

const loadHolidays = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/duties/holidays')
    holidays.value = response.data.records || []
  } catch (error) {
    swalError('โหลดวันหยุดไม่สำเร็จ', error.response?.data?.message || 'ไม่สามารถโหลดข้อมูลได้')
  } finally {
    isLoading.value = false
  }
}

const resetForm = () => {
  editingId.value = null
  form.value = emptyForm()
  dateParts.value = { day: '', month: '', year: '' }
}

const openAddModal = () => {
  resetForm()
  isModalOpen.value = true
  nextTick(() => dateInput.value?.focus())
}

const openEditModal = holiday => {
  editingId.value = holiday.id
  form.value = { name: holiday.name, status: holiday.status, scope: holiday.court_code ? 'court' : 'national' }
  const [year, month, day] = holiday.holiday_date.split('-')
  dateParts.value = { day, month, year: String(Number(year) + 543) }
  isModalOpen.value = true
  nextTick(() => dateInput.value?.focus())
}

const closeModal = () => {
  if (isSaving.value) return
  isModalOpen.value = false
  resetForm()
}

const saveHoliday = async () => {
  if (isSaving.value) return
  const { day, month, year } = dateParts.value
  const gregorianYear = Number(year) - 543
  const holidayDate = `${gregorianYear}-${month}-${day}`
  if (!day || !month || !year || !days.value.includes(day)) {
    swalError('วันที่ไม่ถูกต้อง', 'กรุณาเลือกวัน เดือน และปี พ.ศ. ให้ถูกต้อง')
    return
  }
  isSaving.value = true
  try {
    const payload = { ...form.value, holiday_date: holidayDate }
    if (editingId.value) {
      await api.put(`/duties/holidays/${editingId.value}`, payload)
    } else {
      await api.post('/duties/holidays', payload)
    }
    isModalOpen.value = false
    resetForm()
    await loadHolidays()
    swalSuccess('บันทึกสำเร็จ', 'ข้อมูลวันหยุดพร้อมใช้งาน')
  } catch (error) {
    swalError('บันทึกไม่สำเร็จ', error.response?.data?.message || 'ไม่สามารถบันทึกวันหยุดได้')
  } finally {
    isSaving.value = false
  }
}

const deleteHoliday = async holiday => {
  const result = await swalConfirm('ยืนยันการลบวันหยุด', `${holiday.name} (${formatDate(holiday.holiday_date)})`)
  if (!result.isConfirmed) return
  try {
    await api.delete(`/duties/holidays/${holiday.id}`)
    await loadHolidays()
    swalSuccess('ลบสำเร็จ', 'ลบวันหยุดเรียบร้อยแล้ว')
  } catch (error) {
    swalError('ลบไม่สำเร็จ', error.response?.data?.message || 'ไม่สามารถลบวันหยุดได้')
  }
}

onMounted(loadHolidays)
</script>

<style scoped>
.holiday-modal { max-width: 500px; }
.holiday-date-inputs { display: grid; grid-template-columns: 0.8fr 1.5fr 1fr; gap: 8px; }
.scope-note { margin: 0 0 20px; color: #6b7280; font-size: 14px; }
.readonly-label { color: #6b7280; font-size: 13px; }
@media (max-width: 480px) {
  .holiday-date-inputs { grid-template-columns: 1fr; }
}
</style>
