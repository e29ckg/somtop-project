<template>
  <div class="app-wrapper" :class="{ 'collapsed': isCollapsed }">
    
    <!-- Sidebar -->
    <aside class="sidebar no-print">
      <div class="sidebar-header">
         <span class="nav-icon">🛡️</span>
         <span class="sidebar-text">ระบบจัดการ พ.สมทบ</span>
      </div>
      
      <nav class="sidebar-nav">
        <div class="menu-category">เมนูหลัก</div>
        <router-link to="/dashboard" class="nav-item">
           <span class="nav-icon">🏠</span>
           <span class="sidebar-text">หน้าหลัก</span>
        </router-link>
        
        <router-link to="/manage-somtop" class="nav-item">
           <span class="nav-icon">👥</span>
           <span class="sidebar-text">ข้อมูลผู้พิพากษาสมทบ</span>
        </router-link>
        
        <router-link to="/leave-history" class="nav-item">
           <span class="nav-icon">📅</span>
           <span class="sidebar-text">ประวัติการลา</span>
        </router-link>
        
        <!-- ⭐️ ซ่อน/แสดงเมนูตั้งค่า เฉพาะผู้ที่มี Role = admin เท่านั้น -->
        <div v-if="userRole === 'admin'">
          <div class="menu-category">ตั้งค่าระบบ</div>
          <router-link to="/manage-courts" class="nav-item">
             <span class="nav-icon">🏢</span>
             <span class="sidebar-text">จัดการข้อมูลศาล</span>
          </router-link>
          <router-link to="/manage-users" class="nav-item">
             <span class="nav-icon">⚙️</span>
             <span class="sidebar-text">ผู้ใช้งานระบบ</span>
          </router-link>
          <router-link to="/manage-titles" class="nav-item">
             <span class="nav-icon">🏷️</span>
             <span class="sidebar-text">คำนำหน้าชื่อ</span>
          </router-link>
          <router-link to="/activity-logs" class="nav-item">
             <span class="nav-icon">📋</span>
             <span class="sidebar-text">ประวัติการใช้งาน</span>
          </router-link>
        </div>
      </nav>
    </aside>

    <!-- ฝั่งขวา (Right Side) -->
    <div class="main-container">
      
      <!-- Topbar -->
      <header class="topbar no-print">
        <div class="topbar-left">
          <button @click="toggleSidebar" class="menu-toggle">☰</button>
          <div class="breadcrumb">
            หน้าหลัก > {{ currentRouteName }}
          </div>
        </div>
        
        <div class="topbar-right">
          <!-- แสดงชื่อและสิทธิ์ของผู้ใช้งานที่ล็อกอินเข้ามา -->
          <div style="font-size: 14px; text-align: right;">
            <div style="font-weight: 600; color: #111827;">{{ userName }}</div>
            <div style="font-size: 12px; color: #6B7280; text-transform: capitalize;">{{ userRole }}</div>
          </div>
          <button @click="handleLogout" class="btn-secondary" style="color: #DC2626; border-color: #FCA5A5;">
            ออกจากระบบ
          </button>
        </div>
      </header>

      <!-- Main Content -->
      <main class="content-area">
        <router-view />
      </main>
      
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { swalConfirm } from '../utils/swal' // ⭐️ นำเข้า SweetAlert สำหรับยืนยันการลบ
import api from '../services/api' // ⭐️ นำเข้า Axios instance สำหรับเรียก API

const router = useRouter()
const route = useRoute()

const isCollapsed = ref(false)
const userRole = ref('viewer') // ค่าเริ่มต้น
const userName = ref('ผู้ใช้งาน')

// ⭐️ ดึงข้อมูล User จาก LocalStorage เมื่อโหลดหน้าจอ
onMounted(() => {
  const userData = localStorage.getItem('user')
  if (userData) {
    const user = JSON.parse(userData)
    userRole.value = user.role || 'viewer'
    userName.value = user.full_name || 'ผู้ใช้งาน'
  }
})

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}

const currentRouteName = computed(() => {
  if (route.path === '/dashboard') return 'ภาพรวมระบบ'
  if (route.path === '/manage-somtop') return 'จัดการข้อมูล พ.สมทบ'
  if (route.path === '/leave-history') return 'ประวัติการลา'
  if (route.path === '/manage-users') return 'จัดการผู้ใช้งานระบบ'
  if (route.path === '/manage-courts') return 'จัดการข้อมูลศาล'
  if (route.path === '/manage-titles') return 'จัดการคำนำหน้า'
  if (route.path === '/activity-logs') return 'ประวัติการใช้งาน'
  return 'รายละเอียด'
})

// ⭐️ ฟังก์ชันออกจากระบบแบบมียืนยัน
const handleLogout = async () => {
  const result = await swalConfirm('ยืนยันการออกจากระบบ', 'คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?');
  
  // if (result.isConfirmed) {
  //   // localStorage.removeItem('token')
  //   localStorage.removeItem('user') 
  //   router.push('/')
  // }
  if (result.isConfirmed) {
    try {
      // ⭐️ ยิง API ไปบอก Backend ให้ลบ HttpOnly Cookie
      await api.post('/auth/logout')
      
      // ลบข้อมูล user ใน localStorage
      localStorage.removeItem('user') 
      
      // กลับหน้า Login
      router.push('/')
      
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการออกจากระบบ:", error)
      // แม้ API จะพัง ก็ควรบังคับลบ user และเด้งออกอยู่ดี
      localStorage.removeItem('user')
      router.push('/')
    }
  }
}
</script>