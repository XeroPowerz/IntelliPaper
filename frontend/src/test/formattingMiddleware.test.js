import { describe, it, expect, vi } from 'vitest';
import { parseFormattingIntent, applyFormatting } from '../formattingMiddleware';

function createEditorMock() {
  const actions = {};
  const chain = {
    focus: () => chain,
    toggleBold: () => { actions.bold = true; return chain; },
    toggleItalic: () => { actions.italic = true; return chain; },
    setTextAlign: value => { actions.align = value; return chain; },
    setMark: (mark, attrs) => { actions[mark] = attrs; return chain; },
    run: () => {}
  };
  return { chain: () => chain, actions };
}

describe('parseFormattingIntent', () => {
  it('detects bold intent', () => {
    expect(parseFormattingIntent('make this bold')).toEqual({ type: 'bold' });
  });
  it('detects italic intent', () => {
    expect(parseFormattingIntent('set text italic')).toEqual({ type: 'italic' });
  });
  it('detects alignment', () => {
    expect(parseFormattingIntent('align center')).toEqual({ type: 'align', value: 'center' });
  });
});

describe('applyFormatting', () => {
  it('applies bold formatting', () => {
    const editor = createEditorMock();
    const result = applyFormatting(editor, { type: 'bold' });
    expect(result).toBe(true);
    expect(editor.actions.bold).toBe(true);
  });

  it('applies text alignment', () => {
    const editor = createEditorMock();
    const result = applyFormatting(editor, { type: 'align', value: 'right' });
    expect(result).toBe(true);
    expect(editor.actions.align).toBe('right');
  });

  it('returns false for unknown intent', () => {
    const editor = createEditorMock();
    expect(applyFormatting(editor, { type: 'unknown' })).toBe(false);
  });
});
