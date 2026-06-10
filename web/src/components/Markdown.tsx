import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Renders GitHub-flavored markdown. Element styling lives in the `.md` class
// (index.css) so it themes with the rest of the app.
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`md ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
