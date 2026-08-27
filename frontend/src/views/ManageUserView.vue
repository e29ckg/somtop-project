<template>
  <div class="manage-layout">
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">จัดการผู้ใช้งานระบบ</h1>
        <p class="page-subtitle">เพิ่ม ลบ แก้ไข และกำหนดสิทธิ์การใช้งานของเจ้าหน้าที่</p>
      </div>
      <button class="btn-primary" @click="openAddModal">
        + เพิ่มผู้ใช้งาน
      </button>
    </div>

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
          <input type="text" v-model="searchQuery" placeholder="🔍 ค้นหาชื่อ หรือ Username..." class="search-input" />
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>ชื่อผู้ใช้ (Username)</th>
              <th>ชื่อ-สกุล</th>
              <th>รหัสศาล</th> 
              <th>สิทธิ์การใช้งาน (Role)</th>
              <th>เข้าสู่ระบบล่าสุด</th>
              <th class="no-print">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in paginatedList" :key="user.id" class="data-row">
              <td class="font-mono">{{ user.username }}</td>
              <td class="full-name">{{ user.full_name }} 
                <span v-if="isUserLocked(user.lockout_until)" class="locked-badge">
                  🔒 ระงับการใช้งาน
                </span>
              </td>
              <td class="font-mono font-bold">{{ user.court_code ? user.court_code.toUpperCase() : '-' }}</td>
              <td>
                <span class="status-badge" :class="user.role === 'admin' ? 'active' : 'warning'">
                  {{ user.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้งาน (Viewer)' }}
                </span>
              </td>
              <td class="text-muted">{{ user.last_login || '-' }}</td>
              <td class="no-print">
                <div class="action-buttons">
                  <button 
                    v-if="isUserLocked(user.lockout_until)" 
                    class="btn-icon unlock-active" 
                    @click="unlockAccount(user.id)" 
                    title="ปลดล็อกบัญชี"
                  >
                    🔓
                  </button>
                  <button class="btn-icon edit" @click="openEditModal(user)" title="แก้ไข">✏️</button>
                  <button class="btn-icon delete" @click="deleteData(user.id)" title="ลบ">🗑️</button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredList.length === 0">
              <td colspan="6" class="text-center text-muted">ไม่พบข้อมูลที่ค้นหา</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination-container no-print" v-if="filteredList.length > 0">
        <div class="pagination-info">
          แสดง {{ (currentPage - 1) * itemsPerPage + 1 }} ถึง {{ Math.min(currentPage * itemsPerPage, filteredList.length) }} จากทั้งหมด {{ filteredList.length }} รายการ
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
      <div class="modal-card">
        <div class="modal-header">
          <h2>{{ isEditing ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่' }}</h2>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        
        <form @submit.prevent="saveData" class="form-grid">
          
          <div class="input-group">
            <label>ชื่อผู้ใช้ (Username)</label>
            <input type="text" v-model="formData.username" required :disabled="isEditing" placeholder="ภาษาอังกฤษหรือตัวเลข" />
            <small v-if="isEditing" class="text-muted">ไม่สามารถแก้ไขชื่อผู้ใช้ได้</small>
          </div>

          <div class="input-group">
            <label>รหัสผ่าน</label>
            <input type="password" v-model="formData.password" :required="!isEditing" :placeholder="isEditing ? 'ปล่อยว่างไว้หากไม่ต้องการเปลี่ยน' : 'รหัสผ่านสำหรับเข้าสู่ระบบ'" />
          </div>
          
          <div class="input-group full-width">
            <label>ชื่อ-สกุล</label>
            <input type="text" v-model="formData.full_name" required />
          </div>
          
          <div class="input-group">
            <label>สิทธิ์การใช้งาน (Role)</label>
            <select v-model="formData.role">
              <option value="viewer">ผู้ใช้งานทั่วไป (Viewer) - จัดการข้อมูล พ.สมทบได้</option>
              <option value="admin">ผู้ดูแลระบบ (Admin) - ดูแลระบบและจัดการผู้ใช้งานได้</option>
            </select>
          </div>

          <div class="input-group searchable-select">
            <label>รหัสศาล (Court Code) <span style="color: #DC2626;">*</span></label>
            <input 
              type="text" 
              v-model="courtSearchQuery" 
              @focus="isCourtDropdownOpen = true" 
              @blur="closeCourtDropdown" 
              placeholder="พิมพ์ค้นหารหัส หรือชื่อศาล..." 
              class="font-mono"
              required
            />
            <ul v-if="isCourtDropdownOpen" class="search-dropdown">
              <li @mousedown.prevent="selectCourt(null)" class="text-muted">
                -- ไม่ระบุ (เว้นว่าง) --
              </li>
              <li 
                v-for="court in filteredCourtList" 
                :key="court.id" 
                @mousedown.prevent="selectCourt(court)"
              >
                <span class="font-bold">{{ court.court_code.toUpperCase() }}</span> - {{ court.court_name }}
              </li>
              <li v-if="filteredCourtList.length === 0" class="no-results">
                ไม่พบข้อมูลศาลที่ค้นหา
              </li>
            </ul>
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

const dataList = ref([])
const isModalOpen = ref(false)
const isEditing = ref(false)

// === State สำหรับตารางศาล ===
const courtList = ref([])
const courtSearchQuery = ref('')
const isCourtDropdownOpen = ref(false)

// ดึงข้อมูลศาลจาก Backend
const fetchCourts = async () => {
  try {
    const response = await api.get('/courts')
    courtList.value = response.data.records || []
  } catch (error) {
    console.error("ดึงข้อมูลศาลไม่สำเร็จ:", error)
  }
}

// กรองรายชื่อศาลอัตโนมัติ
const filteredCourtList = computed(() => {
  if (!courtSearchQuery.value) return courtList.value;
  const q = courtSearchQuery.value.toLowerCase();
  return courtList.value.filter(c => 
    c.court_code.toLowerCase().includes(q) || 
    c.court_name.toLowerCase().includes(q)
  );
})

// เมื่อคลิกเลือกศาลจาก Dropdown
const selectCourt = (court) => {
  if (!court) {
    formData.value.court_code = '';
    courtSearchQuery.value = '';
  } else {
    formData.value.court_code = court.court_code;
    courtSearchQuery.value = `${court.court_code.toUpperCase()} - ${court.court_name}`;
  }
  isCourtDropdownOpen.value = false;
}

// ปิด Dropdown เมื่อคลิกที่อื่น
const closeCourtDropdown = () => {
  setTimeout(() => {
    isCourtDropdownOpen.value = false;
    if (!formData.value.court_code) {
      courtSearchQuery.value = '';
    } else {
      const selected = courtList.value.find(c => c.court_code === formData.value.court_code);
      if (selected) courtSearchQuery.value = `${selected.court_code.toUpperCase()} - ${selected.court_name}`;
    }
  }, 200); 
}

const formData = ref({
  id: null, username: '', password: '', full_name: '', role: 'viewer', court_code: ''
})

const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)

const filteredList = computed(() => {
  if (!searchQuery.value) return dataList.value;
  return dataList.value.filter(item => 
    item.full_name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    item.username.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    (item.court_code && item.court_code.toLowerCase().includes(searchQuery.value.toLowerCase()))
  );
})

const totalPages = computed(() => Math.ceil(filteredList.value.length / itemsPerPage.value) || 1)
const paginatedList = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  return filteredList.value.slice(startIndex, startIndex + itemsPerPage.value);
})
const changePage = (page) => { if (page >= 1 && page <= totalPages.value) currentPage.value = page; }
watch(searchQuery, () => currentPage.value = 1);

// === ฟังก์ชัน API ===
const fetchData = async () => {
  try {
    const response = await api.get('/users') 
    dataList.value = response.data.records || []
  } catch (error) {
    console.error("ดึงข้อมูลไม่สำเร็จ:", error)
  }
}

const saveData = async () => {
  if (!formData.value.court_code) {
    swalError('ข้อมูลไม่ครบถ้วน', 'กรุณาพิมพ์ค้นหาและคลิกเลือกรหัสศาลจากรายการที่ปรากฏขึ้นมา');
    return;
  }
  
  try {
    const payload = { ...formData.value }

    if (isEditing.value) {
      await api.put('/users', payload)
      swalSuccess('บันทึกสำเร็จ', 'อัปเดตข้อมูลผู้ใช้งานเรียบร้อย')
    } else {
      await api.post('/users', payload)
      swalSuccess('บันทึกสำเร็จ', 'เพิ่มผู้ใช้งานใหม่เรียบร้อย')
    }
    closeModal()
    fetchData()
  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้')
  }
}

const deleteData = async (id) => {
  const result = await swalConfirm('ยืนยันการลบ', 'คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้งานรายนี้?')
  if(result.isConfirmed) {
    try {
      // ⭐️ ปรับให้ส่งผ่าน URL Params ตรงตามมาตรฐาน REST API
      await api.delete(`/users/${id}`)
      swalSuccess('ลบสำเร็จ', 'ข้อมูลผู้ใช้งานถูกลบทิ้งแล้ว')
      fetchData()
    } catch (error) {
      swalError('ลบข้อมูลไม่สำเร็จ', error.response?.data?.message || 'ไม่สามารถลบข้อมูลได้')
    }
  }
}

// ⭐️ เพิ่มฟังก์ชันยิง API ปลดล็อกผู้ใช้งาน
const unlockAccount = async (id) => {
  const result = await swalConfirm('ยืนยันการปลดล็อก', 'คุณต้องการปลดล็อกการระงับเข้าสู่ระบบ สำหรับผู้ใช้งานรายนี้หรือไม่?')
  if(result.isConfirmed) {
    try {
      await api.put('/users/unlock', { id: id })
      swalSuccess('สำเร็จ', 'ปลดล็อกบัญชีผู้ใช้งานเรียบร้อยแล้ว')
      fetchData()
    } catch (error) {
      swalError('ผิดพลาด', error.response?.data?.message || 'ไม่สามารถปลดล็อกบัญชีได้')
    }
  }
}

const openAddModal = () => {
  isEditing.value = false;
  courtSearchQuery.value = ''; 
  formData.value = { id: null, username: '', password: '', full_name: '', role: 'viewer', court_code: '' };
  isModalOpen.value = true;
}

const openEditModal = (item) => {
  isEditing.value = true;
  
  if (item.court_code) {
    const selected = courtList.value.find(c => c.court_code.toLowerCase() === item.court_code.toLowerCase());
    courtSearchQuery.value = selected ? `${selected.court_code.toUpperCase()} - ${selected.court_name}` : item.court_code;
  } else {
    courtSearchQuery.value = '';
  }

  formData.value = { 
    id: item.id, username: item.username, password: '', full_name: item.full_name, role: item.role, court_code: item.court_code || '' 
  };
  isModalOpen.value = true;
}

const closeModal = () => isModalOpen.value = false

const isUserLocked = (lockoutUntil) => {
  if (!lockoutUntil) return false;
  // เทียบเวลา lockout_until กับเวลาปัจจุบัน
  return new Date(lockoutUntil) > new Date();
};

onMounted(() => {
  fetchData()
  fetchCourts()
})
</script>

<style scoped>
/* === Searchable Select === */
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

/* === สถานะการล็อกบัญชี === */
.locked-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background-color: #FEE2E2;
  color: #DC2626;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  margin-left: 8px;
  vertical-align: middle;
}

.row-locked td {
  background-color: #FEF2F2 !important; /* เปลี่ยนสีพื้นหลังแถวให้เป็นสีแดงอ่อนมาก */
}

/* เน้นปุ่มปลดล็อกให้เป็นสีส้ม/เหลือง สังเกตง่าย */
.btn-icon.unlock-active {
  background-color: #FEF3C7;
  border-color: #FDE68A;
}
.btn-icon.unlock-active:hover {
  background-color: #FDE68A;
}
</style>