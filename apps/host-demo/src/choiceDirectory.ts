import type { ChoicePage, ChoicePageLoader } from '@kajay/core';

/**
 * A directory too long to send at once — checklist C5 and C6.
 *
 * Twenty-eight entries rather than twenty-eight thousand, because what the row is about
 * is the *seam*: the question asks for an offset, a size and a term, and the host
 * answers with a page and whether there is more. A host with a real directory answers
 * the same three parameters against a database instead of an array.
 */
const CITIES: readonly string[] = [
  'Aberdeen',
  'Belfast',
  'Birmingham',
  'Brighton',
  'Bristol',
  'Cambridge',
  'Cardiff',
  'Coventry',
  'Derby',
  'Dundee',
  'Edinburgh',
  'Exeter',
  'Glasgow',
  'Inverness',
  'Leeds',
  'Leicester',
  'Liverpool',
  'London',
  'Manchester',
  'Newcastle',
  'Newport',
  'Norwich',
  'Nottingham',
  'Oxford',
  'Plymouth',
  'Portsmouth',
  'Sheffield',
  'Southampton',
];

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * The loader a host passes as `loadChoicePage`.
 *
 * Filters where the data is, which is the whole point: narrowing after the page had
 * travelled could only search the part that already arrived.
 */
export const loadChoicePage: ChoicePageLoader = async ({
  skip,
  take,
  filter,
}): Promise<ChoicePage> => {
  await delay(50);
  const matching = CITIES.filter((city) =>
    city.toLowerCase().includes(filter.toLowerCase()),
  );
  const items = matching.slice(skip, skip + take);
  return {
    items: items.map((city) => ({ value: city })),
    // Reported rather than inferred from a short page: only the host knows what is
    // behind the one it just sent.
    hasMore: skip + items.length < matching.length,
  };
};
