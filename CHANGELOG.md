# Changelog

**English** · [Русский](CHANGELOG.ru.md)

## 1.17.2 — 18.11.2026

- a 200 response with `errors` in the body is no longer counted as a deletion:
  X returns code 183 for “not your tweet” or “already gone”, and the queue used
  to mark the id as done and put it into history. Such a step now goes to
  `пропущено`, the last error is shown in the panel, and the id is not recorded;
- replies take the id only from the link to your own post. A card without that
  link is the conversation context — someone else's tweet that X shows above
  your reply — and it is skipped. This is what produced the alternation in the
  log: every reply with a thread above it sent a foreign id, got 200 + 183, and
  stayed in place while the panel called it deleted.

## 1.17.1 — 18.11.2026

- the protect list can now be switched off for one module without touching the
  global setting: each module panel has a “respect the protect list” switch.
  The exception lives in `chrome.storage.sync` and applies only to that module.

## 1.17.0 — 18.11.2026

- the protect list now works in every module, not only unfollow, and is on by
  default: replies to protected accounts, their reposts and quotes are skipped,
  the Delete button does not appear on replies to them, and stuck likes leave
  their posts alone;
- a switch in the protect block turns this off and restores the old behaviour;
- the panel shows how many records were skipped because of the list, both for
  archive files and while scrolling;
- archive likes are the one exception: `like.js` has ids only, no authors.

## 1.16.0 — 18.11.2026

- new debug log, off by default. A switch in each module panel (“Where to get
  the file…”) starts recording steps: module decisions, record ids, X response
  codes, queue counters. “Download log” saves a JSON file;
- no secrets in it: cookies, tokens, headers, post texts and handles are not
  written, and anything that looks like a secret in an X response is replaced
  with `***`;
- the log helps tell apart three cases that look identical in the UI: a card
  left in the page cache, an id that is really gone, and X answering 404 to a
  record that still exists.

## 1.15.2 — 18.11.2026

- scrolling no longer trusts the action history when a card is still on screen:
  the id is sent again with a “force” flag, so the queue asks X instead of
  skipping silently. A 200 deletes, a 404 with a body confirms the record is
  gone — either way the counts tell the truth;
- this covers the case where a wrong id once landed in the history (a quoted
  post instead of the reply) and every later pass reported “already deleted”
  while the reply was still there;
- same for reposts, which share the scroll code path.

## 1.15.1 — 18.11.2026

- replies: the id is taken from your own status link, not from an embedded
  quote. A quote card renders its link earlier, so a reply that quoted someone
  could send `DeleteTweet` against the quoted post: a 404 went into the history
  and the visible reply stayed;
- the scroll summary now stays in the panel and says plainly that cards left on
  the page are cached until you reload the tab — reposts get the same note;
- the “already deleted: skipped” line itself is unchanged behaviour: it means
  the id is in the action history, i.e. it was deleted earlier.

## 1.15.0 — 17.11.2026

- new module “Delete replies”: takes `tweets.js` from the X archive and removes
  records with `in_reply_to` — regular tweets and reposts are left alone;
- without the archive it works on the profile’s Replies tab: scroll, and each
  reply is queued and deleted one by one, the way reposts are undone;
- the queue gets a new job type, history keeps its own record for replies, and
  the archive lists for replies are included in export/import;
- eight module cards in the popup instead of seven.

## 1.14.0 — 16.11.2026

- the project is now **Cleanup for X** (it was X Cleaner): the name states the
  function, and it no longer collides with the paid x-cleaner.app;
- new icon monogram **CX**; the popup header, the dock header and the store
  screenshots follow the new name;
- storage keys and settings are unchanged: updating keeps the protect list, the
  action history and the module toggles;
- no functional changes in this release.

## 1.13.6 — 15.11.2026

- before every “Stuck likes” run its history is cleared: a row that stayed after
  an X error or came back after F5 is no longer skipped as “already done” — the
  next run processes it again;
- this matters because older versions could record ids whose like was actually
  still there.

## 1.13.5 — 15.11.2026

- “Stuck likes” moved back from clicks to the request pair: clicks on the X page
  work only sometimes, so the pair (`FavoriteTweet` → `UnfavoriteTweet`) goes to
  the server at once, without waiting for the button state;
- after a confirmed answer the row is removed from the list so you can see it was
  processed;
- if a row returns after a reload, that is X state, not the extension; there is
  no separate “clear likes history” — History → Likes is the same likes list, and
  the like itself has to be removed.

## 1.13.4 — 15.11.2026

- “Stuck likes” do the pair faster: they wait only for the heart to fill and
  remove it right away. A slow pair does not clean X history;
- a row may leave the list only after a page reload — that is X behaviour, while
  the history is cleaned by the fast pair;
- the click test is updated.

## 1.13.3 — 15.11.2026

- “Stuck likes” switched to clicking the page: the panel presses the heart one by
  one, waits for the state to change and the row to disappear, then moves on;
- removes both stuck rows and remaining likes;
- no background queue for this module: everything happens visibly on the page;
- the test button is gone to avoid confusion.

## 1.13.2 — 15.11.2026

- “Stuck likes” walk the whole Likes list: a stuck row gets a like and loses it
  right away, a card with a remaining like is simply unliked;
- if the unlike after a successful like returns a 404 with a body, it is retried:
  previously such an answer was treated as “already gone” and the like stayed;
- hints and docs updated for this mode.

## 1.13.1 — 15.11.2026

- “Stuck likes” now run synchronously, like a hand: the panel scrolls the list,
  puts and immediately removes a like for each post, waits for the answer and
  moves on. Keep the tab open;
- scrolling works when X scrolls the list inside a nested container rather than
  the window;
- the “Test on one record” hint no longer misleads: it talks about the visible
  part of the list and points to “Find and remove”.

## 1.13.0 — 15.11.2026

- new “Stuck likes” module: scrolls History → Likes, finds posts that stayed in
  the list without a like and, for each one, puts and immediately removes the like
  (`FavoriteTweet` → `UnfavoriteTweet`) so the row disappears. Collection runs in
  the open tab, the cleanup runs in the background: once collection is done you
  can close the tab, and the result is visible after a page reload;
- the stuck-like detector handles both X markups: the old one (`data-testid`
  `like`/`unlike`) and the new `x-web` 2026 one (`article` without `data-testid`,
  `aria-pressed` and `icon-heart` inside the button);
- seven module cards and seven history rows in the popup.

## 1.12.1 — 15.11.2026

- new extension icon in the project palette: a warm terracotta rounded square
  with the XC monogram, transparent PNG at 16/48/128 px, source in
  `design/icon.html`.

## 1.12.0 — 15.11.2026

- the whole interface is bilingual: English by default, Russian turns on
  automatically when the browser language is Russian;
- one string dictionary, `shared/i18n.js`: popup, dock, module panels, background
  queue statuses and plural forms;
- localized extension name and description (`_locales/en`, `_locales/ru`);
- shorter dock tab labels: Tweets / Reposts / Quotes / Likes / Unfollow / DMs;
- bilingual documentation: `README.md` + `README.ru.md`, `CHANGELOG.md` +
  `CHANGELOG.md` + `CHANGELOG.ru.md` и политика конфиденциальности;
- English screenshots for the README and the store listing, Russian ones next to
  them.

## 1.11.0 — 15.11.2026

First public release.

**Popup**
- redesigned for newcomers: six module cards with plain descriptions, a “where it
  works” line and an “Open” button that goes to the right X page;
- live data: history, protect list, toggles and queue progress arrive through
  `chrome.storage.onChanged` and tab events, with no popup reload;
- an “In progress” block with progress, percentage, time estimate and “stop”;
- “Who to leave alone” and “What has been done” with live counters; data export
  and import merge lists and carry loaded archives.

**X page**
- one dock for all modules: tabs, event log, “stop all”, work status in the header
  (visible when collapsed too);
- dock theme follows the X page;
- no more meaningless “0 / 0” cards on an empty panel;
- job panels update by storage subscription instead of a 1.2 s poll.

**Modules**
- delete your tweets, undo reposts (from archive and while scrolling), delete
  quotes, remove likes, clean up DMs, unfollow non-followers;
- background queues survive tab close and service worker unload;
- “Undo while scrolling” skips already undone reposts without a five-minute wait;
- “Test on one record” no longer looks harmless: explicit label and confirmation;
- DMs open the menu without clicking a link and do not navigate away;
- the protect list is no longer seeded from code: a new user starts empty, an
  existing list is preserved.

**Reliability and privacy**
- the `tabs` permission was removed — only `storage` and `cookies` remain;
- fixed read-write races in queues and history, duplicate requests for the same
  id, lost ids on concurrent writes;
- fresh X `queryId` values are picked up from page bundles and passed to the
  background;
- storage migrations no longer crash on old or broken data;
- 7 test files and a linter without warnings.
