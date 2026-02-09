import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface Config {
  anthropicApiKey: string;
  telegramBotToken: string;
  telegramChatId: string;
  aiModel: string;
}

interface ConfigStore {
  config: Config;
  isConfigured: boolean;
  isLoading: boolean;
  loadConfig: () => Promise<void>;
  updateConfig: (updates: Partial<Config>) => Promise<void>;
  clearConfig: () => Promise<void>;
}

const defaultConfig: Config = {
  anthropicApiKey: '',
  telegramBotToken: '',
  telegramChatId: '',
  aiModel: 'claude-sonnet-4-20250514',
};

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: defaultConfig,
  isConfigured: false,
  isLoading: true,

  loadConfig: async () => {
    try {
      const stored = await SecureStore.getItemAsync('spockai_config');
      if (stored) {
        const config = JSON.parse(stored) as Config;
        set({
          config: { ...defaultConfig, ...config },
          isConfigured: !!config.anthropicApiKey,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      set({ isLoading: false });
    }
  },

  updateConfig: async (updates) => {
    const newConfig = { ...get().config, ...updates };
    try {
      await SecureStore.setItemAsync('spockai_config', JSON.stringify(newConfig));
      set({
        config: newConfig,
        isConfigured: !!newConfig.anthropicApiKey,
      });
    } catch (error) {
      console.error('Failed to save config:', error);
      throw new Error('Failed to save configuration');
    }
  },

  clearConfig: async () => {
    try {
      await SecureStore.deleteItemAsync('spockai_config');
      set({
        config: defaultConfig,
        isConfigured: false,
      });
    } catch (error) {
      console.error('Failed to clear config:', error);
      throw new Error('Failed to clear configuration');
    }
  },
}));
