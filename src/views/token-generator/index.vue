<template lang="pug">
.token-gen
  .token-gen__card
    .token-gen__header
      h2.token-gen__title Connect Token Generator
      a-button(type="text" @click="router.push('/')")
        template(#icon)
          icon-home
        | Home
    a-form(layout="vertical" :model="form")
      a-form-item(label="Host" help="Leave empty to use current origin")
        a-input(v-model="form.h" placeholder="https://your-greptimedb-host.com" allow-clear)
      a-form-item(label="Username")
        a-input(v-model="form.u" placeholder="admin" allow-clear)
      a-form-item(label="Password")
        a-input-password(v-model="form.p" placeholder="password" allow-clear)
      a-form-item(label="Database" help="Defaults to public if empty")
        a-input(v-model="form.d" placeholder="public" allow-clear)
      a-button(
        type="primary"
        long
        :loading="loading"
        @click="generate"
      ) Generate Token

    template(v-if="token")
      a-divider
      a-form-item(label="Connect URL")
        a-input-group(compact)
          a-input(v-model="connectUrl" readonly style="flex: 1")
          a-button(type="outline" @click="copy")
            template(#icon)
              icon-copy
            | {{ copied ? 'Copied' : 'Copy' }}
      a-typography-text(type="secondary" style="font-size: 12px") Token is AES-256-GCM encrypted. URL is safe to share via internal channels.
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { IconCopy, IconHome } from '@arco-design/web-vue/es/icon'
  import { encryptConnectToken } from '@/utils/connect-token'

  const router = useRouter()

  const form = ref({ h: '', u: '', p: '', d: '' })
  const token = ref('')
  const loading = ref(false)
  const copied = ref(false)

  const connectUrl = computed(() => {
    const base = `${window.location.origin}${window.location.pathname}#/connect`
    return token.value ? `${base}?token=${encodeURIComponent(token.value)}` : ''
  })

  const generate = async () => {
    loading.value = true
    const payload = Object.fromEntries(Object.entries(form.value).filter(([, v]) => v.trim() !== '')) as {
      h?: string
      u?: string
      p?: string
      d?: string
    }
    token.value = await encryptConnectToken(payload)
    loading.value = false
  }

  const copy = async () => {
    await navigator.clipboard.writeText(connectUrl.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
</script>

<style scoped lang="less">
  .token-gen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    background: var(--color-bg-1);

    &__card {
      min-width: 60%;
      padding: 32px;
      background: var(--color-bg-2);
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    }

    &__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    &__title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--color-text-1);
    }
  }
</style>
