
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const updateLimit = 10;

Apps._ensureIndex('url', { unique: 1, sparse: 1 });

Meteor.publish('apps', q => {
  check(q, String);
  const search = new RegExp(q, 'i');
  if (q.length >= 4) {
    return Apps.find({ url: { $regex: search } }, { limit: 5 });
  } else if (q) {
    return Apps.find({ url: { $regex: search } }, { limit: 1 });
  }
  return Apps.find({ url: { $regex: search }, meteorRank: { $exists: true }, error: '' }, { sort: { meteorRank: 1 }, limit: 20 });
});

Meteor.publish('appsAdmin', q => {
  check(q, String);
  let selector;
  if (q) selector = { url: { $regex: new RegExp(q, 'i') } };
  else selector = { error: { $ne: '' } };
  return Apps.find(selector, { limit: 50, sort: { rank: 1 } });
});

const extractUrl = url => {
  const re = /(?:https?:\/\/)?(?:www\.)?([-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6})\b(?:[-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)/g;
  const m = re.exec(url);
  if (!m) { console.log('dont find url in', url); return ''; }
  console.log('clean "' + url + '" -> "' + m[1] + '"');
  return m[1];
};

Meteor.methods({
  add(appString) {
    check(appString, String);
    appString = appString.replace(';', ' ');
    appString = appString.replace(',', ' ');
    appString = appString.replace(/\s+/g, ' ');
    if (!appString) throw new Meteor.Error('add', 'Empty list');

    let apps = appString.split(' ');
    apps = apps.filter(Boolean);
    if (!apps.length) throw new Meteor.Error('add', 'Empty list');

    let appids = [];
    console.log('apps', apps);
    _.each(apps, url => {
      const cleanUrl = extractUrl(url);
      if (!cleanUrl) return;
      if (cleanUrl.indexOf('.meteor.com') !== -1) return;
      if (cleanUrl.indexOf('.nitrousbox.com') !== -1) return;
      if (cleanUrl.indexOf('.reactioncommerce.com') !== -1) return;
      if (cleanUrl.indexOf('.meteorpad.com') !== -1) return;
      if (cleanUrl.indexOf('.localtunnel.me') !== -1) return;

      const search = new RegExp(cleanUrl, 'i');
      const app = Apps.findOne({ url: { $regex: search } });
      if (app) {
        console.log('App already added', url, cleanUrl, app);
        return;
      }
      console.log('Adding', url);
      appids.push(Apps.insert({ url, cleanUrl, createdAt: new Date() }));
    });
    this.unblock();
    update({ _id: { $in: appids } }, {});
  },
  refresh(aid) {
    check(aid, String);
    // if (!this.userId) return;
    const app = Apps.findOne(aid);
    if (!app) throw new Meteor.Error('refresh', 'Bad app id');
    console.log('Refreshing...', app.url);
    this.unblock();
    update({ _id: app._id }, {});
    console.log('Done');
  },
  disqualify(aid) {
    check(aid, String);
    if (!this.userId) return;
    const app = Apps.findOne(aid);
    if (!app) throw new Meteor.Error('disqualify', 'Bad app id');
    Apps.update(app._id, { $set: { disqualified: true, meteorRank: 999999999 } });
  },
  remove(aid) {
    check(aid, String);
    if (!this.userId) return;
    const app = Apps.findOne(aid);
    if (!app) throw new Meteor.Error('remove', 'Bad app id');
    Apps.remove(app._id);
    console.log('REMOVED by admin', app.url);
  },
});


const update = (selector, options) => {
  Apps.find(selector, options).forEach(a => {
    let set = {};
    console.log('Updating...', a.url, a.updatedAt);
    alexaUpdate(a, set);
    meteorUpdate(a, set);
    set.updatedAt = new Date();
    if (!set.error) set.error = '';

    // remove set keys that hasn't changed
    _.each(set, (v, k) => {
      if (_.isArray(v)) {
        if (_.difference(v, a[k]).length === 0) {
          delete set[k];
        }
      } else if (_.isString(v) || _.isNumber(v)) {
        if (v === a[k]) {
          delete set[k];
        }
      }
    });

    console.log('Set...', set);
    Apps.update(a._id, { $set: set });

    console.log('Done...', a.url);
  });
  rankUpdate();
};

let updateInProgress = false;
Meteor.setInterval(() => {
  if (updateInProgress) return;
  updateInProgress = true;

  // // force new website update
  // console.log('Update new website alexa');
  // Apps.find({ rank: { $exists: false } }, { limit: updateLimit }).forEach(function (a) {
  //   alexaUpdate(a);
  // });
  // console.log('Update new website meteor');
  // Apps.find({ meteorRuntimeConfig: { $exists: false } }, { limit: updateLimit }).forEach(function (a) {
  //   meteorUpdate(a);
  // });
  // console.log('Update new website js');
  // Apps.find({ packages: { $exists: false } }, { limit: updateLimit }).forEach(function (a) {
  //   meteorJSUpdate(a);
  // });

  // update oldest website
  console.log('Update old apps');
  update({}, { limit: updateLimit, sort: { updatedAt: 1 } });

  updateInProgress = false;
}, 1000 * 10);
