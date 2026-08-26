<template>
  <div class="manage-layout">
    <!-- Header -->
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">จัดการข้อมูลศาล</h1>
        <p class="page-subtitle">เพิ่ม ลบ แก้ไข ข้อมูลหน่วยงานศาลในระบบ (เฉพาะผู้ดูแลระบบ)</p>
      </div>
      <button class="btn-primary" @click="openAddModal">
        + เพิ่มข้อมูลศาล
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
            placeholder="🔍 ค้นหาชื่อศาล หรือ รหัสศาล..." 
            class="search-input"
          />
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>รหัสศาล</th>
              <th>ชื่อศาล</th>
              <th>จังหวัด</th>
              <th>เบอร์โทร</th>
              <th>สถานะ</th>
              <th class="no-print">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="6" class="text-center py-8">
                <div class="loading-spinner"></div>
                <div class="text-muted mt-2">กำลังดึงข้อมูลจากเซิร์ฟเวอร์...</div>
              </td>
            </tr>
            
            <template v-else>
              <tr v-for="court in paginatedList" :key="court.id" class="data-row">
                <td class="font-mono font-bold">{{ court.court_code.toUpperCase() }}</td>
                <td class="full-name">{{ court.court_name }}</td>
                <td>{{ court.province || '-' }}</td>
                <td>{{ court.phone || '-' }}</td>
                <td>
                  <span class="status-badge" :class="court.status === 'ใช้งาน' ? 'active' : 'inactive'">
                    {{ court.status }}
                  </span>
                </td>
                <td class="no-print">
                  <div class="action-buttons">
                    <button class="btn-icon edit" @click="openEditModal(court)" title="แก้ไข">✏️</button>
                    <button class="btn-icon delete" @click="deleteData(court.id)" title="ลบ">🗑️</button>
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
          <button 
            v-for="page in totalPages" :key="page" 
            class="page-btn" :class="{ 'active': currentPage === page }"
            @click="changePage(page)">
            {{ page }}
          </button>
          <button class="page-btn" :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">&raquo;</button>
        </div>
      </div>
    </div>

    <!-- Modal Form -->
    <div v-if="isModalOpen" class="modal-overlay no-print">
      <div class="modal-card">
        <div class="modal-header">
          <h2>{{ isEditing ? 'แก้ไขข้อมูลศาล' : 'เพิ่มข้อมูลศาลใหม่' }}</h2>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        
        <form @submit.prevent="saveData" class="form-grid">
          
          <div class="input-group">
            <label>รหัสศาล (Court Code)</label>
            <input type="text" v-model="formData.court_code" required placeholder="เช่น pkkjc" class="font-mono" />
          </div>

          <div class="input-group">
            <label>สถานะ</label>
            <select v-model="formData.status">
              <option value="ใช้งาน">ใช้งาน (Active)</option>
              <option value="ระงับ">ระงับ (Inactive)</option>
            </select>
          </div>
          
          <div class="input-group full-width">
            <label>ชื่อศาล</label>
            <input type="text" v-model="formData.court_name" required placeholder="เช่น ศาลเยาวชนและครอบครัวจังหวัดประจวบคีรีขันธ์" />
          </div>

          <div class="input-group">
            <label>จังหวัด</label>
            <input type="text" v-model="formData.province" placeholder="เช่น ประจวบคีรีขันธ์" />
          </div>

          <div class="input-group">
            <label>เบอร์โทรศัพท์</label>
            <input type="text" v-model="formData.phone" />
          </div>

          <div class="input-group full-width">
            <label>อีเมลติดต่อ (ถ้ามี)</label>
            <input type="email" v-model="formData.email" placeholder="example@coj.go.th" />
          </div>

          <div class="input-group full-width">
            <label>ที่อยู่ศาล</label>
            <textarea v-model="formData.address" rows="2" placeholder="รายละเอียดที่อยู่..."></textarea>
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

// ==========================================
// 1. ตัวแปร State
// ==========================================
const dataList = ref([])
const isModalOpen = ref(false)
const isEditing = ref(false)
const isLoading = ref(false)

const formData = ref({
  id: null, 
  court_code: '', 
  court_name: '', 
  address: '', 
  phone: '', 
  email: '', 
  province: '', 
  status: 'ใช้งาน'
})

// ==========================================
// 2. ระบบค้นหา & แบ่งหน้า
// ==========================================
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)

const filteredList = computed(() => {
  if (!searchQuery.value) return dataList.value;
  const q = searchQuery.value.toLowerCase()
  return dataList.value.filter(item => 
    item.court_name.toLowerCase().includes(q) ||
    item.court_code.toLowerCase().includes(q)
  );
})

const totalPages = computed(() => Math.ceil(filteredList.value.length / itemsPerPage.value) || 1)
const paginatedList = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  return filteredList.value.slice(startIndex, startIndex + itemsPerPage.value);
})
const changePage = (page) => { if (page >= 1 && page <= totalPages.value) currentPage.value = page; }
watch(searchQuery, () => currentPage.value = 1);

// ==========================================
// 3. ฟังก์ชัน API
// ==========================================
const fetchData = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/courts')
    dataList.value = response.data.records || []
  } catch (error) {
    console.error("ดึงข้อมูลไม่สำเร็จ:", error)
  } finally {
    isLoading.value = false
  }
}

const saveData = async () => {
  try {
    const payload = { ...formData.value }

    if (isEditing.value) {
      await api.put('/courts', payload)
      swalSuccess('บันทึกสำเร็จ', 'อัปเดตข้อมูลศาลเรียบร้อย')
    } else {
      await api.post('/courts', payload)
      swalSuccess('บันทึกสำเร็จ', 'เพิ่มข้อมูลศาลใหม่เรียบร้อย')
    }
    
    closeModal()
    fetchData()
  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้')
  }
}

const deleteData = async (id) => {
  const result = await swalConfirm('ยืนยันการลบ', 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลศาลนี้?')
  if (result.isConfirmed) {
    try {
      // Backend รับเป็น Parameter ตาม /:id
      await api.delete(`/courts/${id}`)
      swalSuccess('ลบข้อมูลสำเร็จ', 'ข้อมูลถูกลบทิ้งแล้ว')
      fetchData()
    } catch (error) {
      swalError('ลบข้อมูลไม่สำเร็จ', error.response?.data?.message || 'ไม่สามารถลบข้อมูลได้')
    }
  }
}

// ==========================================
// 4. ฟังก์ชันควบคุม Modal
// ==========================================
const openAddModal = () => {
  isEditing.value = false
  formData.value = { 
    id: null, court_code: '', court_name: '', address: '', phone: '', email: '', province: '', status: 'ใช้งาน' 
  }
  isModalOpen.value = true
}

const openEditModal = (item) => {
  isEditing.value = true
  formData.value = { ...item }
  isModalOpen.value = true
}

const closeModal = () => isModalOpen.value = false

onMounted(() => {
  fetchData()
})
</script>