// Muted syntax colors keep technical content legible on warm surfaces in both modes.
const scopes = [
  ['comment', 'punctuation.definition.comment'],
  ['keyword', 'storage', 'constant.language'],
  ['string', 'constant.other.symbol'],
  ['constant.numeric', 'constant.character'],
  ['entity.name', 'support.function', 'variable'],
  ['punctuation', 'meta.brace'],
]

function tokenColors(colors: string[]) {
  return scopes.map((scope, index) => ({ scope, settings: { foreground: colors[index] } }))
}

export const nordicLight = {
  name: 'nordic-light',
  type: 'light' as const,
  colors: { 'editor.background': '#ede7df', 'editor.foreground': '#3d3d3d' },
  tokenColors: tokenColors(['#6c6157', '#5b4b68', '#506b5d', '#785c40', '#486579', '#645d55']),
}

export const nordicDark = {
  name: 'nordic-dark',
  type: 'dark' as const,
  colors: { 'editor.background': '#33302c', 'editor.foreground': '#e8e0d7' },
  tokenColors: tokenColors(['#c0b2a2', '#cab8d3', '#b4c9ba', '#d5b797', '#b5c9d5', '#c0b2a2']),
}
