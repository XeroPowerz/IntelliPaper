import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import axios from 'axios';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import Collaboration from '@tiptap/extension-collaboration';
import { API_BASE_URL, WS_BASE_URL } from './apiConfig';

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
  const autocompleteController = useRef(null);

  const saveTimeout = useRef(null);
  const pendingSave = useRef(null);

  const debouncedSave = useCallback(content => {
    pendingSave.current = content;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        await axios.post(`${API_BASE_URL}/api/document`, pendingSave.current);
        pendingSave.current = null;
      } catch (err) {
        console.error(err);
      }
    }, 500);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        if (pendingSave.current) {
          axios
            .post(`${API_BASE_URL}/api/document`, pendingSave.current)
            .catch(err => console.error(err));
          pendingSave.current = null;
        }
      }
    };
  }, []);

  const [showSlash, setShowSlash] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);

  const [initialContent, setInitialContent] = useState(null);
  const ydoc = useMemo(() => new Y.Doc(), []);
  const providerRef = useRef(null);
  const reviewSocket = useRef(null);
  const [changes, setChanges] = useState([]);
  const [messages, setMessages] = useState([]);

  const [plugins, setPlugins] = useState([]);
  const [selectedPlugin, setSelectedPlugin] = useState('');
  const [selectedAction, setSelectedAction] = useState('');

  const slashCommands = [
    { label: 'Summarize', value: 'summarize' },
    { label: 'Expand', value: 'expand' },
    { label: 'Rewrite', value: 'rewrite' },
    { label: 'Tutor', value: 'tutor' },
  ];

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/document`);
        setInitialContent(res.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchDoc();
  }, []);

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/plugins`)
      .then(res => setPlugins(res.data))
      .catch(e => console.error(e));
  }, []);

  const editor = useEditor({
    extensions: [StarterKit, Ghost, Collaboration.configure({ document: ydoc })],
  });

  useEffect(() => {
    providerRef.current = new WebsocketProvider(
      WS_BASE_URL,
      'intellipaper',
      ydoc
    );
    const review = new WebSocket(`${WS_BASE_URL}/review`);
    reviewSocket.current = review;
    review.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'review') {
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: data.comment },
          ]);
        }
      } catch (e) {
        console.error(e);
      }
    };
    return () => {
      providerRef.current.destroy();
      review.close();
    };
  }, [ydoc]);

  useEffect(() => {
    if (initialContent && editor) {
      editor.commands.setContent(initialContent);
    }
  }, [initialContent, editor]);

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      setChanges(prev => [...prev, `Change ${prev.length + 1}`]);
      try {
        const text = editor.getText();
        reviewSocket.current?.send(JSON.stringify({ text }));
      } catch (e) {
        console.error(e);
      }
    };
    ydoc.on('update', handler);
    return () => ydoc.off('update', handler);
  }, [editor, ydoc]);

  const [pageHeight, setPageHeight] = useState(1056); // ~11in @96dpi
  const [pageGap, setPageGap] = useState(32);
  const [marginClass, setMarginClass] = useState('p-10');
  const [pageCount, setPageCount] = useState(1);
  const editorContainerRef = useRef(null);

  const [chatInput, setChatInput] = useState('');

  // Recalculate page count whenever the editor size or page height changes
  useEffect(() => {
    if (!editorContainerRef.current) return;
    const updatePageCount = () => {
      const height = editorContainerRef.current.offsetHeight;
      setPageCount(Math.max(1, Math.ceil(height / pageHeight)));
    };
    updatePageCount();
    const observer = new ResizeObserver(updatePageCount);
    observer.observe(editorContainerRef.current);
    return () => observer.disconnect();
  }, [pageHeight]);

  // Fetch layout hints from the backend and apply them
  const recalcLayout = async (overrides = {}) => {
    if (!editor) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/api/layout`, {
        document: editor.getJSON(),
        overrides,
      });
      if (res.data.pageHeight) setPageHeight(res.data.pageHeight);
      if (res.data.pageGap) setPageGap(res.data.pageGap);
      if (res.data.marginClass) setMarginClass(res.data.marginClass);
    } catch (e) {
      console.error(e);
    }
  };

  // Initial layout calculation once the editor is ready
  useEffect(() => {
    if (!editor) return;
    recalcLayout();
  }, [editor]);

  const [tutorResult, setTutorResult] = useState(null);
  const [showTutor, setShowTutor] = useState(false);

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
        if (cmd === 'tutor') {
          const { from, to } = editor.state.selection;
          const text = editor.state.doc.textBetween(from, to, '\n');
          const res = await axios.post(
            `${API_BASE_URL}/api/plugins/tutor/explain`,
            { text }
          );
          setTutorResult(res.data);
          setShowTutor(true);
          return;
        }
        const res = await axios.post(`${API_BASE_URL}/api/ai`, {
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
      debouncedSave(editor.getJSON());
      // Recalculate layout hints based on the latest document structure
      recalcLayout();
      if (timer.current) clearTimeout(timer.current);
      if (autocompleteController.current) {
        autocompleteController.current.abort();
      }
      const controller = new AbortController();
      autocompleteController.current = controller;
      timer.current = setTimeout(async () => {
        if (!text.trim()) return;
        try {
          const res = await axios.post(
            `${API_BASE_URL}/api/ai`,
            {
              documentText: text,
              command: 'autocomplete',
            },
            { signal: controller.signal }
          );
          const suggestion = res.data.suggestion;
          setGhost(suggestion);
          ghostRef.current = suggestion;
          editor.commands.setGhost(suggestion);
        } catch (e) {
          if (e.code === 'ERR_CANCELED') return;
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
            const match = textBefore.match(/\/(summarize|expand|rewrite|tutor)$/);
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

  const runPlugin = async () => {
    if (!editor || !selectedPlugin || !selectedAction) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, '\n');
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/plugins/${selectedPlugin}/${selectedAction}`,
        { text }
      );
      const result = res.data.result || '';
      if (result) {
        editor.chain().focus().insertContentAt({ from, to }, result).run();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const sendCommand = async () => {
    if (!editor || !chatInput.trim()) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, '\n');
    const userMessage = { role: 'user', content: chatInput };
    setMessages(prev => [...prev, userMessage, { role: 'assistant', content: '' }]);
    setChatInput('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: userMessage.content, selectedText }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiText = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        aiText += decoder.decode(value);
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: aiText };
          return updated;
        });
      }

      editor.chain().focus().insertContentAt({ from, to }, aiText).run();
    } catch (e) {
      console.error(e);
    }
  };

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
        <div className="flex flex-1 justify-center overflow-y-auto bg-gray-200">
          <div
            className="relative mx-auto"
            style={{
              paddingTop: pageGap,
              paddingBottom: pageGap,
              height: pageCount * pageHeight + (pageCount - 1) * pageGap,
            }}
          >
            {Array.from({ length: pageCount }).map((_, i) => (
              <div
                key={i}
                className={`pointer-events-none absolute left-0 right-0 mx-auto w-[816px] rounded-sm bg-white shadow-md ${ghost && i === pageCount - 1 ? 'ai-glow' : ''
                  }`}
                style={{
                  top: i * (pageHeight + pageGap),
                  height: pageHeight,
                }}
              />
            ))}
            <div
              ref={editorContainerRef}
              className={`relative z-10 mx-auto w-[816px] ${marginClass} transition-all`}
              style={{ minHeight: pageHeight }}
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
                      className={`cursor-pointer px-4 py-2 text-sm ${i === slashIndex ? 'bg-gray-100' : ''
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
        <aside className="hidden w-80 flex-shrink-0 border-l bg-white md:flex md:flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="border-b p-4">
              <h2 className="mb-2 text-sm font-semibold">Tracked Changes</h2>
              {changes.map((c, i) => (
                <div key={i} className="mb-1 text-xs text-gray-700">
                  {c}
                </div>
              ))}
            </div>
            <div className="p-4">
              <h2 className="mb-2 text-sm font-semibold">AI Suggestions</h2>
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`mb-2 text-sm ${m.role === 'user' ? 'text-gray-800' : 'text-blue-600'
                    }`}
                >
                  {m.content}
                </div>
              ))}
            </div>
          </div>
          <div className="border-t p-2">
            <div className="mb-2 flex space-x-2">
              <select
                value={selectedPlugin}
                onChange={e => {
                  setSelectedPlugin(e.target.value);
                  setSelectedAction('');
                }}
                className="flex-1 rounded border px-2 py-1 text-sm"
              >
                <option value="">Select plugin</option>
                {plugins.map(p => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedAction}
                onChange={e => setSelectedAction(e.target.value)}
                disabled={!selectedPlugin}
                className="flex-1 rounded border px-2 py-1 text-sm"
              >
                <option value="">Action</option>
                {plugins
                  .find(p => p.name === selectedPlugin)?.actions.map(a => (
                    <option key={a.name} value={a.name}>
                      {a.name}
                    </option>
                  ))}
              </select>
              <button
                onClick={runPlugin}
                disabled={!selectedPlugin || !selectedAction}
                className="rounded bg-blue-500 px-2 py-1 text-white disabled:opacity-50"
              >
                Run
              </button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                sendCommand();
              }}
            >
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Send a command..."
                className="w-full rounded border px-2 py-1 text-sm"
              />
            </form>
          </div>
        </aside>
      </div>
      {showTutor && tutorResult && (
        <div className="fixed right-0 top-0 bottom-0 w-80 border-l bg-white shadow-lg">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-sm font-semibold">Tutor</h2>
            <button
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setShowTutor(false)}
            >
              Close
            </button>
          </div>
          <div className="p-4 overflow-y-auto text-sm">
            {tutorResult.steps?.length > 0 && (
              <>
                <h3 className="mb-2 font-medium">Explanation</h3>
                <ol className="mb-4 list-decimal list-inside">
                  {tutorResult.steps.map((s, i) => (
                    <li key={i} className="mb-1">{s}</li>
                  ))}
                </ol>
              </>
            )}
            {tutorResult.quiz?.length > 0 && (
              <>
                <h3 className="mb-2 font-medium">Quiz</h3>
                <ul className="list-disc list-inside">
                  {tutorResult.quiz.map((q, i) => (
                    <li key={i} className="mb-1">{q}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

