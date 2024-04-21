import { take } from "lodash-es";

export function toShifted<TItem>(array: TItem[], firstItem: TItem): TItem[] {
  const index = array.indexOf(firstItem);
  return index === -1
    ? array.slice()
    : array.slice(index).concat(take(array, index));
}
