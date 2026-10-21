import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import api from './services/api'
import { currentUser, clearSession } from './services/session'

import './assets/global.css'

const app = createApp(App)

app.use(router)
app.mount('#app')

// Pick up central logout and permission changes in tabs that remain open.
let checkingSession = false
const checkSession = async () => {
  if (checkingSession || document.visibilityState !== 'visible' || !currentUser.value) return
  checkingSession = true
  try { await api.get('/auth/me') }
  catch (error) {
    if ([401, 403].includes(error.response?.status)) {
      clearSession()
      router.replace('/')
    }
  } finally { checkingSession = false }
}
window.addEventListener('focus', checkSession)
document.addEventListener('visibilitychange', checkSession)
window.setInterval(checkSession, 60000)
