<script setup lang="ts">
import { computed, ref } from 'vue'
import { data as articles } from '../../data/articles.data.mts'

const selected = ref('全部')
const tags = computed(() => {
  const names = Array.from(new Set(articles.flatMap((article) => article.tags)))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))

  return [
    { name: '全部', count: articles.length },
    ...names.map((name) => ({
      name,
      count: articles.filter((article) => article.tags.includes(name)).length,
    })),
  ]
})
const visibleArticles = computed(() =>
  selected.value === '全部' ? articles : articles.filter((article) => article.tags.includes(selected.value)),
)

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date))
</script>

<template>
  <div class="tag-filter" aria-label="按标签筛选">
    <button
      v-for="tag in tags"
      :key="tag.name"
      type="button"
      :class="{ active: selected === tag.name }"
      :aria-pressed="selected === tag.name"
      @click="selected = tag.name"
    >
      {{ tag.name }} <span>{{ tag.count }}</span>
    </button>
  </div>
  <ul class="tag-results">
    <li v-for="article in visibleArticles" :key="article.url">
      <a :href="article.url">
        <strong>{{ article.title }}</strong>
        <span><template v-if="article.author">作者：{{ article.author }} · </template>{{ article.section }} · {{ formatDate(article.updated) }}</span>
      </a>
    </li>
  </ul>
</template>
