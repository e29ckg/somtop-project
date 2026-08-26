<template>
  <div class="manage-layout">
    <!-- ==========================================
         1. ส่วนหัวหน้าเพจ (Header & Add Button)
    =========================================== -->
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">หัวข้อหน้าเพจ</h1>
        <p class="page-subtitle">คำอธิบายรายละเอียดของหน้านี้</p>
      </div>
      <button class="btn-primary" @click="openAddModal">
        + เพิ่มข้อมูลใหม่
      </button>
    </div>

    <!-- ==========================================
         2. ส่วนแสดงผลตาราง (Table Area)
    =========================================== -->
    <div class="card table-card">
      
      <!-- 2.1 แถบควบคุม: เลือกจำนวนรายการ และ ค้นหา -->
      <div class="table-header-actions no-print">
        <div class="items-per-page-selector">
          <label>แสดง</label>
          <select v-model="itemsPerPage" @change="currentPage = 1" class="per-page-select">
            <option :value="5">5</option>
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
            placeholder="🔍 ค้นหาข้อมูล..." 
            class="search-input"
          />
        </div>
      </div>

      <!-- 2.2 ตารางข้อมูล -->
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>คอลัมน์ 1</th>
              <th>คอลัมน์ 2</th>
              <th>สถานะ</th>
              <th class="no-print">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in paginatedList" :key="item.id" class="data-row">
              <td>{{ item.field_1 }}</td>
              <td>{{ item.field_2 }}</td>
              <td>
                <span class="status-badge" :class="item.status === 'ใช้งาน' ? 'active' : 'inactive'">
                  {{ item.status }}
                </span>
              </td>
              <td class="no-print">
                <div class="action-buttons">
                  <button class="btn-icon edit" @click="openEditModal(item)" title="แก้ไข">✏️</button>
                  <button class="btn-icon delete" @click="deleteData(item.id)" title="ลบ">🗑️</button>
                </div>
              </td>
            </tr>
            <!-- กรณีไม่มีข้อมูล -->
            <tr v-if="filteredList.length === 0">
              <td colspan="4" class="text-center text-muted">ไม่พบข้อมูลที่ค้นหา</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 2.3 ระบบแบ่งหน้า (Pagination) -->
      <div class="pagination-container no-print" v-if="filteredList.length > 0">
        <div class="pagination-info">
          แสดง {{ (currentPage - 1) * itemsPerPage + 1 }} ถึง 
          {{ Math.min(currentPage * itemsPerPage, filteredList.length) }} 
          จากทั้งหมด {{ filteredList.length }} รายการ
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

    <!-- ==========================================
         3. ส่วนฟอร์มเพิ่ม/แก้ไข (Modal)
    =========================================== -->
    <div v-if="isModalOpen" class="modal-overlay no-print">
      <div class="modal-card">
        <div class="modal-header">
          <h2>{{ isEditing ? 'แก้ไขข้อมูล' : 'เพิ่มข้อมูลใหม่' }}</h2>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        
        <form @submit.prevent="saveData" class="form-grid">
          
          <div class="input-group full-width">
            <label>ฟิลด์ข้อมูล 1</label>
            <input type="text" v-model="formData.field1" required />
          </div>
          
          <div class="input-group">
            <label>สถานะ</label>
            <select v-model="formData.status">
              <option value="ใช้งาน">ใช้งาน (Active)</option>
              <option value="ระงับ">ระงับ (Inactive)</option>
            </select>
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
// 1. ตัวแปร State (ข้อมูลและ UI)
// ==========================================
const dataList = ref([])
const isModalOpen = ref(false)
const isEditing = ref(false)

const formData = ref({
  id: null, 
  field1: '', 
  status: 'ใช้งาน'
})

// ==========================================
// 2. ระบบค้นหา & แบ่งหน้า (Pagination)
// ==========================================
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)

// กรองข้อมูล (เปลี่ยน field1 เป็นฟิลด์ที่คุณต้องการค้นหา)
const filteredList = computed(() => {
  if (!searchQuery.value) return dataList.value;
  return dataList.value.filter(item => 
    item.field1.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
})

const totalPages = computed(() => {
  return Math.ceil(filteredList.value.length / itemsPerPage.value) || 1;
})

const paginatedList = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  return filteredList.value.slice(startIndex, startIndex + itemsPerPage.value);
})

const changePage = (page) => {
  if (page >= 1 && page <= totalPages.value) currentPage.value = page;
}

// รีเซ็ตหน้าเมื่อพิมพ์ค้นหาใหม่
watch(searchQuery, () => currentPage.value = 1);

// ==========================================
// 3. ฟังก์ชัน API (ติดต่อ Database)
// ==========================================
// ดึงข้อมูล
const fetchData = async () => {
  try {
    const response = await api.get('/your_endpoint/index.php')
    dataList.value = response.data.records || []
  } catch (error) {
    console.error("ดึงข้อมูลไม่สำเร็จ:", error)
  }
}

// บันทึกข้อมูล (เพิ่ม/อัปเดต)
const saveData = async () => {
  try {
    const payload = {
      id: formData.value.id,
      field1: formData.value.field1,
      status: formData.value.status
    }

    if (isEditing.value) {
      await api.put('/your_endpoint/index.php', payload)
      swalSuccess('บันทึกสำเร็จ', 'อัปเดตข้อมูลเรียบร้อย')
    } else {
      await api.post('/your_endpoint/index.php', payload)
      swalSuccess('บันทึกสำเร็จ', 'เพิ่มข้อมูลใหม่เรียบร้อย')
    }
    
    closeModal()
    fetchData()
  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้')
  }
}

// ลบข้อมูล
const deleteData = async (id) => {
  const result = await swalConfirm('ยืนยันการลบ', 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนี้?')
  if(result.isConfirmed) {
    try {
      await api.delete('/your_endpoint/index.php', { data: { id: id } })
      swalSuccess('ลบข้อมูลสำเร็จ', 'ข้อมูลถูกลบทิ้งแล้ว')
      fetchData()
    } catch (error) {
      swalError('ลบข้อมูลไม่สำเร็จ', 'ไม่สามารถลบข้อมูลได้')
    }
  }
}

// ==========================================
// 4. ฟังก์ชันควบคุม Modal
// ==========================================
const openAddModal = () => {
  isEditing.value = false
  formData.value = { id: null, field1: '', status: 'ใช้งาน' } // รีเซ็ตค่า
  isModalOpen.value = true
}

const openEditModal = (item) => {
  isEditing.value = true
  formData.value = { ...item } // ดึงข้อมูลมาใส่ฟอร์ม
  isModalOpen.value = true
}

const closeModal = () => isModalOpen.value = false

// ทำงานทันทีเมื่อโหลดหน้าเพจเสร็จ
onMounted(() => {
  fetchData()
})
</script>

<style scoped>
/* 
  💡 เนื่องจากเราใช้ global.css แล้ว หน้านี้จึงไม่จำเป็นต้องใส่ CSS พื้นฐานอีก
  ให้ใส่เฉพาะ CSS พิเศษที่มีแค่ในหน้านี้เท่านั้น
  เช่น ปรับความกว้างคอลัมน์เฉพาะตารางนี้
*/
</style>