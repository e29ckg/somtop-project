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
        <div class="input-group"><label for="payment-finance-position">ตำแหน่งเจ้าหน้าที่การเงิน</label><input id="payment-finance-position" v-model="form.financePosition" /></div>
        <div class="input-group"><label for="payment-director">ผู้อำนวยการ</label><input id="payment-director" v-model="form.directorName" /></div>
        <div class="input-group"><label for="payment-director-position">ตำแหน่งผู้อำนวยการ</label><input id="payment-director-position" v-model="form.directorPosition" /></div>
      </div>
      <div class="preview-html" v-html="html"></div>
    </div>
  </div>
</template>
<script setup>
import { ref, watch, onMounted } from 'vue'
import api from '../services/api'
import { swalError, swalSuccess } from '../utils/swal'
import { thaiBahtText } from '../utils/thaiBahtText'
const now = new Date(); const thaiMonths=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']; const month = ref(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`); const monthOptions = Array.from({length:24},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-i,1);const value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;return {value,label:`${thaiMonths[d.getMonth()]} ${d.getFullYear()+543}`}}); const orders = ref([]); const orderId = ref(''); const schedules = ref([]); const court = ref({}); const previewOpen = ref(false); const html = ref('');
const form = ref({ title:'หลักฐานการจ่ายเงินค่าป่วยการและค่าตอบแทนของผู้พิพากษาสมทบ', paymentDate:'', financeName:'', financePosition:'เจ้าหน้าที่การเงิน', directorName:'', directorPosition:'ผู้อำนวยการ' })
const load = async () => { try { const r = await api.get('/duties/calendar', { params:{ month:month.value } }); orders.value=r.data.orders||[]; schedules.value=r.data.schedules||[]; if (!orders.value.some(o=>String(o.id)===orderId.value)) orderId.value=orders.value[0] ? String(orders.value[0].id) : '' } catch(e){ swalError('โหลดข้อมูลไม่สำเร็จ',e.response?.data?.message||'ไม่สามารถโหลดข้อมูลได้') } }
const escape = v => String(v ?? '').replace(/&/g,'&amp;').replace(new RegExp(String.fromCharCode(60),'g'),'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); const money = v => Number(v).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})
const documentSubtitle = (courtInfo, orderMonth) => {
  const [year, monthNumber] = String(orderMonth).split('-').map(Number)
  const province = String(courtInfo.province || '').replace(/^จังหวัด/, '').trim()
  return `ชื่อส่วนราชการ ${courtInfo.court_name || ''}${province ? ` จังหวัด${province}` : ''} ประจำเดือน ${thaiMonths[monthNumber - 1]} ${year + 543}`
}
const signature = (role, name, position) => `<div class="payment-signature"><div>ลงชื่อ <span class="signature-line">................................</span> ${role}</div><div>(${escape(name)})</div><div>${escape(position)}</div></div>`
const buildFooter = (count, total) => `
  <div class="payment-certification">ขอรับรองว่าได้มีการมาปฏิบัติหน้าที่ตามระเบียบฯ และได้จ่ายค่าตอบแทนให้แก่ผู้มีสิทธิรับ จำนวน ${count} คน รวมเป็นเงินทั้งสิ้น ${money(total)} บาท (${thaiBahtText(total)}) จริง</div>
  <div class="payment-signatures">
    ${signature('ผู้รับรอง', form.value.directorName, form.value.directorPosition)}
    ${signature('ผู้จัดทำ', form.value.financeName, form.value.financePosition)}
    ${signature('ผู้จ่ายเงิน', form.value.financeName, form.value.financePosition)}
  </div>
  <div class="payment-note"><strong>หมายเหตุ :</strong> กรณีจ่ายเป็นการโอนผ่านระบบอินเทอร์เน็ต ผู้รับเงินไม่ต้องลงลายมือชื่อผู้รับเงินในช่องผู้รับเงิน</div>`
const shortThaiMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const formatThaiTransferDate = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) return ''
  return `${Number(match[3])} ${shortThaiMonths[Number(match[2]) - 1]} ${String(Number(match[1]) + 543).slice(-2)}`
}
const isWeekend = date => [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())
const build = () => {
  const tag = (name, content = '', attrs = '') => `<${name}${attrs}>${content}</${name}>`
  const order = orders.value.find(item => String(item.id) === orderId.value)
  const selected = schedules.value.filter(item => String(item.order_id) === orderId.value)
  if (!order || !selected.length) { html.value = ''; return }

  const [year, monthNumber] = month.value.split('-').map(Number)
  const dates = Array.from({ length: new Date(year, monthNumber, 0).getDate() }, (_, index) => `${month.value}-${String(index + 1).padStart(2, '0')}`)
  const people = [...selected.reduce((map, item) => {
    const key = item.somtop_id || item.full_name
    if (!map.has(key)) map.set(key, { name: item.full_name, dates: new Set() })
    map.get(key).dates.add(String(item.duty_date).slice(0, 10))
    return map
  }, new Map()).values()]
  const rate = 1250
  const total = people.reduce((sum, person) => sum + person.dates.size * rate, 0)
  const transferDate = escape(formatThaiTransferDate(form.value.paymentDate))
  const dayClass = date => ` class="day-column${isWeekend(date) ? ' weekend' : ''}"`
  const dayHeaders = dates.map((date, index) => tag('th', index + 1, dayClass(date))).join('')
  const mainHeaders = [
    tag('th', 'ลำดับ', ' rowspan="2"'),
    tag('th', 'ชื่อ - สกุล', ' rowspan="2"'),
    tag('th', 'อัตราเงินค่าตอบแทน<br>(ต่อคนต่อวัน)', ' rowspan="2"'),
    tag('th', 'วันที่ปฏิบัติงาน', ` colspan="${dates.length}"`),
    tag('th', 'รวมวัน<br>ปฏิบัติงาน', ' rowspan="2"'),
    tag('th', 'จำนวนเงิน', ' rowspan="2"'),
    tag('th', 'วันเดือนปี<br>ที่รับเงิน', ' rowspan="2"'),
    tag('th', 'ลายมือชื่อ<br>ผู้รับเงิน', ' rowspan="2"'),
    tag('th', 'หมายเหตุ', ' rowspan="2"')
  ].join('')
  const rows = people.map((person, index) => tag('tr',
    tag('td', index + 1) +
    tag('td', escape(person.name), ' class="person-name"') +
    tag('td', money(rate)) +
    dates.map(date => tag('td', person.dates.has(date) ? '✓' : '', dayClass(date))).join('') +
    tag('td', person.dates.size) +
    tag('td', money(person.dates.size * rate)) +
    tag('td', transferDate) +
    tag('td', 'โอนเงินเข้าบัญชี') +
    tag('td')
  )).join('')
  const totalRow = tag('tr',
    tag('td', `รวมเป็นเงินทั้งสิ้น (${thaiBahtText(total)})`, ` colspan="${dates.length + 4}"`) +
    tag('td', money(total)) + tag('td', '', ' colspan="3"'),
    ' class="total-row"'
  )
  html.value = tag('div',
    tag('h3', escape(form.value.title)) + tag('p', escape(documentSubtitle(court.value, month.value))),
    ' class="document-heading"'
  ) + tag('table', tag('thead', tag('tr', mainHeaders) + tag('tr', dayHeaders)) + tag('tbody', rows + totalRow), ' class="payment-table"') + buildFooter(people.length, total)
}
const openPreview=async()=>{if(!orderId.value)return;const c=await api.get('/duties/court-info');court.value=c.data.court||{};form.value.financeName=court.value.finance_officer_name||'';form.value.financePosition=court.value.finance_officer_position||'เจ้าหน้าที่การเงิน';form.value.directorName=court.value.director_name||'';form.value.directorPosition=court.value.director_position||'ผู้อำนวยการ';previewOpen.value=true;build()}; watch([month,orderId],async()=>{if(month.value)await load();if(previewOpen.value)build()}); watch(form,build,{deep:true});
const exportExcel=async()=>{try{const q=new URLSearchParams({title:form.value.title,payment_date:form.value.paymentDate,finance_name:form.value.financeName,finance_position:form.value.financePosition,director_name:form.value.directorName,director_position:form.value.directorPosition});const r=await api.get(`/duties/orders/${orderId.value}/export-payment-excel?${q}`,{responseType:'blob'});const u=URL.createObjectURL(r.data),a=document.createElement('a');a.href=u;a.download=`หลักฐานการรับเงิน_${orderId.value}.xlsx`;a.click();URL.revokeObjectURL(u);swalSuccess('ส่งออกสำเร็จ','ดาวน์โหลดไฟล์ Excel แล้ว')}catch(e){swalError('ส่งออกไม่สำเร็จ',e.response?.data?.message||'ไม่สามารถส่งออกได้')}}
const print = () => {
  const w = window.open('', '_blank')
  if (!w) return
  const style = w.document.createElement('style')
  style.textContent = `
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: 'TH Sarabun New', 'Sarabun', Tahoma, sans-serif; font-size: 14px; color: #111; }
    .document-heading { text-align: center; padding-bottom: 6px; border-bottom: 1px solid #222; }
    .document-heading h3 { margin: 0; font-size: 18px; }
    .document-heading p { margin: 0; font-size: 16px; font-weight: bold; }
    .payment-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9px; }
    .payment-table th, .payment-table td { border: 1px solid #222; padding: 2px 1px; text-align: center; vertical-align: middle; overflow-wrap: anywhere; }
    .payment-table .day-column { width: 2%; padding: 2px 0; }
    .payment-table .weekend { background: #999; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .payment-table .person-name { width: 13%; text-align: left; }
    .payment-table thead tr:first-child th:first-child { width: 3%; }
    .payment-table thead tr:first-child th:nth-child(3) { width: 7%; }
    .total-row td:first-child { text-align: right; font-weight: bold; }
    .total-row td:nth-child(2) { font-weight: bold; }
    .payment-certification { margin-top: 10px; line-height: 1.4; }
    .payment-signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 68px 0 20px; text-align: center; break-inside: avoid; }
    .payment-signature { line-height: 1.35; }
    .signature-line { white-space: nowrap; }
    .payment-note { margin-top: 12px; line-height: 1.4; break-inside: avoid; }
  `
  w.document.head.appendChild(style)
  w.document.body.innerHTML = html.value
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 250)
}
onMounted(load)
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
.preview-html :deep(.document-heading) {
  padding-bottom: 8px;
  border-bottom: 1px solid #374151;
  text-align: center;
}
.preview-html :deep(.document-heading h3),
.preview-html :deep(.document-heading p) {
  margin: 0;
  font-weight: 700;
}
.preview-html :deep(.document-heading p) {
  font-size: 18px;
}
.preview-html :deep(table) {
  width: 100%;
  min-width: 1250px;
  border-collapse: collapse;
  font-size: 11px;
}
.preview-html :deep(th),
.preview-html :deep(td) {
  border: 1px solid #374151;
  padding: 3px 2px;
  text-align: center;
  vertical-align: middle;
}
.preview-html :deep(th) {
  background: #f9fafb;
  font-weight: 600;
}
.preview-html :deep(.day-column) {
  min-width: 16px;
  padding: 3px 0;
}
.preview-html :deep(.weekend) {
  background: #9ca3af;
}
.preview-html :deep(.person-name) {
  min-width: 165px;
  text-align: left;
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
.preview-html :deep(.payment-certification) {
  margin-top: 12px;
  line-height: 1.5;
}
.preview-html :deep(.payment-signatures) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin: 72px 0 24px;
  text-align: center;
}
.preview-html :deep(.payment-signature) {
  line-height: 1.5;
}
.preview-html :deep(.signature-line) {
  white-space: nowrap;
}
.preview-html :deep(.payment-note) {
  margin-top: 12px;
  line-height: 1.5;
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
  .preview-html :deep(.payment-signatures) {
    min-width: 760px;
  }
}
</style>
