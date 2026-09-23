// Applica il tema prima del primo disegno, per evitare il lampo di tema sbagliato.
// File esterno (non inline) perché la CSP consente solo script da 'self'.
// Chiave e valori allineati a src/app/theme.ts.
;(function () {
  var preference = 'system'
  try {
    var saved = window.localStorage.getItem('op-codex-theme')
    if (saved === 'light' || saved === 'dark') preference = saved
  } catch {
    /* storage non disponibile: si segue il sistema */
  }
  var dark =
    preference === 'dark' ||
    (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
})()
