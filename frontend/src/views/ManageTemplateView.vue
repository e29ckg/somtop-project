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
          <label>เลือกประเภทแบบฟอร์มที่ต้องการเปลี่ยน หรือ ดาวน์โหลดไปแก้ไข</label>
          <div style="display: flex; gap: 12px; align-items: center;">
            <select v-model="formData.template_type" required style="flex: 1;">
              <option value="" disabled>-- กรุณาเลือก --</option>
              <option value="leave_template_sick">แบบฟอร์มลาป่วย</option>
              <option value="leave_template_personal">แบบฟอร์มลากิจส่วนตัว</option>
              <option value="leave_template_vacation">แบบฟอร์มลาพักผ่อน</option>
              <option value="leave_template_abroad">แบบฟอร์มลาไปต่างประเทศ</option>
              <option value="leave_template_meeting">แบบฟอร์มลาประชุม</option>
              <option value="leave_template">แบบฟอร์มใบลา (ทั่วไป/อื่นๆ)</option>
            </select>
            
            <!-- ⭐️ ปุ่มสำหรับดาวน์โหลดฟอร์มเดิม -->
            <button 
              type="button" 
              class="btn-secondary" 
              @click="downloadCurrentTemplate" 
              :disabled="!formData.template_type"
              title="ดาวน์โหลดไฟล์ที่มีอยู่ปัจจุบันไปแก้ไข"
            >
              📥 โหลดฟอร์มเดิม
            </button>
          </div>
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

// === ฟังก์ชันดาวน์โหลดฟอร์มเดิมไปแก้ไข ===
const downloadCurrentTemplate = async () => {
  if (!formData.value.template_type) return;

  try {
    const type = formData.value.template_type;
    
    // เรียก API โหลดไฟล์ โดยต้องระบุ responseType: 'blob'
    const response = await api.get(`/templates/download?type=${type}`, {
      responseType: 'blob'
    });

    // สร้าง URL จำลองและสั่งดาวน์โหลด
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${type}.docx`);
    document.body.appendChild(link);
    link.click();
    
    // คืนค่าหน่วยความจำ
    link.remove();
    window.URL.revokeObjectURL(url);
    
    swalSuccess('ดาวน์โหลดสำเร็จ', 'เปิดไฟล์ที่โหลดเพื่อแก้ไข แล้วนำมาอัปโหลดใหม่ได้เลย');
  } catch (error) {
    if (error.response && error.response.status === 404) {
      swalError('ไม่พบไฟล์', 'ยังไม่มีไฟล์แบบฟอร์มประเภทนี้ในระบบ กรุณาอัปโหลดไฟล์เข้าไปก่อน');
    } else {
      swalError('เกิดข้อผิดพลาด', 'ไม่สามารถดาวน์โหลดไฟล์เทมเพลตได้');
    }
  }
};
</script>