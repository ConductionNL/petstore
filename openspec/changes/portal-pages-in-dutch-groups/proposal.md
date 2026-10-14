# Portal pages in Dutch, under a resident-facing group

## Why

Woo round 3 (hydra woo-citizen-journey, Ruben 2026-10-02): on the dev portal a resident who signs in as `client`
also gets the pet store's demo pages. The site menu showed them under "Pet Store" and in English ("My pets",
"My orders"), next to Dutch pages from every other app.

## What changes

- The contribution declares its two pages with `group: "Bestellingen"` (portaliq's group contract). The blocks are
  the ones portaliq made when no page was declared: the order form on the orders page, the list, the selected row.
- Every collection and action label is Dutch: "Mijn huisdieren", "Mijn bestellingen", "Een bestelling plaatsen",
  "De naam van een huisdier wijzigen". The contribution label is the group, not the app name.

## Impact

- `lib/Portal/PortalContributionProvider.php` and its test. No register change.
