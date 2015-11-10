
Session.setDefault('q', '');

Router.route('add');

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

Template.add.events({
  'submit .newApps'(event) {
    let apps = event.target.textarea.value;
    Meteor.call('add', apps, (error) => {
      if (error) { console.log('error', error); toastr.error(error.reason); return; }
      toastr.success('Added to the queue, it\'ll be parsed soon');

      apps = apps.replace(';', ' ');
      apps = apps.replace(',', ' ');
      apps = apps.replace(/\s+/g, ' ');
      if (apps) {
        apps = apps.split(' ');
        apps = apps.filter(Boolean);
        if (apps.length) {
          console.log('dddd', apps);
          $('#q').val(apps[0]);
          Session.set('q', apps[0]);
        }
      }
      Router.go('/');
      event.target.textarea.value = '';
    });
    return false;
  }
});

Template.add.helpers({
  subs: function () {
    return invalidDomains.join(', ');
  },
});

Houston.menu({
  'type': 'link',
  'use': '/bad',
  'title': 'Bad Apps',
  'target': 'blank'
});
