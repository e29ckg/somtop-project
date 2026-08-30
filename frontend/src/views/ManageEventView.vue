<template>
  <div class="manage-layout">
    <!-- Header -->
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">ปฏิทินกิจกรรม</h1>
        <p class="page-subtitle">จัดการข้อมูลกิจกรรม และรายชื่อผู้พิพากษาสมทบที่เข้าร่วม</p>
      </div>
      <button class="btn-primary" @click="openAddModal">
        + สร้างกิจกรรมใหม่
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
            placeholder="🔍 ค้นหาชื่องาน หรือสถานที่..." 
            class="search-input"
          />
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>ชื่องาน / กิจกรรม</th>
              <th>วัน-เวลา เริ่มต้น</th>
              <th>วัน-เวลา สิ้นสุด</th>
              <th>สถานที่</th>
              <th class="text-center">ผู้เข้าร่วม</th>
              <th>สถานะ</th>
              <th class="no-print">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="7" class="text-center py-8">
                <div class="loading-spinner"></div>
                <div class="text-muted mt-2">กำลังดึงข้อมูล...</div>
              </td>
            </tr>
            
            <template v-else>
              <tr v-for="event in paginatedList" :key="event.id" class="data-row">
                <td class="font-bold">{{ event.title }}</td>
                <td>{{ formatDateTime(event.start_date) }}</td>
                <td>{{ formatDateTime(event.end_date) }}</td>
                <td>{{ event.location || '-' }}</td>
                <td class="text-center">
                  <span class="badge-count">{{ event.participant_count || 0 }} คน</span>
                </td>
                <td>
                  <span class="status-badge" :class="getStatusClass(event.status)">
                    {{ event.status }}
                  </span>
                </td>
                <td class="no-print">
                  <div class="action-buttons">
                    <!-- ปุ่มจัดการผู้เข้าร่วม -->
                    <button class="btn-icon manage-users" @click="openParticipantModal(event)" title="จัดการผู้เข้าร่วม">👥</button>
                    <button class="btn-icon edit" @click="openEditModal(event)" title="แก้ไขกิจกรรม">✏️</button>
                    <button class="btn-icon delete" @click="deleteData(event.id)" title="ลบกิจกรรม">🗑️</button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredList.length === 0">
                <td colspan="7" class="text-center text-muted">ไม่พบข้อมูลกิจกรรม</td>
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

    <!-- ⭐️ Modal 1: จัดการข้อมูลกิจกรรม -->
    <div v-if="isModalOpen" class="modal-overlay no-print">
      <div class="modal-card">
        <div class="modal-header">
          <h2>{{ isEditing ? 'แก้ไขกิจกรรม' : 'สร้างกิจกรรมใหม่' }}</h2>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        
        <form @submit.prevent="saveData" class="form-grid">
            <div class="input-group full-width">
                <label>ประเภทกิจกรรม <span class="text-danger">*</span></label>
                <select v-model="formData.event_type_id" required>
                <option value="" disabled>-- เลือกประเภทกิจกรรม --</option>
                <option v-for="type in eventTypes" :key="type.id" :value="type.id">
                    {{ type.name }}
                </option>
                </select>
            </div>
          <div class="input-group full-width">
            <label>หัวข้อกิจกรรม / ชื่องาน <span class="text-danger">*</span></label>
            <input type="text" v-model="formData.title" required placeholder="เช่น ประชุมใหญ่สามัญประจำปี" />
          </div>

          <div class="input-group">
            <label>วันที่เริ่มต้น <span class="text-danger">*</span></label>
            <div class="date-inputs">
              <select v-model="formData.start_day" required>
                <option value="">วัน</option>
                <option v-for="d in days" :key="d" :value="d">{{ parseInt(d) }}</option>
              </select>
              <select v-model="formData.start_month" required>
                <option value="">เดือน</option>
                <option v-for="m in thaiMonths" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
              <select v-model="formData.start_year" required>
                <option value="">ปี</option>
                <option v-for="y in eventYears" :key="y.value" :value="y.value">{{ y.label }}</option>
              </select>
            </div>
          </div>

          <div class="input-group">
            <label>วันที่สิ้นสุด <span class="text-muted">(ไม่ระบุได้)</span></label>
            <div class="date-inputs">
              <select v-model="formData.end_day">
                <option value="">วัน</option>
                <option v-for="d in days" :key="d" :value="d">{{ parseInt(d) }}</option>
              </select>
              <select v-model="formData.end_month">
                <option value="">เดือน</option>
                <option v-for="m in thaiMonths" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
              <select v-model="formData.end_year">
                <option value="">ปี</option>
                <option v-for="y in eventYears" :key="y.value" :value="y.value">{{ y.label }}</option>
              </select>
            </div>
          </div>

          <div class="input-group full-width">
            <label>สถานที่จัดงาน</label>
            <input type="text" v-model="formData.location" placeholder="เช่น ห้องประชุมชั้น 3" />
          </div>

          <div class="input-group full-width">
            <label>รายละเอียดเพิ่มเติม</label>
            <textarea v-model="formData.description" rows="3" placeholder="กำหนดการ หรือหมายเหตุ..."></textarea>
          </div>

          <div class="input-group">
            <label>สถานะกิจกรรม</label>
            <select v-model="formData.status">
              <option value="รอดำเนินการ">รอดำเนินการ</option>
              <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
              <option value="เสร็จสิ้น">เสร็จสิ้น</option>
              <option value="ยกเลิก">ยกเลิก</option>
            </select>
          </div>

          <div class="modal-actions full-width">
            <button type="button" class="btn-secondary" @click="closeModal">ยกเลิก</button>
            <button type="submit" class="btn-primary">บันทึกข้อมูล</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ⭐️ Modal 2: จัดการผู้เข้าร่วมกิจกรรม -->
    <div v-if="isParticipantModalOpen" class="modal-overlay no-print">
      <div class="modal-card participant-modal">
        <div class="modal-header">
          <h2>รายชื่อผู้เข้าร่วม: <span class="text-emerald-600">{{ selectedEvent?.title }}</span></h2>
          <button class="close-btn" @click="closeParticipantModal">✕</button>
        </div>
        
        <div class="participant-content">
          <div class="search-box mb-3">
            <input type="text" v-model="participantSearchQuery" placeholder="🔍 ค้นหารายชื่อ พ.สมทบ..." class="search-input w-full" />
          </div>

          <div class="participant-list">
            <label v-for="person in filteredSomtopList" :key="person.id" class="participant-item">
              <input 
                type="checkbox" 
                :checked="isParticipant(person.id)" 
                @change="toggleParticipant(person.id, $event.target.checked)"
              />
              <span class="person-name">{{ person.full_name }}</span>
            </label>
            <div v-if="filteredSomtopList.length === 0" class="text-center text-muted py-4">ไม่พบรายชื่อที่ค้นหา</div>
          </div>
        </div>

        <div class="modal-actions full-width">
          <button type="button" class="btn-primary" @click="closeParticipantModal">เสร็จสิ้น</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '../services/api' 
import { swalSuccess, swalError, swalConfirm } from '../utils/swal'

// === State ทั่วไป ===
const eventList = ref([])
const somtopList = ref([]) // เก็บรายชื่อ พ.สมทบ ทั้งหมด
const currentParticipants = ref([]) // เก็บ ID ของคนที่เข้าร่วมกิจกรรมที่กำลังเลือกอยู่
const isLoading = ref(false)

const isModalOpen = ref(false)
const isEditing = ref(false)
const isParticipantModalOpen = ref(false)
const selectedEvent = ref(null)

// ⭐️ 1. เพิ่มตัวแปรสำหรับเก็บรายชื่อ "ประเภทกิจกรรม"
const eventTypes = ref([])

// === ข้อมูลพื้นฐานสำหรับกล่องเลือกวันที่ ===
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
const eventYears = Array.from({length: 15}, (_, i) => {
  const y = currentYear - 5 + i // ให้เลือดย้อนหลัง 5 ปี และล่วงหน้า 10 ปี
  return { value: String(y), label: String(y + 543) }
})

// ปรับปรุง formData ใหม่
const formData = ref({
  id: null, event_type_id: '', title: '', description: '', location: '', status: 'รอดำเนินการ',
  start_day: '', start_month: '', start_year: '',
  end_day: '', end_month: '', end_year: ''
})


// === State ระบบค้นหาและแบ่งหน้า ===
const searchQuery = ref('')
const participantSearchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)

// กรองกิจกรรม
const filteredList = computed(() => {
  if (!searchQuery.value) return eventList.value;
  const q = searchQuery.value.toLowerCase()
  return eventList.value.filter(item => 
    item.title.toLowerCase().includes(q) || (item.location && item.location.toLowerCase().includes(q))
  );
})

// กรองรายชื่อ พ.สมทบ ใน Modal
const filteredSomtopList = computed(() => {
  if (!participantSearchQuery.value) return somtopList.value;
  return somtopList.value.filter(p => p.full_name.toLowerCase().includes(participantSearchQuery.value.toLowerCase()));
})

const totalPages = computed(() => Math.ceil(filteredList.value.length / itemsPerPage.value) || 1)
const paginatedList = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  return filteredList.value.slice(startIndex, startIndex + itemsPerPage.value);
})
const changePage = (page) => { if (page >= 1 && page <= totalPages.value) currentPage.value = page; }
watch(searchQuery, () => currentPage.value = 1);

// === ฟังก์ชันตัวช่วยจัดรูปแบบ ===
// แปลง String กลับไปใส่ <input type="datetime-local"> ให้พอดี
const formatForInput = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  // ปรับให้อยู่ใน Timezone ท้องถิ่น และตัดวินาทีออก YYYY-MM-DDTHH:mm
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16); 
}

// แปลงแสดงผลในตาราง
const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('th-TH', { 
    year: 'numeric', month: 'short', day: 'numeric', 
    hour: '2-digit', minute: '2-digit' 
  });
}

const getStatusClass = (status) => {
  if (status === 'เสร็จสิ้น') return 'active';
  if (status === 'กำลังดำเนินการ') return 'warning';
  if (status === 'ยกเลิก') return 'inactive';
  return ''; // รอดำเนินการ สีเทา
}



// === ฟังก์ชัน API (กิจกรรม) ===
const fetchEventTypes = async () => {
  try {
    const response = await api.get('/event-types');
    eventTypes.value = response.data.records || [];
  } catch (error) {
    console.error("ดึงข้อมูลประเภทกิจกรรมไม่สำเร็จ:", error);
  }
}

const fetchEvents = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/events')
    eventList.value = response.data.records || []
  } catch (error) {
    console.error("ดึงข้อมูลกิจกรรมไม่สำเร็จ:", error)
  } finally {
    isLoading.value = false
  }
}

const fetchSomtopList = async () => {
  try {
    const response = await api.get('/somtop')
    somtopList.value = response.data.records || []
  } catch (error) {
    console.error("ดึงข้อมูลรายชื่อไม่สำเร็จ:", error)
  }
}

// ฟังก์ชันช่วยแยกวันที่ YYYY-MM-DD หรือ DATETIME ออกเป็นส่วนๆ
const parseDateToParts = (dateStr) => {
  if (!dateStr) return { day: '', month: '', year: '' };
  const dateOnly = dateStr.split('T')[0].split(' ')[0]; 
  const [year, month, day] = dateOnly.split('-');
  return { year, month, day };
}

const saveData = async () => {
  try {
    // รวมวันที่และตั้งเวลาเริ่มต้นเป็นเที่ยงคืน
    const start_date = `${formData.value.start_year}-${formData.value.start_month}-${formData.value.start_day} 00:00:00`;
    let end_date = null;
    
    // ถ้ามีการเลือกวันที่สิ้นสุดครบ ให้ตั้งเวลาเป็นก่อนเที่ยงคืน
    if (formData.value.end_year && formData.value.end_month && formData.value.end_day) {
      end_date = `${formData.value.end_year}-${formData.value.end_month}-${formData.value.end_day} 23:59:59`;
    } else {
      // ถ้าไม่ได้ระบุวันที่สิ้นสุด ให้ใช้วันที่เริ่มต้นแทน (เพื่อไม่ให้ขัดกับกฎ NOT NULL ของ Database)
      end_date = `${formData.value.start_year}-${formData.value.start_month}-${formData.value.start_day} 23:59:59`;
    }

    const payload = {
      id: formData.value.id,
      event_type_id: formData.value.event_type_id,
      title: formData.value.title,
      description: formData.value.description,
      location: formData.value.location,
      status: formData.value.status,
      start_date: start_date,
      end_date: end_date
    }

    if (isEditing.value) {
      await api.put(`/events/${payload.id}`, payload)
      swalSuccess('บันทึกสำเร็จ', 'อัปเดตข้อมูลกิจกรรมเรียบร้อย')
    } else {
      await api.post('/events', payload)
      swalSuccess('บันทึกสำเร็จ', 'สร้างกิจกรรมใหม่เรียบร้อย')
    }
    
    closeModal()
    fetchEvents()
  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้')
  }
}

const openAddModal = () => {
  isEditing.value = false
  formData.value = { 
    id: null, event_type_id: '', title: '', description: '', location: '', status: 'รอดำเนินการ',
    start_day: '', start_month: '', start_year: '',
    end_day: '', end_month: '', end_year: ''
  }
  isModalOpen.value = true
}

const openEditModal = (item) => {
  isEditing.value = true
  
  const startParts = parseDateToParts(item.start_date);
  const endParts = parseDateToParts(item.end_date);

  formData.value = { 
    ...item,
    start_day: startParts.day,
    start_month: startParts.month,
    start_year: startParts.year,
    end_day: endParts.day,
    end_month: endParts.month,
    end_year: endParts.year
  }
  isModalOpen.value = true
}

const deleteData = async (id) => {
  const result = await swalConfirm('ยืนยันการลบ', 'คุณแน่ใจหรือไม่ว่าต้องการลบกิจกรรมนี้? (ข้อมูลผู้เข้าร่วมจะถูกลบไปด้วย)')
  if (result.isConfirmed) {
    try {
      await api.delete(`/events/${id}`)
      swalSuccess('ลบสำเร็จ', 'กิจกรรมถูกลบทิ้งแล้ว')
      fetchEvents()
    } catch (error) {
      swalError('ลบไม่สำเร็จ', 'ไม่สามารถลบกิจกรรมได้')
    }
  }
}

// === ฟังก์ชัน API (จัดการผู้เข้าร่วม) ===
const openParticipantModal = async (event) => {
  selectedEvent.value = event;
  participantSearchQuery.value = '';
  
  try {
    // ดึงรายชื่อคนที่ถูกเลือกในกิจกรรมนี้มาเก็บไว้ใน currentParticipants
    const response = await api.get(`/events/${event.id}/participants`);
    const participants = response.data.records || [];
    currentParticipants.value = participants.map(p => p.somtop_id);
    
    isParticipantModalOpen.value = true;
  } catch (error) {
    swalError('ผิดพลาด', 'ไม่สามารถดึงรายชื่อผู้เข้าร่วมได้');
  }
}

const closeParticipantModal = () => {
  isParticipantModalOpen.value = false;
  selectedEvent.value = null;
  fetchEvents(); // รีเฟรชตารางเพื่ออัปเดตตัวเลขผู้เข้าร่วม (participant_count)
}

const isParticipant = (somtopId) => currentParticipants.value.includes(somtopId);

const toggleParticipant = async (somtopId, isChecked) => {
  try {
    const action = isChecked ? 'add' : 'remove';
    await api.post('/events/participants', {
      event_id: selectedEvent.value.id,
      somtop_id: somtopId,
      action: action
    });

    // อัปเดต State ฝั่งหน้าจอให้ติ๊กถูก/เอาออก ทันที
    if (isChecked) {
      currentParticipants.value.push(somtopId);
    } else {
      currentParticipants.value = currentParticipants.value.filter(id => id !== somtopId);
    }
  } catch (error) {
    console.error("จัดการผู้เข้าร่วมไม่สำเร็จ:", error);
    swalError('เกิดข้อผิดพลาด', 'ไม่สามารถอัปเดตรายชื่อได้');
  }
}

// === ฟังก์ชันควบคุม Modal ===


const closeModal = () => isModalOpen.value = false

onMounted(() => {
  fetchEvents()
  fetchEventTypes()
  fetchSomtopList()
})
</script>

<style scoped>
.text-danger { color: #DC2626; }
.badge-count { background-color: #E0E7FF; color: #4338CA; padding: 4px 10px; border-radius: 20px; font-weight: 600; font-size: 12px; }
.btn-icon.manage-users { background-color: #E0E7FF; border-color: #C7D2FE; }
.btn-icon.manage-users:hover { background-color: #C7D2FE; }

/* Participant Modal Styling */
.participant-modal { max-width: 500px; }
.participant-content { margin-bottom: 20px; }
.participant-list { max-height: 400px; overflow-y: auto; border: 1px solid #E5E7EB; border-radius: 8px; }
.participant-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #E5E7EB; cursor: pointer; transition: background 0.2s; }
.participant-item:last-child { border-bottom: none; }
.participant-item:hover { background-color: #F9FAFB; }
.participant-item input[type="checkbox"] { width: 18px; height: 18px; accent-color: #10B981; cursor: pointer; }
.person-name { font-size: 14px; font-weight: 500; color: #111827; }

.date-inputs {
  display: flex;
  gap: 8px;
}
.date-inputs select {
  flex: 1;
  min-width: 0; 
}
</style>