(function () {
  try {
    var p = localStorage.getItem('app-workout:tema:v1');
    var escuro = p === 'escuro' || ((p !== 'claro') && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-tema', escuro ? 'escuro' : 'claro');
    var pal = localStorage.getItem('app-workout:paleta:v1');
    if (pal) document.documentElement.setAttribute('data-paleta', pal);
    if (escuro) document.querySelector('meta[name="theme-color"]').setAttribute('content', '#14171a');
  } catch (e) {}
})();
