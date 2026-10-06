<template>
  <div class="manage-layout holiday-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">จัดการวันหยุดพิเศษ</h1>
        <p class="page-subtitle">วันหยุดที่เปิดใช้งานจะแสดงสีเดียวกับวันเสาร์อาทิตย์ในหลักฐานการรับเงิน</p>
      </div>
    </div>

    <section class="card holiday-form-card">
      <h2>{{ editingId ? 'แก้ไขวันหยุด' : 'เพิ่มวันหยุด' }}</h2>
      <p class="scope-note">{{ currentUser?.court_code ? 'รายการใหม่จะใช้กับศาลของคุณ' : 'รายการใหม่จะใช้กับทุกศาล' }}</p>
      <form class="holiday-form" @submit.prevent="saveHoliday">
        <div class="input-group">
          <label for="holiday-date">วันที่</label>
          <input id="holiday-date" v-model="form.holiday_date" type="date" required>
        </div>
        <div class="input-group holiday-name">
          <label for="holiday-name">ชื่อวันหยุด</label>
          <input id="holiday-name" v-model.trim="form.name" type="text" maxlength="255" required placeholder="เช่น วันหยุดพิเศษประจำจังหวัด">
        </div>
        <div class="input-group">
          <label for="holiday-status">สถานะ</label>
          <select id="holiday-status" v-model="form.status">
            <option value="ใช้งาน">ใช้งาน</option>
            <option value="ระงับ">ระงับ</option>
          </select>
        </div>
        <div class="form-actions">
          <button class="btn-primary" type="submit" :disabled="isSaving">{{ isSaving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มวันหยุด' }}</button>
          <button v-if="editingId" class="btn-secondary" type="button" @click="resetForm">ยกเลิก</button>
        </div>
      </form>
    </section>

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
                <td>{{ holiday.court_code ? 'เฉพาะศาล' : 'ทั่วประเทศ' }}</td>
                <td><span class="status-badge" :class="holiday.status === 'ใช้งาน' ? 'active' : 'inactive'">{{ holiday.status }}</span></td>
                <td>
                  <div v-if="holiday.editable" class="action-buttons">
                    <button type="button" class="btn-icon edit" title="แก้ไข" @click="editHoliday(holiday)">✏️</button>
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
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import api from '../services/api'
import { currentUser } from '../services/session'
import { swalConfirm, swalError, swalSuccess } from '../utils/swal'

const holidays = ref([])
const isLoading = ref(false)
const isSaving = ref(false)
const editingId = ref(null)
const emptyForm = () => ({ name: '', holiday_date: '', status: 'ใช้งาน' })
const form = ref(emptyForm())

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
}

const editHoliday = holiday => {
  editingId.value = holiday.id
  form.value = { name: holiday.name, holiday_date: holiday.holiday_date, status: holiday.status }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const saveHoliday = async () => {
  if (isSaving.value) return
  isSaving.value = true
  try {
    if (editingId.value) {
      await api.put(`/duties/holidays/${editingId.value}`, form.value)
    } else {
      await api.post('/duties/holidays', form.value)
    }
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
    if (editingId.value === holiday.id) resetForm()
    await loadHolidays()
    swalSuccess('ลบสำเร็จ', 'ลบวันหยุดเรียบร้อยแล้ว')
  } catch (error) {
    swalError('ลบไม่สำเร็จ', error.response?.data?.message || 'ไม่สามารถลบวันหยุดได้')
  }
}

onMounted(loadHolidays)
</script>

<style scoped>
.holiday-form-card { padding: 24px; margin-bottom: 24px; }
.holiday-form-card h2 { margin: 0 0 4px; font-size: 18px; }
.scope-note { margin: 0 0 20px; color: #6b7280; font-size: 14px; }
.holiday-form { display: flex; flex-wrap: wrap; align-items: end; gap: 16px; }
.holiday-form .input-group { min-width: 170px; }
.holiday-form .holiday-name { flex: 1 1 280px; }
.holiday-form input, .holiday-form select { width: 100%; box-sizing: border-box; }
.form-actions { display: flex; gap: 8px; }
.readonly-label { color: #6b7280; font-size: 13px; }
@media (max-width: 720px) {
  .holiday-form .input-group, .form-actions, .form-actions button { width: 100%; }
}
</style>
