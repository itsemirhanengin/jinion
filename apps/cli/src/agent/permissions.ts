export interface PermissionRequest {
  title: string;
  command?: string;
  subject?: string;
  description?: string;
  always?: string;
  defaultToNo?: boolean;
}

export type PermissionDecision = { allow: true; always?: boolean } | { allow: false; note?: string };
