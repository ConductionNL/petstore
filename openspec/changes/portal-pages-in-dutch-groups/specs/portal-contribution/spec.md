## ADDED Requirements

### Requirement: Every portal page names its menu group in Dutch
The `client` contribution MUST declare a page per collection, "Mijn huisdieren" and "Mijn bestellingen", each with
`group: "Bestellingen"`; the orders page MUST offer "Een bestelling plaatsen" above the list. The contribution label
MUST be "Bestellingen", and every collection and action label MUST be Dutch.

#### Scenario: The resident menu
- **GIVEN** a client signed in on the site
- **WHEN** the site builds the menu
- **THEN** "Mijn huisdieren" and "Mijn bestellingen" MUST sit under "Bestellingen"
