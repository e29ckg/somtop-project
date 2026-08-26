<template>
  <div class="manage-layout">
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">ประวัติการใช้งานระบบ</h1>
        <p class="page-subtitle">ตรวจสอบความเคลื่อนไหว การเพิ่ม ลบ และแก้ไขข้อมูลทั้งหมดในระบบ</p>
      </div>
    </div>

    <div class="card table-card">
      <div class="table-header-actions no-print">
        <div class="items-per-page-selector">
          <label>แสดง</label>
          <select v-model="itemsPerPage" @change="currentPage = 1" class="per-page-select">
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
            placeholder="🔍 ค้นหาชื่อผู้ใช้ หรือ เมนู..." 
            class="search-input"
          />
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>วัน-เวลา</th>
              <th>ชื่อผู้ใช้งาน</th>
              <th>การกระทำ</th>
              <th>เมนู/ส่วนที่จัดการ</th>
              <th>รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="5" class="text-center py-8">
                <div class="loading-spinner"></div>
                <div class="text-muted mt-2">กำลังดึงข้อมูลจากเซิร์ฟเวอร์...</div>
              </td>
            </tr>
            <template v-else>
              <tr v-for="log in paginatedList" :key="log.id" class="data-row">
                <td class="font-mono text-muted">{{ formatDateTime(log.created_at) }}</td>
                <td class="font-bold">{{ log.username }}</td>
                <td>
                  <span class="status-badge" :class="getActionClass(log.action)">
                    {{ log.action }}
                  </span>
                </td>
                <td>{{ log.module }}</td>
                <td class="text-muted">{{ log.details || '-' }}</td>
              </tr>
              <tr v-if="filteredList.length === 0">
                <td colspan="5" class="text-center text-muted">ไม่พบข้อมูลประวัติการใช้งาน</td>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import api from '../services/api'

const dataList = ref([])
const isLoading = ref(false)

// Search & Pagination
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(20)

const filteredList = computed(() => {
  if (!searchQuery.value) return dataList.value;
  const q = searchQuery.value.toLowerCase()
  return dataList.value.filter(item => 
    item.username.toLowerCase().includes(q) ||
    item.module.toLowerCase().includes(q) ||
    item.action.toLowerCase().includes(q)
  );
})

const totalPages = computed(() => Math.ceil(filteredList.value.length / itemsPerPage.value) || 1)
const paginatedList = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  return filteredList.value.slice(startIndex, startIndex + itemsPerPage.value);
})
const changePage = (page) => { if (page >= 1 && page <= totalPages.value) currentPage.value = page; }
watch(searchQuery, () => currentPage.value = 1);

// Helpers
const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('th-TH');
}

const getActionClass = (action) => {
  if (action.includes('เพิ่ม') || action.includes('เข้าสู่ระบบ')) return 'active';
  if (action.includes('ลบ')) return 'inactive';
  if (action.includes('แก้ไข')) return 'warning';
  return '';
}

// Fetch API
const fetchLogs = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/logs') // เตรียม Endpoint /logs ไว้ใน Backend
    dataList.value = response.data.records || []
  } catch (error) {
    console.error("ดึงข้อมูลไม่สำเร็จ:", error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchLogs()
})
</script>