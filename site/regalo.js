// Pulsante "Stampa" delle pagine dei regali.
(function () {
  var b = document.getElementById("stampa");
  if (b) b.addEventListener("click", function () { window.print(); });
})();
