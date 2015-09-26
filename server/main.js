
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

var updateLimit = 10;

Apps._ensureIndex('url', { unique: 1, sparse: 1 });

Meteor.publish('apps', function (q) {
  check(q, String);
  var search = new RegExp(q, 'i');
  if(q.length >= 4) {
    return Apps.find({ url: { $regex: search } }, { limit: 5 });
  } else if(q) {
    return Apps.find({ url: { $regex: search } }, { limit: 1 });
  } else {
    return Apps.find({ url: { $regex: search }, meteorRank: { $exists: true }, bad: { $exists: false } }, { sort: { meteorRank: 1 }, limit: 20 });
  }
});

Meteor.publish('appsAdmin', function (q) {
  check(q, String);
  if(q) selector = { url: { $regex: new RegExp(q, 'i') } };
  else selector = { bad: { $exists: true } };
  return Apps.find(selector, { limit: 50 });
});

var cleanUrl = function (url) {
  var re = /(?:https?:\/\/)?(?:www\.)?([-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6})\b(?:[-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)/g;
  var m = re.exec(url);
  if(!m) { console.log('dont find url in', url); return ''; }
  console.log('clean "' + url + '" -> "' + m[1] + '"');
  return m[1];
};

Meteor.methods({
  add: function(appString) {
    check(appString, String);
    appString = appString.replace(';', ' ');
    appString = appString.replace(',', ' ');
    appString = appString.replace(/\s+/g, ' ');
    if(!appString) throw new Meteor.Error('add', 'Empty list');

    var apps = appString.split(' ');
    apps = apps.filter(Boolean);
    if(!apps.length) throw new Meteor.Error('add', 'Empty list');

    console.log('apps', apps);
    _.each(apps, function(a) {
      var url = cleanUrl(a);
      if(!url) return;
      if(url.indexOf('.meteor.com') !== -1) return;
      if(url.indexOf('.nitrousbox.com') !== -1) return;
      if(url.indexOf('.reactioncommerce.com') !== -1) return;
      if(url.indexOf('.meteorpad.com') !== -1) return;
      if(url.indexOf('.localtunnel.me') !== -1) return;
      var app = Apps.findOne({ url: url });
      if(app) return;
      console.log('Adding', url);
      Apps.insert({ url: url, createdAt: new Date() });
    });
  },
  refresh: function (aid) {
    check(aid, String);
    //if(!this.userId) return;
    var app = Apps.findOne(aid);
    if(!app) throw new Meteor.Error('refresh', 'Bad app id');
    console.log('Refreshing...', app.url);
    needRecomputeRank = true;
    update({ _id: app._id }, {});
    console.log('Done');
  },
  remove: function (aid) {
    check(aid, String);
    if(!this.userId) return;
    var app = Apps.findOne(aid);
    if(!app) throw new Meteor.Error('remove', 'Bad app id');
    Apps.remove(app._id);
    console.log('REMOVED by admin', app.url);
  },
});


var meteorJSUpdate = function (a) {
  var res;
  try {
    res = HTTP.get(a.meteorJS);
  } catch(e) {
    console.log('err getting js of', a.url, a.meteorJS, e);
    Apps.update(a._id, { $set: { updatedAt: new Date(), bad: 'meteorJSUpdateExc' } });
    return;
  }
  if(res.statusCode !== 200) {
    console.log('bad status code getting js of', a.url, a.meteorJS, res.statusCode, res);
    Apps.update(a._id, { $set: { updatedAt: new Date(), bad: 'meteorJSUpdateCode' } });
    return;
  }

  var packages = [];
  var re = /Package\["([^"]+)"\]/g;
  var m;
  while ((m = re.exec(res.content)) !== null) {
    if (m.index === re.lastIndex) {
        re.lastIndex++;
    }
    packages.push(m[1]);
  }
  if(!packages.length) {
    console.log('no packages', a.url, a.meteorJS);
    Apps.update(a._id, { $set: { updatedAt: new Date(), bad: 'meteorJSUpdateNoPack' } });
    return;
  }

  if(res.content.indexOf('Package.insecure={}') !== -1)
    packages.push('insecure');

  packages = _.sortBy(packages, function (name) { return name; });
  packages = _.uniq(packages, true);
//    console.log('pa', a.url, packages);

  var collections = [];
  re = /([a-zA-Z0-9-_]+)=new (?:Meteor|Mongo).Collection\("([a-zA-Z0-9-_]+)"\)/g;
  while ((m = re.exec(res.content)) !== null) {
    if (m.index === re.lastIndex) {
        re.lastIndex++;
    }
    collections.push(m[1]);
  }
  collections = _.sortBy(collections, function (name) { return name; });
  collections = _.uniq(collections, true);
//    console.log('col', a.url, collections);

  Apps.update(a._id, { $unset: { bad: '' }, $set: { updatedAt: new Date(), packages: packages, collections: collections } });
};


var meteorUpdate = function (a) {
  var res;
  try {
    res = HTTP.get('http://' + a.url);
  } catch(e) {
    console.log('err getting website', a.url, e, e.response);
    if(e.errno === 'ENOTFOUND') {
      Apps.remove(a._id);
      console.log('REMOVED url not found', a.url);
    } else
      Apps.update(a._id, { $set: { updatedAt: new Date(), bad: 'meteorUpdateGet' } });
    return false;
  }
  if(res.statusCode !== 200) {
    console.log('bad status code while getting website', a.url, res.statusCode, res);
    Apps.update(a._id, { $set: { updatedAt: new Date(), bad: 'meteorUpdateCode' } });
    return false;
  }

  var re = /__meteor_runtime_config__ = (.*);/g;
  var m = re.exec(res.content);
  if(!m) {
    console.log('not a meteor app (no __meteor_runtime_config__)', a.url);
    Apps.update(a._id, { $set: { updatedAt: new Date(), bad: 'Not a Meteor app (no MRC)' } });
    return false;
  }

  var meteorRuntimeConfig;
  try {
    meteorRuntimeConfig = JSON.parse(m[1]);
  } catch(e) {
    re = /JSON\.parse\(decodeURIComponent\("(.*)"\)\)/g;
    m = re.exec(m[1]);
    if(!m) {
      console.log('not a meteor app (cannot parse __meteor_runtime_config__)', a.url);
      Apps.update(a._id, { $set: { updatedAt: new Date(), bad: 'Bad Meteor MRC' } });
      return false;
    }

    try {
      meteorRuntimeConfig = JSON.parse(decodeURIComponent(m[1]));
    } catch (e) {
      console.log('not a meteor app (cannot parse2 __meteor_runtime_config__)', a.url);
      Apps.update(a._id, { $set: { updatedAt: new Date(), bad: 'Bad Meteor MRC2' } });
      return false;
    }
  }

  re = /<script type="text\/javascript" src="(.*?\/[0-9a-z]{40}\.js).*"><\/script>/g;
  m = re.exec(res.content);
  if(!m) {
    console.log('not a meteor app (no js file)', a.url);
    Apps.update(a._id, { $set: { updatedAt: new Date(), bad: 'No Javascript file' } });
    return false;
  }
  var meteorJS = m[1];
  if(meteorJS.indexOf('http') === -1) meteorJS = 'http://' + a.url + m[1];

  var modifier = { $unset: { bad: '' }, $set: { updatedAt: new Date(), version: meteorRuntimeConfig.meteorRelease ? meteorRuntimeConfig.meteorRelease : '???', meteorRuntimeConfig: JSON.stringify(meteorRuntimeConfig), meteorJS: meteorJS } };

  //console.log('modified', a, JSON.stringify(modifier));

  Apps.update(a._id, modifier);
  return true;
};

var alexaUpdate = function (a) {
  var res;
  try {
    res = HTTP.get('http://data.alexa.com/data?cli=10&url=' + a.url);
  } catch(e) {
    console.log('err', e);
    return false;
  }
  if(res.statusCode !== 200) return console.log('err get', res, res.statusCode);
  var re = /<REACH RANK="(\d+)"\/>/g;
  var m = re.exec(res.content);
  var rank = m ? +m[1] : 999999999;
  var set = {};

  if(rank != a.rank) { set.rank = rank; needRecomputeRank = true; }
  if(rank < a.bestRank) set.bestRank = rank;
  if(res.content != a.alexa) set.alexa = res.content;
  set.updatedAt = new Date();
  Apps.update(a._id, { $set : set });
  return true;
};

var needRecomputeRank = false;
var recomputeRank = function () {
//  if(!needRecomputeRank) return;
  console.log('Recomputing ranks...');

  var r = 1;
  Apps.find({ bad: { $exists: false }, rank: { $exists: true } }, { sort: { rank: 1 }}).forEach(function(a) {
    Apps.update(a._id, { $set: { meteorRank: r } });
    r++;
  });
  Apps.update({ rank: { $exists: false } }, { $set: { meteorRank: 999999999 } }, { multi: true });
  Apps.update({ bad: { $exists: true } }, { $set: { meteorRank: 999999999 } }, { multi: true });
  console.log('Done');
  needRecomputeRank = false;
};

 var update = function (selector, options) {
  Apps.find(selector, options).forEach(function (a) {
    var res;
    console.log('Updating...', a.url, a.updatedAt);
    alexaUpdate(a);
    res = meteorUpdate(a);
    if(res) meteorJSUpdate(a);
    console.log('Done...', a.url);
  });
  recomputeRank();
};

var updateInProgress = false;
Meteor.setInterval(function() {
  if(updateInProgress) return;
  updateInProgress = true;

  // force new website update
  console.log('Update new website alexa');
  Apps.find({ rank: { $exists: false } }, { limit: updateLimit }).forEach(function (a) {
    alexaUpdate(a);
  });
  console.log('Update new website meteor');
  Apps.find({ meteorRuntimeConfig: { $exists: false } }, { limit: updateLimit }).forEach(function (a) {
    meteorUpdate(a);
  });
  console.log('Update new website js');
  Apps.find({ packages: { $exists: false } }, { limit: updateLimit }).forEach(function (a) {
    meteorJSUpdate(a);
  });

  // update oldest website
  console.log('Update old website');
  update({}, { limit: updateLimit, sort: { updatedAt: 1 } });

  updateInProgress = false;
}, 1000 * 10);
