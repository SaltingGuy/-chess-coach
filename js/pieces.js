/* pieces.js — Original SVG chess piece set (drawn for this project). */
(function (root) {
  'use strict';
  var shapes = {
    p: '<path d="M22.5 9a4.5 4.5 0 0 0-3.6 7.2A6.5 6.5 0 0 0 16 21.5c0 2.1 1 3.9 2.5 5.1-3 1.1-7.5 4.3-7.5 11.9h23c0-7.6-4.5-10.8-7.5-11.9 1.5-1.2 2.5-3 2.5-5.1a6.5 6.5 0 0 0-2.9-5.3A4.5 4.5 0 0 0 22.5 9z"/>',
    r: '<path d="M9 39h27v-3.5H9z"/><path d="M12 35.5l1.5-4h18l1.5 4z"/><path d="M14 31.5v-14h17v14z"/>' +
       '<path d="M11 14V9h4v2.5h5V9h5v2.5h5V9h4v5l-3 3.5H14z"/><path class="d" d="M14 17.5h17M13.5 31.5h18" fill="none"/>',
    n: '<path d="M13 39h22c0-9-.6-18.5-5.2-24.5L28.5 8l-4 4-3.3-3-.7 4.2C14.5 15 10.4 19.6 8.2 25l2.3 3.2 4-2.2 2.8-.7c.3 4.2-4.3 6.5-4.3 13.7z"/>' +
       '<circle class="e" cx="20.5" cy="17.5" r="1.4"/><path class="d" d="M25 14.5c3 3.5 4.6 9 4.8 15" fill="none"/>',
    b: '<path d="M10.5 39h24v-3.5h-24z"/><path d="M15 35.5c1.2-2.8 1.5-5.5 1.5-5.5h12s.3 2.7 1.5 5.5z"/>' +
       '<path d="M22.5 9.5c-7.8 5.6-10.4 13.2-7.4 20.5h14.8c3-7.3.4-14.9-7.4-20.5z"/><circle cx="22.5" cy="7" r="2.7"/>' +
       '<path class="d" d="M19.3 16.2l6.4 6.4M16.2 30h12.6" fill="none"/>',
    q: '<path d="M10 39h25v-3.5H10z"/><path d="M11.5 35.5l1.8-5.5h18.4l1.8 5.5z"/>' +
       '<path d="M13.3 30L9 14l5.2 10L15.5 10l3.6 12 3.4-14 3.4 14 3.6-12 1.3 14L36 14l-4.3 16z"/>' +
       '<circle cx="9" cy="13" r="2.2"/><circle cx="15.5" cy="9.3" r="2.2"/><circle cx="22.5" cy="7.3" r="2.2"/><circle cx="29.5" cy="9.3" r="2.2"/><circle cx="36" cy="13" r="2.2"/>' +
       '<path class="d" d="M13.3 30h18.4" fill="none"/>',
    k: '<path d="M10 39h25v-3.5H10z"/>' +
       '<path d="M11 35.5c-2.2-6.2-1.6-12.4 3.2-15 3.6-1.9 6.6-.4 8.3 3.2 1.7-3.6 4.7-5.1 8.3-3.2 4.8 2.6 5.4 8.8 3.2 15z"/>' +
       '<path class="x" d="M22.5 5.5v13M18.3 9.8h8.4" fill="none"/>' +
       '<path class="d" d="M12.6 30.2c6.2-2.6 13.6-2.6 19.8 0M22.5 23.7v6" fill="none"/>'
  };
  function svg(color, type) {
    var cls = color === 'w' ? 'pc-w' : 'pc-b';
    return '<svg class="piece ' + cls + '" viewBox="0 0 45 45" aria-hidden="true">' + shapes[type] + '</svg>';
  }
  var names = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  root.CT = root.CT || {};
  root.CT.Pieces = { svg: svg, names: names };
})(typeof window !== 'undefined' ? window : globalThis);
