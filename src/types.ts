export interface RawAddress {
  address: string
  title: string
  metadata: Record<string, unknown>
}

export interface PreGeocodedAddress extends RawAddress {
  lat: number
  lng: number
}

export interface Category {
  id: string
  name: string
  color: string
  addresses: RawAddress[]
}

export interface GeocodedEntry {
  id: string
  title: string
  address: string
  metadata: Record<string, unknown>
  lat: number
  lng: number
  categoryId: string
}
