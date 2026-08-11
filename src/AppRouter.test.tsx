import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./pages/Index', () => ({ default: () => <div>HOME_UPLOAD_PAGE</div> }));
vi.mock('./pages/DeckPage', () => ({
  default: ({ npub, deckId }: { npub?: string; deckId?: string }) => (
    <div>DECK_PAGE:{npub}/{deckId}</div>
  ),
}));

import { RootRoute } from './AppRouter';

describe('RootRoute (deck-site boot)', () => {
  afterEach(() => {
    document.head.querySelectorAll('meta[name^="deck:"]').forEach((el) => el.remove());
  });

  it('shows the home/upload page on the normal app hosts', () => {
    render(<RootRoute />);
    expect(screen.getByText('HOME_UPLOAD_PAGE')).toBeInTheDocument();
  });

  it('boots into the deck when the mirrored site tags it via meta', () => {
    for (const [name, content] of [
      ['deck:npub', 'npub1abc'],
      ['deck:id', 'my-talk'],
    ]) {
      const el = document.createElement('meta');
      el.setAttribute('name', name);
      el.setAttribute('content', content);
      document.head.appendChild(el);
    }
    render(<RootRoute />);
    expect(screen.getByText('DECK_PAGE:npub1abc/my-talk')).toBeInTheDocument();
    expect(screen.queryByText('HOME_UPLOAD_PAGE')).not.toBeInTheDocument();
  });
});
