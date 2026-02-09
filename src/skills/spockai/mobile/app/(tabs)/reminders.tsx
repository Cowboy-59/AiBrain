import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReminderStore, Reminder } from '../../store/reminders';

export default function RemindersScreen() {
  const { reminders, addReminder, deleteReminder, loadReminders } = useReminderStore();
  const [showAdd, setShowAdd] = useState(false);
  const [newText, setNewText] = useState('');
  const [newTime, setNewTime] = useState('');

  useEffect(() => {
    loadReminders();
  }, []);

  const pendingReminders = reminders.filter(
    (r) => !r.completed && new Date(r.time) > new Date()
  );

  async function handleAdd() {
    if (!newText.trim() || !newTime.trim()) {
      Alert.alert('Error', 'Please enter reminder text and time');
      return;
    }

    try {
      await addReminder(newText.trim(), newTime.trim());
      setNewText('');
      setNewTime('');
      setShowAdd(false);
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  }

  function handleDelete(id: string) {
    Alert.alert('Delete Reminder', 'Are you sure you want to delete this reminder?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteReminder(id) },
    ]);
  }

  function renderReminder({ item }: { item: Reminder }) {
    const time = new Date(item.time);
    const isToday = time.toDateString() === new Date().toDateString();
    const timeStr = isToday
      ? time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : time.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });

    return (
      <View style={styles.reminderItem}>
        <View style={styles.reminderContent}>
          <Text style={styles.reminderText}>{item.text}</Text>
          <Text style={styles.reminderTime}>{timeStr}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id)}
        >
          <Text style={styles.deleteButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {showAdd && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.input}
            value={newText}
            onChangeText={setNewText}
            placeholder="Remind me to..."
            placeholderTextColor="#666"
          />
          <TextInput
            style={styles.input}
            value={newTime}
            onChangeText={setNewTime}
            placeholder='Time (e.g., "30 min", "3pm", "tomorrow 9am")'
            placeholderTextColor="#666"
          />
          <View style={styles.addButtons}>
            <TouchableOpacity
              style={[styles.formButton, styles.cancelButton]}
              onPress={() => setShowAdd(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.formButton, styles.saveButton]}
              onPress={handleAdd}
            >
              <Text style={styles.saveButtonText}>Add Reminder</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {pendingReminders.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>⏰</Text>
          <Text style={styles.emptyText}>No reminders yet</Text>
          <Text style={styles.emptySubtext}>
            Add a reminder or ask SpockAI to set one for you
          </Text>
        </View>
      ) : (
        <FlatList
          data={pendingReminders}
          renderItem={renderReminder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
        />
      )}

      {!showAdd && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4285f4',
  },
  reminderContent: {
    flex: 1,
  },
  reminderText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 4,
  },
  reminderTime: {
    color: '#888',
    fontSize: 12,
  },
  deleteButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#ea4335',
    fontSize: 18,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  addForm: {
    padding: 16,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
    gap: 12,
  },
  input: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
  },
  addButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  formButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#2d2d44',
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#4285f4',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4285f4',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
  },
});
