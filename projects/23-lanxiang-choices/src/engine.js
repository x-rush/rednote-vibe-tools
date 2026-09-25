(function (root) {
  'use strict';
  function matches(flags, condition) {
    return Object.keys(condition || {}).every(function (key) { return flags[key] === condition[key]; });
  }
  function destination(choice, flags) {
    if (choice.to) return choice.to;
    var route = choice.routes.filter(function (r) { return matches(flags, r.when); })[0];
    if (!route) throw new Error('No matching route');
    return route.to;
  }
  function replay(content, choices, chapter) {
    var selected = (content.chapters || []).filter(function (item) { return item.id === chapter; })[0];
    if (chapter && !selected) throw new Error('Invalid chapter');
    var state = { node: selected ? selected.start : content.start, flags: {}, history: [], echo: '' };
    choices.forEach(function (id) {
      var node = content.nodes[state.node];
      if (!node) throw new Error('Choices after ending');
      var choice = node.choices.filter(function (item) { return item.id === id && matches(state.flags, item.when); })[0];
      if (!choice) throw new Error('Invalid choice');
      state.history.push({ node: state.node, choice: id });
      Object.keys(choice.set || {}).forEach(function (key) { state.flags[key] = choice.set[key]; });
      state.node = destination(choice, state.flags);
      state.echo = choice.echo || '';
      if (!content.nodes[state.node] && !content.endings[state.node]) throw new Error('Invalid destination');
    });
    return state;
  }
  function cleanSave(content, raw) {
    if (!raw || raw.version !== content.version || !Array.isArray(raw.path) || raw.path.length > 40) throw new Error('Invalid save');
    var chapter = raw.chapter || 'freedom';
    replay(content, raw.path, chapter);
    return {
      version: content.version, path: raw.path.slice(), chapter: chapter,
      beat: Number.isInteger(raw.beat) && raw.beat >= 0 && raw.beat < 100 ? raw.beat : 0,
      frameId: typeof raw.frameId === 'string' ? raw.frameId.slice(0, 120) : '',
      read: Array.isArray(raw.read) ? raw.read.filter(function (id) { return typeof id === 'string' && id.length < 180; }).slice(-3000) : [],
      artwork: Array.isArray(raw.artwork) ? raw.artwork.filter(function (id) { return (content.gallery || []).some(function (g) { return g.id === id; }); }) : [],
      unlocked: Array.isArray(raw.unlocked) ? raw.unlocked.filter(function (id, index, all) { return !!content.endings[id] && all.indexOf(id) === index; }) : [],
      seen: Array.isArray(raw.seen) ? raw.seen.filter(function (id, index, all) { return content.items.some(function (i) { return i.id === id; }) && all.indexOf(id) === index; }) : [],
      music: raw.music !== false, voices: raw.voices !== false,
      large: raw.large === true, still: raw.still === true, instant: raw.instant === true
    };
  }
  function stage(node, frames, index) {
    var result = { cast: (node.cast || []).slice(), emotions: {}, cg: null, background: node.background || 'courtyard', place: node.place || '', music: node.music || null };
    frames.slice(0, index + 1).forEach(function (frame) {
      if (frame.cast) result.cast = frame.cast.slice();
      if (frame.character && frame.expression) result.emotions[frame.character] = frame.expression;
      Object.keys(frame.reactions || {}).forEach(function (id) { result.emotions[id] = frame.reactions[id]; });
      if (Object.prototype.hasOwnProperty.call(frame, 'cg')) result.cg = frame.cg;
      if (frame.background) result.background = frame.background;
      if (frame.place) result.place = frame.place;
      if (Object.prototype.hasOwnProperty.call(frame, 'music')) result.music = frame.music;
    });
    return result;
  }
  function readKey(nodeId, frame) {
    var value = frame.text + JSON.stringify(frame.when || {}), hash = 0;
    for (var i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    return nodeId + ':' + frame.id + ':' + hash;
  }
  root.StoryEngine = { matches: matches, destination: destination, replay: replay, cleanSave: cleanSave, stage: stage, readKey: readKey };
}(typeof window !== 'undefined' ? window : this));
