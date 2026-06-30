import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, List, ListOrdered } from 'lucide-react'
import type * as React from 'react'
import { cn } from '../../lib/utils'

export interface RichTextEditorProps {
  content?: string
  onChange?: (html: string) => void
  placeholder?: string
  className?: string
}

export function RichTextEditor({
  content = '',
  onChange,
  placeholder = 'Write something…',
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        strike: false,
      }),
    ],
    content,
    onUpdate({ editor }) {
      onChange?.(editor.getHTML())
    },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'rich-text-prose focus:outline-none',
        'data-placeholder': placeholder,
      },
    },
  })

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] focus-within:ring-2 focus-within:ring-[var(--color-border-focus)]',
        className
      )}
    >
      <div className="flex items-center gap-0.5 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-2 py-1.5">
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBold().run()}
          isActive={editor?.isActive('bold') ?? false}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          isActive={editor?.isActive('italic') ?? false}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1.5 h-4 w-px bg-[var(--color-border)]" />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          isActive={editor?.isActive('bulletList') ?? false}
          title="Bullet list"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          isActive={editor?.isActive('orderedList') ?? false}
          title="Ordered list"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent
        editor={editor}
        className="min-h-[8rem] px-4 py-3 text-[var(--color-text-primary)]"
      />
    </div>
  )
}

function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
}: {
  onClick: () => void
  isActive: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded p-1.5 transition-colors',
        isActive
          ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]'
      )}
    >
      {children}
    </button>
  )
}
