import { NotificationType } from '@common/enums/notification-type.enum';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface INotificationProvider {
  send(payload: NotificationPayload): Promise<void>;
}
