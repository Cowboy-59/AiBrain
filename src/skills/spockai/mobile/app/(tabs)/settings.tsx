import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConfigStore } from '../../store/config';

export default function SettingsScreen() {
  const { config, updateConfig, clearConfig, isConfigured } = useConfigStore();
  const [apiKey, setApiKey] = useState(config.anthropicApiKey || '');
  const [telegramToken, setTelegramToken] = useState(config.telegramBotToken || '');
  const [telegramChatId, setTelegramChatId] = useState(config.telegramChatId || '');

  async function handleSave() {
    try {
      await updateConfig({
        anthropicApiKey: apiKey.trim(),
        telegramBotToken: telegramToken.trim(),
        telegramChatId: telegramChatId.trim(),
      });
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    }
  }

  function handleClear() {
    Alert.alert(
      'Clear All Settings',
      'This will remove all your saved credentials. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearConfig();
            setApiKey('');
            setTelegramToken('');
            setTelegramChatId('');
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Configuration</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status:</Text>
            <View
              style={[
                styles.statusBadge,
                isConfigured ? styles.statusBadgeActive : styles.statusBadgeInactive,
              ]}
            >
              <Text style={styles.statusText}>
                {isConfigured ? 'Connected' : 'Not configured'}
              </Text>
            </View>
          </View>
          <Text style={styles.inputLabel}>Anthropic API Key</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="sk-ant-..."
            placeholderTextColor="#666"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.hint}>
            Get your API key from console.anthropic.com
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Telegram Integration</Text>
          <Text style={styles.inputLabel}>Bot Token</Text>
          <TextInput
            style={styles.input}
            value={telegramToken}
            onChangeText={setTelegramToken}
            placeholder="123456789:ABC..."
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.inputLabel}>Chat ID</Text>
          <TextInput
            style={styles.input}
            value={telegramChatId}
            onChangeText={setTelegramChatId}
            placeholder="Your Telegram chat ID"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
          <Text style={styles.hint}>
            Create a bot via @BotFather and get your chat ID from @userinfobot
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>AI Model</Text>
            <Text style={styles.aboutValue}>Claude Sonnet 4</Text>
          </View>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Text style={styles.clearButtonText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    padding: 16,
    gap: 24,
  },
  section: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  statusLabel: {
    color: '#888',
    fontSize: 14,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(52, 168, 83, 0.2)',
  },
  statusBadgeInactive: {
    backgroundColor: 'rgba(234, 67, 53, 0.2)',
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
  },
  inputLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
  },
  hint: {
    color: '#666',
    fontSize: 12,
    marginTop: 8,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  aboutLabel: {
    color: '#888',
    fontSize: 14,
  },
  aboutValue: {
    color: '#fff',
    fontSize: 14,
  },
  buttons: {
    gap: 12,
  },
  saveButton: {
    height: 50,
    backgroundColor: '#4285f4',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    height: 50,
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#ea4335',
    fontSize: 16,
  },
});
