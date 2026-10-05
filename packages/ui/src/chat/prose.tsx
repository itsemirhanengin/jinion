import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const plugins = [remarkGfm];

/** The agent's markdown. Raw HTML in it stays text, so what a model writes can't run in the app. */
export function Prose({ text }: { text: string }) {
  return (
    <div className="prose">
      <Markdown remarkPlugins={plugins}>{text}</Markdown>
    </div>
  );
}
