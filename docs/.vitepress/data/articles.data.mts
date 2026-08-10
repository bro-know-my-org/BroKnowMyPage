import { createContentLoader } from 'vitepress'

export interface Article {
  title: string
  description: string
  url: string
  date: string
  updated: string
  tags: string[]
  section: '博客' | '教程' | '文档'
}

declare const data: Article[]
export { data }

export default createContentLoader('{blog,tutorials,docs}/**/*.md', {
  transform(pages): Article[] {
    return pages
      .filter(({ frontmatter }) => frontmatter.listed !== false)
      .map(({ url, frontmatter }) => ({
        title: String(frontmatter.title),
        description: String(frontmatter.description),
        url,
        date: new Date(frontmatter.date).toISOString(),
        updated: new Date(frontmatter.updated || frontmatter.date).toISOString(),
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [],
        section: (url.startsWith('/blog/') ? '博客' : url.startsWith('/tutorials/') ? '教程' : '文档') as Article['section'],
      }))
      .sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated))
  },
})
