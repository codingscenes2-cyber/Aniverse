# ANIVERSE Standalone Site — standalone-v1.0.0

A self-contained, single-file anime discovery application.

## Included
- Responsive desktop and mobile interface
- Live AniList GraphQL discovery catalogue
- Search, genre, format, year, and sort filters
- Trending and current-season shelves
- Full anime dossiers with synopsis, metadata, studios, cast, Japanese voice actors, staff, trailers, and external links where provided
- Local watchlist with Watching, Plan to Watch, Completed, On Hold, and Dropped states
- Episode progress tracking
- Library summary plus JSON import/export
- Upcoming airing calendar
- AniList recommendations seeded from the user's first saved title
- Franchise relation guide ordered by known release year
- No build step or third-party JavaScript dependencies

## Run
Open `ANIVERSE-RELEASE.html` in a modern browser with an internet connection. Catalogue requests use AniList GraphQL. The watchlist is stored in that browser's localStorage.

## Data and content boundaries
ANIVERSE is an anime discovery and tracking interface. It does not host, stream, or download anime episodes. External provider links and catalogue metadata are only shown when supplied by AniList. Coverage varies by title. Library data stays in the browser and is not account-synced.

## Release note
This standalone site is independent of the AppDeploy-hosted React application. It does not replace or automatically deploy the existing live ANIVERSE 3.1 app.
