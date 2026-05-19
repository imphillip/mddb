export type ModelNewsFeed = {
  generatedAt: string
  source: string
  items: ModelNewsItem[]
}

export type ModelNewsItem = {
  id: string
  title: string
  title_en?: string | null
  url: string
  source: string
  publishedAt?: string | null
  summary?: string | null
  category?: string | null
  tags: {
    providers: string[]
    models: string[]
  }
  tagLabels?: {
    providers?: string[]
    models?: string[]
  }
  providerRoutes?: Record<string, string>
  modelRoutes?: Record<string, string>
}
