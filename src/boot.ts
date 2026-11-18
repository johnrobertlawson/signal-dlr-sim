if (document.querySelector('meta[name="dlr-desktop"]')) {
  let windowConnection = new EventSource('/__dlr/window');
  window.addEventListener('pagehide', () => windowConnection.close());
  window.addEventListener('pageshow', e => {
    if (e.persisted) windowConnection = new EventSource('/__dlr/window');
  });
}

if (new URLSearchParams(location.search).get('mode') === 'fleet') {
  void import('./fleetCamera').then(({ mountFleetWall }) => mountFleetWall());
} else {
  void import('./main');
}

export {};
