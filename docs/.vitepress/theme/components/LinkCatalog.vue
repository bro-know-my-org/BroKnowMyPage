<script setup lang="ts">
import { linkGroups } from '../../data/links'
import './links.css'

function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href)
}
</script>

<template>
  <div class="link-catalog">
    <section v-for="group in linkGroups" :key="group.title" class="link-group">
      <h2>{{ group.title }}</h2>

      <div class="link-group__items">
        <article v-for="item in group.items" :key="item.title" class="link-entry">
          <div class="link-entry__body">
            <h3>{{ item.title }}</h3>
            <p>{{ item.description }}</p>
            <ul v-if="item.details?.length">
              <li v-for="detail in item.details" :key="detail">{{ detail }}</li>
            </ul>
          </div>

          <div class="link-entry__actions">
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
  </div>
</template>
