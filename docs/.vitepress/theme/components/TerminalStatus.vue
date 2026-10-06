<script setup lang="ts">
import { computed } from 'vue'
import { useData, useRoute } from 'vitepress'

const route = useRoute()
const { page } = useData()
const failed = computed(() => page.value.isNotFound || page.value.relativePath === '404.md')
const windows = [
  { label: '0:home', href: '/' },
  { label: '1:blog', href: '/blog/' },
  { label: '2:docs', href: '/docs/' },
]
const active = computed(() => windows.find((item) => item.href !== '/' && route.path.startsWith(item.href))?.href
  || (route.path === '/' ? '/' : ''))
</script>

<template>
  <nav class="terminal-status" aria-label="终端会话状态">
    <span class="terminal-status__session">[bkmpg]</span>
    <a v-for="item in windows" :key="item.href" :href="item.href" :aria-current="active === item.href ? 'page' : undefined">
      {{ item.label }}{{ active === item.href ? '*' : '' }}
    </a>
    <span class="terminal-status__path">{{ route.path }}</span>
    <span class="terminal-status__exit" :class="failed ? 'terminal-error' : 'terminal-ok'">{{ failed ? '[1] ERR' : '[0] OK' }}</span>
  </nav>
</template>
