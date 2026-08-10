/**
 * What kajay.io says about itself to something that is not a browser — checklist P13.
 *
 * A link pasted into Slack, a search result, a preview card: none of them run the page,
 * so everything they show has to be in the head of the document the server sent. The site
 * had none of it, which for a library whose whole distribution model is somebody sharing a
 * link meant every share rendered as a bare URL.
 *
 * Kept in one module rather than spread across routes because the values have to agree —
 * a description in the meta tag that disagrees with the one in the card is two answers to
 * one question, and nothing on the page shows you the difference.
 */

/** The canonical origin. Absolute URLs are required: a card is rendered elsewhere. */
export const SITE_ORIGIN = 'https://kajay.io';

export const SITE_NAME = 'Kajay';

export const SITE_TITLE = 'Kajay — surveys that look like your application';

/**
 * One sentence, and it is the *product* claim rather than a feature list.
 *
 * This is the only prose most people will read: it is what a search result shows and what
 * a link preview puts under the title. It says what Kajay is for and what makes it
 * different, in that order, because a reader who stops after eight words should still have
 * the first half.
 */
export const SITE_DESCRIPTION =
  'A survey engine and designer that draw with your own components. Bring your ' +
  'design system; keep accessible defaults, logic, validation and theming.';

/**
 * The card image, absolute and served from the site's own assets.
 *
 * **PNG, not the SVG the rest of the site's marks are.** Every other icon here is a vector
 * because it scales; a card is the one place that cannot be, since the clients rendering it
 * — Slack, iMessage, Twitter, Discord — do not render SVG and show nothing at all rather
 * than something imperfect.
 */
export const SITE_IMAGE = `${SITE_ORIGIN}/og.png`;

/**
 * The head entries every page shares.
 *
 * `og:` for most readers and `twitter:` for one that ignores it — the duplication is the
 * protocol's, not ours. `summary_large_image` because the card is a wide graphic; the
 * default `summary` would crop it to a square thumbnail.
 */
export function siteMeta(): readonly Record<string, string>[] {
  return [
    { name: 'description', content: SITE_DESCRIPTION },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:title', content: SITE_TITLE },
    { property: 'og:description', content: SITE_DESCRIPTION },
    { property: 'og:url', content: SITE_ORIGIN },
    { property: 'og:image', content: SITE_IMAGE },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: SITE_TITLE },
    { name: 'twitter:description', content: SITE_DESCRIPTION },
    { name: 'twitter:image', content: SITE_IMAGE },
  ];
}
