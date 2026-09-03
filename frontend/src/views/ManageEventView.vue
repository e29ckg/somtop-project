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
              <tr v-for="event in paginatedList" :key="event.id" class="data-row" :class="{ 'upcoming-row': isUpcomingEvent(event.start_date) }">
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
                    <!-- <button class="btn-icon manage-users" @click="openParticipantModal(event)" title="จัดการผู้เข้าร่วม">👥</button> -->
                    <button class="btn-icon view" @click="openViewModal(event)" title="ดูรายละเอียดกิจกรรม">👁️</button>
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

          <div class="input-group full-width">
            <label>วัน-เวลา เริ่มต้น <span class="text-danger">*</span></label>
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
              <span class="time-separator">เวลา</span>
              <select v-model="formData.start_hour" required>
                <option value="">ชม.</option>
                <option v-for="h in hours" :key="h" :value="h">{{ h }}</option>
              </select>
              <span>:</span>
              <select v-model="formData.start_minute" required>
                <option value="">นาที</option>
                <option v-for="m in minutes" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
          </div>

          <div class="input-group full-width">
            <label>วัน-เวลา สิ้นสุด <span class="text-muted">(ไม่ระบุได้)</span></label>
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
              <span class="time-separator">เวลา</span>
              <select v-model="formData.end_hour">
                <option value="">ชม.</option>
                <option v-for="h in hours" :key="h" :value="h">{{ h }}</option>
              </select>
              <span>:</span>
              <select v-model="formData.end_minute">
                <option value="">นาที</option>
                <option v-for="m in minutes" :key="m" :value="m">{{ m }}</option>
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

          <!-- ⭐️ ส่วนจัดการผู้เข้าร่วมกิจกรรม -->
          <div class="input-group full-width participant-selection-section">
            <div class="section-header">
              <!-- ค้นหาบรรทัดที่ 208 แล้วเปลี่ยนเป็นแบบนี้ -->
            <label>ผู้เข้าร่วมกิจกรรม <span class="text-emerald-600">({{ formData.participants?.length || 0 }} ท่าน)</span></label>
            <button type="button" class="btn-select-all" @click="toggleSelectAll">
                {{ isAllSelected ? 'ยกเลิกการเลือกทั้งหมด' : '☑ เลือกทั้งหมด' }}
              </button>
            </div>
            
            <div class="participant-search">
              <input 
                type="text" 
                v-model="participantSearchQuery" 
                placeholder="🔍 พิมพ์ค้นหารายชื่อเพื่อเลือก..." 
                class="search-input w-full"
              />
            </div>

            <div class="participant-grid">
              <label 
                v-for="person in filteredSomtopList" 
                :key="person.id" 
                class="participant-checkbox-card" 
                :class="{ 'selected': formData.participants.includes(person.id) }"
              >
                <input 
                  type="checkbox" 
                  :value="person.id" 
                  v-model="formData.participants" 
                />
                <span class="person-name">{{ person.full_name }}</span>
              </label>
              <div v-if="filteredSomtopList.length === 0" class="no-results-msg">
                ไม่พบรายชื่อที่ค้นหา
              </div>
            </div>
          </div>

          <div class="input-group full-width upload-section">
            <label>แนบไฟล์เอกสาร (PDF, ภาพ, Word, Excel)</label>
            <input 
              type="file" 
              multiple 
              accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" 
              @change="handleFileUpload" 
              class="file-input" 
            />
            
            <ul v-if="formData.files && formData.files.length > 0" class="file-list">
              <li v-for="(file, index) in formData.files" :key="index">
                📄 {{ file.name }}
              </li>
            </ul>

            <!-- แสดงไฟล์เดิมที่มีอยู่แล้วตอนกดแก้ไข -->
            <div v-if="isEditing && formData.existing_file_paths && formData.existing_file_paths.length > 0" class="file-hint mt-3">
              <p class="mb-2 text-gray-700 font-bold">ไฟล์แนบเดิม:</p>
              <ul class="existing-files list-none pl-0">
                <li v-for="(file, index) in formData.existing_file_paths" :key="index" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <!-- ไอคอนและชื่อไฟล์ -->
                  <span style="font-size: 16px;">{{ getFileIcon(file) }}</span>
                  <a href="#" @click.prevent="openFilePreview(file, formData.id)" class="text-blue-700 underline text-sm" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    {{ getFileName(file) }}
                  </a>
                  <!-- ปุ่มลบไฟล์ (สีแดงอ่อน) -->
                  <button type="button" @click.prevent="deleteFileInline(file)" title="ลบไฟล์นี้" style="background-color: #FCE8E8; color: #EF4444; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                    🗑️
                  </button>
                </li>
              </ul>
              <small class="text-muted">(หากเลือกอัปโหลดไฟล์ใหม่ ระบบจะเพิ่มไฟล์ต่อท้ายรายการเดิม)</small>
            </div>
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
    
    <!-- ⭐️ Modal 4: ดูรายละเอียดกิจกรรม (View Only) -->
    <div v-if="isViewModalOpen" class="modal-overlay no-print">
      <div class="modal-card detail-modal">
        <div class="modal-header">
          <h2>รายละเอียดกิจกรรม</h2>
          <button class="close-btn" @click="closeViewModal">✕</button>
        </div>
        
        <div class="modal-body" v-if="selectedEventToView">
          <div class="detail-header">
            <h3 class="event-title">{{ selectedEventToView.title }}</h3>
            <span class="status-badge" :class="getStatusClass(selectedEventToView.status)">
              {{ selectedEventToView.status }}
            </span>
          </div>

          
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-icon">📌</span>
              <div class="detail-content">
                <label>ประเภทกิจกรรม</label>
                <p>{{ selectedEventToView.event_type_name || 'ไม่ระบุ' }}</p>
              </div>
            </div>

            <div class="detail-item">
              <span class="detail-icon">📍</span>
              <div class="detail-content">
                <label>สถานที่</label>
                <p>{{ selectedEventToView.location || 'ไม่ระบุสถานที่' }}</p>
              </div>
            </div>

            <div class="detail-item full-width">
              <span class="detail-icon">📅</span>
              <div class="detail-content">
                <label>วัน-เวลา ที่จัดงาน</label>
                <p>
                  {{ formatDateTime(selectedEventToView.start_date) }} 
                  <span class="text-muted mx-2">ถึง</span> 
                  {{ formatDateTime(selectedEventToView.end_date) }}
                </p>
              </div>
            </div>
          </div>

          <div class="detail-section" v-if="selectedEventToView.description">
            <label class="section-label">รายละเอียดเพิ่มเติม (กำหนดการ/หมายเหตุ)</label>
            <div class="description-box">
              {{ selectedEventToView.description }}
            </div>
          </div>

          <!-- แสดงรายชื่อผู้เข้าร่วม -->
          <div class="detail-section" v-if="viewParticipantsList && viewParticipantsList.length > 0">
            <label class="section-label">ผู้เข้าร่วมกิจกรรม ({{ viewParticipantsList?.length || 0 }} ท่าน)</label>
            <div class="participant-tags">
              <span v-for="person in viewParticipantsList" :key="person.somtop_id" class="participant-tag">
                👤 {{ person.full_name }}
              </span>
            </div>
          </div>
          <div class="detail-section" v-else-if="viewParticipantsList && viewParticipantsList.length === 0">
            <label class="section-label">ผู้เข้าร่วมกิจกรรม</label>
            <p class="text-muted text-sm">ยังไม่มีผู้เข้าร่วม</p>
          </div>

          <!-- ส่วนแสดงไฟล์แนบใน View Modal -->
          <div class="detail-section" v-if="selectedEventToView.file_paths && selectedEventToView.file_paths.length > 0">
            <label class="section-label">ไฟล์แนบเอกสาร:</label>
            <div class="file-grid mt-2">
              <button 
                v-for="(file, index) in selectedEventToView.file_paths" 
                :key="index"
                @click="openFilePreview(file, selectedEventToView.id)" 
                class="file-attachment-btn"
              >
                <span class="file-icon">{{ getFileIcon(file) }}</span>
                <span class="file-name">{{ getFileName(file) }}</span>
                <span class="file-action">เปิดดูไฟล์ ↗</span>
              </button>
            </div>
          </div>

        </div>

        <div class="modal-actions">
          <button type="button" class="btn-secondary" @click="closeViewModal">ปิดหน้าต่าง</button>
        </div>
      </div>
    </div>

    <!-- ⭐️ Modal 3: ดูไฟล์แนบ (Preview) -->
    <div v-if="isPreviewOpen" class="modal-overlay no-print">
      <div class="modal-card pdf-modal">
        <div class="modal-header">
          <h2>ดูไฟล์แนบ</h2>
          <div class="preview-actions">
            <button class="close-btn" @click="closeFilePreview">✕</button>
          </div>
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

// ==========================================
// 1. Data Sources & Variables
// ==========================================
const isSaving = ref(false)

const eventList = ref([])
const eventTypes = ref([])
const somtopList = ref([])
const currentParticipants = ref([])

const isLoading = ref(false)
const isModalOpen = ref(false)
const isEditing = ref(false)
const isParticipantModalOpen = ref(false)
const isViewModalOpen = ref(false)
const isPreviewOpen = ref(false)

const selectedEvent = ref(null)
const selectedEventToView = ref(null)
const previewUrl = ref('')

const days = Array.from({length: 31}, (_, i) => String(i + 1).padStart(2, '0'))
const hours = Array.from({length: 24}, (_, i) => String(i).padStart(2, '0'))
const minutes = Array.from({length: 60}, (_, i) => String(i).padStart(2, '0'))
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
  const y = currentYear - 5 + i
  return { value: String(y), label: String(y + 543) }
})

const formData = ref({
  id: null, event_type_id: '', title: '', description: '', location: '', status: 'รอดำเนินการ',
  start_day: '', start_month: '', start_year: '', start_hour: '08', start_minute: '30',
  end_day: '', end_month: '', end_year: '', end_hour: '16', end_minute: '30',
  files: [], existing_file_paths: [], participants: []
})




const searchQuery = ref('')
const participantSearchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)

const viewParticipantsList = ref([])

// ดึงชื่อไฟล์จาก URL
// ดึงชื่อไฟล์จาก URL และตัดตัวเลข Timestamp ออก
const getFileName = (url) => {
  if (!url) return 'เอกสารแนบ';
  try {
    // 1. ดึงส่วนท้ายสุดของ URL มาแปลงกลับเป็นภาษาไทย
    let filename = decodeURIComponent(url.split('/').pop());
    
    // 2. หาตำแหน่งของเครื่องหมาย _ ตัวแรก (ที่เราตั้งไว้คั่นระหว่าง Timestamp กับ ชื่อไฟล์)
    const firstUnderscoreIndex = filename.indexOf('_');
    
    // 3. ถ้าเจอ _ และอยู่ด้านหน้า (ช่วง Timestamp) ให้ตัดส่วนนั้นทิ้ง
    if (firstUnderscoreIndex > 0 && firstUnderscoreIndex <= 15) {
       filename = filename.substring(firstUnderscoreIndex + 1);
    }
    
    return filename;
  } catch (e) {
    return url.split('/').pop();
  }
};

// เช็คนามสกุลไฟล์เพื่อแสดงไอคอน
const getFileIcon = (url) => {
  if (!url) return '📎';
  const ext = url.split('.').pop().toLowerCase();
  if (ext === 'pdf') return '📄'; 
  if (['doc', 'docx'].includes(ext)) return '📘'; 
  if (['xls', 'xlsx'].includes(ext)) return '📗'; 
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️'; 
  return '📎';
};

// ==========================================
// 2. Computed Properties & Formatting
// ==========================================
// === ฟังก์ชันตรวจสอบกิจกรรมที่ยังไม่ถึง (อนาคต หรือ วันนี้) ===
const isUpcomingEvent = (startDateStr) => {
  if (!startDateStr) return false;
  const eventDate = new Date(startDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // รีเซ็ตเวลาของวันนี้เป็น 00:00:00 เพื่อเทียบเฉพาะวันที่
  return eventDate >= today;
}

// === กรองและเรียงลำดับกิจกรรม ===
const filteredList = computed(() => {
  let result = [...eventList.value]; // คัดลอก Array เพื่อไม่ให้กระทบข้อมูลต้นทาง

  // 1. ค้นหา (Search)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(item => 
      item.title.toLowerCase().includes(q) || (item.location && item.location.toLowerCase().includes(q))
    );
  }

  // 2. เรียงลำดับวันที่จากมากไปน้อย (ใหม่สุดอยู่บน)
  return result.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
})

// กรองรายชื่อ
const filteredSomtopList = computed(() => {
  if (!participantSearchQuery.value) return somtopList.value;
  const q = participantSearchQuery.value.toLowerCase();
  return somtopList.value.filter(p => p.full_name.toLowerCase().includes(q));
})

// เช็คว่าเลือกครบทุกคนหรือยัง
const isAllSelected = computed(() => {
  return filteredSomtopList.value.length > 0 && 
         filteredSomtopList.value.every(p => formData.value.participants.includes(p.id));
})

// ฟังก์ชันเลือกทั้งหมด/ยกเลิกทั้งหมด
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    // ยกเลิกการเลือกคนที่อยู่ในผลการค้นหาปัจจุบัน
    const currentIds = filteredSomtopList.value.map(p => p.id);
    formData.value.participants = formData.value.participants.filter(id => !currentIds.includes(id));
  } else {
    // เลือกทุกคนในผลการค้นหาปัจจุบัน
    filteredSomtopList.value.forEach(p => {
      if (!formData.value.participants.includes(p.id)) {
        formData.value.participants.push(p.id);
      }
    });
  }
}

// const filteredSomtopList = computed(() => {
//   if (!participantSearchQuery.value) return somtopList.value;
//   return somtopList.value.filter(p => p.full_name.toLowerCase().includes(participantSearchQuery.value.toLowerCase()));
// })

const totalPages = computed(() => Math.ceil(filteredList.value.length / itemsPerPage.value) || 1)
const paginatedList = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  return filteredList.value.slice(startIndex, startIndex + itemsPerPage.value);
})

const changePage = (page) => { if (page >= 1 && page <= totalPages.value) currentPage.value = page; }
watch(searchQuery, () => currentPage.value = 1);

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const getStatusClass = (status) => {
  if (status === 'เสร็จสิ้น') return 'active';
  if (status === 'กำลังดำเนินการ') return 'warning';
  if (status === 'ยกเลิก') return 'inactive';
  return '';
}

const parseDateToParts = (dateStr) => {
  if (!dateStr) return { year: '', month: '', day: '', hour: '08', minute: '30' };
  const parts = dateStr.replace('T', ' ').split(' ');
  const dateOnly = parts[0]; 
  const timeOnly = parts[1] || '08:30:00'; 
  const [year, month, day] = dateOnly.split('-');
  const [hour, minute] = timeOnly.split(':');
  return { year, month, day, hour, minute };
}

// ==========================================
// 3. API Actions
// ==========================================
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

const fetchEventTypes = async () => {
  try {
    const response = await api.get('/event-types')
    eventTypes.value = response.data.records || []
  } catch (error) {
    console.error("ดึงข้อมูลประเภทกิจกรรมไม่สำเร็จ:", error)
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

const handleFileUpload = (event) => {
  formData.value.files = Array.from(event.target.files);
}

const saveData = async () => {
  if (isSaving.value) return;
  const sHour = formData.value.start_hour || '00';
  const sMin = formData.value.start_minute || '00';
  const start_date = `${formData.value.start_year}-${formData.value.start_month}-${formData.value.start_day} ${sHour}:${sMin}:00`;
  
  let end_date = null;
  
  // ตรวจสอบว่ามีการกรอกวันที่สิ้นสุดครบถ้วนหรือไม่
  if (formData.value.end_year && formData.value.end_month && formData.value.end_day) {
    const eHour = formData.value.end_hour || '23';
    const eMin = formData.value.end_minute || '59';
    end_date = `${formData.value.end_year}-${formData.value.end_month}-${formData.value.end_day} ${eHour}:${eMin}:59`;
  } else {
    // ⭐️ กรณีไม่กรอก end_date: สร้าง Date Object จากวันที่เริ่มต้นและบวกเพิ่ม 2 ชั่วโมง
    const startDateObj = new Date(
      parseInt(formData.value.start_year),
      parseInt(formData.value.start_month) - 1, // เดือนของ JS เริ่มนับจาก 0
      parseInt(formData.value.start_day),
      parseInt(sHour),
      parseInt(sMin),
      0
    );

    // บวกเวลาเพิ่ม 2 ชั่วโมง
    startDateObj.setHours(startDateObj.getHours() + 2);

    // จัดรูปแบบตัวเลขให้เป็น 2 หลัก (เช่น 09, 14) ก่อนแปลงกลับเป็น String
    const eYear = startDateObj.getFullYear();
    const eMonth = String(startDateObj.getMonth() + 1).padStart(2, '0');
    const eDay = String(startDateObj.getDate()).padStart(2, '0');
    const eHour = String(startDateObj.getHours()).padStart(2, '0');
    const eMinute = String(startDateObj.getMinutes()).padStart(2, '0');
    
    end_date = `${eYear}-${eMonth}-${eDay} ${eHour}:${eMinute}:00`;
  }
    
  isSaving.value = true;
  try {
    const payload = new FormData();
    if (formData.value.id) payload.append('id', formData.value.id);
    payload.append('event_type_id', formData.value.event_type_id);
    payload.append('title', formData.value.title);
    payload.append('description', formData.value.description || '');
    payload.append('location', formData.value.location || '');
    payload.append('status', formData.value.status);
    payload.append('start_date', start_date);
    payload.append('end_date', end_date);
    
    payload.append('participants', JSON.stringify(formData.value.participants || []));
    
    if (formData.value.files && formData.value.files.length > 0) {
      formData.value.files.forEach(file => payload.append('event_files', file));
    }

    const config = { headers: { 'Content-Type': 'multipart/form-data' } };

    if (isEditing.value) {
      await api.put(`/events/${formData.value.id}`, payload, config);
      swalSuccess('บันทึกสำเร็จ', 'อัปเดตข้อมูลกิจกรรมเรียบร้อย');
    } else {
      await api.post('/events', payload, config);
      swalSuccess('บันทึกสำเร็จ', 'สร้างกิจกรรมใหม่เรียบร้อย');
    }
    closeModal();
    fetchEvents();
  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้');
  } finally {
    isSaving.value = false;
  }
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

// ==========================================
// 4. File Management & Inline Deletion
// ==========================================
const deleteFileInline = async (fileUrl) => {
  if (!formData.value.id) return;
  const result = await swalConfirm('ยืนยันการลบไฟล์', 'คุณแน่ใจหรือไม่ว่าต้องการลบเอกสารนี้?');
  if (result.isConfirmed) {
    try {
      await api.post('/events/delete-file', { id: formData.value.id, file_url: fileUrl });
      formData.value.existing_file_paths = formData.value.existing_file_paths.filter(url => url !== fileUrl);
      swalSuccess('ลบไฟล์สำเร็จ', 'เอกสารถูกลบเรียบร้อยแล้ว');
      fetchEvents();
    } catch (error) {
      swalError('ลบไฟล์ไม่สำเร็จ', 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    }
  }
}

const deleteCurrentFile = async () => {
  if (!formData.value.id) return;
  const result = await swalConfirm('ยืนยันการลบไฟล์', 'คุณแน่ใจหรือไม่ว่าต้องการลบเอกสารนี้?');
  if (result.isConfirmed) {
    try {
      await api.post('/events/delete-file', { id: formData.value.id, file_url: previewUrl.value });
      formData.value.existing_file_paths = formData.value.existing_file_paths.filter(url => url !== previewUrl.value);
      closeFilePreview();
      swalSuccess('ลบไฟล์สำเร็จ', 'เอกสารถูกลบเรียบร้อยแล้ว');
      fetchEvents();
    } catch (error) {
      swalError('ลบไฟล์ไม่สำเร็จ', 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    }
  }
}

// ==========================================
// 5. Participants Management
// ==========================================
const openParticipantModal = async (event) => {
  selectedEvent.value = event;
  participantSearchQuery.value = '';
  try {
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
  fetchEvents();
}

const isParticipant = (somtopId) => currentParticipants.value.includes(somtopId);

const toggleParticipant = async (somtopId, isChecked) => {
  try {
    await api.post('/events/participants', {
      event_id: selectedEvent.value.id,
      somtop_id: somtopId,
      action: isChecked ? 'add' : 'remove'
    });
    if (isChecked) currentParticipants.value.push(somtopId);
    else currentParticipants.value = currentParticipants.value.filter(id => id !== somtopId);
  } catch (error) {
    console.error("จัดการผู้เข้าร่วมไม่สำเร็จ:", error);
    swalError('เกิดข้อผิดพลาด', 'ไม่สามารถอัปเดตรายชื่อได้');
  }
}

// ==========================================
// 6. Modal Controls
// ==========================================
const openAddModal = () => {
  isEditing.value = false;
  formData.value = { 
    id: null, event_type_id: '', title: '', description: '', location: '', status: 'รอดำเนินการ',
    start_day: '', start_month: '', start_year: '', start_hour: '08', start_minute: '30',
    end_day: '', end_month: '', end_year: '', end_hour: '16', end_minute: '30',
    files: [], existing_file_paths: [], participants: []
  };
  isModalOpen.value = true;
}

// const openEditModal = (item) => {
//   isEditing.value = true;
//   const startParts = parseDateToParts(item.start_date);
//   const endParts = parseDateToParts(item.end_date);
//   formData.value = { 
//     ...item,
//     start_day: startParts.day, start_month: startParts.month, start_year: startParts.year,
//     start_hour: startParts.hour, start_minute: startParts.minute,
//     end_day: endParts.day, end_month: endParts.month, end_year: endParts.year,
//     end_hour: endParts.hour, end_minute: endParts.minute,
//     files: [], existing_file_paths: item.file_paths || []
//   };
//   isModalOpen.value = true;
// }

const openEditModal = async (item) => {
  isEditing.value = true;
  participantSearchQuery.value = '';
  
  const startParts = parseDateToParts(item.start_date);
  const endParts = parseDateToParts(item.end_date);

  formData.value = { 
    ...item,
    location: item.location || '',
    description: item.description || '',
    start_day: startParts.day, start_month: startParts.month, start_year: startParts.year,
    start_hour: startParts.hour, start_minute: startParts.minute,
    end_day: endParts.day, end_month: endParts.month, end_year: endParts.year,
    end_hour: endParts.hour, end_minute: endParts.minute,
    files: [], existing_file_paths: item.file_paths || [],
    participants: item.participants || [] // เคลียร์ก่อนดึงใหม่
  };
  
  isModalOpen.value = true;

  // ⭐️ ดึงรายชื่อผู้เข้าร่วมเดิมมาแสดงติ๊กถูก
  try {
    const res = await api.get(`/events/${item.id}/participants`);
    formData.value.participants = res.data.records.map(p => p.somtop_id);
  } catch (error) {
    console.error("ดึงข้อมูลผู้เข้าร่วมไม่สำเร็จ", error);
  }
}

// ปรับฟังก์ชันเปิดหน้า View ให้ดึงข้อมูลผู้เข้าร่วมด้วย
const openViewModal = async (eventItem) => {
  selectedEventToView.value = eventItem;
  isViewModalOpen.value = true;
  viewParticipantsList.value = []; // เคลียร์ค่าเก่าก่อน
  
  try {
    const response = await api.get(`/events/${eventItem.id}/participants`);
    viewParticipantsList.value = response.data.records || [];
  } catch (error) {
    console.error("ดึงรายชื่อผู้เข้าร่วมไม่สำเร็จ:", error);
  }
}

const openFilePreview = (url, eventId) => {
  previewUrl.value = url;
  if (eventId) formData.value.id = eventId;
  isPreviewOpen.value = true;
}

const closeModal = () => isModalOpen.value = false;
const closeViewModal = () => { isViewModalOpen.value = false; selectedEventToView.value = null; };
const closeFilePreview = () => { isPreviewOpen.value = false; previewUrl.value = ''; };

onMounted(() => {
  fetchEvents();
  fetchEventTypes();
  fetchSomtopList();
})
</script>

<style scoped>
/* =========================================
   General Elements & Utilities
========================================= */
.text-danger { color: #DC2626; }
.text-muted { color: #9CA3AF; }
.mx-2 { margin: 0 8px; }

.badge-count { 
  background-color: #E0E7FF; 
  color: #4338CA; 
  padding: 4px 10px; 
  border-radius: 20px; 
  font-weight: 600; 
  font-size: 12px; 
  white-space: nowrap;
}

.btn-icon.manage-users { background-color: #E0E7FF; border-color: #C7D2FE; }
.btn-icon.manage-users:hover { background-color: #C7D2FE; }
.btn-icon.view { background-color: #F3F4F6; }
.btn-icon.view:hover { background-color: #E5E7EB; }

/* =========================================
   Form Inputs & Uploads
========================================= */
.date-inputs {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.date-inputs select {
  flex: 1;
  min-width: 60px; 
}
.time-separator {
  color: #6B7280;
  font-size: 13px;
  margin: 0 4px;
}

.upload-section {
  background-color: #F9FAFB;
  padding: 16px;
  border-radius: 8px;
  border: 1px dashed #D1D5DB;
}
.file-list {
  margin-top: 10px;
  padding-left: 0;
  list-style: none;
  font-size: 13px;
  color: #4B5563;
}
.file-list li { margin-bottom: 4px; }
.existing-file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.delete-inline {
  background-color: #FEE2E2;
  color: #EF4444;
  border: none;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}
.delete-inline:hover { background-color: #FCA5A5; }

/* =========================================
   Modals
========================================= */
/* Modal 2: Participant Styling */
.participant-modal { max-width: 500px; }
.participant-content { margin-bottom: 20px; }
.participant-list { max-height: 400px; overflow-y: auto; border: 1px solid #E5E7EB; border-radius: 8px; }
.participant-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #E5E7EB; cursor: pointer; transition: background 0.2s; }
.participant-item:last-child { border-bottom: none; }
.participant-item:hover { background-color: #F9FAFB; }
.participant-item input[type="checkbox"] { width: 18px; height: 18px; accent-color: #10B981; cursor: pointer; }
.person-name { font-size: 14px; font-weight: 500; color: #111827; }

/* Modal 4: View Details Styling */
.detail-modal { max-width: 600px; }
.detail-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: flex-start; 
  margin-bottom: 24px; 
  padding-bottom: 16px; 
  border-bottom: 1px dashed #E5E7EB; 
  gap: 16px;
}
.event-title { 
  font-size: 20px; 
  font-weight: 600; 
  color: #047857;
  margin: 0; 
  line-height: 1.4; 
}
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

.detail-section { margin-bottom: 24px; }
.section-label { font-size: 14px; color: #374151; font-weight: 600; margin-bottom: 8px; display: block; }
.description-box { 
  background: #F9FAFB; 
  padding: 16px; 
  border-radius: 8px; 
  border: 1px solid #E5E7EB; 
  color: #374151; 
  font-size: 14px; 
  white-space: pre-wrap; 
  line-height: 1.6; 
}

/* Modal 4: File Buttons */
.file-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
.file-attachment-btn { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  padding: 14px 16px; 
  background-color: #FFFFFF; 
  border: 1px solid #E5E7EB; 
  border-radius: 8px; 
  cursor: pointer; 
  transition: all 0.2s ease; 
  text-align: left; 
  width: 100%; 
  box-shadow: 0 1px 2px rgba(0,0,0,0.02); 
}
.file-attachment-btn:hover { 
  border-color: #3B82F6; 
  background-color: #EFF6FF; 
  box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1); 
  transform: translateY(-1px);
}
.file-icon { font-size: 20px; }
.file-name { color: #1F2937; font-size: 14px; font-weight: 500; flex: 1; }
.file-action { color: #3B82F6; font-size: 13px; font-weight: 600; opacity: 0; transition: opacity 0.2s; }
.file-attachment-btn:hover .file-action { opacity: 1; }

/* Modal 3: File Preview */
.pdf-modal {
  max-width: 900px;
  height: 80vh;
  display: flex;
  flex-direction: column;
}
.preview-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}
.pdf-container {
  flex: 1;
  background-color: #F3F4F6;
  border-radius: 8px;
  overflow: hidden;
}
/* Participant Tags in View Modal */
.participant-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.participant-tag {
  background-color: #F0FDF4;
  color: #166534;
  border: 1px solid #BBF7D0;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
/* =========================================
   สไตล์สำหรับปุ่มไฟล์แนบ (File Attachments)
========================================= */
.section-label {
  font-size: 14px;
  color: #374151;
  font-weight: 600;
  display: block;
}

.file-grid { 
  display: grid; 
  grid-template-columns: 1fr; 
  gap: 10px; 
  margin-top: 8px;
}

.file-attachment-btn { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  padding: 12px 16px; 
  background-color: #FFFFFF; 
  border: 1px solid #E5E7EB; 
  border-radius: 8px; 
  cursor: pointer; 
  transition: all 0.2s ease; 
  text-align: left; 
  width: 100%; 
  box-shadow: 0 1px 2px rgba(0,0,0,0.02); 
}

/* เอฟเฟกต์เมื่อเมาส์ชี้ (Hover) จะเปลี่ยนเป็นสีฟ้าและยกตัวขึ้นเล็กน้อย */
.file-attachment-btn:hover { 
  border-color: #BFDBFE; 
  background-color: #EFF6FF; 
  box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1); 
  transform: translateY(-1px);
}

.file-icon { 
  font-size: 20px; 
  flex-shrink: 0;
}

/* ตั้งค่าให้ชื่อไฟล์ตัดจบด้วย ... หากชื่อยาวเกินไป */
.file-name { 
  color: #3B82F6; 
  font-size: 14px; 
  font-weight: 500; 
  flex: 1; 
  overflow: hidden; 
  text-overflow: ellipsis; 
  white-space: nowrap; 
}

.file-action { 
  color: #3B82F6; 
  font-size: 13px; 
  font-weight: 600; 
  opacity: 0; 
  transition: opacity 0.2s; 
}

.file-attachment-btn:hover .file-action { 
  opacity: 1; 
}
/* =========================================
   สไตล์ไฮไลต์กิจกรรมที่ยังไม่ถึง (Upcoming)
========================================= */
.data-row.upcoming-row td {
  background-color: #F0FDF4; /* พื้นหลังสีเขียวพาสเทลอ่อนมาก */
}

/* สร้างแถบสีเขียวที่ขอบซ้ายของคอลัมน์แรก */
.data-row.upcoming-row td:first-child {
  border-left: 4px solid #10B981; 
}

/* เอฟเฟกต์ตอนนำเมาส์ไปชี้ */
.data-row.upcoming-row:hover td {
  background-color: #DCFCE7; 
}

/* =========================================
   Participant Selection Section
========================================= */
.participant-selection-section {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.section-header label { margin: 0; }
.btn-select-all {
  background: #EFF6FF;
  color: #3B82F6;
  border: 1px solid #BFDBFE;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-select-all:hover { background: #DBEAFE; }

.participant-search { margin-bottom: 12px; }

.participant-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  max-height: 250px;
  overflow-y: auto;
  padding-right: 4px;
}

.participant-checkbox-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #FFFFFF;
  border: 1px solid #D1D5DB;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.participant-checkbox-card:hover { border-color: #9CA3AF; }
.participant-checkbox-card.selected {
  background: #F0FDF4;
  border-color: #10B981;
}
.participant-checkbox-card input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #10B981;
  cursor: pointer;
}
.person-name { font-size: 13px; font-weight: 500; color: #374151; }
.no-results-msg { text-align: center; color: #9CA3AF; grid-column: 1 / -1; padding: 12px; }
</style>