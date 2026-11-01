# MyPlayer

Android-first Expo SDK 58 IPTV client with M3U and Xtream Codes support.

## Run

Use `npm install` then `npx expo start --clear`. Video playback uses `expo-video`, included in the matching SDK 58 Expo Go app. Rebuild older custom development clients after native dependency changes.

## Playlists

Settings opens the saved playlist library. Use + to add a named playlist, the pencil to edit, Play to load, and the star to choose the default. A single playlist is automatically the default. Every app launch opens the default's cached catalogue and refreshes it from the provider; if unavailable, saved channels remain usable.

Favorites, history and category preferences belong to each playlist. The previous single-playlist archive migrates automatically. Credentials and local data use unencrypted AsyncStorage. Catalogues are stored in chunks; if cache capacity is exceeded, playlist names, credentials and preferences are still saved and channels can be downloaded again.

## Browse

Live TV categories always stay on the left, including phones. Favorites is pinned. Search categories in the sidebar and channels above the list. Channels have a favorites toggle only. Category visibility is controlled in the organiser.

The sliders icon opens Organise. Drag grips reorder categories with an insertion line and edge auto-scroll. Use eye icons to hide/restore categories, the toolbar eye to reveal hidden categories and the reset icon to restore provider order. Tap Done to return to the updated category list. Screen readers also have reorder actions on the grip. New provider categories append after the saved order. Reordering never modifies stream records.

Playback controls slide down after four seconds without interaction. Tap the bottom bar to reopen. Paused/error controls stay available. Track choices depend on the stream and decoder.

## Checks

- `npx expo lint`
- `npx tsc --noEmit`
- `node scripts/check-playlist.mjs`
- `node scripts/check-categories.mjs`
- `node scripts/check-library.mjs`

Playback diagnostics keep controls visible until video arrives and report a startup warning after 25 seconds. On supported Xtream live URLs, “Try alternate stream” switches between HLS and TS. M3U VLC playback headers and URL-suffix headers are preserved. Diagnostic messages omit provider URLs and credentials. Check these paths with `node scripts/check-playback.mjs`.

## Movies

Movies has a permanent category sidebar with pinned Newly Added and Favorites. Newly Added uses only supplied added timestamps within a rolling five-day (120-hour) window, newest first; missing and future dates are excluded. Counts match each filtered movie list, including channel-independent movie search. Provider categories with a reserved built-in name are marked “Provider” to distinguish them from the date-filtered built-in category.

A movie tile or movie in Continue Watching opens `/movie` details, never playback. Details fetch Xtream `get_vod_info` only on demand and use supplied M3U metadata when available. Missing information/posters are identified honestly. Wide layouts show information on the left and a poster on the right; narrow layouts keep Play/Resume in a fixed bottom bar. Only that button opens the player. Back preserves per-playlist movie category/search/scroll context. No external metadata service is used.

Movie checks: `node scripts/check-movies.mjs`.

Movie and series episode playback share the same compact controls and have no persistent control bar. Tap the picture to reveal controls without changing playback. Use the Play/Pause icon to pause or resume. The top-left Back icon returns to the movie list for movies, or the series/episode browser for episodes. A compact bottom toolbar shows the colored seek bar, elapsed/total time, speaker volume controls and audio/subtitle selectors. Tap or drag the timeline to seek. Movie and episode controls disappear after two seconds without interaction, including while paused. Errors retain recovery controls. Streams use the supplied M3U URL or Xtream container extension (MP4 is only the fallback when omitted). The subtitle menu lists tracks exposed by the native player; separate external subtitle files are not fetched.

Timeline checks: `node scripts/check-player-controls.mjs`.

## Series

The Series browser has a permanent category sidebar on the left and full-width cover poster cards on the right. Favorites is pinned; category search, series search, counts and organisation use separate Series preferences. Selecting a series preserves the category and search when returning from details. Series cards use full-width cover posters. Selecting a series opens `/series` as a full-page 50/50 split: the left panel contains the poster, provider information and season buttons; the right panel contains independently scrollable episodes with resume progress. The two panels remain side by side on narrow screens, with poster and information stacked inside the left panel. Episodes start only when selected and support saved resume positions. The player Back control returns to the series details view. Xtream seasons, episode numbers, descriptions and durations come from `get_series_info`; missing details are marked as not provided. M3U entries without season metadata appear under Episodes without invented season numbers.

Series Latest Updates is pinned below Favorites and shows only series with valid provider added or last-modified dates in the past five days, newest first. Its count follows the same date/search-filtered list; missing/future dates are excluded. Provider update timestamps can surface recently updated series as well as new series.

Catalogue cache updates use staged generations and commit metadata before deleting the previous generation. Failed cache writes retain the previous saved catalogue; chunks are bounded by record count and serialized size. The dashboard distinguishes loading from zero counts and offers Reload playlist with provider errors. Version 1 remains unchanged as the baseline.
