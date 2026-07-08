// 一次性脚本：把 logo-novoone-mark.svg 渲染成 1024 PNG，再用 tauri icon 生成全套桌面图标，
// 并把 tauri 产出的多分辨率 icon.ico 复制为浏览器 favicon.ico。
// 运行：bun scripts/gen-icons.mjs
import { Resvg } from '@resvg/resvg-js'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const MARK_SVG = resolve(root, 'src/assets/images/logo-novoone-mark.svg')
const PNG_1024 = resolve(root, 'src-tauri/icons/source-1024.png')
const ICONS_DIR = resolve(root, 'src-tauri/icons')

// 1) SVG → 1024×1024 PNG
const svg = await readFile(MARK_SVG, 'utf8')
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } })
const png = resvg.render().asPng()
await mkdir(ICONS_DIR, { recursive: true })
await writeFile(PNG_1024, png)
console.log(`[1/3] wrote ${PNG_1024} (${png.length} bytes)`)

// 2) tauri icon → 全套桌面图标（各尺寸 png + icon.icns + icon.ico + Windows Square*/StoreLogo）
const r = spawnSync('bunx', ['tauri', 'icon', PNG_1024, '-o', ICONS_DIR], { cwd: root, stdio: 'inherit' })
if (r.status !== 0) {
  console.error('tauri icon failed')
  process.exit(r.status ?? 1)
}
console.log('[2/3] tauri icons generated')

// 3) favicon.ico（tauri 产出的 icon.ico 是多分辨率 ico，浏览器兼容）
await copyFile(resolve(ICONS_DIR, 'icon.ico'), resolve(root, 'src/assets/favicon.ico'))
console.log('[3/3] favicon.ico updated')
