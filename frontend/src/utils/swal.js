import Swal from 'sweetalert2'

// แจ้งเตือนสำเร็จ (สีเขียว)
export const swalSuccess = (title, text = '') => {
  return Swal.fire({
    icon: 'success',
    title: title,
    text: text,
    confirmButtonColor: '#10B981', // สีเขียว Emerald
    confirmButtonText: 'ตกลง'
  })
}

// แจ้งเตือนข้อผิดพลาด (สีแดง)
export const swalError = (title, text = '') => {
  return Swal.fire({
    icon: 'error',
    title: title,
    text: text,
    confirmButtonColor: '#10B981',
    confirmButtonText: 'ตกลง'
  })
}

// แจ้งเตือนยืนยันการลบ/ดำเนินการ (ปุ่ม ยืนยัน / ยกเลิก)
export const swalConfirm = (title, text = '') => {
  return Swal.fire({
    icon: 'warning',
    title: title,
    text: text,
    showCancelButton: true,
    confirmButtonColor: '#EF4444', // สีแดงสำหรับการลบ/อันตราย
    cancelButtonColor: '#6B7280',  // สีเทาสำหรับยกเลิก
    confirmButtonText: 'ใช่, ดำเนินการเลย',
    cancelButtonText: 'ยกเลิก',
    reverseButtons: true // สลับให้ปุ่มยกเลิกอยู่ซ้าย ปุ่มยืนยันอยู่ขวา
  })
}