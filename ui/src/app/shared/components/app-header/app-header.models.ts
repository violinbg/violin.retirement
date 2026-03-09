export interface AppHeaderAction {
  id: string;
  label?: string;
  icon?: string;
  severity?: 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'contrast' | 'help';
  outlined?: boolean;
  text?: boolean;
  size?: 'small' | 'large';
  tooltip?: string;
  loading?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}