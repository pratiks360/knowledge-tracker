import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatRole } from '@/types/db'

/**
 * One chat bubble, shared by the topic chat and the dashboard coach.
 *
 * Assistant replies are Markdown (the models emit headings, bold, and lists
 * freely), so they render through ReactMarkdown. User messages are shown
 * verbatim — someone typing `**` means the asterisks, and pasted code or logs
 * shouldn't be reinterpreted as formatting.
 */
export function ChatMessage({
  role,
  content,
  children,
}: {
  role: ChatRole
  content: string
  /** Actions rendered under an assistant bubble, e.g. "Save as resource". */
  children?: React.ReactNode
}) {
  const isUser = role === 'user'
  return (
    <div className={isUser ? 'flex flex-col items-end' : 'flex flex-col items-start'}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-left text-sm ${
          isUser ? 'bg-accent text-bg' : 'bg-surface-2 text-text'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1.5 prose-pre:my-2 prose-ul:my-2 prose-ol:my-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}
