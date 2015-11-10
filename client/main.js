
Session.setDefault('q', '');

Router.route('bad', {
  data() { return Apps.find({}, { sort: { rank: 1 } }); },
  waitOn() { Meteor.subscribe('appsAdmin', Session.get('q')); },
});

Router.route('/:q?', {
  name: 'home',
  onRun() { if (this.params.q) Session.set('q', this.params.q); this.next(); },
  data() { return Apps.find({}, { sort: { meteorRank: 1 } }); },
  subscriptions() { return Meteor.subscribe('apps', Session.get('q')); },
});

Template.searchBar.onRendered(() => {
  $('#q').val(Session.get('q'));
  $('#q').focus();
});

Template.searchBar.events({
  'keyup #q'(e) {
    Session.set('q', e.target.value);
  },
});

Template.app.events({
  'click .refresh'() {
    Meteor.call('refresh', this._id);
    return false;
  },
  'click .remove'() {
    Meteor.call('remove', this._id);
    return false;
  },
  'click .disqualify'() {
    Meteor.call('disqualify', this._id);
    return false;
  },
});

Template.app.helpers({
  date() {
    return moment(this.updatedAt).fromNow();
  },
  class() {
    if (this.indexOf(':') !== -1) return 'label-info';
    else if (this === 'insecure') return 'label-danger';
    return 'label-default';
  },
  collectionCount() {
    return this.collections && this.collections.length;
  },
  packageCount() {
    return this.packages && this.packages.length;
  },
  fastoUrl() {
    if (!this) return undefined;
    return 'http://fastosphere.meteor.com/' + this;
  },
  fullUrl(url) {
    if (url && url.indexOf('http') !== 0) return 'http://' + url;
    return url;
  },
});

Houston.menu({
  'type': 'link',
  'use': '/bad',
  'title': 'Bad Apps',
  'target': 'blank'
});
