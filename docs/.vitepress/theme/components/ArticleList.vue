<script setup lang="ts">
import { computed } from 'vue'
import { data as allArticles, type Article } from '../../data/articles.data.mts'

const props = withDefaults(
  defineProps<{
    section?: Article['section']
    limit?: number
  }>(),
  { limit: Number.POSITIVE_INFINITY },
)

const articles = computed(() =>
  allArticles
    .filter((article) => !props.section || article.section === props.section)
    .slice(0, props.limit),
)

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date))
</script>

<template>
  <div v-if="articles.length" class="article-list">
    <a v-for="article in articles" :key="article.url" class="article-row" :href="article.url">
      <time class="article-row__date" :datetime="article.updated">{{ formatDate(article.updated) }}</time>
      <span class="article-row__body">
        <strong class="article-row__title">{{ article.title }}</strong>
        <span class="article-row__description">{{ article.description }}</span>
        <span class="article-row__tags">
          <span v-if="article.author">作者：{{ article.author }}</span>
          <span v-for="tag in article.tags" :key="tag">#{{ tag }}</span>
        </span>
      </span>
    </a>
  </div>
  <p v-else class="catalog-empty">这个分类还没有文章。</p>
</template>
