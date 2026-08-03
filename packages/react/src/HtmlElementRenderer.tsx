import { HtmlElement } from '@kajay/core';
import type { ReactElement } from 'react';
import { useHtmlSanitizer } from './HtmlSanitizerContext.js';
import type { PageElementRendererProps } from './PageElementRendererRegistry.js';

/** Draws author-supplied markup after applying the host's sanitizer. */
export function HtmlElementRenderer({ element }: PageElementRendererProps): ReactElement {
  if (!(element instanceof HtmlElement)) {
    throw new TypeError('HtmlElementRenderer requires an HTML element.');
  }
  const sanitize = useHtmlSanitizer();
  return (
    <div
      className="kajay-html"
      data-element-name={element.name}
      dangerouslySetInnerHTML={{ __html: sanitize(element.html) }}
    />
  );
}
