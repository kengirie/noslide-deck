import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { getDeckSiteTarget } from "@/lib/siteConfig";

import DeckPage from "./pages/DeckPage";
import Index from "./pages/Index";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";

/**
 * On a deck's mirrored nsite the deck is served at "/", so boot straight into it
 * (方針A). On the normal app hosts this is the home/upload page.
 */
export function RootRoute() {
  const target = getDeckSiteTarget();
  return target ? <DeckPage npub={target.npub} deckId={target.deckId} /> : <Index />;
}

export function AppRouter() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<RootRoute />} />
        {/* Deck viewer: /<npub>/<deck-id> */}
        <Route path="/:npub/:deckId" element={<DeckPage />} />
        {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;