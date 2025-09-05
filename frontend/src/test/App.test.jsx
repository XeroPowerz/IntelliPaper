import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import App from '../App';
import axios from 'axios';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [{ name: 'test', actions: [{ name: 'run' }] }] })),
    post: vi.fn(url => {
      if (url.includes('/api/plugins/test/run')) {
        return Promise.resolve({ data: { result: 'plugin result' } });
      }
      return Promise.resolve({ data: { suggestion: 'suggestion' } });
    })
  }
}));

describe('App interactions', () => {
  it('shows slash command menu when typing /', async () => {
    render(<App />);
    const editor = document.querySelector('.ProseMirror');
    const user = userEvent.setup();
    await user.type(editor, '/');
    expect(await screen.findByText('Summarize')).toBeInTheDocument();
  });

  it('executes plugin action', async () => {
    render(<App />);
    await screen.findByRole('option', { name: 'test' });
    const selects = screen.getAllByRole('combobox');
    const user = userEvent.setup();
    await user.selectOptions(selects[0], 'test');
    await user.selectOptions(selects[1], 'run');
    await user.click(screen.getByRole('button', { name: /run/i }));
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/plugins/test/run'),
        { text: '' }
      );
    });
    expect(document.querySelector('.ProseMirror').textContent).toContain('plugin result');
  });
});
