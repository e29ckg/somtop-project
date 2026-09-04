<template>
  <div class="dashboard-content">
    <!-- Dashboard Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">ภาพรวมระบบ</h1>
        <p class="page-subtitle">สถิติและข้อมูลปฏิทินกิจกรรมของผู้พิพากษาสมทบในระบบ</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary" @click="fetchData">
          <span v-if="isLoading">กำลังอัปเดต...</span>
          <span v-else>🔄 รีเฟรชข้อมูล</span>
        </button>
        <button class="btn-primary">
          <span class="icon">📥</span> นำออกรายงาน
        </button>
      </div>
    </div>

    <!-- 12-Column Grid -->
    <div class="grid-layout">
      
      <!-- KPIs (4 Cards) -->
      <div class="card kpi-card">
        <div class="kpi-header">
          <span class="icon-box purple">👥</span>
        </div>
        <h3 class="card-title">จำนวน พ.สมทบ ทั้งหมด</h3>
        <div class="kpi-value">
          <span v-if="isLoading">...</span>
          <span v-else>{{ totalSomtop }}</span> 
          <span class="unit">คน</span>
        </div>
      </div>

      <div class="card kpi-card">
        <div class="kpi-header">
          <span class="icon-box green">✅</span>
        </div>
        <h3 class="card-title">ปฏิบัติหน้าที่ (Active)</h3>
        <div class="kpi-value">
          <span v-if="isLoading">...</span>
          <span v-else>{{ activeSomtop }}</span> 
          <span class="unit">คน</span>
        </div>
      </div>

      <div class="card kpi-card">
        <div class="kpi-header">
          <span class="icon-box orange">🗓️</span>
        </div>
        <h3 class="card-title">กิจกรรมเดือนนี้</h3>
        <div class="kpi-value">
          <span v-if="isLoading">...</span>
          <span v-else>{{ eventsThisMonth }}</span> 
          <span class="unit">งาน</span>
        </div>
      </div>

      <div class="card kpi-card">
        <div class="kpi-header">
          <span class="icon-box blue">⏳</span>
        </div>
        <h3 class="card-title">รายการลารอตรวจสอบ</h3>
        <div class="kpi-value">
          <span v-if="isLoading">...</span>
          <span v-else>{{ pendingLeaves }}</span> 
          <span class="unit">รายการ</span>
        </div>
      </div>

      <!-- Main Calendar Section (Spanning 8 columns) -->
      <div class="card calendar-section">
        <div class="calendar-header-flex">
          <div class="calendar-nav">
            <button class="btn-icon" @click="prevMonth">❮</button>
            <h2 class="card-title mb-0">{{ currentMonthName }}</h2>
            <button class="btn-icon" @click="nextMonth">❯</button>
          </div>
          <div class="legend">
            <span class="legend-item"><span class="dot event-dot"></span> กิจกรรม</span>
            <span class="legend-item"><span class="dot leave-approved-dot"></span> ลา (อนุมัติ)</span>
            <span class="legend-item"><span class="dot leave-pending-dot"></span> ลา (รอตรวจสอบ)</span>
          </div>
        </div>
        
        <!-- Calendar Grid -->
        <div class="calendar-wrapper">
          <!-- วันในสัปดาห์ -->
          <div class="calendar-days-header">
            <div v-for="day in ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']" :key="day" class="day-name">
              {{ day }}
            </div>
          </div>
          <!-- วันที่ในปฏิทิน -->
          <div class="calendar-grid">
            <div 
              v-for="(cell, index) in calendarCells" 
              :key="index" 
              class="calendar-cell"
              :class="{ 'not-current-month': !cell.isCurrentMonth, 'is-today': cell.isToday }"
            >
              <span class="date-number">{{ cell.dayNumber }}</span>
              <div class="events-container">
                <div 
                  v-for="ev in cell.events" 
                  :key="ev.id" 
                  class="event-pill" 
                  :class="ev.colorClass"
                  :title="ev.title"
                  @click="openEventDetail(ev)"
                >
                  {{ ev.title }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Distribution (Spanning 4 columns) 
      <div class="card assets-section">
        <h2 class="card-title">สัดส่วนแยกตามตำแหน่ง</h2>
        
        <div v-if="isLoading" class="text-center py-4 text-muted">กำลังคำนวณข้อมูล...</div>
        <div v-else-if="positionDistribution.length === 0" class="text-center py-4 text-muted">ไม่มีข้อมูล พ.สมทบ</div>
        
        <div v-else class="asset-list">
          <div class="asset-item" v-for="pos in positionDistribution" :key="pos.name">
            <div class="asset-info">
              <span>{{ pos.name }}</span>
              <span class="asset-val">{{ pos.value }} คน</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: pos.percent + '%' }"></div>
            </div>
          </div>
        </div>
      </div> 
      -->

      <!-- Bottom Panel: Recent Events (Spanning 12 columns) -->
      <div class="card events-section">
        <div class="card-header-flex">
          <div>
            <h2 class="card-title">รายการลา / แจ้งเตือนล่าสุด</h2>
            <p class="card-subtitle">ดึงข้อมูล 5 รายการล่าสุดจากระบบบันทึกการลา</p>
          </div>
          <router-link to="/leave-history" class="view-history">ดูประวัติทั้งหมด</router-link>
        </div>
        
        <div class="table-responsive">
          <table class="alert-table">
            <thead>
              <tr>
                <th>วันที่ยื่นเรื่อง</th>
                <th>ชื่อ-สกุล (พ.สมทบ)</th>
                <th>ประเภทการลา</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="isLoading">
                <td colspan="4" class="text-center py-4 text-muted">กำลังดึงข้อมูล...</td>
              </tr>
              <tr v-else-if="recentEvents.length === 0">
                <td colspan="4" class="text-center py-4 text-muted">ยังไม่มีรายการลาในระบบ</td>
              </tr>
              <tr v-else v-for="event in recentEvents" :key="event.id" class="alert-row">
                <td class="time-col">{{ event.time }}</td>
                <td class="name-col">{{ event.person }}</td>
                <td>{{ event.type }}</td>
                <td>
                  <span class="alert-box" :class="event.severityClass">
                    {{ event.status }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
    <!-- Event Detail Modal -->
    <div v-if="isEventModalOpen" class="modal-overlay no-print">
      <div class="modal-card detail-modal">
        <div class="modal-header">
          <h2>รายละเอียดข้อมูล</h2>
          <button class="close-btn" @click="closeEventModal">✕</button>
        </div>
        
        <div class="modal-body" v-if="selectedEventDetail">
          <!-- กรณีเป็นข้อมูล: กิจกรรม/งาน -->
          <template v-if="selectedEventDetail.type === 'event'">
            <div class="detail-group">
              <label>ชื่องาน / กิจกรรม:</label>
              <p class="font-bold text-purple-700">{{ selectedEventDetail.rawData.title }}</p>
            </div>
            <div class="detail-group">
              <label>วันที่จัดงาน:</label>
              <p>{{ formatThaiDate(selectedEventDetail.rawData.start_date) }} - {{ formatThaiDate(selectedEventDetail.rawData.end_date) }}</p>
            </div>
            <div class="detail-group">
              <label>สถานที่:</label>
              <p>{{ selectedEventDetail.rawData.location || 'ไม่ระบุ' }}</p>
            </div>
            <div class="detail-group">
              <label>รายละเอียดเพิ่มเติม:</label>
              <p>{{ selectedEventDetail.rawData.description || '-' }}</p>
            </div>
          </template>

          <!-- กรณีเป็นข้อมูล: การลา -->
          <template v-else-if="selectedEventDetail.type === 'leave'">
            <div class="detail-group">
              <label>ผู้ยื่นขอลา:</label>
              <p class="font-bold">{{ selectedEventDetail.rawData.full_name }}</p>
            </div>
            <div class="detail-group">
              <label>ประเภทการลา:</label>
              <p>{{ selectedEventDetail.rawData.leave_type_name || selectedEventDetail.rawData.leave_type || 'ลา' }}</p>
            </div>
            <div class="detail-group">
              <label>ช่วงวันที่ลา:</label>
              <p>{{ formatThaiDate(selectedEventDetail.rawData.start_date) }} ถึง {{ formatThaiDate(selectedEventDetail.rawData.end_date) }}</p>
              <p class="text-sm text-gray-500">(รวม {{ selectedEventDetail.rawData.total_days }} วัน)</p>
            </div>
            <div class="detail-group">
              <label>สถานะใบลา:</label>
              <p>
                <span class="alert-box" :class="selectedEventDetail.rawData.status === 'รอตรวจสอบ' ? 'warning' : 'success'">
                  {{ selectedEventDetail.rawData.status }}
                </span>
              </p>
            </div>
            <div class="detail-group">
              <label>เหตุผล/หมายเหตุ:</label>
              <p>{{ selectedEventDetail.rawData.note || '-' }}</p>
            </div>
          </template>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-secondary" @click="closeEventModal">ปิดหน้าต่าง</button>
          <button type="button" class="btn-primary edit-btn" @click="goToEditPage(selectedEventDetail)">
            ✏️ แก้ไขข้อมูลนี้
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'

const router = useRouter()

const isLoading = ref(true)
const somtopList = ref([])
const leaveList = ref([])
const eventList = ref([]) // เก็บข้อมูลกิจกรรม

const isEventModalOpen = ref(false)
const selectedEventDetail = ref(null)

// ==========================================
// 1. ดึงข้อมูลจาก API (สมทบ, การลา, กิจกรรม)
// ==========================================
const fetchData = async () => {
  isLoading.value = true
  try {
    const [somtopRes, leaveRes, eventsRes] = await Promise.all([
      api.get('/somtop'),
      api.get('/leaves'),
      api.get('/events') // Endpoint สำหรับดึงกิจกรรม
    ])
    
    somtopList.value = somtopRes.data.records || []
    leaveList.value = leaveRes.data.records || []
    eventList.value = eventsRes.data.records || []
  } catch (error) {
    console.error("Error fetching dashboard data:", error)
  } finally {
    isLoading.value = false
  }
}

// ==========================================
// 2. คำนวณ KPIs 
// ==========================================
const totalSomtop = computed(() => somtopList.value.length)
const activeSomtop = computed(() => somtopList.value.filter(s => s.status === 'ใช้งาน').length)

const pendingLeaves = computed(() => {
  return leaveList.value.filter(l => l.status === 'รอตรวจสอบ' || l.status === 'รออนุมัติ').length
})

const eventsThisMonth = computed(() => {
  const currentMonth = displayDate.value.getMonth()
  const currentYear = displayDate.value.getFullYear()
  return eventList.value.filter(e => {
    if(!e.start_date) return false;
    const d = new Date(e.start_date)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  }).length
})

// ==========================================
// 3. ระบบ Custom Calendar
// ==========================================
const displayDate = ref(new Date())

const currentMonthName = computed(() => {
  const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const month = monthNames[displayDate.value.getMonth()]
  const year = displayDate.value.getFullYear() + 543 // แปลงเป็น พ.ศ.
  return `${month} ${year}`
})

const nextMonth = () => {
  displayDate.value = new Date(displayDate.value.getFullYear(), displayDate.value.getMonth() + 1, 1)
}

const prevMonth = () => {
  displayDate.value = new Date(displayDate.value.getFullYear(), displayDate.value.getMonth() - 1, 1)
}

// Helper: แปลง YYYY-MM-DD
const formatDateStr = (d) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper: ตรวจสอบว่าวันที่อยู่ในช่วง start ถึง end หรือไม่
const isDateInRange = (targetDate, startStr, endStr) => {
  if (!startStr) return false;
  
  const targetStr = formatDateStr(targetDate); // จะได้เป็น "YYYY-MM-DD"
  
  // ⭐️ เพิ่ม .split(' ')[0] เพื่อหั่นส่วนเวลาออกให้หมด ไม่ว่าจะมี T หรือเว้นวรรค
  const sStr = startStr.split('T')[0].split(' ')[0];
  const eStr = (endStr || startStr).split('T')[0].split(' ')[0];
  
  return targetStr >= sStr && targetStr <= eStr;
}

// คำนวณตารางปฏิทิน (42 ช่อง)
const calendarCells = computed(() => {
  const year = displayDate.value.getFullYear()
  const month = displayDate.value.getMonth()
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  
  // ปรับให้เริ่มวันจันทร์ (0 = จันทร์, 6 = อาทิตย์)
  let startDayOfWeek = firstDayOfMonth.getDay() - 1
  if (startDayOfWeek === -1) startDayOfWeek = 6 
  
  const days = []
  
  // 1. ช่องของเดือนก่อนหน้า (เพื่อเติมให้เต็มแถวแรก)
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDay - i)
    days.push(createCellObject(d, false))
  }
  
  // 2. ช่องของเดือนปัจจุบัน
  for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
    const d = new Date(year, month, i)
    days.push(createCellObject(d, true))
  }
  
  // 3. ช่องของเดือนถัดไป (เติมให้ครบ 42 ช่อง / 6 แถว)
  const remainingCells = 42 - days.length
  for (let i = 1; i <= remainingCells; i++) {
    const d = new Date(year, month + 1, i)
    days.push(createCellObject(d, false))
  }
  
  return days
})

// ฟังก์ชันดึงข้อมูลใส่แต่ละวัน
const createCellObject = (date, isCurrentMonth) => {
  const today = new Date()
  const isToday = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
  
  const eventsForDay = []

  eventList.value.forEach(ev => {
    if (isDateInRange(date, ev.start_date, ev.end_date)) {
      eventsForDay.push({
        id: `ev_${ev.id}`,
        type: 'event', // ระบุประเภท
        title: ev.title,
        colorClass: 'pill-event',
        rawData: ev // ⭐️ แนบข้อมูลดิบไปกับกล่องด้วย
      })
    }
  })

  leaveList.value.forEach(lv => {
    if (isDateInRange(date, lv.start_date, lv.end_date)) {
      const typeName = lv.leave_type_name || lv.leave_type || 'ลา'
      let cClass = 'pill-leave-pending'
      if (lv.status === 'อนุมัติ' || lv.status === 'อนุมัติแล้ว') cClass = 'pill-leave-approved'
      else if (lv.status === 'ไม่อนุมัติ') return; 
      
      eventsForDay.push({
        id: `lv_${lv.id}`,
        type: 'leave', // ระบุประเภท
        title: `${lv.full_name} (${typeName})`,
        colorClass: cClass,
        rawData: lv // ⭐️ แนบข้อมูลดิบไปกับกล่องด้วย
      })
    }
  })

  return {
    date: date,
    dayNumber: date.getDate(),
    isCurrentMonth: isCurrentMonth,
    isToday: isToday,
    events: eventsForDay
  }
}

// ⭐️ เพิ่มฟังก์ชันสำหรับเปิด/ปิด Modal และการเปลี่ยนหน้าไปแก้ไข
const openEventDetail = (eventItem) => {
  selectedEventDetail.value = eventItem
  isEventModalOpen.value = true
}

const closeEventModal = () => {
  isEventModalOpen.value = false
  selectedEventDetail.value = null
}

const goToEditPage = (detail) => {
  // นำผู้ใช้ไปยังหน้าจัดการที่ถูกต้องตามประเภทของข้อมูล
  if (detail.type === 'event') {
    router.push('/manage-events') // ไปที่หน้าจัดการปฏิทิน
  } else if (detail.type === 'leave') {
    router.push('/leave-history') // ไปที่หน้าประวัติการลา
  }
  closeEventModal()
}

// ==========================================
// 4. คำนวณสัดส่วนแยกตามตำแหน่ง
// ==========================================
const positionDistribution = computed(() => {
  const counts = {}
  somtopList.value.forEach(person => {
    const posName = person.position_name || person.role_position || 'ไม่ระบุตำแหน่ง'
    counts[posName] = (counts[posName] || 0) + 1
  })
  const total = somtopList.value.length || 1
  return Object.keys(counts).map(key => ({
    name: key,
    value: counts[key],
    percent: Math.round((counts[key] / total) * 100)
  })).sort((a, b) => b.value - a.value) 
})

// ==========================================
// 5. เตรียมข้อมูลแจ้งเตือน (ดึง 5 รายการลาล่าสุด)
// ==========================================
const recentEvents = computed(() => {
  return leaveList.value.slice(0, 5).map(leave => {
    let severity = 'info'
    if (leave.status === 'รอตรวจสอบ' || leave.status === 'รออนุมัติ') severity = 'warning'
    else if (leave.status === 'อนุมัติ' || leave.status === 'อนุมัติแล้ว') severity = 'success'
    else if (leave.status === 'ไม่อนุมัติ') severity = 'critical'

    return {
      id: leave.id,
      time: leave.submit_date ? formatThaiDate(leave.submit_date) : '-',
      person: leave.full_name || 'ไม่ระบุชื่อ',
      type: `แจ้งขอ${leave.leave_type_name || leave.leave_type || 'ลา'} (${leave.total_days} วัน)`,
      status: leave.status || 'รอตรวจสอบ',
      severityClass: severity
    }
  })
})

const formatThaiDate = (dateStr) => {
  if (!dateStr || dateStr === '0000-00-00') return '-';
  
  // ⭐️ ดักจับทั้ง T และช่องว่าง
  const dateOnly = dateStr.split('T')[0].split(' ')[0];
  const [year, month, day] = dateOnly.split('-');
  
  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${parseInt(day)} ${monthNames[parseInt(month) - 1]} ${parseInt(year) + 543}`;
}

onMounted(() => {
  fetchData()
})
</script>
<style scoped>
/* =========================================
   Dashboard Specific Styles (เฉพาะหน้านี้)
========================================= */
.header-actions { display: flex; gap: 12px; }
.mb-0 { margin-bottom: 0 !important; }

/* Dashboard Primary Btn override (เพิ่ม Flex ให้ไอคอนตรงกับข้อความ) */
.btn-primary { display: flex; align-items: center; gap: 8px; }

/* Grid System */
.grid-layout { display: grid; grid-template-columns: repeat(12, 1fr); gap: 24px; }
.card-title { font-size: 16px; font-weight: 600; margin: 0 0 16px 0; color: #111827; }
.card-subtitle { font-size: 12px; color: #6B7280; margin-top: 4px; }
.card-header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }

/* KPIs */
.kpi-card { grid-column: span 3; }
.kpi-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.icon-box { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.icon-box.purple { background-color: #F3E8FF; color: #7E22CE; }
.icon-box.green { background-color: #D1FAE5; color: #047857; }
.icon-box.orange { background-color: #FEF3C7; color: #B45309; }
.icon-box.blue { background-color: #DBEAFE; color: #1D4ED8; }
.kpi-value { font-size: 28px; font-weight: 700; color: #111827; }
.unit { font-size: 14px; color: #6B7280; font-weight: 400; }

/* Sections */
.calendar-section { grid-column: span 12; min-height: 500px; display: flex; flex-direction: column; padding: 20px; }
.assets-section { grid-column: span 4; }
.events-section { grid-column: span 12; }

/* Assets Progress */
.asset-list { display: flex; flex-direction: column; gap: 16px; }
.asset-item { display: flex; flex-direction: column; gap: 8px; font-size: 14px; color: #374151;}
.asset-info { display: flex; justify-content: space-between; }
.asset-val { color: #111827; font-weight: 600; }
.progress-bar { width: 100%; height: 6px; background-color: #E5E7EB; border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background-color: #8B5CF6; border-radius: 3px; }

/* Alert Table Specifics */
.alert-table { width: 100%; border-collapse: collapse; font-size: 14px; text-align: left; }
.alert-table th { color: #6B7280; font-size: 13px; padding: 12px 0; border-bottom: 2px solid #E5E7EB; }
.alert-table td { padding: 16px 0; border-bottom: 1px solid #E5E7EB; color: #374151; }
.alert-row:hover td { background-color: #F9FAFB; }
.time-col { color: #6B7280; font-size: 13px; }
.name-col { font-weight: 500; color: #111827; }
.alert-box { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
.alert-box.success { color: #065F46; background-color: #D1FAE5; }
.alert-box.warning { color: #92400E; background-color: #FEF3C7; }
.alert-box.critical { color: #991B1B; background-color: #FEE2E2; }
.alert-box.info { color: #1D4ED8; background-color: #DBEAFE; }
.view-history { color: #10B981; text-decoration: none; font-size: 14px; font-weight: 500;}
.view-history:hover { text-decoration: underline; }

/* Custom Calendar Styling */
.calendar-header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.calendar-nav { display: flex; align-items: center; gap: 16px; }
.legend { display: flex; gap: 12px; font-size: 12px; color: #6B7280; }
.legend-item { display: flex; align-items: center; gap: 6px; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.event-dot { background-color: #8B5CF6; }
.leave-approved-dot { background-color: #10B981; }
.leave-pending-dot { background-color: #F59E0B; }

.calendar-wrapper { border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; flex: 1; }
.calendar-days-header { display: grid; grid-template-columns: repeat(7, 1fr); background-color: #F9FAFB; border-bottom: 1px solid #E5E7EB; }
.day-name { padding: 10px; text-align: center; font-size: 13px; font-weight: 600; color: #4B5563; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); flex: 1; background-color: #E5E7EB; gap: 1px; }

.calendar-cell { background-color: #FFFFFF; min-height: 80px; padding: 4px; display: flex; flex-direction: column; transition: background-color 0.2s; min-width: 0;}
.calendar-cell:hover { background-color: #F9FAFB; }
.calendar-cell.not-current-month { background-color: #F3F4F6; color: #9CA3AF; }
.calendar-cell.is-today .date-number { background-color: #10B981; color: white; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 600; margin: 2px 2px 4px auto; }

.date-number { font-size: 13px; font-weight: 500; text-align: right; margin: 2px 4px 4px auto; display: block; }
.events-container { display: flex; flex-direction: column; gap: 4px; overflow-y: auto; max-height: 80px; padding-right: 2px; }
.events-container::-webkit-scrollbar { width: 4px; }
.events-container::-webkit-scrollbar-thumb { background-color: #D1D5DB; border-radius: 4px; }

.event-pill { font-size: 10px; padding: 3px 6px; border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; border-left: 3px solid transparent; display: block; width: 100%; box-sizing: border-box; transition: filter 0.2s;}
.event-pill:hover { filter: brightness(0.9); }
.pill-event { background-color: #EDE9FE; color: #5B21B6; border-left-color: #8B5CF6; }
.pill-leave-approved { background-color: #D1FAE5; color: #065F46; border-left-color: #10B981; }
.pill-leave-pending { background-color: #FEF3C7; color: #92400E; border-left-color: #F59E0B; }

/* Event Modal Styles (Overrides) */
.modal-card.detail-modal { max-width: 500px; padding: 24px; }
.modal-body { display: flex; flex-direction: column; gap: 12px; }
.detail-group { display: flex; flex-direction: column; gap: 4px; }
.detail-group label { font-size: 13px; color: #6B7280; font-weight: 500; }
.detail-group p { margin: 0; font-size: 15px; color: #111827; }
.text-purple-700 { color: #6D28D9; }
.font-bold { font-weight: 600; }
.text-sm { font-size: 13px; }
.text-gray-500 { color: #6B7280; }
.btn-primary.edit-btn { background-color: #3B82F6; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2); }
.btn-primary.edit-btn:hover { background-color: #2563EB; }

/* =========================================
   📱 Mobile Responsiveness (หน้าจอมือถือ)
========================================= */
@media (max-width: 768px) {
  /* เปลี่ยน Grid จาก 12 คอลัมน์ ให้เหลือ 1 คอลัมน์ เรียงลงมา */
  .grid-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  /* บังคับการ์ดทุกใบให้เต็มจอ */
  .kpi-card, 
  .calendar-section, 
  .assets-section, 
  .events-section {
    grid-column: span 1;
  }

  /* ปรับปฏิทินให้แสดงผลบนมือถือได้พอดี */
  .calendar-header-flex {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .calendar-nav {
    justify-content: space-between;
  }
  .legend {
    flex-wrap: wrap;
    justify-content: center;
  }
  .day-name {
    padding: 8px 4px;
    font-size: 11px;
  }
  .calendar-cell {
    min-height: 60px; /* ลดความสูงของช่องวันที่ลง */
    padding: 2px;
  }
  .date-number {
    font-size: 11px;
    margin: 2px 2px 2px auto;
  }
  .events-container {
    max-height: 60px; /* ลดความสูงของกล่องข้อความกิจกรรม */
  }
  .event-pill {
    font-size: 9px;
    padding: 2px 4px;
  }
  
  /* ปรับปุ่ม Header ให้กดง่ายขึ้นบนมือถือ */
  .header-actions {
    width: 100%;
    margin-top: 12px;
    flex-direction: column;
  }
  .header-actions button {
    width: 100%;
    justify-content: center;
  }
  
  /* ปรับการจัดเรียง Header ของการ์ด */
  .card-header-flex {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .view-history {
    align-self: flex-start;
  }
}
</style>