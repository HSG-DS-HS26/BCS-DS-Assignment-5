/* jshint globalstrict: true */
/* jshint browser: true */
/* jshint devel: true */
/* jshint jquery: true */
/* global util */
/* global raft */
/* global makeState */
/* global ELECTION_TIMEOUT */
/* global NUM_SERVERS */
'use strict';

var playback;
var render = {};
var state;
var record;
var replay;

$(function() {

var ARC_WIDTH = 5;

var onReplayDone = undefined;
record = function(name) {
  localStorage.setItem(name, state.exportToString());
};
replay = function(name, done) {
  state.importFromString(localStorage.getItem(name));
  ensurePartitionState();
  dropPartitionedMessages(state.current);
  render.update();
  onReplayDone = done;
};

var defaultPartition = function() {
  return {
    active: false,
    sideA: [],
    sideB: [],
  };
};

var ensurePartitionState = function() {
  if (!state.current.partition) {
    state.current.partition = defaultPartition();
  } else {
    state.current.partition.sideA = state.current.partition.sideA || [];
    state.current.partition.sideB = state.current.partition.sideB || [];
    state.current.partition.active = !!state.current.partition.active;
  }
};

var isPartitioned = function(model, from, to) {
  if (!model.partition || !model.partition.active)
    return false;
  var inAFrom = model.partition.sideA.indexOf(from) !== -1;
  var inBFrom = model.partition.sideB.indexOf(from) !== -1;
  var inATo = model.partition.sideA.indexOf(to) !== -1;
  var inBTo = model.partition.sideB.indexOf(to) !== -1;
  return (inAFrom && inBTo) || (inBFrom && inATo);
};

var dropPartitionedMessages = function(model) {
  model.messages = model.messages.filter(function(message) {
    return !isPartitioned(model, message.from, message.to);
  });
};

var applyPartitionSelection = function(model, selection) {
  ensurePartitionState();
  model.partition.active = true;
  model.partition.sideA = selection.sideA.slice().sort(util.numericCompare);
  model.partition.sideB = selection.sideB.slice().sort(util.numericCompare);
  dropPartitionedMessages(model);
};

var reconnectAll = function(model) {
  ensurePartitionState();
  model.partition = defaultPartition();
};

state = makeState({
  servers: [],
  messages: [],
  partition: defaultPartition(),
});

var sliding = false;

var termColors = [
  '#66c2a5',
  '#fc8d62',
  '#8da0cb',
  '#e78ac3',
  '#a6d854',
  '#ffd92f',
];

var SVG = function(tag) {
   return $(document.createElementNS('http://www.w3.org/2000/svg', tag));
};

playback = function() {
  var paused = false;
  var pause = function() {
    paused = true;
    $('#time-icon')
      .removeClass('glyphicon-time')
      .addClass('glyphicon-pause');
    $('#pause').attr('class', 'paused');
    render.update();
  };
  var resume = function() {
    if (paused) {
      paused = false;
      $('#time-icon')
        .removeClass('glyphicon-pause')
        .addClass('glyphicon-time');
      $('#pause').attr('class', 'resumed');
      render.update();
    }
  };
  return {
    pause: pause,
    resume: resume,
    toggle: function() {
      if (paused)
        resume();
      else
        pause();
    },
    isPaused: function() {
      return paused;
    },
  };
}();

(function() {
  for (var i = 1; i <= NUM_SERVERS; i += 1) {
      var peers = [];
      for (var j = 1; j <= NUM_SERVERS; j += 1) {
        if (i != j)
          peers.push(j);
      }
      state.current.servers.push(raft.server(i, peers));
  }
})();

var svg = $('svg.rs-svg');

var ringSpec = {
  cx: 210,
  cy: 210,
  r: 150,
};
$('#pause').attr('transform',
  'translate(' + ringSpec.cx + ', ' + ringSpec.cy + ') ' +
  'scale(' + ringSpec.r / 3.5 + ')');

var logsSpec = {
  x: 430,
  y: 50,
  width: 320,
  height: 270,
};


var serverSpec = function(id) {
  var coord = util.circleCoord((id - 1) / NUM_SERVERS,
                               ringSpec.cx, ringSpec.cy, ringSpec.r);
  return {
    cx: coord.x,
    cy: coord.y,
    r: 30,
  };
};

$('#ring', svg).attr(ringSpec);

var serverModal;
var messageModal;
var partitionSelection;

state.current.servers.forEach(function (server) {
  var s = serverSpec(server.id);
  $('#servers', svg).append(
    SVG('g')
      .attr('id', 'server-' + server.id)
      .attr('class', 'server')
      .append(SVG('text')
                 .attr('class', 'serverid')
                 .text('S' + server.id)
                 .attr(util.circleCoord((server.id - 1) / NUM_SERVERS,
                                        ringSpec.cx, ringSpec.cy, ringSpec.r + 50)))
      .append(SVG('a')
        .append(SVG('circle')
                   .attr('class', 'background')
                   .attr(s))
        .append(SVG('g')
                    .attr('class', 'votes'))
        .append(SVG('path')
                   .attr('style', 'stroke-width: ' + ARC_WIDTH))
        .append(SVG('text')
                   .attr('class', 'term')
                   .attr({x: s.cx, y: s.cy}))
        ));
});

var MESSAGE_RADIUS = 8;

var messageSpec = function(from, to, frac) {
  var fromSpec = serverSpec(from);
  var toSpec = serverSpec(to);
  // adjust frac so you start and end at the edge of servers
  var totalDist  = Math.sqrt(Math.pow(toSpec.cx - fromSpec.cx, 2) +
                             Math.pow(toSpec.cy - fromSpec.cy, 2));
  var travel = totalDist - fromSpec.r - toSpec.r;
  frac = (fromSpec.r / totalDist) + frac * (travel / totalDist);
  return {
    cx: fromSpec.cx + (toSpec.cx - fromSpec.cx) * frac,
    cy: fromSpec.cy + (toSpec.cy - fromSpec.cy) * frac,
    r: MESSAGE_RADIUS,
  };
};

var messageArrowSpec = function(from, to, frac) {
  var fromSpec = serverSpec(from);
  var toSpec = serverSpec(to);
  // adjust frac so you start and end at the edge of servers
  var totalDist  = Math.sqrt(Math.pow(toSpec.cx - fromSpec.cx, 2) +
                             Math.pow(toSpec.cy - fromSpec.cy, 2));
  var travel = totalDist - fromSpec.r - toSpec.r;
  var fracS = ((fromSpec.r + MESSAGE_RADIUS)/ totalDist) +
               frac * (travel / totalDist);
  var fracH = ((fromSpec.r + 2*MESSAGE_RADIUS)/ totalDist) +
               frac * (travel / totalDist);
  return [
    'M', fromSpec.cx + (toSpec.cx - fromSpec.cx) * fracS, comma,
         fromSpec.cy + (toSpec.cy - fromSpec.cy) * fracS,
    'L', fromSpec.cx + (toSpec.cx - fromSpec.cx) * fracH, comma,
         fromSpec.cy + (toSpec.cy - fromSpec.cy) * fracH,
  ].join(' ');
};

var comma = ',';
var arcSpec = function(spec, fraction) {
  var radius = spec.r + ARC_WIDTH/2;
  var end = util.circleCoord(fraction, spec.cx, spec.cy, radius);
  var s = ['M', spec.cx, comma, spec.cy - radius];
  if (fraction > 0.5) {
    s.push('A', radius, comma, radius, '0 0,1', spec.cx, spec.cy + radius);
    s.push('M', spec.cx, comma, spec.cy + radius);
  }
  s.push('A', radius, comma, radius, '0 0,1', end.x, end.y);
  return s.join(' ');
};

var timeSlider;

render.clock = function() {
  if (!sliding) {
    timeSlider.slider('setAttribute', 'max', state.getMaxTime());
    timeSlider.slider('setValue', state.current.time, false);
  }
};

var serverActions = [
  ['stop', raft.stop],
  ['resume', raft.resume],
  ['restart', raft.restart],
  ['time out', raft.timeout],
  ['request', function(model, server) {
    var value = requestValue();
    if (value !== null)
      raft.clientRequest(model, server, value);
  }],
];

// The value typed in the Client value field of the simulation panel, '' if none,
// null if it is 'noop', which marks no-op entries.
var requestValue = function() {
  var value = $('#request-value').val().trim();
  if (value == 'noop') {
    alert('"noop" marks no-op entries; choose another value.');
    return null;
  }
  return value;
};

var messageActions = [
  ['drop', raft.drop],
];

render.servers = function(serversSame) {
  state.current.servers.forEach(function(server) {
    var serverNode = $('#server-' + server.id, svg);
    $('path', serverNode)
      .attr('d', arcSpec(serverSpec(server.id),
         util.clamp((server.electionAlarm - state.current.time) /
                    (ELECTION_TIMEOUT * 2),
                    0, 1)));
    var classes = ['server', server.state];
    if (state.current.partition && state.current.partition.active) {
      if (state.current.partition.sideA.indexOf(server.id) !== -1)
        classes.push('partition-a');
      else if (state.current.partition.sideB.indexOf(server.id) !== -1)
        classes.push('partition-b');
    }
    serverNode.attr('class', classes.join(' '));
    if (!serversSame) {
      $('text.term', serverNode).text(server.term);
      $('circle.background', serverNode)
        .attr('style', 'fill: ' +
              (server.state == 'stopped' ? '#c4c9cf'
                : termColors[server.term % termColors.length]));
      var votesGroup = $('.votes', serverNode);
      votesGroup.empty();
      if (server.state == 'candidate') {
        state.current.servers.forEach(function (peer) {
          var coord = util.circleCoord((peer.id - 1) / NUM_SERVERS,
                                       serverSpec(server.id).cx,
                                       serverSpec(server.id).cy,
                                       serverSpec(server.id).r * 5/8);
          var state;
          if (peer == server || server.voteGranted[peer.id]) {
            state = 'have';
          } else if (peer.votedFor == server.id && peer.term == server.term) {
            state = 'coming';
          } else {
            state = 'no';
          }
          var granted = (peer == server ? true : server.voteGranted[peer.id]);
          votesGroup.append(
            SVG('circle')
              .attr({
                cx: coord.x,
                cy: coord.y,
                r: 5,
              })
              .attr('class', state));
        });
      }
      serverNode
        .unbind('click')
        .click(function() {
          serverModal(state.current, server);
          return false;
        });
      if (serverNode.data('context'))
        serverNode.data('context').destroy();
      serverNode.contextmenu({
        target: '#context-menu',
        before: function(e) {
          var closemenu = this.closemenu.bind(this);
          var list = $('ul', this.getMenu());
          list.empty();
          serverActions.forEach(function(action) {
            list.append($('<li></li>')
              .append($('<a href="#"></a>')
                .text(action[0])
                .click(function() {
                  state.fork();
                  action[1](state.current, server);
                  state.save();
                  render.update();
                  closemenu();
                  return false;
                })));
          });
          return true;
        },
      });
    }
  });
};

var isNoop = function(entry) {
  return entry.value == 'noop';
};

render.entry = function(spec, entry, committed, fontSize) {
  var g = SVG('g')
    .attr('class', 'entry ' + (committed ? 'committed' : 'uncommitted') +
                   (isNoop(entry) ? ' noop' : ''))
    .append(SVG('rect')
      .attr(spec)
      .attr('stroke-dasharray', committed ? '1 0' : '5 5')
      .attr('style', 'fill: ' + termColors[entry.term % termColors.length]));
  if (isNoop(entry)) {
    g.append(SVG('rect').attr(spec).attr('class', 'noop-hatch'))
      .append(SVG('title').text('no-op entry, term ' + entry.term));
  } else if (entry.value == 'v') {
    g.append(SVG('text')
      .attr({x: spec.x + spec.width / 2,
             y: spec.y + spec.height / 2})
      .attr('style', 'font-size: ' + fontSize + 'px')
      .text(entry.term));
  } else {
    // A typed value fills the box, shrunk only as far as its length needs;
    // the term moves to the top left corner.
    var valueSize = Math.min(fontSize,
                             1.7 * (spec.width - 4) / String(entry.value).length);
    g.append(SVG('text')
      .attr({x: spec.x + 3,
             y: spec.y + spec.height * 0.2})
      .attr('style', 'text-anchor: start; font-weight: 700; font-size: ' +
                     (fontSize * 0.6) + 'px')
      .text(entry.term));
    g.append(SVG('text')
      .attr({x: spec.x + spec.width / 2,
             y: spec.y + spec.height * 0.62})
      .attr('style', 'font-weight: 700; font-size: ' + valueSize + 'px')
      .text(entry.value));
    g.append(SVG('title').text('term ' + entry.term + ', value ' + entry.value));
  }
  return g;
};

render.logs = function() {
  var LABEL_WIDTH = 25;
  var INDEX_HEIGHT = 25;
  var logsGroup = $('.logs', svg);
  logsGroup.empty();
  logsGroup.append(
    SVG('rect')
      .attr('id', 'logsbg')
      .attr(logsSpec));
  var height = (logsSpec.height - INDEX_HEIGHT) / NUM_SERVERS;
  var leader = getLeader();
  var indexSpec = {
    x: logsSpec.x + LABEL_WIDTH + logsSpec.width * 0.05,
    y: logsSpec.y + 2*height/6,
    width: logsSpec.width * 0.9,
    height: 2*height/3,
  };
  // A column per log index. Columns holding only no-ops (or nothing) on every
  // server are narrow. The columns grow in number and shrink in width once a
  // log is longer than 10 entries. A spare full-width column at the end
  // leaves room for a next index arrow past the last entry.
  var NARROW = 1 / 3;
  var slots = 10;
  state.current.servers.forEach(function(server) {
    slots = Math.max(slots, server.log.length);
  });
  var colUnits = [];
  var units = 1;
  for (var index = 1; index <= slots; ++index) {
    var narrow = false;
    var allNoop = state.current.servers.every(function(server) {
      var entry = server.log[index - 1];
      narrow = narrow || (entry !== undefined && isNoop(entry));
      return entry === undefined || isNoop(entry);
    });
    colUnits[index] = (narrow && allNoop) ? NARROW : 1;
    units += colUnits[index];
  }
  colUnits[slots + 1] = 1;
  var unitWidth = indexSpec.width / units;
  var colLeft = [0, 0];
  for (index = 1; index <= slots + 1; ++index)
    colLeft[index + 1] = colLeft[index] + colUnits[index] * unitWidth;
  var fontScale = Math.min(1, unitWidth / (indexSpec.width / 11));
  var indexes = SVG('g')
    .attr('id', 'log-indexes');
  logsGroup.append(indexes);
  for (index = 1; index <= slots; ++index) {
    indexes
        .append(SVG('text')
          .attr({x: indexSpec.x + colLeft[index] + colUnits[index] * unitWidth / 2,
                 y: indexSpec.y})
          .attr('style', 'font-size: ' +
                (15 * fontScale * (colUnits[index] < 1 ? 0.6 : 1)) + 'px')
          .text(index));
  }
  state.current.servers.forEach(function(server) {
    var logSpec = {
      x: logsSpec.x + LABEL_WIDTH + logsSpec.width * 0.05,
      y: logsSpec.y + INDEX_HEIGHT + height * server.id - 5*height/6,
      width: logsSpec.width * 0.9,
      height: 2*height/3,
    };
    var logEntrySpec = function(index) {
      return {
        x: logSpec.x + colLeft[index],
        y: logSpec.y,
        width: colUnits[index] * unitWidth,
        height: logSpec.height,
      };
    };
    var log = SVG('g')
      .attr('id', 'log-S' + server.id);
    logsGroup.append(log);
    log.append(
        SVG('text')
          .text('S' + server.id)
          .attr('class', 'serverid ' + server.state)
          .attr({x: logSpec.x - LABEL_WIDTH*4/5,
                 y: logSpec.y + logSpec.height / 2}));
    for (var index = 1; index <= slots; ++index) {
      log.append(SVG('rect')
          .attr(logEntrySpec(index))
          .attr('class', 'log'));
    }
    server.log.forEach(function(entry, i) {
      var index = i + 1;
        log.append(render.entry(
             logEntrySpec(index),
             entry,
             index <= server.commitIndex,
             17 * fontScale));
    });
    if (leader !== null && leader != server) {
      log.append(
        SVG('circle')
          .attr('title', 'match index')//.tooltip({container: 'body'})
          .attr({cx: logEntrySpec(leader.matchIndex[server.id] + 1).x,
                 cy: logSpec.y + logSpec.height,
                 r: 5}));
      var next = logEntrySpec(leader.nextIndex[server.id]);
      var x = next.x + next.width / 2;
      log.append(SVG('path')
        .attr('title', 'next index')//.tooltip({container: 'body'})
        .attr('style', 'marker-end:url(#TriangleOutM); stroke: black')
        .attr('d', ['M', x, comma, logSpec.y + logSpec.height + logSpec.height/3,
                    'L', x, comma, logSpec.y + logSpec.height + logSpec.height/6].join(' '))
        .attr('stroke-width', 3));
    }
  });
};

render.messages = function(messagesSame) {
  var messagesGroup = $('#messages', svg);
  if (!messagesSame) {
    messagesGroup.empty();
    state.current.messages.forEach(function(message, i) {
      var a = SVG('a')
          .attr('id', 'message-' + i)
          .attr('class', 'message ' + message.direction + ' ' + message.type)
          .attr('title', message.type + ' ' + message.direction)//.tooltip({container: 'body'})
          .append(SVG('circle'))
          .append(SVG('path').attr('class', 'message-direction'));
      if (message.direction == 'reply')
        a.append(SVG('path').attr('class', 'message-success'));
      messagesGroup.append(a);
    });
    state.current.messages.forEach(function(message, i) {
      var messageNode = $('a#message-' + i, svg);
      messageNode
        .click(function() {
          messageModal(state.current, message);
          return false;
        });
      if (messageNode.data('context'))
        messageNode.data('context').destroy();
      messageNode.contextmenu({
        target: '#context-menu',
        before: function(e) {
          var closemenu = this.closemenu.bind(this);
          var list = $('ul', this.getMenu());
          list.empty();
          messageActions.forEach(function(action) {
            list.append($('<li></li>')
              .append($('<a href="#"></a>')
                .text(action[0])
                .click(function() {
                  state.fork();
                  action[1](state.current, message);
                  state.save();
                  render.update();
                  closemenu();
                  return true;
                })));
          });
          return true;
        },
      });
    });
  }
  state.current.messages.forEach(function(message, i) {
    var s = messageSpec(message.from, message.to,
                        (state.current.time - message.sendTime) /
                        (message.recvTime - message.sendTime));
    $('#message-' + i + ' circle', messagesGroup)
      .attr(s);
    if (message.direction == 'reply') {
      var dlist = [];
      dlist.push('M', s.cx - s.r, comma, s.cy,
                 'L', s.cx + s.r, comma, s.cy);
      if ((message.type == 'RequestVote' && message.granted) ||
          (message.type == 'AppendEntries' && message.success)) {
         dlist.push('M', s.cx, comma, s.cy - s.r,
                    'L', s.cx, comma, s.cy + s.r);
      }
      $('#message-' + i + ' path.message-success', messagesGroup)
        .attr('d', dlist.join(' '));
    }
    var dir = $('#message-' + i + ' path.message-direction', messagesGroup);
    if (playback.isPaused()) {
      dir.attr('style', 'marker-end:url(#TriangleOutS-' + message.type + ')')
         .attr('d',
           messageArrowSpec(message.from, message.to,
                            (state.current.time - message.sendTime) /
                            (message.recvTime - message.sendTime)));
    } else {
      dir.attr('style', '').attr('d', 'M 0,0'); // clear
    }
  });
};

// Tints the slice of the ring around each server in its side's colour and
// draws a dashed cut wherever two neighbouring servers are on different sides.
var lastPartitionRing = null;
render.partitionRing = function() {
  var p = state.current.partition;
  var key = JSON.stringify(p);
  if (key === lastPartitionRing)
    return;
  lastPartitionRing = key;
  var group = $('#partition-ring', svg).empty();
  if (!p.active)
    return;
  var side = function(id) {
    return p.sideA.indexOf(id) !== -1 ? 'a' :
           p.sideB.indexOf(id) !== -1 ? 'b' : null;
  };
  var at = function(frac) {
    var c = util.circleCoord(frac, ringSpec.cx, ringSpec.cy, ringSpec.r);
    return c.x + ',' + c.y;
  };
  for (var id = 1; id <= NUM_SERVERS; id += 1) {
    var start = (id - 1.5) / NUM_SERVERS;
    var end = (id - 0.5) / NUM_SERVERS;
    if (side(id)) {
      group.append(SVG('path')
        .attr('class', 'partition-slice side-' + side(id))
        .attr('d', 'M ' + ringSpec.cx + ',' + ringSpec.cy +
                   ' L ' + at(start) +
                   ' A ' + ringSpec.r + ',' + ringSpec.r + ' 0 0,1 ' + at(end) +
                   ' Z'));
    }
    var next = id % NUM_SERVERS + 1;
    if (side(id) && side(next) && side(id) !== side(next)) {
      group.append(SVG('path')
        .attr('class', 'partition-cut')
        .attr('d', 'M ' + ringSpec.cx + ',' + ringSpec.cy + ' L ' + at(end)));
    }
  }
};

render.partitionStatus = function() {
  ensurePartitionState();
  render.partitionRing();
  var status = $('#partition-status');
  if (state.current.partition.active) {
    var a = state.current.partition.sideA.map(function(id) { return 'S' + id; }).join(', ');
    var b = state.current.partition.sideB.map(function(id) { return 'S' + id; }).join(', ');
    status.text('Partition: [' + a + '] | [' + b + ']');
    $('#partition-clear').prop('disabled', false);
  } else {
    status.text('Network connected');
    $('#partition-clear').prop('disabled', true);
  }
};

var relTime = function(time, now) {
  if (time == util.Inf)
    return 'infinity';
  var sign = time > now ? '+' : '';
  return sign + ((time - now) / 1e3).toFixed(3) + 'ms';
};

var button = function(label) {
  return $('<button type="button" class="btn btn-default"></button>')
    .text(label);
};

serverModal = function(model, server) {
  var m = $('#modal-details');
  $('.modal-title', m).text('Server ' + server.id);
  $('.modal-dialog', m).removeClass('modal-sm').addClass('modal-lg');
  var li = function(label, value) {
    return '<dt>' + label + '</dt><dd>' + value + '</dd>';
  };
  var peerTable = $('<table></table>')
    .addClass('table table-condensed')
    .append($('<tr></tr>')
      .append('<th>peer</th>')
      .append('<th>next index</th>')
      .append('<th>match index</th>')
      .append('<th>vote granted</th>')
      .append('<th>RPC due</th>')
      .append('<th>heartbeat due</th>')
    );
  server.peers.forEach(function(peer) {
    peerTable.append($('<tr></tr>')
      .append('<td>S' + peer + '</td>')
      .append('<td>' + server.nextIndex[peer] + '</td>')
      .append('<td>' + server.matchIndex[peer] + '</td>')
      .append('<td>' + server.voteGranted[peer] + '</td>')
      .append('<td>' + relTime(server.rpcDue[peer], model.time) + '</td>')
      .append('<td>' + relTime(server.heartbeatDue[peer], model.time) + '</td>')
    );
  });
  $('.modal-body', m)
    .empty()
    .append($('<dl class="dl-horizontal"></dl>')
      .append(li('state', server.state))
      .append(li('currentTerm', server.term))
      .append(li('votedFor', server.votedFor))
      .append(li('commitIndex', server.commitIndex))
      .append(li('electionAlarm', relTime(server.electionAlarm, model.time)))
      .append($('<dt>peers</dt>'))
      .append($('<dd></dd>').append(peerTable))
    );
  var footer = $('.modal-footer', m);
  footer.empty();
  serverActions.forEach(function(action) {
    footer.append(button(action[0])
      .click(function(){
        state.fork();
        action[1](model, server);
        state.save();
        render.update();
        m.modal('hide');
      }));
  });
  m.modal();
};

messageModal = function(model, message) {
  var m = $('#modal-details');
  $('.modal-dialog', m).removeClass('modal-lg').addClass('modal-sm');
  $('.modal-title', m).text(message.type + ' ' + message.direction);
  var li = function(label, value) {
    return '<dt>' + label + '</dt><dd>' + value + '</dd>';
  };
  var fields = $('<dl class="dl-horizontal"></dl>')
      .append(li('from', 'S' + message.from))
      .append(li('to', 'S' + message.to))
      .append(li('sent', relTime(message.sendTime, model.time)))
      .append(li('deliver', relTime(message.recvTime, model.time)))
      .append(li('term', message.term));
  if (message.type == 'RequestVote') {
    if (message.direction == 'request') {
      fields.append(li('lastLogIndex', message.lastLogIndex));
      fields.append(li('lastLogTerm', message.lastLogTerm));
    } else {
      fields.append(li('granted', message.granted));
    }
  } else if (message.type == 'AppendEntries') {
    if (message.direction == 'request') {
      var entries = '[' + message.entries.map(function(e) {
            return isNoop(e) ? 'no-op(' + e.term + ')' :
                e.value == 'v' ? e.term :
                // Values come from challenge files too, so escape them.
                $('<span>').text(e.value).html() + '(' + e.term + ')';
      }).join(' ') + ']';
      fields.append(li('prevIndex', message.prevIndex));
      fields.append(li('prevTerm', message.prevTerm));
      fields.append(li('entries', entries));
      fields.append(li('commitIndex', message.commitIndex));
    } else {
      fields.append(li('success', message.success));
      fields.append(li('matchIndex', message.matchIndex));
    }
  }
  $('.modal-body', m)
    .empty()
    .append(fields);
  var footer = $('.modal-footer', m);
  footer.empty();
  messageActions.forEach(function(action) {
    footer.append(button(action[0])
      .click(function(){
        state.fork();
        action[1](model, message);
        state.save();
        render.update();
        m.modal('hide');
      }));
  });
  m.modal();
};

var defaultPartitionSelection = function() {
  var a = [];
  var b = [];
  for (var i = 1; i <= NUM_SERVERS; i += 1) {
    if (i <= Math.ceil(NUM_SERVERS / 2))
      a.push(i);
    else
      b.push(i);
  }
  return {sideA: a, sideB: b};
};

var resetPartitionSelection = function() {
  partitionSelection = defaultPartitionSelection();
  if (state.current.partition && state.current.partition.active) {
    partitionSelection = {
      sideA: state.current.partition.sideA.slice(),
      sideB: state.current.partition.sideB.slice(),
    };
  }
  partitionSelection.sideA.sort(util.numericCompare);
  partitionSelection.sideB.sort(util.numericCompare);
};

var renderPartitionModal = function() {
  var listA = $('#partition-sideA');
  var listB = $('#partition-sideB');
  listA.empty();
  listB.empty();
  var makeItem = function(side, serverId) {
    var other = side === 'A' ? 'B' : 'A';
    return $('<a href="#" class="list-group-item partition-node"></a>')
      .attr('data-server', serverId)
      .attr('data-side', side)
      .text('S' + serverId)
      .append($('<span class="text-muted pull-right partition-move"></span>')
        .text('to side ' + other));
  };
  partitionSelection.sideA.forEach(function(id) {
    listA.append(makeItem('A', id));
  });
  partitionSelection.sideB.forEach(function(id) {
    listB.append(makeItem('B', id));
  });
  var valid = partitionSelection.sideA.length > 0 &&
              partitionSelection.sideB.length > 0;
  var preview = valid ?
    ('Side A: [' + partitionSelection.sideA.map(function(id) { return 'S' + id; }).join(', ') +
     '] | Side B: [' + partitionSelection.sideB.map(function(id) { return 'S' + id; }).join(', ') + ']') :
    'Pick at least one server for each side.';
  $('#partition-preview').text(preview);
  $('#partition-apply')
    .prop('disabled', !valid)
    .text(state.current.partition && state.current.partition.active ?
          'Update partition' : 'Create partition');
};

var movePartitionServer = function(serverId, currentSide) {
  var from = currentSide === 'A' ? partitionSelection.sideA : partitionSelection.sideB;
  var to = currentSide === 'A' ? partitionSelection.sideB : partitionSelection.sideA;
  var i = from.indexOf(serverId);
  if (i !== -1) {
    from.splice(i, 1);
    to.push(serverId);
  }
  partitionSelection.sideA.sort(util.numericCompare);
  partitionSelection.sideB.sort(util.numericCompare);
  renderPartitionModal();
};

// Transforms the simulation speed from a linear slider
// to a logarithmically scaling time factor.
var speedSliderTransform = function(v) {
  v = Math.pow(10, v);
  if (v < 1)
    return 1;
  else
    return v;
};

var lastRenderedO = null;
var lastRenderedV = null;
render.update = function() {
  ensurePartitionState();
  // Same indicates both underlying object identity hasn't changed and its
  // value hasn't changed.
  var serversSame = false;
  var messagesSame = false;
  if (lastRenderedO == state.current) {
    serversSame = util.equals(lastRenderedV.servers, state.current.servers);
    messagesSame = util.equals(lastRenderedV.messages, state.current.messages);
  }
  lastRenderedO = state;
  lastRenderedV = state.base();
  render.clock();
  render.servers(serversSame);
  render.messages(messagesSame);
  render.partitionStatus();
  $('#request-send').prop('disabled', getLeader() === null);
  if (!serversSame)
    render.logs();
  // An imported exercise asks its question when the replayed story reaches
  // the stage the author posed it on.
  if (exerciseWatching && state.current.time >= exerciseArriveTime)
    exerciseArrive();
};

(function() {
  var last = null;
  var step = function(timestamp) {
    if (!playback.isPaused() && last !== null && timestamp - last < 500) {
      var wallMicrosElapsed = (timestamp - last) * 1000;
      var speed = speedSliderTransform($('#speed').slider('getValue'));
      var modelMicrosElapsed = wallMicrosElapsed / speed;
      var modelMicros = state.current.time + modelMicrosElapsed;
      // While replaying a staged exercise, stop exactly at the stage time
      // instead of letting one animation frame run into live simulation.
      if (exerciseWatching && modelMicros > exerciseArriveTime)
        modelMicros = exerciseArriveTime;
      state.seek(modelMicros);
      if (modelMicros >= state.getMaxTime() && onReplayDone !== undefined) {
        var f = onReplayDone;
        onReplayDone = undefined;
        f();
      }
      render.update();
    }
    last = timestamp;
    window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
})();

// Sends the Client value as a request to the current leader (Send button,
// Enter in the field, or the c key).
var sendClientRequest = function() {
  var leader = getLeader();
  var value = requestValue();
  if (value === null)
    return;
  if (leader === null) {
    alert('There is no leader right now, so no server accepts the request.');
    return;
  }
  state.fork();
  raft.clientRequest(state.current, leader, value);
  state.save();
  render.update();
  $('.modal').modal('hide');
};

$('#request-send').click(function() {
  sendClientRequest();
  return false;
});

$('#request-value').keyup(function(e) {
  if (e.keyCode == 13)
    sendClientRequest();
});

// A clicked button gives up the focus, so Space, the pause key, cannot click it again.
document.addEventListener('click', function(e) {
  var button = e.target.closest && e.target.closest('button');
  if (button)
    button.blur();
}, true);

// Space pauses and resumes (keyup below); outside a text field it must not scroll the page.
$(window).keydown(function(e) {
  if (e.keyCode == ' '.charCodeAt(0) &&
      e.target.tagName != 'INPUT' && e.target.tagName != 'TEXTAREA')
    e.preventDefault();
});

$(window).keyup(function(e) {
  if (e.target.id == "title" ||
      e.target.tagName == 'INPUT' ||
      e.target.tagName == 'TEXTAREA')
    return;
  var leader = getLeader();
  if (e.keyCode == ' '.charCodeAt(0) ||
      e.keyCode == 190 /* dot, emitted by Logitech remote */) {
    $('.modal').modal('hide');
    playback.toggle();
  } else if (e.keyCode == 'C'.charCodeAt(0)) {
    sendClientRequest();
  } else if (e.keyCode == 'R'.charCodeAt(0)) {
    if (leader !== null) {
      state.fork();
      raft.stop(state.current, leader);
      raft.resume(state.current, leader);
      state.save();
      render.update();
      $('.modal').modal('hide');
    }
  } else if (e.keyCode == 'T'.charCodeAt(0)) {
    state.fork();
    raft.spreadTimers(state.current);
    state.save();
    render.update();
    $('.modal').modal('hide');
  } else if (e.keyCode == 'A'.charCodeAt(0)) {
    state.fork();
    raft.alignTimers(state.current);
    state.save();
    render.update();
    $('.modal').modal('hide');
  } else if (e.keyCode == 'L'.charCodeAt(0)) {
    state.fork();
    playback.pause();
    raft.setupLogReplicationScenario(state.current);
    state.save();
    render.update();
    $('.modal').modal('hide');
  } else if (e.keyCode == 'B'.charCodeAt(0)) {
    state.fork();
    raft.resumeAll(state.current);
    state.save();
    render.update();
    $('.modal').modal('hide');
  } else if (e.keyCode == 'F'.charCodeAt(0)) {
    state.fork();
    render.update();
    $('.modal').modal('hide');
  } else if (e.keyCode == 191 && e.shiftKey) { /* question mark */
    playback.pause();
    $('#modal-help').modal('show');
  }
});

$('#modal-details').on('show.bs.modal', function(e) {
  playback.pause();
});

$('#modal-partition').on('show.bs.modal', function() {
  playback.pause();
});

$('#modal-partition').on('click', '.partition-node', function(e) {
  e.preventDefault();
  movePartitionServer(parseInt($(this).data('server'), 10), $(this).data('side'));
});

$('#partition-open').click(function() {
  resetPartitionSelection();
  renderPartitionModal();
  playback.pause();
  $('#modal-partition').modal('show');
  return false;
});

$('#partition-apply').click(function() {
  if (!partitionSelection)
    resetPartitionSelection();
  if (partitionSelection.sideA.length === 0 ||
      partitionSelection.sideB.length === 0)
    return false;
  state.fork();
  applyPartitionSelection(state.current, partitionSelection);
  state.save();
  render.update();
  $('#modal-partition').modal('hide');
  return false;
});

$('#partition-clear').click(function() {
  if ($('#partition-clear').prop('disabled'))
    return false;
  state.fork();
  reconnectAll(state.current);
  state.save();
  render.update();
  $('.modal').modal('hide');
  return false;
});

// ---------------------------------------------------------------- exercises

// An exercise is a quiz on a paused Raft scenario. The author pauses the
// simulation at a stage, writes a question with four answers and marks the
// correct one, then continues the run until the solution is visible and
// saves the exercise as a JSON file. The file contains two recorded
// timelines: `stage` is the timeline up to the paused frame the question
// was written on, and `solution` additionally contains the run up to the
// reveal. On import, the recorded `stage` story replays from the beginning:
// the recorded timeline makes the run reproducible, randomness included.
// Playback stops exactly at the stage, the question is asked, and the
// solver picks an answer and watches the recorded `solution` run. Past the
// stage the recording is discarded, so scrubbing cannot spoil the solution.
//
// exerciseAuthoring: question data while an exercise is being created.
// exerciseSolution: loaded exercise, staged at the question until revealed.
// exerciseChoice:   index of the answer the solver picked.
// exerciseNotice:   one-off status message (e.g. where the file was saved).
// exerciseWatching: the recorded story is replaying from the beginning; the
//                   question is asked once playback reaches exerciseArriveTime.
// exerciseArriveTime: the stage time, clamped to what the recording holds.

var exerciseAuthoring = null;
var exerciseSolution = null;
var exerciseChoice = null;
var exerciseNotice = '';
var exerciseWatching = false;
var exerciseArriveTime = 0;

var exerciseIsValid = function(exercise) {
  var isStateString = function(s) {
    if (typeof s != 'string')
      return false;
    var o;
    try {
      o = JSON.parse(s);
    } catch (e) {
      return false;
    }
    return o && jQuery.isArray(o.checkpoints) && o.checkpoints.length > 0 &&
        typeof o.maxTime == 'number';
  };
  return exercise &&
      exercise.format == 1 &&
      typeof exercise.question == 'string' &&
      exercise.question.trim() != '' &&
      jQuery.isArray(exercise.answers) &&
      exercise.answers.length == 4 &&
      exercise.answers.every(function(a) {
        return typeof a == 'string' && a.trim() != '';
      }) &&
      exercise.correct >= 0 && exercise.correct < 4 &&
      exercise.correct == Math.floor(exercise.correct) &&
      typeof exercise.stageTime == 'number' &&
      exercise.stageTime >= 0 &&
      isStateString(exercise.stage) &&
      isStateString(exercise.solution);
};

var exerciseTime = function(t) {
  return (t / 1e6).toFixed(3) + 's';
};

var updateExerciseControls = function() {
  var authoring = exerciseAuthoring !== null;
  var staged = exerciseSolution !== null;
  var watching = staged && exerciseWatching;
  var answering = staged && !exerciseWatching;
  var locked = authoring && exerciseAuthoring.question !== null;
  $('#exercise-create')
    .text(authoring ? 'Export challenge' : 'Create exercise')
    .prop('disabled', staged);
  $('#exercise-cancel').toggleClass('hidden', !authoring);
  $('#exercise-load').prop('disabled', authoring || staged);
  $('#exercise-clear-exercise').toggleClass('hidden', !staged);
  $('#exercise-set').prop('disabled', locked);
  $('#exercise-name')
    .add('#exercise-create-question')
    .add('#exercise-answer-0, #exercise-answer-1, #exercise-answer-2, #exercise-answer-3')
    .add('input[name=exercise-correct]')
    .prop('disabled', locked || staged);
  $('#exercise-create-panel').toggle(!staged);
  $('#exercise-solve-panel').toggle(answering);
  if (answering)
    renderSolvePanel();
  var status = $('#exercise-status');
  if (authoring && !locked) {
    status.text('Stage set at t=' + exerciseTime(exerciseAuthoring.stageTime) +
                '. Fill in the exercise form, then press Set question and continue the run.');
  } else if (authoring) {
    status.text('Question set. Run the simulation until the solution is ' +
                'visible, then press Export challenge.');
  } else if (watching) {
    status.text('Replaying the recorded story - the question follows at t=' +
                exerciseTime(exerciseArriveTime) + '.');
  } else if (answering) {
    status.text('Question posed at t=' + exerciseTime(exerciseSolution.stageTime) +
                '. Pick an answer, then show the solution.');
  } else {
    status.text(exerciseNotice);
  }
};

var resetExerciseCreateForm = function() {
  $('#exercise-name').val('');
  $('#exercise-create-question').val('');
  for (var i = 0; i < 4; i += 1)
    $('#exercise-answer-' + i).val('');
  $('input[name=exercise-correct]').prop('checked', false);
};

var exerciseDownload = function(exercise) {
  var url = URL.createObjectURL(
    new Blob([JSON.stringify(exercise, null, 2)],
             {type: 'application/json'}));
  var a = $('<a></a>')
    .attr({href: url, download: exercise.name + '.json'})
    .appendTo('body');
  a[0].click();
  a.remove();
  window.setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
};

// Sends the finished exercise to the server (python server.py), which saves
// it as exercises/<name>.json in the assignment repository. The browser also
// downloads the file, whether or not a server is reachable.
var exercisePost = function(exercise, done, fail) {
  fetch('/api/challenges/' + encodeURIComponent(exercise.name), {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(exercise),
  }).then(function(res) {
    if (!res.ok)
      throw new Error('HTTP ' + res.status);
    return res.json();
  }).then(done).catch(fail);
};

var exerciseExport = function() {
  playback.pause();
  if (exerciseAuthoring.question === null) {
    updateExerciseControls();
    alert('Set the question first: fill in the form and press Set question.');
    return;
  }
  var exercise = {
    format: 1,
    name: exerciseAuthoring.name,
    question: exerciseAuthoring.question,
    answers: exerciseAuthoring.answers,
    correct: exerciseAuthoring.correct,
    stageTime: exerciseAuthoring.stageTime,
    stage: exerciseAuthoring.stage,
    solution: state.exportToString(),
  };
  exercisePost(exercise, function() {
    exerciseDownload(exercise);
    exerciseNotice = 'Challenge "' + exercise.name + '" saved by the server as ' +
                    'exercises/' + exercise.name + '.json and downloaded - ' +
                    'commit the file in exercises/ to your repository.';
    exerciseAuthoring = null;
    resetExerciseCreateForm();
    updateExerciseControls();
  }, function() {
    exerciseDownload(exercise);
    exerciseNotice = 'No server reachable: challenge "' + exercise.name +
                    '" downloaded as ' + exercise.name + '.json - save it in ' +
                    'exercises/ and commit it to your repository.';
    exerciseAuthoring = null;
    resetExerciseCreateForm();
    updateExerciseControls();
  });
};

var exerciseArrive = function() {
  // playback.pause() re-renders, and the render polls for the arrival, so
  // this must not run again inside that nested render: clearing the flag
  // first and re-checking it stops the recursion.
  if (!exerciseWatching)
    return;
  exerciseWatching = false;
  playback.pause();
  updateExerciseControls();
};

var exerciseStage = function(exercise) {
  playback.pause();
  try {
    state.importFromString(exercise.stage);
  } catch (e) {
    alert('This exercise file contains an invalid simulation state.');
    return;
  }
  // Discard anything the author had recorded past the stage, so the solver
  // cannot scrub past the question and spoil the solution before answering.
  state.rewind(Math.min(exercise.stageTime, state.getMaxTime()));
  state.fork();
  exerciseArriveTime = state.current.time;
  // Rewind to the beginning and replay the recorded story: the timeline is
  // exactly what the author recorded, so the run is reproducible, including
  // every randomly drawn election timeout. It stops at the stage.
  exerciseChoice = null;
  exerciseSolution = exercise;
  state.rewind(0);
  exerciseWatching = true;
  updateExerciseControls();
  render.update();
  if (exerciseWatching)
    playback.resume();
};

var renderSolvePanel = function() {
  var exercise = exerciseSolution;
  if (exercise === null)
    return;
  $('#exercise-solve-question').text(exercise.question);
  var list = $('#exercise-solve-answers');
  list.empty();
  for (var i = 0; i < exercise.answers.length; i += 1) {
    var item = $('<a href="#" class="list-group-item exercise-answer"></a>')
      .text(exercise.answers[i])
      .click(function(e) {
        e.preventDefault();
        if (exerciseChoice !== null)
          return false;
        exerciseChoice = parseInt($(this).data('index'), 10);
        renderSolvePanel();
        return false;
      })
      .data('index', i);
    if (exerciseChoice !== null) {
      if (i == exercise.correct)
        item.addClass('correct');
      if (i == exerciseChoice)
        item.addClass(i == exercise.correct ? 'picked-correct' : 'picked-wrong');
    }
    list.append(item);
  }
  var feedback = $('#exercise-solve-feedback');
  feedback.empty();
  feedback.removeClass('alert-success alert-danger');
  if (exerciseChoice !== null) {
    if (exerciseChoice == exercise.correct) {
      feedback
        .addClass('alert alert-success')
        .text('Correct. Press Show solution to watch why.');
    } else {
      feedback
        .addClass('alert alert-danger')
        .text('Not correct: the green answer is the one that happens. ' +
              'Press Show solution to watch why.');
    }
  }
  $('#exercise-reveal').prop('disabled', exerciseChoice === null);
};

$('#modal-exercise-import').on('show.bs.modal', function() {
  playback.pause();
});

$('#exercise-create').click(function() {
  if (exerciseAuthoring !== null) {
    exerciseExport();
  } else if (exerciseSolution === null) {
    exerciseNotice = '';
    playback.pause();
    render.update();
    exerciseAuthoring = {
      name: null,
      question: null,
      answers: null,
      correct: null,
      stageTime: state.current.time,
      stage: state.exportToString(),
    };
    updateExerciseControls();
    $('#exercise-name').focus();
  }
  return false;
});

$('#exercise-cancel').click(function() {
  exerciseAuthoring = null;
  updateExerciseControls();
  return false;
});

$('#exercise-set').click(function() {
  var name = $('#exercise-name').val().trim();
  var question = $('#exercise-create-question').val().trim();
  var answers = [];
  for (var i = 0; i < 4; i += 1)
    answers.push($('#exercise-answer-' + i).val().trim());
  var correct = $('input[name=exercise-correct]:checked').val();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    alert('Give the exercise a name: lowercase letters, digits and dashes, ' +
          'to be used as the file name.');
    return false;
  }
  if (question == '') {
    alert('Type a question.');
    return false;
  }
  for (var i = 0; i < 4; i += 1) {
    if (answers[i] == '') {
      alert('Fill in all four answers.');
      return false;
    }
  }
  if (correct === undefined) {
    alert('Select which answer is correct.');
    return false;
  }
  if (exerciseAuthoring === null) {
    // The form is always available: starting here captures the stage now.
    playback.pause();
    exerciseAuthoring = {
      name: null,
      question: null,
      answers: null,
      correct: null,
      stageTime: state.current.time,
      stage: state.exportToString(),
    };
  }
  exerciseAuthoring.name = name;
  exerciseAuthoring.question = question;
  exerciseAuthoring.answers = answers;
  exerciseAuthoring.correct = parseInt(correct, 10);
  updateExerciseControls();
  playback.resume();
  return false;
});

// Lists the exercises the server has in exercises/ and opens a picker.
// Without a server (page opened as a file), falls back to a file selection.
var exerciseImportList = function() {
  fetch('/api/challenges')
    .then(function(res) {
      if (!res.ok)
        throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(data) {
      renderExerciseImportModal(data.exercises);
    })
    .catch(function() {
      $('#exercise-file').click();
    });
};

var renderExerciseImportModal = function(listing) {
  var list = $('#exercise-import-list');
  list.empty();
  if (listing.length === 0) {
    list.append($('<li class="list-group-item text-muted"></li>')
      .text('No challenges on the server yet. Export one first, or place a ' +
            "partner's exercise file in the exercises directory."));
    $('#modal-exercise-import').modal('show');
    return;
  }
  listing.forEach(function(entry) {
    var short = entry.question.length > 100 ?
      entry.question.slice(0, 100) + '...' : entry.question;
    $('<a href="#" class="list-group-item exercise-import"></a>')
      .append($('<h4 class="list-group-item-heading"></h4>').text(entry.name))
      .append($('<p class="list-group-item-text text-muted"></p>').text(short))
      .click(function(e) {
        e.preventDefault();
        fetch('/api/challenges/' + encodeURIComponent(entry.name))
          .then(function(res) {
            if (!res.ok)
              throw new Error('HTTP ' + res.status);
            return res.json();
          })
          .then(function(exercise) {
            if (!exerciseIsValid(exercise)) {
              alert('The challenge "' + entry.name + '" on the server is not valid.');
              return;
            }
            $('#modal-exercise-import').modal('hide');
            exerciseNotice = '';
            exerciseStage(exercise);
          })
          .catch(function() {
            alert('Could not load the challenge "' + entry.name + '" from the server.');
          });
        return false;
      })
      .appendTo(list);
  });
  $('#modal-exercise-import').modal('show');
};

$('#exercise-load').click(function() {
  exerciseImportList();
  return false;
});

// A challenge file from anywhere, e.g. a file a partner sent, without placing it in exercises/ first.
$('#exercise-upload').click(function() {
  $('#modal-exercise-import').modal('hide');
  $('#exercise-file').click();
  return false;
});

$('#exercise-file').change(function() {
  var file = this.files[0];
  this.value = '';
  if (!file)
    return;
  var reader = new FileReader();
  reader.onload = function() {
    var exercise;
    try {
      exercise = JSON.parse(reader.result);
    } catch (e) {
      exercise = null;
    }
    if (!exerciseIsValid(exercise)) {
      alert('Not a valid exercise file.');
      return;
    }
    exerciseNotice = '';
    exerciseStage(exercise);
  };
  reader.readAsText(file);
});

$('#exercise-clear-exercise').click(function() {
  exerciseSolution = null;
  exerciseChoice = null;
  exerciseWatching = false;
  updateExerciseControls();
  return false;
});

$('#exercise-reveal').click(function() {
  var exercise = exerciseSolution;
  playback.pause();
  state.importFromString(exercise.solution);
  state.rewind(Math.min(exercise.stageTime, state.getMaxTime()));
  exerciseSolution = null;
  exerciseChoice = null;
  exerciseWatching = false;
  exerciseNotice = '';
  render.update();
  updateExerciseControls();
  playback.resume();
  return false;
});

updateExerciseControls();

var getLeader = function() {
  var leader = null;
  var term = 0;
  state.current.servers.forEach(function(server) {
    if (server.state == 'leader' &&
        server.term > term) {
        leader = server;
        term = server.term;
    }
  });
  return leader;
};

$("#speed").slider({
  tooltip: 'always',
  formater: function(value) {
    return '1/' + speedSliderTransform(value).toFixed(0) + 'x';
  },
  reversed: true,
});

timeSlider = $('#time');
timeSlider.slider({
  tooltip: 'always',
  formater: function(value) {
    return (value / 1e6).toFixed(3) + 's';
  },
});
timeSlider.on('slideStart', function() {
  playback.pause();
  sliding = true;
});
timeSlider.on('slideStop', function() {
  // If you click rather than drag,  there won't be any slide events, so you
  // have to seek and update here too.
  state.seek(timeSlider.slider('getValue'));
  sliding = false;
  render.update();
});
timeSlider.on('slide', function() {
  state.seek(timeSlider.slider('getValue'));
  render.update();
});

$('#time-button')
  .click(function() {
    playback.toggle();
    return false;
  });

// Disabled for now, they don't seem to behave reliably.
// // enable tooltips
// $('[data-toggle="tooltip"]').tooltip();

state.updater = function(state) {
  raft.update(state.current);
  var time = state.current.time;
  var base = state.base(time);
  state.current.time = base.time;
  var same = util.equals(state.current, base);
  state.current.time = time;
  return !same;
};

state.init();
ensurePartitionState();
render.update();
});
