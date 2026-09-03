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
              <th>ตำแหน่ง</th>
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
              <td>{{ person.role_position }}</td>
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
                  <button class="btn-icon view" @click="openViewModal(person)" title="ดูรายละเอียด">👁️</button>
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
            <label>อาชีพ</label>
            <input type="text" v-model="formData.occupation" placeholder="เช่น รับราชการ, ธุรกิจส่วนตัว" />
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

          <!-- ⭐️ เพิ่มกล่องเลือกตำแหน่ง -->
          <div class="input-group">
            <label>ตำแหน่ง</label>
            <select v-model="formData.position_id" required>
              <option value="" disabled>-- เลือกตำแหน่ง --</option>
              <option v-for="pos in positions" :key="pos.id" :value="pos.id">
                {{ pos.name }}
              </option>
            </select>
          </div>

          <!-- ⭐️ เพิ่มกล่องเลือกวันที่เข้ารับตำแหน่ง (ใช้โครงสร้างเดียวกับวันเกิด) -->
          <div class="input-group">
            <label>วันที่เข้ารับตำแหน่ง</label>
            <div class="date-inputs">
              <select v-model="formData.join_day">
                <option value="">วัน</option>
                <option v-for="d in days" :key="d" :value="d">{{ parseInt(d) }}</option>
              </select>
              <select v-model="formData.join_month">
                <option value="">เดือน</option>
                <option v-for="m in thaiMonths" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
              <select v-model="formData.join_year">
                <option value="">ปี พ.ศ.</option>
                <!-- ใช้ dobYears หรือสร้างตัวแปร year ใหม่สำหรับปีปัจจุบันย้อนหลังสั้นๆ ก็ได้ครับ -->
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
            <button type="submit" class="btn-primary" :disabled="isSaving">
              {{ isSaving ? '⏳ กำลังบันทึก...' : 'บันทึกข้อมูล' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ⭐️ Modal: ดูรายละเอียด พ.สมทบ (View Only) -->
    <div v-if="isViewModalOpen" class="modal-overlay no-print">
      <div class="modal-card detail-modal">
        <div class="modal-header">
          <h2>รายละเอียดข้อมูล พ.สมทบ</h2>
          <button class="close-btn" @click="closeViewModal">✕</button>
        </div>
        
        <div class="modal-body" v-if="selectedSomtopToView">
          <!-- ส่วนรูปโปรไฟล์และชื่อ -->
          <div class="profile-header text-center mb-4" style="display: flex; flex-direction: column; align-items: center; border-bottom: 1px dashed #E5E7EB; padding-bottom: 20px; margin-bottom: 20px;">
            <img v-if="selectedSomtopToView.photo_path" :src="selectedSomtopToView.photo_path" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid #10B981; margin-bottom: 12px;" />
            <div v-else style="width: 120px; height: 120px; border-radius: 50%; background: #F3F4F6; display: flex; align-items: center; justify-content: center; font-size: 48px; border: 2px dashed #D1D5DB; margin-bottom: 12px;">👤</div>
            
            <h3 style="font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">{{ selectedSomtopToView.full_name }}</h3>
            <span class="status-badge" :class="selectedSomtopToView.status === 'ใช้งาน' ? 'active' : 'inactive'">
              สถานะ: {{ selectedSomtopToView.status }}
            </span>
          </div>
          
          <!-- ข้อมูลทั่วไป Grid -->
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-icon">🪪</span>
              <div class="detail-content">
                <label>เลขบัตรประชาชน</label>
                <p>{{ selectedSomtopToView.id_card || '-' }}</p>
              </div>
            </div>

            <div class="detail-item">
              <span class="detail-icon">🎂</span>
              <div class="detail-content">
                <label>วัน/เดือน/ปีเกิด</label>
                <p>{{ formatThaiDateFull(selectedSomtopToView.dob) }}</p>
              </div>
            </div>

            <div class="detail-item">
              <span class="detail-icon">💼</span>
              <div class="detail-content">
                <label>อาชีพ</label>
                <!-- นำฟิลด์อาชีพที่เพิ่งเพิ่มมาแสดงผล -->
                <p>{{ selectedSomtopToView.occupation || '-' }}</p>
              </div>
            </div>

            <div class="detail-item">
              <span class="detail-icon">📞</span>
              <div class="detail-content">
                <label>เบอร์โทรศัพท์</label>
                <p>{{ selectedSomtopToView.phone || '-' }}</p>
              </div>
            </div>

            <div class="detail-item full-width">
              <span class="detail-icon">🏠</span>
              <div class="detail-content">
                <label>ที่อยู่</label>
                <p>{{ selectedSomtopToView.address || '-' }}</p>
              </div>
            </div>
          </div>

          <!-- หมายเหตุ -->
          <div class="detail-section" v-if="selectedSomtopToView.note">
            <label class="section-label" style="font-size: 14px; color: #374151; font-weight: 600; margin-bottom: 8px; display: block;">หมายเหตุ</label>
            <div style="background: #F9FAFB; padding: 16px; border-radius: 8px; border: 1px solid #E5E7EB; color: #374151; font-size: 14px; white-space: pre-wrap; line-height: 1.6;">
              {{ selectedSomtopToView.note }}
            </div>
          </div>
        </div>

        <!-- เส้นคั่น -->
        <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
        
        <div v-if="isLoadingHistory" class="text-center" style="padding: 20px; color: #6B7280;">
          กำลังโหลดประวัติข้อมูล...
        </div>

        <div v-else class="history-sections">
          <!-- 📅 ส่วนประวัติการลา -->
          <div class="history-section mb-4">
            <h4 style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
              <span>📅</span> ประวัติการลาล่าสุด
            </h4>
            <div v-if="personLeaveHistory.length === 0" style="color: #6B7280; font-size: 14px; background: #F9FAFB; padding: 12px; border-radius: 8px; text-align: center;">ไม่มีประวัติการลา</div>
            <div v-else class="table-responsive" style="max-height: 200px; overflow-y: auto; border: 1px solid #E5E7EB; border-radius: 8px;">
              <table class="data-table small-table">
                <thead>
                  <tr class="text-center">
                    <th>ประเภท</th>
                    <th>วันที่ลา</th>
                    <th class="text-center">จำนวนวัน</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(leave, i) in personLeaveHistory" :key="i" class="text-center">
                    <td>{{ leave.leave_type_name }}</td>
                    <td style="font-size: 13px;">{{ formatThaiDateShort(leave.start_date) }} - {{ formatThaiDateShort(leave.end_date) }}</td>
                    <td class="text-center">{{ leave.total_days % 1 === 0 ? parseInt(leave.total_days) : leave.total_days }}</td>
                    <td>
                      <span class="status-badge" :class="getStatusClass(leave.status)" style="font-size: 11px; padding: 2px 8px;">
                        {{ leave.status }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 📌 ส่วนประวัติการเข้าร่วมกิจกรรม -->
          <div class="history-section">
            <h4 style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
              <span>📌</span> ประวัติการเข้าร่วมกิจกรรม
            </h4>
            <div v-if="personEventHistory.length === 0" style="color: #6B7280; font-size: 14px; background: #F9FAFB; padding: 12px; border-radius: 8px; text-align: center;">ไม่มีประวัติการเข้าร่วมกิจกรรม</div>
            <div v-else class="table-responsive" style="max-height: 200px; overflow-y: auto; border: 1px solid #E5E7EB; border-radius: 8px;">
              <table class="data-table small-table">
                <thead>
                  <tr>
                    <th>ชื่องาน / กิจกรรม</th>
                    <th>วันที่จัดงาน</th>
                    <th>สถานะตอบรับ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(event, i) in personEventHistory" :key="i">
                    <td style="font-weight: 500;">{{ event.title }}</td>
                    <td style="font-size: 13px;">{{ formatThaiDateShort(event.start_date) }}</td>
                    <td>
                      <!-- ใช้ Badge สีตามสถานะตอบรับ -->
                      <span class="status-badge" :class="event.status === 'ยืนยันเข้าร่วม' ? 'active' : (event.status === 'ไม่เข้าร่วม' ? 'inactive' : 'warning')" style="font-size: 11px; padding: 2px 8px;">
                        {{ event.status }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="modal-actions mt-4">
          <button type="button" class="btn-secondary" @click="closeViewModal">ปิดหน้าต่าง</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '../services/api' 
import { swalSuccess, swalError, swalConfirm } from '../utils/swal'

const isSaving = ref(false)

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
const positions = ref([])

const currentYear = new Date().getFullYear()
const dobYears = Array.from({length: 81}, (_, i) => {
  const y = currentYear - i 
  return { value: String(y), label: String(y + 543) }
})

// === State ทั่วไป ===
const somtopList = ref([])
const isModalOpen = ref(false)
const isEditing = ref(false)

// === State สำหรับ Modal ดูรายละเอียด ===
const isViewModalOpen = ref(false)
const selectedSomtopToView = ref(null)

// === State สำหรับประวัติ ===
const personLeaveHistory = ref([])
const personEventHistory = ref([])
const isLoadingHistory = ref(false)

// ⭐️ อัปเดตตัวแปร formData ให้รองรับ Title, FirstName, LastName
const formData = ref({
  id: null, 
  title: 'นาย', firstName: '', lastName: '', 
  idCard: '', occupation: '',
  dob_day: '', dob_month: '', dob_year: '', 
  position_id: '', 
  join_day: '', join_month: '', join_year: '', 
  address: '', phone: '', status: 'ใช้งาน', note: '',
  photo: null, existing_photo_path: ''
})

const previewPhotoUrl = ref('')

// === State ระบบค้นหาและแบ่งหน้า ===
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(50)

// ฟังก์ชันต่างๆ
// แปลงวันที่เป็นรูปแบบย่อ (เช่น 1 ก.ค. 2569)
const formatThaiDateShort = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
};

const formatThaiDateFull = (dateStr) => {
  if (!dateStr || dateStr === '0000-00-00') return '-';
  const [year, month, day] = dateStr.split('-');  
  const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  return `${parseInt(day)} ${monthNames[parseInt(month) - 1]} ${parseInt(year) + 543}`;
}

const getStatusClass = (status) => {
  if (status === 'อนุมัติ' || status === 'ยืนยันเข้าร่วม' || status === 'ใช้งาน') return 'active';
  if (status === 'ไม่อนุมัติ' || status === 'ไม่เข้าร่วม' || status === 'ระงับ') return 'inactive';
  return 'warning'; // สำหรับสถานะ 'รอตรวจสอบ'
};

const calculateAge = (dobStr) => {
  if (!dobStr || dobStr === '0000-00-00') return '-';
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

const fetchPositions = async () => {
  try {
    const response = await api.get('/positions');
    positions.value = response.data.records || [];
  } catch (error) {
    console.error("ดึงข้อมูลตำแหน่งไม่สำเร็จ:", error);
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
  isSaving.value = true
  // ⭐️ 1. จัดการและเช็ก วัน/เดือน/ปีเกิด (บังคับกรอก)
  let formattedDob = null;
  if (formData.value.dob_year && formData.value.dob_month && formData.value.dob_day) {
    formattedDob = `${formData.value.dob_year}-${formData.value.dob_month}-${formData.value.dob_day}`;
  } else {
    swalError('ข้อมูลไม่ครบถ้วน', 'กรุณาระบุ วัน/เดือน/ปีเกิด ให้ครบถ้วน');
    isSaving.value = false;
    return;
  }

  // ⭐️ 2. จัดการ วันที่เข้ารับตำแหน่ง (ถ้าไม่ได้กรอก จะเป็น null)
  let formattedJoinDate = null;
  if (formData.value.join_year && formData.value.join_month && formData.value.join_day) {
    formattedJoinDate = `${formData.value.join_year}-${formData.value.join_month}-${formData.value.join_day}`;
  }

  // เช็กว่ากรอกชื่อครบถ้วนหรือไม่
  if (!formData.value.title || !formData.value.firstName || !formData.value.lastName || !formData.value.occupation) {
    swalError('ข้อมูลไม่ครบถ้วน', 'กรุณาระบุคำนำหน้า ชื่อ สกุล และอาชีพ ให้ครบถ้วน');
    isSaving.value = false;
    return;
  }

  try {
    const payload = new FormData()
    if (formData.value.id) payload.append('id', formData.value.id)
    
    payload.append('title', formData.value.title)
    payload.append('first_name', formData.value.firstName)
    payload.append('last_name', formData.value.lastName)
    payload.append('occupation', formData.value.occupation)
    payload.append('id_card', formData.value.idCard || '') // ⭐️ แก้ไขตรงนี้
    payload.append('dob', formattedDob)
    payload.append('address', formData.value.address || '') // ⭐️ แก้ไขตรงนี้
    payload.append('phone', formData.value.phone || '')     // ⭐️ แก้ไขตรงนี้
    payload.append('status', formData.value.status)
    payload.append('note', formData.value.note || '')       // ⭐️ แก้ไขตรงนี้
    payload.append('position_id', formData.value.position_id)
    
    if (formattedJoinDate) {
      payload.append('join_date', formattedJoinDate)
    }

    if (formData.value.photo) {
      payload.append('photo', formData.value.photo)
    }

    const config = { headers: { 'Content-Type': 'multipart/form-data' } }

    if (isEditing.value) {
      await api.put('/somtop', payload, config)
      swalSuccess('บันทึกสำเร็จ', 'อัปเดตข้อมูลผู้พิพากษาสมทบสำเร็จ')
    } else {
      await api.post('/somtop', payload, config)
      swalSuccess('บันทึกสำเร็จ', 'เพิ่มข้อมูลผู้พิพากษาสมทบใหม่สำเร็จ')
    }
    isSaving.value = false;
    closeModal()
    fetchSomtopList()
  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้')
  } finally {
    isSaving.value = false;
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
    id: null, title: 'นาย', firstName: '', lastName: '', idCard: '', 
    dob_day: '', dob_month: '', dob_year: '', 
    position_id: '', join_day: '', join_month: '', join_year: '',
    address: '', phone: '', status: 'ใช้งาน', note: '', photo: null, existing_photo_path: ''
  }
  isModalOpen.value = true
}

const openEditModal = (person) => {
  isEditing.value = true
    
  // 1. แยก วัน/เดือน/ปีเกิด
  let dDay = '', dMonth = '', dYear = '';
  if (person.dob && person.dob !== '0000-00-00') {
    const dobOnly = person.dob.split('T')[0];
    const [y, m, d] = dobOnly.split('-');
    dYear = y; dMonth = m; dDay = d;
  }

  // 2. แยก วันที่เข้ารับตำแหน่ง
  let jDay = '', jMonth = '', jYear = '';
  if (person.join_date && person.join_date !== '0000-00-00') {
    const joinDateOnly = person.join_date.split('T')[0];
    const [y, m, d] = joinDateOnly.split('-');
    jYear = y; jMonth = m; jDay = d;
  }
  
  previewPhotoUrl.value = person.photo_path || ''

  formData.value = {
    id: person.id,
    title: person.title || 'นาย',
    firstName: person.first_name || '',
    lastName: person.last_name || '',
    idCard: person.id_card || '',       
    occupation: person.occupation || '', 
    dob_day: dDay,
    dob_month: dMonth,
    dob_year: dYear,
    position_id: person.position_id || '', 
    join_day: jDay, 
    join_month: jMonth, 
    join_year: jYear, 
    address: person.address || '',      
    phone: person.phone || '',          
    status: person.status,
    note: person.note || '',            
    // ⭐️ ลบ position_id และ join_date ที่ประกาศซ้ำซ้อนด้านล่างออก
    photo: null,
    existing_photo_path: person.photo_path || ''
  }
  isModalOpen.value = true
}

const closeModal = () => isModalOpen.value = false

// === ฟังก์ชันเปิด/ปิด Modal ดูรายละเอียด ===
const openViewModal = async (person) => {
  selectedSomtopToView.value = person
  isViewModalOpen.value = true
  
  // ล้างค่าเก่าและโหลดข้อมูลใหม่
  personLeaveHistory.value = []
  personEventHistory.value = []
  isLoadingHistory.value = true
  
  try {
    const response = await api.get(`/somtop/${person.id}/history`)
    personLeaveHistory.value = response.data.leaves || []
    personEventHistory.value = response.data.events || []
  } catch (error) {
    console.error('ไม่สามารถดึงประวัติได้:', error)
  } finally {
    isLoadingHistory.value = false
  }

}

const closeViewModal = () => {
  isViewModalOpen.value = false
  selectedSomtopToView.value = null
}

onMounted(() => {
  fetchSomtopList()
  fetchTitles()
  fetchPositions()
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

/* =========================================
   View Modal Styles
========================================= */
.detail-modal { max-width: 650px; }
.detail-grid { 
  display: grid; 
  grid-template-columns: 1fr 1fr; 
  gap: 20px; 
  margin-bottom: 24px; 
}
.detail-item { display: flex; align-items: flex-start; gap: 12px; }
.detail-item.full-width { grid-column: span 2; }
.detail-icon { 
  font-size: 20px; 
  background: #F3F4F6; 
  width: 40px; 
  height: 40px; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  border-radius: 10px; 
  flex-shrink: 0; 
}
.detail-content { display: flex; flex-direction: column; gap: 4px; }
.detail-content label { font-size: 12px; color: #6B7280; font-weight: 600; }
.detail-content p { font-size: 14px; color: #111827; margin: 0; font-weight: 500; }
.btn-icon.view { background-color: #F3F4F6; }
.btn-icon.view:hover { background-color: #E5E7EB; }

/* ส่วนอื่นๆ อาศัย CSS จาก global.css ที่คุณทำไว้แล้ว */
</style>