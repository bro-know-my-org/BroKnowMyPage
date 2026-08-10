<script setup lang="ts">
import type { HomeSection } from './types'

defineProps<{ sections: HomeSection[] }>()
</script>

<template>
  <nav class="content-map" aria-label="内容分类">
    <a v-for="section in sections" :key="section.name" :href="section.href" class="content-map__item">
      <span class="content-map__body">
        <strong>{{ section.name }}</strong>
        <small>{{ section.description }}</small>
      </span>
      <span class="content-map__count">{{ section.count }} 篇</span>
    </a>
  </nav>
</template>
