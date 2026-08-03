import { HtmlElement, ImageElement } from '@kajay/core';
import type { DisplayElement } from '@kajay/core';
import type { CSSProperties, ReactElement } from 'react';
import { useHtmlSanitizer } from './HtmlSanitizerContext.js';

/**
 * Author-supplied markup.
 *
 * `dangerouslySetInnerHTML` is not an oversight — rendering the markup *is* the
 * feature, and escaping it would leave the element with nothing to do. What matters is
 * that the risk is stated and has a seam: a host whose definitions come from people it
 * does not trust passes `sanitizeHtml` to `<Survey>`, and this is where it is applied.
 * No sanitizer ships here, because one that is nearly right is worse than none.
 */
function HtmlBlock({ element }: { readonly element: HtmlElement }): ReactElement {
  const sanitize = useHtmlSanitizer();
  return (
    <div
      className="kajay-html"
      data-element-name={element.name}
      dangerouslySetInnerHTML={{ __html: sanitize(element.html) }}
    />
  );
}

function mediaStyle(element: ImageElement): CSSProperties {
  return {
    objectFit: element.imageFit,
    ...(element.imageWidth > 0 ? { width: element.imageWidth } : {}),
    ...(element.imageHeight > 0 ? { height: element.imageHeight } : {}),
  };
}

/**
 * A picture or a video.
 *
 * An empty `alt` when nothing describes it, rather than falling back to the element
 * name: an undescribed image is decorative and should be skipped, while one announced
 * as "imageBlock3" is noise read aloud.
 */
function MediaBlock({ element }: { readonly element: ImageElement }): ReactElement {
  if (element.contentMode === 'video') {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption -- captions are the
      // author's to supply on their own asset; §J revisits media accessibility.
      <video
        className="kajay-image"
        data-element-name={element.name}
        src={element.imageLink}
        style={mediaStyle(element)}
        controls
      />
    );
  }
  return (
    <img
      className="kajay-image"
      data-element-name={element.name}
      src={element.imageLink}
      alt={element.altText}
      style={mediaStyle(element)}
    />
  );
}

/**
 * Draws a page element that holds no answer.
 *
 * Dispatched by `SurveyElements` alongside `Panel`, rather than through the question
 * renderer registry: that registry is typed for questions, and widening it is the
 * general renderer-registration seam the checklist already places in Phase 3 (A4).
 */
export function DisplayElementRenderer({
  element,
}: {
  readonly element: DisplayElement;
}): ReactElement {
  if (element instanceof HtmlElement) {
    return <HtmlBlock element={element} />;
  }
  if (element instanceof ImageElement) {
    return <MediaBlock element={element} />;
  }
  return (
    <div className="kajay-question kajay-question--unsupported">
      {`No renderer is registered for display element "${element.type}".`}
    </div>
  );
}
