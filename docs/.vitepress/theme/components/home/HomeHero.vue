<script setup lang="ts">
import HomeContentMap from './HomeContentMap.vue'
import type { HomeSection } from './types'

defineProps<{
  sections: HomeSection[]
}>()
</script>

<template>
  <section class="home-intro">
    <div class="home-intro__copy">
      <h1>BKMPG</h1>
      <p>假发的博客、教程和文档站点。</p>
    </div>

    <HomeContentMap :sections="sections" />
  </section>
</template>
