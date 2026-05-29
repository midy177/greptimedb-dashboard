import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHashHistory } from 'vue-router'
import NProgress from 'nprogress' // progress bar
import 'nprogress/nprogress.css'
import { useAppStore } from '@/store'
import { decryptConnectToken } from '@/utils/connect-token'
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
    // Quick-connect: /#/connect?token=<encrypted>
    // Generate token with encryptConnectToken() from @/utils/connect-token.
    // Credentials are session-only and cleared when the page is closed.
    {
      path: '/connect',
      redirect: (to) => ({ path: '/dashboard/logs-query', query: to.query }),
    },
    {
      path: '/token-generator',
      name: 'tokenGenerator',
      component: () => import('@/views/token-generator/index.vue'),
    },
    ...appRoutes,
    client,
    REDIRECT_MAIN,
    NOT_FOUND_ROUTE,
  ] as RouteRecordRaw[],
  scrollBehavior() {
    return { top: 0 }
  },
})

createRouteGuard(router)

const inferHostFromLocation = (): string => window.location.origin

router.beforeEach(async (to, _from, next) => {
  const query = to.query as Record<string, string>

  if (query.token) {
    const credentials = await decryptConnectToken(query.token)
    const cleanQuery = { ...query }
    delete cleanQuery.token
    if (credentials) {
      const appStore = useAppStore()
      appStore.setSessionConnectionConfig({
        host: credentials.h || inferHostFromLocation(),
        ...(credentials.u !== undefined && { username: credentials.u }),
        ...(credentials.p !== undefined && { password: credentials.p }),
        database: credentials.d || 'public',
      })
    }
    next({ ...to, query: cleanQuery, replace: true })
    return
  }
  next()
})

export default router
