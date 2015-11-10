const download = url => {
  let res;
  try {
    res = HTTP.get(url);
  } catch (e) {
    console.error('DOWNLOAD: exception', url, e);
    return '';
  }
  if (res.statusCode !== 200) {
    console.error('DOWNLOAD: bad status code', url, res.statusCode, res);
    return '';
  }
  return res;
};

meteorUpdate = (a, set) => {
  let url = a.url;

  if (url.indexOf('http') !== 0) url = 'http://' + url;

  const html = download(url);
  if (!html) {
    set.error = 'Cannot download ' + url;
    return;
  }

  const regMRC = /__meteor_runtime_config__ = (.*);/g;
  let m = regMRC.exec(html.content);
  if (!m) {
    set.error = 'Not a Meteor app (no MRC)';
    return;
  }

  let meteorRuntimeConfig;
  try {
    meteorRuntimeConfig = JSON.parse(m[1]);
  } catch (e) {
    const regParse = /JSON\.parse\(decodeURIComponent\("(.*)"\)\)/g;
    m = regParse.exec(m[1]);
    if (!m) {
      set.error = 'Bad Meteor MRC';
      return;
    }

    try {
      meteorRuntimeConfig = JSON.parse(decodeURIComponent(m[1]));
    } catch (f) {
      set.error = 'Bad Meteor MRC2';
      return;
    }
  }

  set.version = meteorRuntimeConfig.meteorRelease || '???';
  set.meteorRuntimeConfig = JSON.stringify(meteorRuntimeConfig);

  const regJS = /<script type="text\/javascript" src="(.*?\/[0-9a-z]{40}\.js).*"><\/script>/g;
  m = regJS.exec(html.content);
  if (!m) {
    set.meteorJS = '';
    set.error = 'No Javascript file found';
    return;
  }

  let meteorJS;
  if (m[1].indexOf('http') === 0) {
    meteorJS = m[1];
  } else {
    if (url.substr(-1) === '/' && m[1].substr(0, 1) === '/') {
      meteorJS = url + m[1].substr(1);
    } else {
      meteorJS = url + m[1];
    }
  }

  set.meteorJS = meteorJS;

  const js = download(meteorJS);

  if (!js) {
    set.error = 'Cannot download ' + meteorJS;
    return;
  }

  let packages = [];
  const regPackage = /Package\["([^"]+)"\]/g;
  while ((m = regPackage.exec(js.content)) !== null) {
    if (m.index === regPackage.lastIndex) {
      regPackage.lastIndex++;
    }
    packages.push(m[1]);
  }
  if (!packages.length) {
    set.error = 'No Packages found';
    return;
  }

  if (js.content.indexOf('Package.insecure={}') !== -1) packages.push('insecure');

  packages = _.sortBy(packages, name => { return name; });
  packages = _.uniq(packages, true);

  set.packages = packages;

  let collections = [];
  const regCollection = /([a-zA-Z0-9-_]+)=new (?:Meteor|Mongo).Collection\("([a-zA-Z0-9-_]+)"\)/g;
  while ((m = regCollection.exec(js.content)) !== null) {
    if (m.index === regCollection.lastIndex) {
      regCollection.lastIndex++;
    }
    collections.push(m[1]);
  }
  collections = _.sortBy(collections, name => { return name; });
  collections = _.uniq(collections, true);

  set.collections = collections;
};
