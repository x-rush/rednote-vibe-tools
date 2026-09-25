(function () {
  'use strict';
  var c = window.STORY_CONTENT, ui = c.ui, engine = window.StoryEngine;
  var key = 'spring-letter:v1', app = document.getElementById('app'), modalRoot = document.getElementById('modal-root');
  var save = { version: c.version, path: [], unlocked: [], seen: [], large: false, still: false, chapter: c.defaultChapter, beat: 0, frameId: '', read: [], artwork: [], instant: false, music: true, voices: true };
  var view = 'home', state, storage, busy = false, timer, storageFailed = false, modalOpener, pendingChapter, renderedScene = '', auto = false, autoTimer, typingTimer, typing = null;
  var sound, lastAudioFrame = '', suppressAudio = false;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]; }); }
  function paragraphs(list) { return list.map(function (s) { return '<p>' + esc(s) + '</p>'; }).join(''); }
  function button(action, text, style, attrs) { return '<button type="button" class="' + (style || '') + '" data-action="' + action + '" ' + (attrs || '') + '>' + esc(text) + '</button>'; }
  function toast(text) { var el = document.getElementById('status'); el.textContent = text; clearTimeout(timer); if (!storageFailed) timer = setTimeout(function () { el.textContent = ''; }, 4000); }
  sound = window.StoryAudio(window.STORY_AUDIO, c.audio, toast);
  function updateSound() {
    var n = c.nodes[state.node] || c.endings[state.node], frames = beats(), frame = frames[save.beat], frameKey = view + ':' + state.node + ':' + save.beat;
    var cue = view === 'story' && frame && frameKey !== lastAudioFrame && !suppressAudio && !modalRoot.firstChild ? frame.audio : null;
    sound.configure(save.music, save.voices);
    var stage = engine.stage(n, frames, Math.min(save.beat, frames.length - 1));
    sound.scene(view === 'story' ? stage.music : null, cue);
    lastAudioFrame = frameKey; suppressAudio = false;
  }
  function persist() {
    if (!storage) { storageFailed = true; toast(ui.saveFail); return; }
    storage.write(save).then(function (saved) {
      if (!saved) { storageFailed = true; toast(ui.saveFail); }
    }, function () { storageFailed = true; toast(ui.saveFail); });
  }
  function chapter() { return c.chapters.filter(function (x) { return x.id === save.chapter; })[0]; }
  function sync() { state = engine.replay(c, save.path, save.chapter); }
  function beats() {
    var n = c.nodes[state.node];
    if (!n) return (c.endings[state.node].epilogue || []).filter(function (b) { return engine.matches(state.flags, b.when); });
    var list = n.beats.filter(function (b) { return engine.matches(state.flags, b.when); });
    if (!save.path.length) list.unshift({ id: 'context', speaker: ui.narrator, text: chapter().context });
    if (state.echo) list.unshift({ id: 'echo', speaker: ui.narrator, text: state.echo });
    return list;
  }
  function markRead(frame) {
    var id = engine.readKey(state.node, frame);
    if (save.read.indexOf(id) < 0) save.read.push(id);
    if (save.read.length > 3000) save.read.shift();
  }
  function advance() {
    if (typing) { finishTyping(); return; }
    var list = beats(), index = Math.min(save.beat || 0, list.length);
    if (index >= list.length) return;
    markRead(list[index]); save.beat = index + 1; save.frameId = '';
    persist(); render();
  }
  function finishTyping() {
    clearInterval(typingTimer);
    if (typing) typing.element.textContent = typing.text;
    typing = null;
  }
  function stopAuto() {
    clearTimeout(autoTimer); auto = false;
    var control = app.querySelector('[data-action=auto]');
    if (control) { control.textContent = ui.auto; control.setAttribute('aria-pressed', 'false'); }
  }
  function readingEffects() {
    var text = app.querySelector('.dialogue-text'), frames;
    if (text && !save.instant && !save.still && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      var full = text.textContent, count = 0;
      typing = { element: text, text: full }; text.textContent = '';
      typingTimer = setInterval(function () { count += 2; text.textContent = full.slice(0, count); if (count >= full.length) finishTyping(); }, 32);
    }
    if (!auto) return;
    if (view !== 'story' || !text || modalRoot.firstChild || document.hidden) { stopAuto(); return; }
    frames = beats();
    var length = frames[Math.min(save.beat, frames.length - 1)].text.length;
    autoTimer = setTimeout(function () { finishTyping(); advance(); }, Math.max(2400, length * 95));
  }
  function header(sub) { return '<header class="safe-head"><span class="brand">' + esc(c.title) + '</span><span class="head-sub">' + esc(sub) + '</span></header>'; }
  function footer() { return '<nav class="utility" aria-label="' + esc(ui.settings) + '">' + button('home', ui.home) + button('history', ui.history) + button('book', ui.book) + button('settings', ui.settings) + '</nav>'; }
  function focusHeading() { var el = app.querySelector('h1'); if (el && view !== 'home' && !c.nodes[state.node]) el.focus(); }
  function render() {
    finishTyping(); clearTimeout(autoTimer);
    sync();
    document.body.classList.toggle('large', save.large);
    document.body.classList.toggle('still', save.still);
    document.body.setAttribute('data-view', view);
    var setting = view === 'story' && c.nodes[state.node] ? c.nodes[state.node].background : 'courtyard';
    document.querySelector('.scenery').style.backgroundImage = 'url("' + c.art[setting] + '")';
    if (view === 'home') renderHome();
    else if (c.endings[state.node] && save.beat < beats().length) renderEpilogue();
    else if (c.endings[state.node]) renderEnding(state.node);
    else renderStory();
    var sceneKey = view + ':' + state.node;
    if (sceneKey !== renderedScene) window.scrollTo(0, 0);
    renderedScene = sceneKey;
    focusHeading();
    readingEffects();
    updateSound();
  }
  function renderHome() {
    app.innerHTML = header(c.subtitle) + '<section class="home"><div class="home-title"><span class="volume">' + esc(chapter().title) + '</span><h1>' + esc(c.title) + '</h1><img class="brand-logo" src="' + esc(c.art.brandLogo) + '" alt="" width="64" height="64"><p class="brand-tagline">' + esc(c.tagline) + '</p></div><div class="home-bottom"><h2>' + esc(chapter().hook || c.hook).replace(/\n/g, '<br>') + '</h2><p class="intro">' + esc(chapter().intro || c.intro).replace(/\n/g, '<br>') + '</p><div class="home-actions">' + button(save.path.length || save.beat ? 'continue' : 'start', save.path.length || save.beat ? ui.continue : ui.start, 'primary') + '<p class="audio-hint">' + esc(ui.audioStartHint) + '</p><p class="current-chapter">' + esc(chapter().title) + '</p>' + button('chapters', ui.chapterSelect, 'chapter-link') + '<div class="secondary-row">' + button('book', ui.book + ' · ' + save.unlocked.length + '/' + Object.keys(c.endings).length) + button('about', ui.about) + button('gallery', ui.gallery) + button('settings', ui.settings) + '</div></div><p class="disclaimer">' + esc(c.notice) + '</p></div></section>';
  }
  function sprite(id, active, emotion, slot) {
    var person = c.characters[id];
    if (!person) return '';
    var columns = person.columns || 4, atlas = person.atlas || emotion || 'neutral';
    return '<div data-character="' + id + '" class="sprite slot-' + slot + (active ? ' speaking' : ' listening') + ' emotion-' + emotion + '" role="img" aria-label="' + esc(person.name) + '" style="background-image:url(' + c.art[atlas] + ');background-size:' + (columns * 100) + '% 100%;background-position:' + (person.column * 100 / (columns - 1)) + '% 0"></div>';
  }
  function renderStory() { renderVisual(c.nodes[state.node], false); }
  function renderEpilogue() {
    var e = c.endings[state.node];
    document.querySelector('.scenery').style.backgroundImage = 'url("' + c.art[e.background] + '")';
    renderVisual({ title: e.title, act: ui.epilogue, place: chapter().title, cast: e.cast, background: e.background, music: e.music }, true);
  }
  function renderVisual(node, ending) {
    var frames = beats(), index = Math.min(save.beat || 0, frames.length), frame = frames[Math.min(index, frames.length - 1)], selecting = index === frames.length;
    var scene = engine.stage(node, frames, Math.min(index, frames.length - 1)), oldStage = app.querySelector('.vn-stage'), sameScene = renderedScene === view + ':' + state.node;
    document.querySelector('.scenery').style.backgroundImage = 'url("' + c.art[scene.background] + '")';
    var stage = '<div class="vn-stage' + (scene.cg ? ' event-stage' : '') + '" aria-hidden="true">';
    if (scene.cg) {
      stage += '<img class="event-art" src="' + c.art[scene.cg] + '" alt="">';
      if (save.artwork.indexOf(scene.cg) < 0) { save.artwork.push(scene.cg); persist(); }
    } else stage += scene.cast.map(function (id, slot) { return sprite(id, selecting || !frame.character || frame.character === id, scene.emotions[id] || 'neutral', slot); }).join('');
    stage += '<div class="stage-vignette"></div></div>';
    var content;
    if (selecting) {
      content = '<section class="choices"><p class="choice-prompt">' + esc(ui.choicePrompt) + '</p>' + node.choices.filter(function (choice) { return engine.matches(state.flags, choice.when); }).map(function (choice, i) {
        return '<button class="choice" data-action="choose" data-id="' + choice.id + '"><span class="choice-number" aria-hidden="true">' + String(i + 1).padStart(2, '0') + '</span><span><strong>' + esc(choice.text) + '</strong><small>' + esc(choice.hint || '') + '</small></span><span class="choice-arrow" aria-hidden="true">›</span></button>';
      }).join('') + '</section>';
    } else {
      content = '<div class="dialogue" role="button" tabindex="0" data-action="advance-dialogue" aria-label="' + esc(ui.clickDialogue) + '"><p class="speaker-name">' + esc(frame.speaker) + '</p><p class="dialogue-text' + (frame.character ? ' voiced' : '') + '">' + esc(frame.text) + '</p></div>';
    }
    var objects = node.inspect ? '<div class="scene-objects">' + c.items.map(function (item) { return button('inspect', item.name, 'prop-button', 'data-id="' + item.id + '"'); }).join('') + '</div>' : '';
    var nextAction = ending ? 'next-epilogue' : 'next-beat';
    var nextLabel = index === frames.length - 1 ? (ending ? ui.finishStory : ui.choicesReady) : ui.nextBeat;
    app.innerHTML = header(chapter().title) + '<section class="vn-scene" ' + (ending ? 'data-epilogue' : 'data-node') + '="' + state.node + '"><div class="vn-heading"><span class="chapter">' + esc(node.act) + '</span><h1 tabindex="-1">' + esc(node.title) + '</h1><p class="scene-place">' + esc(scene.place) + '</p></div>' + stage + '<div class="vn-panel">' + content + '<div class="dialogue-controls">' + button('prev-beat', ui.previousBeat, 'subtle', index === 0 ? 'disabled' : '') + '<span class="beat-count">' + Math.min(index + 1, frames.length) + ' / ' + frames.length + '</span>' + (selecting ? '<span class="beat-count">' + esc(ui.choicesReady) + '</span>' : button(nextAction, nextLabel, 'advance')) + '</div>' + objects + '<div class="scene-tools">' + button('log', ui.readLog) + button('skip-read', ui.skipRead) + (save.chapter === 'agency' ? button('clues', ui.clues) : '') + button('gallery', ui.gallery) + button('auto', auto ? ui.autoStop : ui.auto, '', 'aria-pressed="' + auto + '"') + '</div>' + footer() + '</div></section>';
    // Keep existing character DOM while changing only its expression or emphasis.
    if (sameScene && oldStage && !scene.cg && !oldStage.querySelector('.event-art')) {
      var nextStage = app.querySelector('.vn-stage');
      Array.prototype.slice.call(nextStage.querySelectorAll('[data-character]')).forEach(function (fresh) {
        var previous = oldStage.querySelector('[data-character="' + fresh.getAttribute('data-character') + '"]');
        if (previous) { previous.className = fresh.className; previous.setAttribute('style', fresh.getAttribute('style')); fresh.parentNode.replaceChild(previous, fresh); }
      });
    }
    save.frameId = selecting ? 'choices' : frame.id; persist();
  }
  function openGallery() {
    var people = Object.keys(c.characters).map(function (id) { var ch = c.characters[id]; return '<article class="cast-card"><div class="gallery-portrait">' + sprite(id, true, 'neutral', 0) + '</div><h3>' + esc(ch.name) + '</h3><p>' + esc(ch.anchor) + '</p></article>'; }).join('');
    var paintings = c.gallery.map(function (g) { return save.artwork.indexOf(g.id) >= 0 ? '<figure class="gallery-event"><img src="' + c.art[g.id] + '" alt="' + esc(g.name) + '"><figcaption>' + esc(g.name) + '</figcaption></figure>' : '<p class="locked-art">' + esc(ui.lockedArt) + '</p>'; }).join('');
    openModal(ui.gallery, '<p class="book-intro">' + esc(ui.galleryNote) + '</p><div class="cast-grid">' + people + '</div>' + paintings);
  }
  function openLog() {
    var entries = [];
    state.history.forEach(function (h, i) {
      var prior = engine.replay(c, save.path.slice(0, i), save.chapter);
      entries = entries.concat(c.nodes[h.node].beats.filter(function (b) { return engine.matches(prior.flags, b.when); }));
    });
    entries = entries.concat(beats().slice(0, Math.min((save.beat || 0) + 1, beats().length)));
    openModal(ui.allHistory, entries.map(function (b) { return '<div class="log-line"><strong>' + esc(b.speaker) + '</strong><p>' + esc(b.text) + '</p></div>'; }).join(''));
  }
  function openChapters() {
    openModal(ui.chapterSelect, '<p class="book-intro">' + esc(ui.chapterWarning) + '</p>' + c.chapters.map(function (ch) {
      return '<button class="chapter-option" data-action="select-chapter" data-id="' + ch.id + '"><small>' + esc(ch.tag) + '</small><strong>' + esc(ch.title) + '</strong><span>' + esc(ch.description) + '</span></button>';
    }).join(''));
  }
  function openClues() {
    var list = c.clues.filter(function (x) { return engine.matches(state.flags, x.when); });
    openModal(ui.clues, list.length ? list.map(function (x) { return '<div class="source"><h3>' + esc(x.title) + '</h3><p>' + esc(x.text) + '</p></div>'; }).join('') : '<p>' + esc(ui.clueEmpty) + '</p>');
  }
  function endingMarkup(id, inside) {
    var e = c.endings[id];
    return '<div class="ending-label">' + esc(ui.endingLabel) + '</div><div class="seal">' + esc(e.tag) + '</div><h1 tabindex="-1">' + esc(e.title) + '</h1><p class="ending-line">' + esc(e.line) + '</p><div class="prose">' + paragraphs(e.paragraphs) + '</div><div class="tradeoffs"><p><span>＋</span>' + esc(e.gain) + '</p><p><span>－</span>' + esc(e.cost) + '</p></div>' + (inside ? '' : '<p class="ending-hint">' + esc(e.hint) + '</p>');
  }
  function renderEnding(id) {
    if (save.unlocked.indexOf(id) < 0) { save.unlocked.push(id); persist(); }
    app.innerHTML = header(chapter().title) + '<section class="ending-page" data-ending="' + id + '">' + endingMarkup(id, false) + '<div class="ending-actions">' + button('history', ui.history, 'primary') + button('capture', ui.keepsake, 'outline', 'data-id="' + id + '"') + button('restart', ui.restart, 'text-button') + '</div><p class="ending-count">' + esc(ui.unlocked) + ' ' + save.unlocked.length + ' / ' + Object.keys(c.endings).length + ' ' + esc(ui.count) + '</p>' + footer() + '</section>';
  }
  function openModal(title, html, type) {
    finishTyping(); stopAuto(); sound.cancelVoice();
    modalOpener = document.activeElement;
    modalRoot.innerHTML = '<div class="modal-shade"><section class="modal ' + (type || '') + '" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-head"><h2 id="dialog-title">' + esc(title) + '</h2>' + button('close', ui.close, 'close-button') + '</div><div class="modal-body">' + html + '</div></section></div>';
    app.setAttribute('aria-hidden', 'true');
    app.setAttribute('inert', '');
    document.body.classList.add('modal-open');
    modalRoot.querySelector('button').focus();
  }
  function closeModal() {
    modalRoot.innerHTML = ''; app.removeAttribute('aria-hidden'); app.removeAttribute('inert'); document.body.classList.remove('modal-open');
    if (modalOpener && modalOpener.tagName === 'BUTTON' && document.contains(modalOpener)) modalOpener.focus();
    else { var fallback = app.querySelector('button'); if (fallback) fallback.focus(); }
  }
  function openBook() {
    openModal(ui.book, '<p class="book-intro">' + esc(ui.endingHint) + '</p><div class="book-list">' + Object.keys(c.endings).map(function (id, i) {
      var unlocked = save.unlocked.indexOf(id) >= 0, e = c.endings[id];
      return unlocked ? '<button class="book-entry" data-action="read-ending" data-id="' + id + '"><span>' + String(i + 1).padStart(2, '0') + '</span><div><strong>' + esc(e.title) + '</strong><small>' + esc(c.chapters.filter(function (ch) { return ch.id === e.chapter; })[0].title + ' · ' + e.tag) + '</small></div><b aria-hidden="true">›</b></button>' : '<div class="book-entry locked"><span>' + String(i + 1).padStart(2, '0') + '</span><div><strong>' + esc(ui.unknownEnding) + '</strong><small>' + esc(ui.unseen) + '</small></div></div>';
    }).join('') + '</div>');
  }
  function openHistory() {
    openModal(ui.history, '<p class="book-intro">' + esc(ui.historyHint) + '</p>' + (state.history.length ? '<ol class="history-list">' + state.history.map(function (entry, i) {
      var node = c.nodes[entry.node], choice = node.choices.filter(function (ch) { return ch.id === entry.choice; })[0];
      return '<li><span class="chapter">' + esc(node.act) + '</span><h3>' + esc(node.title) + '</h3><p>' + esc(choice.text) + '</p>' + button('rewind', ui.rewind, 'outline small-button', 'data-index="' + i + '"') + '</li>';
    }).join('') + '</ol>' : '<p>' + esc(ui.historyEmpty) + '</p>'));
  }
  function openSettings() {
    openModal(ui.settings, '<div class="setting-list">' + button('large', ui.large, 'setting-toggle', 'aria-pressed="' + save.large + '"') + button('still', ui.motion, 'setting-toggle', 'aria-pressed="' + save.still + '"') + button('instant', ui.instant, 'setting-toggle', 'aria-pressed="' + save.instant + '"') + button('music', ui.music + ' · ' + (save.music ? ui.audioEnabled : ui.audioDisabled), 'setting-toggle', 'aria-pressed="' + save.music + '"') + button('voices', ui.voices + ' · ' + (save.voices ? ui.audioEnabled : ui.audioDisabled), 'setting-toggle', 'aria-pressed="' + save.voices + '"') + '</div><p class="book-intro">' + esc(ui.audioHint) + '</p>' + button('audio-retry', ui.audioRetry, 'outline') + '<p class="book-intro">' + esc(ui.privacy) + '</p>');
  }
  function capture(id) {
    var e = c.endings[id];
    openModal(ui.keepsake, '<article class="letter-card"><span class="letter-sub">' + esc(c.subtitle) + '</span><h3>' + esc(e.title) + '</h3><div class="letter-text">' + esc(e.letter).replace(/\n/g, '<br>') + '</div><div class="letter-sign">' + esc(c.title) + '</div></article><p class="capture-hint">' + esc(ui.captureHint) + '</p>', 'capture-modal');
  }
  function act(event) {
    var target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    var action = target.getAttribute('data-action'), id = target.getAttribute('data-id');
    if (action !== 'auto') stopAuto();
    if (['prev-beat', 'skip-read', 'rewind', 'large', 'still', 'instant'].indexOf(action) >= 0) { suppressAudio = true; sound.cancelVoice(); }
    if (['start', 'continue', 'chapter-confirm', 'new-confirm', 'audio-retry'].indexOf(action) >= 0 || (view === 'story' && ['next-beat', 'next-epilogue', 'advance-dialogue', 'choose', 'close'].indexOf(action) >= 0)) { sound.configure(save.music, save.voices); sound.unlock(); }
    if (action === 'choose') {
      if (busy || !c.nodes[state.node]) return;
      var current = target.closest('[data-node]');
      if (!current || current.getAttribute('data-node') !== state.node) return;
      busy = true; save.beat = 0; save.frameId = ''; save.path.push(id); persist(); render();
      setTimeout(function () { busy = false; }, 180); return;
    }
    if (action === 'next-beat' || action === 'next-epilogue' || action === 'advance-dialogue') {
      advance();
      var next = app.querySelector('[data-action=next-beat], [data-action=next-epilogue], [data-action=choose]'); if (next) next.focus({ preventScroll: true });
    }
    else if (action === 'prev-beat') { save.beat = Math.max(0, (save.beat || 0) - 1); save.frameId = ''; persist(); render(); }
    else if (action === 'skip-read') {
      var list = beats(), at = save.beat || 0, start = at;
      while (at < list.length && save.read.indexOf(engine.readKey(state.node, list[at])) >= 0) at++;
      if (at === start) toast(ui.nothingRead);
      else { save.beat = at; save.frameId = ''; persist(); render(); }
    }
    else if (action === 'auto') { auto = !auto; clearTimeout(autoTimer); target.textContent = auto ? ui.autoStop : ui.auto; target.setAttribute('aria-pressed', String(auto)); if (auto) { finishTyping(); readingEffects(); } }
    else if (action === 'log') openLog();
    else if (action === 'gallery') openGallery();
    else if (action === 'clues') openClues();
    else if (action === 'chapters') openChapters();
    else if (action === 'select-chapter') { pendingChapter = id; openModal(ui.chapterSelect, '<p>' + esc(ui.chapterWarning) + '</p>' + button('chapter-confirm', ui.chapterConfirm, 'primary') + button('close', ui.cancel, 'text-button')); }
    else if (action === 'chapter-confirm') { save.chapter = pendingChapter; save.path = []; save.beat = 0; save.frameId = ''; persist(); closeModal(); view = 'story'; render(); }
    else if (action === 'start' || action === 'continue') { view = 'story'; persist(); render(); }
    else if (action === 'home') { sound.pause(); view = 'home'; render(); }
    else if (action === 'close') closeModal();
    else if (action === 'inspect') { var item = c.items.filter(function (i) { return i.id === id; })[0]; if (save.seen.indexOf(id) < 0) save.seen.push(id); persist(); render(); openModal(item.name, '<div class="inspect-icon ' + item.icon + '" aria-hidden="true"></div><p class="inspect-prose">' + esc(item.text) + '</p>'); }
    else if (action === 'book') openBook();
    else if (action === 'history') openHistory();
    else if (action === 'settings') openSettings();
    else if (action === 'audio-retry') { suppressAudio = true; updateSound(); }
    else if (action === 'music' || action === 'voices') { save[action] = !save[action]; persist(); sound.configure(save.music, save.voices); sound.unlock(); openSettings(); }
    else if (action === 'large' || action === 'still' || action === 'instant') { save[action] = !save[action]; persist(); render(); closeModal(); openSettings(); }
    else if (action === 'read-ending') openModal(ui.book, '<article class="book-ending">' + endingMarkup(id, true) + button('capture', ui.keepsake, 'outline', 'data-id="' + id + '"') + button('book', ui.book, 'text-button') + '</article>');
    else if (action === 'capture') capture(id);
    else if (action === 'rewind') { save.path = save.path.slice(0, Number(target.getAttribute('data-index'))); save.beat = 0; save.frameId = ''; persist(); closeModal(); view = 'story'; render(); }
    else if (action === 'restart') openModal(ui.newTitle, '<p class="book-intro">' + esc(ui.newBody) + '</p>' + button('new-confirm', ui.newConfirm, 'primary') + button('close', ui.cancel, 'text-button'));
    else if (action === 'new-confirm') { save.path = []; save.beat = 0; save.frameId = ''; persist(); closeModal(); view = 'story'; render(); }
    else if (action === 'about') openModal(ui.aboutTitle, '<h3>' + esc(ui.sourceLabel) + '</h3><p>' + esc(c.context) + '</p>' + c.sources.map(function (s) { return '<div class="source"><strong>' + esc(s.title) + '</strong><p>' + esc(s.summary) + '</p><small>' + esc(s.checked) + '</small></div>'; }).join('') + '<h3>' + esc(ui.audioCredits) + '</h3><p>' + esc(ui.audioCreditNote) + '</p>' + c.audioCandidates.map(function (a) { return '<div class="source"><strong>' + esc(a.title) + ' · ' + esc(a.author) + '</strong><p>' + esc(a.attribution || a.license) + '</p><small>' + esc(a.sourcePage) + '</small></div>'; }).join('') + '<h3>' + esc(ui.originalLabel) + '</h3><p>' + esc(ui.originalBody) + '</p><p>' + esc(ui.imageCredit) + '</p><p>' + esc(ui.privacy) + '</p>');
  }
  document.addEventListener('click', act);
  document.addEventListener('visibilitychange', function () { if (document.hidden) { finishTyping(); stopAuto(); sound.pause(); } else if (state) { suppressAudio = true; updateSound(); } });
  window.addEventListener('pagehide', function () { sound.pause(); });
  document.addEventListener('keydown', function (event) {
    var dialog = modalRoot.querySelector('.modal');
    if (!dialog) { if ((event.key === 'Enter' || event.key === ' ') && document.activeElement && document.activeElement.getAttribute('data-action') === 'advance-dialogue') { event.preventDefault(); stopAuto(); sound.unlock(); advance(); var el = app.querySelector('.dialogue'); if (el) el.focus({ preventScroll: true }); } return; }
    if (event.key === 'Escape') { event.preventDefault(); closeModal(); }
    if (event.key === 'Tab') {
      var items = dialog.querySelectorAll('button:not([disabled]), [tabindex="0"]'), first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  document.title = c.title;
  window.StoryStorage.create(key).then(function (adapter) {
    storage = adapter;
    return adapter.read();
  }).then(function (raw) {
    if (raw) save = engine.cleanSave(c, JSON.parse(raw));
  }).catch(function () { toast(ui.saveReset); }).then(function () {
    sync();
    if (save.frameId) { var restored = beats(); var found = restored.map(function (b) { return b.id; }).indexOf(save.frameId); if (found >= 0) save.beat = found; else if (save.frameId === 'choices') save.beat = restored.length; }
    render();
  });
}());
