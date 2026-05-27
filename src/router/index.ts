import { createRouter, createWebHashHistory } from 'vue-router'
import NProgress from 'nprogress' // progress bar
import 'nprogress/nprogress.css'
import { useAppStore } from '@/store'
import { appRoutes } from './routes'
import { REDIRECT_MAIN, NOT_FOUND_ROUTE } from './routes/base'
import createRouteGuard from './guard'
import client from './routes/client'

NProgress.configure({ showSpinner: false }) // NProgress Configuration

const extractContextPath = (path: string): string => {
  const dashboardIndex = path.lastIndexOf('/dashboard')
  if (dashboardIndex === -1) return ''
  return path.substring(0, dashboardIndex + 1)
}

const router = createRouter({
  history: createWebHashHistory(extractContextPath(window.location.pathname)),
  routes: [
    {
      path: '/',
      redirect: '/dashboard/logs-query',
    },
    // Quick-connect: /#/connect?host=...&username=...&password=...&database=...
    // Credentials are session-only and cleared when the page is closed.
    {
      path: '/connect',
      redirect: (to) => ({ path: '/dashboard/logs-query', query: to.query }),
    },
    ...appRoutes,
    client,
    REDIRECT_MAIN,
    NOT_FOUND_ROUTE,
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

createRouteGuard(router)

router.beforeEach((to, _from, next) => {
  const { host, username, password, database } = to.query as Record<string, string>
  if (host || username || password) {
    const appStore = useAppStore()
    appStore.setSessionConnectionConfig({
      ...(host && { host }),
      ...(username !== undefined && { username }),
      ...(password !== undefined && { password }),
      ...(database && { database }),
    })

    // Strip credentials from URL to avoid leaking in history
    const cleanQuery = { ...to.query }
    delete cleanQuery.host
    delete cleanQuery.username
    delete cleanQuery.password
    delete cleanQuery.database
    next({ ...to, query: cleanQuery, replace: true })
    return
  }
  next()
})

export default router
