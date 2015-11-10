Meteor.publish('packages', () => {
  return Packages.find({}, { sort: { rank: 1 }, limit: 50 });
});

const packagesRankUpdate = () => {
  console.log('Update package ranks...');

  let packages = {};

  const appCursor = Apps.find({ disqualified: { $exists: false }, error: '', rank: { $exists: true } }, { sort: { rank: 1 }});

  const appCount = appCursor.count();

  appCursor.forEach((a) => {
    _.each(a.packages, p => {
      const pname = p.replace(':', '#');
      packages[pname] = packages[pname] ? packages[pname] + 1 : 1;
    });
  });

  packages = _.map(packages, (count, name) => { return { name, count }; });
  packages = _.sortBy(packages, (p) => { return -p.count; });

  // console.log('res', packages);

  Packages.remove({});
  let r = 0;
  let count = 9999999;
  _.each(packages, p => {
    if (p.count !== count) {
      r++;
      count = p.count;
    }
    Packages.insert({ name: p.name.replace('#', ':'), count: p.count, rank: r, percent: (100.0 * count / appCount) | 0 });
  });

  console.log('Done');
};

let updateInProgress = false;
Meteor.setInterval(() => {
  if (updateInProgress) return;
  updateInProgress = true;

  packagesRankUpdate();

  updateInProgress = false;
}, 1000 * 60 * 60);

packagesRankUpdate();
