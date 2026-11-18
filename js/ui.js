/* ui.js — small helpers shared by all screens. */
(function (root) {
  'use strict';
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pct(x) { return x == null ? '—' : Math.round(x * 100) + '%'; }
  var toastTimer;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }
  // Format a move list as "1. e4 e5 2. Nf3 …" with optional current index highlight.
  function moveListHtml(sans, startColor, current, startNumber) {
    var out = '', num = startNumber || 1, white = startColor !== 'b';
    sans.forEach(function (s, i) {
      if (white) out += '<span class="mnum">' + num + '.</span>';
      else if (i === 0) out += '<span class="mnum">' + num + '…</span>';
      out += '<button type="button" class="mv' + (i === current ? ' cur' : '') + '" data-i="' + i + '">' + esc(s) + '</button>';
      if (!white) num++;
      white = !white;
    });
    return out || '<span class="muted">No moves yet.</span>';
  }
  function bar(value, cls) {
    var v = value == null ? 0 : Math.max(0, Math.min(1, value));
    return '<div class="bar ' + (cls || '') + '"><span style="width:' + Math.round(v * 100) + '%"></span></div>';
  }
  function sideName(c) { return c === 'w' ? 'White' : 'Black'; }
  function download(filename, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { toast('Copied to clipboard'); }, function () { toast('Could not copy — select the text and copy it manually.'); });
    toast('Select the text and copy it manually.');
  }
  root.CT.UI = { esc: esc, pct: pct, toast: toast, moveListHtml: moveListHtml, bar: bar, sideName: sideName, download: download, copy: copy };
})(window);
