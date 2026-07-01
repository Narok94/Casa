import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { Check, Delete } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const users = [
    { id: 1, name: 'Henrique', color: 'bg-sage-green text-white' },
    { id: 2, name: 'Jessica', color: 'bg-terracotta text-white' }
  ];

  const handleKeypad = async (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: selectedUser, pin: newPin })
          });
          const data = await res.json();
          if (res.ok) {
            onLogin(data.user);
          } else {
            setError('PIN Incorreto');
            setTimeout(() => {
              setPin('');
              setError('');
            }, 1000);
          }
        } catch (e: any) {
          console.error(e);
          setError('Erro: ' + e.message);
        }
      }
    }
  };

  if (!selectedUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-md mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="text-4xl font-display text-base-text mb-2">Nosso Lar</h1>
          <p className="text-base-text/60">Quem está acessando?</p>
        </motion.div>
        
        <div className="grid grid-cols-2 gap-6 w-full">
          {users.map((u) => (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              key={u.id}
              onClick={() => setSelectedUser(u.id)}
              className={cn("flex flex-col items-center justify-center aspect-square rounded-3xl shadow-sm border border-black/5", u.color)}
            >
              <div className="text-4xl font-display mb-2">{u.name[0]}</div>
              <div className="font-medium">{u.name}</div>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 max-w-sm mx-auto">
      <motion.button 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="mb-8 text-base-text/60 text-sm hover:underline"
        onClick={() => { setSelectedUser(null); setPin(''); setError(''); }}
      >
        ← Voltar
      </motion.button>

      <div className="mb-8 flex gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={cn(
            "w-4 h-4 rounded-full transition-colors duration-200",
            i < pin.length ? "bg-base-text" : "bg-black/10"
          )} />
        ))}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-500 mb-4 font-medium">
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'].map((key, i) => (
          <div key={i} className="flex justify-center">
            {key === 'del' ? (
              <button onClick={() => setPin(pin.slice(0, -1))} className="w-16 h-16 rounded-full flex items-center justify-center text-xl text-base-text/60 active:bg-black/5">
                <Delete size={24} />
              </button>
            ) : key !== '' ? (
              <button 
                onClick={() => handleKeypad(key.toString())}
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-display font-medium bg-white shadow-sm border border-black/5 active:bg-black/5 transition-colors"
              >
                {key}
              </button>
            ) : <div />}
          </div>
        ))}
      </div>
    </div>
  );
}
