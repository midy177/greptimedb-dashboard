<script lang="tsx">
  import { defineComponent, ref, h, compile, computed, watch } from 'vue'
  import { storeToRefs } from 'pinia'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter, RouteRecordRaw } from 'vue-router'
  import type { RouteMeta } from 'vue-router'
  import { useAppStore } from '@/store'
  import { listenerRouteChange } from '@/utils/route-listener'
  import { openWindow, regexUrl } from '@/utils'
  import useMenuTree from './use-menu-tree'

  export default defineComponent({
    emit: ['collapse'],
    setup() {
      const { t } = useI18n()
      const appStore = useAppStore()
      const { queryMode } = storeToRefs(appStore)

      // 强制菜单在模式切换时重新渲染
      const renderKey = ref(0)
      watch(queryMode, () => {
        renderKey.value += 1
      })
      const router = useRouter()
      const route = useRoute()
      const { menuTree } = useMenuTree()
      const collapsed = computed({
        get() {
          if (appStore.device === 'desktop') return appStore.menuCollapse
          return false
        },
        set(value: boolean) {
          appStore.applyUiConfig({ menuCollapse: value })
        },
      })

      const openKeys = ref<string[]>([])
      const selectedKey = ref<string[]>([])

      const goto = (item: RouteRecordRaw) => {
        if (regexUrl.test(item.path)) {
          openWindow(item.path)
          selectedKey.value = [item.name as string]
          return
        }
        const { hideInMenu, activeMenu } = item.meta as RouteMeta
        if (route.name === item.name && !hideInMenu && !activeMenu) {
          selectedKey.value = [item.name as string]
          return
        }
        router.push({ name: item.name })
      }
      const findMenuOpenKeys = (name: string) => {
        const result: string[] = []
        let isFind = false
        const backtrack = (item: RouteRecordRaw, keys: string[], target: string) => {
          if (item.name === target) {
            isFind = true
            result.push(...keys, item.name as string)
            return
          }
          if (item.children?.length) {
            item.children.forEach((el) => {
              backtrack(el, [...keys], target)
            })
          }
        }
        menuTree.value.forEach((el: RouteRecordRaw) => {
          if (isFind) return
          backtrack(el, [el.name as string], name)
        })
        return result
      }
      listenerRouteChange((newRoute) => {
        const { requiresAuth, activeMenu, hideInMenu } = newRoute.meta
        if (requiresAuth && (!hideInMenu || activeMenu)) {
          const menuOpenKeys = findMenuOpenKeys((activeMenu || newRoute.name) as string)
          const keySet = new Set([...menuOpenKeys, ...openKeys.value])
          openKeys.value = [...keySet]
          selectedKey.value = [activeMenu || menuOpenKeys[menuOpenKeys.length - 1]]
        }
      }, true)
      const setCollapse = (val: boolean) => {
        if (appStore.device === 'desktop') appStore.applyUiConfig({ menuCollapse: val })
      }

      return () => {
        // renderKey 变化强制重新渲染，currentMenuTree 读取最新菜单
        const _key = renderKey.value
        const currentMenuTree = menuTree.value

        const renderSubMenu = () => {
          function travel(_route: RouteRecordRaw[], nodes = []) {
            if (_route) {
              _route.forEach((element) => {
                const icon = element?.meta?.icon ? () => h(compile(`<${element?.meta?.icon}/>`)) : null
                const node =
                  element?.children && element?.children.length !== 0 ? (
                    <a-sub-menu
                      key={element?.name}
                      v-slots={{
                        icon,
                        title: () => h(compile(t(element?.meta?.locale || ''))),
                      }}
                    >
                      {travel(element?.children)}
                    </a-sub-menu>
                  ) : (
                    <a-menu-item key={element?.name} v-slots={{ icon }} onClick={() => goto(element)}>
                      {t(element?.meta?.locale || '')}
                    </a-menu-item>
                  )
                nodes.push(node as never)
              })
            }
            return nodes
          }
          return travel(currentMenuTree)
        }

        return (
          <a-menu
            v-model:collapsed={collapsed.value}
            v-model:open-keys={openKeys.value}
            show-collapse-button={appStore.device !== 'mobile'}
            auto-open={false}
            selected-keys={selectedKey.value}
            auto-open-selected={true}
            level-indent={34}
            style="height: 100%"
            onCollapse={setCollapse}
          >
            {renderSubMenu()}
          </a-menu>
        )
      }
    },
  })
</script>

<style lang="less" scoped>
  :deep(.arco-menu-inner) {
    .arco-menu-inline-header {
      display: flex;
      align-items: center;
    }
    .arco-icon {
      &:not(.arco-icon-down) {
        font-size: 18px;
      }
    }
  }
</style>
