<template>
  <div class="updates-page">
    <header class="page-header">
      <div>
        <h1 class="page-title">การอัพเดท</h1>
        <p class="page-subtitle">ข่าวและประวัติการเปลี่ยนแปลงของระบบ</p>
      </div>
    </header>

    <section v-if="currentUpdate" class="card update-card" aria-labelledby="current-update-title">
      <div class="update-heading">
        <span class="update-badge">{{ currentUpdate.isUnreleased ? 'อยู่ระหว่างพัฒนา' : 'ล่าสุด' }}</span>
        <h2 id="current-update-title">{{ currentUpdate.title }}</h2>
        <span v-if="currentUpdate.date" class="update-date">{{ currentUpdate.date }}</span>
      </div>
      <div v-for="section in currentUpdate.sections" :key="section.title" class="update-section">
        <h3>{{ section.title }}</h3>
        <ul>
          <li v-for="(item, index) in section.items" :key="index">{{ item }}</li>
        </ul>
      </div>
    </section>

    <section class="update-history" aria-labelledby="update-history-title">
      <h2 id="update-history-title">ประวัติการอัพเดท</h2>
      <p v-if="history.length === 0" class="card empty-history">ยังไม่มีรายการเวอร์ชันที่เผยแพร่</p>
      <article v-for="entry in history" :key="entry.title" class="card update-card">
        <div class="update-heading">
          <h3>{{ entry.title }}</h3>
          <span v-if="entry.date" class="update-date">{{ entry.date }}</span>
        </div>
        <div v-for="section in entry.sections" :key="section.title" class="update-section">
          <h4>{{ section.title }}</h4>
          <ul>
            <li v-for="(item, index) in section.items" :key="index">{{ item }}</li>
          </ul>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import changelog from '../../../CHANGELOG.md?raw'

const entries = computed(() => {
  const result = []
  let entry = null
  let section = null

  for (const line of changelog.split(/\r?\n/)) {
    const version = line.match(/^## \[([^\]]+)\](?:\s+-\s+(.+))?$/)
    if (version) {
      entry = {
        title: version[1] === 'Unreleased' ? 'รายการที่กำลังพัฒนา' : `เวอร์ชัน ${version[1]}`,
        date: version[1] === 'Unreleased' ? '' : (version[2] || ''),
        isUnreleased: version[1] === 'Unreleased',
        sections: [],
      }
      result.push(entry)
      section = null
      continue
    }
    if (line.startsWith('## ')) {
      entry = null
      section = null
      continue
    }
    if (!entry) continue

    const heading = line.match(/^### (.+)$/)
    if (heading) {
      section = { title: heading[1], items: [] }
      entry.sections.push(section)
      continue
    }
    const item = line.match(/^- (.+)$/)
    if (item && section) section.items.push(item[1].replace(/`/g, ''))
  }

  return result
})

const currentUpdate = computed(() => entries.value[0] || null)
const history = computed(() => entries.value.slice(1))
</script>

<style scoped>
.updates-page { max-width: 960px; margin: 0 auto; }
.update-card { margin-bottom: 20px; }
.update-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 12px; }
.update-heading h2, .update-heading h3 { margin: 0; color: var(--color-text); font-size: 20px; }
.update-badge { padding: 4px 10px; border-radius: 999px; background: var(--color-primary-soft); color: var(--color-primary-hover); font-size: 12px; font-weight: 600; }
.update-date { color: var(--color-text-muted); font-size: 13px; }
.update-section { border-top: 1px solid var(--color-border); padding-top: 14px; margin-top: 14px; }
.update-section h3, .update-section h4 { margin: 0 0 8px; color: var(--color-text); font-size: 16px; }
.update-section ul { margin: 0; padding-left: 24px; line-height: 1.8; }
.update-section li { margin-bottom: 4px; overflow-wrap: anywhere; }
.update-history > h2 { margin: 28px 0 14px; font-size: 20px; color: var(--color-text); }
.empty-history { color: var(--color-text-muted); }
</style>
