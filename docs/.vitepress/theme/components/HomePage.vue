<script setup lang="ts">
import { data as articles, type Article } from '../../data/articles.data.mts'
import Comments from './Comments.vue'
import HomeHero from './home/HomeHero.vue'
import HomeRecent from './home/HomeRecent.vue'
import type { HomeSection } from './home/types'
import './home/home.css'

const sectionOrder: Article['section'][] = ['博客', '教程', '文档']
const sectionMeta: Record<Article['section'], Omit<HomeSection, 'name' | 'count'>> = {
  博客: { href: '/blog/', description: '实际遇到的问题和修复过程' },
  教程: { href: '/tutorials/', description: '可以照着做的部署与配置' },
  文档: { href: '/docs/', description: '命令、配置和工具速查' },
}

const sections: HomeSection[] = sectionOrder.map((name) => ({
  name,
  count: articles.filter((article) => article.section === name).length,
  ...sectionMeta[name],
}))

const recent = articles.slice(0, 5)
</script>

<template>
  <div class="home-page">
    <HomeHero :sections="sections" />
    <HomeRecent :articles="recent" />
    <Comments />
  </div>
</template>
