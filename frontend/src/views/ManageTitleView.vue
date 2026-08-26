<template>
  <div class="manage-layout">
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">จัดการคำนำหน้าชื่อ</h1>
        <p class="page-subtitle">เพิ่ม ลบ แก้ไข คำนำหน้าชื่อ (เฉพาะผู้ดูแลระบบ)</p>
      </div>
      <button class="btn-primary" @click="openAddModal">
        + เพิ่มคำนำหน้า
      </button>
    </div>

    <div class="card table-card">
      <div class="table-header-actions no-print">
        <div class="items-per-page-selector">
          <label>แสดง</label>
          <select v-model="itemsPerPage" @change="currentPage = 1" class="per-page-select">
            <option :value="10">10</option>
            <option :value="20">20</option>
          </select>
          <label>รายการ</label>
        </div>
        <div class="search-box">
          <input type="text" v-model="searchQuery" placeholder="🔍 ค้นหาคำนำหน้า..." class="search-input" />
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th width="100">ลำดับ (ID)</th>
              <th>คำนำหน้าชื่อ</th>
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
              <tr v-for="title in paginatedList" :key="title.id" class="data-row">
                <td class="font-mono text-muted">{{ title.id }}</td>
                <td class="font-bold">{{ title.name }}</td>
                <td>
                  <span class="status-badge" :class="title.status === 'ใช้งาน' ? 'active' : 'inactive'">
                    {{ title.status }}
                  </span>
                </td>
                <td class="no-print">
                  <div class="action-buttons">
                    <button class="btn-icon edit" @click="openEditModal(title)" title="แก้ไข">✏️</button>
                    <button class="btn-icon delete" @click="deleteData(title.id)" title="ลบ">🗑️</button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredList.length === 0">
                <td colspan="4" class="text-center text-muted">ไม่พบข้อมูล</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Form -->
    <div v-if="isModalOpen" class="modal-overlay no-print">
      <div class="modal-card" style="max-width: 400px;">
        <div class="modal-header">
          <h2>{{ isEditing ? 'แก้ไขคำนำหน้า' : 'เพิ่มคำนำหน้า' }}</h2>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        <form @submit.prevent="saveData" class="form-grid">
          <div class="input-group full-width">
            <label>คำนำหน้าชื่อ</label>
            <input type="text" v-model="formData.name" required placeholder="เช่น นาย, นาง" />
          </div>
          <div class="input-group full-width">
            <label>สถานะ</label>
            <select v-model="formData.status">
              <option value="ใช้งาน">ใช้งาน</option>
              <option value="ระงับ">ระงับ (ซ่อนจากหน้าจอเพิ่ม)</option>
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
const formData = ref({ id: null, name: '', status: 'ใช้งาน' })
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)

const filteredList = computed(() => {
  if (!searchQuery.value) return dataList.value;
  return dataList.value.filter(item => item.name.toLowerCase().includes(searchQuery.value.toLowerCase()));
})
const paginatedList = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  return filteredList.value.slice(startIndex, startIndex + itemsPerPage.value);
})
watch(searchQuery, () => currentPage.value = 1);

const fetchData = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/titles/admin') // เรียก API ฝั่ง Admin
    dataList.value = response.data.records || []
  } catch (error) {
    console.error(error)
  } finally {
    isLoading.value = false
  }
}

const saveData = async () => {
  try {
    if (isEditing.value) {
      await api.put('/titles/admin', formData.value)
      swalSuccess('บันทึกสำเร็จ', 'อัปเดตเรียบร้อย')
    } else {
      await api.post('/titles/admin', formData.value)
      swalSuccess('บันทึกสำเร็จ', 'เพิ่มคำนำหน้าใหม่เรียบร้อย')
    }
    closeModal()
    fetchData()
  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ชื่อนี้อาจมีอยู่แล้ว')
  }
}

const deleteData = async (id) => {
  const result = await swalConfirm('ยืนยันการลบ', 'แน่ใจหรือไม่ว่าต้องการลบคำนำหน้านี้?')
  if(result.isConfirmed) {
    try {
      await api.delete('/titles/admin', { data: { id } })
      swalSuccess('ลบสำเร็จ', 'ลบข้อมูลแล้ว')
      fetchData()
    } catch (error) {
      swalError('ลบไม่สำเร็จ', 'ข้อมูลนี้อาจถูกใช้งานอยู่')
    }
  }
}

const openAddModal = () => { isEditing.value = false; formData.value = { id: null, name: '', status: 'ใช้งาน' }; isModalOpen.value = true }
const openEditModal = (item) => { isEditing.value = true; formData.value = { ...item }; isModalOpen.value = true }
const closeModal = () => isModalOpen.value = false

onMounted(fetchData)
</script>