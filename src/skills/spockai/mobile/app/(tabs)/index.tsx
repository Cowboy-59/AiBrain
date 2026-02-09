import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { chatWithAI } from '../../services/claude';
import { useConfigStore } from '../../store/config';

interface Message {
  id: string;
  text: string;
  type: 'user' | 'ai' | 'system' | 'error';
  time: string;
}

const quickActions = [
  { emoji: '☀️', label: 'Briefing', message: 'Give me my daily briefing' },
  { emoji: '📋', label: 'Tasks', message: 'What are my tasks?' },
  { emoji: '📅', label: 'Calendar', message: "What's on my calendar today?" },
  { emoji: '⏰', label: 'Reminders', message: 'Show my reminders' },
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: `Welcome! I'm SpockAI, your AI-powered personal assistant. I can help you with:

• Daily Briefing - Get your morning summary
• Calendar - View and create events
• Email - Check and send messages
• Reminders - Set and manage reminders
• Notes - Save and search notes

How can I help you today?`,
      type: 'ai',
      time: formatTime(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const { isConfigured } = useConfigStore();

  useEffect(() => {
    if (!isConfigured) {
      addMessage('AI not configured. Go to Settings to add your API key.', 'system');
    }
  }, [isConfigured]);

  function formatTime(): string {
    return new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function addMessage(text: string, type: Message['type']) {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      type,
      time: formatTime(),
    };
    setMessages((prev) => [...prev, newMessage]);
  }

  async function handleSend(text?: string) {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    addMessage(messageText, 'user');
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatWithAI(messageText);
      if (response.success && response.message) {
        addMessage(response.message, 'ai');
      } else {
        addMessage(response.error || 'Failed to get response', 'error');
      }
    } catch (error) {
      addMessage(`Error: ${(error as Error).message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }

  function renderMessage(message: Message) {
    const styles = messageStyles[message.type];
    return (
      <View key={message.id} style={[baseStyles.message, styles.container]}>
        <Text style={[baseStyles.messageText, styles.text]}>{message.text}</Text>
        <Text style={baseStyles.messageTime}>{message.time}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={baseStyles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={baseStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollViewRef}
          style={baseStyles.messages}
          contentContainerStyle={baseStyles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd()}
        >
          {messages.map(renderMessage)}
          {isLoading && (
            <View style={baseStyles.typingIndicator}>
              <ActivityIndicator size="small" color="#4285f4" />
              <Text style={baseStyles.typingText}>Thinking...</Text>
            </View>
          )}
        </ScrollView>

        <View style={baseStyles.quickActions}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={baseStyles.quickButton}
              onPress={() => handleSend(action.message)}
              disabled={isLoading}
            >
              <Text style={baseStyles.quickButtonText}>
                {action.emoji} {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={baseStyles.inputArea}>
          <TextInput
            style={baseStyles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor="#666"
            onSubmitEditing={() => handleSend()}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[baseStyles.sendButton, isLoading && baseStyles.sendButtonDisabled]}
            onPress={() => handleSend()}
            disabled={isLoading || !input.trim()}
          >
            <Text style={baseStyles.sendButtonText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  flex: {
    flex: 1,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 12,
  },
  message: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  typingText: {
    color: '#888',
    fontSize: 14,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 8,
  },
  quickButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3d3d5c',
  },
  quickButtonText: {
    color: '#aaa',
    fontSize: 12,
  },
  inputArea: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#16213e',
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
    gap: 12,
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 22,
    color: '#fff',
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4285f4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#444',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 18,
  },
});

const messageStyles = {
  user: StyleSheet.create({
    container: {
      alignSelf: 'flex-end',
      backgroundColor: '#4285f4',
      borderBottomRightRadius: 4,
    },
    text: {
      color: '#fff',
    },
  }),
  ai: StyleSheet.create({
    container: {
      alignSelf: 'flex-start',
      backgroundColor: '#1e3a5f',
      borderLeftWidth: 3,
      borderLeftColor: '#34a853',
      borderBottomLeftRadius: 4,
    },
    text: {
      color: '#eee',
    },
  }),
  system: StyleSheet.create({
    container: {
      alignSelf: 'flex-start',
      backgroundColor: '#2d2d44',
      borderBottomLeftRadius: 4,
    },
    text: {
      color: '#888',
    },
  }),
  error: StyleSheet.create({
    container: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(234, 67, 53, 0.2)',
      borderBottomLeftRadius: 4,
    },
    text: {
      color: '#ea4335',
    },
  }),
};
