import { handleCalendar } from "../server/calendar.js";

export function GET() {
  return handleCalendar();
}
