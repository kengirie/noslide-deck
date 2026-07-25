import { useEffect } from 'react';
import { nip19 } from 'nostr-tools';
import { Navigate, useParams } from 'react-router-dom';
import { DECK_KIND } from '@/lib/deckEvent';
import { profileUrl } from '@/lib/siteConfig';
import NotFound from './NotFound';

/** Profiles are handled by an external Nostr client, not by this app. */
function ExternalProfileRedirect({ npub }: { npub: string }) {
  useEffect(() => {
    window.location.replace(profileUrl(npub));
  }, [npub]);
  return null;
}

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
      return <ExternalProfileRedirect npub={identifier} />;

    case 'nprofile':
      return <ExternalProfileRedirect npub={nip19.npubEncode(decoded.data.pubkey)} />;

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
