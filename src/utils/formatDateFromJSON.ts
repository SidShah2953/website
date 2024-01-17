export default function formatDateFromJSON(date: string) {
  return new Date(Date.parse(date));
}