<template lang="pug">
a-dropdown.tables(trigger="click" position="right")
  a-button.menu-button(type="text" @click="(event) => clickMenu(event, nodeData)")
    template(#icon)
      svg.icon-14.rotate-90
        use(href="#extra")
  template(#content)
    a-doption(
      v-if="!isColumn"
      click.stop
      :class="nodeData.childrenType === 'columns' && expandedKeys?.includes(nodeData.key) ? 'selected' : ''"
      @click="(event) => expandChildren(event, nodeData, 'columns')"
    )
      template(#icon)
        svg.icon
          use(href="#columns")
      | {{ $t('dashboard.columns') }}
    a-tooltip(position="right" :content="$t('dashboard.hints.details')")
      a-doption(
        v-if="!isColumn"
        :class="nodeData.childrenType === 'details' && expandedKeys?.includes(nodeData.key) ? 'selected' : ''"
        @click="(event) => expandChildren(event, nodeData, 'details')"
      )
        template(#icon)
          svg.icon
            use(href="#details")
        | {{ $t('dashboard.details') }}
    a-doption(v-if="!isColumn" click.stop)
      a-space(v-for="item of SHORTCUT_MAP['TABLE']")
        ShortCut(
          icon
          :type="item.value"
          :node="nodeData"
          :parent="nodeData.iconType ? expandedTablesTree[nodeData.parentKey] : nodeData"
          :label="'Query table'"
          :database="database"
        )
    a-doption(v-else)
      a-dropdown.quick-select(trigger="hover" position="right")
        a-space(:size="6")
          svg.icon.icon-color
            use(href="#query")
          | {{ $t('dashboard.quickSelect') }}
        template(#content)
          a-doption(v-for="item of SHORTCUT_MAP[nodeData.iconType]")
            ShortCut(
              :type="item.value"
              :node="nodeData"
              :parent="nodeData.iconType ? expandedTablesTree[nodeData.parentKey] : nodeData"
              :label="item.label"
              :database="database"
            )
    a-doption(v-if="isColumn" @click="confirmDropColumn")
      template(#icon)
        svg.icon.danger-color
          use(href="#delete")
      span.danger-color {{ $t('dashboard.dropColumn') }}
    a-tooltip(content="Copy to Clipboard" position="right")
      a-doption(@click="copy(nodeData.title)")
        template(#icon)
          svg.icon.icon-color(v-if="copied === false")
            use(href="#copy-new")
          svg.icon(v-else)
            icon-check.success-color
        | Copy name

a-modal(
  v-model:visible="dropModalVisible"
  ok-status="danger"
  :title="$t('dashboard.dropColumnTitle')"
  :ok-text="$t('common.delete')"
  :ok-loading="dropping"
  @ok="doDropColumn"
  @cancel="dropModalVisible = false"
)
  i18n-t(keypath="dashboard.dropColumnConfirm")
    template(#column)
      b {{ nodeData.title }}
    template(#table)
      b {{ parentTable?.title }}
</template>

<script lang="ts" setup name="TableMenu">
  import { useClipboard } from '@vueuse/core'
  import { Message } from '@arco-design/web-vue'
  import { useI18n } from 'vue-i18n'
  import type { OptionsType } from '@/types/global'
  import type { TableTreeParent } from '@/store/modules/database/types'
  import editorAPI from '@/api/editor'
  import { useDataBaseStore } from '@/store'

  const { t } = useI18n()

  const props = defineProps<{
    nodeData: TableTreeParent
    expandedKeys?: number[]
    expandedTablesTree?: TableTreeParent[]
    database: string
    isColumn?: boolean
  }>()
  const emits = defineEmits(['expandChildren'])
  const source = ref('')
  const { copy, copied } = useClipboard({ source })

  const dropModalVisible = ref(false)
  const dropping = ref(false)

  const parentTable = computed(() =>
    props.expandedTablesTree ? props.expandedTablesTree[props.nodeData.parentKey] : null
  )

  const expandChildren = (event: MouseEvent, nodeData: TableTreeParent, childrenType: string) => {
    event.stopPropagation()
    emits('expandChildren', event, nodeData, childrenType)
  }

  const confirmDropColumn = () => {
    dropModalVisible.value = true
  }

  const doDropColumn = async () => {
    if (!parentTable.value) return
    dropping.value = true
    try {
      const sql = `ALTER TABLE "${parentTable.value.title}" DROP COLUMN "${props.nodeData.title}"`
      await editorAPI.runSQL(sql, props.database)
      Message.success(t('dashboard.dropColumnSuccess', { column: props.nodeData.title }))
      dropModalVisible.value = false
      const { checkTables } = useDataBaseStore()
      checkTables()
    } catch (e: any) {
      Message.error(e?.message || t('dashboard.dropColumnFail'))
    } finally {
      dropping.value = false
    }
  }

  const SHORTCUT_MAP: { [key: string]: OptionsType[] } = {
    TABLE: [{ value: 'select*100', label: 'Query table' }],
    FIELD: [
      { value: 'select100', label: 'Query column' },
      {
        value: 'max',
        label: 'Query max',
      },
      {
        value: 'min',
        label: 'Query min',
      },
    ],
    TAG: [
      { value: 'count', label: 'Count by' },
      { value: 'where=', label: 'Filter by' },
    ],
    TIMESTAMP: [
      { value: 'select*100', label: 'Query table' },
      {
        value: 'where<',
        label: 'Filter by',
      },
    ],
  }

  const clickMenu = (event: MouseEvent, nodeData: TableTreeParent) => {
    if (props.expandedKeys.includes(nodeData.key)) {
      event.stopPropagation()
    }
  }
</script>

<style lang="less" scoped>
  :deep(.arco-btn-text[type='button']) {
    color: var(--main-font-color);
    border-radius: 0;
    width: 100%;
    justify-content: flex-start;
  }

  .menu-button {
    display: none;
  }

  .arco-btn.arco-dropdown-open {
    display: flex;
    background: var(--list-hover-color);
  }

  .icon-14 {
    width: 14px;
    height: 14px;
  }

  :deep(.query-icon) {
    width: 14px;
    height: 14px;
  }
</style>

<style lang="less">
  .tables {
    .arco-dropdown {
      .arco-dropdown-option {
        &:not(.arco-dropdown-option-disabled, .arco-dropdown-option-has-suffix):hover {
          background-color: var(--list-hover-color);
        }
        .arco-dropdown-option-content {
          .arco-btn-text[type='button'] {
            padding: 0 16px 0 0;
            svg {
              color: var(--small-font-color);
            }
            &:hover {
              background: transparent;
            }
          }
        }
        &.arco-dropdown-option-has-suffix {
          padding: 0;
          &:hover {
            background: transparent;
          }
        }
      }
      .arco-dropdown-option.selected {
        color: var(--brand-color);
        svg {
          color: var(--brand-font-color);
        }
      }
    }
  }
</style>
