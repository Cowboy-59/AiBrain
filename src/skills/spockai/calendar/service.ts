/**
 * SpockAI Calendar Service
 * Core calendar management service
 */

import type {
  CalendarSource,
  Appointment,
  CalendarSyncResult,
  CalendarFilterOptions,
  CalendarStatus,
  TimeWindow
} from './types.js';
import { calendarLogger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

/**
 * Calendar Service
 * Manages calendar sources, syncing, and event retrieval
 */
export class CalendarService {
  private sources: Map<string, CalendarSource> = new Map();
  private appointments: Map<string, Appointment[]> = new Map(); // calendarId -> appointments
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    calendarLogger.info('Calendar service initialized');
  }

  /**
   * Add a calendar source
   */
  async addSource(source: Omit<CalendarSource, 'id'>): Promise<CalendarSource> {
    const id = randomUUID();
    const newSource: CalendarSource = {
      ...source,
      id
    };

    this.sources.set(id, newSource);
    this.appointments.set(id, []);

    calendarLogger.info('Calendar source added', {
      id,
      name: source.name,
      provider: source.provider
    });

    if (source.enabled) {
      await this.syncSource(id);
    }

    return newSource;
  }

  /**
   * Remove a calendar source
   */
  async removeSource(sourceId: string): Promise<boolean> {
    const source = this.sources.get(sourceId);
    if (!source) {
      return false;
    }

    this.stopSync(sourceId);
    this.sources.delete(sourceId);
    this.appointments.delete(sourceId);

    calendarLogger.info('Calendar source removed', { id: sourceId, name: source.name });
    return true;
  }

  /**
   * Get all calendar sources
   */
  getSources(): CalendarSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Sync a calendar source
   */
  async syncSource(sourceId: string): Promise<CalendarSyncResult> {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new Error(`Calendar source not found: ${sourceId}`);
    }

    calendarLogger.info('Syncing calendar', { sourceId, name: source.name });

    try {
      let events: Appointment[] = [];

      if (source.provider === 'google') {
        events = await this.syncGoogleCalendar(source);
      } else if (source.provider === 'microsoft') {
        events = await this.syncMicrosoftCalendar(source);
      }

      this.appointments.set(sourceId, events);
      source.lastSync = new Date();
      source.lastError = undefined;

      const now = new Date();
      const upcomingEvents = events.filter(e => e.startTime > now).length;

      const result: CalendarSyncResult = {
        calendarId: sourceId,
        calendarName: source.name,
        eventsFound: events.length,
        upcomingEvents,
        syncedAt: new Date()
      };

      calendarLogger.info('Calendar sync complete', result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      source.lastError = errorMessage;

      calendarLogger.error('Calendar sync failed', { sourceId, error: errorMessage });

      return {
        calendarId: sourceId,
        calendarName: source.name,
        eventsFound: 0,
        upcomingEvents: 0,
        syncedAt: new Date(),
        error: errorMessage
      };
    }
  }

  /**
   * Sync all sources
   */
  async syncAllSources(): Promise<CalendarSyncResult[]> {
    const results: CalendarSyncResult[] = [];

    for (const source of this.sources.values()) {
      if (source.enabled) {
        const result = await this.syncSource(source.id);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get appointments with filtering
   */
  getAppointments(options: CalendarFilterOptions = {}): Appointment[] {
    let allAppointments: Appointment[] = [];

    if (options.calendarId) {
      allAppointments = this.appointments.get(options.calendarId) ?? [];
    } else {
      for (const appointments of this.appointments.values()) {
        allAppointments.push(...appointments);
      }
    }

    // Apply filters
    let filtered = allAppointments;

    if (options.startDate) {
      filtered = filtered.filter(a => a.endTime >= options.startDate!);
    }

    if (options.endDate) {
      filtered = filtered.filter(a => a.startTime <= options.endDate!);
    }

    if (options.includeAllDay === false) {
      filtered = filtered.filter(a => !a.isAllDay);
    }

    // Sort by start time
    filtered.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    // Apply limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get appointments for a time window
   */
  getAppointmentsByWindow(window: TimeWindow): Appointment[] {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let startDate: Date;
    let endDate: Date;

    switch (window) {
      case 'today':
        startDate = startOfDay;
        endDate = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'tomorrow':
        startDate = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        endDate = new Date(startOfDay.getTime() + 48 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = startOfDay;
        endDate = new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = startOfDay;
        endDate = new Date(startOfDay.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
    }

    return this.getAppointments({ startDate, endDate });
  }

  /**
   * Get upcoming appointments (next N events)
   */
  getUpcomingAppointments(limit: number = 10): Appointment[] {
    const now = new Date();
    return this.getAppointments({ startDate: now, limit });
  }

  /**
   * Get calendar statuses
   */
  getSourceStatuses(): CalendarStatus[] {
    return Array.from(this.sources.values()).map(source => {
      const appointments = this.appointments.get(source.id) ?? [];
      return {
        id: source.id,
        name: source.name,
        provider: source.provider,
        enabled: source.enabled,
        isShared: source.isShared,
        lastSync: source.lastSync,
        lastError: source.lastError,
        eventCount: appointments.length
      };
    });
  }

  /**
   * Mark reminder as sent
   */
  markReminderSent(appointmentId: string): boolean {
    for (const appointments of this.appointments.values()) {
      const appointment = appointments.find(a => a.id === appointmentId);
      if (appointment) {
        appointment.reminderSent = true;
        return true;
      }
    }
    return false;
  }

  /**
   * Get appointments needing reminders
   */
  getAppointmentsNeedingReminders(leadTimeMinutes: number): Appointment[] {
    const now = new Date();
    const reminderWindow = new Date(now.getTime() + leadTimeMinutes * 60 * 1000);

    const allAppointments: Appointment[] = [];
    for (const appointments of this.appointments.values()) {
      allAppointments.push(...appointments);
    }

    return allAppointments.filter(a =>
      !a.reminderSent &&
      a.startTime > now &&
      a.startTime <= reminderWindow
    );
  }

  /**
   * Stop sync for a source
   */
  private stopSync(sourceId: string): void {
    const interval = this.syncIntervals.get(sourceId);
    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(sourceId);
    }
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    for (const sourceId of this.syncIntervals.keys()) {
      this.stopSync(sourceId);
    }
  }

  // Provider-specific sync methods (stubs)

  private async syncGoogleCalendar(_source: CalendarSource): Promise<Appointment[]> {
    // Google Calendar API integration would go here
    calendarLogger.warn('Google Calendar sync not yet implemented');
    return [];
  }

  private async syncMicrosoftCalendar(_source: CalendarSource): Promise<Appointment[]> {
    // Microsoft Graph API integration would go here
    calendarLogger.warn('Microsoft Calendar sync not yet implemented');
    return [];
  }
}

/**
 * Create calendar service
 */
export function createCalendarService(): CalendarService {
  return new CalendarService();
}
