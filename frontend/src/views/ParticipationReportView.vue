<template>
  <div class="manage-layout participation-report">
    <div class="page-header no-print">
      <div>
        <h1 class="page-title">รายงานผลการเข้าร่วมกิจกรรม</h1>
        <p class="page-subtitle">สรุปการเข้าร่วม แยกตามประเภทกิจกรรมและรอบปี</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary" :disabled="isExporting" @click="exportExcel">{{ isExporting ? 'กำลังสร้าง Excel...' : '📊 ส่งออก Excel' }}</button>
        <button class="btn-secondary" @click="printReport">🖨️ พิมพ์รายงาน</button>
      </div>
    </div>

    <section class="card filter-card no-print">
      <div class="filter-controls report-filter-controls">
        <div class="filter-group annual-filter-group">
          <label for="report-year">รอบปีที่จัดกิจกรรม</label>
          <select id="report-year" v-model="selectedYear">
            <option value="">ทุกรอบปี</option>
            <option v-for="year in filterOptions.years" :key="year" :value="String(year)">
              ปี {{ Number(year) + 543 }} (1 เม.ย. {{ Number(year) + 543 }} - 31 มี.ค. {{ Number(year) + 544 }})
            </option>
          </select>
        </div>
        <div class="filter-group">
          <label for="report-type">ประเภทกิจกรรม</label>
          <select id="report-type" v-model="selectedEventType">
            <option value="">ทุกประเภท</option>
            <option v-for="type in filterOptions.eventTypes" :key="type.id" :value="String(type.id)">
              {{ type.name }}
            </option>
          </select>
        </div>
        <div class="filter-group person-filter">
          <label for="report-person">รายบุคคล</label>
          <select id="report-person" v-model="selectedPerson">
            <option value="">ทุกคน</option>
            <option v-for="person in filterOptions.people" :key="person.id" :value="String(person.id)">
              {{ person.full_name }}
            </option>
          </select>
        </div>
        <div class="filter-actions">
          <button class="btn-secondary clear-button" :disabled="!selectedYear && !selectedEventType && !selectedPerson" @click="clearFilters">ล้างตัวกรอง</button>
        </div>
      </div>
    </section>

    <div v-if="isLoading" class="card loading-state">
      <div class="loading-spinner"></div>
      <span>กำลังจัดทำรายงาน...</span>
    </div>

    <template v-else>
      <section class="summary-grid">
        <article class="summary-card blue">
          <span class="summary-label">กิจกรรมทั้งหมด</span>
          <strong>{{ formatNumber(summary.event_count) }}</strong>
          <small>กิจกรรม</small>
        </article>
        <article class="summary-card slate">
          <span class="summary-label">รายชื่อที่บันทึก</span>
          <strong>{{ formatNumber(summary.participant_count) }}</strong>
          <small>รายการ</small>
        </article>
        <article class="summary-card green">
          <span class="summary-label">เข้าร่วม</span>
          <strong>{{ formatNumber(summary.attended_count) }}</strong>
          <small>{{ summary.attendance_rate }}%</small>
        </article>
        <article class="summary-card amber">
          <span class="summary-label">ลาประชุม</span>
          <strong>{{ formatNumber(summary.leave_count) }}</strong>
          <small>รายการ</small>
        </article>
        <article class="summary-card red">
          <span class="summary-label">ไม่เข้าร่วม</span>
          <strong>{{ formatNumber(summary.absent_count) }}</strong>
          <small>รายการ</small>
        </article>
      </section>

      <section class="card report-card">
        <div class="report-heading">
          <div>
            <h2>สรุปแยกตามประเภทกิจกรรม</h2>
            <p>{{ activeFilterLabel }}</p>
          </div>
          <div class="print-date">จัดทำเมื่อ {{ generatedAt }}</div>
        </div>

        <div class="table-responsive">
          <table class="data-table report-table">
            <thead>
              <tr>
                <th>ประเภทกิจกรรม</th>
                <th class="number-cell">กิจกรรม</th>
                <th class="number-cell">รายชื่อ</th>
                <th class="number-cell">เข้าร่วม</th>
                <th class="number-cell">ลาประชุม</th>
                <th class="number-cell">ไม่เข้าร่วม</th>
                <th class="number-cell">รอตอบรับ</th>
                <th>อัตราเข้าร่วม</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in records" :key="row.event_type_id">
                <td class="type-name">{{ row.event_type_name }}</td>
                <td class="number-cell">{{ formatNumber(row.event_count) }}</td>
                <td class="number-cell">{{ formatNumber(row.participant_count) }}</td>
                <td class="number-cell positive">{{ formatNumber(row.attended_count) }}</td>
                <td class="number-cell">{{ formatNumber(row.leave_count) }}</td>
                <td class="number-cell negative">{{ formatNumber(row.absent_count) }}</td>
                <td class="number-cell muted">{{ formatNumber(row.pending_count) }}</td>
                <td class="rate-cell">
                  <div class="rate-line">
                    <div class="rate-track"><span :style="{ width: `${row.attendance_rate}%` }"></span></div>
                    <strong>{{ row.attendance_rate }}%</strong>
                  </div>
                </td>
              </tr>
              <tr v-if="records.length === 0">
                <td colspan="8" class="empty-state">ไม่พบข้อมูลกิจกรรมตามเงื่อนไขที่เลือก</td>
              </tr>
            </tbody>
            <tfoot v-if="records.length > 0">
              <tr>
                <th>รวม</th>
                <th class="number-cell">{{ formatNumber(summary.event_count) }}</th>
                <th class="number-cell">{{ formatNumber(summary.participant_count) }}</th>
                <th class="number-cell">{{ formatNumber(summary.attended_count) }}</th>
                <th class="number-cell">{{ formatNumber(summary.leave_count) }}</th>
                <th class="number-cell">{{ formatNumber(summary.absent_count) }}</th>
                <th class="number-cell">{{ formatNumber(summary.pending_count) }}</th>
                <th>{{ summary.attendance_rate }}%</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section class="card report-card matrix-card">
        <div class="report-heading">
          <div>
            <h2>รายละเอียดการเข้าร่วมรายบุคคล</h2>
            <p>หัวตารางเป็นรายการกิจกรรม และแต่ละแถวเป็นรายชื่อผู้พิพากษาสมทบ</p>
          </div>
          <div class="legend no-print">
            <span class="status-pill attended">เข้าร่วม</span>
            <span class="status-pill leave">ลาประชุม</span>
            <span class="status-pill absent">ไม่เข้าร่วม</span>
            <span class="status-pill pending">รอตอบรับ</span>
          </div>
        </div>

        <div class="matrix-scroll">
          <table class="data-table matrix-table">
            <thead>
              <tr>
                <th class="sticky-person">รายชื่อ</th>
                <th v-for="event in matrix.events" :key="event.id" class="event-heading">
                  <span class="event-title">{{ event.title }}</span>
                  <small>{{ formatThaiDate(event.event_date) }}</small>
                  <small>{{ event.event_type_name }}</small>
                </th>
                <th class="total-heading">รวมเข้าร่วม</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="person in matrix.people" :key="person.somtop_id">
                <th class="sticky-person person-name">{{ person.full_name }}</th>
                <td v-for="event in matrix.events" :key="event.id" class="matrix-status">
                  <span
                    v-if="person.statuses[event.id]"
                    class="status-pill"
                    :class="getStatusClass(person.statuses[event.id])"
                  >
                    {{ person.statuses[event.id] }}
                  </span>
                  <span v-else class="not-assigned" title="ไม่มีรายชื่อในกิจกรรมนี้">—</span>
                </td>
                <td class="attendance-total">{{ countAttended(person.statuses) }}</td>
              </tr>
              <tr v-if="matrix.events.length === 0 || matrix.people.length === 0">
                <td :colspan="Math.max(matrix.events.length + 2, 3)" class="empty-state">
                  ไม่พบรายละเอียดการเข้าร่วมตามเงื่อนไขที่เลือก
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import api from '../services/api'
import { swalError } from '../utils/swal'

const emptySummary = () => ({
  event_count: 0,
  participant_count: 0,
  attended_count: 0,
  leave_count: 0,
  absent_count: 0,
  pending_count: 0,
  attendance_rate: 0
})

const isLoading = ref(false)
const isExporting = ref(false)
const getCurrentAnnualYear = () => {
  const today = new Date()
  return today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear()
}
const currentAnnualYear = getCurrentAnnualYear()
const selectedYear = ref(String(currentAnnualYear))
const selectedEventType = ref('')
const selectedPerson = ref('')
const summary = ref(emptySummary())
const records = ref([])
const filterOptions = ref({ years: [], eventTypes: [], people: [] })
const matrix = ref({ events: [], people: [] })
const generatedAt = ref('')

const selectedTypeName = computed(() =>
  filterOptions.value.eventTypes.find(type => String(type.id) === selectedEventType.value)?.name
)
const selectedPersonName = computed(() =>
  filterOptions.value.people.find(person => String(person.id) === selectedPerson.value)?.full_name
)

const activeFilterLabel = computed(() => {
  const yearLabel = selectedYear.value
    ? `รอบปี ${Number(selectedYear.value) + 543} (1 เม.ย. ${Number(selectedYear.value) + 543} - 31 มี.ค. ${Number(selectedYear.value) + 544})`
    : 'ทุกรอบปี'
  return `${yearLabel} · ${selectedTypeName.value || 'ทุกประเภทกิจกรรม'} · ${selectedPersonName.value || 'ทุกคน'}`
})

const formatNumber = value => new Intl.NumberFormat('th-TH').format(Number(value) || 0)
const countAttended = statuses => Object.values(statuses || {}).filter(status => status === 'เข้าร่วม').length
const formatThaiDate = value => value
  ? new Date(`${value}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  : '-'

const getStatusClass = status => ({
  'เข้าร่วม': 'attended',
  'ลาประชุม': 'leave',
  'ไม่เข้าร่วม': 'absent',
  'รอตอบรับ': 'pending'
}[status] || 'pending')

const fetchReport = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/events/reports/participation', {
      params: {
        year: selectedYear.value || undefined,
        event_type_id: selectedEventType.value || undefined,
        somtop_id: selectedPerson.value || undefined
      }
    })
    summary.value = response.data.summary || emptySummary()
    records.value = response.data.records || []
    matrix.value = response.data.matrix || { events: [], people: [] }
    const availableYears = response.data.filters?.years || []
    filterOptions.value = {
      years: [...new Set([currentAnnualYear, ...availableYears.map(Number)])].sort((a, b) => b - a),
      eventTypes: response.data.filters?.event_types || [],
      people: response.data.filters?.people || []
    }
    generatedAt.value = new Date().toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })
  } catch (error) {
    summary.value = emptySummary()
    records.value = []
    matrix.value = { events: [], people: [] }
    swalError('โหลดรายงานไม่สำเร็จ', error.response?.data?.message || 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้')
  } finally {
    isLoading.value = false
  }
}

const clearFilters = () => {
  selectedYear.value = ''
  selectedEventType.value = ''
  selectedPerson.value = ''
}

const printReport = () => window.print()

const exportExcel = async () => {
  isExporting.value = true
  try {
    const response = await api.get('/events/reports/participation/export-excel', {
      params: {
        year: selectedYear.value || undefined,
        event_type_id: selectedEventType.value || undefined,
        somtop_id: selectedPerson.value || undefined
      },
      responseType: 'blob'
    })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `รายงานการเข้าร่วมรายบุคคล_รอบปี_${selectedYear.value ? Number(selectedYear.value) + 543 : 'ทั้งหมด'}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (error) {
    swalError('ส่งออกไม่สำเร็จ', 'ไม่สามารถสร้างรายงาน Excel ได้')
  } finally {
    isExporting.value = false
  }
}

watch([selectedYear, selectedEventType, selectedPerson], fetchReport)
onMounted(fetchReport)
</script>

<style scoped>
.participation-report { color: var(--color-text); }
.header-actions { display: flex; gap: var(--space-3); }
.report-filter-controls { flex-wrap: nowrap; }
.report-filter-controls .filter-group { min-width: 120px; }
.report-filter-controls .annual-filter-group { flex: 1.45; min-width: 280px; }
.person-filter { min-width: 280px; }
.report-filter-controls select { min-height: var(--control-height); }
.clear-button { min-height: var(--control-height); }
.summary-grid { display: grid; grid-template-columns: repeat(5, minmax(140px, 1fr)); gap: 14px; margin-bottom: var(--space-5); }
.summary-card { display: grid; gap: var(--space-1); min-height: 112px; padding: 18px; border: 1px solid var(--color-border); border-top: 4px solid; border-radius: 10px; background: var(--color-surface); box-shadow: var(--shadow-card); }
.summary-card strong { font-size: 30px; line-height: 1.1; }
.summary-card small, .summary-label { color: var(--color-text-muted); font-size: var(--font-size-sm); }
.summary-label { font-weight: 700; }
.summary-card.blue { border-top-color: #2563EB; }.summary-card.blue strong { color: #1D4ED8; }
.summary-card.slate { border-top-color: #64748B; }.summary-card.slate strong { color: #334155; }
.summary-card.green { border-top-color: #16A34A; }.summary-card.green strong { color: #15803D; }
.summary-card.amber { border-top-color: #D97706; }.summary-card.amber strong { color: #B45309; }
.summary-card.red { border-top-color: #DC2626; }.summary-card.red strong { color: #B91C1C; }
.report-card { padding: 0; overflow: hidden; }
.matrix-card { margin-top: 20px; }
.report-heading { display: flex; justify-content: space-between; align-items: end; gap: var(--space-4); padding: var(--space-5) 22px; border-bottom: 1px solid var(--color-border); }
.report-heading h2 { margin: 0; color: var(--color-text); font-size: 18px; }
.report-heading p, .print-date { margin: 5px 0 0; color: var(--color-text-muted); font-size: var(--font-size-sm); }
.report-table th { white-space: nowrap; }
.number-cell { text-align: right; font-variant-numeric: tabular-nums; }
.type-name { min-width: 180px; font-weight: 700; }
.positive { color: #15803D; font-weight: 700; }.negative { color: #B91C1C; }.muted { color: #6B7280; }
.rate-cell { min-width: 170px; }
.rate-line { display: flex; align-items: center; gap: 10px; }
.rate-track { flex: 1; height: 8px; overflow: hidden; border-radius: 99px; background: var(--color-border); }
.rate-track span { display: block; height: 100%; border-radius: inherit; background: #16A34A; }
.rate-line strong { width: 48px; text-align: right; font-size: 13px; }
.empty-state, .loading-state { padding: 48px; text-align: center; color: var(--color-text-muted); }
.loading-state { display: flex; justify-content: center; align-items: center; gap: 12px; }
tfoot th { background: #F8FAFC; border-top: 2px solid #CBD5E1; }
.legend { display: flex; flex-wrap: wrap; gap: 6px; }
.matrix-scroll { width: 100%; overflow: auto; }
.matrix-table { width: max-content; min-width: 100%; border-collapse: separate; border-spacing: 0; }
.sticky-person { position: sticky; left: 0; z-index: 2; min-width: 230px; max-width: 230px; background: #F8FAFC; box-shadow: 1px 0 #E5E7EB; }
thead .sticky-person { z-index: 4; }
.person-name { color: #111827; text-align: left; font-weight: 700; }
.event-heading { width: 180px; min-width: 180px; max-width: 180px; white-space: normal !important; text-align: center; vertical-align: top; }
.event-heading span, .event-heading small { display: block; }
.event-title { margin-bottom: 6px; color: #111827; line-height: 1.35; }
.event-heading small { color: #6B7280; font-weight: 500; line-height: 1.4; }
.matrix-status { text-align: center; }
.total-heading, .attendance-total { position: sticky; right: 0; min-width: 105px; text-align: center; background: #ECFDF5 !important; box-shadow: -1px 0 #D1FAE5; }
.total-heading { z-index: 4; color: #166534; }
.attendance-total { z-index: 2; color: #166534; font-weight: 800; font-size: 15px; }
.status-pill { display: inline-flex; align-items: center; justify-content: center; min-width: 78px; padding: 5px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; white-space: nowrap; }
.status-pill.attended { color: #166534; background: #DCFCE7; }
.status-pill.leave { color: #92400E; background: #FEF3C7; }
.status-pill.absent { color: #991B1B; background: #FEE2E2; }
.status-pill.pending { color: #475569; background: #E2E8F0; }
.not-assigned { color: #CBD5E1; }
@media (max-width: 1000px) { .report-filter-controls { flex-wrap: wrap; }.report-filter-controls .annual-filter-group { flex-basis: 100%; }.summary-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) { .header-actions{width:100%;margin-top:var(--space-3);flex-direction:column}.header-actions button{width:100%}.report-filter-controls{align-items:stretch;flex-direction:column}.report-filter-controls .filter-group,.report-filter-controls .annual-filter-group{min-width:0}.filter-actions,.filter-actions button{width:100%}.summary-grid { grid-template-columns: 1fr; } }
@media print {
  .participation-report { color: #000; }
  .summary-grid { grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .summary-card { min-height: auto; padding: 10px; box-shadow: none; }
  .summary-card strong { font-size: 21px; }
  .report-card { border: 0; box-shadow: none; }
  .report-heading { padding: 12px 0; }
  .report-table { font-size: 10px; }
  .matrix-card { break-before: page; }
  .matrix-scroll { overflow: visible; }
  .matrix-table { width: 100%; font-size: 8px; }
  .sticky-person { position: static; min-width: 130px; max-width: 130px; box-shadow: none; }
  .event-heading { width: auto; min-width: 90px; }
  .status-pill { min-width: 0; padding: 3px 5px; font-size: 8px; }
}
</style>
