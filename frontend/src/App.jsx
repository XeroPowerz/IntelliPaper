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
              span.textContent = text;
              span.className =
                'ghost-suggestion opacity-0 text-gray-400 select-none pointer-events-none transition-opacity duration-300';
              requestAnimationFrame(() => {
                span.style.opacity = '0.5';
              });
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

  const [showSlash, setShowSlash] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);

  const slashCommands = [
    { label: 'Summarize', value: 'summarize' },
    { label: 'Expand', value: 'expand' },
    { label: 'Rewrite', value: 'rewrite' },
  ];

  const editor = useEditor({
    extensions: [StarterKit, Ghost],
    content: '',
  });

  const PAGE_HEIGHT = 1056; // ~11in @96dpi
  const PAGE_GAP = 32;
  const [pageCount, setPageCount] = useState(1);
  const editorContainerRef = useRef(null);

  useEffect(() => {
    if (!editorContainerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const height = entries[0].contentRect.height;
      setPageCount(Math.max(1, Math.ceil(height / PAGE_HEIGHT)));
    });
    observer.observe(editorContainerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!editor) return;

    const clearGhost = () => {
      const el = document.querySelector('.ghost-suggestion');
      if (el) {
        el.style.opacity = '0';
        setTimeout(() => {
          setGhost('');
          ghostRef.current = '';
          editor.commands.setGhost('');
        }, 200);
      } else {
        setGhost('');
        ghostRef.current = '';
        editor.commands.setGhost('');
      }
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
            setShowSlash(false);
            return true;
          }
          if (event.key === '/' && !showSlash) {
            setShowSlash(true);
            setSlashIndex(0);
            return false;
          }
          if (showSlash) {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setSlashIndex((slashIndex + 1) % slashCommands.length);
              return true;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setSlashIndex(
                (slashIndex - 1 + slashCommands.length) % slashCommands.length
              );
              return true;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              const cmd = slashCommands[slashIndex].value;
              editor.commands.insertContent(`/${cmd} `);
              setShowSlash(false);
              return true;
            }
            if (event.key === ' ' || event.key === 'Backspace') {
              setShowSlash(false);
            }
          }
          if (event.key === 'Enter') {
            const { from } = editor.state.selection;
            const start = Math.max(0, from - 50);
            const textBefore = editor.state.doc.textBetween(start, from, '\n');
            const match = textBefore.match(/\/(summarize|expand|rewrite)$/);
            if (match) {
              event.preventDefault();
              editor.commands.deleteRange({
                from: from - match[0].length,
                to: from,
              });
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
  }, [editor, slashIndex, showSlash]);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <input
          className="w-full max-w-md bg-transparent text-lg font-semibold text-gray-800 placeholder-gray-400 focus:outline-none"
          placeholder="Untitled Document"
        />
        <button className="ml-4 rounded px-2 py-1 text-gray-500 hover:text-gray-700">•••</button>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1 overflow-y-auto bg-gray-200">
          <div
            className="relative mx-auto py-8"
            style={{ height: pageCount * (PAGE_HEIGHT + PAGE_GAP) }}
          >
            {Array.from({ length: pageCount }).map((_, i) => (
              <div
                key={i}
                className={`pointer-events-none absolute left-1/2 -translate-x-1/2 w-[816px] h-[1056px] rounded-sm bg-white shadow-md ${
                  ghost && i === pageCount - 1 ? 'ai-glow' : ''
                }`}
                style={{ top: i * (PAGE_HEIGHT + PAGE_GAP) }}
              />
            ))}
            <div
              ref={editorContainerRef}
              className="relative z-10 mx-auto w-[816px] min-h-[1056px] p-10 transition-all"
            >
              <EditorContent
                editor={editor}
                className="prose prose-lg max-w-none focus:outline-none"
              />
              {showSlash && (
                <div className="absolute left-4 top-4 z-10 w-48 overflow-hidden rounded-md border bg-white shadow-lg">
                  {slashCommands.map((cmd, i) => (
                    <div
                      key={cmd.value}
                      className={`cursor-pointer px-4 py-2 text-sm ${
                        i === slashIndex ? 'bg-gray-100' : ''
                      }`}
                    >
                      {cmd.label}
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-8 text-sm text-gray-500">
                Type freely. Use /summarize, /expand, or /rewrite and press Enter.
                Tab accepts suggestions.
              </p>
            </div>
          </div>
        </div>
        <aside className="hidden w-64 flex-shrink-0 border-l bg-white p-6 md:block">
          <h2 className="mb-4 text-sm font-semibold text-gray-600">AI Insights</h2>
          <p className="text-sm text-gray-500">
            Deeper AI insights will appear here.
          </p>
        </aside>
      </div>
    </div>
  );
}

