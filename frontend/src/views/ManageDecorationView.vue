<template>
  <div class="manage-layout">
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">จัดการชั้นตราเครื่องราชอิสริยาภรณ์</h1>
        <p class="page-subtitle">เพิ่ม ลบ แก้ไข ข้อมูลชั้นตรา และจัดลำดับเกียรติยศ (เฉพาะผู้ดูแลระบบ)</p>
      </div>
      <button class="btn-primary" @click="openAddModal">
        + เพิ่มชั้นตรา
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
          <input type="text" v-model="searchQuery" placeholder="🔍 ค้นหาชื่อชั้นตรา หรือชื่อย่อ..." class="search-input" />
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th width="100" class="text-center">ลำดับที่</th>
              <th>ชื่อเต็มชั้นตรา</th>
              <th>ชื่อย่อ</th>
              <th width="120">สถานะ</th>
              <th width="120" class="no-print text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="5" class="text-center py-8">
                <div class="loading-spinner"></div>
                <div class="text-muted mt-2">กำลังดึงข้อมูล...</div>
              </td>
            </tr>
            <template v-else>
              <tr v-for="dec in paginatedList" :key="dec.id" class="data-row">
                <td class="font-mono font-bold text-center">
                  <span class="badge-level">ลำดับ {{ dec.sort_order }}</span>
                </td>
                <td class="font-bold" style="color: #047857;">{{ dec.name }}</td>
                <td>{{ dec.short_name || '-' }}</td>
                <td>
                  <span class="status-badge" :class="dec.status === 'ใช้งาน' ? 'active' : 'inactive'">
                    {{ dec.status }}
                  </span>
                </td>
                <td class="no-print text-center">
                  <div class="action-buttons justify-center">
                    <button class="btn-icon edit" @click="openEditModal(dec)" title="แก้ไข">✏️</button>
                    <button class="btn-icon delete" @click="deleteData(dec.id)" title="ลบ">🗑️</button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredList.length === 0">
                <td colspan="5" class="text-center text-muted">ไม่พบข้อมูลชั้นตราที่ค้นหา</td>
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
          <h2>{{ isEditing ? 'แก้ไขข้อมูลชั้นตรา' : 'เพิ่มชั้นตราใหม่' }}</h2>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        
        <form @submit.prevent="saveData" class="form-grid">
          
          <div class="input-group full-width">
            <label>ชื่อเต็มชั้นตรา <span class="text-danger">*</span></label>
            <input type="text" v-model="formData.name" required placeholder="เช่น ประถมาภรณ์ช้างเผือก" />
          </div>

          <div class="input-group">
            <label>ชื่อย่อ</label>
            <input type="text" v-model="formData.short_name" placeholder="เช่น ป.ช." />
          </div>

          <div class="input-group">
            <label>ลำดับเกียรติยศ</label>
            <input type="number" v-model="formData.sort_order" min="1" required />
            <small class="text-muted">เลขยิ่งน้อย ยิ่งอยู่สูง</small>
          </div>

          <div class="input-group full-width">
            <label>สถานะ</label>
            <select v-model="formData.status">
              <option value="ใช้งาน">ใช้งาน (แสดงในหน้าเพิ่ม พ.สมทบ)</option>
              <option value="ระงับ">ระงับ (ซ่อนไว้)</option>
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

const formData = ref({ id: null, name: '', short_name: '', sort_order: 99, status: 'ใช้งาน' })

const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)

const filteredList = computed(() => {
  if (!searchQuery.value) return dataList.value;
  const q = searchQuery.value.toLowerCase()
  return dataList.value.filter(item => 
    item.name.toLowerCase().includes(q) || 
    (item.short_name && item.short_name.toLowerCase().includes(q))
  );
})

const totalPages = computed(() => Math.ceil(filteredList.value.length / itemsPerPage.value) || 1)
const paginatedList = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  return filteredList.value.slice(startIndex, startIndex + itemsPerPage.value);
})
const changePage = (page) => { if (page >= 1 && page <= totalPages.value) currentPage.value = page; }
watch(searchQuery, () => currentPage.value = 1);

// === ฟังก์ชัน API สำหรับ Admin ===
const fetchData = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/decorations/admin') 
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
      await api.put('/decorations/admin', formData.value)
      swalSuccess('บันทึกสำเร็จ', 'อัปเดตข้อมูลชั้นตราเรียบร้อย')
    } else {
      await api.post('/decorations/admin', formData.value)
      swalSuccess('บันทึกสำเร็จ', 'เพิ่มชั้นตราใหม่เรียบร้อย')
    }
    closeModal()
    fetchData()
  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้')
  }
}

const deleteData = async (id) => {
  const result = await swalConfirm('ยืนยันการลบ', 'คุณแน่ใจหรือไม่ว่าต้องการลบชั้นตรานี้?')
  if(result.isConfirmed) {
    try {
      await api.delete('/decorations/admin', { data: { id: id } })
      swalSuccess('ลบสำเร็จ', 'ลบข้อมูลเรียบร้อยแล้ว')
      fetchData()
    } catch (error) {
      swalError('ลบข้อมูลไม่สำเร็จ', error.response?.data?.message || 'ไม่สามารถลบได้ (อาจถูกใช้งานในประวัติ พ.สมทบ แล้ว)')
    }
  }
}

const openAddModal = () => {
  isEditing.value = false
  formData.value = { id: null, name: '', short_name: '', sort_order: 99, status: 'ใช้งาน' }
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
  background-color: #FEF3C7;
  color: #D97706;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
}
.justify-center {
  justify-content: center;
}
</style>