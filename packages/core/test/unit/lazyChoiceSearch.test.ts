import { describe, expect, test } from 'vitest';
import { choiceTexts as texts, paged } from '../support/FakeChoiceDirectory.js';

describe('parity/C5-lazy-search', () => {
  test('a filter goes to the host, because the match may never have been loaded', async () => {
    const { question, directory } = paged();
    await directory.reply();

    question.setChoiceFilter('gl');
    expect(directory.asked.at(-1)).toEqual({
      questionName: 'city',
      // From zero: a term is a different list, not more of the same one.
      skip: 0,
      take: 3,
      filter: 'gl',
    });
    await directory.reply();

    // Glasgow is on the last page, and no amount of filtering what had arrived would
    // have found it.
    expect(texts(question)).toEqual(['Glasgow']);
    expect(question.choiceFilter).toBe('gl');
  });

  test('a reply for a term the respondent has moved on from is discarded', async () => {
    const { question, directory } = paged();
    await directory.reply();

    question.setChoiceFilter('br');
    question.setChoiceFilter('ca');
    // The current term is answered first, and the abandoned one arrives *after* it —
    // the order that actually catches a pager which applies whatever comes back.
    await directory.reply(2);
    await directory.reply(1);

    // A list showing Bristol under a box that says 'ca' is worse than an empty one.
    expect(texts(question)).toEqual(['Cardiff']);
    expect(question.isLoadingChoices).toBe(false);
  });

  test('the same term again is not a new request', async () => {
    const { question, directory } = paged();
    await directory.reply();

    question.setChoiceFilter('br');
    await directory.reply();
    question.setChoiceFilter(' br ');

    expect(directory.asked).toHaveLength(2);
  });

  test('local filtering steps aside for a paged list', async () => {
    const { question, directory } = paged();
    await directory.reply();

    // The host already narrowed it. Narrowing again here would hide choices the host
    // deliberately returned, and would still never find the ones that never arrived.
    expect(question.filterChoices('zzz')).toEqual(question.visibleChoices);
  });
});

describe('parity/C6-lazy-tagbox', () => {
  test('a multi-select pages on exactly the same terms', async () => {
    const { question, directory } = paged({}, 'tagbox');
    await directory.reply();
    question.loadMoreChoices();
    await directory.reply();

    expect(texts(question)).toHaveLength(6);

    // And the selection rules are untouched by where the choices came from.
    question.select('Aberdeen');
    question.select('Dundee');
    expect(question.value).toEqual(['Aberdeen', 'Dundee']);
  });

  test('an answer survives a filter that hides the choice it names', async () => {
    const { question, directory } = paged({}, 'tagbox');
    await directory.reply();
    question.select('Aberdeen');

    question.setChoiceFilter('cardiff');
    await directory.reply();

    // The respondent's answer is not a function of what the list is showing. Dropping
    // it because a search term hid the choice would lose an answer to a keystroke.
    expect(question.value).toEqual(['Aberdeen']);
  });
});
