alexaUpdate = (a, set) => {
  let res;
  try {
    res = HTTP.get('http://data.alexa.com/data?cli=10&url=' + a.url);
  } catch (e) {
    console.error('ALEXA: Cannot get the http', e);
    return;
  }
  if (res.statusCode !== 200) {
    console.error('ALEXA: http gave', res, res.statusCode);
    return;
  }
  const re = /<REACH RANK="(\d+)"\/>/g;
  const m = re.exec(res.content);
  const rank = m ? +m[1] : 999999999;

  if (rank < a.bestRank) set.bestRank = rank;
  set.rank = rank;
  set.alexa = res.content;
};
