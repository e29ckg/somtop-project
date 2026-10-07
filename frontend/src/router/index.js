import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import ManageSomtopView from '../views/ManageSomtopView.vue'
import MainLayout from '../layouts/MainLayout.vue'
import LeaveHistoryView from '../views/LeaveHistoryView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import ManageUserView from '../views/ManageUserView.vue'
import ManageCourtView from '../views/ManageCourtView.vue'
import ActivityLogsView from '../views/ActivityLogsView.vue'
import ManageTitleView from '../views/ManageTitleView.vue'
import ManageEventView from '../views/ManageEventView.vue'
import ManagePositionView from '../views/ManagePositionView.vue'
import ManageDecorationView from '../views/ManageDecorationView.vue'
import ManageTemplateView from '../views/ManageTemplateView.vue'
import ManageGoogleCalendarView from '../views/ManageGoogleCalendarView.vue'
import ManageTermView from '../views/ManageTermView.vue'
import ProfileView from '../views/ProfileView.vue'
import ParticipationReportView from '../views/ParticipationReportView.vue'
import DutyScheduleView from '../views/DutyScheduleView.vue'
import PerformanceEvaluationView from '../views/PerformanceEvaluationView.vue'
import PaymentEvidenceView from '../views/PaymentEvidenceView.vue'
import ManageHolidayView from '../views/ManageHolidayView.vue'
import api from '../services/api'
import { activeCourtCode, currentUser, isSessionVerified, setSessionUser, clearSession } from '../services/session'

// 1. สร้าง router ขึ้นมาก่อน
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/', // หน้า Login ใช้ path เป็น '/'
      name: 'login',
      component: LoginView 
    },
    {
      path: '/',
      component: MainLayout, 
      meta: { requiresAuth: true },
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: DashboardView,
          meta: { requiresCourt: true }
        },
        {
          path: 'profile',
          name: 'profile',
          component: ProfileView
        },
        {
          path: 'manage-somtop',
          name: 'manage-somtop',
          component: ManageSomtopView,
          meta: { requiresCourt: true }
        },
        {
          path: 'leave-history', 
          name: 'leave-history',
          component: LeaveHistoryView,
          meta: { requiresCourt: true }
        },
        {
          path: 'manage-users', 
          name: 'manage-users',
          component: ManageUserView,
          meta: { requiresAdmin: true }
        },
        {
          path: 'manage-courts',
          name: 'manage-courts',
          component: ManageCourtView,
          meta: { requiresAdmin: true }
        },
        {
          path: 'activity-logs',
          name: 'activity-logs',
          component: ActivityLogsView,
          meta: { requiresCentral: true }
        },
        {
          path: 'manage-titles',
          name: 'manage-titles',
          component: ManageTitleView,
          meta: { requiresCentral: true }
        },
        {
          path: 'manage-events',
          name: 'manage-events',
          component: ManageEventView,
          meta: { requiresCourt: true }
        },
        {
          path: 'participation-report',
          name: 'participation-report',
          component: ParticipationReportView,
          meta: { requiresCourt: true }
        },
        {
          path: 'duty-schedule',
          name: 'duty-schedule',
          component: DutyScheduleView,
          meta: { requiresCourt: true }
        },
        { path: 'performance-evaluation', name: 'performance-evaluation', component: PerformanceEvaluationView, meta: { requiresCourt: true } },
        { path: 'payment-evidence', name: 'payment-evidence', component: PaymentEvidenceView, meta: { requiresFinance: true, requiresCourt: true } },
        {
          path: 'manage-event-types',
          name: 'manage-event-types',
          redirect: '/manage-events',
          meta: { requiresCentral: true }
        },
        {
          path: 'manage-positions',
          name: 'manage-positions',
          component: ManagePositionView,
          meta: { requiresCentral: true }
        },
        {
          path: 'manage-decorations',
          name: 'manage-decorations',
          component: ManageDecorationView,
          meta: { requiresCentral: true }
        },
        {
          path: 'manage-leave-types',
          name: 'manage-leave-types',
          redirect: '/leave-history',
          meta: { requiresCentral: true }
        },
        {
          path: 'manage-templates',
          name: 'manage-templates',
          component: ManageTemplateView,
          meta: { requiresCentral: true }
        },
        {
          path: 'manage-calendar-sync',
          name: 'manage-calendar-sync',
          component: ManageGoogleCalendarView,
          meta: { requiresCentral: true }
        },
        {
          path: 'manage-terms',
          name: 'manage-terms',
          component: ManageTermView,
          meta: { requiresAdmin: true, requiresCourt: true }
        },
        {
          path: 'manage-holidays',
          name: 'manage-holidays',
          component: ManageHolidayView,
          meta: { requiresAdmin: true }
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView
    }
  ]
})

// 2. ตรวจสอบสิทธิ์การเข้าถึง (Navigation Guard) วางไว้หลังสร้าง router เสร็จแล้ว
router.beforeEach(async (to) => {
  if (!isSessionVerified()) {
    try {
      const response = await api.get('/auth/me')
      setSessionUser(response.data.user)
    } catch {
      clearSession()
    }
  }

  if (to.meta.requiresAuth && !currentUser.value) return '/'
  const role = currentUser.value?.role
  const fallback = role === 'central_admin' && !activeCourtCode.value ? '/manage-courts' : '/dashboard'
  if (to.meta.requiresAdmin && !['admin', 'central_admin'].includes(role)) return fallback
  if (to.meta.requiresCentral && role !== 'central_admin') return fallback
  if (to.meta.requiresFinance && !['admin', 'central_admin', 'finance'].includes(role)) return fallback
  if (to.meta.requiresCourt && role === 'central_admin' && !activeCourtCode.value) return '/manage-courts'
  if (to.path === '/' && currentUser.value) return fallback

  return true
})

// 3. ส่งออก (Export) ไปใช้งาน
export default router
