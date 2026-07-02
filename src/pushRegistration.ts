const VAPID_PUBLIC_KEY = 'BJtAV4Yb8o3QhhKS_v53gXfxWb1lePXa4xFi5N9khDWkvdsk7p81tm26sm2rkaGr-PChChYj2NcCimmhieiWzhA';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorkerAndSubscribe(): Promise<{ success: boolean; message: string }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, message: 'Notificações de push não são suportadas por este navegador ou app.' };
  }

  try {
    // Register Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registrado:', registration);

    // Request Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, message: 'Permissão para notificações não foi concedida.' };
    }

    // Subscribe User
    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    };

    const subscription = await registration.pushManager.subscribe(subscribeOptions);
    console.log('Push subscription obtido:', subscription);

    // Send to backend
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscription }),
    });

    if (!response.ok) {
      throw new Error('Falha ao salvar a assinatura no servidor.');
    }

    return { success: true, message: 'Lembretes diários ativados com sucesso!' };
  } catch (error: any) {
    console.error('Erro ao configurar push:', error);
    return { success: false, message: error.message || 'Erro ao registrar notificações.' };
  }
}

export async function checkPushSubscriptionStatus(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null && Notification.permission === 'granted';
  } catch {
    return false;
  }
}
