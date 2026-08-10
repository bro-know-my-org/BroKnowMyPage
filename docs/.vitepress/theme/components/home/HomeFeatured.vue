<script setup lang="ts">
import { linkGroups } from '../../../data/links'

const featuredLinks = linkGroups.flatMap((group) => group.items).filter((item) => item.featured)

function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href)
}
</script>

<template>
  <section v-if="featuredLinks.length" class="home-featured">
    <div class="home-section-heading">
      <h2>站点与服务</h2>
      <a href="/links">全部链接</a>
    </div>

    <div class="featured-grid">
      <article v-for="item in featuredLinks" :key="item.title" class="featured-card">
        <div class="featured-card__body">
          <h3>{{ item.title }}</h3>
          <p>{{ item.description }}</p>
          <ul v-if="item.details?.length">
            <li v-for="detail in item.details" :key="detail">{{ detail }}</li>
          </ul>
        </div>

        <div class="featured-card__actions">
          <a
            v-for="action in item.actions"
            :key="action.href"
            :href="action.href"
            :target="isExternal(action.href) ? '_blank' : undefined"
            :rel="isExternal(action.href) ? 'noreferrer' : undefined"
          >
            {{ action.label }}
          </a>
        </div>
      </article>
    </div>
  </section>
</template>
