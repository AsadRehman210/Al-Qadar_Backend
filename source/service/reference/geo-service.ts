import { Country, City } from "country-state-city";

// Static reference data (bundled with the country-state-city package, no DB
// involved) — served from the backend so the frontend never has to bundle
// this itself. Previously this dataset was imported directly into the
// frontend, which made the Add Customer bundle noticeably heavier; now the
// frontend just calls a small paginated/searchable API like any other
// dropdown source in this app.

export interface CountryOption {
  // `id` mirrors every other dropdown-source dto in this app (a plain value
  // the frontend can select/store directly) — here it's the ISO code, the
  // same value City.getCitiesOfCountry() expects.
  id: string;
  name: string;
}

const ALL_COUNTRIES: CountryOption[] = Country.getAllCountries()
  .map((c) => ({ id: c.isoCode, name: c.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const getCountries = (search?: string): CountryOption[] => {
  if (!search || !search.trim()) return ALL_COUNTRIES;
  const needle = search.trim().toLowerCase();
  return ALL_COUNTRIES.filter((c) => c.name.toLowerCase().includes(needle));
};

export interface CityOption {
  // City names have no separate stable code in this dataset — the name
  // itself is the id, same value that gets stored on the customer record.
  id: string;
  name: string;
}

const citiesCache = new Map<string, CityOption[]>();

const getCities = (countryCode: string, search?: string): CityOption[] => {
  let all = citiesCache.get(countryCode);
  if (!all) {
    all = (City.getCitiesOfCountry(countryCode) || [])
      .map((c) => ({ id: c.name, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    citiesCache.set(countryCode, all);
  }
  if (!search || !search.trim()) return all;
  const needle = search.trim().toLowerCase();
  return all.filter((c) => c.name.toLowerCase().includes(needle));
};

export { getCountries, getCities };
