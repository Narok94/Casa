export interface User {
  id: number;
  name: string;
  color: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  category: string;
  assigned_to: number | null;
  status: 'pendente' | 'em_andamento' | 'concluida';
  priority: 'baixa' | 'media' | 'alta';
  due_date: string | null;
  is_recurring: boolean;
  recurrence: 'diaria' | 'semanal' | 'mensal' | null;
  created_by: number;
  created_at: string;
  completed_at: string | null;
}
