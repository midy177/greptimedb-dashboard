<!-- prettier-ignore -->
<template lang="pug">
a-layout.new-layout
  a-layout-header.sip-header
    span.sip-title {{ $t('menu.dashboard.sip') }}
    a-divider(direction="vertical")
    TimeRangeSelect(button-type="outline" :time-length="time" :time-range="rangeTime" @update:time-length="(v) => (time = v)" @update:time-range="(v) => (rangeTime = v)")
    a-auto-complete(v-model="filterCallId" style="width: 140px" allow-clear placeholder="Call-ID" :data="fieldOptions.call_id" filter-option @focus="fetchFieldOptions('call_id')" @change="loadFlows" @clear="loadFlows")
    a-auto-complete(v-model="filterSrcIp" style="width:140px" allow-clear placeholder="src_ip" :data="fieldOptions.src_ip" filter-option @focus="fetchFieldOptions('src_ip')" @change="loadFlows" @clear="loadFlows")
    a-auto-complete(v-model="filterDstIp" style="width:140px" allow-clear placeholder="dst_ip" :data="fieldOptions.dst_ip" filter-option @focus="fetchFieldOptions('dst_ip')" @change="loadFlows" @clear="loadFlows")
    a-select(v-model="methodFilter" style="width:130px" allow-clear :placeholder="$t('sip.allMethod')" @change="loadFlows")
      a-option(value="INVITE") INVITE
      a-option(value="REGISTER") REGISTER
      a-option(value="OPTIONS") OPTIONS
      a-option(value="BYE") BYE
      a-option(value="CANCEL") CANCEL
      a-option(value="ACK") ACK
    a-button(type="primary" size="small" :loading="flowsLoading" @click="loadFlows")
      template(#icon)
        icon-loading(v-if="flowsLoading" spin)
        icon-play-arrow(v-else)
      | {{ $t('dashboard.run') }}
    a-checkbox(size="small" :model-value="flowsLive" @update:modelValue="toggleFlowsLive")
      span(style="color: var(--color-text-2)") {{ $t('logsQuery.live') }}
  a-layout.sip-body
    a-layout-sider.sip-sider(:width="300")
      .sider-header
        span.sider-title {{ $t('sip.flows') }}
        a-tag(v-if="flows.length" color="arcoblue" size="small") {{ flows.length }}
      .sider-body
        a-spin(:loading="flowsLoading")
          a-empty(v-if="!flowsLoading && flows.length === 0" :description="$t('sip.noFlows')")
          .flow-list(v-else)
            .flow-item(v-for="flow in flows" :key="flow.call_id" :class="{ active: selectedCallId === flow.call_id }" @click="selectFlow(flow)" @contextmenu.prevent="onFlowContextMenu($event, flow)")
              .flow-header
                span.call-id {{ flow.call_id }}
                a-tag.status-tag(size="small" :color="methodColor(flow.last_method)") {{ flow.last_method }}
              .flow-meta
                span.endpoint {{ flow.src_ip }}:{{ flow.src_port }}
                span.arrow →
                span.endpoint {{ flow.dst_ip }}:{{ flow.dst_port }}
              .flow-footer
                span.msg-count {{ flow.msg_count }} {{ $t('sip.messages') }}
                .time-group
                  span.time {{ formatTime(flow.start_time) }}
                  a-button.export-btn(type="text" size="mini" @click.stop="exportFlow(flow)")
                    template(#icon)
                      icon-download
    a-layout-content.layout-content
      .ladder-header-bar
        span.ladder-title {{ $t('sip.ladder') }}
        span.call-id-badge(v-if="selectedCallId") {{ selectedCallId }}
        template(v-if="selectedCallId")
          a-divider(direction="vertical")
          a-tooltip(mini :content="liveRefresh ? $t('sip.stopLive') : $t('sip.startLive')")
            a-button(size="mini" :type="liveRefresh ? 'primary' : 'outline'" @click="toggleLive")
              template(#icon)
                icon-loading(v-if="liveRefresh" spin)
                icon-refresh(v-else)
              | {{ liveRefresh ? $t('sip.live') : $t('sip.startLive') }}
          a-tooltip(mini :content="$t('dashboard.exportCSV')")
            a-button(size="mini" type="outline" :loading="exportingMessages" @click="exportMessages")
              template(#icon)
                icon-download
      .ladder-content
        a-spin(:loading="detailLoading")
          a-empty(v-if="!detailLoading && !selectedCallId" :description="$t('sip.selectFlow')")
          a-empty(v-else-if="!detailLoading && messages.length === 0" :description="$t('sip.noMessages')")
          .ladder-diagram(v-else-if="messages.length > 0")
            .ladder-header
              .header-time-col
              .header-endpoints
                .ladder-endpoint(v-for="ep in endpoints" :key="ep" :class="{ 'ep-active': selectedEndpoint === ep }" @click.stop="selectEndpoint(ep)")
                  .ep-label {{ ep }}
                  .ep-vline
            .ladder-body
              .message-row(v-for="(msg, idx) in messages" :key="idx" :class="{ selected: selectedMsgIdx === idx }" @click="selectMessage(idx)")
                .row-time {{ formatMsgTime(msg.timestamp) }}
                .row-arrow-area
                  .vline(v-for="ep in endpoints" :key="ep")
                  .arrow-overlay(:style="arrowOverlayStyle(msg)")
                    .arrow-body
                    .arrow-head(:class="arrowDirection(msg)")
                  .method-label(:style="methodLabelStyle(msg)")
                    a-tag(size="small" :color="methodColor(msg.sip_method)") {{ msg.sip_method || '-' }}
      a-modal(v-model:visible="msgDetailVisible" :title="selectedMsg ? selectedMsg.sip_method : ''" :width="700" :footer="false")
        template(#default)
          div(v-if="selectedMsg")
            a-descriptions(:column="2" size="small" style="margin-bottom:12px")
              a-descriptions-item(:label="$t('sip.from')") {{ selectedMsg.src_ip }}:{{ selectedMsg.src_port }}
              a-descriptions-item(:label="$t('sip.to')") {{ selectedMsg.dst_ip }}:{{ selectedMsg.dst_port }}
              a-descriptions-item(:label="$t('common.time')") {{ formatMsgTime(selectedMsg.timestamp) }}
              a-descriptions-item(:label="$t('sip.size')") {{ selectedMsg.payload_size }} B
            pre.sip-payload {{ formatPayload(selectedMsg.payload) }}
      a-modal.ep-modal(v-model:visible="epDrawerVisible" unmount-on-close :title="selectedEndpoint" :width="600" :footer="false")
        template(#default)
          a-spin(style="width: 100%" :loading="epLoading")
            a-empty(v-if="!epLoading && epMessages.length === 0" :description="$t('sip.noMessages')")
            .ep-msg-list(v-if="epMessages.length > 0")
              .ep-msg-item(v-for="(msg, i) in epMessages" :key="i" :class="{ active: selectedEpMsg === i }" @click="selectedEpMsg = selectedEpMsg === i ? null : i")
                .ep-msg-header
                  span.ep-msg-time {{ formatMsgTime(msg.timestamp) }}
                  a-tag(size="small" :color="methodColor(msg.sip_method)") {{ msg.sip_method || '-' }}
                  span.ep-direction(v-if="msg.src_ip")
                    span(:class="epKey(msg.src_ip, msg.src_port) === selectedEndpoint ? 'dir-out' : 'dir-in'")
                      | {{ epKey(msg.src_ip, msg.src_port) === selectedEndpoint ? $t('sip.dirOut') : $t('sip.dirIn') }}
                .ep-msg-peer {{ epKey(msg.src_ip, msg.src_port) === selectedEndpoint ? epKey(msg.dst_ip, msg.dst_port) : epKey(msg.src_ip, msg.src_port) }}
                pre.ep-payload(v-if="selectedEpMsg === i") {{ formatPayload(msg.payload) }}
  .ctx-menu(v-if="ctxMenu.visible" :style="{ top: ctxMenu.y + 'px', left: ctxMenu.x + 'px' }" @click.stop)
    .ctx-item(@click="exportFlow(ctxMenu.flow); ctxMenu.visible = false")
      icon-download
      span {{ $t('dashboard.exportCSV') }}
</template>

<script setup lang="ts" name="SipQuery">
  /* eslint-disable no-use-before-define */
  import { ref, computed, onMounted, onUnmounted } from 'vue'
  import { useClipboard } from '@vueuse/core'
  import { Message } from '@arco-design/web-vue'
  import { useI18n } from 'vue-i18n'
  import dayjs from 'dayjs'
  import editorAPI from '@/api/editor'
  import { useAppStore } from '@/store'

  const { t } = useI18n()
  const appStore = useAppStore()

  const time = ref(30)
  const rangeTime = ref<string[]>([])

  const timeWhere = computed(() => {
    if (rangeTime.value.length === 2) {
      return `AND greptime_timestamp >= '${rangeTime.value[0]}' AND greptime_timestamp <= '${rangeTime.value[1]}'`
    }
    if (time.value) {
      return `AND greptime_timestamp >= NOW() - INTERVAL '${time.value} minutes'`
    }
    return ''
  })

  const filterCallId = ref('')
  const filterSrcIp = ref('')
  const filterDstIp = ref('')
  const methodFilter = ref<string | undefined>('')

  // 候选值缓存
  const fieldOptions = ref<Record<string, string[]>>({ call_id: [], src_ip: [], dst_ip: [] })

  async function fetchFieldOptions(field: string) {
    if (fieldOptions.value[field]?.length) return
    try {
      const db = appStore.database || 'public'
      const sql = `SELECT DISTINCT TRIM("${field}") AS val FROM hep_1 WHERE "${field}" IS NOT NULL AND TRIM("${field}") != '' AND greptime_timestamp >= NOW() - INTERVAL '30 minutes' ORDER BY val LIMIT 200`
      const result: any = await editorAPI.runSQL(sql, db)
      const rows = result.output?.[0]?.records?.rows || []
      fieldOptions.value[field] = [...new Set(rows.map((r: any[]) => r[0]).filter(Boolean))]
    } catch {
      // ignore
    }
  }

  interface SipFlow {
    call_id: string
    src_ip: string
    src_port: string
    dst_ip: string
    dst_port: string
    last_method: string
    msg_count: number
    start_time: string
  }

  const flows = ref<SipFlow[]>([])
  const flowsLoading = ref(false)
  const selectedCallId = ref('')

  async function loadFlows() {
    flowsLoading.value = true
    try {
      const db = appStore.database || 'public'
      const parts: string[] = []
      if (filterCallId.value) parts.push(`AND call_id = '${filterCallId.value.replace(/'/g, "''")}'`)
      if (filterSrcIp.value) parts.push(`AND src_ip = '${filterSrcIp.value.replace(/'/g, "''")}'`)
      if (filterDstIp.value) parts.push(`AND dst_ip = '${filterDstIp.value.replace(/'/g, "''")}'`)
      if (methodFilter.value) parts.push(`AND sip_method = '${methodFilter.value}'`)
      const filterWhere = parts.join(' ')
      const sql = `SELECT call_id, MIN(src_ip) AS src_ip, MIN(src_port) AS src_port, MIN(dst_ip) AS dst_ip, MIN(dst_port) AS dst_port, MAX(sip_method) AS last_method, COUNT(*) AS msg_count, MIN(greptime_timestamp) AS start_time FROM hep_1 WHERE call_id IS NOT NULL AND call_id != '' ${timeWhere.value} ${filterWhere} GROUP BY call_id ORDER BY start_time DESC LIMIT 200`

      const result: any = await editorAPI.runSQL(sql, db)
      const schema = result.output?.[0]?.records?.schema?.column_schemas || []
      const rows = result.output?.[0]?.records?.rows || []
      const colIdx = (name: string) => schema.findIndex((c: any) => c.name === name)

      flows.value = rows.map((row: any[]) => ({
        call_id: row[colIdx('call_id')],
        src_ip: row[colIdx('src_ip')],
        src_port: row[colIdx('src_port')],
        dst_ip: row[colIdx('dst_ip')],
        dst_port: row[colIdx('dst_port')],
        last_method: row[colIdx('last_method')],
        msg_count: row[colIdx('msg_count')],
        start_time: row[colIdx('start_time')],
      }))
    } catch {
      Message.error(t('sip.loadError'))
    } finally {
      flowsLoading.value = false
    }
  }

  interface SipMessage {
    timestamp: string
    src_ip: string
    src_port: string
    dst_ip: string
    dst_port: string
    sip_method: string
    payload: string
    payload_size: number
  }

  const epKey = (ip: string, port: string) => `${ip}:${port}`

  const epDotClass = (msg: SipMessage, ep: string) => ({
    src: epKey(msg.src_ip, msg.src_port) === ep,
    dst: epKey(msg.dst_ip, msg.dst_port) === ep,
  })

  // 每列宽度百分比
  const EP_COL_PCT = computed(() => (endpoints.value.length > 0 ? 100 / endpoints.value.length : 100))

  function epColCenter(ip: string, port: string): number {
    const i = endpoints.value.indexOf(epKey(ip, port))
    if (i < 0) return 0
    return (i + 0.5) * EP_COL_PCT.value
  }

  function arrowDirection(msg: SipMessage) {
    const srcIdx = endpoints.value.indexOf(epKey(msg.src_ip, msg.src_port))
    const dstIdx = endpoints.value.indexOf(epKey(msg.dst_ip, msg.dst_port))
    return srcIdx <= dstIdx ? 'right' : 'left'
  }

  function arrowOverlayStyle(msg: SipMessage) {
    const srcPct = epColCenter(msg.src_ip, msg.src_port)
    const dstPct = epColCenter(msg.dst_ip, msg.dst_port)
    const left = Math.min(srcPct, dstPct)
    const width = Math.abs(dstPct - srcPct) || 2
    return { left: `${left}%`, width: `${width}%` }
  }

  function methodLabelStyle(msg: SipMessage) {
    const srcPct = epColCenter(msg.src_ip, msg.src_port)
    const dstPct = epColCenter(msg.dst_ip, msg.dst_port)
    const center = (srcPct + dstPct) / 2
    return { left: `${center}%`, transform: 'translateX(-50%)' }
  }

  const messages = ref<SipMessage[]>([])
  const detailLoading = ref(false)
  const selectedMsgIdx = ref<number | null>(null)
  const selectedMsg = computed(() => (selectedMsgIdx.value !== null ? messages.value[selectedMsgIdx.value] : null))
  const msgDetailVisible = ref(false)

  const endpoints = computed(() => {
    const set = new Set<string>()
    messages.value.forEach((m) => {
      if (m.src_ip) set.add(epKey(m.src_ip, m.src_port))
      if (m.dst_ip) set.add(epKey(m.dst_ip, m.dst_port))
    })
    return Array.from(set)
  })

  async function selectFlow(flow: SipFlow) {
    // 停止之前的轮询
    if (liveTimer) {
      clearTimeout(liveTimer)
      liveTimer = null
    }
    liveRefresh.value = false
    selectedCallId.value = flow.call_id
    selectedMsgIdx.value = null
    detailLoading.value = true
    try {
      const db = appStore.database || 'public'
      const escapedId = flow.call_id.replace(/'/g, "''")
      const sql = `SELECT greptime_timestamp AS timestamp, src_ip, src_port, dst_ip, dst_port, sip_method, payload, payload_size FROM hep_1 WHERE call_id = '${escapedId}' ORDER BY greptime_timestamp ASC LIMIT 500`
      const result: any = await editorAPI.runSQL(sql, db)
      const schema = result.output?.[0]?.records?.schema?.column_schemas || []
      const rows = result.output?.[0]?.records?.rows || []
      const colIdx = (name: string) => schema.findIndex((c: any) => c.name === name)

      messages.value = rows.map((row: any[]) => ({
        timestamp: row[colIdx('timestamp')],
        src_ip: row[colIdx('src_ip')],
        src_port: row[colIdx('src_port')],
        dst_ip: row[colIdx('dst_ip')],
        dst_port: row[colIdx('dst_port')],
        sip_method: row[colIdx('sip_method')],
        payload: row[colIdx('payload')],
        payload_size: row[colIdx('payload_size')],
      }))
    } catch {
      Message.error(t('sip.loadError'))
    } finally {
      detailLoading.value = false
    }
  }

  function selectMessage(i: number) {
    selectedMsgIdx.value = i
    msgDetailVisible.value = true
  }

  // ---- 流列表实时刷新 ----
  const flowsLive = ref(false)
  let flowsTimer: ReturnType<typeof setTimeout> | null = null

  async function flowsLiveLoop() {
    await loadFlows()
    if (flowsLive.value) {
      flowsTimer = setTimeout(flowsLiveLoop, 3000)
    }
  }

  function toggleFlowsLive() {
    flowsLive.value = !flowsLive.value
    if (flowsLive.value) {
      flowsLiveLoop()
    } else if (flowsTimer) {
      clearTimeout(flowsTimer)
      flowsTimer = null
    }
  }

  // ---- 消息梯形图实时刷新 ----
  const liveRefresh = ref(false)
  let liveTimer: ReturnType<typeof setTimeout> | null = null

  async function refreshMessages() {
    if (!selectedCallId.value) return
    const db = appStore.database || 'public'
    const escapedId = selectedCallId.value.replace(/'/g, "''")
    const sql = `SELECT greptime_timestamp AS timestamp, src_ip, src_port, dst_ip, dst_port, sip_method, payload, payload_size FROM hep_1 WHERE call_id = '${escapedId}' ORDER BY greptime_timestamp ASC LIMIT 500`
    try {
      const result: any = await editorAPI.runSQL(sql, db)
      const schema = result.output?.[0]?.records?.schema?.column_schemas || []
      const rows = result.output?.[0]?.records?.rows || []
      const colIdx = (name: string) => schema.findIndex((c: any) => c.name === name)
      messages.value = rows.map((row: any[]) => ({
        timestamp: row[colIdx('timestamp')],
        src_ip: row[colIdx('src_ip')],
        src_port: row[colIdx('src_port')],
        dst_ip: row[colIdx('dst_ip')],
        dst_port: row[colIdx('dst_port')],
        sip_method: row[colIdx('sip_method')],
        payload: row[colIdx('payload')],
        payload_size: row[colIdx('payload_size')],
      }))
    } catch {
      // 静默失败
    }
    if (liveRefresh.value) {
      liveTimer = setTimeout(refreshMessages, 3000)
    }
  }

  function toggleLive() {
    liveRefresh.value = !liveRefresh.value
    if (liveRefresh.value) {
      refreshMessages()
    } else if (liveTimer) {
      clearTimeout(liveTimer)
      liveTimer = null
    }
  }

  onUnmounted(() => {
    if (liveTimer) clearTimeout(liveTimer)
    if (flowsTimer) clearTimeout(flowsTimer)
    document.removeEventListener('click', hideCtxMenu)
  })

  // ---- 端点消息抽屉 ----
  const selectedEndpoint = ref('')
  const epDrawerVisible = ref(false)
  const epMessages = ref<SipMessage[]>([])
  const epLoading = ref(false)
  const selectedEpMsg = ref<number | null>(null)

  async function selectEndpoint(ep: string) {
    selectedEndpoint.value = ep
    epDrawerVisible.value = true
    selectedEpMsg.value = null
    epMessages.value = []

    // 直接从已加载的 messages 里过滤，无需再查数据库
    const filtered = messages.value.filter(
      (m) => epKey(m.src_ip, m.src_port) === ep || epKey(m.dst_ip, m.dst_port) === ep
    )

    if (filtered.length > 0) {
      epMessages.value = filtered
      return
    }

    // messages 还没加载时降级走数据库查询
    if (!selectedCallId.value) return
    epLoading.value = true
    try {
      const db = appStore.database || 'public'
      const lastColon = ep.lastIndexOf(':')
      const ip = lastColon > 0 ? ep.slice(0, lastColon) : ep
      const port = lastColon > 0 ? ep.slice(lastColon + 1) : ''
      const escapedIp = ip.replace(/'/g, "''")
      const escapedPort = port.replace(/'/g, "''")
      const escapedCallId = selectedCallId.value.replace(/'/g, "''")
      const sql = `SELECT greptime_timestamp AS timestamp, src_ip, src_port, dst_ip, dst_port, sip_method, payload, payload_size FROM hep_1 WHERE call_id = '${escapedCallId}' AND ((src_ip = '${escapedIp}' AND src_port = '${escapedPort}') OR (dst_ip = '${escapedIp}' AND dst_port = '${escapedPort}')) ORDER BY greptime_timestamp ASC LIMIT 500`
      const result: any = await editorAPI.runSQL(sql, db)
      const schema = result.output?.[0]?.records?.schema?.column_schemas || []
      const rows = result.output?.[0]?.records?.rows || []
      const colIdx = (name: string) => schema.findIndex((c: any) => c.name === name)
      epMessages.value = rows.map((row: any[]) => ({
        timestamp: row[colIdx('timestamp')],
        src_ip: row[colIdx('src_ip')],
        src_port: row[colIdx('src_port')],
        dst_ip: row[colIdx('dst_ip')],
        dst_port: row[colIdx('dst_port')],
        sip_method: row[colIdx('sip_method')],
        payload: row[colIdx('payload')],
        payload_size: row[colIdx('payload_size')],
      }))
    } catch {
      Message.error(t('sip.loadError'))
    } finally {
      epLoading.value = false
    }
  }

  function formatPayload(payload: string): string {
    if (!payload) return ''
    return payload
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
  }

  function formatTime(ts: string) {
    if (!ts) return '-'
    const ms = Math.floor(Number(ts) / 1_000_000)
    return dayjs(ms).format('YYYY-MM-DD HH:mm:ss')
  }

  function formatMsgTime(ts: string) {
    if (!ts) return '-'
    const ms = Math.floor(Number(ts) / 1_000_000)
    return dayjs(ms).format('HH:mm:ss.SSS')
  }

  const METHOD_COLORS: Record<string, string> = {
    INVITE: 'blue',
    BYE: 'red',
    CANCEL: 'orangered',
    REGISTER: 'green',
    OPTIONS: 'gray',
    ACK: 'purple',
    PRACK: 'cyan',
    UPDATE: 'gold',
    SUBSCRIBE: 'lime',
    NOTIFY: 'pinkpurple',
  }

  function methodColor(m: string) {
    return METHOD_COLORS[m] || 'gray'
  }

  // ---- 导出 ----
  const exportingMessages = ref(false)

  async function saveWithDialog(csvData: string, defaultName: string) {
    try {
      const { default: saveFile } = await import('@/utils/save-file')
      await saveFile(csvData, defaultName)
      Message.success(t('sip.exportSuccess'))
    } catch (e: any) {
      if (e?.name !== 'AbortError') Message.error(t('sip.loadError'))
    }
  }

  async function exportFlow(flow: SipFlow) {
    try {
      const db = appStore.database || 'public'
      const escapedId = flow.call_id.replace(/'/g, "''")
      const sql = `SELECT * FROM hep_1 WHERE call_id = '${escapedId}' ORDER BY greptime_timestamp ASC`
      const { default: editorAPIModule } = await import('@/api/editor')
      const result = await editorAPIModule.runSQLWithCSV(sql)
      await saveWithDialog(result as unknown as string, `${flow.call_id}.csv`)
    } catch {
      Message.error(t('sip.loadError'))
    }
  }

  async function exportMessages() {
    if (!selectedCallId.value || !messages.value.length) return
    exportingMessages.value = true
    try {
      const db = appStore.database || 'public'
      const escapedId = selectedCallId.value.replace(/'/g, "''")
      const sql = `SELECT greptime_timestamp, src_ip, src_port, dst_ip, dst_port, sip_method, payload_size, payload FROM hep_1 WHERE call_id = '${escapedId}' ORDER BY greptime_timestamp ASC`
      const { default: editorAPIModule } = await import('@/api/editor')
      const result = await editorAPIModule.runSQLWithCSV(sql)
      await saveWithDialog(result as unknown as string, `${selectedCallId.value}.csv`)
    } catch {
      Message.error(t('sip.loadError'))
    } finally {
      exportingMessages.value = false
    }
  }

  // ---- 右键菜单 ----
  const ctxMenu = ref({ visible: false, x: 0, y: 0, flow: null as SipFlow | null })

  function onFlowContextMenu(e: MouseEvent, flow: SipFlow) {
    ctxMenu.value = { visible: true, x: e.clientX, y: e.clientY, flow }
  }

  function hideCtxMenu() {
    ctxMenu.value.visible = false
  }

  onMounted(() => document.addEventListener('click', hideCtxMenu))

  const { copy } = useClipboard()
  async function copyPayload() {
    const msg = selectedMsgIdx.value !== null ? messages.value[selectedMsgIdx.value] : null
    if (msg?.payload) {
      await copy(msg.payload)
      Message.success(t('copied'))
    }
  }

  loadFlows()
</script>

<style lang="less">
  @import '@/assets/style/new.less';

  .sip-body {
    height: calc(100vh - var(--tables-header-height) - var(--footer-height));
    overflow: hidden;
  }

  .sip-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    height: 48px;
    border-bottom: 1px solid var(--border-color);
    background: var(--card-bg-color);
    flex-shrink: 0;
  }

  .sip-title {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
  }

  .layout-content {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sip-sider {
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;

    > .arco-layout-sider-children {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
  }

  .sider-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    font-weight: 600;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .sider-title {
    font-size: 14px;
    font-weight: 600;
  }

  .sider-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px 12px;

    > .arco-spin {
      min-width: 100%;
    }
  }

  .layout-content {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .ladder-header-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .ladder-title {
    font-size: 14px;
    font-weight: 600;
  }

  .ladder-content {
    flex: 1;
    overflow: auto;
    padding: 8px 12px;

    > .arco-spin {
      min-width: 100%;
    }
  }

  .ladder-header {
    display: flex;
    align-items: flex-end;
    position: sticky;
    top: 0;
    min-width: max-content;
    background: var(--main-bg-color);
    z-index: 2;
    border-bottom: 2px solid var(--border-color);
    margin-bottom: 4px;
    padding-bottom: 4px;
  }

  .header-time-col {
    width: 90px;
    flex-shrink: 0;
  }

  .header-endpoints {
    flex: 1;
    display: flex;
  }

  .ladder-endpoint {
    flex: 1;
    text-align: center;
    min-width: 80px;
    padding-bottom: 6px;
    cursor: pointer;
    transition: all 0.15s;

    &:hover .ep-label,
    &.ep-active .ep-label {
      background: var(--brand-color);
      color: #fff;
      border-color: var(--brand-color);
    }

    .ep-label {
      font-size: 11px;
      font-weight: 600;
      background: var(--brand-color-1);
      border: 1px solid var(--brand-color);
      border-radius: 4px;
      padding: 2px 8px;
      display: inline-block;
      color: var(--brand-color);
      white-space: nowrap;
    }

    .ep-vline {
      width: 2px;
      height: 8px;
      background: var(--border-color);
      margin: 4px auto 0;
    }
  }

  .ladder-body {
    display: flex;
    flex-direction: column;
    min-width: max-content;
  }

  .message-row {
    display: flex;
    align-items: center;
    padding: 1px 0;
    cursor: pointer;
    border-radius: 3px;
    min-height: 32px;
    min-width: max-content;

    &:hover {
      background: var(--list-hover-color);
    }
    &.selected {
      background: var(--brand-color-1);
    }
  }

  .row-time {
    font-size: 11px;
    color: var(--small-font-color);
    width: 90px;
    flex-shrink: 0;
    font-family: monospace;
    padding-left: 2px;
  }

  .row-arrow-area {
    flex: 1;
    position: relative;
    height: 32px;
    display: flex;
    align-items: center;
    min-width: 400px;
  }

  .vline {
    flex: 1;
    height: 100%;
    position: relative;
    min-width: 80px;

    &::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 0;
      bottom: 0;
      width: 1px;
      background: var(--border-color);
      opacity: 0.5;
    }
  }

  .arrow-overlay {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    height: 16px;
    pointer-events: none;

    .arrow-body {
      position: absolute;
      top: 50%;
      left: 0;
      right: 8px;
      height: 2px;
      background: var(--brand-color);
      transform: translateY(-50%);
    }

    .arrow-head {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);

      &.right {
        right: 0;
        border-top: 5px solid transparent;
        border-bottom: 5px solid transparent;
        border-left: 8px solid var(--brand-color);
      }

      &.left {
        left: 0;
        border-top: 5px solid transparent;
        border-bottom: 5px solid transparent;
        border-right: 8px solid var(--brand-color);

        & + .arrow-body {
          left: 8px;
          right: 0;
        }
      }
    }
  }

  .method-label {
    position: absolute;
    top: -1px;
    pointer-events: none;
    white-space: nowrap;
  }

  .flow-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .flow-item {
    padding: 7px 10px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: var(--list-hover-color);
      border-color: var(--brand-color);
    }
    &.active {
      background: var(--brand-color-1);
      border-color: var(--brand-color);
    }
  }

  .flow-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 3px;
  }

  .call-id {
    font-size: 12px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 190px;
  }

  .flow-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--small-font-color);
    margin-bottom: 2px;
  }

  .arrow {
    color: var(--brand-color);
    font-weight: bold;
  }

  .flow-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    color: var(--small-font-color);

    .time-group {
      display: flex;
      align-items: center;
      gap: 2px;
    }
  }

  .call-id-badge {
    font-size: 11px;
    color: var(--small-font-color);
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sip-payload {
    font-family: 'Fira Mono', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--main-font-color);
    margin: 0;
    background: var(--code-bg, #f5f5f5);
    padding: 10px;
    border-radius: 4px;
  }

  .ep-modal {
    .arco-modal-body {
      max-height: 65vh;
      overflow-y: auto;
      padding: 16px;
    }
  }

  .ep-msg-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ep-msg-item {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 8px 10px;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: var(--list-hover-color);
    }
    &.active {
      background: var(--brand-color-1);
      border-color: var(--brand-color);
    }
  }

  .ep-msg-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 3px;
  }

  .ep-msg-time,
  .ep-msg-peer {
    font-size: 11px;
    font-family: monospace;
    color: var(--small-font-color);
  }

  .ep-msg-peer {
    margin-bottom: 4px;
  }
  .ep-direction {
    font-size: 11px;
    margin-left: auto;
  }
  .dir-out {
    color: var(--brand-color);
    font-weight: 600;
  }
  .dir-in {
    color: rgb(var(--success-6));
    font-weight: 600;
  }

  .ep-payload {
    font-family: 'Fira Mono', 'Consolas', monospace;
    font-size: 11px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--main-font-color);
    margin: 6px 0 0;
    background: var(--code-bg, #f5f5f5);
    padding: 8px;
    border-radius: 3px;
  }

  .export-btn {
    opacity: 0;
    transition: opacity 0.15s;
    padding: 0 2px;
  }

  .flow-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .flow-item:hover .export-btn {
    opacity: 1;
  }

  .ctx-menu {
    position: fixed;
    z-index: 9999;
    background: var(--color-bg-popup);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 140px;
    padding: 4px 0;

    .ctx-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      font-size: 13px;
      cursor: pointer;
      color: var(--main-font-color);

      svg {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
      }

      &:hover {
        background: var(--list-hover-color);
      }
    }
  }
</style>
