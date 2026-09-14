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
import ManageEventTypeView from '../views/ManageEventTypeView.vue'
import ManagePositionView from '../views/ManagePositionView.vue'
import ManageDecorationView from '../views/ManageDecorationView.vue'
import ManageLeaveTypeView from '../views/ManageLeaveTypeView.vue'
import ManageTemplateView from '../views/ManageTemplateView.vue'
import ManageGoogleCalendarView from '../views/ManageGoogleCalendarView.vue'
import ManageTermView from '../views/ManageTermView.vue'
import ProfileView from '../views/ProfileView.vue'
import ParticipationReportView from '../views/ParticipationReportView.vue'
import DutyScheduleView from '../views/DutyScheduleView.vue'
import api from '../services/api'
import { currentUser, isSessionVerified, setSessionUser, clearSession } from '../services/session'

// 1. สร้าง router ขึ้นมาก่อน
const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_URL),
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
          component: DashboardView
        },
        {
          path: 'profile',
          name: 'profile',
          component: ProfileView
        },
        {
          path: 'manage-somtop',
          name: 'manage-somtop',
          component: ManageSomtopView
        },
        {
          path: 'leave-history', 
          name: 'leave-history',
          component: LeaveHistoryView
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
          meta: { requiresAdmin: true }
        },
        {
          path: 'manage-titles',
          name: 'manage-titles',
          component: ManageTitleView,
          meta: { requiresAdmin: true }
        },
        {
          path: 'manage-events',
          name: 'manage-events',
          component: ManageEventView
        },
        {
          path: 'participation-report',
          name: 'participation-report',
          component: ParticipationReportView
        },
        {
          path: 'duty-schedule',
          name: 'duty-schedule',
          component: DutyScheduleView
        },
        {
          path: 'manage-event-types',
          name: 'manage-event-types',
          component: ManageEventTypeView,
          meta: { requiresAdmin: true }
        },
        {
          path: 'manage-positions',
          name: 'manage-positions',
          component: ManagePositionView,
          meta: { requiresAdmin: true }
        },
        {
          path: 'manage-decorations',
          name: 'manage-decorations',
          component: ManageDecorationView,
          meta: { requiresAdmin: true }
        },
        {
          path: 'manage-leave-types',
          name: 'manage-leave-types',
          component: ManageLeaveTypeView,
          meta: { requiresAdmin: true }
        },
        {
          path: 'manage-templates',
          name: 'manage-templates',
          component: ManageTemplateView,
          meta: { requiresAdmin: true }
        },
        {
          path: 'manage-calendar-sync',
          name: 'manage-calendar-sync',
          component: ManageGoogleCalendarView,
          meta: { requiresAdmin: true }
        },
        {
          path: 'manage-terms',
          name: 'manage-terms',
          component: ManageTermView,
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
  if (to.meta.requiresAdmin && currentUser.value?.role !== 'admin') return '/dashboard'
  if (to.path === '/' && currentUser.value) return '/dashboard'

  return true
})

// 3. ส่งออก (Export) ไปใช้งาน
export default router
