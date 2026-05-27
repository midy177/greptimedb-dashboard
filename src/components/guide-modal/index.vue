<template lang="pug">
a-modal.guide-modal(
  v-model:visible="guideModalVisible"
  :mask-closable="false"
  :ok-text="$t('guide.confirm')"
  :hide-cancel="true"
  :closable="false"
  :width="384"
  @ok="handleOk"
)
  template(#title)
    div {{ $t('guide.welcome') }}
    svg.guide-banner
      use(href="#banner")
  a-form(layout="vertical" :model="settingsForm")
    a-form-item(:label="$t('settings.host')" :label-attrs="{ for: 'guide-host' }")
      a-input(v-model="settingsForm.host" :input-attrs="{ id: 'guide-host', name: 'host' }")
    a-form-item(:label="$t('settings.database')")
      a-input(
        v-if="role !== 'admin'"
        v-model="settingsForm.database"
        :input-attrs="{ id: 'guide-database', name: 'database' }"
      )
      a-select(v-else v-model="settingsForm.database" allow-create)
        a-option(
          v-for="item of settingsForm.databaseList"
          :key="item"
          :value="item"
          :label="item"
        )
    a-form-item(:label="$t('settings.username')" :label-attrs="{ for: 'guide-username' }")
      a-input(
        v-model="settingsForm.username"
        :input-attrs="{ id: 'guide-username', name: 'username', autocomplete: 'username' }"
      )
    a-form-item(:label="$t('settings.password')" :label-attrs="{ for: 'guide-password' }")
      a-input-password(
        v-model="settingsForm.password"
        autocomplete="off"
        :input-attrs="{ id: 'guide-password', name: 'password' }"
      )

  template(#footer)
</template>

<script lang="ts" setup name="GuideModal">
  import { useAppStore } from '@/store'

  const { username, password, host, database, databaseList, guideModalVisible } = storeToRefs(useAppStore())
  const { role } = storeToRefs(useUserStore())

  const { validateAndSaveConnection } = useAppStore()
  const { checkTables } = useDataBaseStore()

  const settingsForm = ref({
    username: username.value,
    password: password.value,
    host: host.value,
    databaseList,
    database: database.value,
  })

  const handleOk = async () => {
    const res = await validateAndSaveConnection(settingsForm.value)
    if (res) {
      checkTables()
    }
  }
</script>
