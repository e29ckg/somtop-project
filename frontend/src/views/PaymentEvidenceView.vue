<template>
  <div class="manage-layout payment-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">ตรวจสอบหลักฐานการรับเงิน</h1>
        <p class="page-subtitle">สำหรับเจ้าหน้าที่การเงิน</p>
      </div>
    </div>
    <section class="card filter-card">
      <div class="filter-controls">
        <div class="filter-group month-field"><label for="payment-month">เดือน</label><select id="payment-month" v-model="month"><option v-for="item in monthOptions" :key="item.value" :value="item.value">{{ item.label }}</option></select></div>
        <div class="filter-group order-field"><label for="payment-order">คำสั่งประจำเดือน</label><select id="payment-order" v-model="orderId"><option value="">เลือกคำสั่ง</option><option v-for="o in orders" :key="o.id" :value="String(o.id)">{{ o.order_number }} — {{ o.title }}</option></select></div>
        <div class="filter-actions"><button class="btn-primary" :disabled="!orderId" @click="openPreview">ตรวจสอบหลักฐาน</button></div>
      </div>
    </section>
    <div v-if="previewOpen" class="card preview-card">
      <div class="preview-head"><h2>ตรวจสอบก่อนพิมพ์</h2><div class="preview-actions"><button class="btn-secondary" @click="exportExcel">📊 ส่งออก Excel</button><button class="btn-primary" @click="print">🖨️ พิมพ์เอกสาร</button></div></div>
      <div class="edit-grid">
        <div class="input-group full-width"><label for="payment-title">หัวข้อเอกสาร</label><input id="payment-title" v-model="form.title" /></div>
        <div class="input-group"><label for="payment-date">วันเดือนปีที่รับเงิน</label><input id="payment-date" v-model="form.paymentDate" type="date" /></div>
        <div class="input-group"><label for="payment-finance">เจ้าหน้าที่การเงิน</label><input id="payment-finance" v-model="form.financeName" /></div>
        <div class="input-group"><label for="payment-director">ผู้อำนวยการ</label><input id="payment-director" v-model="form.directorName" /></div>
      </div>
      <div class="preview-html" v-html="html"></div>
    </div>
  </div>
</template>
<script setup>
import { ref, watch, onMounted } from 'vue'
import api from '../services/api'
import { swalError, swalSuccess } from '../utils/swal'
const now = new Date(); const thaiMonths=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']; const month = ref(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`); const monthOptions = Array.from({length:24},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-i,1);const value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;return {value,label:`${thaiMonths[d.getMonth()]} ${d.getFullYear()+543}`}}); const orders = ref([]); const orderId = ref(''); const schedules = ref([]); const court = ref({}); const previewOpen = ref(false); const html = ref('');
const form = ref({ title:'หลักฐานการรับเงินค่าตอบแทนการปฏิบัติหน้าที่เวร', paymentDate:'', financeName:'', directorName:'' })
const load = async () => { try { const r = await api.get('/duties/calendar', { params:{ month:month.value } }); orders.value=r.data.orders||[]; schedules.value=r.data.schedules||[]; if (!orderId.value && orders.value[0]) orderId.value=String(orders.value[0].id) } catch(e){ swalError('โหลดข้อมูลไม่สำเร็จ',e.response?.data?.message||'ไม่สามารถโหลดข้อมูลได้') } }
const escape = v => String(v ?? '').replace(/&/g,'&amp;').replace(new RegExp(String.fromCharCode(60),'g'),'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); const money = v => Number(v).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})
const build = () => { const t=String.fromCharCode(60); const tag=(n,c='',attrs='')=>t+n+attrs+'>'+c+t+'/'+n+'>'; const selected=schedules.value.filter(x=>!orderId.value||String(x.order_id)===orderId.value); const order=orders.value.find(x=>String(x.id)===orderId.value); if(!order||!selected.length){html.value='';return} const dates=[...new Set(selected.map(x=>String(x.duty_date).slice(0,10)))].sort(); const people=[...selected.reduce((m,x)=>{const k=x.somtop_id||x.full_name;if(!m.has(k))m.set(k,{name:x.full_name,dates:[]});m.get(k).dates.push(String(x.duty_date).slice(0,10));return m},new Map()).values()]; const rows=people.map((p,i)=>tag('tr',tag('td',i+1)+tag('td',escape(p.name))+tag('td',money(1250))+dates.map(d=>tag('td',p.dates.includes(d)?'✓':'')).join('')+tag('td',p.dates.length)+tag('td',money(p.dates.length*1250))+tag('td',escape(form.value.paymentDate))+tag('td','โอนเงินเข้าบัญชี'))).join(''); const total=people.reduce((s,p)=>s+p.dates.length*1250,0); const heads=['ลำดับ','ชื่อ - สกุล','อัตรา/วัน',...dates.map(d=>Number(d.slice(8))),'จำนวนวัน','จำนวนเงิน','วันเดือนปีที่รับเงิน','ลายมือชื่อผู้รับเงิน'].map(x=>tag('th',x)).join(''); html.value=tag('h3',escape(form.value.title))+tag('p',`${escape(order.title)} เลขที่คำสั่ง ${escape(order.order_number)}`)+tag('table',tag('tr',heads)+rows+tag('tr',tag('td','รวมเป็นเงินทั้งสิ้น',' colspan="'+(dates.length+4)+'"')+tag('td',money(total))+tag('td','',' colspan="2"'),' class="total-row"'))+tag('p',`รวมเป็นเงินทั้งสิ้น ${money(total)} บาท`) }
const openPreview=async()=>{if(!orderId.value)return;const c=await api.get('/duties/court-info');court.value=c.data.court||{};form.value.financeName=court.value.finance_officer_name||'';form.value.directorName=court.value.director_name||'';previewOpen.value=true;build()}; watch([month,orderId],async()=>{if(month.value)await load()}); watch(form,build,{deep:true});
const exportExcel=async()=>{try{const q=new URLSearchParams({title:form.value.title,payment_date:form.value.paymentDate,finance_name:form.value.financeName,director_name:form.value.directorName});const r=await api.get(`/duties/orders/${orderId.value}/export-payment-excel?${q}`,{responseType:'blob'});const u=URL.createObjectURL(r.data),a=document.createElement('a');a.href=u;a.download=`หลักฐานการรับเงิน_${orderId.value}.xlsx`;a.click();URL.revokeObjectURL(u);swalSuccess('ส่งออกสำเร็จ','ดาวน์โหลดไฟล์ Excel แล้ว')}catch(e){swalError('ส่งออกไม่สำเร็จ',e.response?.data?.message||'ไม่สามารถส่งออกได้')}}
const print=()=>{const w=window.open('','_blank');if(!w)return;const style=w.document.createElement('style');style.textContent="@page{size:A4 landscape;margin:10mm}body{font-family:'TH Sarabun New','Sarabun',Tahoma;font-size:14px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #222;padding:4px;text-align:center}.name{text-align:left}.sign{display:flex;justify-content:space-around;text-align:center;margin-top:30px}";w.document.head.appendChild(style);w.document.body.innerHTML=html.value;w.print();w.close()}; onMounted(load)
</script>
<style scoped>
.payment-page .filter-card {
  margin-bottom: 24px;
}
.payment-page .month-field {
  flex: 0 1 220px;
  min-width: 180px;
}
.payment-page .order-field {
  min-width: 280px;
}
.payment-page .filter-group select {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
}
.payment-page .filter-actions .btn-primary {
  min-height: 44px;
  white-space: nowrap;
}
.payment-page .btn-primary:disabled {
  opacity: .5;
  cursor: not-allowed;
  box-shadow: none;
}
.preview-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
}
.preview-head h2 {
  margin: 0;
  color: #111827;
  font-size: 18px;
  font-weight: 600;
}
.preview-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}
.preview-html {
  overflow-x: auto;
  padding: 24px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #111827;
  font-family: 'TH Sarabun New', 'Sarabun', Tahoma, sans-serif;
  font-size: 16px;
}
.preview-html :deep(h3) {
  margin: 0 0 8px;
  text-align: center;
  font-size: 20px;
}
.preview-html :deep(p) {
  margin: 8px 0 16px;
  text-align: center;
}
.preview-html :deep(table) {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
}
.preview-html :deep(th),
.preview-html :deep(td) {
  border: 1px solid #374151;
  padding: 6px 8px;
  text-align: center;
  vertical-align: middle;
}
.preview-html :deep(th) {
  background: #f9fafb;
  font-weight: 600;
}
.preview-html :deep(td:nth-child(2)) {
  text-align: left;
}
.preview-html :deep(.total-row td:first-child) {
  text-align: right;
  font-weight: 600;
}
.preview-html :deep(.total-row td:nth-child(2)) {
  text-align: center;
  font-weight: 600;
}
@media (max-width: 768px) {
  .payment-page .month-field,
  .payment-page .order-field {
    flex: 1 1 100%;
    min-width: 0;
  }
  .payment-page .filter-actions,
  .payment-page .filter-actions .btn-primary {
    width: 100%;
  }
  .edit-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .edit-grid .full-width {
    grid-column: auto;
  }
  .preview-actions,
  .preview-actions button {
    width: 100%;
  }
  .preview-html {
    padding: 12px;
  }
}
</style>
