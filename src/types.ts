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

export interface Routine {
  id: number;
  title: string;
  category: string;
  assigned_to: number | null; // NULL = Nós dois
  days_of_week: number[]; // 0=domingo ... 6=sábado
  priority: 'baixa' | 'media' | 'alta';
  active: boolean;
  created_by: number;
  created_at: string;
}

export interface RoutineCompletion {
  id: number;
  routine_id: number;
  completion_date: string; // YYYY-MM-DD
  completed_by: number;
  completed_at: string;
}
