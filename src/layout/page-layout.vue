<template lang="pug">
router-view(v-slot="{ Component }")
  transition(name="fade" mode="out-in" appear)
    component(v-if="route.meta.ignoreCache" :is="Component" :database="appStore.database")
    keep-alive(v-else)
      component(:is="Component" :database="appStore.database")
</template>

<script lang="ts" setup name="PageLayout">
  const route = useRoute()
  const appStore = useAppStore()
</script>

<style scoped lang="less"></style>
