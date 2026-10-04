export type TodoStatus = 'pending' | 'active' | 'done';

export interface TodoItem {
  text: string;
  status: TodoStatus;
}

export interface TodoGroup {
  title: string;
  items: TodoItem[];
}
