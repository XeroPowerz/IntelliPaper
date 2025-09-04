import React from 'react';

export default function Sidebar({ response, onApply }) {
  return (
    <div style={{ width: '30%', padding: '1rem', borderLeft: '1px solid #ccc' }}>
      {response ? (
        <div>
          <p>{response.response}</p>
          {response.suggestedEdit && (
            <button onClick={onApply}>Apply Suggestion</button>
          )}
        </div>
      ) : (
        <p>Select text and ask a question to get started.</p>
      )}
    </div>
  );
}
