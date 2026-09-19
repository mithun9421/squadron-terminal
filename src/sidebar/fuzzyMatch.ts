/** Scores how well `query`'s characters appear, in order, within `text`
 * (case-insensitive). Returns `null` when some character of `query` never
 * appears after the previous match. Lower scores are better matches — the
 * score is the total gap (in characters) between consecutive matches, so a
 * contiguous, early substring match scores lowest. An empty query matches
 * everything with the best possible score. */
export function fuzzyMatch(query: string, text: string): number | null {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return 0;
  }

  const haystack = text.toLowerCase();
  let searchFrom = 0;
  let score = 0;
  let previousIndex = -1;

  for (const char of needle) {
    const foundAt = haystack.indexOf(char, searchFrom);
    if (foundAt === -1) {
      return null;
    }
    if (previousIndex !== -1) {
      score += foundAt - previousIndex - 1;
    } else {
      score += foundAt;
    }
    previousIndex = foundAt;
    searchFrom = foundAt + 1;
  }

  return score;
}
