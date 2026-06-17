export const WEEK_DAY_LABELS = ["Pn", "Wt", "Sr", "Cz", "Pt", "So", "Nd"];

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildMonthParam(date: Date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

function parseMonthParam(monthParam?: string) {
  if (!monthParam) {
    return null;
  }

  const match = monthParam.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, 1));
}

export function buildMonthView(monthParam?: string) {
  const now = new Date();
  const baseDate =
    parseMonthParam(monthParam) ??
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthStart = new Date(
    Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1),
  );
  const monthEnd = new Date(
    Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 0),
  );
  const startWeekday = (monthStart.getUTCDay() + 6) % 7;
  const gridStart = addDays(monthStart, -startWeekday);
  const days: { isoDate: string; dayNumber: number; isCurrentMonth: boolean }[] = [];

  for (let index = 0; index < 42; index += 1) {
    const current = addDays(gridStart, index);
    days.push({
      isoDate: toIsoDate(current),
      dayNumber: current.getUTCDate(),
      isCurrentMonth: current >= monthStart && current <= monthEnd,
    });
  }

  const previousMonth = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1),
  );
  const nextMonth = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1),
  );

  return {
    monthStart,
    monthEnd,
    monthParam: buildMonthParam(monthStart),
    previousMonthParam: buildMonthParam(previousMonth),
    nextMonthParam: buildMonthParam(nextMonth),
    monthLabel: new Intl.DateTimeFormat("pl-PL", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(monthStart),
    days,
  };
}
