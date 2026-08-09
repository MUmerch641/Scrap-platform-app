const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_VALUE_PATTERN = /^(\d{2}):(\d{2})/;

export function formatPickupCalendarDate(value: string): string {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) return value;

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
  );
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatPickupTime(value: string | null): string | null {
  if (!value) return null;
  const match = TIME_VALUE_PATTERN.exec(value);
  if (!match) return value;

  const hours = Number(match[1]);
  const minutes = match[2];
  if (hours > 23) return value;

  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${suffix}`;
}

export function formatPickupWeight(value: number | null): string | null {
  if (value === null) return null;
  return `${value.toLocaleString('en-AU', { maximumFractionDigits: 3 })} kg`;
}

export function formatPickupCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
