import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('y-websocket', () => ({
  WebsocketProvider: vi.fn(() => ({
    awareness: { on: vi.fn(), off: vi.fn() },
    destroy: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn()
  }))
}));

// Minimal WebSocket stub for tests
class MockWebSocket {
  constructor() {
    this.onmessage = null;
  }
  close() {}
  send() {}
}

global.WebSocket = MockWebSocket;
