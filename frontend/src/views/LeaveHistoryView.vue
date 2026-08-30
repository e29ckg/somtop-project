<template>
  <div class="manage-layout">
    <!-- Header Section -->
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">ประวัติการลา</h1>
        <p class="page-subtitle">ข้อมูลการขอลาพักปฏิบัติหน้าที่ของผู้พิพากษาสมทบ</p>
      </div>
      <button class="btn-primary" @click="openAddModal">
        + ยื่นเรื่องขอลา
      </button>
    </div>

    <!-- แถบเครื่องมือค้นหาและพิมพ์รายงาน -->
    <div class="card filter-card no-print">
      <div class="filter-controls">
        <div class="filter-group">
          <label>ค้นหาด้วยชื่อ-สกุล</label>
          <input type="text" v-model="filters.name" placeholder="ระบุชื่อ พ.สมทบ..." />
        </div>
        
        <div class="filter-group date-filter-group">
          <label>ตั้งแต่</label>
          <div class="date-inputs">
            <select v-model="filters.start_day">
              <option value="">วัน</option>
              <option v-for="d in days" :key="d" :value="d">{{ parseInt(d) }}</option>
            </select>
            <select v-model="filters.start_month">
              <option value="">เดือน</option>
              <option v-for="m in thaiMonths" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
            <select v-model="filters.start_year">
              <option value="">ปี</option>
              <option v-for="y in thaiYears" :key="y.value" :value="y.value">{{ y.label }}</option>
            </select>
          </div>
        </div>

        <div class="filter-group date-filter-group">
          <label>ถึง</label>
          <div class="date-inputs">
            <select v-model="filters.end_day">
              <option value="">วัน</option>
              <option v-for="d in days" :key="d" :value="d">{{ parseInt(d) }}</option>
            </select>
            <select v-model="filters.end_month">
              <option value="">เดือน</option>
              <option v-for="m in thaiMonths" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
            <select v-model="filters.end_year">
              <option value="">ปี</option>
              <option v-for="y in thaiYears" :key="y.value" :value="y.value">{{ y.label }}</option>
            </select>
          </div>
        </div>

        <div class="filter-actions">
          <button class="btn-secondary" @click="clearFilters">ล้างค่า</button>
          <button class="btn-primary print-btn" @click="printReport">
            🖨️ พิมพ์รายงาน
          </button>
        </div>
      </div>
    </div>

    <!-- Data Table Section -->
    <div class="card table-card print-area">
      
      <!-- แถบควบคุม: เลือกจำนวนรายการ -->
      <div class="table-header-actions no-print">
        <div class="items-per-page-selector">
          <label>แสดง</label>
          <select v-model="itemsPerPage" @change="currentPage = 1" class="per-page-select">
            <option :value="5">5</option>
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
          <label>รายการ</label>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>วันที่ยื่นเรื่อง</th>
              <th>ชื่อ-สกุล (พ.สมทบ)</th>
              <th>ประเภทการลา</th>
              <th>ช่วงเวลาที่ลา</th>
              <th>จำนวนวัน</th>
              <th>สถานะ</th>
              <th class="no-print">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="7" class="text-center py-8">
                <div class="loading-spinner"></div>
                <div class="text-muted mt-2">กำลังดึงข้อมูลจากเซิร์ฟเวอร์...</div>
              </td>
            </tr>
            <template v-else>
              <tr v-for="(leave, index) in paginatedLeaveList" :key="index" class="data-row">
                <td class="font-mono">{{ formatThaiDateFull(leave.submit_date) }}</td>
                <td>
                  <div class="full-name">{{ leave.full_name }}</div>
                </td>
                <td>{{ leave.leave_type_name || leave.leave_type }}</td>
                <td>{{ formatThaiDateShort(leave.start_date) }} - {{ formatThaiDateShort(leave.end_date) }}</td>
                <td class="font-mono text-center">
                  {{ leave.total_days % 1 === 0 ? parseInt(leave.total_days) : leave.total_days }}
                </td>
                <td>
                  <span class="status-badge" :class="getStatusClass(leave.status)">
                    {{ leave.status }}
                  </span>
                </td>
                <td class="no-print">
                  <div class="action-buttons">
                    <button v-if="leave.file_path" @click="openPdfPreview(leave.file_path)" class="btn-icon" title="ดูไฟล์แนบ">📎</button>
                    <button class="btn-icon edit" @click="openEditModal(leave)" title="แก้ไข">✏️</button>
                    <button class="btn-icon delete" @click="deleteData(leave.id)" title="ลบ">🗑️</button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredLeaveList.length === 0">
                <td colspan="7" class="text-center text-muted">ไม่พบข้อมูลการลาที่ค้นหา</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- ระบบแบ่งหน้า (Pagination) -->
      <div class="pagination-container no-print" v-if="filteredLeaveList.length > 0">
        <div class="pagination-info">
          แสดง {{ (currentPage - 1) * itemsPerPage + 1 }} ถึง 
          {{ Math.min(currentPage * itemsPerPage, filteredLeaveList.length) }} 
          จากทั้งหมด {{ filteredLeaveList.length }} รายการ
        </div>
        
        <div class="pagination-buttons">
          <button class="page-btn" :disabled="currentPage === 1" @click="changePage(currentPage - 1)">
            &laquo; ก่อนหน้า
          </button>
          <button 
            v-for="page in totalPages" :key="page" 
            class="page-btn" :class="{ 'active': currentPage === page }"
            @click="changePage(page)">
            {{ page }}
          </button>
          <button class="page-btn" :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">
            ถัดไป &raquo;
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Form (สำหรับยื่นเรื่อง/ดูข้อมูล) -->
    <div v-if="isModalOpen" class="modal-overlay no-print">
      <div class="modal-card">
        <div class="modal-header">
          <h2>{{ isEditing ? 'รายละเอียดการลา' : 'แบบฟอร์มยื่นเรื่องขอลา' }}</h2>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        
        <form @submit.prevent="saveData" class="form-grid">
          
          <div class="input-group full-width searchable-select">
            <label>ชื่อ-สกุล (ผู้ขอลา)</label>
            <input 
              type="text" 
              v-model="somtopSearchQuery" 
              @focus="isSomtopDropdownOpen = true" 
              @blur="closeSomtopDropdown" 
              placeholder="พิมพ์เพื่อค้นหารายชื่อ..." 
              required
            />
            <ul v-if="isSomtopDropdownOpen" class="search-dropdown">
              <li 
                v-for="person in filteredSomtopList" 
                :key="person.id" 
                @mousedown.prevent="selectSomtop(person)"
              >
                {{ person.full_name }}
              </li>
              <li v-if="filteredSomtopList.length === 0" class="no-results">
                ไม่พบรายชื่อที่ค้นหา
              </li>
            </ul>
          </div>
          
          <div class="input-group full-width">
            <label>ประเภทการลา</label>
            <select v-model="formData.leave_type_id" required>
              <option value="" disabled>-- เลือกประเภทการลา --</option>
              <option v-for="type in leaveTypes" :key="type.id" :value="type.id">
                {{ type.name }}
              </option>
            </select>
          </div>

          <div class="input-group">
            <label>วันที่เริ่มต้น</label>
            <div class="date-inputs">
              <select v-model="formData.start_day" @change="calculateDays" required>
                <option value="">วัน</option>
                <option v-for="d in days" :key="d" :value="d">{{ parseInt(d) }}</option>
              </select>
              <select v-model="formData.start_month" @change="calculateDays" required>
                <option value="">เดือน</option>
                <option v-for="m in thaiMonths" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
              <select v-model="formData.start_year" @change="calculateDays" required>
                <option value="">ปี</option>
                <option v-for="y in thaiYears" :key="y.value" :value="y.value">{{ y.label }}</option>
              </select>
            </div>
          </div>

          <div class="input-group">
            <label>วันที่สิ้นสุด</label>
            <div class="date-inputs">
              <select v-model="formData.end_day" @change="calculateDays" required>
                <option value="">วัน</option>
                <option v-for="d in days" :key="d" :value="d">{{ parseInt(d) }}</option>
              </select>
              <select v-model="formData.end_month" @change="calculateDays" required>
                <option value="">เดือน</option>
                <option v-for="m in thaiMonths" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
              <select v-model="formData.end_year" @change="calculateDays" required>
                <option value="">ปี</option>
                <option v-for="y in thaiYears" :key="y.value" :value="y.value">{{ y.label }}</option>
              </select>
            </div>
          </div>
          
          <div class="input-group">
  <label>จำนวนวันลา</label>
  <input 
    type="number" 
    v-model="formData.total_days" 
    step="0.5" 
    min="0" 
    required 
    @blur="formData.total_days = formData.total_days % 1 === 0 ? parseInt(formData.total_days) : parseFloat(formData.total_days)"
  />
</div>

          <div class="input-group">
            <label>สถานะการอนุมัติ</label>
            <select v-model="formData.status" :disabled="!isEditing">
              <option value="รอตรวจสอบ">รอตรวจสอบ</option>
              <option value="อนุมัติแล้ว">อนุมัติแล้ว</option>
              <option value="ไม่อนุมัติ">ไม่อนุมัติ</option>
            </select>
          </div>

          <div class="input-group full-width">
            <label>เหตุผล/หมายเหตุ</label>
            <textarea v-model="formData.note" rows="2" placeholder="ระบุเหตุผลการลา..."></textarea>
          </div>

          <div class="input-group full-width upload-section">
            <label>แนบไฟล์ใบลา (PDF เท่านั้น)</label>
            <input type="file" accept=".pdf,application/pdf" @change="handleFileUpload" class="file-input" />
            <small v-if="isEditing && formData.existing_file_path" class="file-hint">
              มีไฟล์แนบเดิมอยู่แล้ว: <a href="#" @click.prevent="openPdfPreview(formData.existing_file_path)">ดูไฟล์ปัจจุบัน</a> 
              (หากอัปโหลดใหม่ ระบบจะลบไฟล์เก่าทิ้งอัตโนมัติ)
            </small>
          </div>

          <div class="modal-actions full-width">
            <button type="button" class="btn-secondary" @click="closeModal">ยกเลิก</button>
            <button type="submit" class="btn-primary">บันทึกข้อมูล</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal สำหรับดูไฟล์ PDF -->
    <div v-if="isPreviewOpen" class="modal-overlay no-print">
      <div class="modal-card pdf-modal">
        <div class="modal-header">
          <h2>ดูไฟล์แนบใบลา</h2>
          <button class="close-btn" @click="closePdfPreview">✕</button>
        </div>
        <div class="pdf-container">
          <iframe :src="previewUrl" width="100%" height="100%" style="border:none;"></iframe>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '../services/api'
import { swalSuccess, swalError, swalConfirm } from '../utils/swal'

const isLoading = ref(false)

const days = Array.from({length: 31}, (_, i) => String(i + 1).padStart(2, '0'))

const thaiMonths = [
  { value: '01', label: 'มกราคม' }, { value: '02', label: 'กุมภาพันธ์' },
  { value: '03', label: 'มีนาคม' }, { value: '04', label: 'เมษายน' },
  { value: '05', label: 'พฤษภาคม' }, { value: '06', label: 'มิถุนายน' },
  { value: '07', label: 'กรกฎาคม' }, { value: '08', label: 'สิงหาคม' },
  { value: '09', label: 'กันยายน' }, { value: '10', label: 'ตุลาคม' },
  { value: '11', label: 'พฤศจิกายน' }, { value: '12', label: 'ธันวาคม' }
]

const currentYear = new Date().getFullYear()
const thaiYears = Array.from({length: 15}, (_, i) => {
  const y = currentYear - 5 + i 
  return { value: String(y), label: String(y + 543) }
})

const filters = ref({
  name: '',
  start_day: '', start_month: '', start_year: '',
  end_day: '', end_month: '', end_year: ''
})

const leaveList = ref([])
const somtopList = ref([]) 
const leaveTypes = ref([]) // ⭐️ เปลี่ยนมารอรับค่าจาก Backend

const isModalOpen = ref(false)
const isEditing = ref(false)
const formData = ref({
  id: null, somtop_id: '', leave_type_id: '', 
  start_day: '', start_month: '', start_year: '',
  end_day: '', end_month: '', end_year: '',
  total_days: 0, note: '', status: 'รอตรวจสอบ', file: null, existing_file_path: ''
})

const isPreviewOpen = ref(false)
const previewUrl = ref('')

const currentPage = ref(1)
const itemsPerPage = ref(10)

const somtopSearchQuery = ref('')
const isSomtopDropdownOpen = ref(false)

const filteredSomtopList = computed(() => {
  if (!somtopSearchQuery.value) return somtopList.value;
  return somtopList.value.filter(person => 
    person.full_name.toLowerCase().includes(somtopSearchQuery.value.toLowerCase())
  );
})

const selectSomtop = (person) => {
  formData.value.somtop_id = person.id;
  somtopSearchQuery.value = person.full_name; 
  isSomtopDropdownOpen.value = false;
}

const closeSomtopDropdown = () => {
  setTimeout(() => {
    isSomtopDropdownOpen.value = false;
    if (!formData.value.somtop_id) {
      somtopSearchQuery.value = '';
    }
  }, 200); 
}

const formatThaiDate = (dateStr) => {
  if (!dateStr || dateStr === '0000-00-00') return '';
  const datePart = dateStr.split('T')[0].split(' ')[0];
  const [year, month, day] = datePart.split('-');
  const thaiYear = parseInt(year) + 543;
  return `${day}/${month}/${thaiYear}`;
}

const getFilterDateStr = (year, month, day) => {
  if (year && month && day) return `${year}-${month}-${day}`;
  return null;
}

const formatThaiDateShort = (dateStr) => {
  if (!dateStr || dateStr === '0000-00-00') return '-';
  const datePart = dateStr.split('T')[0].split(' ')[0];
  const [year, month, day] = datePart.split('-');
  const shortMonthNames = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  const thaiDay = parseInt(day);
  const thaiMonth = shortMonthNames[parseInt(month) - 1];
  const thaiYear = (parseInt(year) + 543).toString().slice(-2);
  
  return `${thaiDay} ${thaiMonth} ${thaiYear}`;
}

const formatThaiDateFull = (dateStr) => {
  if (!dateStr || dateStr === '0000-00-00') return '';
  const datePart = dateStr.split('T')[0].split(' ')[0]; // ⭐️ ป้องกัน Timestamp
  const [year, month, day] = datePart.split('-');
  const thaiYear = parseInt(year) + 543;
  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const thaiMonth = monthNames[parseInt(month) - 1];
  return `${parseInt(day)} ${thaiMonth} ${thaiYear}`;
}

const filteredLeaveList = computed(() => {
  return leaveList.value.filter(leave => {
    let matchName = true
    let matchStartDate = true
    let matchEndDate = true

    if (filters.value.name) {
      matchName = leave.full_name.toLowerCase().includes(filters.value.name.toLowerCase())
    }
    
    const filterStartStr = getFilterDateStr(filters.value.start_year, filters.value.start_month, filters.value.start_day);
    const filterEndStr = getFilterDateStr(filters.value.end_year, filters.value.end_month, filters.value.end_day);

    if (filterStartStr) {
      matchStartDate = new Date(leave.start_date) >= new Date(filterStartStr)
    }
    if (filterEndStr) {
      matchEndDate = new Date(leave.start_date) <= new Date(filterEndStr)
    }

    return matchName && matchStartDate && matchEndDate
  })
})

const totalPages = computed(() => {
  return Math.ceil(filteredLeaveList.value.length / itemsPerPage.value) || 1;
})

const paginatedLeaveList = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  return filteredLeaveList.value.slice(startIndex, startIndex + itemsPerPage.value);
})

const changePage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
}

watch(filters, () => {
  currentPage.value = 1;
}, { deep: true });

const clearFilters = () => {
  filters.value = { 
    name: '', 
    start_day: '', start_month: '', start_year: '',
    end_day: '', end_month: '', end_year: '' 
  }
}

const printReport = () => {
  const printContents = document.querySelector('.print-area').innerHTML;
  const printWindow = window.open('', '_blank', 'height=600,width=800');
  
  let headerText = '';
  const filterStartStr = getFilterDateStr(filters.value.start_year, filters.value.start_month, filters.value.start_day);
  const filterEndStr = getFilterDateStr(filters.value.end_year, filters.value.end_month, filters.value.end_day);

  if (filterStartStr || filterEndStr) {
    headerText = `<p>ช่วงเวลา: ${filterStartStr ? formatThaiDate(filterStartStr) : 'เริ่มต้น'} ถึง ${filterEndStr ? formatThaiDate(filterEndStr) : 'ปัจจุบัน'}</p>`;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>พิมพ์รายงานประวัติการลา</title>
        <style>
          body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; padding: 20px; color: #000; }
          .print-only-header { text-align: center; margin-bottom: 20px; }
          .print-only-header h2 { margin: 0; font-size: 22px; }
          .print-only-header p { margin: 5px 0 0 0; color: #555; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #000; padding: 10px; text-align: left; font-size: 14px; }
          th { background-color: #f0f0f0; font-weight: bold; }
          .status-badge { font-weight: bold; }
          .no-print { display: none !important; }
        </style>
      </head>
      <body>
        <div class="print-only-header">
          <h2>รายงานประวัติการลา - ผู้พิพากษาสมทบ</h2>
          ${headerText}
        </div>
        ${printContents}
      </body>
    </html>
  `);
  
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}


// === ฟังก์ชัน API ===
const fetchLeaves = async () => {
  isLoading.value = true;
  try {
    const response = await api.get('/leaves')
    leaveList.value = response.data.records || []
  } catch (error) {
    console.error('ดึงข้อมูลประวัติการลาไม่สำเร็จ:', error)
  } finally {
    isLoading.value = false;
  }
}

const fetchSomtopList = async () => {
  isLoading.value = true;
  try {
    const response = await api.get('/somtop')
    somtopList.value = response.data.records || []
  } catch (error) {
    console.error('ดึงข้อมูลรายชื่อไม่สำเร็จ:', error)
  } finally {
    isLoading.value = false;
  }
}

// ⭐️ ฟังก์ชันใหม่สำหรับดึงข้อมูล "ประเภทการลา" 
const fetchLeaveTypes = async () => {
  try {
    const response = await api.get('/leave-types') 
    // กรองมาเฉพาะรายการที่ Admin เปิดสถานะ "ใช้งาน"
    leaveTypes.value = response.data.records.filter(t => t.status === 'ใช้งาน') || []
  } catch (error) {
    console.error('ดึงประเภทการลาไม่สำเร็จ:', error)
  }
}

const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    if (file.type === 'application/pdf') {
      formData.value.file = file
    } else {
      swalError('ไฟล์ไม่ถูกต้อง', 'กรุณาอัปโหลดไฟล์นามสกุล .pdf เท่านั้น')
      event.target.value = '' 
      formData.value.file = null
    }
  }
}

const saveData = async () => {
  if (!formData.value.somtop_id) {
    swalError("ข้อมูลไม่ครบถ้วน", "กรุณาพิมพ์ค้นหาและคลิกเลือกชื่อ-สกุล (ผู้ขอลา) จากรายการที่ปรากฏขึ้นมา");
    return;
  }
  const start_date = getFilterDateStr(formData.value.start_year, formData.value.start_month, formData.value.start_day);
  const end_date = getFilterDateStr(formData.value.end_year, formData.value.end_month, formData.value.end_day);

  if (!start_date || !end_date) {
    swalError("ข้อมูลไม่ครบถ้วน", "กรุณาระบุวันที่เริ่มต้นและวันที่สิ้นสุดให้ครบถ้วน (วัน/เดือน/ปี)");
    return;
  }

  try {
    const payload = new FormData()
    if (formData.value.id) payload.append('id', formData.value.id)
    payload.append('somtop_id', formData.value.somtop_id)
    payload.append('leave_type_id', formData.value.leave_type_id)
    payload.append('start_date', start_date)
    payload.append('end_date', end_date)
    payload.append('total_days', formData.value.total_days)
    payload.append('note', formData.value.note)
    payload.append('status', formData.value.status)
    
    if (formData.value.file) {
      payload.append('leave_file', formData.value.file)
    }

    const config = { headers: { 'Content-Type': 'multipart/form-data' } }

    if (isEditing.value) {
      // ⭐️ เอา _method: PUT ออกตามคำแนะนำของ Node.js สามารถใช้ api.put ตรงๆ ได้เลย
      await api.put('/leaves', payload, config)
      swalSuccess('บันทึกสำเร็จ', 'อัปเดตข้อมูลและจัดการไฟล์สำเร็จแล้ว')
    } else {
      await api.post('/leaves', payload, config)
      swalSuccess('ยื่นเรื่องขอลาสำเร็จ', 'ข้อมูลการลาของคุณได้ถูกส่งเรียบร้อยแล้ว')
    }
    
    closeModal()
    fetchLeaves()
  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้')
  }
}

const deleteData = async (id) => {
  const result = await swalConfirm(
    'ยืนยันการลบข้อมูล', 
    'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลประวัติการลานี้? (ระบบจะลบไฟล์แนบด้วย)'
  )

  if (result.isConfirmed) {
    try {
      await api.delete('/leaves/' + id)
      swalSuccess('ลบข้อมูลสำเร็จ', 'ข้อมูลถูกลบออกจากระบบเรียบร้อยแล้ว')
      fetchLeaves()
    } catch (error) {
      swalError('ลบข้อมูลไม่สำเร็จ', 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์')
    }
  }
}

const openPdfPreview = (url) => {
  previewUrl.value = url
  isPreviewOpen.value = true
}

const closePdfPreview = () => {
  isPreviewOpen.value = false
  previewUrl.value = ''
}

const getStatusClass = (status) => {
  if (status === 'อนุมัติแล้ว') return 'active' 
  if (status === 'รอตรวจสอบ') return 'warning'
  if (status === 'ไม่อนุมัติ') return 'inactive' 
  return ''
}

const calculateDays = () => {
  const startStr = getFilterDateStr(formData.value.start_year, formData.value.start_month, formData.value.start_day);
  const endStr = getFilterDateStr(formData.value.end_year, formData.value.end_month, formData.value.end_day);

  if (startStr && endStr) {
    const start = new Date(startStr)
    const end = new Date(endStr)
    const diffTime = end - start
    if (diffTime >= 0) {
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 
      formData.value.total_days = diffDays
    } else {
      formData.value.total_days = 0 
    }
  }
}

const openAddModal = () => {
  isEditing.value = false
  somtopSearchQuery.value = ''
  formData.value = { 
    id: null, somtop_id: '', leave_type_id: '', 
    start_day: '', start_month: '', start_year: '',
    end_day: '', end_month: '', end_year: '',
    total_days: 0, note: '', status: 'รอตรวจสอบ', file: null, existing_file_path: '' 
  }
  isModalOpen.value = true
}

const openEditModal = (leave) => {
  isEditing.value = true
  somtopSearchQuery.value = leave.full_name
  
  let sYear = '', sMonth = '', sDay = '';
  if (leave.start_date) {
    const datePart = leave.start_date.split('T')[0].split(' ')[0];
    [sYear, sMonth, sDay] = datePart.split('-');
  }

  let eYear = '', eMonth = '', eDay = '';
  if (leave.end_date) {
    const datePart = leave.end_date.split('T')[0].split(' ')[0];
    [eYear, eMonth, eDay] = datePart.split('-');
  }

  formData.value = {
    id: leave.id, 
    somtop_id: leave.somtop_id, 
    leave_type_id: leave.leave_type_id, 
    start_year: sYear, 
    start_month: sMonth, 
    start_day: sDay,
    end_year: eYear, 
    end_month: eMonth, 
    end_day: eDay,
    total_days: leave.total_days, 
    note: leave.note, 
    status: leave.status, 
    file: null, 
    existing_file_path: leave.file_path || '' 
  }
  isModalOpen.value = true
}

const closeModal = () => isModalOpen.value = false

onMounted(() => {
  fetchLeaves()
  fetchSomtopList()
  fetchLeaveTypes() // ⭐️ สั่งให้ดึงประเภทการลาตอนโหลดหน้าเว็บ
})
</script>

<style scoped>
/* =========================================
   สไตล์เฉพาะสำหรับหน้าประวัติการลา (CSS เพิ่มเติม)
   (โครงสร้างหลักอื่นๆ จะถูกดึงมาจาก global.css)
========================================= */

/* Filter Section เฉพาะหน้านี้ */
.filter-card { margin-bottom: 24px; padding: 16px 24px; }
.filter-controls { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-end; }
.filter-group { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 200px; }
.date-filter-group { min-width: 250px; }
.filter-group label { font-size: 13px; color: #374151; font-weight: 500; }
.filter-group input, .filter-group select {
  background-color: #F9FAFB; border: 1px solid #D1D5DB; border-radius: 8px; padding: 10px 14px; 
  color: #111827; font-family: inherit; outline: none; transition: all 0.2s;
}
.filter-group input:focus, .filter-group select:focus { background-color: #FFFFFF; border-color: #10B981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1); }
.filter-actions { display: flex; gap: 12px; align-items: flex-end; }

/* Upload Section */
.upload-section { background-color: #F9FAFB; padding: 16px; border-radius: 8px; border: 1px dashed #D1D5DB; }
.file-input { background-color: transparent !important; padding: 0 !important; border: none !important; }
.file-hint { margin-top: 8px; font-size: 12px; color: #6B7280; }
.file-hint a { color: #10B981; text-decoration: underline; }

/* PDF Preview Modal */
.pdf-modal { max-width: 900px; height: 80vh; display: flex; flex-direction: column; }
.pdf-container { flex: 1; background-color: #F3F4F6; border-radius: 8px; overflow: hidden; }

/* Searchable Select (กล่องค้นหารายชื่อ) */
.searchable-select {
  position: relative;
}
.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: #FFFFFF;
  border: 1px solid #10B981;
  border-radius: 8px;
  margin: 4px 0 0 0;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  list-style: none;
  padding: 0;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}
.search-dropdown li {
  padding: 10px 14px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  border-bottom: 1px solid #E5E7EB;
}
.search-dropdown li:last-child {
  border-bottom: none;
}
.search-dropdown li:hover {
  background-color: #F9FAFB;
  color: #10B981;
  font-weight: 500;
}
.no-results {
  color: #9CA3AF !important;
  text-align: center;
  cursor: default !important;
}
.no-results:hover {
  background-color: transparent !important;
}
</style>