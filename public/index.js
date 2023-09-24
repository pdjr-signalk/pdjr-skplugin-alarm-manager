const VAPID_PUBLIC_KEY = 'BCibInLpIhe82-bpBCIWej0F5bBO8j1xAc2jTb41xXQsWYfmjPEXy8TDSv7XK6AGrXS22kKLPOd1rNo2VIXM9K4';
var subscribeButton = null;
var unsubscribeButton = null;
var notifyMeButton = null;
var notifyAllButton = null;

async function subscribeButtonHandler() {
    subscribeButton.disabled = true;
    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        console.info('The user accepted the permission request.');
        const registration = await navigator.serviceWorker.getRegistration();
        const subscribed = await registration.pushManager.getSubscription();
        if (subscribed) {
          console.info('User is already subscribed.');
          notifyMeButton.disabled = false;
          unsubscribeButton.disabled = false;
        } else {
          console.info("User not already subscribed, trying now");
          const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY) });
          fetch('/plugins/alarm-manager/subscribe/' + subscription.endpoint.slice(-8), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription)}).then((r) => {
            if (r.status == 200) {
              console.info("Server add-subscriber request completed successfully");
              notifyMeButton.disabled = false;
              unsubscribeButton.disabled = false;
            } else {
              throw new Error("Server rejected add-subscriber request (Error " + r.status + ")");
            }
          });
        }
      } else {
        console.error('The user explicitly denied the permission request.');
      }
    } catch(e) {
      console.error(e.message);
    }
    
}
  
async function unsubscribeButtonHandler() {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    fetch('/plugins/alarm-manager/unsubscribe/' + subscription.endpoint.slice(-8), { method: 'DELETE' }).then((r) => {
      if (r.status === 200) {
        console.info("Server remove-subscriber request completed successfully");
      } else {
        throw new Error("Server rejected remove-subscriber request (Error " + r.status + ")");
      }
    })
    const unsubscribed = await subscription.unsubscribe();
    if (unsubscribed) {
      console.info('Successfully unsubscribed from push notifications.');
      unsubscribeButton.disabled = true;
      subscribeButton.disabled = false;
      notifyMeButton.disabled = true;
    }
  } catch(e) {
    console.error(e.message);
  }
}
  
// Convert a base64 string to Uint8Array.
// Must do this so the server can understand the VAPID_PUBLIC_KEY.
function urlB64ToUint8Array(base64String) {
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

window.onload = function(){
    subscribeButton = document.getElementById('subscribe');
    unsubscribeButton = document.getElementById('unsubscribe');
    notifyMeButton = document.getElementById('notify-me')
    notifyAllButton = document.getElementById('notify-all');

    subscribeButton.addEventListener('click', subscribeButtonHandler);
    unsubscribeButton.addEventListener('click', unsubscribeButtonHandler);
    notifyMeButton.addEventListener('click', notifyMeButtonHandler);
    notifyAllButton.addEventListener('click', notifyAllButtonHandler);

    if (('serviceWorker' in navigator) && ('PushManager' in window)) {
        navigator.serviceWorker.register('./service-worker.js').then(serviceWorkerRegistration => {
          console.info('Service worker was registered.');
          console.info({serviceWorkerRegistration});
        }).catch(error => {
          console.error('An error occurred while registering the service worker.');
          console.error(error);
        });
        subscribeButton.disabled = false;
    } else {
        console.error('Browser does not support service workers or push messages.');
    }
    
   // code goes here
};

async function notifyMeButtonHandler() {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    fetch('/plugins/alarm-manager/notify/' + subscription.endpoint.slice(-8), { method: 'PATCH' }).then((r) => {
      console.info("Server accepted notify request");
    }).catch((e) => {
      console.error("Server rejected notify request");
    });
}
  
async function notifyAllButtonHandler() {
    const response = await fetch('/notify-all', {
      method: 'POST'
    });
    if (response.status === 409) {
      document.getElementById('notification-status-message').textContent =
          'There are no subscribed endpoints to send messages to, yet.';
    }
}