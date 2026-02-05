/**
 * SpockAI Teams Types
 * Type definitions for Microsoft Teams integration
 */

// Teams configuration
export interface TeamsConfig {
  webhookUrl: string;           // Incoming webhook URL
  botAppId?: string;            // Bot app ID for bidirectional communication
  botAppSecret?: string;        // Bot app secret
  channelId?: string;           // Target channel ID
  tenantId?: string;            // Azure AD tenant ID
  enabled: boolean;
}

// Teams webhook payload
export interface TeamsWebhook {
  url: string;
  name?: string;
  channelName?: string;
  connectorId?: string;
}

// Adaptive Card types
export interface AdaptiveCard {
  type: 'AdaptiveCard';
  version: string;
  body: AdaptiveCardElement[];
  actions?: AdaptiveCardAction[];
  $schema?: string;
}

// Card element types
export type AdaptiveCardElement =
  | TextBlock
  | Image
  | ColumnSet
  | Container
  | FactSet
  | ActionSet;

export interface TextBlock {
  type: 'TextBlock';
  text: string;
  size?: 'small' | 'default' | 'medium' | 'large' | 'extraLarge';
  weight?: 'lighter' | 'default' | 'bolder';
  color?: 'default' | 'dark' | 'light' | 'accent' | 'good' | 'warning' | 'attention';
  wrap?: boolean;
  spacing?: 'none' | 'small' | 'default' | 'medium' | 'large' | 'extraLarge';
}

export interface Image {
  type: 'Image';
  url: string;
  altText?: string;
  size?: 'auto' | 'stretch' | 'small' | 'medium' | 'large';
}

export interface Column {
  type: 'Column';
  width: 'auto' | 'stretch' | string;
  items: AdaptiveCardElement[];
}

export interface ColumnSet {
  type: 'ColumnSet';
  columns: Column[];
}

export interface Container {
  type: 'Container';
  items: AdaptiveCardElement[];
  style?: 'default' | 'emphasis' | 'good' | 'attention' | 'warning' | 'accent';
}

export interface Fact {
  title: string;
  value: string;
}

export interface FactSet {
  type: 'FactSet';
  facts: Fact[];
}

export interface ActionSet {
  type: 'ActionSet';
  actions: AdaptiveCardAction[];
}

// Card actions
export type AdaptiveCardAction =
  | OpenUrlAction
  | SubmitAction
  | ShowCardAction;

export interface OpenUrlAction {
  type: 'Action.OpenUrl';
  title: string;
  url: string;
}

export interface SubmitAction {
  type: 'Action.Submit';
  title: string;
  data?: Record<string, unknown>;
}

export interface ShowCardAction {
  type: 'Action.ShowCard';
  title: string;
  card: AdaptiveCard;
}

// Teams message payload
export interface TeamsMessagePayload {
  type: 'message';
  attachments: TeamsAttachment[];
}

export interface TeamsAttachment {
  contentType: 'application/vnd.microsoft.card.adaptive';
  contentUrl: null;
  content: AdaptiveCard;
}

// Teams bot message
export interface TeamsBotMessage {
  type: string;
  id: string;
  timestamp: string;
  localTimestamp: string;
  channelId: string;
  from: {
    id: string;
    name: string;
    aadObjectId?: string;
  };
  conversation: {
    id: string;
    tenantId?: string;
  };
  recipient: {
    id: string;
    name: string;
  };
  text?: string;
  textFormat?: string;
  locale?: string;
  channelData?: Record<string, unknown>;
}

// Teams notification result
export interface TeamsNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}
