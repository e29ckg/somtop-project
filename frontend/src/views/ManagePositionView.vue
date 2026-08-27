<template>
  <div class="manage-layout">
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">จัดการตำแหน่ง พ.สมทบ</h1>
        <p class="page-subtitle">เพิ่ม ลบ แก้ไข ข้อมูลตำแหน่งและระดับความสำคัญ (เฉพาะผู้ดูแลระบบ)</p>
      </div>
      <button class="btn-primary" @click="openAddModal">
        + เพิ่มตำแหน่ง
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
          <input type="text" v-model="searchQuery" placeholder="🔍 ค้นหาชื่อตำแหน่ง..." class="search-input" />
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th width="120">ระดับ (Level)</th>
              <th>ชื่อตำแหน่ง</th>
              <th width="150">สถานะ</th>
              <th width="120" class="no-print">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="4" class="text-center py-8">
                <div class="loading-spinner"></div>
                <div class="text-muted mt-2">กำลังดึงข้อมูล...</div>
              </td>
            </tr>
            <template v-else>
              <tr v-for="position in paginatedList" :key="position.id" class="data-row">
                <td class="font-mono font-bold text-center">
                  <span class="badge-level">Lv. {{ position.level }}</span>
                </td>
                <td class="font-bold">{{ position.name }}</td>
                <td>
                  <span class="status-badge" :class="position.status === 'ใช้งาน' ? 'active' : 'inactive'">
                    {{ position.status }}
                  </span>
                </td>
                <td class="no-print">
                  <div class="action-buttons">
                    <button class="btn-icon edit" @click="openEditModal(position)" title="แก้ไข">✏️</button>
                    <button class="btn-icon delete" @click="deleteData(position.id)" title="ลบ">🗑️</button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredList.length === 0">
                <td colspan="4" class="text-center text-muted">ไม่พบข้อมูลที่ค้นหา</td>
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
      <div class="modal-card" style="max-width: 450px;">
        <div class="modal-header">
          <h2>{{ isEditing ? 'แก้ไขข้อมูลตำแหน่ง' : 'เพิ่มตำแหน่งใหม่' }}</h2>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        
        <form @submit.prevent="saveData" class="form-grid">
          
          <div class="input-group full-width">
            <label>ชื่อตำแหน่ง <span style="color: #DC2626;">*</span></label>
            <input type="text" v-model="formData.name" required placeholder="เช่น ประธานผู้พิพากษาสมทบ" />
          </div>

          <div class="input-group">
            <label>ระดับความสำคัญ (Level)</label>
            <input type="number" v-model="formData.level" min="1" required placeholder="เช่น 1 (สูงสุด)" />
            <small class="text-muted">เลขยิ่งน้อย ยิ่งอาวุโสมาก</small>
          </div>

          <div class="input-group">
            <label>สถานะ</label>
            <select v-model="formData.status">
              <option value="ใช้งาน">ใช้งาน</option>
              <option value="ระงับ">ระงับ</option>
            </select>
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

const dataList = ref([])
const isLoading = ref(false)
const isModalOpen = ref(false)
const isEditing = ref(false)

const formData = ref({ id: null, name: '', level: 99, status: 'ใช้งาน' })

const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)

const filteredList = computed(() => {
  if (!searchQuery.value) return dataList.value;
  const q = searchQuery.value.toLowerCase()
  return dataList.value.filter(item => item.name.toLowerCase().includes(q));
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
  isLoading.value = true
  try {
    const response = await api.get('/positions/admin') 
    dataList.value = response.data.records || []
  } catch (error) {
    console.error("ดึงข้อมูลไม่สำเร็จ:", error)
  } finally {
    isLoading.value = false
  }
}

const saveData = async () => {
  try {
    if (isEditing.value) {
      await api.put('/positions/admin', formData.value)
      swalSuccess('บันทึกสำเร็จ', 'อัปเดตข้อมูลตำแหน่งเรียบร้อย')
    } else {
      await api.post('/positions/admin', formData.value)
      swalSuccess('บันทึกสำเร็จ', 'เพิ่มตำแหน่งใหม่เรียบร้อย')
    }
    closeModal()
    fetchData()
  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้')
  }
}

const deleteData = async (id) => {
  const result = await swalConfirm('ยืนยันการลบ', 'คุณแน่ใจหรือไม่ว่าต้องการลบตำแหน่งนี้?')
  if(result.isConfirmed) {
    try {
      await api.delete(`/positions/admin/${id}`)
      swalSuccess('ลบสำเร็จ', 'ลบข้อมูลเรียบร้อยแล้ว')
      fetchData()
    } catch (error) {
      swalError('ลบข้อมูลไม่สำเร็จ', error.response?.data?.message || 'ไม่สามารถลบข้อมูลได้')
    }
  }
}

const openAddModal = () => {
  isEditing.value = false
  formData.value = { id: null, name: '', level: 99, status: 'ใช้งาน' }
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

<style scoped>
.badge-level {
  background-color: #E0E7FF;
  color: #4338CA;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
}
</style>