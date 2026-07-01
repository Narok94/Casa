import React, { useEffect, useState } from 'react';
import { User, Task } from '../types';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, Plus, ListTodo, History as HistoryIcon, Home, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, isToday, isPast, isFuture } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard({ user, onLogout }: { user: User, onLogout: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<'home' | 'tasks' | 'history'>('home');
  const [showNewTask, setShowNewTask] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setTasks(data);
      });
  }, [refreshKey]);

  const toggleTask = async (task: Task) => {
    const isCompleting = task.status !== 'concluida';
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, status: isCompleting ? 'concluida' : 'pendente' })
    });
    setRefreshKey(k => k + 1);
  };

  const pendingTasks = tasks.filter(t => t.status !== 'concluida');
  const completedTasks = tasks.filter(t => t.status === 'concluida');
  
  const todayTasks = pendingTasks.filter(t => t.due_date && isToday(new Date(t.due_date)));
  const overdueTasks = pendingTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));

  const sortedPendingTasks = [...pendingTasks].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  const totalTasksThisWeek = tasks.length;
  const completedThisWeek = completedTasks.length;
  const progressPercent = totalTasksThisWeek === 0 ? 0 : Math.round((completedThisWeek / totalTasksThisWeek) * 100);

  const deleteTask = async (taskId: number) => {
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="flex flex-col min-h-screen bg-base-bg pb-[calc(80px+env(safe-area-inset-bottom))] w-full max-w-[414px] mx-auto relative shadow-2xl">
      <header className="p-6 pb-2 flex justify-between items-start pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-2xl font-display font-medium">Olá, {user.name} 👋</h1>
          <p className="text-base-text/60 capitalize">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
        </motion.div>
        <button onClick={onLogout} className="p-2 text-base-text/40 hover:text-base-text transition-colors">
          <LogOut size={20} />
        </button>
      </header>

      <main className="flex-1 p-6 flex flex-col gap-8">
        {view === 'home' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-8">
            
            <section className="bg-white p-5 rounded-2xl border border-black/5 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-base-text">Progresso Geral</h3>
                <span className="text-sm text-base-text/60 font-medium">{completedThisWeek} de {totalTasksThisWeek} tarefas</span>
              </div>
              <div className="h-2.5 w-full bg-base-bg rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }}
                  className="h-full bg-sage-green rounded-full"
                />
              </div>
            </section>

            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-display font-semibold">Hoje</h2>
              </div>
              
              {overdueTasks.length > 0 && (
                <div className="mb-4">
                  <span className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2 block">Atrasadas</span>
                  <div className="flex flex-col gap-3">
                    {overdueTasks.map(t => <TaskCard key={t.id} task={t} onToggle={() => toggleTask(t)} onDelete={() => deleteTask(t.id)} />)}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {todayTasks.length === 0 && overdueTasks.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-3xl border border-black/5 shadow-sm">
                    <p className="text-base-text/60 font-medium">Tudo em dia por aqui! 🎉</p>
                  </div>
                ) : (
                  todayTasks.map(t => <TaskCard key={t.id} task={t} onToggle={() => toggleTask(t)} onDelete={() => deleteTask(t.id)} />)
                )}
              </div>
            </section>

          </motion.div>
        )}

        {view === 'tasks' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
            <h2 className="text-lg font-display font-semibold mb-2">Todas as Pendências</h2>
            {sortedPendingTasks.map(t => <TaskCard key={t.id} task={t} onToggle={() => toggleTask(t)} onDelete={() => deleteTask(t.id)} />)}
            {sortedPendingTasks.length === 0 && (
              <p className="text-center text-base-text/50 mt-10">Nenhuma tarefa pendente.</p>
            )}
          </motion.div>
        )}

        {view === 'history' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-4">
            <h2 className="text-lg font-display font-semibold mb-2">Histórico da Semana</h2>
            
            <div className="bg-[#FAF7F2] border border-black/5 p-5 rounded-2xl shadow-sm mb-4">
              <h3 className="font-semibold text-base-text mb-2">Placar da Limpeza 🧹</h3>
              <p className="text-sm text-base-text/70 mb-2">
                Henrique concluiu {completedTasks.filter(t => t.assigned_to === 1).length}, 
                Jessica concluiu {completedTasks.filter(t => t.assigned_to === 2).length}. 💪
              </p>
              <p className="text-xs text-base-text/50 italic">
                Lembrete: isso não é uma competição (mas quem fizer menos paga a pizza 🍕).
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {completedTasks.length > 0 ? (
                completedTasks.map(t => <TaskCard key={t.id} task={t} onToggle={() => toggleTask(t)} onDelete={() => deleteTask(t.id)} />)
              ) : (
                <p className="text-center text-base-text/50 mt-4">Nenhuma tarefa concluída ainda.</p>
              )}
            </div>
          </motion.div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 w-full pointer-events-none flex justify-center z-40">
        <nav className="w-full max-w-[414px] bg-white/90 backdrop-blur-lg border-t border-black/5 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex justify-between items-center pointer-events-auto">
          <NavButton icon={<Home />} label="Início" active={view === 'home'} onClick={() => setView('home')} />
          <NavButton icon={<ListTodo />} label="Tarefas" active={view === 'tasks'} onClick={() => setView('tasks')} />
          <div className="relative -top-6">
            <button 
              onClick={() => setShowNewTask(true)}
              className="bg-sage-green text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center transform active:scale-95 transition-transform"
            >
              <Plus size={28} />
            </button>
          </div>
          <NavButton icon={<HistoryIcon />} label="Histórico" active={view === 'history'} onClick={() => setView('history')} />
          <button onClick={onLogout} className="flex flex-col items-center gap-1 p-2 text-base-text/40 hover:text-base-text/80 transition-colors">
            <LogOut size={22} />
            <span className="text-[10px] font-medium">Sair</span>
          </button>
        </nav>
      </div>

      {/* Basic New Task Modal */}
      {showNewTask && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 pb-0 sm:pb-4">
          <motion.div 
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-display font-semibold text-xl">Nova Tarefa</h2>
              <button onClick={() => setShowNewTask(false)} className="text-base-text/50">✕</button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: formData.get('title'),
                  category: formData.get('category'),
                  assigned_to: formData.get('assigned_to') ? parseInt(formData.get('assigned_to') as string) : null,
                  due_date: formData.get('due_date') || null,
                })
              });
              setShowNewTask(false);
              setRefreshKey(k => k + 1);
            }} className="flex flex-col gap-4">
              <input required name="title" placeholder="O que precisa ser feito?" className="p-3 bg-base-bg rounded-xl w-full outline-none focus:ring-2 focus:ring-sage-green/50" />
              
              <select name="category" className="p-3 bg-base-bg rounded-xl w-full outline-none">
                <option value="Limpeza">🧹 Limpeza</option>
                <option value="Cozinha">🍳 Cozinha</option>
                <option value="Compras">🛒 Compras</option>
                <option value="Contas">💳 Contas</option>
                <option value="Manutenção">🔧 Manutenção</option>
                <option value="Pets">🐾 Pets</option>
                <option value="Outros">📌 Outros</option>
              </select>

              <select name="assigned_to" className="p-3 bg-base-bg rounded-xl w-full outline-none">
                <option value="">Nós dois</option>
                <option value="1">Henrique</option>
                <option value="2">Jessica</option>
              </select>

              <input type="date" name="due_date" className="p-3 bg-base-bg rounded-xl w-full outline-none" />

              <button type="submit" className="mt-4 bg-base-text text-white p-4 rounded-xl font-medium w-full hover:bg-black/80 transition-colors">
                Criar Tarefa
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
    <button onClick={onClick} className={cn("flex flex-col items-center gap-1 p-2 transition-colors", active ? "text-sage-green" : "text-base-text/40 hover:text-base-text/80")}>
      {React.cloneElement(icon as React.ReactElement<any>, { size: 22 })}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function TaskCard({ task, onToggle, onDelete }: { task: Task, onToggle: () => void, onDelete: () => void }) {
  const isCompleted = task.status === 'concluida';
  
  return (
    <div className="relative overflow-hidden rounded-2xl group w-full touch-pan-y">
      {/* Background Action Colors */}
      <div className="absolute inset-0 flex justify-between items-center px-6">
        <div className="text-sage-green opacity-80 font-medium text-sm flex items-center gap-2">
          <CheckCircle2 size={24} /> <span className="hidden sm:inline">Concluir</span>
        </div>
        <div className="text-red-500 opacity-80 font-medium text-sm flex items-center gap-2">
          <span className="hidden sm:inline">Excluir</span> <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/><path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M9 9l6 6M15 9l-6 6"/>
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
          "bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex items-center gap-4 transition-colors relative z-10 min-h-[80px]",
          isCompleted && "opacity-80 bg-[#f9f9f9]"
        )}
      >
        <button onClick={onToggle} className={cn("flex-shrink-0 transition-all active:scale-75", isCompleted ? "text-sage-green" : "text-base-text/20")}>
          {isCompleted ? <CheckCircle2 size={28} /> : <Circle size={28} />}
        </button>
        <div className="flex-1 overflow-hidden">
          <h3 className={cn("font-medium transition-all truncate text-[17px]", isCompleted && "line-through text-base-text/50")}>{task.title}</h3>
          <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-base-text/60 items-center font-medium">
            <span className="bg-base-text/5 px-2 py-0.5 rounded-md">{task.category}</span>
            {task.assigned_to === 1 && <span className="bg-sage-green/10 text-sage-green px-2 py-0.5 rounded-md">Henrique</span>}
            {task.assigned_to === 2 && <span className="bg-terracotta/10 text-terracotta px-2 py-0.5 rounded-md">Jessica</span>}
            {!task.assigned_to && <span className="bg-black/5 px-2 py-0.5 rounded-md">Nós dois</span>}
            {task.due_date && (
              <span className={cn(
                "px-2 py-0.5 rounded-md", 
                isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && !isCompleted ? "bg-red-50 text-red-500" : "bg-base-bg"
              )}>
                {format(new Date(task.due_date), "dd/MM", { locale: ptBR })}
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
