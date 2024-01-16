export default function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {dateStyle: 'short',}).format(date);
}
