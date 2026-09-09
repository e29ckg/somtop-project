<template>
  <div class="manage-layout">
    <!-- Header -->
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">จัดการวาระการทำงาน</h1>
        <p class="page-subtitle">เพิ่ม แก้ไข และกำหนดระยะเวลาวาระการทำงานของ พ.สมทบ</p>
      </div>
      <button class="btn-primary" @click="openAddModal">
        + เพิ่มวาระใหม่
      </button>
    </div>

    <!-- Table Section -->
    <div class="card table-card">
      <div class="table-header-actions no-print">
        <div class="items-per-page-selector">
          <label>แสดง</label>
          <select v-model="itemsPerPage" @change="currentPage = 1" class="per-page-select">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
          <label>รายการ</label>
        </div>

        <div class="search-box">
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="🔍 ค้นหารุ่น หรือปี พ.ศ. ..." 
            class="search-input" 
          />
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>รุ่นที่ (วาระ)</th>
              <th>ตั้งแต่วันที่เริ่มต้น</th>
              <th>วันหมดวาระ</th>
              <th>หมายเหตุ</th>
              <th width="120">สถานะ</th>
              <th width="120" class="no-print text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="6" class="text-center py-8">
                <div class="loading-spinner"></div>
                <div class="text-muted mt-2">กำลังดึงข้อมูล...</div>
              </td>
            </tr>
            <template v-else>
              <tr v-for="term in paginatedList" :key="term.id" class="data-row">
                <td class="font-bold" style="color: #111827;">{{ term.generation_name }}</td>
                <td>{{ formatThaiDate(term.start_date) }}</td>
                <td>{{ formatThaiDate(term.end_date) }}</td>
                <td class="text-muted">{{ term.note || '-' }}</td>
                <td>
                  <span class="status-badge" :class="getStatusClass(term.status)">
                    {{ term.status }}
                  </span>
                </td>
                <td class="no-print text-center">
                  <div class="action-buttons justify-center">
                    <button class="btn-icon edit" @click="openEditModal(term)" title="แก้ไข">✏️</button>
                    <button class="btn-icon delete" @click="deleteData(term.id)" title="ลบ">🗑️</button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredList.length === 0">
                <td colspan="6" class="text-center text-muted">ไม่พบข้อมูลที่ค้นหา</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination-container no-print" v-if="filteredList.length > 0">
        <div class="pagination-info">
          แสดง {{ (currentPage - 1) * itemsPerPage + 1 }} ถึง 
          {{ Math.min(currentPage * itemsPerPage, filteredList.length) }} 
          จากทั้งหมด {{ filteredList.length }} รายการ
        </div>
        <div class="pagination-buttons">
          <button class="page-btn" :disabled="currentPage === 1" @click="changePage(currentPage - 1)">&laquo;</button>
          <button v-for="page in totalPages" :key="page" class="page-btn" :class="{ 'active': currentPage === page }" @click="changePage(page)">{{ page }}</button>
          <button class="page-btn" :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">&raquo;</button>
        </div>
      </div>
    </div>

    <!-- Modal Form -->
    <div v-if="isModalOpen" class="modal-overlay no-print">
      <div class="modal-card" style="max-width: 500px;">
        <div class="modal-header">
          <h2>{{ isEditing ? 'แก้ไขข้อมูลวาระการทำงาน' : 'เพิ่มวาระการทำงานใหม่' }}</h2>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        
        <form @submit.prevent="saveData" class="form-grid">
          
          <div class="input-group full-width">
            <label>รุ่นที่ (ชื่อวาระ) <span style="color: #DC2626;">*</span></label>
            <input type="text" v-model="formData.generation_name" required placeholder="เช่น รุ่นที่ 1, วาระปี 2567-2570" />
          </div>

          <div class="input-group">
            <label>ตั้งแต่วันที่เริ่มต้น <span style="color: #DC2626;">*</span></label>
            <div class="date-inputs">
              <select v-model="formData.start_day" required>
                <option value="">วัน</option>
                <option v-for="day in days" :key="day" :value="day">{{ parseInt(day) }}</option>
              </select>
              <select v-model="formData.start_month" required>
                <option value="">เดือน</option>
                <option v-for="month in thaiMonths" :key="month.value" :value="month.value">{{ month.label }}</option>
              </select>
              <select v-model="formData.start_year" required>
                <option value="">ปี</option>
                <option v-for="year in termYears" :key="year.value" :value="year.value">{{ year.label }}</option>
              </select>
            </div>
          </div>

          <div class="input-group">
            <label>วันหมดวาระ <span style="color: #DC2626;">*</span></label>
            <div class="date-inputs">
              <select v-model="formData.end_day" required>
                <option value="">วัน</option>
                <option v-for="day in days" :key="day" :value="day">{{ parseInt(day) }}</option>
              </select>
              <select v-model="formData.end_month" required>
                <option value="">เดือน</option>
                <option v-for="month in thaiMonths" :key="month.value" :value="month.value">{{ month.label }}</option>
              </select>
              <select v-model="formData.end_year" required>
                <option value="">ปี</option>
                <option v-for="year in termYears" :key="year.value" :value="year.value">{{ year.label }}</option>
              </select>
            </div>
          </div>

          <div class="input-group full-width">
            <label>สถานะ</label>
            <select v-model="formData.status">
              <option value="กำลังดำรงตำแหน่ง">กำลังดำรงตำแหน่ง</option>
              <option value="หมดวาระ">หมดวาระ</option>
              <option value="ยกเลิก">ยกเลิก</option>
            </select>
          </div>

          <div class="input-group full-width">
            <label>หมายเหตุ (ถ้ามี)</label>
            <textarea v-model="formData.note" rows="2" placeholder="รายละเอียดเพิ่มเติม..."></textarea>
          </div>

          <div class="modal-actions full-width mt-4">
            <button type="button" class="btn-secondary" @click="closeModal">ยกเลิก</button>
            <button type="submit" class="btn-primary">บันทึกข้อมูล</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '../services/api' 
import { swalSuccess, swalError, swalConfirm } from '../utils/swal'

// === 1. State ===
const dataList = ref([])
const isLoading = ref(false)
const isModalOpen = ref(false)
const isEditing = ref(false)

const formData = ref({ 
  id: null, 
  generation_name: '', 
  start_day: '', start_month: '', start_year: '',
  end_day: '', end_month: '', end_year: '',
  status: 'กำลังดำรงตำแหน่ง',
  note: '' 
})

const days = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'))
const thaiMonths = [
  { value: '01', label: 'มกราคม' }, { value: '02', label: 'กุมภาพันธ์' },
  { value: '03', label: 'มีนาคม' }, { value: '04', label: 'เมษายน' },
  { value: '05', label: 'พฤษภาคม' }, { value: '06', label: 'มิถุนายน' },
  { value: '07', label: 'กรกฎาคม' }, { value: '08', label: 'สิงหาคม' },
  { value: '09', label: 'กันยายน' }, { value: '10', label: 'ตุลาคม' },
  { value: '11', label: 'พฤศจิกายน' }, { value: '12', label: 'ธันวาคม' }
]
const currentYear = new Date().getFullYear()
const termYears = Array.from({ length: 15 }, (_, index) => {
  const value = String(currentYear - 5 + index)
  return { value, label: String(Number(value) + 543) }
})

// === 2. ระบบค้นหา & แบ่งหน้า ===
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)

const filteredList = computed(() => {
  if (!searchQuery.value) return dataList.value;
  const q = searchQuery.value.toLowerCase()
  return dataList.value.filter(item => item.generation_name.toLowerCase().includes(q));
})

const totalPages = computed(() => Math.ceil(filteredList.value.length / itemsPerPage.value) || 1)
const paginatedList = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  return filteredList.value.slice(startIndex, startIndex + itemsPerPage.value);
})
const changePage = (page) => { if (page >= 1 && page <= totalPages.value) currentPage.value = page; }
watch(searchQuery, () => currentPage.value = 1);

// === 3. ฟังก์ชันจัดรูปแบบข้อมูล ===
const formatThaiDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const result = date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  return result !== 'Invalid Date' ? result : '-';
}

const getStatusClass = (status) => {
  if (status === 'กำลังดำรงตำแหน่ง') return 'active';
  if (status === 'ยกเลิก') return 'inactive';
  if (status === 'หมดวาระ') return 'warning';
  return '';
}

// === 4. ฟังก์ชัน API ===
const fetchData = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/working-terms') 
    dataList.value = response.data.records || []
  } catch (error) {
    console.error("ดึงข้อมูลไม่สำเร็จ:", error)
  } finally {
    isLoading.value = false
  }
}

const saveData = async () => {
  const startDate = `${formData.value.start_year}-${formData.value.start_month}-${formData.value.start_day}`
  const endDate = `${formData.value.end_year}-${formData.value.end_month}-${formData.value.end_day}`

  // ตรวจสอบวันหมดวาระ ต้องไม่น้อยกว่าวันที่เริ่มต้น
  if (new Date(endDate) < new Date(startDate)) {
    swalError('ข้อมูลไม่ถูกต้อง', 'วันหมดวาระ ต้องอยู่หลังวันที่เริ่มต้น');
    return;
  }

  try {
    const payload = {
      id: formData.value.id,
      generation_name: formData.value.generation_name,
      start_date: startDate,
      end_date: endDate,
      status: formData.value.status,
      note: formData.value.note
    };
    
    if (isEditing.value) {
      await api.put(`/working-terms/${payload.id}`, payload)
      swalSuccess('บันทึกสำเร็จ', 'อัปเดตข้อมูลวาระเรียบร้อย')
    } else {
      await api.post('/working-terms', payload)
      swalSuccess('บันทึกสำเร็จ', 'เพิ่มวาระใหม่เรียบร้อย')
    }
    closeModal()
    fetchData()
  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้')
  }
}

const deleteData = async (id) => {
  const result = await swalConfirm('ยืนยันการลบ', 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลวาระนี้?')
  if(result.isConfirmed) {
    try {
      await api.delete(`/working-terms/${id}`)
      swalSuccess('ลบสำเร็จ', 'ลบข้อมูลเรียบร้อยแล้ว')
      fetchData()
    } catch (error) {
      swalError('ลบข้อมูลไม่สำเร็จ', error.response?.data?.message || 'ไม่สามารถลบข้อมูลได้')
    }
  }
}

// === 5. ฟังก์ชันควบคุม Modal ===
const openAddModal = () => {
  isEditing.value = false
  formData.value = { 
    id: null, generation_name: '',
    start_day: '', start_month: '', start_year: '',
    end_day: '', end_month: '', end_year: '',
    status: 'กำลังดำรงตำแหน่ง', note: '' 
  }
  isModalOpen.value = true
}

const openEditModal = (item) => {
  isEditing.value = true
  
  const splitDate = (dateStr) => {
    const [year = '', month = '', day = ''] = (dateStr || '').split('T')[0].split('-')
    return { day, month, year }
  }
  const startDate = splitDate(item.start_date)
  const endDate = splitDate(item.end_date)
  
  formData.value = { 
    id: item.id, 
    generation_name: item.generation_name, 
    start_day: startDate.day,
    start_month: startDate.month,
    start_year: startDate.year,
    end_day: endDate.day,
    end_month: endDate.month,
    end_year: endDate.year,
    status: item.status || 'กำลังดำรงตำแหน่ง',
    note: item.note || '' 
  }
  isModalOpen.value = true
}

const closeModal = () => isModalOpen.value = false

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.justify-center {
  justify-content: center;
}
/* ดีไซน์อื่นๆ ดึงมาจาก Global Styles (manage-layout, btn-primary, status-badge, ฯลฯ) ที่มีอยู่แล้ว */
</style>