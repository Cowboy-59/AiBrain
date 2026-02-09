import Anthropic from '@anthropic-ai/sdk';
import { useReminderStore } from '../store/reminders';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Tool definitions for Claude
export const tools: Anthropic.Tool[] = [
  {
    name: 'create_reminder',
    description:
      'Set a reminder for a specific time. Use this when the user wants to be reminded about something later.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: {
          type: 'string',
          description: 'What to remind the user about',
        },
        time: {
          type: 'string',
          description:
            'When to remind. Accepts: "30 minutes", "2 hours", "3pm", "15:00", or ISO date',
        },
      },
      required: ['text', 'time'],
    },
  },
  {
    name: 'list_reminders',
    description: 'List all reminders. Use this when the user asks about their reminders.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filter: {
          type: 'string',
          enum: ['pending', 'completed', 'all'],
          description: 'Filter reminders: pending (default), completed, or all',
        },
      },
      required: [],
    },
  },
  {
    name: 'delete_reminder',
    description: 'Delete/cancel a reminder. Use this when the user wants to remove a reminder.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reminder_id: {
          type: 'string',
          description: 'The reminder ID to delete',
        },
      },
      required: ['reminder_id'],
    },
  },
  {
    name: 'create_note',
    description:
      'Create a new note. Use this when the user wants to save information, make a note, or remember something.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Title of the note',
        },
        content: {
          type: 'string',
          description: 'Content/body of the note',
        },
        tags: {
          type: 'string',
          description: 'Comma-separated tags for organization (optional)',
        },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'search_notes',
    description:
      'Search through notes. Use this when the user wants to find a note or look up saved information.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search term to find in note titles, content, or tags',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_notes',
    description: 'List all notes. Use this when the user wants to see their notes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum notes to return (default 20)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_daily_briefing',
    description:
      'Get a daily briefing summary. Use this when the user asks for their daily briefing or morning summary.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

// Notes storage
const NOTES_KEY = 'spockai_notes';

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created: string;
  updated: string;
}

async function loadNotes(): Promise<Note[]> {
  try {
    const stored = await AsyncStorage.getItem(NOTES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

async function saveNotes(notes: Note[]): Promise<void> {
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

// Tool execution
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case 'create_reminder': {
      const { addReminder } = useReminderStore.getState();
      try {
        const reminder = await addReminder(
          input.text as string,
          input.time as string
        );
        return {
          success: true,
          id: reminder.id,
          text: reminder.text,
          time: reminder.time,
          timeFormatted: new Date(reminder.time).toLocaleString(),
        };
      } catch (error) {
        return { error: (error as Error).message };
      }
    }

    case 'list_reminders': {
      const { reminders } = useReminderStore.getState();
      const filter = (input.filter as string) || 'pending';
      const now = new Date();

      let filtered = reminders;
      if (filter === 'pending') {
        filtered = reminders.filter(
          (r) => !r.completed && new Date(r.time) > now
        );
      } else if (filter === 'completed') {
        filtered = reminders.filter((r) => r.completed);
      }

      return {
        filter,
        count: filtered.length,
        reminders: filtered.map((r) => ({
          id: r.id,
          text: r.text,
          time: r.time,
          timeFormatted: new Date(r.time).toLocaleString(),
          completed: r.completed,
        })),
      };
    }

    case 'delete_reminder': {
      const { deleteReminder } = useReminderStore.getState();
      try {
        await deleteReminder(input.reminder_id as string);
        return { success: true, deleted: input.reminder_id };
      } catch (error) {
        return { error: (error as Error).message };
      }
    }

    case 'create_note': {
      const notes = await loadNotes();
      const id = `note-${Date.now()}`;
      const tags = input.tags
        ? (input.tags as string).split(',').map((t) => t.trim())
        : [];

      const note: Note = {
        id,
        title: input.title as string,
        content: input.content as string,
        tags,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };

      notes.push(note);
      await saveNotes(notes);

      return {
        success: true,
        id,
        title: note.title,
        tagsCount: tags.length,
      };
    }

    case 'search_notes': {
      const notes = await loadNotes();
      const query = (input.query as string).toLowerCase();

      const matches = notes.filter(
        (note) =>
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query) ||
          note.tags.some((tag) => tag.toLowerCase().includes(query))
      );

      return {
        query: input.query,
        count: matches.length,
        notes: matches.map((n) => ({
          id: n.id,
          title: n.title,
          preview:
            n.content.substring(0, 100) + (n.content.length > 100 ? '...' : ''),
          tags: n.tags,
          updated: n.updated,
        })),
      };
    }

    case 'list_notes': {
      const notes = await loadNotes();
      const limit = (input.limit as number) || 20;

      // Sort by updated date, most recent first
      notes.sort(
        (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime()
      );

      return {
        count: notes.length,
        notes: notes.slice(0, limit).map((n) => ({
          id: n.id,
          title: n.title,
          preview:
            n.content.substring(0, 50) + (n.content.length > 50 ? '...' : ''),
          tags: n.tags,
          updated: n.updated,
        })),
      };
    }

    case 'get_daily_briefing': {
      const { reminders } = useReminderStore.getState();
      const now = new Date();

      // Get pending reminders for today
      const todayReminders = reminders.filter((r) => {
        if (r.completed) return false;
        const time = new Date(r.time);
        return (
          time > now &&
          time.toDateString() === now.toDateString()
        );
      });

      return {
        timestamp: now.toISOString(),
        greeting: getGreeting(),
        sections: [
          {
            title: "Today's Reminders",
            summary: `${todayReminders.length} reminders today`,
            items: todayReminders.map((r) => ({
              text: r.text,
              detail: new Date(r.time).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              }),
            })),
          },
        ],
        note: 'Calendar and email integrations require additional setup in settings.',
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning!';
  if (hour < 17) return 'Good afternoon!';
  return 'Good evening!';
}
