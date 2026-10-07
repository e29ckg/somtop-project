import { ref, computed } from 'vue'

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user')) || null
  } catch {
    localStorage.removeItem('user')
    return null
  }
}

const user = ref(readStoredUser())
const selectedCourtCode = ref(localStorage.getItem('central_court_code') || '')
let verified = false

export const currentUser = computed(() => user.value)
export const isCentralAdmin = computed(() => user.value?.role === 'central_admin')
export const isAdmin = computed(() => ['admin', 'central_admin'].includes(user.value?.role))
export const isFinance = computed(() => ['admin', 'central_admin', 'finance'].includes(user.value?.role))
export const activeCourtCode = computed(() => isCentralAdmin.value ? selectedCourtCode.value : (user.value?.court_code || ''))

export const setSelectedCourtCode = (code) => {
  selectedCourtCode.value = code || ''
  if (selectedCourtCode.value) localStorage.setItem('central_court_code', selectedCourtCode.value)
  else localStorage.removeItem('central_court_code')
}

export const setSessionUser = (value) => {
  user.value = value || null
  verified = true
  if (user.value) localStorage.setItem('user', JSON.stringify(user.value))
  else localStorage.removeItem('user')
}

export const clearSession = () => {
  setSessionUser(null)
  setSelectedCourtCode('')
}
export const isSessionVerified = () => verified
export const markSessionUnverified = () => { verified = false }
