import { childLabel, fastEntryText } from '@kajay/creator-core';
import type { CollectionRow, DesignSurface } from '@kajay/creator-core';
import type { SurveyElement } from '@kajay/core';
import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useCreatorComponents } from './CreatorComponents.js';
import { PropertySection } from './PropertyFields.js';
import { PropertyLabel } from './PropertyLabel.js';

export interface CollectionEditorProps {
  readonly surface: DesignSurface;
  /** The element the collection hangs off — a question, a matrix column, a page. */
  readonly owner: SurveyElement;
  readonly collection: CollectionRow;
  /** Prefixes element ids, so two grids on screen do not share them — see PropertyFields. */
  readonly scope: string;
}

/**
 * A choices editor, a validators editor, and everything else shaped like them — L2.
 *
 * **One editor, because they are one thing.** Both are child collections the registry
 * declares; so are matrix columns, matrix rows and multiple-text items, and all of them
 * are edited here with no code that names any of them. What looks specialized is read off
 * the registry: a collection with a **shorthand** gets fast entry, because a shorthand is
 * exactly the claim that a child has a scalar form a line of text can carry; a collection
 * whose base type has several concrete subclasses gets a type picker, which is why
 * validators have one and choices do not.
 *
 * Each child is edited by **L1's own fields**, so a validator's `minValue` is a number
 * field for the same reason a rating's `rateMax` is. Collapsed behind a disclosure,
 * because a choice list showing four properties per choice buries the list itself.
 */
export function CollectionEditor({
  surface,
  owner,
  collection,
  scope,
}: CollectionEditorProps): ReactElement {
  return (
    <fieldset
      className="kajay-properties__section kajay-collection"
      data-testid={`collection-${collection.property}`}
    >
      <legend className="kajay-properties__legend">{collection.title}</legend>
      {collection.shorthand === undefined ? null : (
        <FastEntry
          surface={surface}
          owner={owner}
          collection={collection}
          shorthand={collection.shorthand}
          scope={scope}
        />
      )}
      <ol className="kajay-collection__list">
        {collection.children.map((child, index) => (
          <ChildEntry
            key={`${scope}:${collection.property}:${String(index)}`}
            surface={surface}
            owner={owner}
            collection={collection}
            child={child}
            index={index}
            scope={`${scope}-${collection.property}${String(index)}`}
          />
        ))}
      </ol>
      {collection.types.length === 0 ? null : (
        <AddChild surface={surface} owner={owner} collection={collection} />
      )}
    </fieldset>
  );
}

interface ChildProps {
  readonly surface: DesignSurface;
  readonly owner: SurveyElement;
  readonly collection: CollectionRow;
  readonly child: SurveyElement;
  readonly index: number;
  readonly scope: string;
}

/**
 * One child: what it is called, what can be done to it, and its own grid.
 *
 * A native `<details>` rather than a design-system accordion, and deliberately: it is
 * operable and announced with no ARIA and no JavaScript, so there is no behaviour here for
 * a host's own component to implement differently. [ADR-0022](../../../docs/adr/0022-design-system-primitives.md)
 * is about *controls* — the things a design system has strong opinions about — and the
 * buttons inside this one go through the map like every other button in the Creator.
 */
function ChildEntry({
  surface,
  owner,
  collection,
  child,
  index,
  scope,
}: ChildProps): ReactElement {
  const label = childLabel(child);

  return (
    <li className="kajay-collection__item" data-collection-index={String(index)}>
      <details className="kajay-collection__details">
        <summary
          className="kajay-collection__summary"
          data-testid={`open-${collection.property}-${String(index)}`}
        >
          {label}
        </summary>
        {surface.properties(child).map((category) => (
          <PropertySection
            key={category.name}
            surface={surface}
            element={child}
            category={category}
            scope={scope}
          />
        ))}
      </details>
      <ChildActions
        surface={surface}
        owner={owner}
        collection={collection}
        index={index}
        label={label}
      />
    </li>
  );
}

interface ChildActionProps {
  readonly surface: DesignSurface;
  readonly owner: SurveyElement;
  readonly collection: CollectionRow;
  readonly index: number;
  readonly label: string;
}

/**
 * Move it, and remove it.
 *
 * Buttons rather than K2's drag handle, deliberately: a choice list lives in a sidebar that
 * scrolls independently of the canvas, and the placement model measures a pointer against a
 * surface. Two buttons are operable by everyone and are the whole of what reordering four
 * choices needs; fast entry is the bulk answer for a list long enough to want one.
 *
 * Every button is **named for the thing it acts on**, because a column of bare arrows is
 * three identical announcements repeated once per choice.
 */
function ChildActions({
  surface,
  owner,
  collection,
  index,
  label,
}: ChildActionProps): ReactElement {
  const property = collection.property;
  const move = (to: number) => (): void => {
    surface.moveChild(owner, property, index, to);
  };

  return (
    <span className="kajay-collection__actions">
      <ActionButton
        className="kajay-collection__move"
        label={`Move ${label} up`}
        testId={`move-up-${property}-${String(index)}`}
        disabled={index === 0}
        onPress={move(index - 1)}
      >
        ↑
      </ActionButton>
      <ActionButton
        className="kajay-collection__move"
        label={`Move ${label} down`}
        testId={`move-down-${property}-${String(index)}`}
        disabled={index === collection.children.length - 1}
        onPress={move(index + 1)}
      >
        ↓
      </ActionButton>
      <ActionButton
        className="kajay-collection__remove"
        label={`Remove ${label}`}
        testId={`remove-${property}-${String(index)}`}
        onPress={() => {
          surface.removeChild(owner, property, index);
        }}
      >
        ✕
      </ActionButton>
    </span>
  );
}

function ActionButton({
  className,
  label,
  testId,
  disabled = false,
  onPress,
  children,
}: {
  readonly className: string;
  readonly label: string;
  readonly testId: string;
  readonly disabled?: boolean;
  readonly onPress: () => void;
  readonly children: ReactNode;
}): ReactElement {
  const { Button } = useCreatorComponents();

  return (
    <Button className={className} aria-label={label} data-testid={testId} disabled={disabled} onClick={onPress}>
      {children}
    </Button>
  );
}

/**
 * Adding a child — a button, or a picker and a button.
 *
 * Which one is read off how many concrete types the collection's base has. Asking "is this
 * the validators list" would work today and be wrong the moment a host registers a second
 * kind of choice item.
 */
function AddChild({
  surface,
  owner,
  collection,
}: {
  readonly surface: DesignSurface;
  readonly owner: SurveyElement;
  readonly collection: CollectionRow;
}): ReactElement {
  const { Button, Select } = useCreatorComponents();
  const [type, setType] = useState(collection.types[0] ?? '');
  const property = collection.property;

  return (
    <div className="kajay-collection__add">
      {collection.types.length > 1 ? (
        <Select
          className="kajay-collection__type"
          aria-label={`Kind of ${collection.title.toLowerCase()} to add`}
          data-testid={`add-type-${property}`}
          value={type}
          options={collection.types.map((name) => ({ value: name, label: name }))}
          onValueChange={setType}
        />
      ) : null}
      <Button
        className="kajay-collection__add-button"
        data-testid={`add-${property}`}
        onClick={() => {
          surface.addChild(owner, property, type);
        }}
      >
        {`Add to ${collection.title.toLowerCase()}`}
      </Button>
    </div>
  );
}

/**
 * The whole collection as text — checklist L2's fast entry.
 *
 * A draft, for L1's reason and one more of its own: this field is unparseable in the middle
 * of every edit — a half-typed line is a value nobody meant — and a field driven from the
 * model would rewrite the list on every keystroke. It commits **on blur**, so a rewritten
 * choice list is one edit and one press of undo rather than one per character.
 */
function FastEntry({
  surface,
  owner,
  collection,
  shorthand,
  scope,
}: {
  readonly surface: DesignSurface;
  readonly owner: SurveyElement;
  readonly collection: CollectionRow;
  readonly shorthand: string;
  readonly scope: string;
}): ReactElement {
  const { Textarea } = useCreatorComponents();
  const text = fastEntryText(
    collection.children.map((child) => toDefinition(child, shorthand)),
    shorthand,
    surface.survey.locale,
  );
  const [state, setState] = useState({ draft: text, shown: text });
  if (state.shown !== text) {
    setState({ draft: text, shown: text });
  }
  const id = `kajay-fast-${scope}-${collection.property}`;

  return (
    <div className="kajay-collection__fast">
      <PropertyLabel htmlFor={id} hasHint>
        {`${collection.title}, one per line`}
      </PropertyLabel>
      <Textarea
        className="kajay-collection__fast-text"
        id={id}
        rows={Math.min(Math.max(collection.children.length + 1, 3), 10)}
        data-testid={`fast-${collection.property}`}
        aria-describedby={`${id}-hint`}
        value={state.draft}
        onValueChange={(next) => {
          setState({ draft: next, shown: text });
        }}
        onBlur={() => {
          surface.setFastEntry(owner, collection.property, state.draft);
        }}
      />
      <p className="kajay-properties__hint" id={`${id}-hint`}>
        Write one item per line, as value or value|text.
      </p>
    </div>
  );
}

/**
 * The little of a child fast entry reads, taken off the model.
 *
 * Reading the model rather than serializing the survey per render: the two agree on these
 * properties by construction, and `fastEntryText` needs a shorthand value and a text.
 */
function toDefinition(child: SurveyElement, shorthand: string): Record<string, unknown> {
  return {
    [shorthand]: child.getResolvedProperty(shorthand),
    text: child.getPropertyValue('text'),
  };
}
