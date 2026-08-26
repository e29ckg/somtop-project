<template>
  <div class="dashboard-content">
    <!-- Dashboard Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">ภาพรวมระบบ</h1>
        <p class="page-subtitle">สถิติและข้อมูลผู้พิพากษาสมทบในระบบ</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary">เดือนนี้</button>
        <button class="btn-primary">
          <span class="icon">📥</span> นำออกรายงาน
        </button>
      </div>
    </div>

    <!-- 12-Column Grid -->
    <div class="grid-layout">
      
      <!-- KPIs (4 Cards, spanning 3 columns each) -->
      <div class="card kpi-card">
        <div class="kpi-header">
          <span class="icon-box purple">👥</span>
          <span class="trend up">+2 คน</span>
        </div>
        <h3 class="card-title">จำนวน พ.สมทบ ทั้งหมด</h3>
        <div class="kpi-value">124 <span class="unit">คน</span></div>
      </div>

      <div class="card kpi-card">
        <div class="kpi-header">
          <span class="icon-box green">✅</span>
          <span class="trend stable">คงที่</span>
        </div>
        <h3 class="card-title">ปฏิบัติหน้าที่ (Active)</h3>
        <div class="kpi-value">98 <span class="unit">คน</span></div>
      </div>

      <div class="card kpi-card">
        <div class="kpi-header">
          <span class="icon-box orange">⏸️</span>
          <span class="trend down">-1 คน</span>
        </div>
        <h3 class="card-title">ลาพัก / ระงับ</h3>
        <div class="kpi-value">15 <span class="unit">คน</span></div>
      </div>

      <div class="card kpi-card">
        <div class="kpi-header">
          <span class="icon-box blue">⏳</span>
          <span class="trend info">รอตรวจสอบ</span>
        </div>
        <h3 class="card-title">รออนุมัติข้อมูล</h3>
        <div class="kpi-value">11 <span class="unit">รายการ</span></div>
      </div>

      <!-- Main Chart (Spanning 8 columns) -->
      <div class="card chart-section">
        <div class="card-header-flex">
          <h2 class="card-title">สถิติการมาปฏิบัติงานย้อนหลัง</h2>
          <div class="legend">
            <span class="legend-item"><span class="dot active"></span> เข้าเวรศาล</span>
            <span class="legend-item"><span class="dot base"></span> อบรม/สัมมนา</span>
          </div>
        </div>
        <div class="chart-placeholder">
          <p>[ พื้นที่แสดงกราฟเส้น ]<br>แสดงแนวโน้มการเข้าปฏิบัติงานในแต่ละเดือน</p>
        </div>
      </div>

      <!-- Right Panel: Distribution (Spanning 4 columns) -->
      <div class="card assets-section">
        <h2 class="card-title">สัดส่วนแยกตามศาล/แผนก</h2>
        <div class="asset-list">
          <div class="asset-item" v-for="dept in departments" :key="dept.name">
            <div class="asset-info">
              <span>{{ dept.name }}</span>
              <span class="asset-val">{{ dept.value }} คน</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: dept.percent + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Panel: Recent Events (Spanning 12 columns) -->
      <div class="card events-section">
        <div class="card-header-flex">
          <div>
            <h2 class="card-title">กิจกรรม / การแจ้งเตือนล่าสุด</h2>
            <p class="card-subtitle">SYSTEM HEALTH & ACTIVITY MONITORING</p>
          </div>
          <a href="#" class="view-history">ดูประวัติทั้งหมด</a>
        </div>
        
        <div class="table-responsive">
          <table class="alert-table">
            <thead>
              <tr>
                <th>เวลา</th>
                <th>ชื่อ-สกุล (พ.สมทบ)</th>
                <th>ประเภทกิจกรรม</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="event in events" :key="event.id" class="alert-row">
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
  </div>
</template>

<script setup>
import { ref } from 'vue'

// ข้อมูลจำลองสำหรับ UI (เปลี่ยนบริบทเป็น พ.สมทบ)
const departments = ref([
  { name: 'ศาลเยาวชนและครอบครัว', value: 45, percent: 80 },
  { name: 'ศาลแรงงาน', value: 28, percent: 60 },
  { name: 'ศาลทรัพย์สินทางปัญญาฯ', value: 25, percent: 50 },
  { name: 'ผู้ทรงคุณวุฒิด้านจิตวิทยา', value: 14, percent: 30 },
  { name: 'ผู้ทรงคุณวุฒิด้านสังคมสงเคราะห์', value: 12, percent: 20 }
])

const events = ref([
  { id: 1, time: '10 นาทีที่แล้ว', person: 'นาย สมชาย รักยุติธรรม', type: 'แจ้งขอลาพักการปฏิบัติหน้าที่ (15 วัน)', status: 'รออนุมัติ', severityClass: 'warning' },
  { id: 2, time: '1 ชั่วโมงที่แล้ว', person: 'นาง สมศรี มีเมตตา', type: 'อัปเดตข้อมูลที่อยู่ปัจจุบัน', status: 'เสร็จสิ้น', severityClass: 'success' },
  { id: 3, time: '2 ชั่วโมงที่แล้ว', person: 'ระบบจัดการกลาง', type: 'ตรวจสอบพบข้อมูลบัตรประชาชนซ้ำในระบบ', status: 'ข้อผิดพลาด', severityClass: 'critical' },
  { id: 4, time: 'เมื่อวานนี้', person: 'นาย รักดี ศรีนคร', type: 'ลงทะเบียนเข้าสู่ระบบครั้งแรก', status: 'เสร็จสิ้น', severityClass: 'success' }
])
</script>

<style scoped>
.dashboard-content {
  color: #333333;
}

/* Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 32px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: #111827;
}

.page-subtitle {
  color: #6B7280;
  margin: 0;
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn-primary {
  background-color: #10B981; /* สีเขียว Emerald */
  color: #FFFFFF;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
}
.btn-primary:hover { background-color: #059669; }

.btn-secondary {
  background-color: #FFFFFF;
  color: #374151;
  border: 1px solid #D1D5DB;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary:hover { background-color: #F3F4F6; }

/* Grid & Cards */
.grid-layout {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 24px;
}

.card {
  background-color: #FFFFFF;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #E5E7EB;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #111827;
}

.card-subtitle {
  font-size: 12px;
  color: #6B7280;
  margin-top: 4px;
}

.card-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

/* KPIs */
.kpi-card { grid-column: span 3; }

.kpi-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.icon-box {
  width: 40px; height: 40px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
}
.icon-box.purple { background-color: #F3E8FF; color: #7E22CE; }
.icon-box.green { background-color: #D1FAE5; color: #047857; }
.icon-box.orange { background-color: #FEF3C7; color: #B45309; }
.icon-box.blue { background-color: #DBEAFE; color: #1D4ED8; }

.trend { font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 6px; }
.trend.up { background-color: #D1FAE5; color: #065F46; }
.trend.down { background-color: #FEE2E2; color: #991B1B; }
.trend.stable { background-color: #F3F4F6; color: #4B5563; }
.trend.info { background-color: #FEF3C7; color: #92400E; }

.kpi-value {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
}

.unit {
  font-size: 14px;
  color: #6B7280;
  font-weight: 400;
}

/* Charts & Lists */
.chart-section { grid-column: span 8; min-height: 350px; display: flex; flex-direction: column; }
.assets-section { grid-column: span 4; }
.events-section { grid-column: span 12; }

.chart-placeholder {
  flex: 1;
  border: 2px dashed #E5E7EB;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9CA3AF;
  text-align: center;
  background-color: #F9FAFB;
}

.legend { display: flex; gap: 16px; font-size: 13px; color: #6B7280; }
.legend-item { display: flex; align-items: center; gap: 6px; }

.asset-list { display: flex; flex-direction: column; gap: 16px; }
.asset-item { display: flex; flex-direction: column; gap: 8px; font-size: 14px; color: #374151;}
.asset-info { display: flex; justify-content: space-between; }
.asset-val { color: #111827; font-weight: 600; }

.progress-bar { width: 100%; height: 6px; background-color: #E5E7EB; border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background-color: #8B5CF6; border-radius: 3px; } /* สีม่วงตาม Theme */

/* Table */
.table-responsive { overflow-x: auto; }
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

.view-history { color: #10B981; text-decoration: none; font-size: 14px; font-weight: 500;}
.view-history:hover { text-decoration: underline; }
</style>