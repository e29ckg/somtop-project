<template>
  <div class="manage-layout approval-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">หน้างบประกอบการอนุมัติ</h1>
        <p class="page-subtitle">ประกอบการอนุมัติโอนเงินเข้าบัญชีผ่านระบบ K-Cash Connect Plus</p>
      </div>
    </div>

    <section class="card filter-card">
      <div class="filter-controls">
        <div class="filter-group month-field">
          <label for="approval-month">เดือน</label>
          <select id="approval-month" v-model="month" :disabled="busy">
            <option v-for="item in monthOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </div>
        <div class="filter-group order-field">
          <label for="approval-order">คำสั่งประจำเดือน</label>
          <select id="approval-order" v-model="orderId" :disabled="busy">
            <option value="">ทุกคำสั่งในเดือน</option>
            <option v-for="order in orders" :key="order.id" :value="String(order.id)">{{ order.order_number }} — {{ order.title }}</option>
          </select>
        </div>
        <div class="filter-actions">
          <button class="btn-primary" :disabled="loading || preparing || !hasSchedules" @click="openPreview">
            {{ preparing ? 'กำลังจัดทำ...' : 'จัดทำหน้างบประกอบการอนุมัติ' }}
          </button>
        </div>
      </div>
      <p v-if="loading" class="state-message" role="status">กำลังโหลดข้อมูลเวร...</p>
      <p v-else-if="loadError" class="state-message error-message" role="alert">{{ loadError }}</p>
      <p v-else-if="!hasSchedules" class="state-message">ไม่มีรายชื่อผู้ปฏิบัติหน้าที่ตามเดือนและคำสั่งที่เลือก</p>
    </section>

    <section v-if="previewOpen" class="card preview-card">
      <div class="preview-head">
        <h2>ตรวจสอบก่อนพิมพ์</h2>
        <div class="preview-actions">
          <button class="btn-secondary" :disabled="busy || !report?.rows.length" @click="exportExcel">📊 ส่งออก Excel</button>
          <button class="btn-primary" :disabled="busy || !report?.rows.length" @click="printReport">🖨️ พิมพ์เอกสาร</button>
        </div>
      </div>

      <form @submit.prevent="refreshPreview">
        <fieldset class="edit-grid" :disabled="busy" aria-label="ข้อมูลหน้างบประกอบการอนุมัติ">
        <div class="input-group full-width"><label for="approval-title">หัวข้อเอกสาร</label><input id="approval-title" v-model="form.title" maxlength="255" required /></div>
        <div class="input-group"><label for="approval-budget">ประเภทงบ</label><input id="approval-budget" v-model="form.budgetName" maxlength="100" /></div>
        <div class="input-group"><label for="approval-date">วันที่บันทึก</label><input id="approval-date" v-model="form.memoDate" type="date" required /></div>
        <div class="input-group"><label for="approval-savings">บัญชีออมทรัพย์ของศาล</label><input id="approval-savings" v-model="form.savingsAccount" maxlength="50" placeholder="ระบุเลขบัญชี" /></div>
        <div class="input-group"><label for="approval-current">บัญชีกระแสรายวันของศาล</label><input id="approval-current" v-model="form.currentAccount" maxlength="50" placeholder="ระบุเลขบัญชี" /></div>
        <div class="input-group full-width"><label for="approval-item">รายการ</label><input id="approval-item" v-model="form.item" maxlength="255" required /></div>
        <div class="input-group"><label for="approval-rate">อัตราค่าตอบแทนต่อวัน (บาท)</label><input id="approval-rate" v-model="form.rate" type="number" min="0.01" max="1000000" step="0.01" required /></div>
        <div class="input-group tax-field"><label class="checkbox-label"><input v-model="form.withholdingTax" type="checkbox" /> หักภาษี ณ ที่จ่าย 1%</label></div>
        <div class="edit-actions full-width">
          <p>คำนวณจากจำนวนวันเวรที่ไม่ซ้ำต่อคน × อัตราต่อวัน ตามตัวกรองที่เลือก</p>
          <button class="btn-secondary" type="submit" :disabled="busy">{{ refreshing ? 'กำลังปรับปรุง...' : 'ปรับปรุงตัวอย่าง' }}</button>
        </div>
        </fieldset>
      </form>
      <p v-if="dirty && report" class="notice" role="status">มีการแก้ไขข้อมูล กด “ปรับปรุงตัวอย่าง” เพื่อดูผลล่าสุด ระบบจะใช้ข้อมูลล่าสุดเมื่อพิมพ์หรือส่งออก</p>
      <p v-if="report?.missing_bank_accounts" class="notice">ยังไม่มีเลขบัญชีผู้รับ {{ report.missing_bank_accounts }} คน กรุณาตรวจข้อมูลผู้พิพากษาสมทบก่อนโอนเงิน</p>
      <p v-if="report && !report.rows.length" class="state-message">ไม่มีข้อมูลสำหรับจัดทำรายงาน</p>

      <div v-if="report?.rows.length" class="preview-html">
        <div ref="reportElement" class="approval-document">
          <div class="approval-heading">
            <div>{{ report.title }}</div>
            <div>{{ report.account_line }}</div>
            <div>{{ report.memo_line }}</div>
          </div>
          <table class="approval-table">
            <colgroup><col v-for="width in columnWidths" :key="width.id" :style="{ width: width.value + '%' }" /></colgroup>
            <thead><tr>
              <th>ที่</th><th>เลข<br />อ้างอิง</th><th>ชื่อผู้รับ</th><th>เลขบัญชีผู้รับ<br />โอน</th><th>รายการ</th>
              <th>จำนวนเงินที่<br />ขอเบิก</th><th>ภาษี<br />1%</th><th>จำนวนเงินที่<br />จ่ายเช็ค</th><th>เบอร์โทรศัพท์</th><th>หมายเหตุ</th>
            </tr></thead>
            <tbody>
              <tr v-for="row in report.rows" :key="row.somtop_id">
                <td>{{ row.number }}</td><td>{{ row.reference }}</td><td class="text-left">{{ row.name }}</td>
                <td class="bank-account">{{ row.bank_account_number }}</td><td class="text-left">{{ row.item }}</td>
                <td class="amount">{{ money(row.gross) }}</td><td class="amount">{{ row.tax ? money(row.tax) : '' }}</td>
                <td class="amount">{{ money(row.net) }}</td><td class="phone">{{ row.phone }}</td><td class="text-left">{{ row.note }}</td>
              </tr>
            </tbody>
            <tfoot><tr>
              <td colspan="5" class="total-label">รวมเงินจ่ายทั้งสิ้น(ตัวอักษร) {{ report.total_text }}</td>
              <td class="amount total-amount">{{ money(report.totals.gross) }}</td>
              <td class="amount">{{ report.totals.tax ? money(report.totals.tax) : '' }}</td>
              <td class="amount total-amount">{{ money(report.totals.net) }}</td><td colspan="2"></td>
            </tr></tfoot>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import api from '../services/api'
import { swalError, swalSuccess } from '../utils/swal'

const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const month = ref(today.slice(0, 7))
const [year, monthNumber] = month.value.split('-').map(Number)
const monthOptions = Array.from({ length: 24 }, (_, index) => {
  const date = new Date(year, monthNumber - 1 - index, 1)
  return { value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, label: `${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}` }
})
const columnWidths = [3,5,15,10,21,9,4,9,9,15].map((value, id) => ({ id, value }))
const orderId = ref('')
const orders = ref([])
const schedules = ref([])
const loading = ref(false)
const preparing = ref(false)
const refreshing = ref(false)
const exporting = ref(false)
const loadError = ref('')
const previewOpen = ref(false)
const report = ref(null)
const reportElement = ref(null)
const previewQuery = ref('')
const form = ref({ title: 'หน้างบประกอบการอนุมัติโอนเงินเข้าบัญชีในระบบ K-Cash Connect Plus',
  budgetName: 'งบดำเนินการ', memoDate: today, savingsAccount: '', currentAccount: '',
  item: 'เงินค่าป่วยการและค่าตอบแทนผู้พิพากษาสมทบ (นั่งเวร)', rate: '1250', withholdingTax: false })
const busy = computed(() => loading.value || preparing.value || refreshing.value || exporting.value)
const hasSchedules = computed(() => schedules.value.some(row => !orderId.value || String(row.order_id) === orderId.value))
const params = () => ({ month: month.value, order_id: orderId.value, title: form.value.title,
  budget_name: form.value.budgetName, memo_date: form.value.memoDate,
  savings_account: form.value.savingsAccount, current_account: form.value.currentAccount,
  item: form.value.item, rate: String(form.value.rate), withholding_tax: form.value.withholdingTax ? '1' : '0' })
const dirty = computed(() => JSON.stringify(params()) !== previewQuery.value)
const money = value => Number(value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

let calendarRequest = 0
const loadCalendar = async () => {
  const request = ++calendarRequest
  loading.value = true
  loadError.value = ''
  previewOpen.value = false
  report.value = null
  schedules.value = []
  try {
    const response = await api.get('/duties/calendar', { params: { month: month.value } })
    if (request !== calendarRequest) return
    orders.value = response.data.orders || []
    schedules.value = response.data.schedules || []
    if (!orders.value.some(order => String(order.id) === orderId.value)) orderId.value = ''
  } catch (error) {
    if (request === calendarRequest) loadError.value = error.response?.data?.message || 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่'
  } finally { if (request === calendarRequest) loading.value = false }
}
const fetchReport = async () => {
  const query = params()
  const response = await api.get('/duties/approval-report', { params: query })
  report.value = response.data.report
  previewQuery.value = JSON.stringify(query)
  await nextTick()
}
const openPreview = async () => {
  if (busy.value || !hasSchedules.value) return
  preparing.value = true
  try { await fetchReport(); previewOpen.value = true }
  catch (error) { swalError('จัดทำรายงานไม่สำเร็จ', error.response?.data?.message || 'ไม่สามารถโหลดข้อมูลรายงานได้') }
  finally { preparing.value = false }
}
const refreshPreview = async () => {
  if (busy.value) return
  refreshing.value = true
  try { await fetchReport() }
  catch (error) { swalError('ปรับปรุงรายงานไม่สำเร็จ', error.response?.data?.message || 'กรุณาตรวจข้อมูลอีกครั้ง') }
  finally { refreshing.value = false }
}
const exportExcel = async () => {
  if (busy.value) return
  exporting.value = true
  try {
    const response = await api.get('/duties/approval-report/excel', { params: params(), responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `หน้างบประกอบการอนุมัติ_${month.value}.xlsx`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    swalSuccess('ส่งออกสำเร็จ', 'ดาวน์โหลดไฟล์ Excel แล้ว')
  } catch (error) {
    let message = error.response?.data?.message
    if (error.response?.data instanceof Blob) {
      try { message = JSON.parse(await error.response.data.text()).message } catch {}
    }
    swalError('ส่งออกไม่สำเร็จ', message || 'ไม่สามารถส่งออกได้')
  } finally { exporting.value = false }
}
const printReport = async () => {
  if (busy.value) return
  const popup = window.open('', '_blank')
  if (!popup) { swalError('เปิดหน้าพิมพ์ไม่ได้', 'กรุณาอนุญาตหน้าต่างป๊อปอัปสำหรับเว็บไซต์นี้'); return }
  refreshing.value = true
  try {
    await fetchReport()
    if (!report.value?.rows.length) { popup.close(); return }
    popup.document.title = `หน้างบประกอบการอนุมัติ ${month.value}`
    const style = popup.document.createElement('style')
    style.textContent = `@page { size: A4 landscape; margin: 8mm 6mm; }
      body { margin: 0; color: #112e51; font: 14px 'TH Sarabun New', 'Sarabun', Tahoma, sans-serif; }
      .approval-heading { text-align: center; line-height: 1.5; padding: 4px 0 10px; font-size: 16px; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { border: 1px solid #d6dce4; padding: 6px 5px; vertical-align: middle; overflow-wrap: anywhere; }
      th { font-weight: normal; text-align: center; border-bottom: 2px solid #222; }
      td { text-align: center; } .text-left { text-align: left; } .amount { text-align: right; white-space: nowrap; }
      .total-label { text-align: right; } .total-amount { border-bottom: 3px double #31558a; }
      tr { break-inside: avoid; } thead { display: table-header-group; } tfoot { display: table-row-group; }`
    popup.document.head.appendChild(style)
    popup.document.body.appendChild(reportElement.value.cloneNode(true))
    await popup.document.fonts.ready
    popup.onafterprint = () => popup.close()
    popup.focus()
    popup.print()
  } catch (error) { popup.close(); swalError('พิมพ์ไม่สำเร็จ', error.response?.data?.message || 'ไม่สามารถจัดทำเอกสารได้') }
  finally { refreshing.value = false }
}
watch(month, loadCalendar)
watch(orderId, () => { previewOpen.value = false; report.value = null })
onMounted(loadCalendar)
</script>

<style scoped>
.filter-card { margin-bottom: 24px; }
.month-field { flex: 0 1 220px; min-width: 180px; }
.order-field { min-width: 280px; }
.filter-group select { box-sizing: border-box; width: 100%; min-height: 44px; }
.filter-actions button { min-height: 44px; white-space: nowrap; }
button:disabled { opacity: .5; cursor: not-allowed; }
.preview-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
.preview-head h2 { margin: 0; font-size: 18px; font-weight: 600; }
.preview-actions { display: flex; flex-wrap: wrap; gap: 12px; }
.edit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin: 0 0 24px; padding: 0; border: 0; min-width: 0; }
.tax-field { justify-content: center; }
.checkbox-label { display: flex; align-items: center; gap: 10px; }
.checkbox-label input { width: 18px; height: 18px; }
.edit-actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.edit-actions p, .state-message { color: #6b7280; font-size: 14px; margin: 12px 0 0; }
.error-message { color: #991b1b; }
.notice { padding: 12px 16px; border-radius: 8px; background: #fffbeb; color: #92400e; font-size: 14px; }
.preview-html { overflow-x: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; background: white; }
.approval-document { min-width: 1100px; color: #112e51; font-family: 'TH Sarabun New', 'Sarabun', Tahoma, sans-serif; font-size: 16px; }
.approval-heading { text-align: center; line-height: 1.5; padding: 4px 0 10px; }
.approval-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.approval-table th, .approval-table td { border: 1px solid #d6dce4; padding: 8px 6px; vertical-align: middle; overflow-wrap: anywhere; }
.approval-table th { text-align: center; border-bottom: 2px solid #222; font-weight: normal; background: white; }
.approval-table td { text-align: center; }
.approval-table .text-left { text-align: left; }
.approval-table .amount { text-align: right; white-space: nowrap; }
.approval-table .total-label { text-align: right; }
.approval-table .total-amount { border-bottom: 3px double #31558a; }
@media (max-width: 768px) {
  .month-field, .order-field { flex: 1 1 100%; min-width: 0; }
  .filter-actions, .filter-actions button, .preview-actions, .preview-actions button { width: 100%; }
  .edit-grid { grid-template-columns: 1fr; gap: 16px; }
  .edit-grid .full-width { grid-column: auto; }
  .preview-html { padding: 12px; }
}
</style>
