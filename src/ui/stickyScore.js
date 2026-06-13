/**
 * Sticky mini-scoreboard reveal (index only).
 *
 * The big board hero (`.board`) is the score at the top of the page. Once it
 * scrolls out of view we reveal a compact mini-scoreboard in the sticky header
 * (markup in index.html `#topnavScore`, styled in src/style.css) so the current
 * level cards + score stay visible while scrolling. teamDisplay.renderTeams()
 * keeps the mini values live; this module only toggles visibility via the
 * `body.board-offscreen` class.
 */

export function initStickyScore() {
  const board = document.querySelector('.board');
  const mini = document.getElementById('topnavScore');
  if (!board || !mini || typeof IntersectionObserver !== 'function') return;

  const setOffscreen = (off) => {
    document.body.classList.toggle('board-offscreen', off);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        // Board considered "off-screen" once essentially none of it shows.
        setOffscreen(!entry.isIntersecting);
      }
    },
    // Trigger the moment the board's bottom edge passes under the sticky
    // header (~60px tall: topnav + a little). rootMargin top offset keeps the
    // mini from flashing in while the board is still partly visible.
    { threshold: 0, rootMargin: '-60px 0px 0px 0px' }
  );

  observer.observe(board);
}
