import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MermaidBlock } from '@/components/MermaidBlock'

const components: Components = {
  code({ className, children, ...props }) {
    if (/language-mermaid/.test(className ?? '')) {
      return <MermaidBlock code={String(children).replace(/\n$/, '')} />
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  },
}

/** ReactMarkdown + GFM, with ```mermaid fenced blocks rendered as diagrams. */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  )
}
