import { ImageElement } from '@kajay/core';
import type { CSSProperties, ReactElement } from 'react';
import type { PageElementRendererProps } from './PageElementRendererRegistry.js';

/** Draws a registered image or video page element. */
export function ImageElementRenderer({ element }: PageElementRendererProps): ReactElement {
  if (!(element instanceof ImageElement)) {
    throw new TypeError('ImageElementRenderer requires an image element.');
  }
  const source = element.imageLink.length > 0 ? element.imageLink : undefined;
  if (element.contentMode === 'video') {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption -- captions belong to the asset.
      <video
        className="kajay-image"
        data-element-name={element.name}
        src={source}
        style={mediaStyle(element)}
        controls
      />
    );
  }
  return (
    <img
      className="kajay-image"
      data-element-name={element.name}
      src={source}
      alt={element.altText}
      style={mediaStyle(element)}
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
