export type JsonType = {
  network: string;
  geoname_id: string;
  registered_country_geoname_id: string;
  represented_country_geoname_id: string;
  is_anonymous_proxy: string;
  is_satellite_provider: string;
  is_anycast: string;
};
export type JsonTypeShort = Pick<JsonType, 'network' | 'geoname_id'>;
