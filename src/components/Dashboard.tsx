import React, { useEffect, useState } from 'react';
import { User, Task, Routine, RoutineCompletion } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  ListTodo, 
  History as HistoryIcon, 
  Home, 
  LogOut, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  Filter,
  User2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  format, 
  isToday, 
  isPast, 
  startOfWeek, 
  endOfWeek, 
  addMonths, 
  subMonths,
  isSameDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const weekdaysAbr = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const weekdaysFull = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const categoriesList = ['Limpeza', 'Cozinha', 'Compras', 'Contas', 'Manutenção', 'Pets', 'Jardim', 'Outros'];

// Format date in YYYY-MM-DD local time to avoid timezone shifts
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDueDate = (dateVal: string | null) => {
  if (!dateVal) return null;
  return dateVal.substring(0, 10);
};

const formatDaysOfWeek = (days: number[]) => {
  if (!days || days.length === 0) return 'Nenhum dia';
  const sortedDays = [...days].sort((a, b) => a - b);
  return sortedDays.map(d => weekdaysAbr[d]).join(' · ');
};

export default function Dashboard({ user, onLogout }: { user: User, onLogout: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routineCompletions, setRoutineCompletions] = useState<RoutineCompletion[]>([]);
  
  const [view, setView] = useState<'home' | 'tasks' | 'history'>('home');
  const [tasksSubView, setTasksSubView] = useState<'lista' | 'calendario'>('lista');
  const [showNewTask, setShowNewTask] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters for complete list
  const [filterPerson, setFilterPerson] = useState<string>('todos');
  const [filterCategory, setFilterCategory] = useState<string>('todas');

  // Calendar states
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());

  // Form states inside the modal (declared here to persist/manage cleanly)
  const [taskType, setTaskType] = useState<'routine' | 'specific'>('routine');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then(r => r.json()),
      fetch('/api/routines').then(r => r.json()),
      fetch('/api/routine_completions').then(r => r.json())
    ]).then(([tasksData, routinesData, completionsData]) => {
      if (Array.isArray(tasksData)) setTasks(tasksData);
      if (Array.isArray(routinesData)) setRoutines(routinesData);
      if (Array.isArray(completionsData)) setRoutineCompletions(completionsData);
    }).catch(err => console.error("Erro ao carregar dados:", err));
  }, [refreshKey]);

  // Handle tasks actions
  const toggleTask = async (task: Task) => {
    const isCompleting = task.status !== 'concluida';
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, status: isCompleting ? 'concluida' : 'pendente' })
    });
    setRefreshKey(k => k + 1);
  };

  const deleteTask = async (taskId: number) => {
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    setRefreshKey(k => k + 1);
  };

  // Handle routines actions
  const toggleRoutine = async (routine: Routine, dateStr: string) => {
    const isCompleted = routineCompletions.some(c => c.routine_id === routine.id && c.completion_date === dateStr);
    const endpoint = `/api/routines/${routine.id}/complete`;
    
    if (isCompleted) {
      await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completion_date: dateStr })
      });
    } else {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completion_date: dateStr })
      });
    }
    setRefreshKey(k => k + 1);
  };

  const toggleRoutineActive = async (routine: Routine) => {
    await fetch(`/api/routines/${routine.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !routine.active })
    });
    setRefreshKey(k => k + 1);
  };

  const deleteRoutine = async (routineId: number) => {
    await fetch(`/api/routines/${routineId}`, { method: 'DELETE' });
    setRefreshKey(k => k + 1);
  };

  // Dates for today calculation
  const todayDate = new Date();
  const todayDayOfWeek = todayDate.getDay();
  const todayStr = getLocalDateString(todayDate);

  // Generate unified lists
  const todayRoutinesUnified = routines
    .filter(r => r.active && r.days_of_week.includes(todayDayOfWeek))
    .map(r => {
      const isCompleted = routineCompletions.some(c => c.routine_id === r.id && c.completion_date === todayStr);
      return {
        key: `routine-${r.id}-${todayStr}`,
        type: 'routine' as const,
        id: r.id,
        title: r.title,
        category: r.category,
        assigned_to: r.assigned_to,
        priority: r.priority,
        isCompleted,
        raw: r
      };
    });

  const todayTasksUnified = tasks
    .filter(t => parseDueDate(t.due_date) === todayStr)
    .map(t => ({
      key: `task-${t.id}`,
      type: 'task' as const,
      id: t.id,
      title: t.title,
      category: t.category,
      assigned_to: t.assigned_to,
      priority: t.priority,
      isCompleted: t.status === 'concluida',
      raw: t
    }));

  const combinedTodayItems = [...todayRoutinesUnified, ...todayTasksUnified];

  // Filters application for Complete List (Aba Tarefas)
  const applyFilters = (item: { category: string, assigned_to: number | null }) => {
    if (filterCategory !== 'todas' && item.category !== filterCategory) return false;
    if (filterPerson !== 'todos') {
      if (filterPerson === 'nos_dois') {
        if (item.assigned_to !== null) return false;
      } else {
        if (item.assigned_to !== parseInt(filterPerson)) return false;
      }
    }
    return true;
  };

  const filteredRoutines = routines.filter(applyFilters);
  const filteredTasks = tasks.filter(applyFilters);

  // History calculation (Weekly placar)
  const startOfThisWeek = startOfWeek(todayDate, { weekStartsOn: 1 });
  const endOfThisWeek = endOfWeek(todayDate, { weekStartsOn: 1 });

  const isDateInThisWeek = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date >= startOfThisWeek && date <= endOfThisWeek;
    } catch {
      return false;
    }
  };

  const completedTasksThisWeek = tasks.filter(t => {
    if (t.status !== 'concluida' || !t.completed_at) return false;
    const completedDate = new Date(t.completed_at);
    return completedDate >= startOfThisWeek && completedDate <= endOfThisWeek;
  });

  const completedRoutinesThisWeek = routineCompletions.filter(c => isDateInThisWeek(c.completion_date));

  // Count completions
  const henriqueTasksCompleted = completedTasksThisWeek.filter(t => t.assigned_to === 1).length;
  const henriqueRoutinesCompleted = completedRoutinesThisWeek.filter(c => c.completed_by === 1).length;

  const jessicaTasksCompleted = completedTasksThisWeek.filter(t => t.assigned_to === 2).length;
  const jessicaRoutinesCompleted = completedRoutinesThisWeek.filter(c => c.completed_by === 2).length;

  const totalCompletionsThisWeek = completedTasksThisWeek.length + completedRoutinesThisWeek.length;

  // Calendar rendering helper
  const getDaysInMonthGrid = (date: Date) => {
    const startOfCurrentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfCurrentMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const days: Date[] = [];
    
    const firstDayOfWeek = startOfCurrentMonth.getDay();
    // Padding days from previous month
    for (let i = firstDayOfWeek; i > 0; i--) {
      days.push(new Date(date.getFullYear(), date.getMonth(), 1 - i));
    }
    // Days of current month
    const totalDaysInMonth = endOfCurrentMonth.getDate();
    for (let i = 1; i <= totalDaysInMonth; i++) {
      days.push(new Date(date.getFullYear(), date.getMonth(), i));
    }
    // Padding days to complete the 7-column grid
    const totalVisibleDays = days.length;
    const remainingPadding = (7 - (totalVisibleDays % 7)) % 7;
    for (let i = 1; i <= remainingPadding; i++) {
      days.push(new Date(date.getFullYear(), date.getMonth() + 1, i));
    }
    return days;
  };

  const getItemsForDate = (date: Date) => {
    const dateStr = getLocalDateString(date);
    const dayOfWeek = date.getDay();
    
    const activeRoutinesForDate = routines
      .filter(r => r.active && r.days_of_week.includes(dayOfWeek))
      .map(r => {
        const isCompleted = routineCompletions.some(c => c.routine_id === r.id && c.completion_date === dateStr);
        return {
          key: `routine-${r.id}-${dateStr}`,
          type: 'routine' as const,
          id: r.id,
          title: r.title,
          category: r.category,
          assigned_to: r.assigned_to,
          priority: r.priority,
          isCompleted,
          raw: r
        };
      });
      
    const tasksForDate = tasks
      .filter(t => parseDueDate(t.due_date) === dateStr)
      .map(t => ({
        key: `task-${t.id}-${dateStr}`,
        type: 'task' as const,
        id: t.id,
        title: t.title,
        category: t.category,
        assigned_to: t.assigned_to,
        priority: t.priority,
        isCompleted: t.status === 'concluida',
        raw: t
      }));
      
    return [...activeRoutinesForDate, ...tasksForDate];
  };

  const handleToggleUnifiedItem = async (item: { type: 'routine' | 'task', id: number, isCompleted: boolean, raw: any }, targetDateStr: string) => {
    if (item.type === 'routine') {
      await toggleRoutine(item.raw, targetDateStr);
    } else {
      await toggleTask(item.raw);
    }
  };

  const handleDeleteUnifiedItem = async (item: { type: 'routine' | 'task', id: number, raw: any }) => {
    if (item.type === 'routine') {
      await deleteRoutine(item.id);
    } else {
      await deleteTask(item.id);
    }
  };

  const toggleDaySelection = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-base-bg pb-[calc(80px+env(safe-area-inset-bottom))] w-full max-w-[414px] mx-auto relative shadow-2xl">
      <header className="p-6 pb-2 flex justify-between items-center pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl font-display font-medium">Olá, {user.name} 👋</h1>
          <p className="text-base-text/60 capitalize font-medium">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
        </motion.div>
        <button onClick={onLogout} className="p-2.5 bg-white border border-black/5 rounded-full shadow-sm text-base-text/50 hover:text-base-text transition-all active:scale-90">
          <LogOut size={18} />
        </button>
      </header>

      <main className="flex-1 p-6 flex flex-col gap-6 overflow-x-hidden">
        
        {/* --- VIEW: HOME (HOJE) --- */}
        {view === 'home' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6">
            
            {/* General progress banner */}
            <section className="bg-white p-5 rounded-3xl border border-black/5 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-base-text">Resumo da Semana</h3>
                <span className="text-xs font-semibold text-sage-green bg-sage-green/10 px-2.5 py-1 rounded-full">
                  {totalCompletionsThisWeek} feitas
                </span>
              </div>
              <p className="text-sm text-base-text/60 mb-4 leading-relaxed">
                Henrique: <strong>{henriqueRoutinesCompleted} rotinas + {henriqueTasksCompleted} avulsas</strong>. <br />
                Jessica: <strong>{jessicaRoutinesCompleted} rotinas + {jessicaTasksCompleted} avulsas</strong>.
              </p>
              <div className="h-2 w-full bg-base-bg rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${Math.min(100, (totalCompletionsThisWeek / 12) * 100)}%` }}
                  className="h-full bg-sage-green rounded-full"
                />
              </div>
            </section>

            {/* Today list */}
            <section className="flex flex-col gap-3">
              <div className="flex justify-between items-center mb-1">
                <h2 className="text-lg font-display font-semibold">Hoje</h2>
                <span className="text-xs font-semibold bg-black/5 text-base-text/60 px-2.5 py-1 rounded-full">
                  {combinedTodayItems.filter(item => !item.isCompleted).length} pendentes
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {combinedTodayItems.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-3xl border border-black/5 shadow-sm">
                    <p className="text-base-text/60 font-medium text-sm">Sem tarefas agendadas para hoje! 🎉</p>
                  </div>
                ) : (
                  combinedTodayItems.map(item => (
                    <UnifiedItemCard 
                      key={item.key} 
                      item={item} 
                      onToggle={() => handleToggleUnifiedItem(item, todayStr)} 
                      onDelete={() => handleDeleteUnifiedItem(item)} 
                    />
                  ))
                )}
              </div>
            </section>

          </motion.div>
        )}

        {/* --- VIEW: TASKS (TAREFAS + CALENDÁRIO) --- */}
        {view === 'tasks' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
            
            {/* Segmented Control Selector */}
            <div className="bg-black/5 p-1 rounded-2xl flex w-full">
              <button 
                onClick={() => setTasksSubView('lista')}
                className={cn(
                  "flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
                  tasksSubView === 'lista' ? "bg-white shadow-sm text-base-text" : "text-base-text/50"
                )}
              >
                <ListTodo size={16} />
                Lista
              </button>
              <button 
                onClick={() => setTasksSubView('calendario')}
                className={cn(
                  "flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
                  tasksSubView === 'calendario' ? "bg-white shadow-sm text-base-text" : "text-base-text/50"
                )}
              >
                <CalendarIcon size={16} />
                Calendário
              </button>
            </div>

            {/* Filtering tools - always visible in List SubView */}
            {tasksSubView === 'lista' && (
              <div className="bg-white p-4 rounded-3xl border border-black/5 shadow-sm flex flex-col gap-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-base-text/50 uppercase tracking-wider">
                  <Filter size={12} />
                  <span>Filtros Rápidos</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-base-text/40">Responsável</label>
                    <select 
                      value={filterPerson} 
                      onChange={(e) => setFilterPerson(e.target.value)}
                      className="p-2 bg-base-bg rounded-xl text-xs font-medium outline-none border-none focus:ring-1 focus:ring-sage-green"
                    >
                      <option value="todos">Todos</option>
                      <option value="1">Henrique</option>
                      <option value="2">Jessica</option>
                      <option value="nos_dois">Nós dois</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-base-text/40">Categoria</label>
                    <select 
                      value={filterCategory} 
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="p-2 bg-base-bg rounded-xl text-xs font-medium outline-none border-none focus:ring-1 focus:ring-sage-green"
                    >
                      <option value="todas">Todas</option>
                      {categoriesList.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* SUBVIEW: LISTA */}
            {tasksSubView === 'lista' && (
              <div className="flex flex-col gap-6">
                
                {/* Routines section */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-display font-semibold text-sm text-base-text/70 uppercase tracking-wider">Rotinas Fixas</h3>
                    <span className="text-xs font-bold text-sage-green bg-sage-green/10 px-2 py-0.5 rounded">
                      {filteredRoutines.length} ativas
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {filteredRoutines.length === 0 ? (
                      <p className="text-center text-xs text-base-text/40 py-4 bg-white rounded-2xl border border-dashed border-black/10">Nenhuma rotina cadastrada.</p>
                    ) : (
                      filteredRoutines.map(routine => (
                        <div key={routine.id} className="bg-white p-4 rounded-3xl border border-black/5 shadow-sm flex items-center justify-between gap-4">
                          <div className="overflow-hidden flex-1">
                            <h4 className="font-semibold text-[16px] text-base-text truncate">{routine.title}</h4>
                            <div className="flex flex-wrap gap-2 mt-2 items-center text-[10px] font-semibold text-base-text/50">
                              <span className="bg-base-text/5 px-2 py-0.5 rounded">{routine.category}</span>
                              <span className="bg-sage-green/10 text-sage-green px-2 py-0.5 rounded font-bold">
                                {formatDaysOfWeek(routine.days_of_week)}
                              </span>
                              {routine.assigned_to === 1 && <span className="text-[#5F7A61]">Henrique</span>}
                              {routine.assigned_to === 2 && <span className="text-[#A96B54]">Jessica</span>}
                              {!routine.assigned_to && <span>Nós dois</span>}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => toggleRoutineActive(routine)}
                              title={routine.active ? "Desativar" : "Ativar"}
                              className={cn(
                                "p-1.5 rounded-full transition-all active:scale-90",
                                routine.active ? "text-sage-green hover:bg-sage-green/5" : "text-base-text/20 hover:bg-black/5"
                              )}
                            >
                              {routine.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                            </button>
                            <button 
                              onClick={() => deleteRoutine(routine.id)}
                              className="p-1.5 text-base-text/20 hover:text-red-500 hover:bg-red-50 rounded-full transition-all active:scale-90"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Specific tasks (avulsas) section */}
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-display font-semibold text-sm text-base-text/70 uppercase tracking-wider">Tarefas Avulsas</h3>
                    <span className="text-xs font-bold text-base-text/50 bg-black/5 px-2 py-0.5 rounded">
                      {filteredTasks.filter(t => t.status !== 'concluida').length} pendentes
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {filteredTasks.length === 0 ? (
                      <p className="text-center text-xs text-base-text/40 py-4 bg-white rounded-2xl border border-dashed border-black/10">Nenhuma tarefa avulsa pendente.</p>
                    ) : (
                      filteredTasks.map(t => (
                        <UnifiedItemCard 
                          key={`task-card-${t.id}`}
                          item={{
                            type: 'task',
                            id: t.id,
                            title: t.title,
                            category: t.category,
                            assigned_to: t.assigned_to,
                            priority: t.priority,
                            isCompleted: t.status === 'concluida',
                            raw: t
                          }}
                          onToggle={() => toggleTask(t)}
                          onDelete={() => deleteTask(t.id)}
                        />
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* SUBVIEW: CALENDÁRIO */}
            {tasksSubView === 'calendario' && (
              <div className="flex flex-col gap-4">
                
                {/* Month Selector header */}
                <div className="flex justify-between items-center bg-white p-3 px-4 rounded-3xl border border-black/5 shadow-sm">
                  <button 
                    onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                    className="p-2 hover:bg-base-bg rounded-full transition-all active:scale-90"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <h3 className="font-display font-bold text-base text-base-text capitalize">
                    {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                  </h3>
                  <button 
                    onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                    className="p-2 hover:bg-base-bg rounded-full transition-all active:scale-90"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                {/* Calendar grid */}
                <div className="bg-white p-4 rounded-3xl border border-black/5 shadow-sm flex flex-col gap-2">
                  
                  {/* Grid Weekdays label */}
                  <div className="grid grid-cols-7 text-center mb-1">
                    {weekdaysAbr.map((dayLabel, idx) => (
                      <span key={idx} className="text-[10px] font-bold text-base-text/30 uppercase">
                        {dayLabel}
                      </span>
                    ))}
                  </div>

                  {/* Grid cells */}
                  <div className="grid grid-cols-7 gap-y-1.5 gap-x-1">
                    {getDaysInMonthGrid(currentMonth).map((day, idx) => {
                      const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                      const isSelected = isSameDay(day, selectedCalendarDate);
                      const isTodayDay = isToday(day);
                      const dayStr = getLocalDateString(day);
                      
                      const dayItems = getItemsForDate(day);
                      const pendingDayItems = dayItems.filter(item => !item.isCompleted);
                      
                      // Collect assigned users for dots (Henrique: 1, Jessica: 2, Nosotros: null)
                      const assigneesOnDay = Array.from(new Set(dayItems.map(it => it.assigned_to)));
                      // Take up to 3 dots
                      const visibleAssignees = assigneesOnDay.slice(0, 3);

                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedCalendarDate(day)}
                          className={cn(
                            "aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all active:scale-95 gap-0.5",
                            !isCurrentMonth && "opacity-25",
                            isSelected && "bg-base-text text-white shadow-md",
                            !isSelected && isTodayDay && "border-2 border-sage-green font-bold",
                            !isSelected && !isTodayDay && "hover:bg-black/5"
                          )}
                        >
                          <span className={cn(
                            "text-xs font-semibold",
                            isSelected ? "text-white" : "text-base-text"
                          )}>
                            {day.getDate()}
                          </span>
                          
                          {/* Dot indicators */}
                          {dayItems.length > 0 && (
                            <div className="flex gap-0.5 justify-center mt-0.5 max-w-full">
                              {visibleAssignees.map((assigneeId, dotIdx) => {
                                let dotColor = 'bg-slate-400';
                                if (assigneeId === 1) dotColor = 'bg-[#5F7A61]';
                                else if (assigneeId === 2) dotColor = 'bg-[#A96B54]';
                                else dotColor = 'bg-yellow-500';

                                return (
                                  <span 
                                    key={dotIdx} 
                                    className={cn(
                                      "w-1 h-1 rounded-full", 
                                      isSelected ? "bg-white" : dotColor
                                    )} 
                                  />
                                );
                              })}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                </div>

                {/* Day tasks details sliding area / block list */}
                <div className="flex flex-col gap-3 mt-1">
                  <div className="flex justify-between items-center px-1">
                    <h4 className="font-display font-semibold text-sm text-base-text/70">
                      {isToday(selectedCalendarDate) ? "Hoje" : format(selectedCalendarDate, "dd 'de' MMMM", { locale: ptBR })}
                    </h4>
                    <span className="text-xs font-medium text-base-text/40 italic">
                      {weekdaysFull[selectedCalendarDate.getDay()]}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {getItemsForDate(selectedCalendarDate).length === 0 ? (
                      <div className="p-8 text-center bg-white rounded-3xl border border-black/5 shadow-sm">
                        <p className="text-base-text/40 text-xs font-semibold">Tudo livre neste dia! ☀️</p>
                      </div>
                    ) : (
                      getItemsForDate(selectedCalendarDate).map(item => (
                        <UnifiedItemCard
                          key={item.key}
                          item={item}
                          onToggle={() => handleToggleUnifiedItem(item, getLocalDateString(selectedCalendarDate))}
                          onDelete={() => handleDeleteUnifiedItem(item)}
                        />
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}

          </motion.div>
        )}

        {/* --- VIEW: HISTORY (HISTÓRICO) --- */}
        {view === 'history' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">
            <h2 className="text-lg font-display font-semibold mb-1">Histórico de Conclusões</h2>

            <div className="bg-white p-5 rounded-3xl border border-black/5 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                <div>
                  <h3 className="font-bold text-base-text">Placar Geral de Conclusões</h3>
                  <p className="text-xs text-base-text/40">Filtro: Esta semana (Seg a Dom)</p>
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-4">
                {/* Henrique stats */}
                <div className="bg-sage-green/5 p-4 rounded-2xl border border-sage-green/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#5F7A61] text-white flex items-center justify-center font-bold text-sm">H</div>
                    <div>
                      <h4 className="font-bold text-sm text-[#3E5340]">Henrique</h4>
                      <p className="text-xs text-base-text/60">{henriqueRoutinesCompleted} rotinas + {henriqueTasksCompleted} avulsas</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-[#3E5340] bg-[#5F7A61]/20 px-3 py-1 rounded-full">
                    {henriqueRoutinesCompleted + henriqueTasksCompleted}
                  </span>
                </div>

                {/* Jessica stats */}
                <div className="bg-terracotta/5 p-4 rounded-2xl border border-terracotta/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#A96B54] text-white flex items-center justify-center font-bold text-sm">J</div>
                    <div>
                      <h4 className="font-bold text-sm text-[#734333]">Jessica</h4>
                      <p className="text-xs text-base-text/60">{jessicaRoutinesCompleted} rotinas + {jessicaTasksCompleted} avulsas</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-[#734333] bg-[#A96B54]/20 px-3 py-1 rounded-full">
                    {jessicaRoutinesCompleted + jessicaTasksCompleted}
                  </span>
                </div>
              </div>
            </div>

            {/* List of completions */}
            <div className="flex flex-col gap-3 mt-2">
              <h3 className="font-display font-semibold text-sm text-base-text/70 uppercase tracking-wider px-1">Atividades Recentes</h3>
              
              <div className="flex flex-col gap-3">
                {completedTasksThisWeek.length === 0 && completedRoutinesThisWeek.length === 0 ? (
                  <p className="text-center text-xs text-base-text/40 py-6 bg-white rounded-3xl border border-black/5">Nenhuma atividade concluída esta semana.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* Render completed tasks */}
                    {completedTasksThisWeek.map(t => (
                      <div key={`compl-task-${t.id}`} className="bg-white p-4 rounded-3xl border border-black/5 shadow-sm opacity-65 flex items-center gap-4">
                        <CheckCircle2 size={24} className="text-sage-green flex-shrink-0" />
                        <div className="flex-1 overflow-hidden">
                          <h4 className="font-medium text-sm text-base-text line-through truncate">{t.title}</h4>
                          <span className="text-[10px] bg-black/5 text-base-text/50 px-1.5 py-0.5 rounded font-bold mt-1 inline-block">
                            Avulsa · {t.category}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Render completed routines */}
                    {completedRoutinesThisWeek.map(c => {
                      const associatedRoutine = routines.find(r => r.id === c.routine_id);
                      if (!associatedRoutine) return null;
                      return (
                        <div key={`compl-rout-${c.id}`} className="bg-white p-4 rounded-3xl border border-black/5 shadow-sm opacity-65 flex items-center gap-4">
                          <CheckCircle2 size={24} className="text-sage-green flex-shrink-0" />
                          <div className="flex-1 overflow-hidden">
                            <h4 className="font-medium text-sm text-base-text line-through truncate">{associatedRoutine.title}</h4>
                            <span className="text-[10px] bg-sage-green/10 text-sage-green px-1.5 py-0.5 rounded font-bold mt-1 inline-block">
                              Rotina · {associatedRoutine.category}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </motion.div>
        )}

      </main>

      {/* Persistent Elegant Bottom Tab Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 w-full pointer-events-none flex justify-center z-40">
        <nav className="w-full max-w-[414px] bg-white/95 backdrop-blur-lg border-t border-black/5 px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] flex justify-between items-center pointer-events-auto shadow-lg">
          <NavButton icon={<Home />} label="Início" active={view === 'home'} onClick={() => setView('home')} />
          <NavButton icon={<ListTodo />} label="Tarefas" active={view === 'tasks'} onClick={() => setView('tasks')} />
          
          <div className="relative -top-5">
            <button 
              onClick={() => {
                setTaskType('routine');
                setSelectedDays([]);
                setShowNewTask(true);
              }}
              className="bg-sage-green text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center transform active:scale-90 transition-all hover:bg-[#4E644F]"
            >
              <Plus size={24} />
            </button>
          </div>
          
          <NavButton icon={<HistoryIcon />} label="Histórico" active={view === 'history'} onClick={() => setView('history')} />
          <button onClick={onLogout} className="flex flex-col items-center gap-1 p-2 text-base-text/40 hover:text-red-500 transition-colors">
            <LogOut size={20} />
            <span className="text-[10px] font-bold">Sair</span>
          </button>
        </nav>
      </div>

      {/* Polished New Task Modal */}
      {showNewTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-4 pb-0 sm:pb-4">
          <motion.div 
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-display font-semibold text-lg">Criar Nova Atividade</h2>
              <button onClick={() => setShowNewTask(false)} className="w-8 h-8 rounded-full bg-base-bg text-base-text/50 flex items-center justify-center hover:bg-black/5 transition-all">✕</button>
            </div>

            {/* Segmented control for TaskType inside the form */}
            <div className="bg-black/5 p-1 rounded-xl flex mb-5">
              <button 
                type="button"
                onClick={() => setTaskType('routine')}
                className={cn(
                  "flex-1 py-2 rounded-lg font-bold text-xs transition-all",
                  taskType === 'routine' ? "bg-white shadow-xs text-base-text" : "text-base-text/50"
                )}
              >
                Rotina fixa
              </button>
              <button 
                type="button"
                onClick={() => setTaskType('specific')}
                className={cn(
                  "flex-1 py-2 rounded-lg font-bold text-xs transition-all",
                  taskType === 'specific' ? "bg-white shadow-xs text-base-text" : "text-base-text/50"
                )}
              >
                Data específica
              </button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const title = formData.get('title') as string;
              const category = formData.get('category') as string;
              const assigned_val = formData.get('assigned_to') as string;
              const assigned_to = assigned_val ? parseInt(assigned_val) : null;
              const priority = formData.get('priority') as string;

              if (taskType === 'routine') {
                // Routines creation
                await fetch('/api/routines', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title,
                    category,
                    assigned_to,
                    priority,
                    days_of_week: selectedDays.length > 0 ? selectedDays : [todayDayOfWeek] // Fallback to today if none selected
                  })
                });
              } else {
                // Tasks creation
                const due_date = formData.get('due_date') || todayStr;
                await fetch('/api/tasks', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title,
                    category,
                    assigned_to,
                    priority,
                    due_date
                  })
                });
              }

              setShowNewTask(false);
              setRefreshKey(k => k + 1);
            }} className="flex flex-col gap-4">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-base-text/50 uppercase tracking-wider">Título</label>
                <input 
                  required 
                  name="title" 
                  placeholder="O que precisa ser feito?" 
                  className="p-3 bg-base-bg rounded-2xl w-full text-sm outline-none focus:ring-1 focus:ring-sage-green" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-base-text/50 uppercase tracking-wider">Responsável</label>
                  <select name="assigned_to" className="p-3 bg-base-bg rounded-2xl w-full text-xs font-semibold outline-none border-none">
                    <option value="">Nós dois</option>
                    <option value="1">Henrique</option>
                    <option value="2">Jessica</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-base-text/50 uppercase tracking-wider">Prioridade</label>
                  <select name="priority" className="p-3 bg-base-bg rounded-2xl w-full text-xs font-semibold outline-none border-none">
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-base-text/50 uppercase tracking-wider">Categoria</label>
                <select name="category" className="p-3 bg-base-bg rounded-2xl w-full text-xs font-semibold outline-none border-none">
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Rotina fixa days selector */}
              {taskType === 'routine' && (
                <div className="flex flex-col gap-2 mt-2">
                  <label className="text-[11px] font-bold text-base-text/50 uppercase tracking-wider">Dias de Execução</label>
                  <div className="flex justify-between gap-1">
                    {weekdaysAbr.map((dayLabel, index) => {
                      const isSelected = selectedDays.includes(index);
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => toggleDaySelection(index)}
                          className={cn(
                            "w-10 h-10 rounded-xl font-bold text-xs flex items-center justify-center transition-all active:scale-90 border",
                            isSelected 
                              ? "bg-sage-green text-white border-sage-green shadow-xs" 
                              : "bg-base-bg text-base-text/50 border-black/5 hover:bg-black/5"
                          )}
                        >
                          {dayLabel}
                        </button>
                      );
                    })}
                  </div>
                  {selectedDays.length === 0 && (
                    <p className="text-[10px] text-red-500 font-medium">Selecione ao menos um dia da semana.</p>
                  )}
                </div>
              )}

              {/* Specific date picker */}
              {taskType === 'specific' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-base-text/50 uppercase tracking-wider">Data de Conclusão</label>
                  <input 
                    type="date" 
                    name="due_date" 
                    defaultValue={todayStr}
                    className="p-3 bg-base-bg rounded-2xl w-full text-xs font-semibold outline-none border-none" 
                  />
                </div>
              )}

              <button 
                type="submit" 
                disabled={taskType === 'routine' && selectedDays.length === 0}
                className={cn(
                  "mt-4 p-4 rounded-2xl font-bold text-sm text-white w-full transition-all active:scale-95 shadow-md",
                  taskType === 'routine' && selectedDays.length === 0 
                    ? "bg-base-text/30 cursor-not-allowed" 
                    : "bg-base-text hover:bg-black/85"
                )}
              >
                {taskType === 'routine' ? 'Criar Rotina Fixa' : 'Criar Tarefa Avulsa'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-1.5 p-1 transition-all active:scale-95", active ? "text-sage-green" : "text-base-text/35 hover:text-base-text/75")}>
      {React.cloneElement(icon as React.ReactElement<any>, { size: 20 })}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function UnifiedItemCard({ 
  item, 
  onToggle, 
  onDelete 
}: { 
  item: { 
    type: 'routine' | 'task', 
    id: number, 
    title: string, 
    category: string, 
    assigned_to: number | null, 
    priority: string, 
    isCompleted: boolean,
    raw?: any
  }, 
  onToggle: () => void, 
  onDelete: () => void 
}) {
  return (
    <div className="relative overflow-hidden rounded-[24px] group w-full touch-pan-y shadow-xs">
      {/* Slide / Drag action background colors */}
      <div className="absolute inset-0 flex justify-between items-center px-6">
        <div className="text-sage-green opacity-80 font-semibold text-xs flex items-center gap-1.5">
          <CheckCircle2 size={20} /> Concluir
        </div>
        <div className="text-red-500 opacity-80 font-semibold text-xs flex items-center gap-1.5">
          Excluir <Trash2 size={16} />
        </div>
      </div>

      <motion.div 
        layout
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        dragSnapToOrigin
        onDragEnd={(e, { offset }) => {
          if (offset.x > 80) onToggle();
          else if (offset.x < -80) onDelete();
        }}
        whileTap={{ cursor: "grabbing" }}
        className={cn(
          "bg-white p-4 rounded-[24px] border border-black/5 flex items-center gap-4 transition-colors relative z-10 min-h-[76px]",
          item.isCompleted && "opacity-75 bg-[#fcfcfc]"
        )}
      >
        <button 
          onClick={onToggle} 
          className={cn(
            "flex-shrink-0 transition-all active:scale-75", 
            item.isCompleted ? "text-sage-green" : "text-base-text/15 hover:text-base-text/35"
          )}
        >
          {item.isCompleted ? <CheckCircle2 size={26} /> : <Circle size={26} />}
        </button>

        <div className="flex-1 overflow-hidden">
          <h3 className={cn(
            "font-semibold text-[15px] leading-snug truncate", 
            item.isCompleted ? "line-through text-base-text/45" : "text-base-text"
          )}>
            {item.title}
          </h3>
          
          <div className="flex flex-wrap gap-1.5 mt-2 text-[9px] font-bold text-base-text/50 items-center">
            <span className="bg-base-text/5 px-2 py-0.5 rounded-md">{item.category}</span>
            
            {item.type === 'routine' ? (
              <span className="bg-sage-green/10 text-sage-green px-2 py-0.5 rounded-md">Rotina</span>
            ) : (
              <span className="bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-md">Avulsa</span>
            )}

            {item.assigned_to === 1 && (
              <span className="bg-sage-green/5 text-[#5F7A61] px-2 py-0.5 rounded-md">Henrique</span>
            )}
            {item.assigned_to === 2 && (
              <span className="bg-terracotta/5 text-[#A96B54] px-2 py-0.5 rounded-md">Jessica</span>
            )}
            {!item.assigned_to && (
              <span className="bg-black/5 text-base-text/40 px-2 py-0.5 rounded-md">Nós dois</span>
            )}

            {item.priority === 'alta' && (
              <span className="bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded">Alta</span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
