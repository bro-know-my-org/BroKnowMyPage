<script setup lang="ts">
import type { Article } from '../../../data/articles.data.mts'

defineProps<{ articles: Article[] }>()

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(date))
</script>

<template>
  <section class="home-latest">
    <div class="home-section-heading">
      <h2>最近更新</h2>
      <a href="/tags">查看标签</a>
    </div>

    <div class="recent-list">
      <a v-for="(article, index) in articles" :key="article.url" :href="article.url" class="recent-item">
        <span class="recent-item__number">{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="recent-item__main">
          <strong>{{ article.title }}</strong>
          <small>{{ article.description }}</small>
        </span>
        <span class="recent-item__meta">
          <span>{{ article.section }}</span>
          <time :datetime="article.updated">{{ formatDate(article.updated) }}</time>
        </span>
      </a>
    </div>
  </section>
</template>
