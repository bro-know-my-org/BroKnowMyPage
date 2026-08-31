export interface LinkAction {
  label: string
  href: string
}

export interface LinkItem {
  title: string
  description: string
  details?: string[]
  actions: LinkAction[]
  featured?: boolean
}

export interface LinkGroup {
  title: string
  items: LinkItem[]
}

export const linkGroups: LinkGroup[] = [
  {
    title: '我的服务',
    items: [
      {
        title: '假发的 MC 服务器',
        description: '字面意思，MC 服务器。来玩。',
        details: ['服务器地址：hello-happy.world', 'QQ 群：616117943'],
        featured: true,
        actions: [
          { label: '加入 QQ 群', href: 'https://qm.qq.com/q/tqTDrmU7wA' },
        ],
      },
      {
        title: '假发的中转站',
        description: '自用，不开放，纯馋人。',
        featured: true,
        actions: [
          { label: '查看 Codex 配置', href: '/blog/tools/codex-custom-api-provider' },
        ],
      },
    ],
  },
  {
    title: '外部站点',
    items: [
      {
        title: 'CPU-Z 单线程榜单',
        description: 'CPU-Z Validator 维护的公开跑分榜。需要魔法。',
        actions: [
          { label: '查看榜单', href: 'https://valid.x86.fr/bench/1' },
        ],
      },
    ],
  },
]
