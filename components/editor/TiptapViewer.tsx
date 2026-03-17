'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';

interface TiptapViewerProps {
  content: string;
}

export function TiptapViewer({ content }: TiptapViewerProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: false, inline: false }),
      Link.configure({ openOnClick: true }),
    ],
    content: content ? JSON.parse(content) : undefined,
    editable: false,
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none',
      },
    },
  });

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}
