const VAPID_PUBLIC_KEY = 'BCibInLpIhe82-bpBCIWej0F5bBO8j1xAc2jTb41xXQsWYfmjPEXy8TDSv7XK6AGrXS22kKLPOd1rNo2VIXM9K4';
var subscribeButton = null;
var unsubscribeButton = null;
var testButton = null;


  

  


window.onload = function(){
    subscribeButton = document.getElementById('subscribe');
    unsubscribeButton = document.getElementById('unsubscribe');
    testButton = document.getElementById('test')
    pushNotificationPanel = document.getElementById('push-notification-panel');

    subscribeButton.addEventListener('click', subscribeButtonHandler);
    unsubscribeButton.addEventListener('click', unsubscribeButtonHandler);
    testButton.addEventListener('click', testButtonHandler);

    if (registerServiceWorker()) {
      subscribeButton.disabled = false;
      pushNotificationPanel.style.display = 'block';
    } else {
      console.log("JJJJ");
    }
    
   // code goes here
};

async function subscribeButtonHandler() {
  subscribeButton.disabled = true;
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      console.info('The user accepted the permission request.');
      const registration = await navigator.serviceWorker.getRegistration();
      var subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY) });
      }
      if (subscription) {
        unsubscribeButton.disabled = false;
        testButton.disabled = false;
        const subscriberId = subscription.endpoint.slice(-8);
        console.log("The user has been subscribed for push notifications as subscriber '" + subscriberId + "'");
        fetch('/plugins/alarm-manager/subscribe/' + subscriberId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription)}).then((r) => {
          if (r.status == 200) {
            console.info("Subscriber '" + subscriberId +"' is registered on the server");
          } else {
            throw new Error("Subscriber '" + subscriberId + "' could not be registered on the server (" + r.status + "%s)");
          }
        });          
      } else {
        console.info("The user could not be subscribed for push notifications");
      }
    } else {
      console.error('The user explicitly denied the push notification permission request');
    }
  } catch(e) {
    console.error(e.message);
  }
}

async function unsubscribeButtonHandler() {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    const subscriberId = subscription.endpoint.slice(-8);
    fetch('/plugins/alarm-manager/unsubscribe/' + subscriberId, { method: 'DELETE' }).then((r) => {
      if (r.status === 200) {
        console.info("Subscriber '" + subscriberId + "' has been deleted from server");
      } else {
        throw new Error("Subscriber '" + subscriberId + "' could not be deleted from server (" + r.status + ")");
      }
    })
    const unsubscribed = await subscription.unsubscribe();
    if (unsubscribed) {
      console.info("Subscriber '" + subscriberId + "' has been unsubscribed from push notifications");
      unsubscribeButton.disabled = true;
      subscribeButton.disabled = false;
      testButton.disabled = true;
    }
  } catch(e) {
    console.error(e.message);
  }
}

async function testButtonHandler() {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    fetch('/plugins/alarm-manager/notify/' + subscription.endpoint.slice(-8), { method: 'PATCH' }).then((r) => {
      console.info("Server accepted notify request");
    }).catch((e) => {
      console.error("Server rejected notify request");
    });
}

function registerServiceWorker() {
  var retval = false;

  if (('serviceWorker' in navigator) && ('PushManager' in window)) {
    navigator.serviceWorker.register('./service-worker.js').then(serviceWorkerRegistration => {
      ;
    }).catch(error => {
      console.error("An error occurred while registering the service worker (" + error + ")");
    });
    retval = true;
  } else {
    console.error("Browser does not support service workers or push messages");
  }
  return(retval);
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