<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

const { frontmatter } = useData()
const author = computed(() =>
  typeof frontmatter.value.author === 'string' ? frontmatter.value.author.trim() : '',
)
</script>

<template>
  <p v-if="author && frontmatter.listed !== false" class="article-author">作者：{{ author }}</p>
</template>

<style scoped>
.article-author {
  margin: 0 0 16px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  overflow-wrap: anywhere;
}
</style>
