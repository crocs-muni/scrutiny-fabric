import { useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import { useParams } from 'react-router-dom';
import EventPage from './EventPage';
import NotFound from './NotFound';

type RouteTarget = 'event' | 'profile' | 'address' | 'invalid';

export function NIP19Page() {
  const { nip19: identifier } = useParams<{ nip19: string }>();

  const routeTarget: RouteTarget = useMemo(() => {
    if (!identifier) {
      return 'invalid';
    }

    if (identifier.startsWith('note1') || identifier.startsWith('nevent1')) {
      try {
        const decoded = nip19.decode(identifier);
        if (decoded.type === 'note' || decoded.type === 'nevent') {
          return 'event';
        }
      } catch {
        return 'invalid';
      }
    }

    if (/^[0-9a-f]{64}$/i.test(identifier)) {
      return 'event';
    }

    if (identifier.startsWith('npub') || identifier.startsWith('nprofile')) {
      return 'profile';
    }

    if (identifier.startsWith('naddr')) {
      return 'address';
    }

    return 'invalid';
  }, [identifier]);

  if (routeTarget === 'event') {
    return <EventPage />;
  }

  if (routeTarget === 'profile') {
    return <div>Profile page coming soon</div>;
  }

  if (routeTarget === 'address') {
    return <div>Address page coming soon</div>;
  }

  return <NotFound />;
}