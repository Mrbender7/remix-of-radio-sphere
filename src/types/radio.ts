export interface RadioStation {
  id: string;
  name: string;
  streamUrl: string;
  logo: string;
  country: string;
  countryCode: string;
  tags: string[];
  language: string;
  codec: string;
  bitrate: number;
  votes: number;
  homepage: string;
}

export interface RadioProvider {
  searchStations(params: SearchParams): Promise<RadioStation[]>;
  getTopStations(limit?: number): Promise<RadioStation[]>;
  getStationsByTag(tag: string, limit?: number): Promise<RadioStation[]>;
  getStationsByCountry(country: string, limit?: number): Promise<RadioStation[]>;
}

export interface SearchParams {
  name?: string;
  country?: string;
  tag?: string;
  language?: string;
  limit?: number;
  offset?: number;
  order?: string;
  reverse?: string;
  tagList?: string;
}
