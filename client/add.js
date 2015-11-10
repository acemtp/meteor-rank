Router.route('add');

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
  },
});

Template.add.helpers({
  subs() {
    return invalidDomains.join(', ');
  },
});
