import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import axios from 'axios';
import Sidebar from './Sidebar';

const initialContent = 'This is a sample document for the IntelliPaper demo. Highlight text and ask the AI for help.';

export default function App() {
  const [userQuery, setUserQuery] = useState('');
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
    if (!selection.text || !userQuery.trim()) return;
    try {
      const res = await axios.post('http://localhost:3001/api/analyze', {
        documentText: editor.getText(),
        highlightedText: selection.text,
        userQuery
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
          value={userQuery}
          onChange={e => setUserQuery(e.target.value)}
          placeholder="Ask about the highlight..."
          style={{ width: '100%', marginTop: '1rem' }}
        />
        <button onClick={submitQuery} style={{ marginTop: '0.5rem' }}>Ask AI</button>
      </div>
      <Sidebar response={response} onApply={applyEdit} />
    </div>
  );
}
