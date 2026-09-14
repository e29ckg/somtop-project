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
let verified = false

export const currentUser = computed(() => user.value)
export const isAdmin = computed(() => user.value?.role === 'admin')

export const setSessionUser = (value) => {
  user.value = value || null
  verified = true
  if (user.value) localStorage.setItem('user', JSON.stringify(user.value))
  else localStorage.removeItem('user')
}

export const clearSession = () => setSessionUser(null)
export const isSessionVerified = () => verified
export const markSessionUnverified = () => { verified = false }
