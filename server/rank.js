rankUpdate = () => {
  console.log('Update ranks...');

  let r = 1;
  Apps.find({ disqualified: { $exists: false }, error: '', rank: { $exists: true } }, { sort: { rank: 1 }}).forEach((a) => {
    const disqualified = a.url.indexOf('.mit.edu') !== -1 || a.url.indexOf('.rit.edu') !== -1 || a.url.indexOf('.hu-berlin.de') !== -1;

    if (disqualified) {
      console.log('disqualified', a.url);
      Apps.update(a._id, { $set: { disqualified: true } });
    } else {
      // update rank only if it changed
      if (a.meteorRank !== r) Apps.update(a._id, { $set: { meteorRank: r } });
      r++;
    }
  });
  Apps.update({ $or: [
    { error: { $ne: '' } },
    { rank: { $exists: false } },
    { disqualified: true },
  ] }, { $set: { meteorRank: 999999999 } }, { multi: true });
  console.log('Done');
};
