/**
 * The words a repeating template's expressions use for the record they are in.
 *
 * Language constants with no imports of their own, deliberately: the model spends them
 * when it evaluates a cell, the registry declares them so an authoring tool can read
 * them, and a file either layer owned would be a cycle between the two.
 */

/** `{row.size}` — the matrix row being drawn, rather than the column of that name. */
export const ROW_SCOPE = 'row';

/** `{panel.who}` — the panel instance being drawn. */
export const PANEL_SCOPE = 'panel';
