/*!
 * TW-AMR Watch embed loader — https://ancientsky.github.io/tw_amr_dashboard/
 * Usage:
 *   <script src="https://ancientsky.github.io/tw_amr_dashboard/embed.js"
 *           data-chart="resistance-trend" data-pathogen="KPN" data-antibiotic="MEM"
 *           data-lang="zh-TW" data-theme="light" async></script>
 * Replaces its own <script> tag with a responsive, auto-height iframe.
 */
(function () {
  'use strict';
  var script = document.currentScript;
  if (!script) {
    var all = document.querySelectorAll('script[src*="embed.js"][data-chart]:not([data-twamr-done])');
    script = all[all.length - 1];
  }
  if (!script || script.getAttribute('data-twamr-done')) return;
  script.setAttribute('data-twamr-done', '1');

  var ALLOWED = ['chart', 'pathogen', 'antibiotic', 'level', 'ward', 'setting', 'years', 'lang', 'theme', 'compact'];
  var src = script.getAttribute('src') || '';
  var base = src.replace(/embed\.js(?:[?#].*)?$/, '');
  var params = [];
  for (var i = 0; i < ALLOWED.length; i++) {
    var v = script.getAttribute('data-' + ALLOWED[i]);
    if (v !== null && v !== '') params.push(ALLOWED[i] + '=' + encodeURIComponent(v));
  }
  var id = 'twamr-' + Math.random().toString(36).slice(2, 10);
  params.push('id=' + id);

  var iframe = document.createElement('iframe');
  iframe.src = base + 'embed.html#/?' + params.join('&');
  iframe.title = script.getAttribute('data-title') || 'TW-AMR Watch — ' + (script.getAttribute('data-chart') || 'chart');
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('allow', 'clipboard-write; fullscreen; web-share');
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  iframe.id = id;
  var maxWidth = script.getAttribute('data-max-width');
  iframe.style.cssText =
    'display:block;width:100%;border:0;overflow:hidden;background:transparent;color-scheme:normal;' +
    'height:' + (script.getAttribute('data-height') || '440px') + ';' +
    (maxWidth ? 'max-width:' + maxWidth + ';' : '');

  window.addEventListener('message', function (e) {
    if (e.source !== iframe.contentWindow) return;
    var d = e.data;
    if (d && d.type === 'twamr:resize' && d.id === id && typeof d.height === 'number' && d.height > 0) {
      iframe.style.height = Math.ceil(d.height) + 'px';
    }
  });

  if (script.parentNode) {
    script.parentNode.insertBefore(iframe, script);
    script.parentNode.removeChild(script);
  }
})();
