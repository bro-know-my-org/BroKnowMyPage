import { h, type Component } from 'vue'
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './style.css'
import './components/content.css'
import './components/comments.css'
import ArticleList from './components/ArticleList.vue'
import Comments from './components/Comments.vue'
import HomePage from './components/HomePage.vue'
import LinkCatalog from './components/LinkCatalog.vue'
import NotFound from './components/NotFound.vue'
import TagCatalog from './components/TagCatalog.vue'

export default {
  extends: DefaultTheme,
  Layout: (): Component =>
    h(DefaultTheme.Layout, null, {
      'doc-after': () => h(Comments),
      'not-found': () => h(NotFound),
    }),
  enhanceApp({ app }) {
    app.component('ArticleList', ArticleList)
    app.component('HomePage', HomePage)
    app.component('LinkCatalog', LinkCatalog)
    app.component('TagCatalog', TagCatalog)
  },
} satisfies Theme
