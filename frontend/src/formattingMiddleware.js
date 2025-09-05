export function parseFormattingIntent(input) {
  const text = input.toLowerCase();
  if (/(make|set)?.*bold/.test(text) || /bold/.test(text)) {
    return { type: 'bold' };
  }
  if (/(make|set)?.*italic/.test(text) || /italic/.test(text)) {
    return { type: 'italic' };
  }
  const alignMatch = text.match(/align(?:ment)?\s+(left|center|right|justify)/);
  if (alignMatch) {
    return { type: 'align', value: alignMatch[1] };
  }
  const fontMatch = text.match(/(increase|decrease)\s+(?:font|text)\s+size/);
  if (fontMatch) {
    return { type: 'fontSize', value: fontMatch[1] };
  }
  const spacingMatch = text.match(/(double|single)\s+(?:spacing|space|line\s+height)/);
  if (spacingMatch) {
    return { type: 'lineHeight', value: spacingMatch[1] };
  }
  return null;
}

export function applyFormatting(editor, intent) {
  if (!editor || !intent) return false;
  const chain = editor.chain().focus();
  switch (intent.type) {
    case 'bold':
      chain.toggleBold().run();
      return true;
    case 'italic':
      chain.toggleItalic().run();
      return true;
    case 'align':
      chain.setTextAlign(intent.value).run();
      return true;
    case 'fontSize': {
      const size = intent.value === 'increase' ? '1.25em' : '0.875em';
      chain.setMark('textStyle', { fontSize: size }).run();
      return true;
    }
    case 'lineHeight': {
      const height = intent.value === 'double' ? '2' : '1';
      chain.setMark('textStyle', { lineHeight: height }).run();
      return true;
    }
    default:
      return false;
  }
}

export function handleFormatting(editor, input) {
  const intent = parseFormattingIntent(input);
  if (!intent) return false;
  return applyFormatting(editor, intent);
}
