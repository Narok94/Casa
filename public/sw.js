self.addEventListener('push', (event) => {
  let data = { title: 'Lar & Harmonia', body: 'Você tem novas tarefas!' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Lar & Harmonia', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-180.png',
    badge: '/icon-180.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
