import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

export interface Reminder {
  id: string;
  text: string;
  time: string;
  created: string;
  completed: boolean;
}

interface ReminderStore {
  reminders: Reminder[];
  loadReminders: () => Promise<void>;
  addReminder: (text: string, timeInput: string) => Promise<Reminder>;
  deleteReminder: (id: string) => Promise<void>;
  completeReminder: (id: string) => Promise<void>;
}

const STORAGE_KEY = 'spockai_reminders';

function parseTimeInput(input: string): Date {
  const now = new Date();

  // "30 min", "30 minutes", "30m"
  const minMatch = input.match(/^(\d+)\s*(min|minutes?|m)$/i);
  if (minMatch) {
    return new Date(now.getTime() + parseInt(minMatch[1]) * 60 * 1000);
  }

  // "2 hours", "2h"
  const hourMatch = input.match(/^(\d+)\s*(hours?|h)$/i);
  if (hourMatch) {
    return new Date(now.getTime() + parseInt(hourMatch[1]) * 60 * 60 * 1000);
  }

  // "3pm", "3:30pm", "15:00"
  const timeMatch = input.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const meridiem = timeMatch[3]?.toLowerCase();

    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;

    const result = new Date(now);
    result.setHours(hours, minutes, 0, 0);

    // If time is in past, assume tomorrow
    if (result <= now) {
      result.setDate(result.getDate() + 1);
    }
    return result;
  }

  // Try parsing as date string
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  throw new Error(`Invalid time format: ${input}`);
}

async function scheduleNotification(reminder: Reminder) {
  const triggerTime = new Date(reminder.time);
  const now = new Date();

  if (triggerTime > now) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Reminder',
        body: reminder.text,
        data: { reminderId: reminder.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerTime,
      },
    });
  }
}

export const useReminderStore = create<ReminderStore>((set, get) => ({
  reminders: [],

  loadReminders: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const reminders = JSON.parse(stored) as Reminder[];
        set({ reminders });

        // Reschedule pending reminders
        const now = new Date();
        for (const reminder of reminders) {
          if (!reminder.completed && new Date(reminder.time) > now) {
            await scheduleNotification(reminder);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load reminders:', error);
    }
  },

  addReminder: async (text, timeInput) => {
    const reminderTime = parseTimeInput(timeInput);

    const reminder: Reminder = {
      id: `reminder-${Date.now()}`,
      text,
      time: reminderTime.toISOString(),
      created: new Date().toISOString(),
      completed: false,
    };

    const newReminders = [...get().reminders, reminder];

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newReminders));
      await scheduleNotification(reminder);
      set({ reminders: newReminders });
      return reminder;
    } catch (error) {
      console.error('Failed to add reminder:', error);
      throw new Error('Failed to save reminder');
    }
  },

  deleteReminder: async (id) => {
    const newReminders = get().reminders.filter((r) => r.id !== id);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newReminders));
      // Cancel scheduled notification
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      const toCancel = notifications.find(
        (n) => n.content.data?.reminderId === id
      );
      if (toCancel) {
        await Notifications.cancelScheduledNotificationAsync(toCancel.identifier);
      }
      set({ reminders: newReminders });
    } catch (error) {
      console.error('Failed to delete reminder:', error);
      throw new Error('Failed to delete reminder');
    }
  },

  completeReminder: async (id) => {
    const newReminders = get().reminders.map((r) =>
      r.id === id ? { ...r, completed: true } : r
    );

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newReminders));
      set({ reminders: newReminders });
    } catch (error) {
      console.error('Failed to complete reminder:', error);
    }
  },
}));
