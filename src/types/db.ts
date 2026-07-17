export type NodeStatus = 'not_started' | 'learning' | 'done'
export type NodeKind = 'topic' | 'project' | 'profile_root'
export type LinkType = 'related' | 'uses' | 'prerequisite'
export type ResourceKind = 'web' | 'youtube' | 'manual'
export type ChatRole = 'user' | 'assistant'

// NOTE: these are `type` aliases, not `interface`s, on purpose. supabase-js constrains
// each table to `Record<string, unknown>`; a `type` object literal satisfies that via an
// implicit index signature, but an `interface` does not — using `interface` here makes the
// whole Database type resolve to `never` and every query loses its types.

export type NodeRow = {
  id: string
  user_id: string
  parent_id: string | null
  title: string
  description: string | null
  notes_md: string | null
  status: NodeStatus
  order_index: number
  present_visible: boolean
  present_summary: string | null
  node_kind: NodeKind
  recap_md: string | null
  details_md: string | null
  details_generated_at: string | null
  tags: string[]
  last_visited_at: string | null
  created_at: string
  updated_at: string
}

export type NodeLinkRow = {
  id: string
  user_id: string
  from_node: string
  to_node: string
  link_type: LinkType
  created_at: string
}

export type ResourceRow = {
  id: string
  user_id: string
  node_id: string
  kind: ResourceKind
  url: string | null
  title: string | null
  raw_content: string | null
  summary_md: string | null
  pinned: boolean
  created_at: string
}

/** A named coach conversation on the dashboard. Per-topic chats have no thread. */
export type ChatThreadRow = {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

// Coach messages: node_id null + thread_id set. Per-topic messages: the reverse.
export type ChatMessageRow = {
  id: string
  user_id: string
  node_id: string | null
  thread_id: string | null
  role: ChatRole
  content: string
  created_at: string
}

export type QuizQuestion = {
  q: string
  options?: string[]
  answer: string
  explanation?: string
}

export type QuizRow = {
  id: string
  user_id: string
  node_id: string
  questions: QuizQuestion[]
  last_score: number | null
  taken_at: string | null
  created_at: string
}

export type PresentationRow = {
  id: string
  user_id: string
  name: string
  created_at: string
}

export type StoryPathStepRow = {
  id: string
  user_id: string
  presentation_id: string
  node_id: string
  step_order: number
}

export type AIProvider = 'openrouter' | 'nvidia' | 'cloudflare'

export type UserSettingsRow = {
  user_id: string
  ai_provider: AIProvider
  openrouter_api_key: string | null
  selected_model: string | null
  nvidia_api_key: string | null
  nvidia_model: string | null
  // Cloudflare Workers AI: token + account id (its endpoint URL is account-scoped) + manual model id.
  cloudflare_api_key: string | null
  cloudflare_account_id: string | null
  cloudflare_model: string | null
  owner_email: string | null
  updated_at?: string
}

export type SearchResultRow = {
  kind: 'node' | 'resource'
  id: string
  node_id: string
  title: string
  snippet: string
  rank: number
}

type NoRelationships = { Relationships: [] }

// Minimal Supabase Database type — hand-maintained (no CLI codegen in this environment).
export type Database = {
  public: {
    Tables: {
      nodes: {
        Row: NodeRow
        Insert: Partial<NodeRow>
        Update: Partial<NodeRow>
      } & NoRelationships
      node_links: {
        Row: NodeLinkRow
        Insert: Partial<NodeLinkRow>
        Update: Partial<NodeLinkRow>
      } & NoRelationships
      resources: {
        Row: ResourceRow
        Insert: Partial<ResourceRow>
        Update: Partial<ResourceRow>
      } & NoRelationships
      chat_messages: {
        Row: ChatMessageRow
        Insert: Partial<ChatMessageRow>
        Update: Partial<ChatMessageRow>
      } & NoRelationships
      chat_threads: {
        Row: ChatThreadRow
        Insert: Partial<ChatThreadRow>
        Update: Partial<ChatThreadRow>
      } & NoRelationships
      quizzes: {
        Row: QuizRow
        Insert: Partial<QuizRow>
        Update: Partial<QuizRow>
      } & NoRelationships
      presentations: {
        Row: PresentationRow
        Insert: Partial<PresentationRow>
        Update: Partial<PresentationRow>
      } & NoRelationships
      story_path_steps: {
        Row: StoryPathStepRow
        Insert: Partial<StoryPathStepRow>
        Update: Partial<StoryPathStepRow>
      } & NoRelationships
      user_settings: {
        Row: UserSettingsRow
        Insert: Partial<UserSettingsRow>
        Update: Partial<UserSettingsRow>
      } & NoRelationships
    }
    Views: Record<string, never>
    Functions: {
      search_all: {
        Args: { search_query: string }
        Returns: SearchResultRow[]
      }
    }
    Enums: Record<string, never>
  }
}
