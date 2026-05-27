<template lang="pug">
.fixed-settings(v-if="false" @click="setVisible")
  a-button(type="primary")
    template(#icon)
      icon-settings
a-drawer.settings-drawer(
  v-model:visible="globalSettings"
  unmount-on-close
  placement="left"
  :width="323"
  :mask-closable="true"
  :footer="false"
  :drawer-style="{ bottom: MARGIN_BOTTOM }"
)
  //- Profile selector
  .profile-bar
    a-select.profile-select(
      v-model="selectedProfileId"
      :placeholder="$t('settings.profilePlaceholder')"
      @change="onProfileChange"
    )
      a-option(
        v-for="p of connectionProfiles"
        :key="p.id"
        :value="p.id"
        :label="p.name"
      )
    a-tooltip(mini :content="$t('settings.addProfile')")
      a-button(type="text" size="small" @click="showAddModal = true")
        template(#icon)
          icon-plus
    a-tooltip(mini :content="$t('settings.deleteProfile')")
      a-button(
        type="text"
        size="small"
        status="danger"
        :disabled="!selectedProfileId || connectionProfiles.length <= 1"
        @click="onDeleteProfile"
      )
        template(#icon)
          icon-delete

  a-form(layout="vertical" :model="settingsForm")
    a-form-item(:label="$t('settings.host')" :label-attrs="{ for: 'settings-host' }")
      a-input(v-model="settingsForm.host" :input-attrs="{ id: 'settings-host', name: 'host' }")
    a-form-item
      template(#label)
        .label-with-button
          span {{ $t('settings.database') }}
          a-button.refresh-button(
            type="text"
            size="mini"
            :loading="databasesLoading"
            @click="refreshDatabases"
          )
            template(#icon)
              svg.icon
                use(href="#refresh")
      a-select(
        v-model="settingsForm.database"
        allow-create
        :trigger-props="{ autoFitPopupMinWidth: true }"
        :loading="databasesLoading"
      )
        a-option(
          v-for="item of settingsForm.databaseList"
          :key="item"
          :value="item"
          :label="item"
        )
    a-form-item(:label="$t('settings.username')" :label-attrs="{ for: 'settings-username' }")
      a-input(
        v-model="settingsForm.username"
        :input-attrs="{ id: 'settings-username', name: 'username', autocomplete: 'username' }"
      )
    a-form-item(:label="$t('settings.password')" :label-attrs="{ for: 'settings-password' }")
      a-input-password(
        v-model="settingsForm.password"
        autocomplete="off"
        :input-attrs="{ id: 'settings-password', name: 'password' }"
      )
    a-form-item(v-if="settingsForm.username || settingsForm.password")
      template(#label)
        a-space(:size="4")
          span {{ $t('settings.authHeader') }}
          a-tooltip(mini position="tl" :content="$t('settings.authHeaderTip')")
            svg.icon-12
              use(href="#question")
      a-select(v-model="settingsForm.authHeader")
        a-option(value="Authorization") Authorization(default)
        a-option(value="x-greptime-auth") x-greptime-auth
    a-form-item
      template(#label)
        a-space(:size="4")
          span {{ $t('settings.timezone') }}
          a-tooltip(content="Used as x-greptime-timezone HTTP header" mini position="tl")
            svg.icon-12
              use(href="#question")
      a-select(
        v-model="settingsForm.userTimezone"
        allow-search
        allow-clear
        :options="timezoneOptions"
        :trigger-props="{ autoFitPopupMinWidth: true }"
      )
      template(#extra)
        div
          | {{ $t('settings.timezoneTip1') }}
          span.bold {{ ` -07:00. ` }}
          | {{ $t('settings.timezoneTip2') }}
          span.bold {{ ` US/Pacific. ` }}
          | {{ $t('settings.timezoneTip3') }}
          a-link(icon href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones" target="_blank") {{ $t('settings.timezoneTipWiki') }}
    a-form-item.save
      a-button(
        type="primary"
        long
        :loading="loginLoading"
        @click="save()"
      ) {{ $t('settings.save') }}
      template(#extra)
        span.danger-color(v-if="loginStatus === 'fail'") {{ $t('settings.saveTip') }}
        span.success-color(v-if="loginStatus === 'success'")
          icon-check-circle
          | {{ $t('settings.saveSuccess') }}

  .update-section(v-if="isTauriEnv")
    a-divider(style="margin: 8px 0")
    .update-row
      span.version-text v{{ appVersion }}
      a-button(
        type="text"
        size="small"
        :loading="isCheckingUpdate"
        @click="checkUpdate"
      ) {{ updateButtonText }}
    .update-progress(v-if="isInstallingUpdate")
      a-progress(size="small" :percent="updateProgress" :show-text="false")

//- Add profile modal
a-modal(
  v-model:visible="showAddModal"
  :title="$t('settings.addProfile')"
  :ok-text="$t('common.create')"
  @ok="onAddProfile"
  @cancel="newProfileName = ''"
)
  a-input(
    v-model="newProfileName"
    allow-clear
    :placeholder="$t('settings.profileNamePlaceholder')"
    :input-attrs="{ name: 'profile-name' }"
    @keyup.enter="onAddProfile"
  )
</template>

<script lang="ts" setup name="GlobalSetting">
  import { useI18n } from 'vue-i18n'
  import { isTauri } from '@tauri-apps/api/core'
  import { getVersion } from '@tauri-apps/api/app'
  import { check } from '@tauri-apps/plugin-updater'
  import { relaunch } from '@tauri-apps/plugin-process'
  import { useAppStore, useDataBaseStore } from '@/store'

  const MARGIN_BOTTOM = `${38 * 2 + 8}px`
  const { t } = useI18n()

  const appStore = useAppStore()
  const { checkTables } = useDataBaseStore()

  const {
    globalSettings,
    host,
    database,
    username,
    password,
    databaseList,
    userTimezone,
    authHeader,
    connectionProfiles,
    activeProfileId,
  } = storeToRefs(appStore)

  const loginStatus = ref('')
  const loginLoading = ref(false)
  const databasesLoading = ref(false)
  const showAddModal = ref(false)
  const newProfileName = ref('')
  const selectedProfileId = ref(activeProfileId.value)

  const settingsForm = ref({
    username: username.value,
    password: password.value,
    host: host.value,
    databaseList,
    database: database.value,
    userTimezone: userTimezone.value,
    authHeader: authHeader.value,
  })

  const onProfileChange = (id: string) => {
    appStore.switchProfile(id)
    settingsForm.value = {
      username: username.value,
      password: password.value,
      host: host.value,
      databaseList: databaseList.value,
      database: database.value,
      userTimezone: userTimezone.value,
      authHeader: authHeader.value || 'Authorization',
    }
    loginStatus.value = ''
  }

  const onAddProfile = () => {
    const name = newProfileName.value.trim()
    if (!name) return
    const profile = appStore.addProfile(name, settingsForm.value)
    selectedProfileId.value = profile.id
    appStore.switchProfile(profile.id)
    newProfileName.value = ''
    showAddModal.value = false
  }

  const onDeleteProfile = () => {
    if (!selectedProfileId.value) return
    appStore.deleteProfile(selectedProfileId.value)
    selectedProfileId.value = connectionProfiles.value[0]?.id ?? ''
    if (selectedProfileId.value) appStore.switchProfile(selectedProfileId.value)
  }

  const save = async () => {
    const tz = settingsForm.value.userTimezone?.trim() || ''
    settingsForm.value.userTimezone = tz

    loginLoading.value = true
    const res = await appStore.validateAndSaveConnection(settingsForm.value)
    if (res) {
      loginStatus.value = 'success'

      // keep profile name/id in sync after saving
      if (selectedProfileId.value) {
        const profile = connectionProfiles.value.find((p) => p.id === selectedProfileId.value)
        if (profile) appStore.saveProfile({ ...profile, ...settingsForm.value })
      }

      await appStore.refreshDatabaseList()
      settingsForm.value.databaseList = databaseList.value
      settingsForm.value.database = database.value
      checkTables()

      setTimeout(() => {
        appStore.closeGlobalSettings()
      }, 3000)
    } else {
      loginStatus.value = 'fail'
    }
    loginLoading.value = false
  }

  const setVisible = () => {
    appStore.openGlobalSettings()
  }

  const timezoneOptions = computed(() => {
    const opts: { label: string; value: string }[] = [{ label: 'UTC', value: 'UTC' }]
    for (let h = -12; h <= 14; h += 1) {
      if (h !== 0) {
        const sign = h > 0 ? '+' : '-'
        const abs = Math.abs(h)
        const label = `UTC${sign}${abs}`
        const value = `${sign}${abs.toString().padStart(2, '0')}:00`
        opts.push({ label, value })
      }
    }
    return opts
  })

  watch(globalSettings, () => {
    if (globalSettings.value) {
      selectedProfileId.value = activeProfileId.value
      settingsForm.value = {
        username: username.value,
        password: password.value,
        host: host.value,
        databaseList: databaseList.value,
        database: database.value,
        userTimezone: userTimezone.value,
        authHeader: authHeader.value || 'Authorization',
      }
      loginStatus.value = ''
    }
  })

  onMounted(async () => {
    await appStore.ensureConnectionHost()

    // migrate existing single config into default profile if no profiles yet
    if (connectionProfiles.value.length === 0) {
      const profile = appStore.addProfile(t('settings.defaultProfile'))
      selectedProfileId.value = profile.id
      appStore.switchProfile(profile.id)
    } else if (!selectedProfileId.value) {
      selectedProfileId.value = connectionProfiles.value[0].id
      appStore.switchProfile(selectedProfileId.value)
    }

    const res = await appStore.refreshDatabaseList()
    settingsForm.value.databaseList = databaseList.value
    settingsForm.value.database = database.value

    if (res) {
      const loginSuccess = await appStore.validateAndSaveConnection()
      if (loginSuccess) {
        loginStatus.value = 'success'
        checkTables()
      } else {
        loginStatus.value = 'fail'
      }
    }
  })

  const refreshDatabases = async () => {
    databasesLoading.value = true
    try {
      await appStore.refreshDatabaseList(settingsForm.value.host)
      settingsForm.value.databaseList = databaseList.value
      settingsForm.value.database = database.value
    } finally {
      databasesLoading.value = false
    }
  }

  const isTauriEnv = isTauri()
  const appVersion = ref('')
  const isCheckingUpdate = ref(false)
  const isInstallingUpdate = ref(false)
  const updateProgress = ref(0)
  const pendingUpdate = shallowRef<Awaited<ReturnType<typeof check>>>(null)
  const updateStatus = ref<'idle' | 'available' | 'none'>('idle')

  const updateButtonText = computed(() => {
    if (isInstallingUpdate.value) return t('settings.installing')
    if (updateStatus.value === 'available' && pendingUpdate.value)
      return t('settings.updateAvailable', { version: pendingUpdate.value.version })
    if (updateStatus.value === 'none') return t('settings.upToDate')
    return t('settings.checkUpdate')
  })

  if (isTauriEnv) {
    getVersion().then((v) => {
      appVersion.value = v
    })
  }

  const checkUpdate = async () => {
    if (pendingUpdate.value) {
      isInstallingUpdate.value = true
      updateProgress.value = 0
      let totalSize = 0
      let downloaded = 0
      try {
        await pendingUpdate.value.downloadAndInstall((e) => {
          if (e.event === 'Started') totalSize = e.data.contentLength ?? 0
          if (e.event === 'Progress') {
            downloaded += e.data.chunkLength
            if (totalSize) updateProgress.value = Math.round((downloaded / totalSize) * 100)
          }
        })
        await relaunch()
      } catch (e) {
        console.error(e)
      } finally {
        isInstallingUpdate.value = false
      }
      return
    }
    isCheckingUpdate.value = true
    try {
      const update = await check()
      if (update) {
        pendingUpdate.value = update
        updateStatus.value = 'available'
      } else {
        updateStatus.value = 'none'
      }
    } catch (e) {
      console.error(e)
    } finally {
      isCheckingUpdate.value = false
    }
  }
</script>

<style scoped lang="less">
  .fixed-settings {
    position: fixed;
    top: 280px;
    right: 0;

    svg {
      font-size: 18px;
      vertical-align: -4px;
    }
  }

  .profile-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 12px;

    .profile-select {
      flex: 1;
    }
  }

  .label-with-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;

    .refresh-button {
      margin-left: 4px;
      padding: 0;
      font-size: 14px;
    }
  }

  .update-section {
    .update-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .version-text {
      font-size: 12px;
      color: var(--small-font-color);
    }
    .update-progress {
      margin-top: 6px;
    }
  }
</style>

<style lang="less">
  .settings-drawer {
    .arco-drawer {
      height: auto;
      margin-left: 18px;
      border-radius: 4px;
      box-shadow: 0 4px 10px 0 var(--border-color);
      border: 1px solid var(--border-color);
      .arco-form-item-label-col {
        margin-bottom: 5px;
        > .arco-form-item-label {
          color: var(--main-font-color);
          font-size: 13px;
          opacity: 1;
        }
      }
      .arco-form-item {
        margin-bottom: 10px;
        &.save {
          .arco-form-item-extra {
            font-size: 12px;
          }
        }
      }
      .arco-drawer-header {
        display: none;
      }

      .arco-drawer-body {
        padding: 16px 16px 10px 16px;
      }
    }
    .bold {
      font-weight: 600;
    }
    .arco-form-item-extra {
      font-size: 11px;
    }
    .arco-link {
      margin-left: 2px;
      color: var(--brand-color);
      font-size: 11px;
      padding: 0 2px;
      .arco-link-icon {
        font-size: 11px;
        margin-right: 1px;
      }
    }
  }
</style>
