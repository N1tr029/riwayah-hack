import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const canBuzz = Platform.OS !== 'web';

export function tapLight() {
  if (canBuzz) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function heartbeat() {
  if (canBuzz) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
}

export function success() {
  if (canBuzz) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function gentleWarning() {
  if (canBuzz) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}
