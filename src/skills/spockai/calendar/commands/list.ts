/**
 * SpockAI Calendar List Command
 * Display upcoming appointments
 */

import type { CommandResult } from '../../types/index.js';
import type { CommandContext } from '../../base/skill.js';
import type { Appointment, TimeWindow, CalendarConfig } from '../types.js';
import { CalendarService, createCalendarService } from '../service.js';

let calendarService: CalendarService | null = null;

function getCalendarService(): CalendarService {
  if (!calendarService) {
    calendarService = createCalendarService();
  }
  return calendarService;
}

interface ListResult {
  window: TimeWindow;
  appointments: Appointment[];
  count: number;
}

/**
 * Calendar list command handler
 */
export async function listCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult<ListResult>> {
  const service = getCalendarService();

  try {
    const window = parseTimeWindow(args[0]) ?? 'today';
    const appointments = service.getAppointmentsByWindow(window);

    let message = formatAppointments(window, appointments);

    return {
      success: true,
      data: {
        window,
        appointments,
        count: appointments.length
      },
      message
    };
  } catch (error) {
    context.logger.error('Failed to list appointments', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list appointments'
    };
  }
}

function parseTimeWindow(arg?: string): TimeWindow | undefined {
  if (!arg) return undefined;

  const normalized = arg.toLowerCase();
  if (['today', 'tomorrow', 'week', 'month'].includes(normalized)) {
    return normalized as TimeWindow;
  }
  return undefined;
}

function formatAppointments(window: TimeWindow, appointments: Appointment[]): string {
  const windowLabels: Record<TimeWindow, string> = {
    today: "Today's",
    tomorrow: "Tomorrow's",
    week: 'This Week\'s',
    month: 'This Month\'s'
  };

  let message = `**${windowLabels[window]} Appointments**\n\n`;

  if (appointments.length === 0) {
    message += '_No appointments scheduled_\n';
    return message;
  }

  for (const appt of appointments) {
    const time = appt.isAllDay
      ? 'All Day'
      : formatTime(appt.startTime);
    const statusIcon = getStatusIcon(appt.status);

    message += `${statusIcon} **${time}** - ${appt.title}\n`;

    if (appt.location) {
      message += `   📍 ${appt.location}\n`;
    }

    if (appt.attendees.length > 0) {
      const attendeeCount = appt.attendees.length;
      message += `   👥 ${attendeeCount} attendee${attendeeCount !== 1 ? 's' : ''}\n`;
    }

    message += '\n';
  }

  message += `_${appointments.length} appointment${appointments.length !== 1 ? 's' : ''}_`;
  return message;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'confirmed':
      return '✅';
    case 'tentative':
      return '❓';
    case 'cancelled':
      return '❌';
    default:
      return '📅';
  }
}
