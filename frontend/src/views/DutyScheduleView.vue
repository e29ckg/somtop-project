<template>
  <div class="manage-layout duty-page">
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">เวรปฏิบัติหน้าที่</h1>
        <p class="page-subtitle">จัดทำคำสั่งรายเดือนและกำหนดผู้ปฏิบัติหน้าที่วันละ 2–4 ท่าน</p>
      </div>
      <div v-if="isAdmin" class="header-actions">
        <button class="btn-secondary" @click="openTeamModal()">👥 จัดการคณะ</button>
        <button class="btn-primary" @click="openOrderModal()">+ เพิ่มคำสั่งประจำเดือน</button>
      </div>
    </div>

    <section class="card toolbar no-print">
      <div class="filter-group duty-filter-field month-field">
        <label for="duty-month">เดือน</label>
        <div class="month-control month-control-left">
          <button class="month-nav" title="เดือนก่อนหน้า" aria-label="เดือนก่อนหน้า" @click="changeMonth(-1)">‹</button>
          <select id="duty-month" v-model="selectedMonthNumber" class="month-input">
            <option v-for="month in thaiMonths" :key="month.value" :value="month.value">{{ month.label }}</option>
          </select>
        </div>
      </div>
      <div class="filter-group duty-filter-field year-field">
        <label for="duty-year">ปี</label>
        <div class="month-control month-control-right">
          <select id="duty-year" v-model="selectedBuddhistYear" class="year-input">
            <option v-for="year in yearOptions" :key="year" :value="year">พ.ศ. {{ year }}</option>
          </select>
          <button class="month-nav" title="เดือนถัดไป" aria-label="เดือนถัดไป" @click="changeMonth(1)">›</button>
        </div>
      </div>
      <div class="filter-group duty-filter-field order-field">
        <label for="duty-order">คำสั่งประจำเดือน</label>
        <select id="duty-order" v-model="selectedOrderId" class="order-select">
          <option value="">ทุกคำสั่งในเดือน</option>
          <option v-for="order in orders" :key="order.id" :value="String(order.id)">{{ order.order_number }} — {{ order.title }}</option>
        </select>
      </div>
      <div class="filter-actions duty-filter-actions">
        <button class="btn-primary print-order-button" :disabled="!selectedOrderId" @click="printSelectedOrder">🖨️ พิมพ์ตามคำสั่ง</button>
      </div>
    </section>

    <section v-if="orders.length" class="order-strip no-print">
      <article v-for="order in orders" :key="order.id" class="order-card" :class="{ active: String(order.id) === selectedOrderId }" @click="selectedOrderId = String(order.id)">
        <div><strong>{{ order.order_number }}</strong><span>{{ order.title }}</span></div>
        <div class="order-actions">
          <button v-if="order.has_signed_order_pdf" class="pdf-ready" title="ดาวน์โหลดคำสั่ง PDF ที่ลงนามแล้ว" @click.stop="downloadSignedPdf(order)">PDF</button>
          <template v-if="isAdmin">
            <button :title="order.has_signed_order_pdf ? 'อัปโหลดไฟล์คำสั่ง PDF ใหม่' : 'อัปโหลดไฟล์คำสั่ง PDF ที่ลงนามแล้ว'" @click.stop="$event.currentTarget.nextElementSibling.click()">📤</button>
            <input type="file" accept="application/pdf,.pdf" hidden @click.stop @change="uploadSignedPdf(order, $event)" />
            <button v-if="order.has_signed_order_pdf" class="danger" title="ลบไฟล์คำสั่ง PDF" @click.stop="deleteSignedPdf(order)">✕</button>
          </template>
        </div>
        <div v-if="isAdmin" class="order-actions">
          <button title="แก้ไขคำสั่ง" @click.stop="openOrderModal(order)">✏️</button>
          <button title="ลบคำสั่ง" @click.stop="deleteOrder(order)">🗑️</button>
        </div>
      </article>
    </section>

    <div v-if="isLoading" class="card loading-state"><div class="loading-spinner"></div>กำลังโหลดปฏิทิน...</div>
    <section v-else class="card duty-calendar-section">
      <div class="duty-calendar-header">
        <div><h2>{{ monthTitle }}</h2><span>คลิกวันที่เพื่อดูรายละเอียด{{ isAdmin ? 'หรือจัดเวร' : '' }}</span></div>
        <div class="duty-legend no-print"><span><i class="legend-dot understaffed"></i>น้อยกว่า 2 ท่าน</span><span><i class="legend-dot complete"></i>ครบ 2–4 ท่าน</span></div>
      </div>
      <div class="duty-calendar-wrapper">
        <div class="duty-days-header"><div v-for="day in weekDays" :key="day" class="duty-day-name">{{ day }}</div></div>
        <div class="duty-calendar-grid">
          <div v-for="blank in leadingBlanks" :key="`leading-${blank}`" class="duty-calendar-cell blank"></div>
          <button v-for="day in daysInMonth" :key="day.date" class="duty-calendar-cell" :class="dayClass(day)" @click="openDay(day.date)">
            <span class="duty-date-number">{{ day.day }}</span>
            <div class="duty-events-container">
              <span v-for="item in schedulesByDate[day.date] || []" :key="item.id" class="duty-event-pill" :title="`${item.full_name} · ${item.order_number || ''}`">{{ item.full_name }}</span>
            </div>
            <small v-if="(schedulesByDate[day.date] || []).length" class="duty-total">{{ (schedulesByDate[day.date] || []).length }} ท่าน</small>
          </button>
          <div v-for="blank in trailingBlanks" :key="`trailing-${blank}`" class="duty-calendar-cell blank"></div>
        </div>
      </div>
    </section>

    <div v-if="isOrderModalOpen" class="modal-overlay no-print">
      <div class="modal-card compact-modal">
        <div class="modal-header"><h2>{{ orderForm.id ? 'แก้ไขคำสั่ง' : 'เพิ่มคำสั่งประจำเดือน' }}</h2><button class="close-btn" @click="isOrderModalOpen=false">✕</button></div>
        <form class="form-grid" @submit.prevent="saveOrder">
          <div class="input-group"><label>เลขที่คำสั่ง *</label><input v-model.trim="orderForm.order_number" required /></div>
          <div class="input-group"><label>ประจำเดือน *</label><input v-model="orderForm.order_month" type="month" required :disabled="!!orderForm.id" /></div>
          <div class="input-group full-width"><label>ชื่อคำสั่ง *</label><input v-model.trim="orderForm.title" required /></div>
          <div class="input-group full-width"><label>หมายเหตุ</label><textarea v-model="orderForm.note" rows="3"></textarea></div>
          <div class="modal-actions full-width"><button type="button" class="btn-secondary" @click="isOrderModalOpen=false">ยกเลิก</button><button class="btn-primary">บันทึกคำสั่ง</button></div>
        </form>
      </div>
    </div>

    <div v-if="isDayModalOpen" class="modal-overlay no-print">
      <div class="modal-card day-modal">
        <div class="modal-header"><div><h2>เวรวันที่ {{ formatThaiDate(activeDate) }}</h2><small>{{ activeDaySchedules.length }} จาก 2–4 ท่าน</small></div><button class="close-btn" @click="closeDayModal">✕</button></div>
        <div v-if="activeDaySchedules.length" class="assigned-list">
          <article v-for="item in activeDaySchedules" :key="item.id" class="assigned-person">
            <div><strong>{{ item.full_name }}</strong><span>{{ item.team_name ? `${item.team_name} · ` : '' }}{{ item.duty_type_name }} · {{ item.order_number || 'ไม่ระบุคำสั่ง' }}</span></div>
            <div v-if="isAdmin" class="row-actions">
              <button @click="editSchedule(item)">แก้ไข</button><button @click="openSwap(item)">เปลี่ยนเวร</button><button class="danger" @click="deleteSchedule(item)">ลบ</button>
            </div>
          </article>
        </div>
        <p v-else class="empty-day">ยังไม่มีผู้ปฏิบัติหน้าที่ในวันนี้</p>
        <form v-if="isAdmin && activeDaySchedules.length < 4" class="schedule-form" @submit.prevent="saveSchedule">
          <h3>{{ scheduleForm.id ? 'แก้ไขรายการเวร' : 'เพิ่มผู้ปฏิบัติหน้าที่' }}</h3>
          <div class="form-grid">
            <div class="input-group"><label>คำสั่ง *</label><select v-model="scheduleForm.order_id" required><option value="" disabled>เลือกคำสั่ง</option><option v-for="order in orders" :key="order.id" :value="String(order.id)">{{ order.order_number }}</option></select></div>
            <div class="input-group"><label>ประเภทเวร *</label><select v-model="scheduleForm.duty_type_id" required><option v-for="type in dutyTypes" :key="type.id" :value="String(type.id)">{{ type.name }}</option></select></div>
            <div v-if="!scheduleForm.id" class="input-group full-width"><label>เพิ่มเป็นคณะ (คณะละ 2 คน)</label><select v-model="scheduleForm.team_id"><option value="">ไม่ใช้คณะ — เพิ่มรายบุคคล</option><option v-for="team in teams" :key="team.id" :value="String(team.id)">{{ team.team_name }} — {{ team.member_one_name }} / {{ team.member_two_name }}</option></select></div>
            <div class="input-group full-width"><label>ผู้ปฏิบัติหน้าที่{{ scheduleForm.team_id ? ' (ระบบเลือกจากคณะ)' : ' *' }}</label><select v-model="scheduleForm.somtop_id" :required="!scheduleForm.team_id" :disabled="!!scheduleForm.team_id"><option value="" disabled>{{ scheduleForm.team_id ? 'เพิ่มสมาชิกทั้ง 2 คนจากคณะที่เลือก' : 'เลือกรายชื่อ' }}</option><option v-for="person in people" :key="person.id" :value="String(person.id)">{{ person.full_name }}</option></select></div>
            <div class="input-group full-width"><label>หมายเหตุ</label><input v-model="scheduleForm.note" /></div>
          </div>
          <div class="modal-actions"><button v-if="scheduleForm.id" type="button" class="btn-secondary" @click="resetScheduleForm">ยกเลิกแก้ไข</button><button class="btn-primary">{{ scheduleForm.id ? 'บันทึกการแก้ไข' : 'เพิ่มรายชื่อ' }}</button></div>
        </form>
        <div v-if="activeDaySchedules.length > 0 && activeDaySchedules.length < 2" class="minimum-warning">ควรเพิ่มผู้ปฏิบัติหน้าที่อย่างน้อย 2 ท่าน</div>
      </div>
    </div>

    <div v-if="isTeamModalOpen" class="modal-overlay no-print">
      <div class="modal-card day-modal">
        <div class="modal-header"><h2>จัดเตรียมคณะปฏิบัติหน้าที่</h2><button class="close-btn" @click="isTeamModalOpen=false">✕</button></div>
        <div v-if="teams.length" class="assigned-list">
          <article v-for="team in teams" :key="team.id" class="assigned-person">
            <div><strong>{{ team.team_name }}</strong><span>{{ team.member_one_name }} และ {{ team.member_two_name }}</span></div>
            <div class="row-actions"><button @click="editTeam(team)">แก้ไข</button><button class="danger" @click="deleteTeam(team)">ลบ</button></div>
          </article>
        </div>
        <p v-else class="empty-day">ยังไม่มีคณะปฏิบัติหน้าที่</p>
        <form class="schedule-form" @submit.prevent="saveTeam">
          <h3>{{ teamForm.id ? 'แก้ไขคณะ' : 'เพิ่มคณะใหม่' }}</h3>
          <div class="form-grid">
            <div class="input-group full-width"><label>ชื่อหรือหมายเลขคณะ *</label><input v-model.trim="teamForm.team_name" required placeholder="เช่น คณะที่ 1" /></div>
            <div class="input-group"><label>สมาชิกคนที่ 1 *</label><input v-model.trim="teamSearchOne" type="search" placeholder="ค้นหาชื่อหรือตำแหน่ง..." /><select v-model="teamForm.member_one_somtop_id" required size="6"><option value="" disabled>เลือกรายชื่อ</option><option v-for="person in filteredPeopleOne" :key="person.id" :value="String(person.id)" :disabled="String(person.id)===teamForm.member_two_somtop_id">{{ person.full_name }}{{ person.position_name ? ` — ${person.position_name}` : '' }}</option></select></div>
            <div class="input-group"><label>สมาชิกคนที่ 2 *</label><input v-model.trim="teamSearchTwo" type="search" placeholder="ค้นหาชื่อหรือตำแหน่ง..." /><select v-model="teamForm.member_two_somtop_id" required size="6"><option value="" disabled>เลือกรายชื่อ</option><option v-for="person in filteredPeopleTwo" :key="person.id" :value="String(person.id)" :disabled="String(person.id)===teamForm.member_one_somtop_id">{{ person.full_name }}{{ person.position_name ? ` — ${person.position_name}` : '' }}</option></select></div>
          </div>
          <div class="modal-actions"><button v-if="teamForm.id" type="button" class="btn-secondary" @click="resetTeamForm">ยกเลิกแก้ไข</button><button class="btn-primary">{{ teamForm.id ? 'บันทึกการแก้ไข' : 'เพิ่มคณะ' }}</button></div>
        </form>
      </div>
    </div>

    <div v-if="isSwapModalOpen" class="modal-overlay no-print">
      <div class="modal-card compact-modal">
        <div class="modal-header"><h2>ใบขอเปลี่ยนเวร</h2><button class="close-btn" @click="isSwapModalOpen=false">✕</button></div>
        <form class="form-grid" @submit.prevent="saveSwap">
          <div class="input-group full-width"><label>ผู้ขอเปลี่ยนเวร</label><input :value="swapSource?.full_name" disabled /></div>
          <div class="input-group full-width"><label>ผู้ปฏิบัติหน้าที่แทน *</label><select v-model="swapForm.replacement_somtop_id" required><option value="" disabled>เลือกรายชื่อ</option><option v-for="person in replacementPeople" :key="person.id" :value="String(person.id)">{{ person.full_name }}</option></select></div>
          <div class="input-group full-width"><label>เหตุผล *</label><textarea v-model.trim="swapForm.reason" rows="4" required></textarea></div>
          <div class="modal-actions full-width"><button type="button" class="btn-secondary" @click="isSwapModalOpen=false">ยกเลิก</button><button class="btn-primary">บันทึกและดาวน์โหลด Word</button></div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '../services/api'
import { isAdmin } from '../services/session'
import { swalConfirm, swalError, swalSuccess } from '../utils/swal'

const now = new Date()
const thaiMonths = [
  { value:1, label:'มกราคม' }, { value:2, label:'กุมภาพันธ์' }, { value:3, label:'มีนาคม' },
  { value:4, label:'เมษายน' }, { value:5, label:'พฤษภาคม' }, { value:6, label:'มิถุนายน' },
  { value:7, label:'กรกฎาคม' }, { value:8, label:'สิงหาคม' }, { value:9, label:'กันยายน' },
  { value:10, label:'ตุลาคม' }, { value:11, label:'พฤศจิกายน' }, { value:12, label:'ธันวาคม' }
]
const selectedMonthNumber = ref(now.getMonth()+1)
const selectedBuddhistYear = ref(now.getFullYear()+543)
const yearOptions = Array.from({length:26},(_,index)=>now.getFullYear()+548-index)
const selectedMonth = computed({
  get:()=>`${selectedBuddhistYear.value-543}-${String(selectedMonthNumber.value).padStart(2,'0')}`,
  set:value=>{const [year,month]=String(value).split('-').map(Number);if(year&&month){selectedBuddhistYear.value=year+543;selectedMonthNumber.value=month}}
})
const selectedOrderId = ref('')
const orders = ref([]), schedules = ref([]), dutyTypes = ref([]), people = ref([]), teams = ref([])
const isLoading = ref(false), isOrderModalOpen = ref(false), isDayModalOpen = ref(false), isSwapModalOpen = ref(false), isTeamModalOpen = ref(false)
const activeDate = ref(''), swapSource = ref(null)
const orderForm = ref({ id:null, order_number:'', title:'', order_month:selectedMonth.value, note:'', status:'ใช้งาน' })
const scheduleForm = ref({ id:null, order_id:'', team_id:'', somtop_id:'', duty_type_id:'', note:'' })
const teamForm = ref({ id:null, team_name:'', member_one_somtop_id:'', member_two_somtop_id:'' })
const teamSearchOne = ref(''), teamSearchTwo = ref('')
const swapForm = ref({ replacement_somtop_id:'', reason:'' })
const weekDays = ['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.']

const monthTitle = computed(() => new Date(`${selectedMonth.value}-01T00:00:00`).toLocaleDateString('th-TH',{month:'long',year:'numeric'}))
const daysInMonth = computed(() => { const [y,m]=selectedMonth.value.split('-').map(Number); const total=new Date(y,m,0).getDate(); return Array.from({length:total},(_,i)=>({day:i+1,date:`${selectedMonth.value}-${String(i+1).padStart(2,'0')}`})) })
const leadingBlanks = computed(() => Array.from({length:(new Date(`${selectedMonth.value}-01T00:00:00`).getDay()+6)%7},(_,i)=>i))
const trailingBlanks = computed(() => Array.from({length:(7-((leadingBlanks.value.length+daysInMonth.value.length)%7))%7},(_,i)=>i))
const schedulesByDate = computed(() => schedules.value.reduce((map,item)=>{(map[item.duty_date] ||= []).push(item);return map},{}))
const activeDaySchedules = computed(() => schedulesByDate.value[activeDate.value] || [])
const replacementPeople = computed(() => people.value.filter(p=>p.id!==swapSource.value?.somtop_id))
const filterPeople = (query, selectedId) => {const text=query.trim().toLowerCase();if(!text)return people.value;return people.value.filter(person=>String(person.id)===selectedId||`${person.full_name} ${person.position_name||''}`.toLowerCase().includes(text))}
const filteredPeopleOne = computed(() => filterPeople(teamSearchOne.value, teamForm.value.member_one_somtop_id))
const filteredPeopleTwo = computed(() => filterPeople(teamSearchTwo.value, teamForm.value.member_two_somtop_id))

const fetchCalendar = async () => { isLoading.value=true; try { const {data}=await api.get('/duties/calendar',{params:{month:selectedMonth.value,order_id:selectedOrderId.value||undefined}});orders.value=data.orders||[];schedules.value=data.schedules||[];dutyTypes.value=data.duty_types||[];if(selectedOrderId.value&&!orders.value.some(o=>String(o.id)===selectedOrderId.value))selectedOrderId.value='' } catch(e){swalError('โหลดข้อมูลไม่สำเร็จ',e.response?.data?.message||'ไม่สามารถโหลดปฏิทินเวรได้')} finally{isLoading.value=false} }
const fetchPeople = async () => { const {data}=await api.get('/duties/people');people.value=data.records||[] }
const fetchTeams = async () => { const {data}=await api.get('/duties/teams');teams.value=data.records||[] }
const changeMonth = amount => { const [y,m]=selectedMonth.value.split('-').map(Number);const date=new Date(y,m-1+amount,1);selectedMonth.value=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}` }
const formatThaiDate = value => new Date(`${value}T00:00:00`).toLocaleDateString('th-TH',{dateStyle:'long'})
const dayClass = day => { const count=(schedulesByDate.value[day.date]||[]).length;return {understaffed:count>0&&count<2,complete:count>=2,full:count>=4,today:day.date===new Date().toISOString().slice(0,10)} }
const openDay = date => { activeDate.value=date;resetScheduleForm();if(selectedOrderId.value)scheduleForm.value.order_id=selectedOrderId.value;isDayModalOpen.value=true }
const closeDayModal = () => {isDayModalOpen.value=false;resetScheduleForm()}
const resetScheduleForm = () => {scheduleForm.value={id:null,order_id:selectedOrderId.value||'',team_id:'',somtop_id:'',duty_type_id:String(dutyTypes.value[0]?.id||''),note:''}}
const editSchedule = item => {scheduleForm.value={id:item.id,order_id:String(item.order_id||''),team_id:'',somtop_id:String(item.somtop_id),duty_type_id:String(item.duty_type_id),note:item.note||''}}
const openOrderModal = order => {orderForm.value=order?{id:order.id,order_number:order.order_number,title:order.title,order_month:String(order.order_month).slice(0,7),note:order.note||'',status:order.status}:{id:null,order_number:'',title:'คำสั่งเวรปฏิบัติหน้าที่',order_month:selectedMonth.value,note:'',status:'ใช้งาน'};isOrderModalOpen.value=true}
const saveOrder = async () => {try{if(orderForm.value.id)await api.put(`/duties/orders/${orderForm.value.id}`,orderForm.value);else await api.post('/duties/orders',orderForm.value);isOrderModalOpen.value=false;selectedMonth.value=orderForm.value.order_month;await fetchCalendar();swalSuccess('บันทึกสำเร็จ','บันทึกคำสั่งเรียบร้อยแล้ว')}catch(e){swalError('บันทึกไม่สำเร็จ',e.response?.data?.message||'เกิดข้อผิดพลาด')}}
const deleteOrder = async order => {const ok=await swalConfirm('ยืนยันการลบคำสั่ง',`รายการเวรทั้งหมดใน ${order.order_number} จะถูกลบด้วย`);if(!ok.isConfirmed)return;try{await api.delete(`/duties/orders/${order.id}`);selectedOrderId.value='';await fetchCalendar()}catch(e){swalError('ลบไม่สำเร็จ',e.response?.data?.message)}}
const uploadSignedPdf = async (order,event) => {const file=event.target.files?.[0];event.target.value='';if(!file)return;if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){swalError('ไฟล์ไม่ถูกต้อง','กรุณาเลือกไฟล์ PDF เท่านั้น');return}try{const data=new FormData();data.append('signed_order_pdf',file);await api.post(`/duties/orders/${order.id}/signed-pdf`,data,{headers:{'Content-Type':'multipart/form-data'}});await fetchCalendar();swalSuccess('แนบไฟล์สำเร็จ','บันทึกคำสั่ง PDF ที่ลงนามแล้วเรียบร้อย')}catch(e){swalError('แนบไฟล์ไม่สำเร็จ',e.response?.data?.message||'ไม่สามารถบันทึกไฟล์ PDF ได้')}}
const downloadSignedPdf = async order => {try{const response=await api.get(`/duties/orders/${order.id}/signed-pdf`,{responseType:'blob'});const url=URL.createObjectURL(response.data);const link=document.createElement('a');link.href=url;link.download=`คำสั่งเวร_${order.order_number}_ลงนามแล้ว.pdf`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url)}catch(e){swalError('ดาวน์โหลดไม่สำเร็จ','ไม่พบไฟล์คำสั่ง PDF ที่ลงนามแล้ว')}}
const deleteSignedPdf = async order => {const ok=await swalConfirm('ยืนยันการลบไฟล์',`ลบไฟล์ PDF ที่ลงนามแล้วของคำสั่ง ${order.order_number}?`);if(!ok.isConfirmed)return;try{await api.delete(`/duties/orders/${order.id}/signed-pdf`);await fetchCalendar()}catch(e){swalError('ลบไฟล์ไม่สำเร็จ',e.response?.data?.message||'ไม่สามารถลบไฟล์ได้')}}
const saveSchedule = async () => {try{const payload={...scheduleForm.value,duty_date:activeDate.value,status:'รอปฏิบัติหน้าที่'};if(payload.id)await api.put(`/duties/schedules/${payload.id}`,payload);else if(payload.team_id)await api.post('/duties/team-schedules',payload);else await api.post('/duties/schedules',payload);await fetchCalendar();resetScheduleForm()}catch(e){swalError('บันทึกไม่สำเร็จ',e.response?.data?.message||'เกิดข้อผิดพลาด')}}
const resetTeamForm = () => {teamForm.value={id:null,team_name:'',member_one_somtop_id:'',member_two_somtop_id:''};teamSearchOne.value='';teamSearchTwo.value=''}
const openTeamModal = () => {resetTeamForm();isTeamModalOpen.value=true}
const editTeam = team => {teamForm.value={id:team.id,team_name:team.team_name,member_one_somtop_id:String(team.member_one_somtop_id),member_two_somtop_id:String(team.member_two_somtop_id)}}
const saveTeam = async () => {try{if(teamForm.value.id)await api.put(`/duties/teams/${teamForm.value.id}`,teamForm.value);else await api.post('/duties/teams',teamForm.value);await fetchTeams();resetTeamForm();swalSuccess('บันทึกสำเร็จ','บันทึกคณะปฏิบัติหน้าที่แล้ว')}catch(e){swalError('บันทึกไม่สำเร็จ',e.response?.data?.message||'ไม่สามารถบันทึกคณะได้')}}
const deleteTeam = async team => {const ok=await swalConfirm('ยืนยันการลบคณะ',`ลบ ${team.team_name}? รายการเวรเดิมจะยังคงอยู่`);if(!ok.isConfirmed)return;try{await api.delete(`/duties/teams/${team.id}`);await fetchTeams()}catch(e){swalError('ลบไม่สำเร็จ',e.response?.data?.message||'ไม่สามารถลบคณะได้')}}
const deleteSchedule = async item => {const ok=await swalConfirm('ยืนยันการลบ',`ลบเวรของ ${item.full_name}?`);if(!ok.isConfirmed)return;await api.delete(`/duties/schedules/${item.id}`);await fetchCalendar()}
const openSwap = item => {swapSource.value=item;swapForm.value={replacement_somtop_id:'',reason:''};isSwapModalOpen.value=true}
const saveSwap = async () => {try{const {data}=await api.post('/duties/swaps',{schedule_id:swapSource.value.id,...swapForm.value});const file=await api.get(`/duties/swaps/${data.id}/export-word`,{responseType:'blob'});const url=URL.createObjectURL(file.data);const a=document.createElement('a');a.href=url;a.download=`ใบเปลี่ยนเวร_${data.id}.docx`;a.click();URL.revokeObjectURL(url);isSwapModalOpen.value=false;await fetchCalendar();swalSuccess('เปลี่ยนเวรสำเร็จ','ดาวน์โหลดใบเปลี่ยนเวรแล้ว')}catch(e){swalError('เปลี่ยนเวรไม่สำเร็จ',e.response?.data?.message||'เกิดข้อผิดพลาด')}}
const printSelectedOrder = async () => {try{const response=await api.get(`/duties/orders/${selectedOrderId.value}/export-word`,{responseType:'blob'});const order=orders.value.find(item=>String(item.id)===selectedOrderId.value);const url=URL.createObjectURL(response.data);const a=document.createElement('a');a.href=url;a.download=`คำสั่งเวร_${order?.order_number||selectedOrderId.value}.docx`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);swalSuccess('สร้างเอกสารสำเร็จ','ดาวน์โหลดคำสั่งเวรปฏิบัติหน้าที่แล้ว')}catch(e){swalError('พิมพ์ไม่สำเร็จ',e.response?.data?.message||'ไม่สามารถสร้างเอกสารคำสั่งได้')}}

watch(selectedMonth,()=>{selectedOrderId.value='';fetchCalendar()})
watch(selectedOrderId,fetchCalendar)
onMounted(()=>Promise.all([fetchCalendar(),fetchPeople(),fetchTeams()]))
</script>

<style scoped>
.month-input{min-width:145px}
.year-input{min-width:115px;height:40px;border:1px solid #d1d5db;border-radius:8px;padding:0 12px;background:#fff}
.header-actions{display:flex;gap:10px}
.toolbar{display:grid;grid-template-columns:minmax(220px,.9fr) minmax(200px,.8fr) minmax(280px,2fr) auto;align-items:end;gap:20px;padding:20px 24px;margin-bottom:24px}
.duty-filter-field{min-width:0}.toolbar .filter-group select{width:100%;height:44px}
.month-control{display:grid;align-items:center;gap:8px}.month-control-left{grid-template-columns:44px minmax(0,1fr)}.month-control-right{grid-template-columns:minmax(0,1fr) 44px}
.duty-filter-actions{display:flex;align-items:center;gap:10px}.print-order-button{height:44px;white-space:nowrap}.print-order-button:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
.month-nav{width:44px;height:44px;flex:0 0 44px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#374151;font-size:22px;cursor:pointer}
.month-nav:hover{background:#f3f4f6}
.order-select{flex:1;min-width:240px}
.order-strip{display:flex;gap:10px;overflow-x:auto;margin-bottom:14px;padding:2px 1px 8px}
.order-card{display:flex;align-items:center;justify-content:space-between;gap:14px;min-width:310px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:9px;background:#fff;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.order-card:hover{border-color:#cbd5e1}.order-card.active{border-color:#2563eb;background:#eff6ff}
.order-card>div:first-child{display:grid;gap:3px;min-width:0;flex:1}.order-card strong,.order-card span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.order-card span{font-size:12px;color:#6b7280}
.order-actions{display:flex;align-items:center;gap:4px;flex:0 0 auto}.order-actions button,.row-actions button{border:0;border-radius:6px;padding:6px 8px;background:#f1f5f9;cursor:pointer}.order-actions button:hover,.row-actions button:hover{background:#e2e8f0}
.order-actions .pdf-ready{color:#166534;background:#dcfce7;font-weight:700}.order-actions .danger{color:#b91c1c;background:#fee2e2}
.loading-state{display:flex;justify-content:center;align-items:center;gap:10px;padding:48px}
.compact-modal{max-width:620px}.day-modal{max-width:760px;max-height:90vh;overflow:auto}
.assigned-list{display:grid;gap:8px;margin-bottom:18px}.assigned-person{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px}.assigned-person>div:first-child{display:grid;gap:3px}.assigned-person span{color:#6b7280;font-size:12px}
.row-actions{display:flex;gap:5px}.row-actions .danger{color:#b91c1c;background:#fee2e2}.schedule-form{padding-top:16px;border-top:1px solid #e5e7eb}.schedule-form h3{margin:0 0 12px}.empty-day{text-align:center;padding:24px;color:#6b7280}.minimum-warning{margin-top:12px;padding:9px;border-radius:7px;background:#fff7ed;color:#9a3412;font-size:13px}
.duty-calendar-section{padding:20px;min-height:500px;display:flex;flex-direction:column}
.duty-calendar-header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:16px}
.duty-calendar-header h2{margin:0 0 4px;font-size:16px;font-weight:600;color:#111827}.duty-calendar-header span{font-size:12px;color:#6b7280}
.duty-legend{display:flex;gap:14px;flex-wrap:wrap}.duty-legend span{display:flex;align-items:center;gap:6px;white-space:nowrap}.legend-dot{display:inline-block;width:10px;height:10px;border-radius:50%}.legend-dot.understaffed{background:#f59e0b}.legend-dot.complete{background:#10b981}
.duty-calendar-wrapper{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;flex:1}
.duty-days-header{display:grid;grid-template-columns:repeat(7,1fr);background:#f9fafb;border-bottom:1px solid #e5e7eb}.duty-day-name{padding:10px;text-align:center;font-size:13px;font-weight:600;color:#4b5563}
.duty-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));flex:1;background:#e5e7eb;gap:1px}
.duty-calendar-cell{min-width:0;min-height:105px;padding:4px;border:0;background:#fff;display:flex;flex-direction:column;text-align:left;font-family:inherit;cursor:pointer;transition:background-color .2s}.duty-calendar-cell:hover{background:#f9fafb}.duty-calendar-cell.blank{background:#f3f4f6;cursor:default}
.duty-date-number{display:flex;align-items:center;justify-content:center;width:24px;height:24px;margin:2px 2px 4px auto;font-size:13px;font-weight:500;border-radius:50%}.duty-calendar-cell.today .duty-date-number{background:#10b981;color:#fff;font-weight:600}
.duty-events-container{display:flex;flex-direction:column;gap:4px;max-height:74px;overflow-y:auto;padding-right:2px}.duty-events-container::-webkit-scrollbar{width:4px}.duty-events-container::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:4px}
.duty-event-pill{display:block;width:100%;box-sizing:border-box;overflow:hidden;padding:3px 6px;border-left:3px solid #3b82f6;border-radius:4px;background:#dbeafe;color:#1e40af;font-size:10px;line-height:1.35;text-overflow:ellipsis;white-space:nowrap}.duty-calendar-cell.understaffed .duty-event-pill{border-left-color:#f59e0b;background:#fef3c7;color:#92400e}.duty-calendar-cell.complete .duty-event-pill,.duty-calendar-cell.full .duty-event-pill{border-left-color:#10b981;background:#d1fae5;color:#065f46}
.duty-total{margin:auto 3px 2px;text-align:right;color:#6b7280;font-size:10px}
@media(max-width:1000px){.toolbar{grid-template-columns:1fr 1fr}.order-field{grid-column:1/-1}.duty-filter-actions{grid-column:1/-1;justify-content:flex-end}}
@media(max-width:768px){.header-actions{width:100%;margin-top:12px;flex-direction:column}.header-actions button{width:100%}.toolbar{grid-template-columns:1fr;gap:14px;padding:16px}.order-field,.duty-filter-actions{grid-column:auto}.duty-filter-actions{justify-content:stretch}.duty-filter-actions .print-order-button{flex:1}.month-input,.year-input,.order-select{min-width:0}.order-strip{margin-inline:-2px}.order-card{min-width:280px}.duty-calendar-section{padding:12px;min-height:auto}.duty-calendar-header{align-items:flex-start;flex-direction:column}.duty-day-name{padding:8px 3px;font-size:11px}.duty-calendar-cell{min-height:72px;padding:2px}.duty-date-number{width:20px;height:20px;margin:1px 1px 2px auto;font-size:11px}.duty-events-container{max-height:48px}.duty-event-pill{padding:2px 3px;font-size:9px}.duty-total{display:none}}
</style>
