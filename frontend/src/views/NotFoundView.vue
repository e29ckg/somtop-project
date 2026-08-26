<template>
  <div class="not-found-container">
    <div class="error-content">
      <h1 class="error-code">404</h1>
      <h2 class="error-title">ไม่พบหน้าที่คุณต้องการ</h2>
      <p class="error-subtitle">
        ขออภัย! หน้าเว็บที่คุณกำลังพยายามเข้าถึงอาจถูกลบไปแล้ว, เปลี่ยนชื่อ, หรือไม่มีอยู่จริง
      </p>
      
      <!-- ปุ่มพากลับไปหน้า Dashboard -->
      <router-link to="/dashboard" class="btn-primary">
        <span class="icon">🏠</span> กลับสู่หน้าหลัก
      </router-link>
    </div>
  </div>
</template>

<script setup>
// ไม่จำเป็นต้องมี Script พิเศษสำหรับหน้านี้
</script>

<style scoped>
.not-found-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #F4F6F9; /* สีพื้นหลังตาม DESIGN.md */
  padding: 20px;
}

.error-content {
  text-align: center;
  background-color: #FFFFFF;
  padding: 60px 40px;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  max-width: 500px;
  width: 100%;
}

.error-code {
  font-size: 100px;
  font-weight: 700;
  color: #10B981; /* สีเขียวหลักของระบบ */
  margin: 0;
  line-height: 1;
}

.error-title {
  font-size: 24px;
  font-weight: 600;
  color: #111827;
  margin: 20px 0 10px 0;
}

.error-subtitle {
  font-size: 15px;
  color: #6B7280;
  margin-bottom: 32px;
  line-height: 1.5;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: #10B981;
  color: #FFFFFF;
  text-decoration: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
}

.btn-primary:hover {
  background-color: #059669;
  box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
}
</style>