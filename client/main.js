
Session.setDefault('q', '');

Router.route('add');

Router.route('bad', {
  data: function () { return Apps.find({}, { sort: { bad: 1 } }); },
  waitOn: function () { Meteor.subscribe('appsAdmin', Session.get('q')); }
});

Router.route('/:q?', {
  name: 'home',
  onRun: function () { if(this.params.q) Session.set('q', this.params.q); this.next(); },
  data: function () { return Apps.find({}, { sort: { meteorRank: 1 } }); },
  subscriptions: function () { return Meteor.subscribe('apps', Session.get('q')); },
});

Template.searchBar.rendered = function () {
  $('#q').val(Session.get('q'));
  $('#q').focus();
};

Template.searchBar.events({
  'keyup #q': function (e) {
    Session.set('q', e.target.value);
  },
});

Template.app.events({
  'click .refresh': function() {
    Meteor.call('refresh', this._id);
    return false;
  },
  'click .remove': function() {
    Meteor.call('remove', this._id);
    return false;
  },
});

Template.app.helpers({
  date: function () {
    return moment(this.lastUpdated).fromNow();
  },
  errors: function () {
    var err = [];
    if(this.badgit) err.push('bad github url.');
    if(!this.changelogUrl) err.push('no changelog.');
    return err.length > 0 ? 'For the maintainer: ' + err.join(' ') : undefined;
  },
  class: function () {
    if(this.indexOf(':') !== -1)
      return 'label-info';
    else if(this == 'insecure')
      return 'label-danger';
    else
      return 'label-default';
  },
  collectionCount: function () {
    return this.collections && this.collections.length;
  },
  packageCount: function () {
    return this.packages && this.packages.length;
  },
  atmoUrl: function () {
    if(!this) return undefined;
    var pos = this.indexOf(':');
    if(pos !== -1)
      return 'https://atmospherejs.com/'+this.substr(0, pos)+'/'+this.substr(pos+1);
    else
      return undefined;
  },
});

Template.add.events({
  'submit .newApps': function (event) {
    var apps = event.target.textarea.value;
    Meteor.call('add', apps, function (error) {
      if(error) { console.log('error', error); toastr.error(error.reason); return; }
      event.target.textarea.value = '';
      toastr.success('Added to the queue, it\'ll be parsed soon');
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
