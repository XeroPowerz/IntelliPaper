import React, { useRef, useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import axios from 'axios';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

const ghostKey = new PluginKey('ghost');

const Ghost = Extension.create({
  name: 'ghost',
  addCommands() {
    return {
      setGhost:
        text =>
          ({ tr, dispatch }) => {
            dispatch(tr.setMeta(ghostKey, text));
            return true;
          },
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: ghostKey,
        state: {
          init() {
            return '';
          },
          apply(tr, value) {
            const meta = tr.getMeta(ghostKey);
            return meta !== undefined ? meta : value;
          },
        },
        props: {
          decorations(state) {
            const text = ghostKey.getState(state);
            if (!text) return null;
            const pos = state.selection.to;
            const deco = Decoration.widget(pos, () => {
              const span = document.createElement('span');
              span.style.opacity = '0.5';
              span.style.pointerEvents = 'none';
              span.textContent = text;
              return span;
            });
            return DecorationSet.create(state.doc, [deco]);
          },
        },
      }),
    ];
  },
});

export default function App() {
  const [ghost, setGhost] = useState('');
  const ghostRef = useRef('');
  const timer = useRef(null);

  const editor = useEditor({
    extensions: [StarterKit, Ghost],
    content: '',
  });

  useEffect(() => {
    if (!editor) return;

    const clearGhost = () => {
      setGhost('');
      ghostRef.current = '';
      editor.commands.setGhost('');
    };

    const runSlashCommand = async cmd => {
      try {
        const res = await axios.post('http://localhost:3001/api/ai', {
          documentText: editor.getText(),
          command: cmd,
        });
        editor.commands.insertContent(res.data.suggestion);
      } catch (e) {
        console.error(e);
      }
    };

    const updateHandler = ({ editor }) => {
      const text = editor.getText();
      clearGhost();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        if (!text.trim()) return;
        try {
          const res = await axios.post('http://localhost:3001/api/ai', {
            documentText: text,
            command: 'autocomplete',
          });
          const suggestion = res.data.suggestion;
          setGhost(suggestion);
          ghostRef.current = suggestion;
          editor.commands.setGhost(suggestion);
        } catch (e) {
          console.error(e);
        }
      }, 500);
    };

    editor.on('update', updateHandler);

    editor.setOptions({
      editorProps: {
        handleKeyDown(view, event) {
          if (ghostRef.current && event.key === 'Tab') {
            event.preventDefault();
            editor.commands.insertContent(ghostRef.current);
            clearGhost();
            return true;
          }
          if (event.key === 'Escape') {
            clearGhost();
            return true;
          }
          if (event.key === 'Enter') {
            const { from } = editor.state.selection;
            const start = Math.max(0, from - 50);
            const textBefore = editor.state.doc.textBetween(start, from, '\n');
            const match = textBefore.match(/\/(summarize|expand|rewrite)$/);
            if (match) {
              event.preventDefault();
              editor.commands.deleteRange({ from: from - match[0].length, to: from });
              runSlashCommand(match[1]);
              return true;
            }
          }
          return false;
        },
      },
    });

    return () => {
      editor.off('update', updateHandler);
    };
  }, [editor]);

  return (
    <div style={{ height: '100vh', padding: '1rem' }}>
      <EditorContent editor={editor} />
      <p style={{ marginTop: '1rem', color: '#666' }}>
        Type freely. Use /summarize, /expand, or /rewrite and press Enter. Tab accepts suggestions.
      </p>
    </div>
  );
}