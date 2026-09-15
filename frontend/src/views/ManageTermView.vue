<template>
  <div class="manage-layout">
    <!-- Header -->
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">จัดการวาระการทำงาน</h1>
        <p class="page-subtitle">เพิ่ม แก้ไข และกำหนดระยะเวลาวาระการทำงานของ พ.สมทบ</p>
      </div>
      <button class="btn-primary" @click="openAddModal">
        + เพิ่มวาระใหม่
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
            placeholder="🔍 ค้นหารุ่น หรือปี พ.ศ. ..." 
            class="search-input" 
          />
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>รุ่นที่ (วาระ)</th>
              <th>ตั้งแต่วันที่เริ่มต้น</th>
              <th>วันหมดวาระ</th>
              <th>ไฟล์แนบ</th>
              <th width="120">สถานะ</th>
              <th>หมายเหตุ</th>
              <th width="120" class="no-print text-center">จัดการ</th>
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
              <tr v-for="term in paginatedList" :key="term.id" class="data-row">
                <td class="font-bold" style="color: #111827;">{{ term.generation_name }}</td>
                <td>{{ formatThaiDate(term.start_date) }}</td>
                <td>{{ formatThaiDate(term.end_date) }}</td>
                <td>
                  <div v-if="normalizeFilePaths(term.file_paths).length > 0" class="term-file-links">
                    <button
                      v-for="(fileUrl, fileIndex) in normalizeFilePaths(term.file_paths)"
                      :key="fileUrl"
                      class="term-file-link"
                      type="button"
                      @click="openFilePreview(fileUrl)"
                    >
                      👁️ ดูไฟล์{{ normalizeFilePaths(term.file_paths).length > 1 ? ` ${fileIndex + 1}` : '' }}
                    </button>
                  </div>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>
                  <span class="status-badge" :class="getStatusClass(term.status)">
                    {{ term.status }}
                  </span>
                </td>
                <td class="text-muted">{{ term.note || '-' }}</td>
                <td class="no-print text-center">
                  <div class="action-buttons justify-center">
                    <button class="btn-icon edit" @click="openEditModal(term)" title="แก้ไข">✏️</button>
                    <button class="btn-icon delete" @click="deleteData(term.id)" title="ลบ">🗑️</button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredList.length === 0">
                <td colspan="7" class="text-center text-muted">ไม่พบข้อมูลที่ค้นหา</td>
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
          <h2>{{ isEditing ? 'แก้ไขข้อมูลวาระการทำงาน' : 'เพิ่มวาระการทำงานใหม่' }}</h2>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        
        <form @submit.prevent="saveData" class="form-grid">
          
          <div class="input-group full-width">
            <label>รุ่นที่ (ชื่อวาระ) <span style="color: #DC2626;">*</span></label>
            <input type="text" v-model="formData.generation_name" required placeholder="เช่น รุ่นที่ 1, วาระปี 2567-2570" />
          </div>

          <div class="input-group">
            <label>ตั้งแต่วันที่เริ่มต้น <span style="color: #DC2626;">*</span></label>
            <div class="date-inputs">
              <select v-model="formData.start_day" required>
                <option value="">วัน</option>
                <option v-for="day in days" :key="day" :value="day">{{ parseInt(day) }}</option>
              </select>
              <select v-model="formData.start_month" required>
                <option value="">เดือน</option>
                <option v-for="month in thaiMonths" :key="month.value" :value="month.value">{{ month.label }}</option>
              </select>
              <select v-model="formData.start_year" required>
                <option value="">ปี</option>
                <option v-for="year in termYears" :key="year.value" :value="year.value">{{ year.label }}</option>
              </select>
            </div>
          </div>

          <div class="input-group">
            <label>วันหมดวาระ <span style="color: #DC2626;">*</span></label>
            <div class="date-inputs">
              <select v-model="formData.end_day" required>
                <option value="">วัน</option>
                <option v-for="day in days" :key="day" :value="day">{{ parseInt(day) }}</option>
              </select>
              <select v-model="formData.end_month" required>
                <option value="">เดือน</option>
                <option v-for="month in thaiMonths" :key="month.value" :value="month.value">{{ month.label }}</option>
              </select>
              <select v-model="formData.end_year" required>
                <option value="">ปี</option>
                <option v-for="year in termYears" :key="year.value" :value="year.value">{{ year.label }}</option>
              </select>
            </div>
          </div>

          <div class="input-group full-width">
            <label>สถานะ</label>
            <select v-model="formData.status">
              <option value="กำลังดำรงตำแหน่ง">กำลังดำรงตำแหน่ง</option>
              <option value="หมดวาระ">หมดวาระ</option>
              <option value="ยกเลิก">ยกเลิก</option>
            </select>
          </div>

          <div class="input-group full-width">
            <label>หมายเหตุ (ถ้ามี)</label>
            <textarea v-model="formData.note" rows="2" placeholder="รายละเอียดเพิ่มเติม..."></textarea>
          </div>

          <div class="input-group full-width upload-section">
            <label>📤 อัปโหลดไฟล์แนบวาระการทำงาน</label>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              @change="handleFileUpload"
              class="file-input"
            />
            <small class="text-muted">รองรับ PDF, รูปภาพ, Word และ Excel</small>

            <ul v-if="formData.files.length > 0" class="file-list mt-2">
              <li v-for="file in formData.files" :key="`${file.name}-${file.lastModified}`">
                {{ file.name }}
              </li>
            </ul>

            <div v-if="formData.existing_file_paths.length > 0" class="existing-files mt-2">
              <small class="text-muted">ไฟล์แนบเดิม</small>
              <ul class="file-list">
                <li v-for="fileUrl in formData.existing_file_paths" :key="fileUrl">
                  <div class="existing-file-row">
                    <a :href="fileUrl" target="_blank" rel="noopener noreferrer">{{ getFileName(fileUrl) }}</a>
                    <button type="button" class="btn-icon delete" title="ลบไฟล์" @click="deleteTermFile(fileUrl)">🗑️</button>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div class="modal-actions full-width mt-4">
            <button type="button" class="btn-secondary" @click="closeModal">ยกเลิก</button>
            <button type="submit" class="btn-primary">บันทึกข้อมูล</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal ดูไฟล์แนบ -->
    <div v-if="isFilePreviewOpen" class="modal-overlay no-print" @click.self="closeFilePreview">
      <div class="modal-card file-preview-modal" role="dialog" aria-modal="true" aria-labelledby="file-preview-title">
        <div class="modal-header">
          <div class="file-preview-heading">
            <h2 id="file-preview-title">ดูไฟล์แนบวาระการทำงาน</h2>
            <span class="file-preview-name">{{ previewFileName }}</span>
          </div>
          <button class="close-btn" type="button" aria-label="ปิดหน้าต่างดูไฟล์" @click="closeFilePreview">✕</button>
        </div>

        <div class="file-preview-body">
          <div v-if="isPreviewLoading" class="file-preview-state">
            <div class="loading-spinner"></div>
            <span>กำลังโหลดไฟล์...</span>
          </div>

          <div v-else-if="previewError" class="file-preview-state error-state">
            <span class="file-state-icon">⚠️</span>
            <strong>ไม่สามารถเปิดไฟล์ได้</strong>
            <span>{{ previewError }}</span>
          </div>

          <img
            v-else-if="previewKind === 'image'"
            :src="previewObjectUrl"
            :alt="previewFileName"
            class="image-preview"
          />

          <iframe
            v-else-if="previewKind === 'pdf'"
            :src="previewObjectUrl"
            :title="previewFileName"
            class="document-preview"
          ></iframe>

          <div v-else class="file-preview-state">
            <span class="file-state-icon">📄</span>
            <strong>{{ previewFileName }}</strong>
            <span>ไฟล์ชนิดนี้ไม่รองรับการแสดงตัวอย่างในเบราว์เซอร์ กรุณาดาวน์โหลดเพื่อเปิดดู</span>
          </div>
        </div>

        <div class="modal-actions file-preview-actions">
          <button type="button" class="btn-secondary" @click="closeFilePreview">ปิด</button>
          <button
            type="button"
            class="btn-primary"
            :disabled="!previewObjectUrl || isPreviewLoading"
            @click="downloadPreviewFile"
          >
            ⬇️ ดาวน์โหลดไฟล์
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import api from '../services/api' 
import { swalSuccess, swalError, swalConfirm } from '../utils/swal'

// === 1. State ===
const dataList = ref([])
const isLoading = ref(false)
const isModalOpen = ref(false)
const isEditing = ref(false)
const isFilePreviewOpen = ref(false)
const isPreviewLoading = ref(false)
const previewObjectUrl = ref('')
const previewFileName = ref('')
const previewKind = ref('other')
const previewError = ref('')

const formData = ref({ 
  id: null, 
  generation_name: '', 
  start_day: '', start_month: '', start_year: '',
  end_day: '', end_month: '', end_year: '',
  status: 'กำลังดำรงตำแหน่ง',
  note: '',
  files: [],
  existing_file_paths: []
})

const days = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'))
const thaiMonths = [
  { value: '01', label: 'มกราคม' }, { value: '02', label: 'กุมภาพันธ์' },
  { value: '03', label: 'มีนาคม' }, { value: '04', label: 'เมษายน' },
  { value: '05', label: 'พฤษภาคม' }, { value: '06', label: 'มิถุนายน' },
  { value: '07', label: 'กรกฎาคม' }, { value: '08', label: 'สิงหาคม' },
  { value: '09', label: 'กันยายน' }, { value: '10', label: 'ตุลาคม' },
  { value: '11', label: 'พฤศจิกายน' }, { value: '12', label: 'ธันวาคม' }
]
const currentYear = new Date().getFullYear()
const termYears = Array.from({ length: 30 }, (_, index) => {
  const value = String(currentYear - 25 + index)
  return { value, label: String(Number(value) + 543) }
})

// === 2. ระบบค้นหา & แบ่งหน้า ===
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)

const filteredList = computed(() => {
  if (!searchQuery.value) return dataList.value;
  const q = searchQuery.value.toLowerCase()
  return dataList.value.filter(item => item.generation_name.toLowerCase().includes(q));
})

const totalPages = computed(() => Math.ceil(filteredList.value.length / itemsPerPage.value) || 1)
const paginatedList = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage.value;
  return filteredList.value.slice(startIndex, startIndex + itemsPerPage.value);
})
const changePage = (page) => { if (page >= 1 && page <= totalPages.value) currentPage.value = page; }
watch(searchQuery, () => currentPage.value = 1);

// === 3. ฟังก์ชันจัดรูปแบบข้อมูล ===
const formatThaiDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const result = date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  return result !== 'Invalid Date' ? result : '-';
}

const getStatusClass = (status) => {
  if (status === 'กำลังดำรงตำแหน่ง') return 'active';
  if (status === 'ยกเลิก') return 'inactive';
  if (status === 'หมดวาระ') return 'warning';
  return '';
}

const getFileName = (fileUrl) => {
  try {
    return decodeURIComponent(fileUrl.split('/').pop())
  } catch {
    return fileUrl
  }
}

const normalizeFilePaths = (filePaths) => {
  if (!filePaths) return []
  if (Array.isArray(filePaths)) return filePaths
  try {
    const parsed = JSON.parse(filePaths)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return [filePaths]
  }
}

const handleFileUpload = (event) => {
  formData.value.files = Array.from(event.target.files || [])
}

const revokePreviewObjectUrl = () => {
  if (previewObjectUrl.value) URL.revokeObjectURL(previewObjectUrl.value)
  previewObjectUrl.value = ''
}

const getPreviewKind = (fileName, mimeType = '') => {
  const lowerName = fileName.toLowerCase()
  if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf'
  if (mimeType.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(lowerName)) return 'image'
  return 'other'
}

const openFilePreview = async (fileUrl) => {
  revokePreviewObjectUrl()
  previewFileName.value = getFileName(fileUrl)
  previewKind.value = 'other'
  previewError.value = ''
  isPreviewLoading.value = true
  isFilePreviewOpen.value = true

  try {
    const response = await api.get(fileUrl, { responseType: 'blob' })
    previewObjectUrl.value = URL.createObjectURL(response.data)
    previewKind.value = getPreviewKind(previewFileName.value, response.data.type)
  } catch (error) {
    previewError.value = error.response?.status === 404
      ? 'ไม่พบไฟล์บนเซิร์ฟเวอร์'
      : 'กรุณาตรวจสอบไฟล์หรือเข้าสู่ระบบใหม่อีกครั้ง'
  } finally {
    isPreviewLoading.value = false
  }
}

const closeFilePreview = () => {
  isFilePreviewOpen.value = false
  previewError.value = ''
  revokePreviewObjectUrl()
}

const downloadPreviewFile = () => {
  if (!previewObjectUrl.value) return
  const downloadLink = document.createElement('a')
  downloadLink.href = previewObjectUrl.value
  downloadLink.download = previewFileName.value || 'attachment'
  document.body.appendChild(downloadLink)
  downloadLink.click()
  downloadLink.remove()
}

const deleteTermFile = async (fileUrl) => {
  if (!formData.value.id) return

  const result = await swalConfirm('ยืนยันการลบไฟล์', `ต้องการลบไฟล์ ${getFileName(fileUrl)} หรือไม่?`)
  if (!result.isConfirmed) return

  try {
    const response = await api.delete(`/working-terms/${formData.value.id}/files`, { data: { file_url: fileUrl } })
    const updatedPaths = normalizeFilePaths(response.data?.file_paths)

    // อัปเดตทั้ง Modal และข้อมูลต้นทางของตาราง เพื่อไม่ให้ไฟล์ที่ลบแล้วยังค้างบนหน้าจอ
    formData.value.existing_file_paths = updatedPaths
    const termIndex = dataList.value.findIndex(term => term.id === formData.value.id)
    if (termIndex !== -1) {
      dataList.value[termIndex] = {
        ...dataList.value[termIndex],
        file_paths: updatedPaths
      }
    }
    swalSuccess('ลบไฟล์สำเร็จ', 'ลบไฟล์แนบเรียบร้อยแล้ว')
  } catch (error) {
    swalError('ลบไฟล์ไม่สำเร็จ', error.response?.data?.message || 'ไม่สามารถลบไฟล์แนบได้')
  }
}

// === 4. ฟังก์ชัน API ===
const fetchData = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/working-terms') 
    dataList.value = response.data.records || []
  } catch (error) {
    console.error("ดึงข้อมูลไม่สำเร็จ:", error)
  } finally {
    isLoading.value = false
  }
}

const saveData = async () => {
  const startDate = `${formData.value.start_year}-${formData.value.start_month}-${formData.value.start_day}`
  const endDate = `${formData.value.end_year}-${formData.value.end_month}-${formData.value.end_day}`

  // ตรวจสอบวันหมดวาระ ต้องไม่น้อยกว่าวันที่เริ่มต้น
  if (new Date(endDate) < new Date(startDate)) {
    swalError('ข้อมูลไม่ถูกต้อง', 'วันหมดวาระ ต้องอยู่หลังวันที่เริ่มต้น');
    return;
  }

  try {
    const payload = new FormData()
    if (formData.value.id) payload.append('id', formData.value.id)
    payload.append('generation_name', formData.value.generation_name)
    payload.append('start_date', startDate)
    payload.append('end_date', endDate)
    payload.append('status', formData.value.status)
    payload.append('note', formData.value.note || '')
    formData.value.files.forEach(file => payload.append('term_files', file))

    const config = { headers: { 'Content-Type': 'multipart/form-data' } }
    
    if (isEditing.value) {
      await api.put(`/working-terms/${formData.value.id}`, payload, config)
      swalSuccess('บันทึกสำเร็จ', 'อัปเดตข้อมูลวาระเรียบร้อย')
    } else {
      await api.post('/working-terms', payload)
      swalSuccess('บันทึกสำเร็จ', 'เพิ่มวาระใหม่เรียบร้อย')
    }
    closeModal()
    fetchData()
  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถบันทึกข้อมูลได้')
  }
}

const deleteData = async (id) => {
  const result = await swalConfirm('ยืนยันการลบ', 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลวาระนี้?')
  if(result.isConfirmed) {
    try {
      await api.delete(`/working-terms/${id}`)
      swalSuccess('ลบสำเร็จ', 'ลบข้อมูลเรียบร้อยแล้ว')
      fetchData()
    } catch (error) {
      swalError('ลบข้อมูลไม่สำเร็จ', error.response?.data?.message || 'ไม่สามารถลบข้อมูลได้')
    }
  }
}

// === 5. ฟังก์ชันควบคุม Modal ===
const openAddModal = () => {
  isEditing.value = false
  formData.value = { 
    id: null, generation_name: '',
    start_day: '', start_month: '', start_year: '',
    end_day: '', end_month: '', end_year: '',
    status: 'กำลังดำรงตำแหน่ง', note: '', files: [], existing_file_paths: []
  }
  isModalOpen.value = true
}

const openEditModal = (item) => {
  isEditing.value = true
  
  const splitDate = (dateStr) => {
    const [year = '', month = '', day = ''] = (dateStr || '').split('T')[0].split('-')
    return { day, month, year }
  }
  const startDate = splitDate(item.start_date)
  const endDate = splitDate(item.end_date)
  
  formData.value = { 
    id: item.id, 
    generation_name: item.generation_name, 
    start_day: startDate.day,
    start_month: startDate.month,
    start_year: startDate.year,
    end_day: endDate.day,
    end_month: endDate.month,
    end_year: endDate.year,
    status: item.status || 'กำลังดำรงตำแหน่ง',
    note: item.note || '',
    files: [],
    existing_file_paths: normalizeFilePaths(item.file_paths)
  }
  isModalOpen.value = true
}

const closeModal = () => isModalOpen.value = false

onMounted(() => {
  fetchData()
})

onBeforeUnmount(revokePreviewObjectUrl)
</script>

<style scoped>
.justify-center {
  justify-content: center;
}
.term-file-links {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 140px;
}
.term-file-link {
  color: #2563EB;
  font-size: 13px;
  font-family: inherit;
  text-align: left;
  text-decoration: none;
  overflow-wrap: anywhere;
  background: none;
  border: 0;
  padding: 3px 0;
  cursor: pointer;
}
.term-file-link:hover {
  color: #1D4ED8;
  text-decoration: underline;
}
.existing-file-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.existing-file-row .btn-icon {
  flex-shrink: 0;
  padding: 2px 6px;
  font-size: 12px;
}
.file-preview-modal {
  width: min(1000px, calc(100vw - 32px));
  max-width: 1000px;
  height: min(780px, calc(100vh - 40px));
  display: flex;
  flex-direction: column;
}
.file-preview-heading {
  min-width: 0;
}
.file-preview-heading h2 {
  margin-bottom: 4px;
}
.file-preview-name {
  display: block;
  max-width: 760px;
  overflow: hidden;
  color: #6B7280;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-preview-body {
  min-height: 0;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  background: #F3F4F6;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
}
.document-preview {
  width: 100%;
  height: 100%;
  min-height: 480px;
  border: 0;
  background: #FFFFFF;
}
.image-preview {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.file-preview-state {
  min-height: 260px;
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #6B7280;
  text-align: center;
}
.file-preview-state strong {
  color: #111827;
}
.file-preview-state.error-state strong {
  color: #B91C1C;
}
.file-state-icon {
  font-size: 42px;
}
.file-preview-actions {
  margin-top: 16px;
}
@media (max-width: 640px) {
  .file-preview-modal {
    width: calc(100vw - 16px);
    height: calc(100vh - 16px);
  }
  .document-preview {
    min-height: 360px;
  }
}
/* ดีไซน์อื่นๆ ดึงมาจาก Global Styles (manage-layout, btn-primary, status-badge, ฯลฯ) ที่มีอยู่แล้ว */
</style>
