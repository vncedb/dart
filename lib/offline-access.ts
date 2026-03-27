import NetInfo from "@react-native-community/netinfo";

export type OfflineFeatureKey =
  | "ai_summary"
  | "ai_description"
  | "login"
  | "signup"
  | "google_login"
  | "job_editor"
  | "profile_editor";

const OFFLINE_COPY: Record<OfflineFeatureKey, { title: string; message: string }> = {
  ai_summary: {
    title: "You're Offline",
    message:
      "AI Summary needs internet to reach your selected AI provider. Reconnect and try again.",
  },
  ai_description: {
    title: "You're Offline",
    message:
      "AI writing needs internet to generate or rewrite descriptions. Reconnect and try again.",
  },
  login: {
    title: "You're Offline",
    message:
      "Log in needs internet to verify your account securely. Reconnect and try again.",
  },
  signup: {
    title: "You're Offline",
    message:
      "Sign up needs internet to create and verify your account. Reconnect and try again.",
  },
  google_login: {
    title: "You're Offline",
    message:
      "Google sign-in needs internet to connect with Google and your DART account. Reconnect and try again.",
  },
  job_editor: {
    title: "You're Offline",
    message:
      "Adding or updating a job needs internet so your setup stays synced to your account.",
  },
  profile_editor: {
    title: "You're Offline",
    message:
      "Editing your profile needs internet so your account stays consistent across devices.",
  },
};

export const isOnline = async () => {
  const state = await NetInfo.fetch();
  return !!state.isConnected && state.isInternetReachable !== false;
};

export const requireOnlineFeature = async (
  feature: OfflineFeatureKey,
  setAlertConfig: (value: any) => void
) => {
  const online = await isOnline();
  if (online) return true;

  const copy = OFFLINE_COPY[feature];
  setAlertConfig({
    visible: true,
    type: "warning",
    title: copy.title,
    message: copy.message,
    confirmText: "Okay",
    onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
  });

  return false;
};
