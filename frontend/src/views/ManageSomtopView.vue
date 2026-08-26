<template>
  <div class="manage-layout">
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">จัดการข้อมูลผู้พิพากษาสมทบ</h1>
        <p class="page-subtitle">เพิ่ม ลบ แก้ไข ข้อมูลพื้นฐานและรูปถ่ายของผู้พิพากษาสมทบ</p>
      </div>
      <button class="btn-primary" @click="openAddModal">
        + เพิ่มข้อมูลใหม่
      </button>
    </div>

    <div class="card table-card">
      <!-- ส่วนควบคุมตาราง -->
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

        <div class="search-box">
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="🔍 ค้นหาชื่อ-สกุล..." 
            class="search-input"
          />
        </div>
      </div>

      <!-- ส่วนตารางข้อมูล -->
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th width="70">รูปถ่าย</th>
              <th>ชื่อ-สกุล</th>
              <th>วัน/เดือน/ปีเกิด</th>
              <th>อายุ (ปี)</th>
              <th>เบอร์โทร</th>
              <th>สถานะ</th>
              <th class="no-print">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="person in paginatedSomtopList" :key="person.id" class="data-row">
              <td>
                <img v-if="person.photo_path" :src="person.photo_path" class="avatar-img" alt="รูปโปรไฟล์" />
                <div v-else class="avatar-placeholder">👤</div>
              </td>
              <!-- Backend ทำ CONCAT รวมชื่อมาให้แล้วในชื่อตัวแปร full_name -->
              <td class="full-name">{{ person.full_name }}</td>
              <td>{{ formatThaiDateFull(person.dob) }}</td>
              <td>
                <span class="age-badge" :class="getAgeColorClass(calculateAge(person.dob))">
                  {{ calculateAge(person.dob) }}
                </span>
              </td>
              <td class="font-mono">{{ person.phone }}</td>
              <td>
                <span class="status-badge" :class="person.status === 'ใช้งาน' ? 'active' : 'inactive'">
                  {{ person.status }}
                </span>
              </td>
              <td class="no-print">
                <div class="action-buttons">
                  <button class="btn-icon edit" @click="openEditModal(person)" title="แก้ไข">✏️</button>
                  <button class="btn-icon delete" @click="deleteData(person.id)" title="ลบ">🗑️</button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredSomtopList.length === 0">
              <td colspan="7" class="text-center text-muted">ไม่พบข้อมูลที่ค้นหา</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ส่วนควบคุมการแบ่งหน้า -->
      <div class="pagination-container no-print" v-if="filteredSomtopList.length > 0">
        <div class="pagination-info">
          แสดง {{ (currentPage - 1) * itemsPerPage + 1 }} ถึง 
          {{ Math.min(currentPage * itemsPerPage, filteredSomtopList.length) }} 
          จากทั้งหมด {{ filteredSomtopList.length }} รายการ
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

    <!-- Modal Form สำหรับเพิ่ม/แก้ไข -->
    <div v-if="isModalOpen" class="modal-overlay no-print">
      <div class="modal-card">
        <div class="modal-header">
          <h2>{{ isEditing ? 'แก้ไขข้อมูล พ.สมทบ' : 'เพิ่มข้อมูล พ.สมทบ ใหม่' }}</h2>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        
        <form @submit.prevent="saveData" class="form-grid">
          
          <!-- ช่องอัปโหลดรูปภาพ -->
          <div class="input-group full-width upload-section photo-upload-section">
            <div class="photo-preview-container">
              <img v-if="previewPhotoUrl" :src="previewPhotoUrl" class="profile-preview" />
              <div v-else class="profile-preview placeholder">👤</div>
            </div>
            <div class="upload-controls">
              <label>รูปถ่าย (รองรับ .jpg, .png)</label>
              <input type="file" accept="image/*" @change="handlePhotoUpload" class="file-input" />
              <small class="text-muted">ขนาดไฟล์ไม่เกิน 2MB</small>
            </div>
          </div>

          <!-- ⭐️ แก้ไขฟอร์มชื่อ-สกุล เป็น 3 ช่อง -->
          <div class="input-group full-width">
            <label>คำนำหน้า ชื่อ และสกุล</label>
            <div class="name-inputs">
              <select v-model="formData.title" required class="title-select">
                <option value="" disabled>เลือกคำนำหน้า</option>
                <option v-for="title in titles" :key="title.id" :value="title.name">
                  {{ title.name }}
                </option>              
                <option v-if="formData.title && !titles.find(t => t.name === formData.title)" :value="formData.title">
                  {{ formData.title }}
                </option>
              </select>
              <input type="text" v-model="formData.firstName" placeholder="ชื่อ" required class="flex-1" />
              <input type="text" v-model="formData.lastName" placeholder="นามสกุล" required class="flex-1" />
            </div>
          </div>
          
          <div class="input-group">
            <label>เลขบัตรประชาชน</label>
            <input type="text" v-model="formData.idCard" maxlength="13" />
          </div>

          <div class="input-group">
            <label>วัน/เดือน/ปีเกิด</label>
            <div class="date-inputs">
              <select v-model="formData.dob_day" required>
                <option value="">วัน</option>
                <option v-for="d in days" :key="d" :value="d">{{ parseInt(d) }}</option>
              </select>
              <select v-model="formData.dob_month" required>
                <option value="">เดือน</option>
                <option v-for="m in thaiMonths" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
              <select v-model="formData.dob_year" required>
                <option value="">ปีเกิด</option>
                <option v-for="y in dobYears" :key="y.value" :value="y.value">{{ y.label }}</option>
              </select>
            </div>
          </div>

          <div class="input-group">
            <label>เบอร์โทร</label>
            <input type="text" v-model="formData.phone" />
          </div>

          <div class="input-group">
            <label>สถานะ</label>
            <select v-model="formData.status">
              <option value="ใช้งาน">ใช้งาน (Active)</option>
              <option value="พ้นสภาพ">พ้นสภาพ (Inactive)</option>
            </select>
          </div>

          <div class="input-group full-width">
            <label>ที่อยู่</label>
            <textarea v-model="formData.address" rows="2" placeholder="บ้านเลขที่, ถนน, ตำบล, อำเภอ, จังหวัด..."></textarea>
          </div>

          <div class="input-group full-width">
            <label>หมายเหตุ</label>
            <textarea v-model="formData.note" rows="2"></textarea>
          </div>

          <div class="modal-actions full-width">
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

// ข้อมูลพื้นฐานสำหรับกล่องเลือกวันเกิด
const days = Array.from({length: 31}, (_, i) => String(i + 1).padStart(2, '0'))
const thaiMonths = [
  { value: '01', label: 'มกราคม' }, { value: '02', label: 'กุมภาพันธ์' },
  { value: '03', label: 'มีนาคม' }, { value: '04', label: 'เมษายน' },
  { value: '05', label: 'พฤษภาคม' }, { value: '06', label: 'มิถุนายน' },
  { value: '07', label: 'กรกฎาคม' }, { value: '08', label: 'สิงหาคม' },
  { value: '09', label: 'กันยายน' }, { value: '10', label: 'ตุลาคม' },
  { value: '11', label: 'พฤศจิกายน' }, { value: '12', label: 'ธันวาคม' }
]

const titles = ref([])

const currentYear = new Date().getFullYear()
const dobYears = Array.from({length: 81}, (_, i) => {
  const y = currentYear - i 
  return { value: String(y), label: String(y + 543) }
})

// === State ทั่วไป ===
const somtopList = ref([])
const isModalOpen = ref(false)
const isEditing = ref(false)


// ⭐️ อัปเดตตัวแปร formData ให้รองรับ Title, FirstName, LastName
const formData = ref({
  id: null, 
  title: 'นาย', firstName: '', lastName: '', 
  idCard: '', 
  dob_day: '', dob_month: '', dob_year: '', 
  address: '', phone: '', status: 'ใช้งาน', note: '',
  photo: null, existing_photo_path: ''
})

const previewPhotoUrl = ref('')

// === State ระบบค้นหาและแบ่งหน้า ===
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)

// ฟังก์ชันต่างๆ
const formatThaiDateFull = (dateStr) => {
  if (!dateStr || dateStr === '0000-00-00') return '-';
  
  // ⭐️ นำ dateStr มา split('-') ได้โดยตรงเลยครับ
  const [year, month, day] = dateStr.split('-');
  
  const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  return `${parseInt(day)} ${monthNames[parseInt(month) - 1]} ${parseInt(year) + 543}`;
}

const calculateAge = (dobStr) => {
  if (!dobStr || dobStr === '0000-00-00') return '-';
  
  // ตัด T ออกเผื่อไว้ในกรณีที่มีเวลาติดมา
  const dateOnly = dobStr.split('T')[0];
  const birthDate = new Date(dateOnly);
  const today = new Date();
  
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  let days = today.getDate() - birthDate.getDate();
  
  // 1. ตรวจสอบวัน (ถ้าวันเกิดล้ำหน้ากว่าวันปัจจุบัน ให้ยืมเดือนมา 1 เดือน)
  if (days < 0) {
    months--;
    // หาว่าเดือนที่แล้วมีกี่วัน เพื่อนำมาบวกชดเชย
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }
  
  // 2. ตรวจสอบเดือน (ถ้าเดือนเกิดล้ำหน้ากว่าเดือนปัจจุบัน ให้ยืมปีมา 1 ปี)
  if (months < 0) {
    years--;
    months += 12;
  }
  
  // 3. จัดรูปแบบข้อความส่งกลับ
  return `${years} ปี ${months} เดือน ${days} วัน`;
}

// === ฟังก์ชันคืนค่าคลาส CSS สำหรับเปลี่ยนสีตามอายุ ===
const getAgeColorClass = (ageText) => {
  // ดักจับกรณีที่ยังไม่มีข้อมูลวันเกิด
  if (!ageText || ageText === '-') return '';
  
  // แปลงข้อความ "75 ปี..." ให้เหลือแค่ตัวเลข 75
  const ageYear = parseInt(ageText);
  
  if (ageYear >= 75) {
    return 'age-danger';    // 75 ปีขึ้นไป -> สีแดง
  } else if (ageYear >= 71 && ageYear < 75) {
    return 'age-warning';   // 71 ถึง 74 ปี -> สีเหลือง/ส้ม
  }
  
  return 'age-normal';      // ปกติ (ต่ำกว่า 71)
}

const fetchTitles = async () => {
  try {
    const response = await api.get('/titles');
    titles.value = response.data.records || [];
  } catch (error) {
    console.error("ดึงข้อมูลคำนำหน้าไม่สำเร็จ:", error);
  }
}

// กรองข้อมูล
const filteredSomtopList = computed(() => {
  if (!searchQuery.value) return somtopList.value;
  return somtopList.value.filter(person => 
    person.full_name.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
})

const totalPages = computed(() => Math.ceil(filteredSomtopList.value.length / itemsPerPage.value) || 1)
const paginatedSomtopList = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  return filteredSomtopList.value.slice(startIndex, startIndex + itemsPerPage.value);
})

const changePage = (page) => {
  if (page >= 1 && page <= totalPages.value) currentPage.value = page;
}

watch(searchQuery, () => currentPage.value = 1);

const handlePhotoUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    if (file.type.startsWith('image/')) {
      formData.value.photo = file
      previewPhotoUrl.value = URL.createObjectURL(file) 
    } else {
      swalError('ไฟล์ไม่ถูกต้อง', 'กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น')
      event.target.value = ''
      formData.value.photo = null
    }
  }
}

const fetchSomtopList = async () => {
  try {
    const response = await api.get('/somtop') // Node.js endpoint ไม่มี .php
    somtopList.value = response.data.records || []
  } catch (error) {
    console.error("ดึงข้อมูลไม่สำเร็จ:", error)
  }
}

const saveData = async () => {
  let formattedDob = null;
  if (formData.value.dob_year && formData.value.dob_month && formData.value.dob_day) {
    formattedDob = `${formData.value.dob_year}-${formData.value.dob_month}-${formData.value.dob_day}`;
  } else {
    swalError('ข้อมูลไม่ครบถ้วน', 'กรุณาระบุ วัน/เดือน/ปีเกิด ให้ครบถ้วน');
    return;
  }

  // ⭐️ เช็คว่ากรอกชื่อครบถ้วนหรือไม่
  if (!formData.value.title || !formData.value.firstName || !formData.value.lastName) {
    swalError('ข้อมูลไม่ครบถ้วน', 'กรุณาระบุคำนำหน้า ชื่อ และสกุล ให้ครบถ้วน');
    return;
  }

  try {
    const payload = new FormData()
    if (formData.value.id) payload.append('id', formData.value.id)
    
    // ⭐️ อัปเดตการส่งแยก 3 ฟิลด์ ไปยัง Backend
    payload.append('title', formData.value.title)
    payload.append('first_name', formData.value.firstName)
    payload.append('last_name', formData.value.lastName)
    
    payload.append('id_card', formData.value.idCard)
    payload.append('dob', formattedDob)
    payload.append('address', formData.value.address)
    payload.append('phone', formData.value.phone)
    payload.append('status', formData.value.status)
    payload.append('note', formData.value.note)

    if (formData.value.photo) {
      payload.append('photo', formData.value.photo)
    }

    const config = { headers: { 'Content-Type': 'multipart/form-data' } }

    if (isEditing.value) {
      // ใช้ PUT ตรงๆ กับ API Node.js
      await api.put('/somtop', payload, config)
      swalSuccess('บันทึกสำเร็จ', 'อัปเดตข้อมูลผู้พิพากษาสมทบสำเร็จ')
    } else {
      await api.post('/somtop', payload, config)
      swalSuccess('บันทึกสำเร็จ', 'เพิ่มข้อมูลผู้พิพากษาสมทบใหม่สำเร็จ')
    }
    
    closeModal()
    fetchSomtopList()
  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้')
  }
}

const deleteData = async (id) => {
  const result = await swalConfirm('ยืนยันการลบข้อมูล', 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลผู้พิพากษาสมทบท่านนี้? (ระบบจะลบรูปภาพด้วย)')
  if(result.isConfirmed) {
    try {
      await api.delete('/somtop', { data: { id: id } })
      swalSuccess('ลบข้อมูลสำเร็จ', 'ข้อมูลถูกลบออกจากระบบเรียบร้อยแล้ว')
      fetchSomtopList()
    } catch (error) {
      swalError('ลบข้อมูลไม่สำเร็จ', 'ไม่สามารถลบข้อมูลได้')
    }
  }
}

const openAddModal = () => {
  isEditing.value = false
  previewPhotoUrl.value = ''
  formData.value = { 
    id: null, 
    title: 'นาย', firstName: '', lastName: '', 
    idCard: '', 
    dob_day: '', dob_month: '', dob_year: '', 
    address: '', phone: '', status: 'ใช้งาน', note: '',
    photo: null, existing_photo_path: ''
  }
  isModalOpen.value = true
}

const openEditModal = (person) => {
  isEditing.value = true
  
  let dDay = '', dMonth = '', dYear = '';
  if (person.dob && person.dob !== '0000-00-00') {
    const dateOnly = person.dob.split('T')[0];
    const [y, m, d] = dateOnly.split('-');
    dYear = y; dMonth = m; dDay = d;
  }

  previewPhotoUrl.value = person.photo_path || ''

  // ⭐️ ดึง title, first_name, last_name จาก DB มาใส่ฟอร์ม
  formData.value = {
    id: person.id,
    title: person.title || 'นาย',
    firstName: person.first_name || '',
    lastName: person.last_name || '',
    idCard: person.id_card,
    dob_day: dDay,
    dob_month: dMonth,
    dob_year: dYear,
    address: person.address,
    phone: person.phone,
    status: person.status,
    note: person.note,
    photo: null,
    existing_photo_path: person.photo_path || ''
  }
  isModalOpen.value = true
}

const closeModal = () => isModalOpen.value = false

onMounted(() => {
  fetchSomtopList()
  fetchTitles()
})
</script>

<style scoped>
/* =========================================
   สไตล์เฉพาะหน้า
========================================= */

/* สีสำหรับอายุ */
.age-normal { color: #374151; }
.age-warning { color: #D97706; font-weight: 700; }
/* สีพื้นหลังและตัวอักษรสำหรับอายุ 75 ปีขึ้นไป (โค้ดเดิม) */
.age-danger {
  color: #991B1B; 
  background-color: #FEE2E2; 
}

/* ⭐️ แทรกรูปดาวไว้ด้านหน้า และเรียกใช้ Animation */
.age-danger::before {
  content: '⭐ ';
  animation: blinkStar 1s ease-in-out infinite;
}

/* ⭐️ ชุดคำสั่งสร้างเอฟเฟกต์กระพริบ (Blinking Effect) */
@keyframes blinkStar {
  0%, 100% { 
    opacity: 1; 
  }
  50% { 
    opacity: 0.2; /* ดรอปความสว่างลงให้ดูเหมือนไฟกระพริบ */
  }
}

/* โครงสร้างช่องกรอกชื่อ */
.name-inputs {
  display: flex;
  gap: 8px;
}
.name-inputs .title-select {
  width: 100px;
  flex-shrink: 0;
}
.name-inputs .flex-1 {
  flex: 1;
}

/* รูปในตาราง */
.avatar-img {
  width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid #E5E7EB;
}
.avatar-placeholder {
  width: 40px; height: 40px; border-radius: 50%; background-color: #F3F4F6; color: #9CA3AF; 
  display: flex; align-items: center; justify-content: center; font-size: 18px; border: 1px dashed #D1D5DB;
}

/* ส่วนอัปโหลดรูปในฟอร์ม */
.upload-section { background-color: #F9FAFB; padding: 16px; border-radius: 8px; border: 1px dashed #D1D5DB; }
.photo-upload-section { display: flex; flex-direction: row; align-items: center; gap: 20px; }
.photo-preview-container { flex-shrink: 0; }
.profile-preview { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #10B981; }
.profile-preview.placeholder {
  background-color: #E5E7EB; color: #9CA3AF; display: flex; align-items: center; justify-content: center; 
  font-size: 32px; border: 2px dashed #D1D5DB;
}
.upload-controls { display: flex; flex-direction: column; gap: 8px; flex: 1; }
.file-input { background-color: transparent !important; padding: 0 !important; border: none !important; }

/* ส่วนอื่นๆ อาศัย CSS จาก global.css ที่คุณทำไว้แล้ว */
</style>