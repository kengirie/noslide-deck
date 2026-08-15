import { nip19 } from 'nostr-tools';
import { Navigate, useParams } from 'react-router-dom';
import { DECK_KIND } from '@/lib/deckEvent';
import ProfilePage from './ProfilePage';
import NotFound from './NotFound';

export function NIP19Page() {
  const { nip19: identifier } = useParams<{ nip19: string }>();

  if (!identifier) {
    return <NotFound />;
  }

  let decoded;
  try {
    decoded = nip19.decode(identifier);
  } catch {
    return <NotFound />;
  }

  switch (decoded.type) {
    case 'npub':
      return <ProfilePage pubkey={decoded.data} />;

    case 'nprofile':
      return <ProfilePage pubkey={decoded.data.pubkey} />;

    case 'naddr': {
      const { kind, pubkey, identifier: d } = decoded.data;
      if (kind === DECK_KIND) {
        return <Navigate to={`/${nip19.npubEncode(pubkey)}/${d}`} replace />;
      }
      return <NotFound />;
    }

    default:
      return <NotFound />;
  }
}
