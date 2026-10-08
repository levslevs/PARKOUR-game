  function readPreference(key){
    if(window.parkourNative) return window.parkourNative.values[key] || null;
    return localStorage.getItem(key);
  }
  function writePreference(key,value){
    if(window.parkourNative){
      window.parkourNative.values[key]=value;
      window.webkit.messageHandlers.parkour.postMessage({action:'save',key:key,value:value});
    }else localStorage.setItem(key,value);
  }
