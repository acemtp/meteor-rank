Router.route('packages', {
  data() { return Packages.find({}, { sort: { rank: 1 } }); },
  waitOn() { Meteor.subscribe('packages'); },
});
