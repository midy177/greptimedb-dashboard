import { App, createApp } from 'vue'
import ArcoVue from '@arco-design/web-vue'
import ArcoVueIcon from '@arco-design/web-vue/es/icon'
import { install as installVueCodemirror } from 'vue-codemirror'
import globalComponents from '@/components'
import { initializeNews } from '@/hooks/news'
import '@/assets/icons'
import router from './router'
import store from './store'
import i18n from './locale'
import directive from './directive'
import Apps from './App.vue'
import '@arco-design/web-vue/dist/arco.css'
import '@/assets/style/global.less'
import '@/api/interceptor'

const isTauri = '__TAURI_INTERNALS__' in window

if (isTauri) {
  if (import.meta.env.PROD) {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault()
    })
  }

  // WKWebView on macOS does not route Cmd+C/V through the system responder chain.
  import('@tauri-apps/plugin-clipboard-manager').then(({ readText, writeText }) => {
    document.addEventListener('keydown', async (e) => {
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod) return

      if (e.key === 'c' || e.key === 'x') {
        const selection = window.getSelection()?.toString()
        if (selection) {
          await writeText(selection)
          if (e.key === 'x') {
            document.execCommand('delete')
          }
        }
      } else if (e.key === 'v') {
        const active = document.activeElement as HTMLElement
        const isEditable =
          active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active?.isContentEditable
        if (isEditable) {
          const text = await readText()
          if (text) {
            document.execCommand('insertText', false, text)
          }
        }
      } else if (e.key === 'a') {
        document.execCommand('selectAll')
      }
    })
  })
}

const app: App = createApp(Apps)

app.config.errorHandler = (err, vm, info) => {
  // Suppress known vue-codemirror + keep-alive concurrency issue
  // where history ChangeSet lengths mismatch during reactive batch updates
  if (err instanceof Error && err.message === 'Mismatched change set lengths') return
  console.error(err, info)
}

app.use(ArcoVue, {})
app.use(ArcoVueIcon)
// Override default extensions to empty so components supply their own via :extensions prop
app.use(installVueCodemirror, { extensions: [] })

app.use(store)
app.use(router)
app.use(i18n)
app.use(globalComponents)
app.use(directive)

initializeNews()

app.mount('#app')
