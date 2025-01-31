
self.addEventListener("install", e => {
    console.log("Install!");
    e.waitUntil(
        caches.open('static').then( cache => {
            // TODO correct the list it is changed
            const resourcesToCache = 
                [
                    './',
                    './help.glb',
                    './manifest.json',         
                    './images/logo192.png',
                    './images/logo512.png',
                    './half_tr__texture.png',
                    './click.mp3',
                    './simple-piano-melody-9834.mp3',
                    './sunrise_105.mp3',                
                    './favicon.ico',
                    './html-component.js',
                    './handy-component.js',
                    './HTMLMesh.js',
                    './random-tree.js',
                    './worker.js',
                    './node_modules/aframe/dist/aframe-v1.4.2.js',
                    './node_modules/three/build/three.module.js',
                    './node_modules/super-three/build/three.js',
                    './node_modules/super-three/examples/jsm/loaders/GLTFLoader.js',
                    './node_modules/super-three/examples/jsm/libs/motion-controllers.module.js',
                    './node_modules/super-three/examples/jsm/webxr/XRControllerModelFactory.js?v=f50dc469',
                    './node_modules/super-three/examples/jsm/webxr/XRHandModelFactory.js?v=f50dc469',
                    './node_modules/super-three/examples/jsm/webxr/XRHandPrimitiveModel.js?v=f50dc469',
                    './node_modules/super-three/examples/jsm/webxr/XRHandMeshModel.js',
                    './generic-hand/left.glb',
                    './generic-hand/right.glb',
                    './generic-hand/profile.json',

                    'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/profilesList.json',
                    'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/meta-quest-touch-plus/profile.json',
                    'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/oculus-touch-v3/profile.json',
                    'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/oculus-touch-v3/right.glb',
                    'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/oculus-touch-v3/left.glb',
                    'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/meta-quest-touch-plus/right.glb',
                    'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/meta-quest-touch-plus/left.glb'
    
                
            ];
            const progressStep = 100 / resourcesToCache.length;
            let currentProgress = 0;
            const fetchPromises = resourcesToCache.map(url => {
                return fetch(url)
                  .then(response => cache.put(url, response.clone())
                    .then(() => {
                        currentProgress += progressStep;
                        // https://developer.mozilla.org/en-US/docs/Web/API/Clients/matchAll
                        self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
                            .then(clients => {
                                clients.forEach(client => {
                                    // Send a message to each client
                                    console.log('trying to post a message, currentProgress: ' + currentProgress);
                                    client.postMessage({
                                        progress: currentProgress
                                    });
                                });
                            });
                    }))
                  .catch(error => console.error(`Failed to cache ${url}: ${error}`));
              });
          
              return Promise.all(fetchPromises);
        }).catch((err) => {
            console.error('Caching failed:', err);
        }).then(() => {
            console.log('caching complete');
        })
    );
});

self.addEventListener("fetch", e => {
    console.log(`Intercepting fetch ${e.request.url}`);
    let currentUrl = new URL(self.registration.scope);
    // in case of developing mode
    if(currentUrl.port == 5173) {
        return fetch(e.request);
    }

    e.respondWith( 
        caches.match(e.request).then( response => {
            return response || fetch(e.request);
        })
    );
});