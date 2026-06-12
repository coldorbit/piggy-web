const CANADA_PATTERN = /\b(canada|canadian|toronto|vancouver|montreal|ottawa|calgary|edmonton|winnipeg|quebec|ontario|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|labrador|prince edward island|yukon|nunavut|northwest territories)\b|,\s*(can|on|bc|ab|mb|sk|qc|ns|nb|nl|pe|yt|nt|nu)(?:$|[\s,)/-])/i;
const US_WORLDWIDE_PATTERN = /\b(united states|usa|u\.s\.a\.|u\.s\.|us only|remote us|worldwide|global|anywhere|americas|north america|new york|san francisco|los angeles|seattle|austin|boston|chicago|denver|atlanta|dallas|miami|washington dc|washington, dc|california|texas|florida|illinois|massachusetts|georgia|colorado|washington state)\b|(?:^|[\s,(/-])(us|ny|sf|ca|tx|fl|wa|ma|il|ga|co|az|pa|nj|nc|va|mi|oh|or|ut|tn)(?:$|[\s,)/-])/i;

export function jobRegion(job) {
  const locations = jobLocationTexts(job);
  if (locations.some((location) => CANADA_PATTERN.test(location))) {
    return {
      value: 'canada',
      label: 'Canada',
      color: '#9F1239',
      bgcolor: '#FFE4E6',
    };
  }

  if (!locations.length || locations.some((location) => US_WORLDWIDE_PATTERN.test(location))) {
    return {
      value: 'us_worldwide',
      label: 'US/Worldwide',
      color: '#1D4ED8',
      bgcolor: '#DBEAFE',
    };
  }

  return null;
}

function jobLocationTexts(job) {
  const optionLocations = (job?.locationOptions || [])
    .map((option) => option.locationLabel || option.location)
    .filter(Boolean);
  return [...optionLocations, job?.location].filter(Boolean).map((location) => String(location).trim());
}
