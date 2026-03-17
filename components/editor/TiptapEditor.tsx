'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { TiptapToolbar } from './TiptapToolbar';

interface TiptapEditorProps {
  content?: string;
  onChange?: (json: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export function TiptapEditor({
  content,
  onChange,
  placeholder = 'Write something...',
  editable = true,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: false, inline: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: content ? JSON.parse(content) : undefined,
    editable,
    onUpdate({ editor: ed }) {
      onChange?.(JSON.stringify(ed.getJSON()));
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-invert prose-sm max-w-none min-h-[120px] px-4 py-3 focus:outline-none',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="rounded-md border border-gray-600 bg-gray-800">
      {editable && <TiptapToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
