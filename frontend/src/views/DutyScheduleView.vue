<template>
  <div class="manage-layout duty-page">
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">เวรปฏิบัติหน้าที่</h1>
        <p class="page-subtitle">จัดทำคำสั่งรายเดือนและกำหนดผู้ปฏิบัติหน้าที่วันละ 2–4 ท่าน</p>
      </div>
      <button v-if="isAdmin" class="btn-primary" @click="openOrderModal()">+ เพิ่มคำสั่งประจำเดือน</button>
    </div>

    <section class="card toolbar no-print">
      <button class="month-nav" @click="changeMonth(-1)">‹</button>
      <input v-model="selectedMonth" type="month" class="month-input" />
      <button class="month-nav" @click="changeMonth(1)">›</button>
      <select v-model="selectedOrderId" class="order-select">
        <option value="">ทุกคำสั่งในเดือน</option>
        <option v-for="order in orders" :key="order.id" :value="String(order.id)">{{ order.order_number }} — {{ order.title }}</option>
      </select>
      <button v-if="selectedOrderId" class="btn-secondary" @click="printSelectedOrder">🖨️ พิมพ์ตามคำสั่ง</button>
    </section>

    <section v-if="orders.length" class="order-strip no-print">
      <article v-for="order in orders" :key="order.id" class="order-card" :class="{ active: String(order.id) === selectedOrderId }" @click="selectedOrderId = String(order.id)">
        <div><strong>{{ order.order_number }}</strong><span>{{ order.title }}</span></div>
        <div v-if="isAdmin" class="order-actions">
          <button title="แก้ไขคำสั่ง" @click.stop="openOrderModal(order)">✏️</button>
          <button title="ลบคำสั่ง" @click.stop="deleteOrder(order)">🗑️</button>
        </div>
      </article>
    </section>

    <div v-if="isLoading" class="card loading-state"><div class="loading-spinner"></div>กำลังโหลดปฏิทิน...</div>
    <section v-else class="calendar card">
      <div class="calendar-title">
        <h2>{{ monthTitle }}</h2>
        <span>คลิกวันที่เพื่อดูรายละเอียด{{ isAdmin ? 'หรือจัดเวร' : '' }}</span>
      </div>
      <div class="weekday" v-for="day in weekDays" :key="day">{{ day }}</div>
      <div v-for="blank in leadingBlanks" :key="`blank-${blank}`" class="calendar-day blank"></div>
      <button v-for="day in daysInMonth" :key="day.date" class="calendar-day" :class="dayClass(day)" @click="openDay(day.date)">
        <span class="day-number">{{ day.day }}</span>
        <div class="duty-list">
          <span v-for="item in schedulesByDate[day.date] || []" :key="item.id" class="duty-person" :title="item.order_number">
            {{ item.full_name }}
          </span>
        </div>
        <small class="duty-count" v-if="(schedulesByDate[day.date] || []).length">
          {{ (schedulesByDate[day.date] || []).length }} ท่าน
        </small>
      </button>
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
            <div><strong>{{ item.full_name }}</strong><span>{{ item.duty_type_name }} · {{ item.order_number || 'ไม่ระบุคำสั่ง' }}</span></div>
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
            <div class="input-group full-width"><label>ผู้ปฏิบัติหน้าที่ *</label><select v-model="scheduleForm.somtop_id" required><option value="" disabled>เลือกรายชื่อ</option><option v-for="person in people" :key="person.id" :value="String(person.id)">{{ person.full_name }}</option></select></div>
            <div class="input-group full-width"><label>หมายเหตุ</label><input v-model="scheduleForm.note" /></div>
          </div>
          <div class="modal-actions"><button v-if="scheduleForm.id" type="button" class="btn-secondary" @click="resetScheduleForm">ยกเลิกแก้ไข</button><button class="btn-primary">{{ scheduleForm.id ? 'บันทึกการแก้ไข' : 'เพิ่มรายชื่อ' }}</button></div>
        </form>
        <div v-if="activeDaySchedules.length > 0 && activeDaySchedules.length < 2" class="minimum-warning">ควรเพิ่มผู้ปฏิบัติหน้าที่อย่างน้อย 2 ท่าน</div>
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
const selectedMonth = ref(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
const selectedOrderId = ref('')
const orders = ref([]), schedules = ref([]), dutyTypes = ref([]), people = ref([])
const isLoading = ref(false), isOrderModalOpen = ref(false), isDayModalOpen = ref(false), isSwapModalOpen = ref(false)
const activeDate = ref(''), swapSource = ref(null)
const orderForm = ref({ id:null, order_number:'', title:'', order_month:selectedMonth.value, note:'', status:'ใช้งาน' })
const scheduleForm = ref({ id:null, order_id:'', somtop_id:'', duty_type_id:'', note:'' })
const swapForm = ref({ replacement_somtop_id:'', reason:'' })
const weekDays = ['อา','จ','อ','พ','พฤ','ศ','ส']

const monthTitle = computed(() => new Date(`${selectedMonth.value}-01T00:00:00`).toLocaleDateString('th-TH',{month:'long',year:'numeric'}))
const daysInMonth = computed(() => { const [y,m]=selectedMonth.value.split('-').map(Number); const total=new Date(y,m,0).getDate(); return Array.from({length:total},(_,i)=>({day:i+1,date:`${selectedMonth.value}-${String(i+1).padStart(2,'0')}`})) })
const leadingBlanks = computed(() => Array.from({length:new Date(`${selectedMonth.value}-01T00:00:00`).getDay()},(_,i)=>i))
const schedulesByDate = computed(() => schedules.value.reduce((map,item)=>{(map[item.duty_date] ||= []).push(item);return map},{}))
const activeDaySchedules = computed(() => schedulesByDate.value[activeDate.value] || [])
const replacementPeople = computed(() => people.value.filter(p=>p.id!==swapSource.value?.somtop_id))

const fetchCalendar = async () => { isLoading.value=true; try { const {data}=await api.get('/duties/calendar',{params:{month:selectedMonth.value,order_id:selectedOrderId.value||undefined}});orders.value=data.orders||[];schedules.value=data.schedules||[];dutyTypes.value=data.duty_types||[];if(selectedOrderId.value&&!orders.value.some(o=>String(o.id)===selectedOrderId.value))selectedOrderId.value='' } catch(e){swalError('โหลดข้อมูลไม่สำเร็จ',e.response?.data?.message||'ไม่สามารถโหลดปฏิทินเวรได้')} finally{isLoading.value=false} }
const fetchPeople = async () => { const {data}=await api.get('/duties/people');people.value=data.records||[] }
const changeMonth = amount => { const [y,m]=selectedMonth.value.split('-').map(Number);const date=new Date(y,m-1+amount,1);selectedMonth.value=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}` }
const formatThaiDate = value => new Date(`${value}T00:00:00`).toLocaleDateString('th-TH',{dateStyle:'long'})
const dayClass = day => { const count=(schedulesByDate.value[day.date]||[]).length;return {understaffed:count>0&&count<2,complete:count>=2,full:count>=4,today:day.date===new Date().toISOString().slice(0,10)} }
const openDay = date => { activeDate.value=date;resetScheduleForm();if(selectedOrderId.value)scheduleForm.value.order_id=selectedOrderId.value;isDayModalOpen.value=true }
const closeDayModal = () => {isDayModalOpen.value=false;resetScheduleForm()}
const resetScheduleForm = () => {scheduleForm.value={id:null,order_id:selectedOrderId.value||'',somtop_id:'',duty_type_id:String(dutyTypes.value[0]?.id||''),note:''}}
const editSchedule = item => {scheduleForm.value={id:item.id,order_id:String(item.order_id||''),somtop_id:String(item.somtop_id),duty_type_id:String(item.duty_type_id),note:item.note||''}}
const openOrderModal = order => {orderForm.value=order?{id:order.id,order_number:order.order_number,title:order.title,order_month:String(order.order_month).slice(0,7),note:order.note||'',status:order.status}:{id:null,order_number:'',title:'คำสั่งเวรปฏิบัติหน้าที่',order_month:selectedMonth.value,note:'',status:'ใช้งาน'};isOrderModalOpen.value=true}
const saveOrder = async () => {try{if(orderForm.value.id)await api.put(`/duties/orders/${orderForm.value.id}`,orderForm.value);else await api.post('/duties/orders',orderForm.value);isOrderModalOpen.value=false;selectedMonth.value=orderForm.value.order_month;await fetchCalendar();swalSuccess('บันทึกสำเร็จ','บันทึกคำสั่งเรียบร้อยแล้ว')}catch(e){swalError('บันทึกไม่สำเร็จ',e.response?.data?.message||'เกิดข้อผิดพลาด')}}
const deleteOrder = async order => {const ok=await swalConfirm('ยืนยันการลบคำสั่ง',`รายการเวรทั้งหมดใน ${order.order_number} จะถูกลบด้วย`);if(!ok.isConfirmed)return;try{await api.delete(`/duties/orders/${order.id}`);selectedOrderId.value='';await fetchCalendar()}catch(e){swalError('ลบไม่สำเร็จ',e.response?.data?.message)}}
const saveSchedule = async () => {try{const payload={...scheduleForm.value,duty_date:activeDate.value,status:'รอปฏิบัติหน้าที่'};if(payload.id)await api.put(`/duties/schedules/${payload.id}`,payload);else await api.post('/duties/schedules',payload);await fetchCalendar();resetScheduleForm()}catch(e){swalError('บันทึกไม่สำเร็จ',e.response?.data?.message||'เกิดข้อผิดพลาด')}}
const deleteSchedule = async item => {const ok=await swalConfirm('ยืนยันการลบ',`ลบเวรของ ${item.full_name}?`);if(!ok.isConfirmed)return;await api.delete(`/duties/schedules/${item.id}`);await fetchCalendar()}
const openSwap = item => {swapSource.value=item;swapForm.value={replacement_somtop_id:'',reason:''};isSwapModalOpen.value=true}
const saveSwap = async () => {try{const {data}=await api.post('/duties/swaps',{schedule_id:swapSource.value.id,...swapForm.value});const file=await api.get(`/duties/swaps/${data.id}/export-word`,{responseType:'blob'});const url=URL.createObjectURL(file.data);const a=document.createElement('a');a.href=url;a.download=`ใบเปลี่ยนเวร_${data.id}.docx`;a.click();URL.revokeObjectURL(url);isSwapModalOpen.value=false;await fetchCalendar();swalSuccess('เปลี่ยนเวรสำเร็จ','ดาวน์โหลดใบเปลี่ยนเวรแล้ว')}catch(e){swalError('เปลี่ยนเวรไม่สำเร็จ',e.response?.data?.message||'เกิดข้อผิดพลาด')}}
const escapeHtml = value => String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))
const printSelectedOrder = async () => {try{const {data}=await api.get(`/duties/orders/${selectedOrderId.value}/print-data`);const grouped=data.records.reduce((m,r)=>{(m[r.duty_date]||=[]).push(r);return m},{});const rows=Object.entries(grouped).map(([date,list],i)=>`<tr><td>${i+1}</td><td>${escapeHtml(formatThaiDate(date))}</td><td>${list.map(x=>escapeHtml(x.full_name)).join('<br>')}</td><td>${[...new Set(list.map(x=>escapeHtml(x.duty_type_name)))].join(', ')}</td></tr>`).join('');const win=window.open('','_blank');win.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(data.order.order_number)}</title><style>body{font-family:"TH Sarabun New",sans-serif;font-size:18px;margin:32px;color:#000}h1,h2,p{text-align:center;margin:4px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #999;padding:8px;vertical-align:top}th{background:#e5e7eb}@media print{button{display:none}}</style></head><body><h1>บัญชีเวรปฏิบัติหน้าที่</h1><h2>${escapeHtml(data.order.order_number)}</h2><p>${escapeHtml(data.order.title)}</p><table><thead><tr><th>ลำดับ</th><th>วันที่</th><th>รายชื่อผู้ปฏิบัติหน้าที่</th><th>ประเภทเวร</th></tr></thead><tbody>${rows||'<tr><td colspan="4">ไม่มีรายการ</td></tr>'}</tbody></table><button onclick="window.print()">พิมพ์</button></body></html>`);win.document.close()}catch(e){swalError('พิมพ์ไม่สำเร็จ',e.response?.data?.message||'ไม่สามารถโหลดข้อมูลคำสั่งได้')}}

watch(selectedMonth,()=>{selectedOrderId.value='';fetchCalendar()})
watch(selectedOrderId,fetchCalendar)
onMounted(()=>Promise.all([fetchCalendar(),fetchPeople()]))
</script>

<style scoped>
.duty-page{color:#111827}.toolbar{display:flex;align-items:center;gap:10px;padding:14px 18px;margin-bottom:14px}.month-nav{width:40px;height:40px;border:1px solid #d1d5db;border-radius:8px;background:#fff;font-size:24px}.month-input,.order-select{height:40px;border:1px solid #d1d5db;border-radius:8px;padding:0 12px;background:#fff}.order-select{flex:1;min-width:240px}.order-strip{display:flex;gap:10px;overflow:auto;margin-bottom:14px}.order-card{display:flex;justify-content:space-between;gap:14px;min-width:260px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:9px;background:#fff;cursor:pointer}.order-card.active{border-color:#2563eb;background:#eff6ff}.order-card div:first-child{display:grid;gap:3px}.order-card span{font-size:12px;color:#6b7280}.order-actions{display:flex;gap:4px}.order-actions button,.row-actions button{border:0;border-radius:5px;padding:5px 7px;background:#f1f5f9;cursor:pointer}.calendar{display:grid;grid-template-columns:repeat(7,minmax(120px,1fr));overflow:auto;padding:0}.calendar-title{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid #e5e7eb}.calendar-title h2{margin:0}.calendar-title span{color:#6b7280;font-size:13px}.weekday{text-align:center;padding:9px;background:#f8fafc;font-weight:700}.calendar-day{position:relative;min-height:145px;padding:8px;border:0;border-right:1px solid #e5e7eb;border-top:1px solid #e5e7eb;background:#fff;text-align:left;vertical-align:top;cursor:pointer}.calendar-day:hover{background:#f8fafc}.calendar-day.blank{cursor:default;background:#f8fafc}.calendar-day.today{box-shadow:inset 0 0 0 2px #2563eb}.calendar-day.understaffed{background:#fff7ed}.calendar-day.complete{background:#f0fdf4}.calendar-day.full{background:#ecfdf5}.day-number{display:inline-flex;width:25px;height:25px;align-items:center;justify-content:center;font-weight:700}.duty-list{display:grid;gap:4px;margin-top:5px}.duty-person{overflow:hidden;padding:4px 6px;border-radius:5px;background:#dbeafe;color:#1e40af;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.duty-count{position:absolute;right:7px;bottom:6px;color:#64748b}.loading-state{display:flex;justify-content:center;gap:10px;padding:48px}.compact-modal{max-width:620px}.day-modal{max-width:760px;max-height:90vh;overflow:auto}.assigned-list{display:grid;gap:8px;margin-bottom:18px}.assigned-person{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px}.assigned-person div:first-child{display:grid;gap:3px}.assigned-person span{color:#6b7280;font-size:12px}.row-actions{display:flex;gap:5px}.row-actions .danger{color:#b91c1c;background:#fee2e2}.schedule-form{padding-top:16px;border-top:1px solid #e5e7eb}.schedule-form h3{margin:0 0 12px}.empty-day{text-align:center;padding:24px;color:#6b7280}.minimum-warning{margin-top:12px;padding:9px;border-radius:7px;background:#fff7ed;color:#9a3412;font-size:13px}@media(max-width:800px){.toolbar{align-items:stretch;flex-wrap:wrap}.order-select{flex-basis:100%}.calendar{grid-template-columns:repeat(7,minmax(105px,1fr))}.calendar-title{position:sticky;left:0}.calendar-day{min-height:120px}}@media print{.calendar{display:none}.order-strip{display:none}}
</style>
