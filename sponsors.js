// sponsors.js - everything about sponsorship lives here. Edit this file only.
//
// HOW IT WORKS
// - Each placement on the site is a "slot". If a sponsor is booked for a slot, the sponsor shows there,
//   clearly labelled "Sponsored". If nobody is booked, a slim "Partner with SportyPredictz" card shows instead,
//   so brands who visit can see where they would appear and get in touch.
// - Sponsor links are written with rel="sponsored nofollow noopener". That is what Google asks for on paid links.
//
// SLOTS
//   top      slim banner under the menu on the home, day and tip pages   (best size: 728x90 desktop, 320x100 phone)
//   feed     a card inside the match list, after the 6th match            (best size: 600x200)
//   side     card in the right column on desktop, below the picks         (best size: 300x250)
//   match    card under the model pick on every match page                (best size: 600x200)
//
// TO ADD A SPONSOR: copy the example below into SPONSORS, remove the // marks, and save.
// logo: put the image file in /assets and write its path, e.g. "/assets/acme.png". Keep it under 60 KB.
// ends: optional, "2026-12-31". After that date the sponsor stops showing by itself.

export const SPONSORS = [
  // {
  //   name: "Acme Sports",
  //   url: "https://example.com/?ref=sportypredictz",
  //   tagline: "Welcome offer for new players. 18+ T&Cs apply.",
  //   cta: "Visit Acme",
  //   logo: "/assets/acme.png",
  //   slots: ["top", "feed", "side", "match"],
  //   ends: "2026-12-31"
  // }
];

// Facts for the Advertise page. Leave a value as null and that line is simply not shown.
// Fill in only numbers you can prove from your own analytics (GoatCounter or Search Console).
export const MEDIA_KIT = {
  monthlyVisitors: null,        // e.g. 120000
  monthlyPageViews: null,       // e.g. 480000
  topCountries: [],             // e.g. ["Nigeria", "Kenya", "Ghana"]
  mobileShare: null,            // e.g. 92  (percent)
  updated: null                 // e.g. "November 2026"
};

export const PLACEMENTS = [
  { slot: "top", name: "Top banner", where: "Under the menu on the home page, the today and tomorrow pages and every bet-type page.", size: "728x90 on desktop, 320x100 on phones" },
  { slot: "feed", name: "In-feed card", where: "Inside the match list, after the sixth match, so it sits between the fixtures people are reading.", size: "600x200" },
  { slot: "side", name: "Sidebar card", where: "Right-hand column on desktop, under today's strongest picks.", size: "300x250" },
  { slot: "match", name: "Match page card", where: "Under the model pick on every match page, the page people open just before kick-off.", size: "600x200" }
];

const live = (s) => !s.ends || new Date(s.ends + "T23:59:59Z").getTime() > Date.now();
export const sponsorFor = (slot) => SPONSORS.find((s) => live(s) && (s.slots || []).includes(slot)) || null;
