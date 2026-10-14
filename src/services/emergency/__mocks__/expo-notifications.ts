// Doble de expo-notifications para las pruebas en Node: no programa nada (los avisos se prueban con su adaptador).
export const AndroidImportance = { HIGH: 4, MAX: 5 };
export const AndroidNotificationVisibility = { PRIVATE: 0, PUBLIC: 1 };
export const AndroidAudioUsage = { ALARM: 4, NOTIFICATION: 5 };
export const AndroidAudioContentType = { SONIFICATION: 4 };
export const SchedulableTriggerInputTypes = { DATE: 'date', TIME_INTERVAL: 'timeInterval' };
export function setNotificationHandler(): void {}
export async function setNotificationChannelAsync(): Promise<null> {
  return null;
}
export async function deleteNotificationChannelAsync(): Promise<void> {}
export async function getPermissionsAsync() {
  return { status: 'undetermined', canAskAgain: true };
}
export async function requestPermissionsAsync() {
  return { status: 'denied', canAskAgain: false };
}
export async function getAllScheduledNotificationsAsync(): Promise<unknown[]> {
  return [];
}
export async function scheduleNotificationAsync(): Promise<string> {
  return 'test';
}
export async function cancelScheduledNotificationAsync(): Promise<void> {}
export async function getPresentedNotificationsAsync(): Promise<unknown[]> {
  return [];
}
export async function dismissNotificationAsync(): Promise<void> {}
export function addNotificationResponseReceivedListener() {
  return { remove() {} };
}
export function addNotificationReceivedListener() {
  return { remove() {} };
}
export async function getLastNotificationResponseAsync(): Promise<null> {
  return null;
}
export async function clearLastNotificationResponseAsync(): Promise<void> {}
export async function getExpoPushTokenAsync() {
  return { data: 'ExponentPushToken[test]' };
}
