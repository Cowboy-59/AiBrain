/**
 * SpockAI Calendar Types
 * Type definitions for calendar integration
 */

import type { BaseEntity, OAuthCredentials } from '../types/index.js';

// Calendar provider types
export type CalendarProvider = 'google' | 'microsoft';

// Calendar source configuration
export interface CalendarSource extends BaseEntity {
  name: string;
  provider: CalendarProvider;
  calendarId: string;
  credentials: OAuthCredentials;
  isShared: boolean;
  ownerEmail?: string;
  enabled: boolean;
  color?: string;
  lastSync?: Date;
  lastError?: string;
}

// Appointment/Event
export interface Appointment extends BaseEntity {
  calendarId: string;
  eventId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  isAllDay: boolean;
  attendees: Attendee[];
  reminderSent: boolean;
  recurrence?: RecurrenceRule;
  status: EventStatus;
  htmlLink?: string;
}

// Attendee
export interface Attendee {
  email: string;
  name?: string;
  responseStatus: AttendeeResponse;
  isOrganizer?: boolean;
}

export type AttendeeResponse = 'accepted' | 'declined' | 'tentative' | 'needsAction';

// Event status
export type EventStatus = 'confirmed' | 'tentative' | 'cancelled';

// Recurrence rule (simplified)
export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  until?: Date;
  count?: number;
}

// Calendar sync result
export interface CalendarSyncResult {
  calendarId: string;
  calendarName: string;
  eventsFound: number;
  upcomingEvents: number;
  syncedAt: Date;
  error?: string;
}

// Calendar filter options
export interface CalendarFilterOptions {
  calendarId?: string;
  startDate?: Date;
  endDate?: Date;
  includeAllDay?: boolean;
  limit?: number;
}

// Calendar status
export interface CalendarStatus {
  id: string;
  name: string;
  provider: CalendarProvider;
  enabled: boolean;
  isShared: boolean;
  lastSync?: Date;
  lastError?: string;
  eventCount: number;
}

// Calendar reminder configuration
export interface ReminderConfig {
  leadTime: number; // Minutes before event
  enabled: boolean;
}

// Default time windows
export type TimeWindow = 'today' | 'tomorrow' | 'week' | 'month';

// Calendar configuration
export interface CalendarConfig {
  sources: CalendarSource[];
  defaultWindow: TimeWindow;
  reminderLeadTime: number; // Default minutes before event for reminders
}
