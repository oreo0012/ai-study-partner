import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'
import ParentPage from '@/pages/ParentPage.vue'
import ChildTaskPage from '@/pages/ChildTaskPage.vue'
import PracticePage from '@/pages/PracticePage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage
    },
    {
      path: '/parent',
      name: 'parent',
      component: ParentPage
    },
    {
      path: '/tasks',
      name: 'tasks',
      component: ChildTaskPage
    },
    {
      path: '/practice',
      name: 'practice',
      component: PracticePage
    }
  ]
})

export default router
