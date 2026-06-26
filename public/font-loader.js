(function() {
  var link = document.getElementById('font-preload');
  if (!link) return;
  link.addEventListener('load', function() {
    link.rel = 'stylesheet';
  });
})();
