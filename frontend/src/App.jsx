import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import axios from 'axios';

const initialContent = 'This is a sample document for the IntelliPaper demo. Highlight text and ask the AI for help.';

export default function App() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState(null);
  const [selection, setSelection] = useState({ from: 0, to: 0, text: '' });

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, ' ');
      setSelection({ from, to, text });
    }
  });

  const submitQuery = async () => {
    if (!selection.text || !query.trim()) return;
    try {
      const res = await axios.post('http://localhost:3001/api/analyze', {
        documentId: 1,
        highlightedText: selection.text,
        query
      });
      setResponse(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const applyEdit = () => {
    if (response?.suggestedEdit) {
      editor.commands.insertContentAt(
        { from: selection.from, to: selection.to },
        response.suggestedEdit
      );
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ flex: 1, padding: '1rem' }}>
        <EditorContent editor={editor} />
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Ask about the highlight..."
          style={{ width: '100%', marginTop: '1rem' }}
        />
        <button onClick={submitQuery} style={{ marginTop: '0.5rem' }}>Send</button>
      </div>
      <div style={{ width: '30%', padding: '1rem', borderLeft: '1px solid #ccc' }}>
        {response ? (
          <div>
            <p>{response.response}</p>
            {response.suggestedEdit && (
              <button onClick={applyEdit}>Apply Suggestion</button>
            )}
          </div>
        ) : (
          <p>Select text and ask a question to get started.</p>
        )}
      </div>
    </div>
  );
}
