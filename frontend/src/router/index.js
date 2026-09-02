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
import ManageLeaveTypeView from '../views/ManageLeaveTypeView.vue'
import ManageTemplateView from '../views/ManageTemplateView.vue'
import ManageGoogleCalendarView from '../views/ManageGoogleCalendarView.vue'

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
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: DashboardView
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
          component: ManageUserView
        },
        {
          path: 'manage-courts',
          name: 'manage-courts',
          component: ManageCourtView
        },
        {
          path: 'activity-logs',
          name: 'activity-logs',
          component: ActivityLogsView
        },
        {
          path: 'manage-titles',
          name: 'manage-titles',
          component: ManageTitleView
        },
        {
          path: 'manage-events',
          name: 'manage-events',
          component: ManageEventView
        },
        {
          path: 'manage-event-types',
          name: 'manage-event-types',
          component: ManageEventTypeView
        },
        {
          path: 'manage-positions',
          name: 'manage-positions',
          component: ManagePositionView
        },
        {
          path: 'manage-leave-types',
          name: 'manage-leave-types',
          component: ManageLeaveTypeView
        },
        {
          path: 'manage-templates',
          name: 'manage-templates',
          component: ManageTemplateView
        },
        {
          path: 'manage-calendar-sync',
          name: 'manage-calendar-sync',
          component: ManageGoogleCalendarView
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
router.beforeEach((to, from) => {
  const isAuthenticated = localStorage.getItem('user');

  // เปลี่ยนจาก '/login' เป็น '/' ให้ตรงกับ path ด้านบน
  if (to.path !== '/' && !isAuthenticated) {
    return '/'; 
  }

  if (to.path === '/' && isAuthenticated) {
    return '/dashboard';
  }
  
  return true; 
})

// 3. ส่งออก (Export) ไปใช้งาน
export default router