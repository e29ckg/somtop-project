<template>
  <div class="manage-layout">
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">จัดการเทมเพลตเอกสาร</h1>
        <p class="page-subtitle">อัปโหลดไฟล์ Word (.docx) เพื่อเปลี่ยนแบบฟอร์มเอกสารในระบบ (เฉพาะผู้ดูแลระบบ)</p>
      </div>
    </div>

    <div class="card" style="max-width: 600px; margin: 0 auto; padding: 24px;">
      <form @submit.prevent="saveTemplate" class="form-grid">
        
        <div class="input-group full-width">
          <label>เลือกประเภทแบบฟอร์มที่ต้องการเปลี่ยน</label>
          <select v-model="formData.template_type" required>
            <option value="" disabled>-- กรุณาเลือก --</option>
            <option value="leave_template">แบบฟอร์มใบลา (leave_template.docx)</option>
            <!-- อนาคตสามารถเพิ่มเทมเพลตอื่นๆ ได้ เช่น แบบฟอร์มขอสวัสดิการ -->
          </select>
        </div>

        <div class="input-group full-width mt-3">
          <label>อัปโหลดไฟล์เทมเพลต Word (.docx)</label>
          <input type="file" accept=".docx,.doc" @change="handleFileUpload" required class="file-input" />
          <small class="text-muted mt-1 block">หมายเหตุ: ไฟล์ใหม่จะเข้าไปแทนที่ไฟล์เดิมในระบบทันที และต้องใส่ตัวแปร { } ในไฟล์ให้ถูกต้องด้วย</small>
        </div>

        <div class="modal-actions full-width mt-4" style="justify-content: flex-end;">
          <button type="submit" class="btn-primary" :disabled="isLoading">
            {{ isLoading ? 'กำลังอัปโหลด...' : '💾 บันทึกเทมเพลต' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '../services/api'
import { swalSuccess, swalError } from '../utils/swal'

const isLoading = ref(false)
const formData = ref({
  template_type: '',
  file: null
})

const handleFileUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    if (!file.name.match(/\.(docx|doc)$/i)) {
      swalError('ไฟล์ไม่ถูกต้อง', 'กรุณาอัปโหลดไฟล์ Word (.docx) เท่านั้น')
      event.target.value = ''
      formData.value.file = null
      return
    }
    formData.value.file = file
  }
}

const saveTemplate = async () => {
  if (!formData.value.template_type || !formData.value.file) {
    swalError('ข้อมูลไม่ครบถ้วน', 'กรุณาเลือกประเภทและอัปโหลดไฟล์')
    return
  }

  isLoading.value = true
  try {
    const payload = new FormData()
    payload.append('template_type', formData.value.template_type)
    payload.append('template_file', formData.value.file)

    await api.post('/templates/upload', payload, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    swalSuccess('อัปโหลดสำเร็จ', 'เปลี่ยนเทมเพลตเอกสารในระบบเรียบร้อยแล้ว')
    // Reset form
    formData.value.file = null
    document.querySelector('.file-input').value = ''
  } catch (error) {
    swalError('เกิดข้อผิดพลาด', error.response?.data?.message || 'ไม่สามารถอัปโหลดเทมเพลตได้')
  } finally {
    isLoading.value = false
  }
}
</script>